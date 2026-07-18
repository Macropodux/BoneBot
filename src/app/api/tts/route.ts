// ElevenLabs text-to-speech. Takes text, returns spoken audio (audio/mpeg).
//
// No SDK dependency — a plain REST call with the server-side key. If the key is
// missing or ElevenLabs errors, we return a non-200 and the client falls back to
// the browser's built-in speech synthesis. A judge must never hit a stack trace.
//
// 🔑 ELEVENLABS_API_KEY is server-side only (never NEXT_PUBLIC_). Set it in Vercel
//    and .env.local. Voice defaults to a public ElevenLabs voice; override with
//    ELEVENLABS_VOICE_ID.

export const maxDuration = 30;

const VOICE = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM"; // "Rachel"

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return new Response("TTS unavailable: no ElevenLabs key configured.", { status: 503 });
  }

  const { text }: { text?: string } = await req.json();
  if (!text || !text.trim()) {
    return new Response("No text to speak.", { status: 400 });
  }

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.4, similarity_boost: 0.75 },
      }),
    });

    if (!r.ok) {
      console.error("elevenlabs tts failed:", r.status, await r.text().catch(() => ""));
      return new Response("TTS failed upstream.", { status: 502 });
    }

    const audio = await r.arrayBuffer();
    return new Response(audio, {
      headers: { "content-type": "audio/mpeg", "cache-control": "no-store" },
    });
  } catch (e) {
    console.error("elevenlabs tts error:", e);
    return new Response("TTS error.", { status: 502 });
  }
}
