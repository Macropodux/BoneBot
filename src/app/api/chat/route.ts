import { openai } from "@ai-sdk/openai";
import { generateText, generateObject } from "ai";
import { z } from "zod";

// DIAGNOSTIC route — verifies the OpenAI integration works, in both the plain
// text (generateText) and structured output (generateObject) paths. Unlike
// the product routes, this surfaces the REAL error instead of hiding it
// behind a generic "unavailable" fallback. Delete once the team has confirmed
// the integration works; not for production use.

export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export async function POST(req: Request) {
  const { message, mode = "text" }: { message: string; mode?: "text" | "object" } = await req.json();

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { ok: false, model: MODEL, error: "OPENAI_API_KEY is not set" },
      { status: 200 }
    );
  }

  try {
    if (mode === "object") {
      const { object } = await generateObject({
        model: openai(MODEL),
        schema: z.object({ reply: z.string() }),
        prompt: message,
      });
      return Response.json({ ok: true, model: MODEL, mode: "object", result: object });
    }

    const { text } = await generateText({
      model: openai(MODEL),
      prompt: message,
    });
    return Response.json({ ok: true, model: MODEL, mode: "text", result: text });
  } catch (e) {
    return Response.json(
      { ok: false, model: MODEL, error: e instanceof Error ? e.message : String(e) },
      { status: 200 }
    );
  }
}
