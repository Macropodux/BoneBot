import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

// The LLM is NOT in this app. This route calls a remote model API with a
// server-side key and streams the tokens back. See AGENTS.md.
//
// Provider swap (Anthropic -> OpenAI on the day, if event credits arrive) is
// the `model:` line plus an env var. Everything else stays.

export const maxDuration = 30;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    // A judge clicking a dead demo should see a sentence, not a stack trace.
    return new Response("Demo unavailable: no API key configured.", {
      status: 503,
    });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic("claude-opus-4-8"),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
