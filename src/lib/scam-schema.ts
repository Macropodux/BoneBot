import { z } from "zod";

// THE CONTRACT.
//
// This is the single most important idea in the whole example: the model does
// not return a paragraph we then try to parse. It is *forced* to return exactly
// this shape, validated. If it can't, the call fails loudly instead of handing
// us prose we have to regex.
//
// Because the shape is guaranteed, the UI can render a score bar and highlight
// phrases — things you cannot reliably do with a wall of text.
//
// The .describe() strings are not comments. They are sent to the model as part
// of the schema and are how it knows what each field means. Writing these well
// is most of the work.

export const VerdictSchema = z.object({
  verdict: z
    .enum(["scam", "suspicious", "safe"])
    .describe("Overall judgement. Use 'suspicious' when manipulative but not conclusive."),

  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe("How certain you are, 0-100. Be honest; do not default to 90."),

  tactics: z
    .array(
      z.object({
        name: z
          .string()
          .describe("Short label, e.g. 'False urgency', 'Authority impersonation'."),
        quote: z
          .string()
          .describe(
            "The EXACT substring from the message that shows this tactic, copied verbatim. Must appear character-for-character in the original, so the UI can highlight it.",
          ),
        why: z.string().describe("One sentence: why this phrase is manipulative."),
      }),
    )
    .describe("Every manipulation tactic found. Empty array if the message is clean."),

  summary: z
    .string()
    .describe("One sentence a non-expert can act on. No hedging, no preamble."),
});

export type Verdict = z.infer<typeof VerdictSchema>;
