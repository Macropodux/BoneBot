"use client";

import { useState } from "react";
import type { EvidenceSource } from "@/lib/bone-evidence";
import type { ModelOutput } from "@/lib/bone-model";
import type { Report } from "@/lib/bone-schema";
import type { IntakeAnswers, IntakeResponse } from "@/lib/intake-schema";

type ScreeningResult = { model: ModelOutput; report: Report | null; evidence: EvidenceSource[] };

const INITIAL_STEP: IntakeResponse = {
  state: "triage",
  message: "I’ll start with four short questions to choose the right next step.",
  question: {
    id: "assignedFemaleAtBirth",
    text: "Were you assigned female at birth?",
    input: "choice",
    options: [
      { label: "Yes", value: true },
      { label: "No", value: false },
    ],
  },
  features: null,
  missingRequired: [],
  notes: [],
  dxaAssessment: null,
  triage: null,
};

const CATEGORY = {
  elevated: { dot: "bg-red-500", label: "Osteoporosis range is plausible" },
  uncertain: { dot: "bg-amber-500", label: "Uncertain — a scan is the way to be sure" },
  lower: { dot: "bg-emerald-500", label: "Reassuring for now" },
} as const;

const LOW_RISK_FALLBACK =
  "Your initial screening estimate is below BoneBot’s threshold for the full questionnaire. Keep supporting bone health with regular weight-bearing and resistance activity if it is safe for you, avoiding smoking, and limiting alcohol. This is not a diagnosis or a measurement of bone density; speak with a clinician if your health changes, you have a fracture from a minor fall, or you are concerned.";

export default function Screen() {
  const [answers, setAnswers] = useState<Partial<IntakeAnswers>>({});
  const [step, setStep] = useState<IntakeResponse>(INITIAL_STEP);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [triageExplanation, setTriageExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function advance(nextAnswers: Partial<IntakeAnswers>) {
    setBusy(true);
    setError("");
    setDraft("");
    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: nextAnswers }),
      });
      const next = (await response.json()) as IntakeResponse | { error: string };
      if (!response.ok || "error" in next) throw new Error("error" in next ? next.error : "Could not continue the screening.");

      setAnswers(nextAnswers);
      setStep(next);
      if (next.state === "low-risk" && next.triage) await explainTriage(next);
      if (next.state === "ready" && next.features) await scoreFullAssessment(next.features);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not continue the screening.");
    } finally {
      setBusy(false);
    }
  }

  async function explainTriage(next: IntakeResponse) {
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "consumer", triage: next.triage }),
      });
      const body = (await response.json()) as { text?: string };
      setTriageExplanation(response.ok && body.text ? body.text : LOW_RISK_FALLBACK);
    } catch {
      setTriageExplanation(LOW_RISK_FALLBACK);
    }
  }

  async function scoreFullAssessment(features: NonNullable<IntakeResponse["features"]>) {
    const response = await fetch("/api/screen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(features),
    });
    if (!response.ok) throw new Error("Could not create the screening result.");
    setResult((await response.json()) as ScreeningResult);
  }

  function submitValue(value: IntakeAnswers[keyof IntakeAnswers]) {
    if (!step.question) return;
    void advance({ ...answers, [step.question.id]: value });
  }

  function submitNumber() {
    const value = Number(draft);
    if (!Number.isFinite(value)) {
      setError("Please enter a number so BoneBot can continue.");
      return;
    }
    submitValue(value);
  }

  function startOver() {
    setAnswers({});
    setStep(INITIAL_STEP);
    setDraft("");
    setResult(null);
    setTriageExplanation("");
    setError("");
  }

  const question = step.question;
  const category = result ? CATEGORY[result.model.category] : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">BoneBot · bone-health screening</p>
        <h1 className="text-3xl font-semibold tracking-tight">Should you ask for a bone scan?</h1>
        <p className="text-zinc-600 dark:text-zinc-400">A screening estimate from your health profile — never a diagnosis.</p>
      </header>

      {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}

      {question && !result && step.state !== "low-risk" && (
        <section className="flex flex-col gap-5 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <div>
            <p className="text-sm text-zinc-500">{step.state === "triage" ? "Initial screen" : "Full assessment"}</p>
            <h2 className="mt-1 text-xl font-semibold">{question.text}</h2>
            {question.hint && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{question.hint}</p>}
          </div>

          {question.input === "choice" && question.options ? (
            <div className="flex flex-wrap gap-3">
              {question.options.map((option) => (
                <button
                  key={String(option.value)}
                  disabled={busy}
                  onClick={() => submitValue(option.value)}
                  className="rounded-lg border border-zinc-300 px-5 py-2.5 font-medium hover:border-zinc-500 disabled:opacity-40 dark:border-zinc-700"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <input
                autoFocus
                type="number"
                step={question.id === "dxaTScore" ? "0.1" : "1"}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && submitNumber()}
                className="w-40 rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 outline-none focus:border-zinc-500 dark:border-zinc-700"
              />
              <button disabled={busy || !draft.trim()} onClick={submitNumber} className="rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900">
                Continue
              </button>
              {question.canSkip && (
                <button disabled={busy} onClick={() => void advance({ ...answers, dxaYearKnown: false })} className="rounded-lg px-4 py-2.5 text-sm text-zinc-600 underline disabled:opacity-40 dark:text-zinc-400">
                  Skip this
                </button>
              )}
            </div>
          )}
          {busy && <p className="text-sm text-zinc-500">BoneBot is checking the next step…</p>}
        </section>
      )}

      {step.state === "not-eligible" && <Outcome title="This screen is not calibrated for you" body={step.message} onRestart={startOver} />}

      {step.state === "existing-care" && !question && <Outcome title="Use your existing care plan" body={step.message} onRestart={startOver} />}

      {step.state === "dxa-result" && step.dxaAssessment && (
        <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="font-mono text-sm text-zinc-500">Reported DXA T-score</p>
          <h2 className="text-2xl font-semibold">{step.dxaAssessment.tScore.toFixed(1)} · {step.dxaAssessment.label}</h2>
          <p>{step.dxaAssessment.summary}</p>
          <p className="rounded-lg bg-zinc-100 p-4 text-sm dark:bg-zinc-900">{step.dxaAssessment.recommendation}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{step.dxaAssessment.scanTiming}</p>
          <Restart onClick={startOver} />
        </section>
      )}

      {step.state === "low-risk" && step.triage && (
        <section className="flex flex-col gap-5 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5">
          <div>
            <p className="font-mono text-sm uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Initial screening estimate</p>
            <p className="mt-2 text-5xl font-semibold tracking-tight">{step.triage.probabilityPercent}%</p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Below BoneBot’s {step.triage.thresholdPercent}% threshold for the full assessment.</p>
          </div>
          {!step.triage.validated && <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">Illustrative triage coefficients — not yet validated on NHANES. This is not a diagnosis or a measured bone-density result.</p>}
          <p className="whitespace-pre-wrap">{triageExplanation || LOW_RISK_FALLBACK}</p>
          <p className="text-xs text-zinc-500">If you have a fracture from a minor fall, a new risk factor, or any concern, speak with a clinician.</p>
          <Restart onClick={startOver} />
        </section>
      )}

      {result && category && (
        <section className="flex flex-col gap-5 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          {!result.model.validated && <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">Illustrative — coefficients not yet trained on NHANES. Do not present these numbers as real.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5"><span className={`h-2.5 w-2.5 rounded-full ${category.dot}`} /><span className="text-lg font-semibold">{category.label}</span></div>
            <span className="font-mono text-sm text-zinc-500">est. T-score {result.model.estimatedTScore} ({result.model.tScoreRange[0]} … {result.model.tScoreRange[1]})</span>
          </div>
          {result.report ? (
            <>
              <p>{result.report.summary}</p>
              <ul className="flex flex-col gap-3">{result.report.factorExplanations.map((item, index) => <li key={`${item.factor}-${index}`} className="border-l-2 border-zinc-300 pl-4 dark:border-zinc-700"><p className="font-medium">{item.factor}</p><p className="text-sm text-zinc-600 dark:text-zinc-400">{item.plain}</p></li>)}</ul>
              <div className="rounded-lg bg-emerald-500/5 p-4 text-sm"><p className="font-medium text-emerald-700 dark:text-emerald-300">What you can change</p><p className="mt-1">{result.report.modifiableGuidance}</p></div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{result.report.recommendation}</p>
            </>
          ) : <p className="text-sm text-zinc-500">Your deterministic screening result is shown above. The plain-language explanation is temporarily unavailable.</p>}
          <p className="border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">This is a screening tool, not a diagnosis. A DXA scan and your clinician confirm bone health.</p>
          <Restart onClick={startOver} />
        </section>
      )}
    </main>
  );
}

function Outcome({ title, body, onRestart }: { title: string; body: string; onRestart: () => void }) {
  return <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"><h2 className="text-xl font-semibold">{title}</h2><p>{body}</p><Restart onClick={onRestart} /></section>;
}

function Restart({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="self-start rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700">Start again</button>;
}
