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
// The design's 7 questions don't cover all 13 BoneFeatures fields. Blood-test
// values (vitaminD, calcium) and activity (weightBearingActivity) are
// user-provided via photo upload / a quick chip when given; the remaining
// history fields this short flow never asks (hormone therapy, rheumatoid
// arthritis, alcohol) still use the same illustrative-defaults pattern as
// before; see mapAnswersToFeatures() below — flagged there for a clinical
// sanity-check, not a measurement.

import { useEffect, useRef, useState } from "react";
import { resolveAmbiguousAnswer } from "@/lib/ambiguity";
import { scoreBone, type BoneFeatures, type ModelOutput } from "@/lib/bone-model";
import { scoreTriage, type TriageOutput } from "@/lib/triage-model";
import { tScoreModel, SECONDARY_CONDITION_TRAINED } from "../../model/model-parameters";

const ACCENT = "#0E7C6E";
const ACCENT_HOVER = "#0A5A50";
const ACCENT_TINT = "#E4F0ED";
const FRACTURE = "#B0442F";

type StepKey = "assignedFemale" | "age" | "menopauseStatus" | "existingCare" | "knowsDxa" | "dxaScore" | "dxaYear" | "menopause" | "fracture" | "smoke" | "steroids" | "bloodResults" | "weight" | "activity" | "secondaryCondition";

type Step = { key: StepKey; q: string; options: string[] };

type UploadedBloodResults = {
  vitaminD: number | null;
  calcium: number | null;
  alkalinePhosphatase: number | null;
  redBloodCellCount: number | null;
};

// Feature: wearable/activity-app screenshot extraction — mirrors
// UploadedBloodResults. weightBearingActivity is the deterministic 0..1
// mapping (from /api/activity-extract, re-derived from steps/active-minutes
// by plain code, never chosen by the model); the raw steps/minutes are kept
// only to show the user what was read.
type UploadedActivityResult = {
  weightBearingActivity: number | null;
  estimatedSteps: number | null;
  estimatedActiveMinutes: number | null;
};

const STEPS: Step[] = [
  { key: "assignedFemale", q: "Were you assigned female at birth?", options: ["Yes", "No"] },
  { key: "age", q: "Let's start simple. How old are you?", options: [] },
  { key: "menopauseStatus", q: "Have your periods stopped for good?", options: ["Yes", "No", "Not sure"] },
  { key: "existingCare", q: "Have you already been diagnosed with osteoporosis, had a bone scan, or taken bone medication?", options: ["Yes", "No"] },
  { key: "knowsDxa", q: "Do you know the T-score from your most recent DXA bone-density scan?", options: ["Yes", "No"] },
  { key: "dxaScore", q: "What was the T-score on that scan?", options: [] },
  { key: "dxaYear", q: "What year was that scan performed?", options: [] },
  { key: "menopause", q: "At what age did you reach menopause?", options: [] },
  { key: "fracture", q: "Have you broken a bone since age 50, even from a minor fall or bump?", options: [] },
  { key: "smoke", q: "Do you currently smoke?", options: [] },
  { key: "steroids", q: "Have you ever taken corticosteroids (like prednisone) for 3 months or more?", options: [] },
  { key: "bloodResults", q: "If you have blood-test results, upload an image now, or tap Skip to continue without one.", options: [] },
  { key: "weight", q: "What's your weight and height? BoneBot uses these to calculate your BMI.", options: [] },
  { key: "activity", q: "How active are you day-to-day, with weight-bearing activity like walking, jogging, or strength training? You can also upload a screenshot from your watch or activity app instead.", options: ["Low", "Moderate", "High"] },
  // Appended last and gated on SECONDARY_CONDITION_TRAINED so it is only asked
  // once the model is retrained with the feature. Appending (not inserting)
  // keeps the earlier gate/DXA step indices and FULL_QUESTION_START stable.
  ...(SECONDARY_CONDITION_TRAINED
    ? [
        {
          key: "secondaryCondition" as StepKey,
          q: "Have you been diagnosed with thyroid disease, coeliac disease, or chronic kidney disease?",
          options: ["Yes", "No", "Not sure"],
        },
      ]
    : []),
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
  smoke: "No",
  steroids: "No",
  bloodResults: "Skip",
  weight: "24.5",
  activity: "Moderate",
  secondaryCondition: "No",
};

// Fields the 7-question flow never asks about — hormone therapy, rheumatoid
// arthritis, and high alcohol intake aren't part of this flow, so they still
// use the same illustrative population-average defaults as before (not
// measurements). vitaminD/calcium (blood-result photo) and
// weightBearingActivity (activity chip, or watch/app screenshot) ARE
// user-provided when given — see mapAnswersToFeatures() below.
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

// By this age menopausal status is medically settled, so the eligibility gate
// (the short "have your periods stopped?" triage question) is skipped and she
// is treated as postmenopausal automatically. A one-line change if that
// threshold ever needs revisiting. The separate "what age did you reach
// menopause?" question later in the full questionnaire is unaffected — that's
// a real model input (yearsSinceMenopause), not a gate.
const MENOPAUSE_CERTAIN_AGE = 60;

// Deterministic Low/Moderate/High -> weightBearingActivity (0..1) mapping for
// the quick activity-level chip. Same illustrative-midpoint spirit as
// AGE_MIDPOINT/MENOPAUSE_AGE_MIDPOINT above.
const ACTIVITY_LEVEL_MAP: Record<string, number> = { Low: 0.2, Moderate: 0.5, High: 0.8 };

// Shared cap for both the blood-results and activity-screenshot uploaders —
// enforced client-side (disable adding a 4th) and re-checked server-side in
// each route.
const MAX_IMAGES = 3;

// Free-text questions the user is allowed to skip with a button instead of
// typing. A skipped answer is stored as "Not sure" → the model uses its
// published population-average default and the field is NOT counted as a
// personal driver of the result (see mapAnswersToFeatures / scoreBone).
// Age and the gate/routing questions are required and never appear here.
const SKIPPABLE: Partial<Record<StepKey, true>> = {
  menopause: true,
  fracture: true,
  smoke: true,
  steroids: true,
  bloodResults: true,
  weight: true,
  activity: true,
};

const LOW_RISK_GUIDANCE = [
  "Keep active with weight-bearing and muscle-strengthening activity that feels safe and suitable for you.",
  "Avoid smoking. If you smoke, getting support to stop benefits your overall health as well as your bones.",
  "Keep high alcohol intake low. If your health changes or you have a fracture after a minor fall, speak with a clinician.",
] as const;

// Returns the feature vector plus the subset of feature keys the user actually
// answered. Everything not in `provided` was imputed (skipped, "not sure", or
// never asked in this short flow) and must not be shown as a personal driver of
// the result — see scoreBone().
function mapAnswersToFeatures(
  answers: Record<StepKey, string>,
  bloodResults: UploadedBloodResults | null,
  activityResult: UploadedActivityResult | null,
): { features: BoneFeatures; provided: Array<keyof BoneFeatures> } {
  const parsedAge = Number(answers.age);
  const age = Number.isFinite(parsedAge) ? parsedAge : AGE_MIDPOINT[answers.age] ?? 65;
  const parsedMenopauseAge = Number(answers.menopause);
  const menopauseKnown =
    Number.isFinite(parsedMenopauseAge) ||
    (answers.menopause in MENOPAUSE_AGE_MIDPOINT && answers.menopause !== "Not sure");
  const menopauseAge = Number.isFinite(parsedMenopauseAge)
    ? parsedMenopauseAge
    : MENOPAUSE_AGE_MIDPOINT[answers.menopause] ?? 48;
  const isYesNo = (answer: string) => answer === "Yes" || answer === "No";
  const answerOrDefault = (answer: string, defaultValue: number) =>
    answer === "Yes" ? true : answer === "No" ? false : Boolean(defaultValue);
  const parsedBmi = Number(answers.weight);

  // Weight-bearing activity: a screenshot-derived estimate (already a 0..1
  // value re-validated server-side) takes priority; otherwise the quick
  // Low/Moderate/High chip maps deterministically via ACTIVITY_LEVEL_MAP.
  // Neither given -> fall back to the population-average imputation default,
  // same as every other optional field here.
  const quickActivityValue = ACTIVITY_LEVEL_MAP[answers.activity];
  const activityValue = activityResult?.weightBearingActivity ?? quickActivityValue ?? null;

  const features: BoneFeatures = {
    age,
    yearsSinceMenopause: menopauseKnown
      ? Math.max(0, age - menopauseAge)
      : tScoreModel.imputationDefaults.yearsSinceMenopause,
    priorFragilityFracture: answerOrDefault(answers.fracture, tScoreModel.imputationDefaults.priorFragilityFracture),
    currentSmoker: answerOrDefault(answers.smoke, tScoreModel.imputationDefaults.currentSmoker),
    glucocorticoids: answerOrDefault(answers.steroids, tScoreModel.imputationDefaults.glucocorticoids),
    // BMI computed deterministically from the weight+height step (kg / m^2) —
    // see computeBmi()/submitWeightHeight() below.
    bmi: Number.isFinite(parsedBmi) ? parsedBmi : tScoreModel.imputationDefaults.bmi,
    ...FIELD_DEFAULTS,
    weightBearingActivity: activityValue ?? FIELD_DEFAULTS.weightBearingActivity,
    vitaminD: bloodResults?.vitaminD ?? FIELD_DEFAULTS.vitaminD,
    calcium: bloodResults?.calcium ?? FIELD_DEFAULTS.calcium,
    // Only meaningful once SECONDARY_CONDITION_TRAINED (the question is gated on
    // it); otherwise the coefficient is 0 and this has no effect.
    secondaryCondition: answerOrDefault(answers.secondaryCondition, tScoreModel.imputationDefaults.secondaryCondition),
  };

  const provided: Array<keyof BoneFeatures> = ["age"];
  if (menopauseKnown) provided.push("yearsSinceMenopause");
  if (isYesNo(answers.fracture)) provided.push("priorFragilityFracture");
  if (isYesNo(answers.smoke)) provided.push("currentSmoker");
  if (isYesNo(answers.steroids)) provided.push("glucocorticoids");
  if (Number.isFinite(parsedBmi)) provided.push("bmi");
  if (activityValue !== null) provided.push("weightBearingActivity");
  if (bloodResults?.vitaminD != null) provided.push("vitaminD");
  if (bloodResults?.calcium != null) provided.push("calcium");
  if (SECONDARY_CONDITION_TRAINED && isYesNo(answers.secondaryCondition)) provided.push("secondaryCondition");

  return { features, provided };
}

const CATEGORY_MAP = { lower: "low", uncertain: "moderate", elevated: "elevated" } as const;

const CAT_META = {
  low: {
    label: "Low risk",
    chip: "Keep it that way",
    color: "#0E7C6E",
    bg: "#E4F0ED",
    desc: "Your answers didn't flag major clinical risk factors. Bones still change after menopause, so re-screen yearly and keep up weight-bearing exercise, calcium, and vitamin D.",
  },
  moderate: {
    label: "Moderate risk",
    chip: "Worth a conversation",
    color: "#A06D14",
    bg: "#FBF3DD",
    desc: "Some of your answers match established risk factors for low bone density. This doesn't mean you have osteoporosis; it means a DEXA scan is worth discussing with your GP.",
  },
  elevated: {
    label: "Elevated risk",
    chip: "Ask your GP about a DEXA scan",
    color: "#B0442F",
    bg: "#F9E7E2",
    desc: "Several of your answers match strong clinical risk factors. A screening flag is not a diagnosis, but this profile is exactly what DEXA referral guidelines are designed to catch. Please raise it with your GP.",
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
// three zones line up with the real bands (osteoporosis <= -2.5, osteopenia
// -2.5..-1.0, normal >= -1.0) instead of an arbitrary split. Ascending, left
// to right, like a normal number line: more negative (worse) is further left.
const AXIS_MIN = -4.0;
const AXIS_MAX = 0.5;
function axisPercent(tScore: number): number {
  const clamped = Math.max(AXIS_MIN, Math.min(AXIS_MAX, tScore));
  return Math.round(((clamped - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100);
}
// Named alias for the horizontal meter's left-offset — same axis, read as a position.
const markerPercent = axisPercent;
// Named alias for the age-sensitivity chart's bar height — same axis, read as a magnitude.
const barHeightPercent = axisPercent;

function bandColor(tScore: number): string {
  if (tScore <= -2.5) return "#B0442F"; // elevated
  if (tScore >= -1.0) return "#0E7C6E"; // lower
  return "#A06D14"; // uncertain
}

// Feature 10a — the exact result-context shape sent to /api/assistant
// alongside the profile, so the explainer LLM never has to re-derive the
// deterministic score.
function resultContext(model: ModelOutput) {
  return {
    estimatedTScore: model.estimatedTScore,
    tScoreRange: model.tScoreRange,
    category: model.category,
    contributions: model.contributions,
  };
}

const activityLabel = (level: number) => (level < 0.34 ? "Low" : level < 0.67 ? "Moderate" : "High");

// The actual value BoneBot used for each factor, plus — where docs/
// INPUT_SPEC.md defines one — the reference range, so "+2.3" isn't just an
// abstract number: you can see whether your own value is high, low, or
// typical before you see how it moved the estimate.
function factorDetail(factorLabel: string, f: BoneFeatures): { value: string; reference?: string } {
  switch (factorLabel) {
    case "Age":
      return { value: `${f.age} years` };
    case "Years since menopause":
      return { value: `${f.yearsSinceMenopause} years` };
    case "Hormone therapy":
      return { value: f.onHormoneTherapy ? "Currently on hormone therapy" : "Not on hormone therapy" };
    case "Prior fragility fracture":
      return { value: f.priorFragilityFracture ? "Yes, since age 50" : "None reported" };
    case "Body mass index":
      return { value: `BMI ${f.bmi}`, reference: "normal range 18.5–25" };
    case "Weight-bearing activity":
      return { value: `${activityLabel(f.weightBearingActivity)} activity`, reference: "higher is more protective" };
    case "Current smoker":
      return { value: f.currentSmoker ? "Yes" : "No" };
    case "Glucocorticoid use":
      return { value: f.glucocorticoids ? "Yes, 3+ months" : "None reported" };
    case "Rheumatoid arthritis":
      return { value: f.rheumatoidArthritis ? "Yes" : "No" };
    case "High alcohol intake":
      return { value: f.highAlcohol ? "3+ units/day" : "Below 3 units/day" };
    case "Vitamin D":
      return { value: `${f.vitaminD} nmol/L`, reference: "sufficient 50–125, deficient below 30" };
    case "Serum calcium":
      return { value: `${f.calcium} mmol/L`, reference: "normal range 2.2–2.6" };
    default:
      return { value: "" };
  }
}

// Five reputable, evidence-based patient resources — shown as a brief plus a
// clearly separate link out, never routed through the LLM (no risk of a
// hallucinated URL, no risk of the LLM paraphrasing a source incorrectly).
const RESOURCES = [
  {
    name: "Royal Osteoporosis Society (UK)",
    url: "https://theros.org.uk/information-and-support/",
    brief:
      "The UK's leading bone-health charity. Covers what bone density actually means, how calcium and vitamin D protect bone, safe exercise if you have osteoporosis, and treatment options, plus a nurse-staffed helpline for personal questions.",
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
    name: "NHS: Osteoporosis",
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

// Labels a section as LLM-written (vs. the deterministic model output above
// it) — the same "model predicts, LLM only explains" honesty rule, made
// visible in the UI so it's never ambiguous which parts are which.
function AIWrittenBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-[#EEF2F0] px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-[#5A6462]"
      title="Generated by the LLM from the model's fixed output — it never sets the number"
    >
      <span
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold text-white"
        style={{ backgroundColor: ACCENT }}
        aria-hidden
      >
        AI
      </span>
      AI-written explanation
    </span>
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
  // Feature 1 — extracted-but-unconfirmed values from the blood-result image.
  // Nothing here reaches mapAnswersToFeatures()/scoreBone() until the user
  // hits "Use these" or edits + confirms; "Skip" discards it entirely.
  const [pendingBloodResults, setPendingBloodResults] = useState<UploadedBloodResults | null>(null);
  const [bloodEditMode, setBloodEditMode] = useState(false);
  const [bloodEditVitaminD, setBloodEditVitaminD] = useState("");
  const [bloodEditCalcium, setBloodEditCalcium] = useState("");
  const [bloodEditError, setBloodEditError] = useState("");
  // Up to MAX_IMAGES blood-result photos, added before a single "Analyze"
  // call so a multi-page report is sent to the vision model together.
  const [bloodImageFiles, setBloodImageFiles] = useState<File[]>([]);

  // Wearable/activity-screenshot upload — same confirm-before-use pattern as
  // the blood-result flow above. weightBearingActivity is then user-provided
  // (quick chip or confirmed screenshot estimate) instead of the imputed
  // default; see mapAnswersToFeatures().
  const [activityResult, setActivityResult] = useState<UploadedActivityResult | null>(null);
  const [activityUploadBusy, setActivityUploadBusy] = useState(false);
  const [pendingActivityResult, setPendingActivityResult] = useState<UploadedActivityResult | null>(null);
  const [activityEditMode, setActivityEditMode] = useState(false);
  const [activityImageFiles, setActivityImageFiles] = useState<File[]>([]);
  const [clarificationCounts, setClarificationCounts] = useState<Partial<Record<StepKey, number>>>({});
  const [unresolvedAnswerCount, setUnresolvedAnswerCount] = useState(0);
  const [uncertaintyNotes, setUncertaintyNotes] = useState<string[]>([]);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSendState, setEmailSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [emailSendError, setEmailSendError] = useState("");
  // Feature 2 — busy flag while /api/extract is proposing a candidate value
  // for an otherwise-unparseable free-text answer.
  const [extracting, setExtracting] = useState(false);

  // Feature 7 — dedicated weight+height entry for the "weight" step; BMI is
  // computed deterministically (kg / m^2) and stored as the step's answer.
  const [weightInput, setWeightInput] = useState("");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [heightUnit, setHeightUnit] = useState<"cm" | "ftin">("cm");
  const [heightCmInput, setHeightCmInput] = useState("");
  const [heightFtInput, setHeightFtInput] = useState("");
  const [heightInInput, setHeightInInput] = useState("");
  const [bmiError, setBmiError] = useState("");

  const [qaMessages, setQaMessages] = useState<ChatMessage[]>([]);
  const [qaTyping, setQaTyping] = useState(false);
  const [qaInput, setQaInput] = useState("");

  const chatRef = useRef<HTMLDivElement>(null);
  const qaRef = useRef<HTMLDivElement>(null);
  const emailSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // stepIdx (not just messages/typing) because the chip row now renders
    // inside this scrollable pane, right under the last bot message — it
    // changes the pane's content height without changing messages/typing.
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, typing, stepIdx]);
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
    setPendingBloodResults(null);
    setBloodEditMode(false);
    setBloodEditVitaminD("");
    setBloodEditCalcium("");
    setBloodEditError("");
    setBloodImageFiles([]);
    setActivityResult(null);
    setPendingActivityResult(null);
    setActivityEditMode(false);
    setActivityImageFiles([]);
    setUnresolvedAnswerCount(0);
    setClarificationCounts({});
    setWeightInput("");
    setWeightUnit("kg");
    setHeightUnit("cm");
    setHeightCmInput("");
    setHeightFtInput("");
    setHeightInInput("");
    setBmiError("");
    botSay(
      "Hi, I'm BoneBot. I’ll ask four quick questions to check your bone-health risk. If they suggest a closer look could help, I’ll ask a few more. A validated model works out your result — I only explain what it means. This is a screening check, not a diagnosis."
    );
    window.setTimeout(() => botSay(STEPS[0].q), 1400);
  }

  async function runModel(all: Record<StepKey, string>) {
    const { features: full, provided } = mapAnswersToFeatures(all, bloodResults, activityResult);
    setFeatures(full);
    const model = scoreBone(full, provided);
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
          body: JSON.stringify({
            mode: "consumer",
            result: model,
            features: full,
            explanationType,
            // Feature 10a — full result context + profile, flattened, for the
            // explainer route on the other side of this call.
            ...resultContext(model),
            profile: full,
          }),
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
      void finishAtGate(`Your initial screening estimate is ${triage.probabilityPercent}%. That's a reassuringly low result, so BoneBot doesn't recommend the longer questionnaire today.`, triage);
      return;
    }
    setStepIdx(FULL_QUESTION_START);
    botSay("We’ll continue with the full questionnaire to get a more precise result.");
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

    if (stepIdx === 0) {
      if (opt !== "Yes") {
        void finishAtGate(
          "BoneBot’s screening estimate is built and validated for people assigned female at birth around and after menopause, so it can’t give you a reliable result here. Please talk to a clinician about your bone health.",
        );
        return;
      }
    }

    if (stepIdx === 1) {
      // By MENOPAUSE_CERTAIN_AGE, menopausal status is medically settled —
      // skip the eligibility-gate question and treat her as postmenopausal.
      // The later "what age did you reach menopause?" question (a real model
      // input) still gets asked in the full questionnaire.
      const enteredAge = Number(opt);
      if (Number.isFinite(enteredAge) && enteredAge >= MENOPAUSE_CERTAIN_AGE) {
        setAnswers({ ...nextAnswers, menopauseStatus: "Yes" });
        setStepIdx(3);
        botSay("At your age, I’ll take it that your periods have stopped for good.");
        window.setTimeout(() => botSay(STEPS[3].q), 900);
        return;
      }
    }

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
      // The weight step is now a dedicated weight+height form that computes
      // BMI directly (see submitWeightHeight()); this guards any BMI value
      // that still arrives as free text.
      const value = Number(text.replace(/[^0-9.]/g, ""));
      return Number.isFinite(value) && value >= 12 && value <= 60 ? String(value) : null;
    }
    if (/(not sure|don't know|do not know)/.test(lower)) return "Not sure";
    if (key === "fracture" && /\b(broke|broken|fracture)\b/.test(lower)) return "Yes";
    if (/\b(no|nope|never)\b/.test(lower)) return "No";
    if (/\b(don't|do not|didn't|did not)\b/.test(lower)) return "No";
    if (/\b(yes|yeah|yep|i do|i have)\b/.test(lower)) return "Yes";
    return null;
  }

  // Feature 2 — LLM fallback for an otherwise-unparseable free-text answer.
  // Proposes a single candidate value via /api/extract, then re-validates it
  // through the SAME deterministic normaliseFreeAnswer() before it's ever
  // used. Never bypasses validation; falls through to the existing
  // clarify -> unknown flow on any null/invalid/failed result.
  async function tryExtractCandidate(key: StepKey, question: string, rawText: string): Promise<string | null> {
    setExtracting(true);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fieldKey: key, question, rawText }),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as { value: string | null; confidence: number } | { error: string };
      if ("error" in body || !body.value) return null;
      return normaliseFreeAnswer(key, body.value);
    } catch {
      return null;
    } finally {
      setExtracting(false);
    }
  }

  async function submitFreeInput() {
    const raw = freeInput.trim();
    const step = STEPS[stepIdx];
    if (!raw || !step || flowQuestionBusy || extracting) return;
    const value = normaliseFreeAnswer(step.key, raw);
    if (value && value !== "Not sure" && value !== "Unknown") {
      answer(value, raw);
      return;
    }
    if (step.key === "age" && value === null && /\d/.test(raw)) {
      // A number was given but fell outside BoneBot's supported age range —
      // a graceful, specific re-ask instead of the generic clarify loop.
      setMessages((items) => [
        ...items,
        { role: "user", text: raw },
        {
          role: "bot",
          text: "BoneBot's screening is designed for adults around and after menopause — could you enter your age in years?",
        },
      ]);
      setFreeInput("");
      return;
    }
    const looksLikeQuestion = /\?|^(what|why|how|can|is|are|does|do)\b/i.test(raw);
    if (!looksLikeQuestion) {
      if (value === null) {
        const candidate = await tryExtractCandidate(step.key, step.q, raw);
        if (candidate !== null) {
          answer(candidate, raw);
          return;
        }
      }
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

  function skipStep() {
    const step = STEPS[stepIdx];
    if (typing || flowQuestionBusy || !SKIPPABLE[step.key]) return;
    // "Not sure"/"Skip" both route to the model's published default in
    // mapAnswersToFeatures and leave the field out of the shown drivers.
    answer(step.key === "bloodResults" ? "Skip" : "Not sure", "Skipped this question");
  }

  // Feature 1 — the image extraction only ever PROPOSES vitaminD/calcium.
  // When either is present, hold them in pendingBloodResults and show a
  // confirm/edit/skip step; only a user action calls setBloodResults(), which
  // is what mapAnswersToFeatures()/scoreBone() actually reads. ALP/RBC are
  // context-only (never scored) so they don't need confirmation.
  // Up to MAX_IMAGES photos can be queued before the user taps "Analyze" —
  // added here rather than uploaded immediately so a multi-page report goes
  // to the vision model together (see mergeBloodResults in the route).
  function addBloodImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBloodImageFiles((prev) => {
      const room = MAX_IMAGES - prev.length;
      return room > 0 ? [...prev, ...Array.from(files).slice(0, room)] : prev;
    });
  }

  function removeBloodImage(index: number) {
    setBloodImageFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadBloodResults(images: File[]) {
    if (images.length === 0) return;
    setUploadBusy(true);
    let message: string | null = null;
    let extractedResults: UploadedBloodResults | null = null;
    try {
      const formData = new FormData();
      images.forEach((image) => formData.append("image", image));
      const response = await fetch("/api/blood-results", { method: "POST", body: formData });
      const body = (await response.json()) as UploadedBloodResults | { error: string };
      if (!response.ok || "error" in body) {
        message = "error" in body ? body.error : "BoneBot could not read that image. You can still type your answer.";
      } else if (body.vitaminD === null && body.calcium === null) {
        const extracted = [
          body.alkalinePhosphatase !== null ? `ALP ${body.alkalinePhosphatase} U/L` : null,
          body.redBloodCellCount !== null ? `RBC ${body.redBloodCellCount}` : null,
        ].filter(Boolean);
        message = extracted.length
          ? `I read: ${extracted.join(", ")}. That's shown as context only — no vitamin D or calcium value was found to include in your estimate.`
          : "I could not identify a supported blood-result value in that image. You can still type your answer.";
        setBloodResults(body);
        if (STEPS[stepIdx]?.key === "bloodResults") answer("Uploaded", "Blood-result image uploaded");
      } else {
        extractedResults = body;
      }
    } catch {
      message = "BoneBot could not read that image. You can still type your answer.";
    }
    setUploadBusy(false);
    setBloodImageFiles([]);
    if (extractedResults) {
      setPendingBloodResults(extractedResults);
      setBloodEditMode(false);
      setBloodEditVitaminD(extractedResults.vitaminD !== null ? String(extractedResults.vitaminD) : "");
      setBloodEditCalcium(extractedResults.calcium !== null ? String(extractedResults.calcium) : "");
      setBloodEditError("");
      const contextParts = [
        extractedResults.alkalinePhosphatase !== null ? `ALP ${extractedResults.alkalinePhosphatase} U/L` : null,
        extractedResults.redBloodCellCount !== null ? `RBC ${extractedResults.redBloodCellCount}` : null,
      ].filter(Boolean);
      const readText = [
        extractedResults.vitaminD !== null ? `vitamin D ${extractedResults.vitaminD} nmol/L` : null,
        extractedResults.calcium !== null ? `calcium ${extractedResults.calcium} mmol/L` : null,
      ]
        .filter(Boolean)
        .join(", ");
      setMessages((items) => [
        ...items,
        {
          role: "bot",
          text:
            `I read ${readText}.` +
            (contextParts.length ? ` Also ${contextParts.join(", ")} (context only, not scored).` : "") +
            " Please confirm before I include this in your estimate.",
        },
      ]);
    } else if (message) {
      setMessages((items) => [...items, { role: "bot", text: message }]);
    }
  }

  const VITAMIN_D_RANGE = { min: 10, max: 250 };
  const CALCIUM_RANGE = { min: 1.5, max: 3.5 };

  function useTheseBloodValues() {
    if (!pendingBloodResults) return;
    setBloodResults(pendingBloodResults);
    setPendingBloodResults(null);
    setBloodEditMode(false);
    if (STEPS[stepIdx]?.key === "bloodResults") answer("Uploaded", "Use these values");
  }

  function skipPendingBloodValues() {
    setPendingBloodResults(null);
    setBloodEditMode(false);
    if (STEPS[stepIdx]?.key === "bloodResults") answer("Skip", "Skip");
  }

  function submitEditedBloodValues() {
    const vitDText = bloodEditVitaminD.trim();
    const calciumText = bloodEditCalcium.trim();
    const vitD = vitDText === "" ? null : Number(vitDText);
    const calcium = calciumText === "" ? null : Number(calciumText);
    if (vitD !== null && (!Number.isFinite(vitD) || vitD < VITAMIN_D_RANGE.min || vitD > VITAMIN_D_RANGE.max)) {
      setBloodEditError(`Vitamin D must be between ${VITAMIN_D_RANGE.min} and ${VITAMIN_D_RANGE.max} nmol/L, or left blank.`);
      return;
    }
    if (calcium !== null && (!Number.isFinite(calcium) || calcium < CALCIUM_RANGE.min || calcium > CALCIUM_RANGE.max)) {
      setBloodEditError(`Calcium must be between ${CALCIUM_RANGE.min} and ${CALCIUM_RANGE.max} mmol/L, or left blank.`);
      return;
    }
    setBloodEditError("");
    const edited: UploadedBloodResults = {
      vitaminD: vitD,
      calcium,
      alkalinePhosphatase: pendingBloodResults?.alkalinePhosphatase ?? null,
      redBloodCellCount: pendingBloodResults?.redBloodCellCount ?? null,
    };
    setBloodResults(edited);
    setPendingBloodResults(null);
    setBloodEditMode(false);
    if (STEPS[stepIdx]?.key === "bloodResults") answer("Uploaded", "Edited values confirmed");
  }

  // Wearable/activity screenshot — up to MAX_IMAGES images, same queue-then-
  // analyze pattern as addBloodImages/removeBloodImage above.
  function addActivityImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    setActivityImageFiles((prev) => {
      const room = MAX_IMAGES - prev.length;
      return room > 0 ? [...prev, ...Array.from(files).slice(0, room)] : prev;
    });
  }

  function removeActivityImage(index: number) {
    setActivityImageFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // Mirrors uploadBloodResults(): /api/activity-extract only PROPOSES a
  // weightBearingActivity estimate (derived deterministically from
  // steps/active-minutes on the server, never chosen by the model). It only
  // reaches mapAnswersToFeatures()/scoreBone() once the user confirms.
  async function uploadActivityImages(images: File[]) {
    if (images.length === 0) return;
    setActivityUploadBusy(true);
    let message: string | null = null;
    let extracted: UploadedActivityResult | null = null;
    try {
      const formData = new FormData();
      images.forEach((image) => formData.append("image", image));
      const response = await fetch("/api/activity-extract", { method: "POST", body: formData });
      const body = (await response.json()) as UploadedActivityResult | { error: string };
      if (!response.ok || "error" in body) {
        message =
          "error" in body ? body.error : "BoneBot could not read that image. You can still choose Low, Moderate, or High above.";
      } else if (body.weightBearingActivity === null) {
        message = "I could not identify step or activity-minute data in that image. You can still choose Low, Moderate, or High above.";
      } else {
        extracted = body;
      }
    } catch {
      message = "BoneBot could not read that image. You can still choose Low, Moderate, or High above.";
    }
    setActivityUploadBusy(false);
    setActivityImageFiles([]);
    if (extracted) {
      setPendingActivityResult(extracted);
      setActivityEditMode(false);
      const readParts = [
        extracted.estimatedSteps !== null ? `~${extracted.estimatedSteps.toLocaleString()} steps/day` : null,
        extracted.estimatedActiveMinutes !== null ? `~${extracted.estimatedActiveMinutes} active minutes/day` : null,
      ].filter(Boolean);
      const label = activityLabel(extracted.weightBearingActivity ?? 0.5);
      setMessages((items) => [
        ...items,
        {
          role: "bot",
          text: `I read ${readParts.join(", ") || "your activity screenshot"} → ${label} activity. Please confirm before I include this in your estimate.`,
        },
      ]);
    } else if (message) {
      setMessages((items) => [...items, { role: "bot", text: message }]);
    }
  }

  function useTheseActivityValues() {
    if (!pendingActivityResult) return;
    setActivityResult(pendingActivityResult);
    setPendingActivityResult(null);
    setActivityEditMode(false);
    if (STEPS[stepIdx]?.key === "activity") answer("Uploaded", "Use this activity estimate");
  }

  function skipPendingActivityValues() {
    setPendingActivityResult(null);
    setActivityEditMode(false);
    if (STEPS[stepIdx]?.key === "activity") answer("Not sure", "Skip");
  }

  function submitEditedActivityLevel(level: "Low" | "Moderate" | "High") {
    const edited: UploadedActivityResult = {
      weightBearingActivity: ACTIVITY_LEVEL_MAP[level],
      estimatedSteps: pendingActivityResult?.estimatedSteps ?? null,
      estimatedActiveMinutes: pendingActivityResult?.estimatedActiveMinutes ?? null,
    };
    setActivityResult(edited);
    setPendingActivityResult(null);
    setActivityEditMode(false);
    if (STEPS[stepIdx]?.key === "activity") answer("Uploaded", `Edited to ${level} activity`);
  }

  const BMI_RANGE = { min: 12, max: 60 };

  // Feature 7 — BMI computed deterministically from weight + height
  // (kg / m^2). Accepts kg or lb for weight, and cm or ft/in for height.
  function computeBmi(): number | null {
    const weightNum = Number(weightInput);
    if (!Number.isFinite(weightNum) || weightNum <= 0) return null;
    const weightKg = weightUnit === "kg" ? weightNum : weightNum * 0.453592;

    let heightM: number | null = null;
    if (heightUnit === "cm") {
      const cm = Number(heightCmInput);
      if (Number.isFinite(cm) && cm > 0) heightM = cm / 100;
    } else {
      const feet = heightFtInput.trim() === "" ? 0 : Number(heightFtInput);
      const inches = heightInInput.trim() === "" ? 0 : Number(heightInInput);
      if (Number.isFinite(feet) && Number.isFinite(inches) && feet + inches > 0) {
        heightM = (feet * 12 + inches) * 0.0254;
      }
    }
    if (heightM === null || heightM <= 0) return null;
    return weightKg / (heightM * heightM);
  }

  function submitWeightHeight() {
    const bmi = computeBmi();
    if (bmi === null) {
      setBmiError("Please enter both your weight and height.");
      return;
    }
    if (bmi < BMI_RANGE.min || bmi > BMI_RANGE.max) {
      setBmiError(
        `That doesn't look like a valid BMI (expected ${BMI_RANGE.min}–${BMI_RANGE.max}) — please check your weight and height.`,
      );
      return;
    }
    setBmiError("");
    const heightDisplay = heightUnit === "cm" ? `${heightCmInput} cm` : `${heightFtInput || 0} ft ${heightInInput || 0} in`;
    answer(bmi.toFixed(1), `${weightInput} ${weightUnit}, ${heightDisplay} (BMI ${bmi.toFixed(1)})`);
  }

  function tryExample() {
    runModel(EXAMPLE_ANSWERS);
  }

  function buildResultEmail(): { subject: string; text: string } {
    const lines = result
      ? [
          `BoneBot screening result: ${catMeta.label}`,
          "",
          `Estimated T-score: ${result.estimatedTScore} (likely ${result.tScoreRange[0]} to ${result.tScoreRange[1]})`,
          `Category: ${catMeta.label} (${T_SCORE_BANDS[{ low: 0, moderate: 1, elevated: 2 }[cat]].range})`,
          "",
          "What drove this result:",
          ...result.contributions.slice(0, 5).map((f) => {
            const detail = features ? factorDetail(f.factor, features) : { value: "" };
            const valueNote = detail.value ? ` (${detail.value})` : "";
            return `  ${f.contribution > 0 ? "+" : ""}${f.contribution.toFixed(1)}  ${f.factor}${valueNote}`;
          }),
          "",
          "This is a screening estimate from a model trained on NHANES data, not a diagnosis or a bone-density measurement. A DXA scan gives the real T-score, so please discuss this result with your GP or clinician.",
          "",
          "BoneBot, Hack-Nation 6th Global AI Hackathon",
        ]
      : [];
    return {
      subject: `My BoneBot bone-health screening result: ${catMeta.label}`,
      text: lines.join("\n"),
    };
  }

  async function sendResultEmail() {
    if (!emailAddress.trim() || emailSendState === "sending") return;
    setEmailSendState("sending");
    setEmailSendError("");
    try {
      const { subject, text } = buildResultEmail();
      const r = await fetch("/api/send-result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: emailAddress.trim(), subject, text }),
      });
      if (r.ok) {
        setEmailSendState("sent");
      } else {
        setEmailSendError(await r.text());
        setEmailSendState("error");
      }
    } catch {
      setEmailSendError("Couldn't send that email right now.");
      setEmailSendState("error");
    }
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
    setPendingBloodResults(null);
    setBloodEditMode(false);
    setBloodEditVitaminD("");
    setBloodEditCalcium("");
    setBloodEditError("");
    setBloodImageFiles([]);
    setActivityResult(null);
    setPendingActivityResult(null);
    setActivityEditMode(false);
    setActivityImageFiles([]);
    setUnresolvedAnswerCount(0);
    setClarificationCounts({});
    setUncertaintyNotes([]);
    setWeightInput("");
    setWeightUnit("kg");
    setHeightUnit("cm");
    setHeightCmInput("");
    setHeightFtInput("");
    setHeightInInput("");
    setBmiError("");
    setEmailAddress("");
    setEmailSendState("idle");
    setEmailSendError("");
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
        body: JSON.stringify({
          mode: "consumer",
          question: q,
          stage: "results",
          result: resultContext(result),
          profile: features,
        }),
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
  const rangeLeftPct = result ? markerPercent(result.tScoreRange[0]) : 50;
  const rangeRightPct = result ? markerPercent(result.tScoreRange[1]) : 50;

  return (
    <div
      className="flex h-full flex-col bg-[#F5F7F6] text-[#15181A] font-[family-name:var(--font-body)]"
      style={{ ["--bw-accent" as string]: ACCENT }}
    >
      <style>{`@keyframes bw-blink { 0%,80%,100% { opacity: .25; } 40% { opacity: 1; } }`}</style>

      {screen === "landing" && (
        <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#F7F6F2] via-[#F5F7F5] to-[#F2F5F4]">
          <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-12">
            <div className="font-[family-name:var(--font-heading)] text-[22px] font-bold tracking-[-0.02em]">
              Bone<span style={{ color: ACCENT }}>Bot</span>
            </div>
            <div className="rounded-full border border-[#D5DCDA] bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#5A6462] backdrop-blur-sm">
              Hack-Nation · Challenge 05
            </div>
          </header>
          <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-8 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#CDE0DB] bg-white/70 px-4 py-1.5 text-[12.5px] font-semibold uppercase tracking-[0.13em] backdrop-blur-sm" style={{ color: ACCENT }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
              Bone-health screening for postmenopausal women
            </div>
            <h1 className="max-w-[880px] text-balance font-[family-name:var(--font-heading)] text-[2.85rem] font-bold leading-[1.02] tracking-[-0.035em] text-[#12211E] sm:text-6xl lg:text-[4.6rem]">
              Know your bone risk
              <br className="hidden sm:block" /> before it{" "}
              <span className="relative whitespace-nowrap" style={{ color: FRACTURE }}>
                breaks
                <span
                  aria-hidden
                  className="absolute inset-x-0 -bottom-1 h-[3px] rounded-full"
                  style={{ backgroundColor: FRACTURE, opacity: 0.35 }}
                />
              </span>{" "}
              something.
            </h1>
            <p className="mt-7 max-w-[600px] text-pretty text-lg leading-[1.6] text-[#41504C] sm:text-[19px]">
              A 3-minute conversational screening. The risk model is trained on NHANES population data. The AI
              explains your result; it never decides it.
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
            <div className="mt-16 grid max-w-[920px] grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { stat: "1 in 2", body: "women over 50 will fracture a bone due to osteoporosis." },
                { stat: "NHANES", body: "The prediction comes from a model trained on national health survey data, not from a chatbot." },
                { stat: "Adaptive", body: "Four quick screening questions, then more detail only when needed. No account or forms." },
              ].map((c) => (
                <div
                  key={c.stat}
                  className="rounded-[16px] border border-[#E1EAE7] bg-white/85 px-6 py-6 text-left shadow-[0_1px_2px_rgba(16,60,54,0.04)] backdrop-blur-sm"
                >
                  <div className="font-[family-name:var(--font-heading)] text-[30px] font-bold leading-none tracking-[-0.02em]" style={{ color: ACCENT }}>
                    {c.stat}
                  </div>
                  <div className="mt-2.5 text-sm leading-[1.5] text-[#41504C]">{c.body}</div>
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
              Screening flag, not a diagnosis
            </div>
            <button
              onClick={() => {
                if (messages.length <= 1 || window.confirm("Start over? This clears your answers so far.")) restart();
              }}
              className="rounded-lg border-[1.5px] border-[#C6CFCC] px-3.5 py-[7px] text-[13px] font-semibold text-[#4A5452] hover:border-[#0E7C6E] hover:text-[#0E7C6E]"
            >
              Start over
            </button>
          </header>
          <div ref={chatRef} className="flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto flex max-w-[680px] flex-col gap-3.5">
              {messages.map((m, i) =>
                m.role === "bot" ? <BotBubble key={i} text={m.text} /> : <UserBubble key={i} text={m.text} />
              )}
              {typing && <TypingDots />}
              {inFlow && step.options.length > 0 && !(step.key === "activity" && pendingActivityResult) && (
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
            </div>
          </div>
          <div className="border-t border-[#E3E9E7] bg-white px-6 py-5">
            <div className="mx-auto flex max-w-[680px] flex-col gap-3">

              {inFlow && step.key === "bloodResults" && pendingBloodResults && !bloodEditMode && (
                <div className="flex flex-col gap-3 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white px-4 py-3.5">
                  <div className="text-sm font-semibold text-[#15181A]">Confirm blood values</div>
                  <div className="text-sm leading-[1.5] text-[#4A5452]">
                    {pendingBloodResults.vitaminD !== null && `Vitamin D: ${pendingBloodResults.vitaminD} nmol/L. `}
                    {pendingBloodResults.calcium !== null && `Calcium: ${pendingBloodResults.calcium} mmol/L. `}
                    Only these two are used in your estimate.
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={useTheseBloodValues}
                      className="rounded-full px-5 py-2.5 text-[15px] font-medium text-white transition-colors"
                      style={{ backgroundColor: ACCENT }}
                    >
                      Use these
                    </button>
                    <button
                      onClick={() => setBloodEditMode(true)}
                      className="rounded-full border-[1.5px] px-5 py-2.5 text-[15px] font-medium transition-colors"
                      style={{ borderColor: ACCENT, color: ACCENT }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={skipPendingBloodValues}
                      className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E7C6E] hover:text-[#0E7C6E]"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}

              {inFlow && step.key === "bloodResults" && pendingBloodResults && bloodEditMode && (
                <div className="flex flex-col gap-3 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white px-4 py-3.5">
                  <div className="text-sm font-semibold text-[#15181A]">Edit blood values</div>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex flex-col gap-1 text-xs font-medium text-[#5A6462]">
                      Vitamin D (nmol/L)
                      <input
                        type="number"
                        inputMode="decimal"
                        value={bloodEditVitaminD}
                        onChange={(event) => setBloodEditVitaminD(event.target.value)}
                        placeholder="e.g. 55"
                        className="w-32 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E7C6E]"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-[#5A6462]">
                      Calcium (mmol/L)
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={bloodEditCalcium}
                        onChange={(event) => setBloodEditCalcium(event.target.value)}
                        placeholder="e.g. 2.3"
                        className="w-32 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E7C6E]"
                      />
                    </label>
                  </div>
                  {bloodEditError && <div className="text-[13px] text-[#B0442F]">{bloodEditError}</div>}
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={submitEditedBloodValues}
                      className="rounded-full px-5 py-2.5 text-[15px] font-medium text-white transition-colors"
                      style={{ backgroundColor: ACCENT }}
                    >
                      Save & continue
                    </button>
                    <button
                      onClick={() => setBloodEditMode(false)}
                      className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E7C6E] hover:text-[#0E7C6E]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={skipPendingBloodValues}
                      className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E7C6E] hover:text-[#0E7C6E]"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}

              {inFlow && step.key === "weight" && (
                <div className="flex flex-col gap-3 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white px-4 py-3.5">
                  <div className="text-sm font-semibold text-[#15181A]">Weight & height</div>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex flex-col gap-1 text-xs font-medium text-[#5A6462]">
                      Weight
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={weightInput}
                          onChange={(event) => setWeightInput(event.target.value)}
                          placeholder="e.g. 65"
                          className="w-24 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E7C6E]"
                        />
                        <select
                          value={weightUnit}
                          onChange={(event) => setWeightUnit(event.target.value as "kg" | "lb")}
                          className="rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#0E7C6E]"
                        >
                          <option value="kg">kg</option>
                          <option value="lb">lb</option>
                        </select>
                      </div>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-[#5A6462]">
                      Height
                      <div className="flex items-center gap-1.5">
                        {heightUnit === "cm" ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            value={heightCmInput}
                            onChange={(event) => setHeightCmInput(event.target.value)}
                            placeholder="e.g. 162"
                            className="w-24 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E7C6E]"
                          />
                        ) : (
                          <>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={heightFtInput}
                              onChange={(event) => setHeightFtInput(event.target.value)}
                              placeholder="ft"
                              className="w-16 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E7C6E]"
                            />
                            <input
                              type="number"
                              inputMode="decimal"
                              value={heightInInput}
                              onChange={(event) => setHeightInInput(event.target.value)}
                              placeholder="in"
                              className="w-16 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E7C6E]"
                            />
                          </>
                        )}
                        <select
                          value={heightUnit}
                          onChange={(event) => setHeightUnit(event.target.value as "cm" | "ftin")}
                          className="rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#0E7C6E]"
                        >
                          <option value="cm">cm</option>
                          <option value="ftin">ft / in</option>
                        </select>
                      </div>
                    </label>
                  </div>
                  {bmiError && <div className="text-[13px] text-[#B0442F]">{bmiError}</div>}
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={submitWeightHeight}
                      className="rounded-full px-5 py-2.5 text-[15px] font-medium text-white transition-colors"
                      style={{ backgroundColor: ACCENT }}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {inFlow && step.key === "activity" && pendingActivityResult && !activityEditMode && (
                <div className="flex flex-col gap-3 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white px-4 py-3.5">
                  <div className="text-sm font-semibold text-[#15181A]">Confirm activity estimate</div>
                  <div className="text-sm leading-[1.5] text-[#4A5452]">
                    {pendingActivityResult.estimatedSteps !== null &&
                      `~${pendingActivityResult.estimatedSteps.toLocaleString()} steps/day. `}
                    {pendingActivityResult.estimatedActiveMinutes !== null &&
                      `~${pendingActivityResult.estimatedActiveMinutes} active minutes/day. `}
                    That reads as {activityLabel(pendingActivityResult.weightBearingActivity ?? 0.5)} activity.
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={useTheseActivityValues}
                      className="rounded-full px-5 py-2.5 text-[15px] font-medium text-white transition-colors"
                      style={{ backgroundColor: ACCENT }}
                    >
                      Use this
                    </button>
                    <button
                      onClick={() => setActivityEditMode(true)}
                      className="rounded-full border-[1.5px] px-5 py-2.5 text-[15px] font-medium transition-colors"
                      style={{ borderColor: ACCENT, color: ACCENT }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={skipPendingActivityValues}
                      className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E7C6E] hover:text-[#0E7C6E]"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}

              {inFlow && step.key === "activity" && pendingActivityResult && activityEditMode && (
                <div className="flex flex-col gap-3 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white px-4 py-3.5">
                  <div className="text-sm font-semibold text-[#15181A]">Choose the level that fits best</div>
                  <div className="flex flex-wrap gap-2.5">
                    {(["Low", "Moderate", "High"] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => submitEditedActivityLevel(level)}
                        className="rounded-full border-[1.5px] px-5 py-2.5 text-[15px] font-medium transition-colors"
                        style={{ borderColor: ACCENT, color: ACCENT }}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setActivityEditMode(false)}
                    className="self-start rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E7C6E] hover:text-[#0E7C6E]"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {inFlow && step.key === "activity" && !pendingActivityResult && (
                <div className="flex flex-col gap-2.5">
                  {activityImageFiles.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {activityImageFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center gap-1.5 rounded-[10px] border border-[#D5DCDA] bg-white px-2 py-1.5 text-xs"
                        >
                          <img src={URL.createObjectURL(file)} alt="" className="h-7 w-7 rounded-[6px] object-cover" />
                          <span className="max-w-[90px] truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeActivityImage(index)}
                            className="text-[#9AA5A2] hover:text-[#B0442F]"
                            aria-label={`Remove ${file.name}`}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-[12px] border-[1.5px] border-dashed border-[#C6CFCC] bg-[#F5F7F6] px-4 py-3 text-sm transition-colors hover:border-[#0E7C6E] hover:bg-[#E4F0ED]"
                    aria-disabled={activityUploadBusy || activityImageFiles.length >= MAX_IMAGES}
                  >
                    <span
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-base"
                      style={{ backgroundColor: ACCENT_TINT, color: ACCENT }}
                      aria-hidden
                    >
                      ⌚
                    </span>
                    <span className="flex flex-col">
                      <span className="font-semibold text-[#15181A]">
                        {activityImageFiles.length >= MAX_IMAGES
                          ? "Maximum 3 photos added"
                          : "Attach a watch / activity-app screenshot"}
                      </span>
                      <span className="text-[13px] text-[#5A6462]">
                        Up to {MAX_IMAGES} images · {activityImageFiles.length}/{MAX_IMAGES} added
                      </span>
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="sr-only"
                      disabled={activityUploadBusy || activityImageFiles.length >= MAX_IMAGES}
                      onChange={(event) => {
                        addActivityImages(event.target.files);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {activityImageFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void uploadActivityImages(activityImageFiles)}
                        disabled={activityUploadBusy}
                        className="rounded-full px-5 py-2.5 text-[15px] font-medium text-white transition-colors disabled:opacity-50"
                        style={{ backgroundColor: ACCENT }}
                      >
                        {activityUploadBusy
                          ? "Reading your photo(s)…"
                          : `Analyze ${activityImageFiles.length} photo${activityImageFiles.length > 1 ? "s" : ""}`}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={skipStep}
                      disabled={activityUploadBusy}
                      className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E7C6E] hover:text-[#0E7C6E] disabled:opacity-50"
                    >
                      Skip — I&apos;d rather not say
                    </button>
                  </div>
                </div>
              )}

              {inFlow && !pendingBloodResults && step.key !== "weight" && step.key !== "activity" && (
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
                      placeholder={
                        step.options.length > 0
                          ? "Or type your answer here…"
                          : "Type your answer, or ask a bone-health question"
                      }
                      aria-label="Answer or ask a bone-health question"
                      disabled={flowQuestionBusy || extracting}
                      className="flex-1 border-0 bg-transparent px-2.5 py-2 text-sm outline-none disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={flowQuestionBusy || extracting || !freeInput.trim()}
                      className="rounded-[9px] px-4.5 py-2.5 font-[family-name:var(--font-heading)] text-sm font-bold text-white disabled:opacity-40"
                      style={{ backgroundColor: ACCENT }}
                    >
                      Send
                    </button>
                  </form>

                  {SKIPPABLE[step.key] && step.key !== "bloodResults" && (
                    <button
                      type="button"
                      onClick={skipStep}
                      disabled={flowQuestionBusy}
                      className="self-end text-[13px] font-semibold text-[#5A6462] underline underline-offset-2 hover:text-[#0E7C6E] disabled:opacity-40"
                    >
                      Skip this question
                    </button>
                  )}

                  {step.key === "bloodResults" && (
                    <div className="flex flex-col gap-2.5">
                      {bloodImageFiles.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          {bloodImageFiles.map((file, index) => (
                            <div
                              key={`${file.name}-${index}`}
                              className="flex items-center gap-1.5 rounded-[10px] border border-[#D5DCDA] bg-white px-2 py-1.5 text-xs"
                            >
                              <img src={URL.createObjectURL(file)} alt="" className="h-7 w-7 rounded-[6px] object-cover" />
                              <span className="max-w-[90px] truncate">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => removeBloodImage(index)}
                                className="text-[#9AA5A2] hover:text-[#B0442F]"
                                aria-label={`Remove ${file.name}`}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <label
                        className="flex cursor-pointer items-center gap-3 rounded-[12px] border-[1.5px] border-dashed border-[#C6CFCC] bg-[#F5F7F6] px-4 py-3 text-sm transition-colors hover:border-[#0E7C6E] hover:bg-[#E4F0ED]"
                        aria-disabled={uploadBusy || bloodImageFiles.length >= MAX_IMAGES}
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
                            {bloodImageFiles.length >= MAX_IMAGES ? "Maximum 3 photos added" : "Attach a photo instead"}
                          </span>
                          <span className="text-[13px] text-[#5A6462]">
                            A blood-test result or lab report. Up to {MAX_IMAGES} images · {bloodImageFiles.length}/{MAX_IMAGES}{" "}
                            added.
                          </span>
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="sr-only"
                          disabled={uploadBusy || bloodImageFiles.length >= MAX_IMAGES}
                          onChange={(event) => {
                            addBloodImages(event.target.files);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <div className="flex flex-wrap gap-2.5">
                        {bloodImageFiles.length > 0 && (
                          <button
                            type="button"
                            onClick={() => void uploadBloodResults(bloodImageFiles)}
                            disabled={uploadBusy}
                            className="rounded-full px-5 py-2.5 text-[15px] font-medium text-white transition-colors disabled:opacity-50"
                            style={{ backgroundColor: ACCENT }}
                          >
                            {uploadBusy
                              ? "Reading your photo(s)…"
                              : `Analyze ${bloodImageFiles.length} photo${bloodImageFiles.length > 1 ? "s" : ""}`}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => answer("Skip", "Skip")}
                          disabled={uploadBusy}
                          className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E7C6E] hover:text-[#0E7C6E] disabled:opacity-50"
                        >
                          Skip — I don&apos;t have blood-test results
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {flowQuestionBusy && <p className="text-right text-sm text-[#5A6462]">Checking the approved evidence…</p>}
              {extracting && <p className="text-right text-sm text-[#5A6462]">Reading your answer…</p>}
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
              Screening flag, not a diagnosis
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
              Screening flag, not a diagnosis
            </div>
            <button
              onClick={() => emailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="hidden items-center gap-1.5 rounded-lg border-[1.5px] border-[#C6CFCC] px-3.5 py-[7px] text-[13px] font-semibold text-[#4A5452] hover:border-[#0E7C6E] hover:text-[#0E7C6E] sm:flex"
            >
              <span aria-hidden>✉️</span> Email this result
            </button>
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
                    ⚠️ Illustrative: coefficients not yet trained on NHANES. Do not present these numbers as real.
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
                    <div className="mt-8 mb-2">
                      <div className="relative">
                        <div className="flex h-3.5 overflow-hidden rounded-full">
                          <div className="w-1/3" style={{ backgroundColor: "#EFC3B8" }} />
                          <div className="w-1/3" style={{ backgroundColor: "#F0DFAE" }} />
                          <div className="w-1/3" style={{ backgroundColor: "#BFDDD3" }} />
                        </div>
                        {/* Uncertainty range — the box, not just the point estimate */}
                        <div
                          className="absolute top-0 h-3.5 rounded-full border-2 border-dashed border-[#4A5452]"
                          style={{
                            left: `${rangeLeftPct}%`,
                            width: `${Math.max(3, rangeRightPct - rangeLeftPct)}%`,
                          }}
                        />
                        <div
                          className="absolute -top-[26px] -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                          style={{ backgroundColor: "#15181A", left: `${marker}%` }}
                        >
                          you
                        </div>
                        <div
                          className="absolute top-0 h-3.5 w-[3px] -translate-x-1/2 rounded-sm bg-[#15181A]"
                          style={{ left: `${marker}%` }}
                        />
                      </div>
                      <div className="mt-3.5 flex justify-between gap-2 text-xs font-semibold">
                        {[...T_SCORE_BANDS].reverse().map((b) => (
                          <span key={b.label}>
                            <span style={{ color: b.color }}>{b.label.replace(" (low bone mass)", "")}</span>{" "}
                            <span className="font-normal text-[#9AA5A2]">{b.range}</span>
                          </span>
                        ))}
                      </div>
                      <p className="mt-4 text-sm leading-[1.6] text-[#4A5452]">
                        The dashed box is the uncertainty range — your true score most likely sits inside it. A
                        T-score compares your bone density to a healthy young adult: 0 is average, and lower (more
                        negative) means less dense bone.
                      </p>
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
                  <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                    What drove this result
                  </div>
                  <div className="mb-3 flex items-center justify-between text-[12px] font-semibold">
                    <span style={{ color: "#B0442F" }}>← Pulls your estimate down</span>
                    <span style={{ color: ACCENT }}>Supports your bones →</span>
                  </div>
                  <div className="flex flex-col gap-3.5">
                    {(() => {
                      const maxAbs = Math.max(...result.contributions.map((f) => Math.abs(f.contribution)), 0.1);
                      return result.contributions.map((f) => {
                        const isPositive = f.direction === "raises";
                        const halfWidthPct = Math.max(3, Math.round((Math.abs(f.contribution) / maxAbs) * 50));
                        const detail = features ? factorDetail(f.factor, features) : { value: "" };
                        return (
                          <div key={f.factor} className="flex items-center gap-3">
                            <div className="w-[110px] flex-shrink-0 sm:w-[150px]">
                              <div className="truncate text-[13px] text-[#15181A]" title={f.factor}>
                                {f.factor}
                              </div>
                              {detail.value && (
                                <div className="truncate text-[11px] text-[#9AA5A2]" title={detail.value}>
                                  {detail.value}
                                </div>
                              )}
                            </div>
                            <div className="relative h-2.5 flex-1 overflow-visible rounded-full bg-[#F0F2F1]">
                              <div className="absolute inset-y-0 left-1/2 w-px bg-[#D5DCDA]" />
                              <div
                                className="absolute top-0 h-full rounded-full"
                                style={
                                  isPositive
                                    ? { left: "50%", width: `${halfWidthPct}%`, backgroundColor: ACCENT }
                                    : { right: "50%", width: `${halfWidthPct}%`, backgroundColor: "#B0442F" }
                                }
                              />
                            </div>
                            <div
                              className="w-10 flex-shrink-0 text-right font-[family-name:var(--font-heading)] text-[13px] font-bold"
                              style={{ color: isPositive ? ACCENT : "#B0442F" }}
                            >
                              {f.contribution > 0 ? "+" : ""}
                              {f.contribution.toFixed(1)}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="mt-5 text-[13px] leading-[1.5] text-[#5A6462]">
                    Bars show how much each answer moved your estimated T-score. Only factors that measurably
                    moved it are listed — anything you skipped uses a population average and isn&apos;t shown here.
                    Weights follow NHANES-derived clinical risk factors.
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]"
                    >
                      Understanding your estimated T-score
                    </span>
                    <AIWrittenBadge />
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-[15px] leading-[1.65] text-[#4A5452]">{scoreExplanation}</p>
                </div>

                <div className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                      What this means for you
                    </span>
                    <AIWrittenBadge />
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

                {activityResult && (
                  <div className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                    <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">Activity input</div>
                    <p className="mt-3 text-sm leading-[1.6] text-[#4A5452]">
                      {activityResult.estimatedSteps !== null && `~${activityResult.estimatedSteps.toLocaleString()} steps/day. `}
                      {activityResult.estimatedActiveMinutes !== null &&
                        `~${activityResult.estimatedActiveMinutes} active minutes/day. `}
                      Used as {activityLabel(activityResult.weightBearingActivity ?? 0.5)} activity in your estimate.
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
                      Same profile, run through the model at each age bracket, with everything else held fixed. Your
                      answer is highlighted.
                    </p>
                    <div className="mt-6 flex h-[150px] items-end gap-1.5 sm:gap-2.5">
                      {AGE_BRACKETS.map((bracket) => {
                        const projected = scoreBone({ ...features, age: AGE_MIDPOINT[bracket] });
                        const isYours = AGE_MIDPOINT[bracket] === features.age;
                        return (
                          <div key={bracket} className="flex flex-1 flex-col items-center gap-1.5">
                            <div
                              className="text-[11px] font-semibold"
                              style={{ color: isYours ? ACCENT : "#5A6462" }}
                            >
                              {projected.estimatedTScore}
                            </div>
                            <div className="flex h-[100px] w-full items-end">
                              <div
                                className="w-full rounded-t-[4px] transition-[height]"
                                style={{
                                  height: `${Math.max(6, barHeightPercent(projected.estimatedTScore))}%`,
                                  backgroundColor: isYours ? ACCENT : bandColor(projected.estimatedTScore) + "70",
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

                <div ref={emailSectionRef} className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-6 sm:px-8">
                  <div className="font-[family-name:var(--font-heading)] text-base font-bold text-[#15181A]">
                    Keep a copy of this result
                  </div>
                  <div className="mt-0.5 text-[13px] text-[#5A6462]">
                    We&apos;ll email it to you. Bring it to your GP appointment.
                  </div>

                  {emailSendState === "sent" ? (
                    <p className="mt-4 flex items-center gap-2 text-sm font-semibold" style={{ color: ACCENT }}>
                      <span aria-hidden>✓</span> Sent to {emailAddress}.
                    </p>
                  ) : (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void sendResultEmail();
                      }}
                      className="mt-4 flex flex-col gap-2 sm:flex-row"
                    >
                      <input
                        type="email"
                        required
                        value={emailAddress}
                        onChange={(event) => {
                          setEmailAddress(event.target.value);
                          if (emailSendState === "error") setEmailSendState("idle");
                        }}
                        placeholder="you@example.com"
                        aria-label="Your email address"
                        disabled={emailSendState === "sending"}
                        className="flex-1 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0E7C6E] disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={emailSendState === "sending" || !emailAddress.trim()}
                        className="flex items-center justify-center gap-2 whitespace-nowrap rounded-[9px] px-5 py-2.5 font-[family-name:var(--font-heading)] text-sm font-bold text-white disabled:opacity-50"
                        style={{ backgroundColor: ACCENT }}
                      >
                        <span aria-hidden>✉️</span> {emailSendState === "sending" ? "Sending…" : "Email this result"}
                      </button>
                    </form>
                  )}
                  {emailSendState === "error" && (
                    <p className="mt-2 text-sm text-[#B0442F]">{emailSendError || "Couldn't send that email right now."}</p>
                  )}
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
                  <div className="mt-0.5 text-[13px] text-[#5A6462]">The AI explains; it never changes your score.</div>
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
          BoneBot is a screening flag, not a diagnosis. It does not provide medical advice. Discuss results with
          your clinician.
        </div>
        <div className="whitespace-nowrap text-[12.5px] text-[#9AA5A2]">Hack-Nation 6th Global AI Hackathon · 2026</div>
      </footer>
    </div>
  );
}
