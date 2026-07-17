"use client";

// THE INTERFACE.
//
// Note what this is NOT: there is no chat log and no conversation. The user
// does exactly one thing — paste — and gets a designed answer back. Same model,
// same API. Completely different product.
//
// Worked example only. Delete on Saturday.

import { useState } from "react";
import type { Verdict } from "@/lib/scam-schema";

const STYLES = {
  scam: { dot: "bg-red-500", label: "Likely scam" },
  suspicious: { dot: "bg-amber-500", label: "Suspicious" },
  safe: { dot: "bg-emerald-500", label: "Looks legitimate" },
} as const;

const EXAMPLE =
  "URGENT: HMRC has detected an unpaid tax bill of £842.16 on your account. " +
  "Your case closes in 24 hours and bailiffs will be instructed. To stop this, " +
  "settle immediately using the payment link below. Do not discuss this case " +
  "with anyone as it is under active investigation.";

// The model returns quotes copied verbatim from the message, so we can find
// them and mark them. This is only possible because the schema guaranteed us a
// string that exists in the original — the payoff for constraining the output.
function highlight(text: string, quotes: string[]) {
  const found = quotes.filter((q) => q && text.includes(q));
  if (found.length === 0) return text;

  const pattern = found
    .sort((a, b) => b.length - a.length)
    .map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  return text.split(new RegExp(`(${pattern})`, "g")).map((part, i) =>
    found.includes(part) ? (
      <mark key={i} className="bg-amber-200 dark:bg-amber-500/30 dark:text-amber-100">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default function ScamCheck() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/scam", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const style = result ? STYLES[result.verdict] : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
          Worked example
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Is this a scam?</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Paste a message you weren&apos;t expecting. No account, no chat.
        </p>
      </header>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={6}
        aria-label="Message to check"
        placeholder="Paste the message here…"
        className="w-full resize-y rounded-xl border border-zinc-300 bg-transparent p-4 outline-none focus:border-zinc-500 dark:border-zinc-700"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={check}
          disabled={busy || !message.trim()}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Checking…" : "Check message"}
        </button>
        <button
          onClick={() => setMessage(EXAMPLE)}
          className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Use an example
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {result && style && (
        <section className="flex flex-col gap-5 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
              <span className="text-lg font-semibold">{style.label}</span>
            </div>
            <span className="font-mono text-sm text-zinc-500">
              {result.confidence}% confident
            </span>
          </div>

          <p>{result.summary}</p>

          {result.tactics.length > 0 && (
            <>
              <div className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm leading-relaxed dark:bg-zinc-900">
                {highlight(
                  message,
                  result.tactics.map((t) => t.quote),
                )}
              </div>

              <ul className="flex flex-col gap-3">
                {result.tactics.map((t, i) => (
                  <li key={i} className="border-l-2 border-amber-500 pl-4">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.why}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
