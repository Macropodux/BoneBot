// Emails a copy of the screening result to the address she types in. A
// plain REST call to Resend — no SDK dependency, same pattern as /api/tts.
// The email body is built client-side (same content already shown on
// screen, nothing new is computed or disclosed here) and passed through
// as-is; this route's job is only the send.
//
// Degrades gracefully: no key -> 503 sentence, never a stack trace (see AGENTS.md).

export const maxDuration = 15;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return new Response("Emailing results is unavailable: no Resend key configured.", { status: 503 });
  }

  let body: { to?: string; subject?: string; text?: string; html?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Please send a valid request.", { status: 400 });
  }

  const to = body.to?.trim();
  if (!to || !EMAIL_RE.test(to)) {
    return new Response("That doesn't look like a valid email address.", { status: 400 });
  }
  if (!body.subject || !body.text) {
    return new Response("No result to send.", { status: 400 });
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        // Resend's shared test sender — works with no domain setup, can
        // send to any address. Swap for a verified domain sender later.
        from: "BoneBot <onboarding@resend.dev>",
        to: [to],
        subject: body.subject,
        text: body.text,
        // html is optional — the client always sends both; text is the
        // fallback for clients that don't render HTML.
        ...(body.html ? { html: body.html } : {}),
      }),
    });

    if (!r.ok) {
      console.error("resend send failed:", r.status, await r.text().catch(() => ""));
      return new Response("Couldn't send that email right now.", { status: 502 });
    }

    return Response.json({ sent: true });
  } catch (e) {
    console.error("resend send error:", e);
    return new Response("Couldn't send that email right now.", { status: 502 });
  }
}
