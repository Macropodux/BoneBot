"use client";

// BoneBot — voice bone-health assistant.
// Flow: profile in (type or speak) -> scoreBone() runs HERE (deterministic, the
// model) -> BoneBot explains it in the chosen mode -> ElevenLabs speaks it.
// The number is never the LLM's; the LLM only explains. Voice input uses the
// browser's Web Speech API (no dependency); voice output uses /api/tts
// (ElevenLabs), falling back to the browser voice if the key is absent.

import { useState } from "react";
import { scoreBone, type BoneFeatures, type ModelOutput } from "@/lib/bone-model";

const BAND = {
  elevated: { dot: "bg-red-500", label: "Osteoporosis range is plausible" },
  uncertain: { dot: "bg-amber-500", label: "Uncertain — a scan is the way to be sure" },
  lower: { dot: "bg-emerald-500", label: "Reassuring for now" },
} as const;

const EXAMPLE: BoneFeatures = {
  age: 58,
  yearsSinceMenopause: 6,
  onHormoneTherapy: false,
  priorFragilityFracture: true,
  bmi: 22,
  weightBearingActivity: 0.2,
  currentSmoker: false,
  parentalHipFracture: true,
};

export default function BoneBot() {
  const [f, setF] = useState<BoneFeatures>(EXAMPLE);
  const [result, setResult] = useState<ModelOutput | null>(null);
  const [say, setSay] = useState("");
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [listening, setListening] = useState(false);

  const num = (k: keyof BoneFeatures) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: Number(e.target.value) });
  const bool = (k: keyof BoneFeatures) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.checked });

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

  async function ask(q?: string) {
    setBusy(true);
    const model = scoreBone(f);
    setResult(model);
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "consumer", result: model, features: f, question: q }),
      });
      const text = r.ok ? (await r.json()).text : "BoneBot is unavailable right now — check the result above.";
      setSay(text);
      speak(text);
    } finally {
      setBusy(false);
    }
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
      setQuestion(said);
      ask(said);
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

      <section className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <label className="flex flex-col gap-1 text-sm">
          Age
          <input type="number" value={f.age} onChange={num("age")} className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Years since menopause
          <input type="number" value={f.yearsSinceMenopause} onChange={num("yearsSinceMenopause")} className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          BMI
          <input type="number" value={f.bmi} onChange={num("bmi")} className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Weight-bearing activity (0–1)
          <input type="number" step="0.1" min="0" max="1" value={f.weightBearingActivity} onChange={num("weightBearingActivity")} className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700" />
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.onHormoneTherapy} onChange={bool("onHormoneTherapy")} /> On hormone therapy
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.priorFragilityFracture} onChange={bool("priorFragilityFracture")} /> Prior fragility fracture
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.currentSmoker} onChange={bool("currentSmoker")} /> Current smoker
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.parentalHipFracture} onChange={bool("parentalHipFracture")} /> Parent had a hip fracture
        </label>
      </section>

      <button
        onClick={() => ask()}
        disabled={busy}
        className="self-start rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {busy ? "BoneBot is thinking…" : "Ask BoneBot"}
      </button>

      {result && band && (
        <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
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

          {say && <p className="whitespace-pre-wrap">{say}</p>}

          <div className="flex gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a follow-up…"
              aria-label="Ask BoneBot"
              className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-zinc-500 dark:border-zinc-700"
            />
            <button onClick={() => ask(question)} disabled={busy || !question.trim()} className="rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900">
              Send
            </button>
            <button onClick={listen} disabled={busy} className={`rounded-lg px-4 py-2 ${listening ? "bg-red-500 text-white" : "border border-zinc-300 dark:border-zinc-700"}`}>
              {listening ? "● Listening" : "🎤 Speak"}
            </button>
          </div>

          <p className="border-t border-zinc-200 pt-3 text-xs text-zinc-400 dark:border-zinc-800">
            An estimate, not a diagnosis. A DXA bone-density scan gives the real T-score.
          </p>
        </section>
      )}
    </div>
  );
}
