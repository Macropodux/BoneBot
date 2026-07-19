// BoneBot — LLM fallback for a single unparseable free-text answer.
//
// Deterministic parsing (normaliseFreeAnswer in page.tsx) is tried first and
// owns validation. This route only PROPOSES a candidate value when that
// deterministic parse fails; the client re-runs the candidate back through
// normaliseFreeAnswer before ever using it. This route never decides
// anything on its own — see AGENTS.md.

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 15;

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const ExtractSchema = z.object({
  value: z.string().nullable(),
  confidence: z.number(),
});

type Body = {
  fieldKey?: string;
  question?: string;
  rawText?: string;
};

// Yes/no risk-factor fields. normaliseFreeAnswer() on the client already
// recognises a plain "Yes"/"No" for these — the extractor's job is turning a
// hedged or qualified reply ("only socially", "don't have any") into that
// same plain "Yes"/"No", never into anything more specific.
const YES_NO_FIELDS = new Set([
  "assignedFemale",
  "menopauseStatus",
  "existingCare",
  "knowsDxa",
  "fracture",
  "smoke",
  "steroids",
  "secondaryCondition",
]);

// Numeric fields. normaliseFreeAnswer() expects a plain number (or year) as
// text for these.
const NUMERIC_FIELDS = new Set([
  "age",
  "dxaScore",
  "dxaYear",
  "menopause",
  "weight",
  "averageDailySteps",
  "averageDailyActiveMinutes",
]);

function fieldGuidance(fieldKey: string): string {
  // Prior-fragility-fracture field: only a LOW-trauma fracture (fall from
  // standing height or less, a minor bump) counts as a fragility fracture.
  // A HIGH-trauma fracture (car accident, sports injury, major fall from
  // height, other high-impact cause) is not one, even though a fracture did
  // happen — so it must extract as "No".
  if (fieldKey === "fracture") {
    return (
      "This is a yes/no question about prior FRAGILITY fractures specifically, not any fracture. Return exactly " +
      '"Yes" only if the reply describes a fracture from a LOW-trauma event — a fall from standing height or ' +
      'less, or a minor bump or knock. Return exactly "No" if the reply describes a fracture from a HIGH-trauma ' +
      "event — a car accident, a sports injury, a major fall from height, or another high-impact cause — because " +
      'that is NOT a fragility fracture, even though a bone did break (example: "broke my arm in a car accident" ' +
      '-> "No"). Also return "No" for clear negations such as "no", "never", "none", or "don\'t have any". Return ' +
      "null only if the reply truly does not address the question at all."
    );
  }
  // Secondary-cause-of-bone-loss field: only thyroid disease or chronic
  // kidney disease count here (coeliac disease is not part of this model).
  if (fieldKey === "secondaryCondition") {
    return (
      "This is a yes/no question about secondary causes of bone loss. Return exactly \"Yes\" only if the reply " +
      "mentions thyroid disease (including an overactive thyroid / hyperthyroidism) or chronic kidney disease. " +
      'Return exactly "No" if the reply denies having either, or mentions only an unrelated condition. Return ' +
      "null only if the reply truly does not address the question at all."
    );
  }
  if (YES_NO_FIELDS.has(fieldKey)) {
    return (
      "This is a yes/no risk-factor question. Treat ANY affirmative reply — including qualified, hedged, or " +
      'minimising ones such as "only socially", "sometimes", "occasionally", "a bit", "a little", or "used to" — ' +
      'as affirmative and return exactly "Yes". Treat clear negations such as "no", "never", "none", "not really", ' +
      'or "don\'t have any" as "No". Return exactly "Yes" or "No", or null only if the reply truly does not ' +
      "address the question at all."
    );
  }
  if (NUMERIC_FIELDS.has(fieldKey)) {
    return (
      "This field expects a number (e.g. an age in years, a T-score, or a year). Extract only the number the " +
      'reply plainly states, as a plain numeric string (e.g. "67"). Return null if no number is given.'
    );
  }
  return "Return only what the reply plainly states for this field, or null if it does not clearly answer the question.";
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "BoneBot is unavailable: no API key configured." }, { status: 503 });
  }

  const body: Body = await req.json();
  const { fieldKey, question, rawText } = body;
  if (!fieldKey || !question || !rawText) {
    return Response.json({ error: "fieldKey, question, and rawText are required." }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: openai(MODEL),
      schema: ExtractSchema,
      system:
        "You extract a single candidate answer to one bone-health screening question from a user's free-text reply. Return only what the text plainly implies for the specific field described — never infer unrelated facts, guess, calculate, or add outside knowledge. Follow the field-specific instruction in the user message exactly. If the text does not clearly answer the question, return null for value. Do not diagnose or give advice.",
      messages: [
        {
          role: "user",
          content: `Question field: ${fieldKey}\nQuestion asked: ${question}\nUser's reply: ${rawText}\n\n${fieldGuidance(fieldKey)}\n\nAlso return your confidence (0 to 1) that this value is correct.`,
        },
      ],
    });
    return Response.json(object);
  } catch (error) {
    console.error("extract failed:", error);
    return Response.json({ error: "BoneBot could not interpret that answer." }, { status: 422 });
  }
}
