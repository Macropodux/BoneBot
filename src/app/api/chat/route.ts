import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

// The LLM is NOT in this app. This route calls a remote model API with a
// server-side key and streams the tokens back. See AGENTS.md.
//
// Provider swap (Anthropic -> OpenAI on the day, if event credits arrive) is
// the `model:` line plus an env var. Everything else stays.

export const maxDuration = 30;

// Model is an env var so it can change without a deploy-shaped code edit.
// Default is deliberately a capable model — forgetting to set this should fail
// toward a good demo, not a weak one.
//
// claude-haiku-4-5  $1/$5 per Mtok   — cheapest; fine for testing the plumbing
// claude-sonnet-5   $2/$10 (intro)   — default; near-Opus on coding/agentic
// claude-opus-4-8   $5/$25           — hardest reasoning
//
// Judges click the live URL for a week (19–25 Jul) on our credits, so this
// also decides how long the money lasts.
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    // A judge clicking a dead demo should see a sentence, not a stack trace.
    return new Response("Demo unavailable: no API key configured.", {
      status: 503,
    });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic(MODEL),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
