import { z } from "zod";

// The LLM's output. Its ONLY job is to turn the model's numeric result into
// clear, honest, non-alarming language. It receives the model's category and
// factor contributions and explains them — it does not decide the risk. See
// api/screen/route.ts for how the two are kept separate.

export const ReportSchema = z.object({
  summary: z
    .string()
    .describe(
      "2-3 sentences a non-expert understands. State the screening result plainly. No filler, no overstatement, no alarm.",
    ),
  factorExplanations: z
    .array(
      z.object({
        factor: z.string().describe("Must be one of the factors provided — do not invent."),
        plain: z.string().describe("One sentence: how this factor affects bone health, in plain language."),
      }),
    )
    .describe("Explain the top factors the model used, grounded ONLY in the contributions provided."),
  modifiableGuidance: z
    .string()
    .describe(
      "The one or two things she can actually change — chiefly weight-bearing activity — framed constructively. Only mention factors present in the input.",
    ),
  recommendation: z
    .string()
    .describe(
      "The next step, e.g. discussing a DXA bone-density scan with her clinician. This is a screening flag, NEVER a diagnosis or a treatment. Make that explicit.",
    ),
});

export type Report = z.infer<typeof ReportSchema>;
