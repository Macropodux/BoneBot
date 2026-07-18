import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { ReportSchema } from "@/lib/bone-schema";
import { scoreBone, type BoneFeatures } from "@/lib/bone-model";

export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

const SYSTEM = `You explain a bone-health SCREENING model's output to a postmenopausal woman, in plain, warm, non-alarming language.

You are given the model's estimated T-score (a bone-density score on the DXA clinical scale, where normal ≥ -1.0 and osteoporosis ≤ -2.5), its uncertainty range, the band, and the factors it used. Rules:
- Explain ONLY the factors you are given. Never invent a factor or a number.
- The T-score is an ESTIMATE with a range, not a measurement. A DXA scan gives the real one — say so plainly.
- This is a SCREENING FLAG, not a diagnosis. A DXA bone-density scan is what confirms. Make that explicit in the recommendation.
- Never prescribe treatment. The next step is always a conversation with her clinician.
- Separate what is a known clinical risk factor from anything uncertain. Do not overstate.
- If the result is "uncertain", say plainly that the evidence is mixed and a scan is the way to be sure — that is a useful answer, not a failure.
- Lead with weight-bearing activity in the modifiable guidance when it is present, since it is one of the few things she can change.`;

// TODO (agents): validate the incoming body with a zod schema before scoring.
export async function POST(req: Request) {
  const features: BoneFeatures = await req.json();

  // 1. THE MODEL predicts. Deterministic, traceable to data, always runs — even
  //    if the LLM is unavailable. The number is the science.
  const model = scoreBone(features);

  // 2. THE LLM explains the model's output. If it fails (no key, exhausted
  //    credits, outage) we still return the model result; the UI shows a plain
  //    fallback. A judge must never see a blank 500.
  let report = null;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { object } = await generateObject({
        model: anthropic(MODEL),
        schema: ReportSchema,
        system: SYSTEM,
        prompt: JSON.stringify({
          estimatedTScore: model.estimatedTScore,
          tScoreLow: model.tScoreRange[0],
          tScoreHigh: model.tScoreRange[1],
          category: model.category,
          validated: model.validated,
          factors: model.contributions.map((c) => ({ factor: c.factor, direction: c.direction })),
        }),
      });
      report = object;
    } catch (e) {
      console.error("screen explanation failed:", e);
    }
  }

  return Response.json({ model, report });
}
