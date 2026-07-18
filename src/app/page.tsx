"use client";

// BoneBot — landing -> chip-based chat screening -> results, in one page.
// Recreated from the design handoff (a Claude design
// prototype, not production code) per its README: translate inline styles to
// Tailwind, wire the chat to the real model (bone-model.ts) + Vercel AI SDK
// instead of the prototype's mocked scoring/answers.
//
// The model predicts (scoreBone(), deterministic, NHANES-trained); the LLM
// (via /api/assistant) only explains it — same architecture as before, now
// behind this UI. Screening flag, never a diagnosis.
//
// The design's 7 questions don't cover all 13 BoneFeatures fields (no photo
// upload yet, and a few history fields it never asks). Those use the same
// illustrative-defaults pattern as before; see mapAnswersToFeatures() below —
// flagged there for a clinical sanity-check, not a measurement.

import { useEffect, useRef, useState } from "react";
import { scoreBone, type BoneFeatures, type ModelOutput } from "@/lib/bone-model";
import { scoreTriage, type TriageOutput } from "@/lib/triage-model";
import { tScoreModel } from "../../model/model-parameters";

const ACCENT = "#0E7C6E";
const ACCENT_HOVER = "#0A5A50";
const ACCENT_TINT = "#E4F0ED";

type StepKey = "assignedFemale" | "age" | "menopauseStatus" | "existingCare" | "menopause" | "fracture" | "parent" | "smoke" | "steroids" | "weight";

type Step = { key: StepKey; q: string; options: string[] };

const STEPS: Step[] = [
  { key: "assignedFemale", q: "Were you assigned female at birth?", options: ["Yes", "No"] },
  { key: "age", q: "Let's start simple — how old are you?", options: ["Under 55", "55–64", "65–74", "75 or older"] },
  { key: "menopauseStatus", q: "Have your periods stopped for good?", options: ["Yes", "No", "Not sure"] },
  { key: "existingCare", q: "Have you already been diagnosed with osteoporosis, had a bone scan, or taken bone medication?", options: ["Yes", "No"] },
  { key: "menopause", q: "At what age did you reach menopause?", options: ["Before 40", "40–45", "After 45", "Not sure"] },
  { key: "fracture", q: "Have you broken a bone since age 50 — even from a minor fall or bump?", options: ["Yes", "No"] },
  { key: "parent", q: "Did either of your parents ever fracture a hip?", options: ["Yes", "No", "Not sure"] },
  { key: "smoke", q: "Do you currently smoke?", options: ["Yes", "No"] },
  { key: "steroids", q: "Have you ever taken corticosteroids (like prednisone) for 3 months or more?", options: ["Yes", "No", "Not sure"] },
  { key: "weight", q: "Last one — is your weight under 57 kg (about 125 lb)?", options: ["Yes", "No", "Not sure"] },
];

const EXAMPLE_ANSWERS: Record<StepKey, string> = {
  assignedFemale: "Yes",
  age: "65–74",
  menopauseStatus: "Yes",
  existingCare: "No",
  menopause: "40–45",
  fracture: "No",
  parent: "Yes",
  smoke: "No",
  steroids: "No",
  weight: "No",
};

// Fields the 7-question flow never asks about — photo upload (vitaminD,
// calcium, weightBearingActivity) isn't built yet, and hormone therapy /
// rheumatoid arthritis / alcohol aren't part of this flow. Same illustrative
// defaults used before. Not measurements.
const FIELD_DEFAULTS = {
  onHormoneTherapy: Boolean(tScoreModel.imputationDefaults.onHormoneTherapy),
  weightBearingActivity: tScoreModel.imputationDefaults.activityLevel,
  rheumatoidArthritis: Boolean(tScoreModel.imputationDefaults.rheumatoidArthritis),
  highAlcohol: Boolean(tScoreModel.imputationDefaults.highAlcohol),
  vitaminD: tScoreModel.imputationDefaults.vitaminD,
  calcium: tScoreModel.imputationDefaults.calcium,
} as const;

const AGE_MIDPOINT: Record<string, number> = { "Under 55": 50, "55–64": 60, "65–74": 70, "75 or older": 80 };
const MENOPAUSE_AGE_MIDPOINT: Record<string, number> = { "Before 40": 35, "40–45": 42, "After 45": 48, "Not sure": 48 };
const MENOPAUSE_STATUS = { Yes: "yes", No: "no", "Not sure": "not-sure" } as const;

const LOW_RISK_GUIDANCE = [
  "Keep active with weight-bearing and muscle-strengthening activity that feels safe and suitable for you.",
  "Avoid smoking. If you smoke, getting support to stop benefits your overall health as well as your bones.",
  "Keep high alcohol intake low. If your health changes or you have a fracture after a minor fall, speak with a clinician.",
] as const;

function mapAnswersToFeatures(answers: Record<StepKey, string>): BoneFeatures {
  const age = AGE_MIDPOINT[answers.age] ?? 65;
  const menopauseAge = MENOPAUSE_AGE_MIDPOINT[answers.menopause] ?? 48;
  return {
    age,
    yearsSinceMenopause: Math.max(0, age - menopauseAge),
    priorFragilityFracture: answers.fracture === "Yes",
    parentalHipFracture: answers.parent === "Yes",
    currentSmoker: answers.smoke === "Yes",
    glucocorticoids: answers.steroids === "Yes",
    // "Under 57kg" is a low-body-weight screening proxy, not a measured BMI —
    // a rough stand-in until BMI (or height+weight) is asked directly.
    bmi: answers.weight === "Yes" ? 20 : 26,
    ...FIELD_DEFAULTS,
  };
}

const CATEGORY_MAP = { lower: "low", uncertain: "moderate", elevated: "elevated" } as const;

const CAT_META = {
  low: {
    label: "Low risk",
    chip: "Keep it that way",
    color: "#0E7C6E",
    bg: "#E4F0ED",
    desc: "Your answers didn't flag major clinical risk factors. Bones still change after menopause — re-screen yearly and keep up weight-bearing exercise, calcium, and vitamin D.",
  },
  moderate: {
    label: "Moderate risk",
    chip: "Worth a conversation",
    color: "#A06D14",
    bg: "#FBF3DD",
    desc: "Some of your answers match established risk factors for low bone density. This doesn't mean you have osteoporosis — it means a DEXA scan is worth discussing with your GP.",
  },
  elevated: {
    label: "Elevated risk",
    chip: "Ask your GP about a DEXA scan",
    color: "#B0442F",
    bg: "#F9E7E2",
    desc: "Several of your answers match strong clinical risk factors. A screening flag is not a diagnosis — but this profile is exactly what DEXA referral guidelines are designed to catch. Please raise it with your GP.",
  },
} as const;

const TABS = [
  { id: "category", label: "Category" },
  { id: "meter", label: "Score meter" },
  { id: "combined", label: "Combined" },
] as const;
type Tab = (typeof TABS)[number]["id"];

// Meter axis: equal thirds over a clinically-anchored T-score range, so the
// three zones line up with the real bands (normal >= -1.0, osteopenia
// -1.0..-2.5, osteoporosis <= -2.5) instead of an arbitrary split.
const AXIS_MIN = -4.0;
const AXIS_MAX = 0.5;
function markerPercent(tScore: number): number {
  const clamped = Math.max(AXIS_MIN, Math.min(AXIS_MAX, tScore));
  const normalized = (clamped - AXIS_MIN) / (AXIS_MAX - AXIS_MIN); // 0..1, higher tScore = better
  return Math.round((1 - normalized) * 100); // reversed: better (higher) -> left/"Low"
}

type ChatMessage = { role: "bot" | "user"; text: string };

function BotBubble({ text, small }: { text: string; small?: boolean }) {
  return (
    <div className="flex justify-start">
      <div
        className={`max-w-[78%] whitespace-pre-wrap ${small ? "text-sm" : "text-base"} leading-[1.55] ${
          small ? "rounded-[14px_14px_14px_4px] bg-[#F5F7F6] px-[15px] py-[11px]" : "rounded-[16px_16px_16px_4px] border border-[#E3E9E7] bg-white px-[18px] py-3"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function UserBubble({ text, small }: { text: string; small?: boolean }) {
  return (
    <div className="flex justify-end">
      <div
        className={`max-w-[78%] whitespace-pre-wrap text-white ${small ? "text-sm" : "text-base"} leading-[1.55] ${
          small ? "rounded-[14px_14px_4px_14px] px-[15px] py-[11px]" : "rounded-[16px_16px_4px_16px] px-[18px] py-3"
        }`}
        style={{ backgroundColor: ACCENT }}
      >
        {text}
      </div>
    </div>
  );
}

function TypingDots({ small }: { small?: boolean }) {
  const dot = small ? "h-1.5 w-1.5" : "h-[7px] w-[7px]";
  return (
    <div className="flex justify-start">
      <div
        className={`flex ${small ? "gap-1 rounded-[14px_14px_14px_4px] bg-[#F5F7F6] px-[15px] py-[11px]" : "gap-[5px] rounded-[16px_16px_16px_4px] border border-[#E3E9E7] bg-white px-[18px] py-3.5"}`}
      >
        {[0, 0.2, 0.4].map((delay) => (
          <span
            key={delay}
            className={`${dot} animate-[bw-blink_1.2s_infinite] rounded-full`}
            style={{ backgroundColor: ACCENT, animationDelay: `${delay}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<"landing" | "chat" | "results">("landing");
  const [stepIdx, setStepIdx] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [answers, setAnswers] = useState<Partial<Record<StepKey, string>>>({});
  const [tab, setTab] = useState<Tab>("combined");

  const [features, setFeatures] = useState<BoneFeatures | null>(null);
  const [result, setResult] = useState<ModelOutput | null>(null);
  const [triageResult, setTriageResult] = useState<TriageOutput | null>(null);
  const [routeMessage, setRouteMessage] = useState("");

  const [qaMessages, setQaMessages] = useState<ChatMessage[]>([]);
  const [qaTyping, setQaTyping] = useState(false);
  const [qaInput, setQaInput] = useState("");

  const chatRef = useRef<HTMLDivElement>(null);
  const qaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, typing]);
  useEffect(() => {
    if (qaRef.current) qaRef.current.scrollTop = qaRef.current.scrollHeight;
  }, [qaMessages, qaTyping]);

  function botSay(text: string, delay = 650) {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { role: "bot", text }]);
    }, delay);
  }

  function start() {
    setScreen("chat");
    setStepIdx(0);
    setMessages([]);
    setAnswers({});
    botSay(
      "Hi, I'm BoneBot. I'll ask you 7 quick questions, then a model trained on NHANES data estimates your bone-health risk. I only explain the result — I never decide it."
    );
    window.setTimeout(() => botSay(STEPS[0].q), 1400);
  }

  async function runModel(all: Record<StepKey, string>) {
    const full = mapAnswersToFeatures(all);
    setFeatures(full);
    const model = scoreBone(full);
    setResult(model);

    let explanation = `Your screening result is ${CATEGORY_MAP[model.category]} risk. Ask me anything about what that means.`;
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "consumer", result: model, features: full }),
      });
      if (r.ok) explanation = (await r.json()).text;
    } catch {
      /* fall back to the plain sentence above — never a stack trace */
    }
    setQaMessages([{ role: "bot", text: explanation }]);
    setScreen("results");
  }

  async function finishAtGate(message: string, triageResultValue?: TriageOutput) {
    setRouteMessage(
      triageResultValue
        ? "This is a very low initial screening estimate. You do not need the longer questionnaire today."
        : message,
    );
    setTriageResult(triageResultValue ?? null);
    setResult(null);
    if (triageResultValue) {
      setQaMessages([]);
      setScreen("results");
      return;
    }
    const explanation = message;
    setQaMessages([{ role: "bot", text: explanation }]);
    setScreen("results");
  }

  function answer(opt: string) {
    if (typing) return;
    const step = STEPS[stepIdx];
    const nextAnswers = { ...answers, [step.key]: opt };
    setMessages((m) => [...m, { role: "user", text: opt }]);
    setAnswers(nextAnswers);

    if (stepIdx === 3) {
      if (nextAnswers.assignedFemale !== "Yes") {
        void finishAtGate("BoneBot is currently calibrated for people assigned female at birth. A clinician can help you find the right bone-health assessment.");
        return;
      }
      if (nextAnswers.existingCare === "Yes") {
        void finishAtGate("Because you may already have a scan result, diagnosis, or treatment plan, BoneBot will not replace it with an estimate. Please ask your GP or scan provider for your most recent DXA report and recommended follow-up.");
        return;
      }
      const triage = scoreTriage({
        age: AGE_MIDPOINT[nextAnswers.age ?? ""] ?? 65,
        menopauseStatus:
          nextAnswers.menopauseStatus === "Yes"
            ? MENOPAUSE_STATUS.Yes
            : nextAnswers.menopauseStatus === "No"
              ? MENOPAUSE_STATUS.No
              : MENOPAUSE_STATUS["Not sure"],
      });
      if (!triage.proceedToFullAssessment) {
        void finishAtGate(`Your initial screening estimate is ${triage.probabilityPercent}%, below BoneBot’s ${triage.thresholdPercent}% threshold for the full assessment.`, triage);
        return;
      }
      botSay("Your initial screening estimate is above our threshold, so I’ll ask a few more questions to create your full bone-health screening result.");
    }

    const nextIdx = stepIdx + 1;
    setStepIdx(nextIdx);
    if (nextIdx < STEPS.length) {
      botSay(STEPS[nextIdx].q);
    } else {
      botSay("That's everything. Running your answers through the risk model…");
      runModel(nextAnswers as Record<StepKey, string>);
    }
  }

  function tryExample() {
    runModel(EXAMPLE_ANSWERS);
  }

  function restart() {
    setScreen("landing");
    setMessages([]);
    setQaMessages([]);
    setAnswers({});
    setStepIdx(0);
    setResult(null);
    setFeatures(null);
    setTriageResult(null);
    setRouteMessage("");
  }

  async function qaAsk(q: string) {
    if (qaTyping || !result || !features) return;
    setQaMessages((m) => [...m, { role: "user", text: q }]);
    setQaInput("");
    setQaTyping(true);
    let text = "BoneBot is unavailable right now.";
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "consumer", result, features, question: q }),
      });
      if (r.ok) text = (await r.json()).text;
    } catch {
      /* graceful fallback */
    }
    setQaTyping(false);
    setQaMessages((m) => [...m, { role: "bot", text }]);
  }

  const step = STEPS[stepIdx];
  const inFlow = screen === "chat" && step && !typing && messages.length > 1;
  const progressPct = Math.round((stepIdx / STEPS.length) * 100);
  const progressLabel = stepIdx < STEPS.length ? `Question ${Math.min(stepIdx + 1, STEPS.length)} of ${STEPS.length}` : "Analyzing…";

  const cat = result ? CATEGORY_MAP[result.category] : "low";
  const catMeta = CAT_META[cat];
  const marker = result ? markerPercent(result.estimatedTScore) : 50;

  return (
    <div
      className="flex min-h-screen flex-col bg-[#F5F7F6] text-[#15181A] font-[family-name:var(--font-body)]"
      style={{ ["--bw-accent" as string]: ACCENT }}
    >
      <style>{`@keyframes bw-blink { 0%,80%,100% { opacity: .25; } 40% { opacity: 1; } }`}</style>

      {screen === "landing" && (
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between px-6 py-5 sm:px-12">
            <div className="font-[family-name:var(--font-heading)] text-[22px] font-bold tracking-[-0.02em]">
              Bone<span style={{ color: ACCENT }}>Bot</span>
            </div>
            <div className="rounded-full border border-[#D5DCDA] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#5A6462]">
              Hack-Nation · Challenge 05
            </div>
          </header>
          <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-12 text-center">
            <div className="mb-5 text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: ACCENT }}>
              Bone-health screening for postmenopausal women
            </div>
            <h1 className="max-w-[820px] text-balance font-[family-name:var(--font-heading)] text-5xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
              Know your bone risk before it breaks something.
            </h1>
            <p className="mt-6 max-w-[620px] text-pretty text-lg leading-[1.6] text-[#4A5452] sm:text-[19px]">
              A 3-minute conversational screening. The risk model is trained on NHANES population data — the AI
              explains your result, it never decides it.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3.5">
              <button
                onClick={start}
                className="rounded-[10px] px-8 py-4 font-[family-name:var(--font-heading)] text-[17px] font-bold text-white transition-colors"
                style={{ backgroundColor: ACCENT }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = ACCENT_HOVER)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = ACCENT)}
              >
                Start screening
              </button>
              <button
                onClick={tryExample}
                className="rounded-[10px] border-[1.5px] border-[#C6CFCC] px-8 py-4 font-[family-name:var(--font-heading)] text-[17px] font-bold text-[#15181A] transition-colors hover:border-[#0E7C6E] hover:text-[#0E7C6E]"
              >
                Try an example patient
              </button>
            </div>
            <div className="mt-16 grid max-w-[900px] grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { stat: "1 in 2", body: "women over 50 will fracture a bone due to osteoporosis." },
                { stat: "NHANES", body: "The prediction comes from a model trained on national health survey data — not from a chatbot." },
                { stat: "Adaptive chat", body: "Four quick screening questions, then more detail only when needed. No account or forms." },
              ].map((c) => (
                <div key={c.stat} className="rounded-[14px] border border-[#E3E9E7] bg-white px-6 py-[22px] text-left">
                  <div className="font-[family-name:var(--font-heading)] text-[28px] font-bold" style={{ color: ACCENT }}>
                    {c.stat}
                  </div>
                  <div className="mt-1.5 text-sm leading-[1.5] text-[#4A5452]">{c.body}</div>
                </div>
              ))}
            </div>
          </main>
        </div>
      )}

      {screen === "chat" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center gap-6 border-b border-[#E3E9E7] bg-white px-6 py-4 sm:px-12">
            <div className="font-[family-name:var(--font-heading)] text-[19px] font-bold tracking-[-0.02em]">
              Bone<span style={{ color: ACCENT }}>Bot</span>
            </div>
            <div className="hidden h-1.5 max-w-[320px] flex-1 overflow-hidden rounded-full bg-[#E3E9E7] sm:block">
              <div
                className="h-full rounded-full transition-[width] duration-400"
                style={{ backgroundColor: ACCENT, width: `${progressPct}%` }}
              />
            </div>
            <div className="text-[13px] font-medium text-[#5A6462]">{progressLabel}</div>
            <div className="ml-auto rounded-full bg-[#FBF3DD] px-3 py-[5px] text-xs font-semibold text-[#8A6A1F]">
              Screening flag — not a diagnosis
            </div>
          </header>
          <div ref={chatRef} className="flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto flex max-w-[680px] flex-col gap-3.5">
              {messages.map((m, i) =>
                m.role === "bot" ? <BotBubble key={i} text={m.text} /> : <UserBubble key={i} text={m.text} />
              )}
              {typing && <TypingDots />}
            </div>
          </div>
          <div className="bg-gradient-to-b from-transparent to-[#F5F7F6] px-6 pb-7 pt-4">
            <div className="mx-auto flex max-w-[680px] flex-wrap justify-end gap-2.5">
              {inFlow &&
                step.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => answer(opt)}
                    className="rounded-full border-[1.5px] px-5 py-2.5 text-[15px] font-medium transition-colors hover:text-white"
                    style={{ borderColor: ACCENT, color: ACCENT }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = ACCENT;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {opt}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {screen === "results" && !result && (
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <section className="w-full max-w-2xl rounded-2xl border border-[#E3E9E7] bg-white p-8">
            <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">Initial screening result</p>
            {triageResult && <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-bold text-[#15181A]">Very low initial risk</h1>}
            {triageResult && <p className="mt-4 font-[family-name:var(--font-heading)] text-6xl font-bold" style={{ color: ACCENT }}>{triageResult.probabilityPercent}%</p>}
            {triageResult && <p className="mt-2 text-sm text-[#5A6462]">Below the {triageResult.thresholdPercent}% threshold for the full assessment.</p>}
            <p className="mt-6 text-base leading-[1.6] text-[#4A5452]">{routeMessage}</p>
            {triageResult && (
              <div className="mt-6 rounded-xl bg-[#F5F7F6] p-5 text-sm leading-[1.6] text-[#4A5452]">
                <h2 className="font-[family-name:var(--font-heading)] text-base font-bold text-[#15181A]">Keep it that way</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  {LOW_RISK_GUIDANCE.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <p className="mt-4">This is a screening estimate, not a diagnosis or a bone-density measurement.</p>
              </div>
            )}
            <button onClick={restart} className="mt-7 rounded-[10px] px-5 py-3 font-[family-name:var(--font-heading)] font-bold text-white" style={{ backgroundColor: ACCENT }}>Start over</button>
          </section>
        </div>
      )}

      {screen === "results" && result && (
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center gap-6 border-b border-[#E3E9E7] bg-white px-6 py-4 sm:px-12">
            <div className="font-[family-name:var(--font-heading)] text-[19px] font-bold tracking-[-0.02em]">
              Bone<span style={{ color: ACCENT }}>Bot</span>
            </div>
            <div className="text-[13px] font-medium text-[#5A6462]">Screening complete</div>
            <div className="ml-auto rounded-full bg-[#FBF3DD] px-3 py-[5px] text-xs font-semibold text-[#8A6A1F]">
              Screening flag — not a diagnosis
            </div>
            <button
              onClick={restart}
              className="rounded-lg border-[1.5px] border-[#C6CFCC] px-3.5 py-[7px] text-[13px] font-semibold text-[#4A5452] hover:border-[#0E7C6E] hover:text-[#0E7C6E]"
            >
              Start over
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-12">
            <div className="mx-auto grid max-w-[1140px] grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_420px]">
              <div className="flex flex-col gap-5">
                {!result.validated && (
                  <p className="rounded-[14px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-700">
                    ⚠️ Illustrative — coefficients not yet trained on NHANES. Do not present these numbers as real.
                  </p>
                )}

                <div className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                      Your screening result
                    </div>
                    <div className="flex gap-1 rounded-[9px] bg-[#EEF2F0] p-1">
                      {TABS.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTab(t.id)}
                          className={`rounded-md px-3.5 py-1.5 text-[13px] font-semibold ${
                            tab === t.id ? "bg-white text-[#15181A]" : "bg-transparent text-[#5A6462]"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {tab !== "meter" && (
                    <>
                      <div className="mb-5 flex flex-wrap items-center gap-5">
                        <div
                          className="font-[family-name:var(--font-heading)] text-[52px] font-bold tracking-[-0.02em]"
                          style={{ color: catMeta.color }}
                        >
                          {catMeta.label}
                        </div>
                        <div
                          className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
                          style={{ color: catMeta.color, backgroundColor: catMeta.bg }}
                        >
                          {catMeta.chip}
                        </div>
                      </div>
                      <p className="text-pretty text-base leading-[1.6] text-[#4A5452]">{catMeta.desc}</p>
                    </>
                  )}

                  {tab !== "category" && (
                    <div className="mt-2 mb-2">
                      <div className="flex h-3.5 overflow-hidden rounded-full">
                        <div className="w-1/3" style={{ backgroundColor: "#BFDDD3" }} />
                        <div className="w-1/3" style={{ backgroundColor: "#F0DFAE" }} />
                        <div className="w-1/3" style={{ backgroundColor: "#EFC3B8" }} />
                      </div>
                      <div className="relative h-0">
                        <div
                          className="absolute -top-[21px] h-7 w-1 -translate-x-1/2 rounded-sm bg-[#15181A]"
                          style={{ left: `${marker}%` }}
                        />
                      </div>
                      <div className="mt-3.5 flex justify-between text-xs font-semibold text-[#5A6462]">
                        <span>Low</span>
                        <span>Moderate</span>
                        <span>Elevated</span>
                      </div>
                      <div className="mt-3 text-sm text-[#4A5452]">
                        Estimated T-score: <strong>{result.estimatedTScore}</strong> (likely {result.tScoreRange[0]}
                        {" … "}
                        {result.tScoreRange[1]})
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                  <div className="mb-4.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                    What drove this result
                  </div>
                  <div className="flex flex-col gap-3">
                    {result.contributions.map((f) => (
                      <div key={f.factor} className="flex items-center gap-3.5">
                        <div
                          className="min-w-[34px] rounded-lg px-2.5 py-1.5 text-center font-[family-name:var(--font-heading)] text-sm font-bold"
                          style={
                            f.direction === "raises"
                              ? { color: ACCENT, backgroundColor: ACCENT_TINT }
                              : { color: "#B0442F", backgroundColor: "#F9E7E2" }
                          }
                        >
                          {f.contribution > 0 ? "+" : ""}
                          {f.contribution.toFixed(1)}
                        </div>
                        <div className="text-[15px]">{f.factor}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4.5 text-[13px] leading-[1.5] text-[#5A6462]">
                    Weights follow established clinical and NHANES-derived risk factors — only the factors that
                    measurably moved this estimate are shown above.
                  </div>
                </div>

                <div
                  className="flex flex-col items-start justify-between gap-5 rounded-2xl px-7 py-6 sm:flex-row sm:items-center sm:px-8"
                  style={{ backgroundColor: ACCENT }}
                >
                  <div>
                    <div className="font-[family-name:var(--font-heading)] text-[19px] font-bold text-white">
                      Next step: talk to your GP about a DEXA scan
                    </div>
                    <div className="mt-1 text-sm text-[#CBE6E0]">
                      A DEXA scan is the actual diagnostic test. This screening tells you whether it&apos;s worth
                      asking for one.
                    </div>
                  </div>
                  <button
                    onClick={() => qaAsk("What's a DEXA scan?")}
                    className="whitespace-nowrap rounded-[9px] bg-white px-5 py-3 font-[family-name:var(--font-heading)] text-sm font-bold hover:bg-[#E4F0ED]"
                    style={{ color: ACCENT }}
                  >
                    What&apos;s a DEXA scan?
                  </button>
                </div>
              </div>

              <div className="flex h-[640px] flex-col rounded-2xl border border-[#E3E9E7] bg-white">
                <div className="border-b border-[#E3E9E7] px-6 py-[18px]">
                  <div className="font-[family-name:var(--font-heading)] text-base font-bold">Ask about your result</div>
                  <div className="mt-0.5 text-[13px] text-[#5A6462]">The AI explains — it never changes your score.</div>
                </div>
                <div ref={qaRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-5">
                  {qaMessages.map((m, i) =>
                    m.role === "bot" ? (
                      <BotBubble key={i} text={m.text} small />
                    ) : (
                      <UserBubble key={i} text={m.text} small />
                    )
                  )}
                  {qaTyping && <TypingDots small />}
                </div>
                <div className="flex flex-col gap-2.5 border-t border-[#E3E9E7] px-5 py-3.5">
                  <div className="flex flex-wrap gap-2">
                    {[`Why is my risk ${cat}?`, "What is a DEXA scan?", "What can I do now?"].map((s) => (
                      <button
                        key={s}
                        onClick={() => qaAsk(s)}
                        className="rounded-full bg-[#EEF2F0] px-3.5 py-[7px] text-[13px] font-medium hover:bg-[#DCE7E3]"
                        style={{ color: ACCENT }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={qaInput}
                      onChange={(e) => setQaInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && qaInput.trim() && qaAsk(qaInput.trim())}
                      placeholder="Type a question…"
                      aria-label="Ask about your result"
                      className="flex-1 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0E7C6E]"
                    />
                    <button
                      onClick={() => qaInput.trim() && qaAsk(qaInput.trim())}
                      className="rounded-[9px] px-4.5 py-2.5 font-[family-name:var(--font-heading)] text-sm font-bold text-white"
                      style={{ backgroundColor: ACCENT }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="flex flex-col items-start justify-between gap-3 border-t border-[#E3E9E7] bg-white px-6 py-3.5 sm:flex-row sm:items-center sm:px-12">
        <div className="text-[12.5px] text-[#5A6462]">
          BoneBot is a screening flag, not a diagnosis. It does not provide medical advice — discuss results with
          your clinician.
        </div>
        <div className="whitespace-nowrap text-[12.5px] text-[#9AA5A2]">Hack-Nation 6th Global AI Hackathon · 2026</div>
      </footer>
    </div>
  );
}
