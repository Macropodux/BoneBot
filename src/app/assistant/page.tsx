"use client";

// BoneBot — voice bone-health assistant.
// Flow: click "Talk to BoneBot" -> BoneBot asks its 7 history questions ONE AT
// A TIME (scripted, not open-ended — SCREEN.md: "each question is targeted,
// it doesn't wander into open chat") -> scoreBone() runs HERE (deterministic,
// the model) -> BoneBot explains it -> ElevenLabs speaks it -> she can keep
// asking follow-ups in the same chat. The number is never the LLM's; the LLM
// only explains. Voice input uses the browser's Web Speech API (no
// dependency); voice output uses /api/tts (ElevenLabs), falling back to the
// browser voice if the key is absent.
//
// The 6 fields SCREEN.md marks "photo-extracted" (vitaminD, calcium,
// weightBearingActivity, glucocorticoids, rheumatoidArthritis, highAlcohol)
// aren't asked conversationally yet — photo upload (/api/vision) isn't built.
// They use DEFAULTS below until that lands.

import { useState } from "react";
import { scoreBone, type BoneFeatures, type ModelOutput } from "@/lib/bone-model";

const BAND = {
  elevated: { dot: "bg-red-500", label: "Osteoporosis range is plausible" },
  uncertain: { dot: "bg-amber-500", label: "Uncertain — a scan is the way to be sure" },
  lower: { dot: "bg-emerald-500", label: "Reassuring for now" },
} as const;

// Fields not yet gathered conversationally — SCREEN.md's "photo-extracted"
// column. Sensible illustrative defaults until /api/vision exists.
const DEFAULTS = {
  weightBearingActivity: 0.2,
  glucocorticoids: false,
  rheumatoidArthritis: false,
  highAlcohol: false,
  vitaminD: 45,
  calcium: 2.4,
} as const;

type AskedKey =
  | "age"
  | "yearsSinceMenopause"
  | "bmi"
  | "priorFragilityFracture"
  | "onHormoneTherapy"
  | "currentSmoker"
  | "parentalHipFracture";

type Question = {
  key: AskedKey;
  prompt: string;
  type: "number" | "boolean";
  clarify: string;
};

const QUESTIONS: Question[] = [
  {
    key: "age",
    prompt: "Hi, I'm BoneBot. First — how old are you?",
    type: "number",
    clarify: "Sorry, I didn't catch a number there — how old are you?",
  },
  {
    key: "yearsSinceMenopause",
    prompt: "How many years has it been since your periods stopped for good, if you know?",
    type: "number",
    clarify: "I need a number of years — roughly how long since menopause?",
  },
  {
    key: "bmi",
    prompt: "What's your BMI, if you know it? A typical healthy range is about 18 to 25.",
    type: "number",
    clarify: "I need a number for BMI — what's your BMI?",
  },
  {
    key: "priorFragilityFracture",
    prompt: "Have you broken a bone from a minor fall or knock since age 50?",
    type: "boolean",
    clarify: "Just a yes or no — have you broken a bone from a minor fall since 50?",
  },
  {
    key: "onHormoneTherapy",
    prompt: "Are you currently on hormone replacement therapy?",
    type: "boolean",
    clarify: "Yes or no — are you on hormone replacement therapy?",
  },
  {
    key: "currentSmoker",
    prompt: "Do you currently smoke?",
    type: "boolean",
    clarify: "Yes or no — do you currently smoke?",
  },
  {
    key: "parentalHipFracture",
    prompt: "Last one — did either of your parents break a hip in their lifetime?",
    type: "boolean",
    clarify: "Yes or no — did a parent break a hip?",
  },
];

function parseNumber(text: string): number | null {
  const m = text.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function parseYesNo(text: string): boolean | null {
  const t = text.trim().toLowerCase();
  if (/\b(yes|yeah|yep|yup|correct|true)\b/.test(t)) return true;
  if (/\b(no|nope|not|false)\b/.test(t)) return false;
  return null;
}

type ChatMessage = { role: "bot" | "user"; text: string };

export default function BoneBot() {
  const [phase, setPhase] = useState<"intro" | "gathering" | "result">("intro");
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [collected, setCollected] = useState<Partial<Record<AskedKey, number | boolean>>>({});
  const [features, setFeatures] = useState<BoneFeatures | null>(null);
  const [result, setResult] = useState<ModelOutput | null>(null);
  const [say, setSay] = useState("");
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);

  async function speak(text: string) {
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (r.ok) {
        const buf = await r.arrayBuffer();
        const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
        new Audio(url).play().catch(() => {});
        return;
      }
    } catch {
      /* fall through to browser voice */
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }

  function say_(role: "bot" | "user", text: string) {
    setTranscript((t) => [...t, { role, text }]);
  }

  function startChat() {
    setPhase("gathering");
    setTranscript([]);
    setQIndex(0);
    setCollected({});
    say_("bot", QUESTIONS[0].prompt);
    speak(QUESTIONS[0].prompt);
  }

  async function finishGathering(all: Record<AskedKey, number | boolean>) {
    const full: BoneFeatures = { ...DEFAULTS, ...all } as BoneFeatures;
    setFeatures(full);
    setBusy(true);
    const model = scoreBone(full);
    setResult(model);
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "consumer", result: model, features: full }),
      });
      const text = r.ok ? (await r.json()).text : "BoneBot is unavailable right now — check the result above.";
      setSay(text);
      say_("bot", text);
      speak(text);
    } finally {
      setBusy(false);
      setPhase("result");
    }
  }

  function submitAnswer(raw: string) {
    if (!raw.trim() || busy) return;
    say_("user", raw);

    const q = QUESTIONS[qIndex];
    const value = q.type === "number" ? parseNumber(raw) : parseYesNo(raw);

    if (value === null) {
      say_("bot", q.clarify);
      speak(q.clarify);
      return;
    }

    const next = { ...collected, [q.key]: value };
    setCollected(next);

    const nextIndex = qIndex + 1;
    if (nextIndex < QUESTIONS.length) {
      setQIndex(nextIndex);
      say_("bot", QUESTIONS[nextIndex].prompt);
      speak(QUESTIONS[nextIndex].prompt);
    } else {
      finishGathering(next as Record<AskedKey, number | boolean>);
    }
  }

  async function askFollowUp(q: string) {
    if (!q.trim() || !result || !features || busy) return;
    say_("user", q);
    setBusy(true);
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "consumer", result, features, question: q }),
      });
      const text = r.ok ? (await r.json()).text : "BoneBot is unavailable right now.";
      setSay(text);
      say_("bot", text);
      speak(text);
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (phase === "gathering") submitAnswer(text);
    else if (phase === "result") askFollowUp(text);
  }

  function listen() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Voice input needs Chrome or Safari.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-GB";
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const said = e.results[0][0].transcript as string;
      if (phase === "gathering") submitAnswer(said);
      else if (phase === "result") askFollowUp(said);
    };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  const band = result ? BAND[result.category] : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">BoneBot · voice bone-health assistant</p>
        <h1 className="text-3xl font-semibold tracking-tight">Talk to BoneBot</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          An estimated bone-density score from data you already have — spoken back to you. Not a diagnosis.
        </p>
      </header>

      {phase === "intro" && (
        <button
          onClick={startChat}
          className="self-start rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Talk to BoneBot
        </button>
      )}

      {phase !== "intro" && (
        <>
          <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            {transcript.map((m, i) => (
              <p
                key={i}
                className={
                  m.role === "bot"
                    ? "whitespace-pre-wrap text-zinc-900 dark:text-zinc-100"
                    : "self-end whitespace-pre-wrap text-right text-zinc-500"
                }
              >
                {m.role === "bot" ? "🦴 " : "you: "}
                {m.text}
              </p>
            ))}
            {busy && <p className="text-sm text-zinc-500">BoneBot is thinking…</p>}
          </section>

          {result && band && (
            <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
              {!result.validated && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ Illustrative — coefficients not yet trained on NHANES. Do not present these numbers as real.
                </p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${band.dot}`} />
                  <span className="text-lg font-semibold">{band.label}</span>
                </div>
                <span className="font-mono text-sm text-zinc-500">
                  est. T-score {result.estimatedTScore} ({result.tScoreRange[0]} … {result.tScoreRange[1]})
                </span>
              </div>
              <p className="border-t border-zinc-200 pt-3 text-xs text-zinc-400 dark:border-zinc-800">
                An estimate, not a diagnosis. A DXA bone-density scan gives the real T-score.
              </p>
            </section>
          )}

          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={phase === "gathering" ? "Type your answer…" : "Ask a follow-up…"}
              aria-label="Answer BoneBot"
              disabled={busy}
              className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-zinc-500 disabled:opacity-40 dark:border-zinc-700"
            />
            <button onClick={submit} disabled={busy || !input.trim()} className="rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900">
              Send
            </button>
            <button onClick={listen} disabled={busy} className={`rounded-lg px-4 py-2 ${listening ? "bg-red-500 text-white" : "border border-zinc-300 dark:border-zinc-700"}`}>
              {listening ? "● Listening" : "🎤 Speak"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
