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

const MODEL = process.env.OPENAI_MODEL ?? "gpt-5-nano";

const ExtractSchema = z.object({
  value: z.string().nullable(),
  confidence: z.number(),
});

type Body = {
  fieldKey?: string;
  question?: string;
  rawText?: string;
};

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
        "You extract a single candidate answer to one bone-health screening question from a user's free-text reply. Return only what the text plainly states — never infer, guess, calculate, or add outside knowledge. If the text does not clearly answer the question, return null for value. Do not diagnose or give advice.",
      messages: [
        {
          role: "user",
          content: `Question field: ${fieldKey}\nQuestion asked: ${question}\nUser's reply: ${rawText}\n\nReturn the single value the reply gives for this field (e.g. a number, a year, or a short word like "yes"/"no"/"not sure"), or null if the reply does not clearly answer it. Also return your confidence (0 to 1) that this value is correct.`,
        },
      ],
    });
    return Response.json(object);
  } catch (error) {
    console.error("extract failed:", error);
    return Response.json({ error: "BoneBot could not interpret that answer." }, { status: 422 });
  }
}
