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
import { resolveAmbiguousAnswer } from "@/lib/ambiguity";
import { scoreBone, type BoneFeatures, type ModelOutput } from "@/lib/bone-model";
import { scoreTriage, type TriageOutput } from "@/lib/triage-model";
import { tScoreModel } from "../../model/model-parameters";

const ACCENT = "#0E7C6E";
const ACCENT_HOVER = "#0A5A50";
const ACCENT_TINT = "#E4F0ED";

type StepKey = "assignedFemale" | "age" | "menopauseStatus" | "existingCare" | "knowsDxa" | "dxaScore" | "dxaYear" | "menopause" | "fracture" | "parent" | "smoke" | "steroids" | "bloodResults" | "weight";

type Step = { key: StepKey; q: string; options: string[] };

type UploadedBloodResults = {
  vitaminD: number | null;
  calcium: number | null;
  alkalinePhosphatase: number | null;
  redBloodCellCount: number | null;
};

const STEPS: Step[] = [
  { key: "assignedFemale", q: "Were you assigned female at birth?", options: ["Yes", "No"] },
  { key: "age", q: "Let's start simple — how old are you?", options: [] },
  { key: "menopauseStatus", q: "Have your periods stopped for good?", options: ["Yes", "No", "Not sure"] },
  { key: "existingCare", q: "Have you already been diagnosed with osteoporosis, had a bone scan, or taken bone medication?", options: ["Yes", "No"] },
  { key: "knowsDxa", q: "Do you know the T-score from your most recent DXA bone-density scan?", options: ["Yes", "No"] },
  { key: "dxaScore", q: "What was the T-score on that scan?", options: [] },
  { key: "dxaYear", q: "What year was that scan performed?", options: [] },
  { key: "menopause", q: "At what age did you reach menopause?", options: [] },
  { key: "fracture", q: "Have you broken a bone since age 50 — even from a minor fall or bump?", options: [] },
  { key: "parent", q: "Did either of your parents ever fracture a hip?", options: [] },
  { key: "smoke", q: "Do you currently smoke?", options: [] },
  { key: "steroids", q: "Have you ever taken corticosteroids (like prednisone) for 3 months or more?", options: [] },
  { key: "bloodResults", q: "If you have blood-test results, upload an image now. Otherwise, type skip to continue.", options: [] },
  { key: "weight", q: "Is your weight under 57 kg (about 125 lb)?", options: [] },
];

const EXAMPLE_ANSWERS: Record<StepKey, string> = {
  assignedFemale: "Yes",
  age: "67",
  menopauseStatus: "Yes",
  existingCare: "No",
  knowsDxa: "No",
  dxaScore: "",
  dxaYear: "",
  menopause: "40–45",
  fracture: "No",
  parent: "Yes",
  smoke: "No",
  steroids: "No",
  bloodResults: "Skip",
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

const AGE_MIDPOINT: Record<string, number> = {
  "Under 50": 47,
  "50–54": 52,
  "55–59": 57,
  "60–64": 62,
  "65–69": 67,
  "70–74": 72,
  "75–79": 77,
  "80–84": 82,
  "85 or older": 88,
};
const AGE_BRACKETS = Object.keys(AGE_MIDPOINT);
const MENOPAUSE_AGE_MIDPOINT: Record<string, number> = { "Before 40": 35, "40–45": 42, "After 45": 48, "Not sure": 48 };
const MENOPAUSE_STATUS = { Yes: "yes", No: "no", "Not sure": "not-sure" } as const;
const FULL_QUESTION_START = 7;

const LOW_RISK_GUIDANCE = [
  "Keep active with weight-bearing and muscle-strengthening activity that feels safe and suitable for you.",
  "Avoid smoking. If you smoke, getting support to stop benefits your overall health as well as your bones.",
  "Keep high alcohol intake low. If your health changes or you have a fracture after a minor fall, speak with a clinician.",
] as const;

function mapAnswersToFeatures(answers: Record<StepKey, string>, bloodResults: UploadedBloodResults | null): BoneFeatures {
  const parsedAge = Number(answers.age);
  const age = Number.isFinite(parsedAge) ? parsedAge : AGE_MIDPOINT[answers.age] ?? 65;
  const parsedMenopauseAge = Number(answers.menopause);
  const menopauseAge = Number.isFinite(parsedMenopauseAge)
    ? parsedMenopauseAge
    : MENOPAUSE_AGE_MIDPOINT[answers.menopause] ?? 48;
  const answerOrDefault = (answer: string, defaultValue: number) =>
    answer === "Yes" ? true : answer === "No" ? false : Boolean(defaultValue);
  return {
    age,
    yearsSinceMenopause: Number.isFinite(parsedMenopauseAge)
      ? Math.max(0, age - menopauseAge)
      : tScoreModel.imputationDefaults.yearsSinceMenopause,
    priorFragilityFracture: answerOrDefault(answers.fracture, tScoreModel.imputationDefaults.priorFragilityFracture),
    parentalHipFracture: answerOrDefault(answers.parent, tScoreModel.imputationDefaults.parentalHipFracture),
    currentSmoker: answerOrDefault(answers.smoke, tScoreModel.imputationDefaults.currentSmoker),
    glucocorticoids: answerOrDefault(answers.steroids, tScoreModel.imputationDefaults.glucocorticoids),
    // "Under 57kg" is a low-body-weight screening proxy, not a measured BMI —
    // a rough stand-in until BMI (or height+weight) is asked directly.
    bmi: answers.weight === "Yes" ? 20 : answers.weight === "No" ? 26 : tScoreModel.imputationDefaults.bmi,
    ...FIELD_DEFAULTS,
    vitaminD: bloodResults?.vitaminD ?? FIELD_DEFAULTS.vitaminD,
    calcium: bloodResults?.calcium ?? FIELD_DEFAULTS.calcium,
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

// Paula, 2026-07-19: standard clinical T-score bands (same scale a DXA scan
// reports on), shown as a legend so the raw number is legible on its own,
// alongside the LLM's own explanation.
const T_SCORE_BANDS = [
  { label: "Normal", range: "−1.0 or above", color: "#0E7C6E" },
  { label: "Osteopenia (low bone mass)", range: "−1.0 to −2.5", color: "#A06D14" },
  { label: "Osteoporosis", range: "−2.5 or below", color: "#B0442F" },
] as const;

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

// Bar height for the age-sensitivity chart: same clinically-anchored axis as
// the meter, so bar heights and the meter marker read consistently.
function barHeightPercent(tScore: number): number {
  const clamped = Math.max(AXIS_MIN, Math.min(AXIS_MAX, tScore));
  return Math.round(((clamped - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100);
}

function bandColor(tScore: number): string {
  if (tScore <= -2.5) return "#B0442F"; // elevated
  if (tScore >= -1.0) return "#0E7C6E"; // lower
  return "#A06D14"; // uncertain
}

// Five reputable, evidence-based patient resources — shown as a brief plus a
// clearly separate link out, never routed through the LLM (no risk of a
// hallucinated URL, no risk of the LLM paraphrasing a source incorrectly).
const RESOURCES = [
  {
    name: "Royal Osteoporosis Society (UK)",
    url: "https://theros.org.uk/information-and-support/",
    brief:
      "The UK's leading bone-health charity. Covers what bone density actually means, how calcium and vitamin D protect bone, safe exercise if you have osteoporosis, and treatment options — plus a nurse-staffed helpline for personal questions.",
  },
  {
    name: "International Osteoporosis Foundation",
    url: "https://www.osteoporosis.foundation/educational-hub",
    brief:
      "A global federation of osteoporosis patient societies and researchers. Their hub has the “Are you at risk?” screening quiz and plain-language explainers that link out to guidelines specific to your country.",
  },
  {
    name: "NIH Osteoporosis and Related Bone Diseases Resource Center",
    url: "https://www.niams.nih.gov/health-topics/bone-health-and-osteoporosis",
    brief:
      "Run by the US National Institutes of Health. Government-vetted, plain-language pages on how bone density changes after menopause and how prevention and diagnosis work.",
  },
  {
    name: "Bone Health & Osteoporosis Foundation",
    url: "https://www.bonehealthandosteoporosis.org/preventing-fractures/",
    brief:
      "A US clinician-and-patient organization (formerly NOF). Their fracture-prevention guidance covers FRAX risk scoring, what a DEXA scan involves, and the range of treatments a doctor might discuss.",
  },
  {
    name: "NHS — Osteoporosis",
    url: "https://www.nhs.uk/conditions/osteoporosis",
    brief:
      "The UK's National Health Service overview. A concise clinical summary: symptoms, what causes bone loss, how osteoporosis is diagnosed, and when it's worth seeing a GP.",
  },
] as const;

type ChatMessage = { role: "bot" | "user"; text: string; kind?: "resources" };

// Shared everywhere BoneBot surfaces the resource list — the compact chat
// bubble version (small) and the full result-page card (below).
function TrustedResources({ small }: { small?: boolean }) {
  return (
    <ul className={`flex flex-col ${small ? "gap-3" : "gap-4"}`}>
      {RESOURCES.map((r) => (
        <li key={r.url} className={small ? "" : "border-b border-[#E3E9E7] pb-4 last:border-0 last:pb-0"}>
          <div className={`font-semibold text-[#15181A] ${small ? "text-sm" : "text-[15px]"}`}>{r.name}</div>
          <p className={`mt-1 leading-[1.5] text-[#4A5452] ${small ? "text-[12.5px]" : "text-[13.5px]"}`}>{r.brief}</p>
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-1.5 inline-flex items-center gap-1 font-semibold ${small ? "text-[12.5px]" : "text-[13px]"}`}
            style={{ color: ACCENT }}
          >
            Visit official site
            <span aria-hidden>↗</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function ResourcesCard() {
  return (
    <div className="max-w-[88%] rounded-[14px_14px_14px_4px] border border-[#E3E9E7] bg-white px-4 py-3.5">
      <div className="mb-3 text-sm font-semibold">A few reputable places to read more:</div>
      <TrustedResources small />
    </div>
  );
}

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
  const [scoreExplanation, setScoreExplanation] = useState("");
  const [implicationsExplanation, setImplicationsExplanation] = useState("");
  const [reportedDxa, setReportedDxa] = useState<{ score: number; year?: number } | null>(null);
  const [freeInput, setFreeInput] = useState("");
  const [flowQuestionBusy, setFlowQuestionBusy] = useState(false);
  const [bloodResults, setBloodResults] = useState<UploadedBloodResults | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [clarificationCounts, setClarificationCounts] = useState<Partial<Record<StepKey, number>>>({});
  const [unresolvedAnswerCount, setUnresolvedAnswerCount] = useState(0);
  const [uncertaintyNotes, setUncertaintyNotes] = useState<string[]>([]);

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
    setReportedDxa(null);
    setFreeInput("");
    setBloodResults(null);
    setUnresolvedAnswerCount(0);
    setClarificationCounts({});
    botSay(
      "Hi, I'm BoneBot. I’ll start with four quick questions. If the model finds a higher initial probability, I’ll ask for a few more details. The model calculates the result; AI only explains it."
    );
    window.setTimeout(() => botSay(STEPS[0].q), 1400);
  }

  async function runModel(all: Record<StepKey, string>) {
    const full = mapAnswersToFeatures(all, bloodResults);
    setFeatures(full);
    const model = scoreBone(full);
    setResult(model);

    const scoreFallback = `Your estimated T-score is ${model.estimatedTScore}, with an uncertainty range of ${model.tScoreRange[0]} to ${model.tScoreRange[1]}. This is a screening estimate, not a DXA measurement or diagnosis.`;
    const implicationsFallback =
      model.category === "lower"
        ? "This result is reassuring, but it cannot decide on its own whether a scan is appropriate. Keep supporting your bone health and discuss screening at a routine GP visit if that is relevant to you."
        : "This screening result is a reason to discuss a DXA scan and wider fracture-risk assessment with your GP. It is not a diagnosis.";
    const getExplanation = async (explanationType: "score" | "implications", fallback: string) => {
      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "consumer", result: model, features: full, explanationType }),
        });
        return response.ok ? (await response.json()).text : fallback;
      } catch {
        return fallback;
      }
    };
    const [scoreText, implicationsText] = await Promise.all([
      getExplanation("score", scoreFallback),
      getExplanation("implications", implicationsFallback),
    ]);
    setScoreExplanation(scoreText);
    setImplicationsExplanation(implicationsText);
    setQaMessages([{ role: "bot", text: "Ask a question about your bone-health screening result." }]);
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

  function continueAfterTriage(nextAnswers: Partial<Record<StepKey, string>>) {
    const enteredAge = Number(nextAnswers.age);
    const triage = scoreTriage({
      age: Number.isFinite(enteredAge) ? enteredAge : AGE_MIDPOINT[nextAnswers.age ?? ""] ?? 65,
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
    setStepIdx(FULL_QUESTION_START);
    botSay("Your initial screening estimate is above our threshold, so I’ll ask a few more questions to create your full bone-health screening result.");
    window.setTimeout(() => botSay(STEPS[FULL_QUESTION_START].q), 900);
  }

  function showReportedDxa(nextAnswers: Partial<Record<StepKey, string>>) {
    const score = Number(nextAnswers.dxaScore);
    const year = nextAnswers.dxaYear === "Unknown" || nextAnswers.dxaYear === "Not sure" ? undefined : Number(nextAnswers.dxaYear);
    setReportedDxa({ score, year: Number.isFinite(year) ? year : undefined });
    setTriageResult(null);
    setResult(null);
    setQaMessages([]);
    setRouteMessage("This is an explanation of the DXA score you reported. It does not replace the original scan report or your clinician’s assessment.");
    setScreen("results");
  }

  function answer(opt: string, display = opt, recordMessage = true) {
    if (typing || flowQuestionBusy) return;
    const step = STEPS[stepIdx];
    const nextAnswers = { ...answers, [step.key]: opt };
    if (recordMessage) setMessages((m) => [...m, { role: "user", text: display }]);
    setAnswers(nextAnswers);
    setFreeInput("");
    setClarificationCounts((counts) => ({ ...counts, [step.key]: 0 }));

    if (stepIdx === 3) {
      if (nextAnswers.assignedFemale !== "Yes") {
        void finishAtGate("BoneBot is currently calibrated for people assigned female at birth. A clinician can help you find the right bone-health assessment.");
      } else if (nextAnswers.existingCare === "Yes") {
        setStepIdx(4);
        botSay(STEPS[4].q);
      } else {
        continueAfterTriage(nextAnswers);
      }
      return;
    }

    if (stepIdx === 4) {
      if (opt === "No") continueAfterTriage(nextAnswers);
      else {
        setStepIdx(5);
        botSay(STEPS[5].q);
      }
      return;
    }

    if (stepIdx === 5) {
      if (opt === "Unknown" || opt === "Not sure") continueAfterTriage(nextAnswers);
      else {
        setStepIdx(6);
        botSay(STEPS[6].q);
      }
      return;
    }

    if (stepIdx === 6) {
      showReportedDxa(nextAnswers);
      return;
    }

    const nextIdx = stepIdx + 1;
    setStepIdx(nextIdx);
    if (nextIdx < STEPS.length) {
      botSay(STEPS[nextIdx].q);
    } else {
      botSay("That's everything. Running your answers through the risk model…");
      void runModel(nextAnswers as Record<StepKey, string>);
    }
  }

  function normaliseFreeAnswer(key: StepKey, raw: string): string | null {
    const text = raw.trim();
    const lower = text.toLowerCase();
    if (!text) return null;
    if (key === "age") {
      const value = Number(text.replace(/\D/g, ""));
      return Number.isInteger(value) && value >= 18 && value <= 110 ? String(value) : null;
    }
    if (key === "dxaScore") {
      if (/(not sure|don't know|do not know|unknown)/.test(lower)) return "Unknown";
      const value = Number(text.replace(/[^0-9.+-]/g, ""));
      return Number.isFinite(value) && value >= -5 && value <= 3 ? String(value) : null;
    }
    if (key === "dxaYear") {
      if (/(not sure|don't know|do not know|unknown)/.test(lower)) return "Unknown";
      const value = Number(text.replace(/\D/g, ""));
      return Number.isInteger(value) && value >= 1900 && value <= new Date().getFullYear() ? String(value) : null;
    }
    if (key === "menopause") {
      if (/(not sure|don't know|do not know)/.test(lower)) return "Not sure";
      const match = lower.match(/\d{2}/);
      if (!match) return null;
      const age = Number(match[0]);
      return age >= 18 && age <= 70 ? String(age) : null;
    }
    if (key === "bloodResults") {
      return /\b(skip|no|none|continue)\b/.test(lower) ? "Skip" : null;
    }
    if (key === "weight") {
      const match = lower.match(/\d+(?:\.\d+)?/);
      if (match) return Number(match[0]) < 57 ? "Yes" : "No";
    }
    if (/(not sure|don't know|do not know)/.test(lower)) return "Not sure";
    if (key === "fracture" && /\b(broke|broken|fracture)\b/.test(lower)) return "Yes";
    if (key === "parent" && /\b(mother|father|mum|dad|parent)\b/.test(lower) && /\b(did|had|yes)\b/.test(lower)) return "Yes";
    if (/\b(no|nope|never)\b/.test(lower)) return "No";
    if (/\b(don't|do not|didn't|did not)\b/.test(lower)) return "No";
    if (/\b(yes|yeah|yep|i do|i have)\b/.test(lower)) return "Yes";
    return null;
  }

  async function submitFreeInput() {
    const raw = freeInput.trim();
    const step = STEPS[stepIdx];
    if (!raw || !step || flowQuestionBusy) return;
    const value = normaliseFreeAnswer(step.key, raw);
    if (value && value !== "Not sure" && value !== "Unknown") {
      answer(value, raw);
      return;
    }
    const looksLikeQuestion = /\?|^(what|why|how|can|is|are|does|do)\b/i.test(raw);
    if (!looksLikeQuestion) {
      const attempts = clarificationCounts[step.key] ?? 0;
      const resolution = resolveAmbiguousAnswer(step.key, attempts);
      if (resolution.action === "clarify") {
        setClarificationCounts((counts) => ({ ...counts, [step.key]: attempts + 1 }));
        setMessages((items) => [
          ...items,
          { role: "user", text: raw },
          { role: "bot", text: resolution.message },
        ]);
        setFreeInput("");
        return;
      }
      setUncertaintyNotes((notes) => [...notes, resolution.note]);
      setMessages((items) => [
        ...items,
        { role: "user", text: raw },
        { role: "bot", text: "I will mark that as unknown and continue using the model’s published default for this input." },
      ]);
      const nextUnresolvedCount = unresolvedAnswerCount + 1;
      setUnresolvedAnswerCount(nextUnresolvedCount);
      if (nextUnresolvedCount >= 3) {
        void finishAtGate("BoneBot is not able to create a reliable screening score from the answers provided. For any further questions about your bone health, please reach out to your GP or another clinician.");
        return;
      }
      answer(resolution.storedValue, raw, false);
      return;
    }
    setMessages((items) => [...items, { role: "user", text: raw }]);
    setFreeInput("");
    setFlowQuestionBusy(true);
    let text = "BoneBot can only answer questions about this bone-health screening and the evidence it uses.";
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "consumer", question: raw, stage: "questionnaire" }),
      });
      if (response.ok) text = (await response.json()).text;
    } catch {
      /* Keep the fixed, evidence-bounded fallback visible. */
    }
    setFlowQuestionBusy(false);
    setMessages((items) => [...items, { role: "bot", text }]);
  }

  async function uploadBloodResults(image: File) {
    setUploadBusy(true);
    let message = "BoneBot could not read that image. You can still type your answer.";
    try {
      const formData = new FormData();
      formData.append("image", image);
      const response = await fetch("/api/blood-results", { method: "POST", body: formData });
      const body = (await response.json()) as UploadedBloodResults | { error: string };
      if (!response.ok || "error" in body) {
        message = "error" in body ? body.error : message;
      } else {
        setBloodResults(body);
        const extracted = [
          body.vitaminD !== null ? `vitamin D ${body.vitaminD} nmol/L` : null,
          body.calcium !== null ? `calcium ${body.calcium} mmol/L` : null,
          body.alkalinePhosphatase !== null ? `ALP ${body.alkalinePhosphatase} U/L` : null,
          body.redBloodCellCount !== null ? `RBC ${body.redBloodCellCount}` : null,
        ].filter(Boolean);
        message = extracted.length
          ? `I read: ${extracted.join(", ")}. Vitamin D and calcium are included in the current estimate; ALP and RBC are shown only as context.`
          : "I could not identify a supported blood-result value in that image. You can still type your answer.";
        if (STEPS[stepIdx]?.key === "bloodResults") answer("Uploaded", "Blood-result image uploaded");
      }
    } catch {
      /* Keep the fixed fallback visible. */
    }
    setUploadBusy(false);
    setMessages((items) => [...items, { role: "bot", text: message }]);
  }

  function tryExample() {
    runModel(EXAMPLE_ANSWERS);
  }

  // No backend involved on purpose: this opens her own email app with the
  // result pre-filled. No new dependency, no API key, works immediately —
  // a server-sent email would need both and neither exists yet.
  function emailResultHref(): string {
    if (!result) return "";
    const lines = [
      `BoneBot screening result — ${catMeta.label}`,
      "",
      `Estimated T-score: ${result.estimatedTScore} (likely ${result.tScoreRange[0]} to ${result.tScoreRange[1]})`,
      `Category: ${catMeta.label} (${T_SCORE_BANDS[{ low: 0, moderate: 1, elevated: 2 }[cat]].range})`,
      "",
      "What drove this result:",
      ...result.contributions
        .slice(0, 5)
        .map((f) => `  ${f.contribution > 0 ? "+" : ""}${f.contribution.toFixed(1)}  ${f.factor}`),
      "",
      "This is a screening estimate from a model trained on NHANES data, not a diagnosis or a bone-density measurement. A DXA scan gives the real T-score — please discuss this result with your GP or clinician.",
      "",
      "— BoneBot, Hack-Nation 6th Global AI Hackathon",
    ];
    const subject = encodeURIComponent(`My BoneBot bone-health screening result — ${catMeta.label}`);
    const body = encodeURIComponent(lines.join("\n"));
    return `mailto:?subject=${subject}&body=${body}`;
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
    setReportedDxa(null);
    setScoreExplanation("");
    setImplicationsExplanation("");
    setFreeInput("");
    setBloodResults(null);
    setUnresolvedAnswerCount(0);
    setClarificationCounts({});
    setUncertaintyNotes([]);
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

  // Static, non-LLM: the chat directing her to reputable external resources
  // should never depend on an API key, and must never risk a hallucinated URL.
  function showResources() {
    setQaMessages((m) => [
      ...m,
      { role: "user", text: "Where can I learn more?" },
      { role: "bot", text: "", kind: "resources" },
    ]);
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
          <div className="border-t border-[#E3E9E7] bg-white px-6 py-5">
            <div className="mx-auto flex max-w-[680px] flex-col gap-3">
              {inFlow && step.options.length > 0 && (
                <div className="flex flex-wrap justify-end gap-2.5">
                  {step.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => answer(opt)}
                      className="rounded-full border-[1.5px] px-5 py-2.5 text-[15px] font-medium transition-colors"
                      style={{ borderColor: ACCENT, color: ACCENT }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = ACCENT;
                        e.currentTarget.style.color = "#FFFFFF";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = ACCENT;
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {inFlow && step.options.length === 0 && (
                <div className="flex flex-col gap-2.5">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitFreeInput();
                    }}
                    className="flex gap-2 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white p-1.5 focus-within:border-[#0E7C6E]"
                  >
                    <input
                      value={freeInput}
                      onChange={(event) => setFreeInput(event.target.value)}
                      placeholder="Type your answer, or ask a bone-health question"
                      aria-label="Answer or ask a bone-health question"
                      disabled={flowQuestionBusy}
                      className="flex-1 border-0 bg-transparent px-2.5 py-2 text-sm outline-none disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={flowQuestionBusy || !freeInput.trim()}
                      className="rounded-[9px] px-4.5 py-2.5 font-[family-name:var(--font-heading)] text-sm font-bold text-white disabled:opacity-40"
                      style={{ backgroundColor: ACCENT }}
                    >
                      Send
                    </button>
                  </form>

                  {step.key === "bloodResults" && (
                    <label
                      className="flex cursor-pointer items-center gap-3 rounded-[12px] border-[1.5px] border-dashed border-[#C6CFCC] bg-[#F5F7F6] px-4 py-3 text-sm transition-colors hover:border-[#0E7C6E] hover:bg-[#E4F0ED]"
                      aria-disabled={uploadBusy}
                    >
                      <span
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-base"
                        style={{ backgroundColor: ACCENT_TINT, color: ACCENT }}
                        aria-hidden
                      >
                        📎
                      </span>
                      <span className="flex flex-col">
                        <span className="font-semibold text-[#15181A]">
                          {uploadBusy ? "Reading your photo…" : "Attach a photo instead"}
                        </span>
                        <span className="text-[13px] text-[#5A6462]">A blood-test result or lab report — JPG, PNG, or WEBP.</span>
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={uploadBusy}
                        onChange={(event) => {
                          const image = event.target.files?.[0];
                          if (image) void uploadBloodResults(image);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              )}

              {flowQuestionBusy && <p className="text-right text-sm text-[#5A6462]">Checking the approved evidence…</p>}
            </div>
          </div>
        </div>
      )}

      {screen === "results" && !result && (
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center gap-6 border-b border-[#E3E9E7] bg-white px-6 py-4 sm:px-12">
            <div className="font-[family-name:var(--font-heading)] text-[19px] font-bold tracking-[-0.02em]">
              Bone<span style={{ color: ACCENT }}>Bot</span>
            </div>
            <div className="text-[13px] font-medium text-[#5A6462]">Initial screening result</div>
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
          <div className="flex flex-1 items-start justify-center overflow-y-auto px-6 py-10">
            <div className="flex w-full max-w-2xl flex-col gap-5">
              <section className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                  Your initial screening estimate
                </div>
                {triageResult && (
                  <>
                    <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-bold text-[#15181A]">
                      Very low initial risk
                    </h1>
                    <p
                      className="mt-4 font-[family-name:var(--font-heading)] text-6xl font-bold tracking-[-0.02em]"
                      style={{ color: ACCENT }}
                    >
                      {triageResult.probabilityPercent}%
                    </p>
                    <p className="mt-2 text-sm text-[#5A6462]">
                      Below the {triageResult.thresholdPercent}% threshold BoneBot uses to move to the full
                      assessment.
                    </p>
                  </>
                )}
                {reportedDxa && (
                  <>
                    <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-bold text-[#15181A]">
                      Reported T-score {reportedDxa.score.toFixed(1)}
                    </h1>
                    <p className="mt-2 text-sm text-[#5A6462]">
                      {reportedDxa.score <= -2.5
                        ? "This reported score is in the osteoporosis range."
                        : reportedDxa.score < -1
                          ? "This reported score is in the low bone-density range."
                          : "This reported score is in the normal bone-density range."}
                      {reportedDxa.year ? ` Reported from ${reportedDxa.year}.` : ""}
                    </p>
                  </>
                )}
                <p className="mt-6 text-base leading-[1.6] text-[#4A5452]">{routeMessage}</p>
                {qaMessages[0]?.text && (
                  <div className="mt-6 rounded-xl bg-[#F5F7F6] p-5 text-sm leading-[1.6] text-[#4A5452]">
                    {qaMessages[0].text}
                  </div>
                )}
                {triageResult && (
                  <div className="mt-4 rounded-xl bg-[#F5F7F6] p-5 text-sm leading-[1.6] text-[#4A5452]">
                    <h2 className="font-[family-name:var(--font-heading)] text-base font-bold text-[#15181A]">
                      Keep it that way
                    </h2>
                    <ul className="mt-3 list-disc space-y-2 pl-5">
                      {LOW_RISK_GUIDANCE.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <p className="mt-4">This is a screening estimate, not a diagnosis or a bone-density measurement.</p>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                  Trusted resources
                </div>
                <TrustedResources />
              </section>

              <button
                onClick={restart}
                className="self-start rounded-[10px] px-5 py-3 font-[family-name:var(--font-heading)] font-bold text-white"
                style={{ backgroundColor: ACCENT }}
              >
                Start over
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === "results" && result && (
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center gap-6 border-b border-[#E3E9E7] bg-white px-6 py-4 sm:px-12">
            <div className="font-[family-name:var(--font-heading)] text-[19px] font-bold tracking-[-0.02em]">
              Bone<span style={{ color: ACCENT }}>Bot</span>
            </div>
            <div className="hidden text-[13px] font-medium text-[#5A6462] sm:block">Screening complete</div>
            <div className="ml-auto rounded-full bg-[#FBF3DD] px-3 py-[5px] text-xs font-semibold text-[#8A6A1F]">
              Screening flag — not a diagnosis
            </div>
            <a
              href={emailResultHref()}
              className="hidden items-center gap-1.5 rounded-lg border-[1.5px] border-[#C6CFCC] px-3.5 py-[7px] text-[13px] font-semibold text-[#4A5452] hover:border-[#0E7C6E] hover:text-[#0E7C6E] sm:flex"
            >
              <span aria-hidden>✉️</span> Email this result
            </a>
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
                      <div className="mt-4 rounded-xl bg-[#F5F7F6] p-4">
                        <p className="text-sm leading-[1.6] text-[#4A5452]">
                          Your <strong>estimated T-score is {result.estimatedTScore}</strong>, likely somewhere
                          between {result.tScoreRange[0]} and {result.tScoreRange[1]}. A T-score compares your bone
                          density to a healthy young adult: 0 is average, and lower (more negative) means less
                          dense bone.
                        </p>
                        <ul className="mt-3 flex flex-col gap-1.5">
                          {T_SCORE_BANDS.map((b) => (
                            <li key={b.label} className="flex items-center gap-2 text-[13px]">
                              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
                              <span className="font-semibold text-[#15181A]">{b.label}</span>
                              <span className="text-[#5A6462]">{b.range}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {uncertaintyNotes.length > 0 && (
                  <div className="rounded-2xl border border-[#E6CC89] bg-[#FFF8E8] px-7 py-7 sm:px-8">
                    <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                      Answers needing clarification
                    </div>
                    <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-[1.6] text-[#4A5452]">
                      {uncertaintyNotes.map((note, index) => (
                        <li key={`${note}-${index}`}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                  <div className="mb-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                    What drove this result
                  </div>
                  <p className="mb-5 text-[13px] leading-[1.5] text-[#5A6462]">
                    Each bar is how much that factor pushed your estimate — <span style={{ color: ACCENT }}>green pushes it up (better)</span>, <span style={{ color: "#B0442F" }}>red pushes it down</span>. Longer bar, bigger effect.
                  </p>
                  <div className="flex flex-col gap-3.5">
                    {(() => {
                      const maxAbs = Math.max(...result.contributions.map((f) => Math.abs(f.contribution)), 0.1);
                      return result.contributions.map((f) => {
                        const isPositive = f.direction === "raises";
                        const widthPct = Math.max(4, Math.round((Math.abs(f.contribution) / maxAbs) * 100));
                        return (
                          <div key={f.factor}>
                            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13.5px]">
                              <span className="text-[#15181A]">{f.factor}</span>
                              <span
                                className="font-[family-name:var(--font-heading)] font-bold"
                                style={{ color: isPositive ? ACCENT : "#B0442F" }}
                              >
                                {f.contribution > 0 ? "+" : ""}
                                {f.contribution.toFixed(1)}
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[#F0F2F1]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${widthPct}%`,
                                  backgroundColor: isPositive ? ACCENT : "#B0442F",
                                }}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="mt-5 text-[13px] leading-[1.5] text-[#5A6462]">
                    Weights follow established clinical and NHANES-derived risk factors — only the factors that
                    measurably moved this estimate are shown above.
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                  <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                    Understanding your estimated T-score
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-[15px] leading-[1.65] text-[#4A5452]">{scoreExplanation}</p>
                </div>

                <div className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                  <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                    What this could mean for you
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-[15px] leading-[1.65] text-[#4A5452]">{implicationsExplanation}</p>
                </div>

                {bloodResults && (
                  <div className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                    <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">Uploaded blood results</div>
                    <p className="mt-3 text-sm leading-[1.6] text-[#4A5452]">
                      {bloodResults.vitaminD !== null && `Vitamin D: ${bloodResults.vitaminD} nmol/L. `}
                      {bloodResults.calcium !== null && `Calcium: ${bloodResults.calcium} mmol/L. `}
                      {bloodResults.alkalinePhosphatase !== null && `ALP: ${bloodResults.alkalinePhosphatase} U/L. `}
                      {bloodResults.redBloodCellCount !== null && `RBC: ${bloodResults.redBloodCellCount}. `}
                      Vitamin D and calcium are included in the current estimate; ALP and RBC are contextual only.
                    </p>
                  </div>
                )}

                {result.category !== "lower" && <div
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
                </div>}

                {features && (
                  <div className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                    <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                      How your estimate changes with age
                    </div>
                    <p className="mt-1.5 text-[13px] leading-[1.5] text-[#5A6462]">
                      Same profile, run through the model at each age bracket — everything else held fixed. Your
                      answer is highlighted.
                    </p>
                    <div className="mt-6 flex h-[140px] items-end gap-1.5 sm:gap-2.5">
                      {AGE_BRACKETS.map((bracket) => {
                        const projected = scoreBone({ ...features, age: AGE_MIDPOINT[bracket] });
                        const isYours = AGE_MIDPOINT[bracket] === features.age;
                        return (
                          <div key={bracket} className="flex flex-1 flex-col items-center gap-1.5">
                            <div className="flex h-[100px] w-full items-end">
                              <div
                                className="w-full rounded-t-[4px] transition-[height]"
                                style={{
                                  height: `${Math.max(6, barHeightPercent(projected.estimatedTScore))}%`,
                                  backgroundColor: isYours ? ACCENT : bandColor(projected.estimatedTScore) + "55",
                                }}
                                title={`${bracket}: estimated T-score ${projected.estimatedTScore}`}
                              />
                            </div>
                            <div
                              className="text-center text-[10px] leading-tight"
                              style={{ color: isYours ? ACCENT : "#9AA5A2", fontWeight: isYours ? 700 : 400 }}
                            >
                              {bracket}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-[#E3E9E7] bg-white px-7 py-6 sm:flex-row sm:items-center sm:px-8">
                  <div>
                    <div className="font-[family-name:var(--font-heading)] text-base font-bold text-[#15181A]">
                      Keep a copy of this result
                    </div>
                    <div className="mt-0.5 text-[13px] text-[#5A6462]">
                      Email it to yourself, or bring it to your GP appointment.
                    </div>
                  </div>
                  <a
                    href={emailResultHref()}
                    className="flex items-center gap-2 whitespace-nowrap rounded-[9px] px-5 py-2.5 font-[family-name:var(--font-heading)] text-sm font-bold text-white"
                    style={{ backgroundColor: ACCENT }}
                  >
                    <span aria-hidden>✉️</span> Email this result
                  </a>
                </div>

                <div className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                  <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                    Trusted resources
                  </div>
                  <TrustedResources />
                </div>
              </div>

              <div className="flex h-[640px] flex-col rounded-2xl border border-[#E3E9E7] bg-white">
                <div className="border-b border-[#E3E9E7] px-6 py-[18px]">
                  <div className="font-[family-name:var(--font-heading)] text-base font-bold">Ask about your result</div>
                  <div className="mt-0.5 text-[13px] text-[#5A6462]">The AI explains — it never changes your score.</div>
                </div>
                <div ref={qaRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-5">
                  {qaMessages.map((m, i) => {
                    if (m.kind === "resources") return <ResourcesCard key={i} />;
                    return m.role === "bot" ? (
                      <BotBubble key={i} text={m.text} small />
                    ) : (
                      <UserBubble key={i} text={m.text} small />
                    );
                  })}
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
                    <button
                      onClick={showResources}
                      className="rounded-full bg-[#EEF2F0] px-3.5 py-[7px] text-[13px] font-medium hover:bg-[#DCE7E3]"
                      style={{ color: ACCENT }}
                    >
                      Where can I learn more?
                    </button>
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
