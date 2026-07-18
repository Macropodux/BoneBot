// BoneBot — the explainer. The MODEL (bone-model.ts) computes the estimated
// T-score deterministically on the client; this route only turns that result into
// spoken-friendly words, in one of two modes. It never sets the number.
//
// Two modes:
//  - consumer:  warm, plain, tells her what to DO (lifestyle, or see a GP).
//  - clinician: concise decision support, tells them whether to ACT.
//
// Degrades gracefully: no key → 503 sentence, never a stack trace (see AGENTS.md).

import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import type { BoneFeatures, ModelOutput } from "@/lib/bone-model";
import { evidencePrompt, selectEvidence } from "@/lib/bone-evidence";

export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

type Body = {
  mode: "consumer" | "clinician";
  result: ModelOutput;
  features: BoneFeatures;
  question?: string;
};

const CONSUMER_SYSTEM = `You are BoneBot, a warm, plain-spoken bone-health assistant talking to a postmenopausal woman. Your words will be read ALOUD, so keep sentences short and natural.

You are given a model's ESTIMATED T-score (a bone-density score on the DXA scale: normal ≥ -1.0, osteopenia -2.5 to -1.0, osteoporosis ≤ -2.5), an uncertainty range, the band, and the factors behind it.

Rules:
- The T-score is an ESTIMATE with a range, NOT a measurement or a diagnosis. A DXA scan gives the real one. Say that plainly.
- Explain her estimate in simple terms, then tell her what to do, based on the band:
  • elevated: encourage her to see her GP about a DXA scan and a fracture-risk review — AND give bone-protective lifestyle steps (weight-bearing + resistance exercise, calcium & vitamin D, stop smoking, limit alcohol).
  • uncertain: suggest she mention it to her GP at her next visit, and start the lifestyle steps now.
  • lower: explain that this estimate is reassuring but cannot decide on its own whether a scan is appropriate; suggest discussing screening at a routine GP visit if age or other risk factors make that relevant.
- Only use the factors you are given. Never invent a number or a factor. No drug or treatment advice. Warm and encouraging, never alarming.
- Use clinical wording only from the approved evidence cards in the prompt, and respect each card's limits.`;

const CLINICIAN_SYSTEM = `You are BoneBot clinical decision-support, addressing a GP or clinician. Be concise and clinical.

You are given a model's ESTIMATED T-score (a regression estimate trained on NHANES DXA data), its uncertainty range, the band, and contributing factors.

Rules:
- This is DECISION SUPPORT, not a directive, not a diagnosis, and not a diagnostic device. A human clinician decides.
- State the estimated T-score, its range, and the band (normal / osteopenia / osteoporosis).
- Give a clear suggested action for them to weigh, tied to the estimate and range. E.g. "estimate in osteoporosis range, interval crosses -2.5 → consider DXA referral / FRAX assessment"; or "normal estimate → no imaging indicated, reassess if risk factors change".
- Separate KNOWN clinical risk factors from anything only statistically associated.
- Note it is an estimate from cross-sectional data, to be confirmed by DXA. Never present it as measured. Only use the factors provided.
- Use clinical wording only from the approved evidence cards in the prompt, and respect each card's limits.`;
// The request prompt adds only local evidence cards selected from bone-evidence.ts.
// The LLM must treat their approved wording and limits as a closed evidence set.

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("BoneBot is unavailable: no API key configured.", { status: 503 });
  }

  const body: Body = await req.json();
  const system = body.mode === "clinician" ? CLINICIAN_SYSTEM : CONSUMER_SYSTEM;

  const context = {
    estimatedTScore: body.result.estimatedTScore,
    range: body.result.tScoreRange,
    band: body.result.category,
    validated: body.result.validated,
    factors: body.result.contributions.map((c) => ({ factor: c.factor, direction: c.direction })),
  };
  const evidence = selectEvidence(body.result.contributions.map((contribution) => contribution.factor));

  const prompt = body.question
    ? `Model context:\n${JSON.stringify(context)}\n\nApproved evidence cards:\n${evidencePrompt(evidence.cards)}\n\nHer question: "${body.question}"\nAnswer only from the model context and approved cards. If they do not answer the question, say so and suggest discussing it with a clinician.`
    : `Model context:\n${JSON.stringify(context)}\n\nApproved evidence cards:\n${evidencePrompt(evidence.cards)}\n\nGive the ${body.mode} response now. Use only the model context and approved cards.`;

  try {
    const { text } = await generateText({ model: anthropic(MODEL), system, prompt });
    return Response.json({ text });
  } catch (e) {
    console.error("bonebot failed:", e);
    return new Response("BoneBot is temporarily unavailable.", { status: 503 });
  }
}
