"use client";

// The product surface. Functional, not final — agents own the design pass.
// Proves the loop: profile + activity -> model -> LLM explanation -> report.

import { useState } from "react";
import type { ModelOutput } from "@/lib/bone-model";
import type { Report } from "@/lib/bone-schema";

type Result = { model: ModelOutput; report: Report | null };

const CATEGORY = {
  elevated: { dot: "bg-red-500", label: "Elevated screening risk" },
  uncertain: { dot: "bg-amber-500", label: "Uncertain — a scan is the way to be sure" },
  lower: { dot: "bg-emerald-500", label: "Lower screening risk" },
} as const;

// A realistic postmenopausal profile for the demo.
const EXAMPLE = {
  age: 58,
  yearsSinceMenopause: 6,
  onHormoneTherapy: false,
  priorFragilityFracture: true,
  bmi: 22,
  weightBearingActivity: 0.2,
  currentSmoker: false,
  parentalHipFracture: true,
};

export default function Screen() {
  const [f, setF] = useState(EXAMPLE);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const num = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: Number(e.target.value) });
  const bool = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.checked });

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/screen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(f),
      });
      setResult(await res.json());
    } finally {
      setBusy(false);
    }
  }

  const cat = result ? CATEGORY[result.model.category] : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
          Postmenopausal bone-health screening · demo
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Should you ask for a bone scan?</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          A screening flag from your health profile and your activity — not a diagnosis.
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
        onClick={run}
        disabled={busy}
        className="self-start rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {busy ? "Estimating…" : "Estimate my bone-density score"}
      </button>

      {result && cat && (
        <section className="flex flex-col gap-5 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          {!result.model.validated && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              ⚠️ Demo uses placeholder coefficients — not yet validated on NHANES. Do not present these numbers as real.
            </p>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${cat.dot}`} />
              <span className="text-lg font-semibold">{cat.label}</span>
            </div>
            <span className="font-mono text-sm text-zinc-500">
              est. T-score {result.model.estimatedTScore} ({result.model.tScoreRange[0]} … {result.model.tScoreRange[1]})
            </span>
          </div>

          {result.report ? (
            <>
              <p>{result.report.summary}</p>
              <ul className="flex flex-col gap-3">
                {result.report.factorExplanations.map((e, i) => (
                  <li key={i} className="border-l-2 border-zinc-300 pl-4 dark:border-zinc-700">
                    <p className="font-medium">{e.factor}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{e.plain}</p>
                  </li>
                ))}
              </ul>
              <div className="rounded-lg bg-emerald-500/5 p-4 text-sm">
                <p className="font-medium text-emerald-700 dark:text-emerald-400">What you can change</p>
                <p className="mt-1 text-zinc-700 dark:text-zinc-300">{result.report.modifiableGuidance}</p>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{result.report.recommendation}</p>
            </>
          ) : (
            <p className="text-sm text-zinc-500">
              Screening result shown above. (The plain-language explanation is temporarily unavailable.)
            </p>
          )}

          <p className="border-t border-zinc-200 pt-3 text-xs text-zinc-400 dark:border-zinc-800">
            This is a screening tool, not a diagnosis. A DXA bone-density scan and your clinician confirm bone health.
          </p>
        </section>
      )}
    </div>
  );
}
