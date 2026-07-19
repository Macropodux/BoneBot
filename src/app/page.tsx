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
// The short conversational flow doesn't cover all BoneFeatures fields. Blood-test
// values (vitaminD, calcium) and activity (weightBearingActivity) are
// user-provided via photo upload or numeric answers when given; the remaining
// history fields this short flow never asks (hormone therapy, rheumatoid
// arthritis, alcohol) still use the same illustrative-defaults pattern as
// before; see mapAnswersToFeatures() below — flagged there for a clinical
// sanity-check, not a measurement.

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  AnimatePresence,
  MotionConfig,
  useReducedMotion,
  animate,
  type Variants,
} from "framer-motion";
import { resolveAmbiguousAnswer } from "@/lib/ambiguity";
import {
  ACTIVITY_QUESTIONS,
  activityLevelFromDailyAverages,
  parseDailyActivity,
} from "@/lib/activity-input";
import { scoreBone, type BoneFeatures, type ModelOutput } from "@/lib/bone-model";
import { scoreTriage, type TriageOutput } from "@/lib/triage-model";
import { tScoreModel, SECONDARY_CONDITION_TRAINED } from "../../model/model-parameters";
import FloatingBones from "./FloatingBones";
import { THEME, HEADING_FONT, BODY_FONT } from "@/lib/editorial-theme";

// "Vital Bloom" brand — Emre, 2026-07-19: magenta/violet rebrand. Being
// phased out in favor of the editorial theme (THEME.accent) below as chat
// and results get redesigned to match landing; kept until that's complete.
const ACCENT = "#0E6E62";
const ACCENT_TINT = "#E4F0ED";

// Editorial redesign palette — see src/lib/editorial-theme.ts.
const LANDING_BG = THEME.bg;
const LANDING_BAND_BG = THEME.bandBg;
const LANDING_BORDER = THEME.border;
const LANDING_BORDER_INPUT = THEME.borderInput;
const LANDING_BORDER_SECONDARY = THEME.borderSecondary;
const LANDING_INK = THEME.ink;
const LANDING_BODY = THEME.body;
const LANDING_MUTED = THEME.muted;
const LANDING_ORNAMENT = THEME.ornament;
const LANDING_ACCENT = THEME.accent;
const LANDING_ACCENT_HOVER = THEME.accentHover;
const LANDING_DISCLAIMER_BG = THEME.disclaimerBg;
const LANDING_DISCLAIMER_SUB = THEME.disclaimerSub;
const LANDING_HEADING_FONT = HEADING_FONT;
const LANDING_BODY_FONT = BODY_FONT;

const LANDING_WHY_TRUST_IT = [
  { num: "01", title: "Often silent", body: "Bone loss may cause no symptoms until a fracture occurs." },
  { num: "02", title: "Model-led", body: "A model trained on NHANES data produces the estimate. AI only explains it." },
  { num: "03", title: "Adaptive", body: "Only 4 initial questions, with follow-ups only when a closer look may help. No account needed." },
] as const;

type StepKey = "assignedFemale" | "age" | "menopauseStatus" | "existingCare" | "knowsDxa" | "dxaScore" | "dxaYear" | "menopause" | "fracture" | "smoke" | "steroids" | "bloodResults" | "weight" | "averageDailySteps" | "averageDailyActiveMinutes" | "secondaryCondition";

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
  { key: "age", q: "How old are you?", options: [] },
  { key: "menopauseStatus", q: "Have your periods stopped for good?", options: ["Yes", "No", "Not sure"] },
  { key: "existingCare", q: "Have you been diagnosed with osteoporosis, had a DXA bone-density scan, or taken medicine for your bones?", options: ["Yes", "No"] },
  { key: "knowsDxa", q: "Do you know the T-score from your most recent DXA bone-density scan?", options: ["Yes", "No"] },
  { key: "dxaScore", q: "What was the T-score on that scan?", options: [] },
  { key: "dxaYear", q: "What year was that scan performed?", options: [] },
  { key: "menopause", q: "At what age did you reach menopause?", options: [] },
  { key: "fracture", q: "Since age 50, have you broken a bone after a minor fall, bump, or similar low-impact injury?", options: [] },
  { key: "smoke", q: "Do you currently smoke?", options: [] },
  { key: "steroids", q: "Have you taken corticosteroid tablets, such as prednisolone or prednisone, for three months or longer?", options: [] },
  { key: "bloodResults", q: "If you have recent blood-test results, upload clear images now. Otherwise, choose Skip.", options: [] },
  { key: "weight", q: "What are your weight and height? BoneBot uses them to calculate your BMI.", options: [] },
  { key: "averageDailySteps", q: ACTIVITY_QUESTIONS.steps.question, options: [] },
  { key: "averageDailyActiveMinutes", q: ACTIVITY_QUESTIONS.minutes.question, options: [] },
  // Appended last and gated on SECONDARY_CONDITION_TRAINED so it is only asked
  // once the model is retrained with the feature. Appending (not inserting)
  // keeps the earlier gate/DXA step indices and FULL_QUESTION_START stable.
  ...(SECONDARY_CONDITION_TRAINED
    ? [
        {
          key: "secondaryCondition" as StepKey,
          q: "Have you been diagnosed with thyroid disease or chronic kidney disease?",
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
  averageDailySteps: "6500",
  averageDailyActiveMinutes: "30",
  secondaryCondition: "No",
};

// Demo-only canned profiles for "Try an example" — one per risk band, so a
// judge/reviewer can see all three result screens without answering 14
// questions three times. Never used outside the landing page's example flow.
const EXAMPLE_PATIENTS: { id: string; label: string; blurb: string; name: string; answers: Record<StepKey, string> }[] = [
  {
    id: "low",
    label: "Low risk",
    blurb: "42, active, no major risk factors",
    name: "Alice",
    answers: {
      assignedFemale: "Yes",
      age: "42",
      menopauseStatus: "Yes",
      existingCare: "No",
      knowsDxa: "No",
      dxaScore: "",
      dxaYear: "",
      menopause: "38",
      fracture: "No",
      smoke: "No",
      steroids: "No",
      bloodResults: "Skip",
      weight: "23",
      averageDailySteps: "9000",
      averageDailyActiveMinutes: "45",
      secondaryCondition: "No",
    },
  },
  {
    id: "moderate",
    label: "Moderate risk",
    blurb: "67, a few contributing factors",
    name: "Barbara",
    answers: EXAMPLE_ANSWERS,
  },
  {
    id: "elevated",
    label: "Elevated risk",
    blurb: "78, prior fracture, smoker, low activity",
    name: "Carol",
    answers: {
      assignedFemale: "Yes",
      age: "78",
      menopauseStatus: "Yes",
      existingCare: "No",
      knowsDxa: "No",
      dxaScore: "",
      dxaYear: "",
      menopause: "45",
      fracture: "Yes",
      smoke: "Yes",
      steroids: "Yes",
      bloodResults: "Skip",
      weight: "19",
      averageDailySteps: "2000",
      averageDailyActiveMinutes: "5",
      secondaryCondition: "Yes",
    },
  },
];

// Fields the short flow never asks about — hormone therapy, rheumatoid
// arthritis, and high alcohol intake aren't part of this flow, so they still
// use the same illustrative population-average defaults as before (not
// measurements). vitaminD/calcium (blood-result photo) and
// weightBearingActivity (daily averages, or watch/app screenshot) ARE
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
  averageDailySteps: true,
  averageDailyActiveMinutes: true,
};

const isActivityStep = (key: StepKey) =>
  key === "averageDailySteps" || key === "averageDailyActiveMinutes";

const LOW_RISK_GUIDANCE = [
  "Keep active with weight-bearing and muscle-strengthening activity that feels safe and suitable for you.",
  "Avoid smoking. If you smoke, getting support to stop benefits your overall health as well as your bones.",
  "Keep alcohol intake within recommended limits. If your health changes or you have a fracture after a minor fall, speak with a clinician.",
] as const;

// Returns the feature vector plus the subset of feature keys the user actually
// answered. Everything not in `provided` was imputed (skipped, "not sure", or
// never asked in this short flow) and must not be shown as a personal driver of
// the result — see scoreBone().
function mapAnswersToFeatures(
  answers: Record<StepKey, string>,
  bloodResults: UploadedBloodResults | null,
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

  const averageDailySteps = parseDailyActivity(answers.averageDailySteps, 100_000);
  const averageDailyActiveMinutes = parseDailyActivity(answers.averageDailyActiveMinutes, 1_440);
  const activityValue = activityLevelFromDailyAverages(averageDailySteps, averageDailyActiveMinutes);

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

// ---- Conversational (AI-led) intake support ----
// Mirrors intake-fields.ts's assembleFeatures() "which fields did the user
// actually answer" rule (that file is read-only from here, never modified —
// see AGENTS.md) so the results screen's "what drove this result" bars only
// show factors the AI conversation actually collected, exactly like the
// classic flow's own `provided` list above.
function providedFromConverseCollected(collected: Record<string, unknown>): Array<keyof BoneFeatures> {
  const provided: Array<keyof BoneFeatures> = ["age"];
  if (typeof collected.menopauseAge === "number") provided.push("yearsSinceMenopause");
  if (typeof collected.priorFragilityFracture === "boolean") provided.push("priorFragilityFracture");
  if (typeof collected.currentSmoker === "boolean") provided.push("currentSmoker");
  if (typeof collected.glucocorticoids === "boolean") provided.push("glucocorticoids");
  if (typeof collected.weightKg === "number" && typeof collected.heightCm === "number") provided.push("bmi");
  const steps = typeof collected.averageDailySteps === "number" ? collected.averageDailySteps : null;
  const minutes =
    typeof collected.averageDailyActiveMinutes === "number" ? collected.averageDailyActiveMinutes : null;
  if (activityLevelFromDailyAverages(steps, minutes) !== null) provided.push("weightBearingActivity");
  if (typeof collected.vitaminD === "number") provided.push("vitaminD");
  if (typeof collected.calcium === "number") provided.push("calcium");
  if (
    SECONDARY_CONDITION_TRAINED &&
    (collected.secondaryCondition === "yes" || collected.secondaryCondition === "no")
  ) {
    provided.push("secondaryCondition");
  }
  return provided;
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
    desc: "Some of your answers match established risk factors for low bone density. This doesn't mean you have osteoporosis; it means a DXA scan is worth discussing with your GP.",
  },
  elevated: {
    label: "Elevated risk",
    chip: "Ask your GP about a DXA scan",
    color: "#B0442F",
    bg: "#F9E7E2",
    desc: "Several of your answers match strong clinical risk factors. A screening flag is not a diagnosis, but this profile is exactly what DXA referral guidelines are designed to catch. Please raise it with your GP.",
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
    case "Thyroid or chronic kidney disease":
      return { value: f.secondaryCondition ? "Yes" : "No" };
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
      "A US clinician-and-patient organization (formerly NOF). Their fracture-prevention guidance covers FRAX risk scoring, what a DXA scan involves, and the range of treatments a doctor might discuss.",
  },
  {
    name: "NHS: Osteoporosis",
    url: "https://www.nhs.uk/conditions/osteoporosis",
    brief:
      "The UK's National Health Service overview. A concise clinical summary: symptoms, what causes bone loss, how osteoporosis is diagnosed, and when it's worth seeing a GP.",
  },
] as const;

// General (non-personalised) list for the result email — distinct from
// `result.contributions`, which is this person's own answers. Phrasing is
// drawn from the clinician-reviewed EVIDENCE_CARDS in bone-evidence.ts
// (age, menopause, prior-fragility-fracture, bmi, weight-bearing-activity,
// smoking, glucocorticoids, rheumatoid-arthritis, alcohol, vitamin-d,
// thyroid-disease, coeliac-disease, chronic-kidney-disease) rather than
// written fresh, so it stays inside the same evidence-approval process as
// everything else BoneBot states as fact.
const KNOWN_RISK_FACTORS = [
  "Age",
  "Menopause and the drop in oestrogen around it",
  "A previous fracture from a minor fall or injury",
  "Low body weight or low BMI",
  "Low weight-bearing or muscle-strengthening activity",
  "Smoking",
  "Long-term oral steroid (glucocorticoid) use",
  "Rheumatoid arthritis",
  "Heavy alcohol use",
  "Low vitamin D",
  "Certain other conditions, including thyroid disease and chronic kidney disease",
] as const;

type ChatMessage = { role: "bot" | "user"; text: string; kind?: "resources" };

// ---- /api/converse contract — client-side mirror only. That route
// (src/app/api/converse/route.ts) is the source of truth and is not edited
// here; see its own header comment for the full contract. ----
type ConverseInputType = "text" | "boolean" | "number" | "choice" | "image" | "none" | null;

type ConverseTurnResponse = {
  reply: string;
  field: string | null;
  inputType: ConverseInputType;
  options?: string[];
  collected: Record<string, unknown>;
  gateExit?: { message: string };
  triageStop?: { message: string; triage: TriageOutput };
  readyToScore: boolean;
  features?: BoneFeatures | null;
  awaitingConfirm?: boolean;
};

function toConverseMessages(msgs: ChatMessage[]): { role: "user" | "assistant"; content: string }[] {
  return msgs
    .filter((m) => m.kind !== "resources" && m.text)
    .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.text }));
}

// Minimal structural types for the (non-standard, vendor-prefixed) Web Speech
// API — not in TypeScript's DOM lib. Only the surface BoneBot's mic button
// actually uses.
type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;
type SpeechWindow = { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };

// Shared everywhere BoneBot surfaces the resource list — the compact chat
// bubble version (small) and the full result-page card (below).
function TrustedResources({ small }: { small?: boolean }) {
  return (
    <ul className={`flex flex-col ${small ? "gap-3" : "gap-4"}`}>
      {RESOURCES.map((r) => (
        <li key={r.url} className={small ? "" : "border-b border-[#E3E9E7] pb-4 last:border-0 last:pb-0"}>
          <div className={`font-semibold text-[#221B16] ${small ? "text-sm" : "text-[15px]"}`}>{r.name}</div>
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

// Minimal, dependency-free markdown for LLM-written text: **bold**, *italic*/
// _italic_, and "- "/"1. " lists. Everything else is a plain paragraph. Every
// LLM word still passes through as a React text node (never innerHTML), so
// there's no way for the model's output to inject markup.
function renderInline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className={`flex flex-col gap-2.5 ${className ?? ""}`}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l))) {
          return (
            <ul key={bi} className="list-disc space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        if (lines.length > 0 && lines.every((l) => /^\d+[.)]\s+/.test(l))) {
          return (
            <ol key={bi} className="list-decimal space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\d+[.)]\s+/, ""))}</li>
              ))}
            </ol>
          );
        }
        return <p key={bi}>{renderInline(lines.join(" "))}</p>;
      })}
    </div>
  );
}

function BotBubble({ text, small }: { text: string; small?: boolean }) {
  return (
    <div className="flex justify-start">
      <div
        className={`max-w-[78%] ${small ? "text-sm" : "text-base"} leading-[1.55] ${
          small ? "rounded-[14px_14px_14px_4px] bg-[#F5F7F6] px-[15px] py-[11px]" : "rounded-[16px_16px_16px_4px] border border-[#E3E9E7] bg-white px-[18px] py-3"
        }`}
      >
        <Markdown text={text} />
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

// Results-screen motion: shared easing curve (ease-out-expo-ish, no bounce)
// and reveal variants for the staggered card cascade. Kept in one place so
// every card on the results screen animates in with the same feel.
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const revealContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const revealItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

const revealItemReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

// Counts up from 0 to `value` once on mount/change — used for the headline
// score numbers so the result reads as computed, not just printed. Falls back
// to an instant, unanimated value when the OS-level reduced-motion setting is
// on (checked once by the caller via useReducedMotion()).
function AnimatedNumber({
  value,
  decimals = 0,
  reduceMotion,
}: {
  value: number;
  decimals?: number;
  reduceMotion: boolean;
}) {
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: reduceMotion ? 0 : 0.9,
      ease: EASE_OUT,
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, reduceMotion]);

  return <>{display.toFixed(decimals)}</>;
}

export default function Home() {
  const [screen, setScreen] = useState<"landing" | "chat" | "results">("landing");
  const [showExampleMenu, setShowExampleMenu] = useState(false);
  // Which demo patient is currently loading (runModel's score/implications/
  // summary calls take a beat) — drives the spinner on that one chip so
  // clicking an example doesn't feel like it did nothing.
  const [loadingExampleId, setLoadingExampleId] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [answers, setAnswers] = useState<Partial<Record<StepKey, string>>>({});

  const [features, setFeatures] = useState<BoneFeatures | null>(null);
  const [result, setResult] = useState<ModelOutput | null>(null);
  const [triageResult, setTriageResult] = useState<TriageOutput | null>(null);
  const [routeMessage, setRouteMessage] = useState("");
  const [scoreExplanation, setScoreExplanation] = useState("");
  const [implicationsExplanation, setImplicationsExplanation] = useState("");
  const [summaryExplanation, setSummaryExplanation] = useState("");
  const [reportedDxa, setReportedDxa] = useState<{ score: number; year?: number } | null>(null);
  const [freeInput, setFreeInput] = useState("");
  const [userName, setUserName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [awaitingName, setAwaitingName] = useState(false);
  const [flowQuestionBusy, setFlowQuestionBusy] = useState(false);
  const [bloodResults, setBloodResults] = useState<UploadedBloodResults | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  // Feature 1 — extracted-but-unconfirmed values from the blood-result image.
  // Nothing here reaches mapAnswersToFeatures()/scoreBone() until the user
  // hits "Use these" or edits + confirms; "Skip" discards it entirely.
  // Set when a typed menopause age falls outside the typical 40–58 range —
  // held for an explicit confirm/re-enter instead of silently accepted, since
  // it's likely a typo (e.g. "28" meant to be "48").
  const [pendingMenopauseAge, setPendingMenopauseAge] = useState<number | null>(null);
  // True while BoneBot is waiting on the "continue the survey or head home?"
  // choice shown after she says she already has existing bone-health care.
  const [pendingExistingCareConfirm, setPendingExistingCareConfirm] = useState(false);
  // Holds the in-progress answers while BoneBot is waiting on the "continue
  // regardless, or see the explanation of that score?" choice, shown when a
  // reported DXA score is from within the last 2 years.
  const [pendingRecentDxaAnswers, setPendingRecentDxaAnswers] = useState<Partial<Record<StepKey, string>> | null>(null);
  const [pendingBloodResults, setPendingBloodResults] = useState<UploadedBloodResults | null>(null);
  const [bloodEditMode, setBloodEditMode] = useState(false);
  const [bloodEditVitaminD, setBloodEditVitaminD] = useState("");
  const [bloodEditCalcium, setBloodEditCalcium] = useState("");
  const [bloodEditError, setBloodEditError] = useState("");
  // Up to MAX_IMAGES blood-result photos, added before a single "Analyze"
  // call so a multi-page report is sent to the vision model together.
  const [bloodImageFiles, setBloodImageFiles] = useState<File[]>([]);

  // Wearable/activity-screenshot upload — extracted values remain proposals
  // until the user confirms them, then they populate the two numeric answers.
  const [activityUploadBusy, setActivityUploadBusy] = useState(false);
  const [pendingActivityResult, setPendingActivityResult] = useState<UploadedActivityResult | null>(null);
  const [activityEditMode, setActivityEditMode] = useState(false);
  const [activityEditSteps, setActivityEditSteps] = useState("");
  const [activityEditMinutes, setActivityEditMinutes] = useState("");
  const [activityEditError, setActivityEditError] = useState("");
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
  const [weightInput, setWeightInput] = useState("60");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [heightUnit, setHeightUnit] = useState<"cm" | "ftin">("cm");
  const [heightCmInput, setHeightCmInput] = useState("162");
  const [heightFtInput, setHeightFtInput] = useState("5");
  const [heightInInput, setHeightInInput] = useState("4");
  const [bmiError, setBmiError] = useState("");

  const [qaMessages, setQaMessages] = useState<ChatMessage[]>([]);
  const [qaTyping, setQaTyping] = useState(false);
  const [qaInput, setQaInput] = useState("");

  // ---------------- Conversational (AI-led) mode ----------------
  // Additive alternative driver for the intake, talking to POST
  // /api/converse (src/app/api/converse/route.ts) instead of walking the
  // STEPS array below. It reuses the SAME shared state above (features,
  // result, triageResult, routeMessage, qaMessages, bloodResults, and
  // friends) and the same results screen — only how the intake questions
  // are asked differs. See AGENTS.md: the model still predicts (scoreBone,
  // via runModelFromFeatures), this only changes how BoneFeatures is
  // collected. Defaults to "conversation" — the STEPS flow stays reachable
  // via "Classic mode" (see startClassic()).
  const [flowMode, setFlowMode] = useState<"conversation" | "classic">("conversation");
  const [convMessages, setConvMessages] = useState<ChatMessage[]>([]);
  const [convBusy, setConvBusy] = useState(false);
  const [convCollected, setConvCollected] = useState<Record<string, unknown>>({});
  const [convConfirmMode, setConvConfirmMode] = useState(false);
  const [convAwaitingConfirm, setConvAwaitingConfirm] = useState(false);
  const [convField, setConvField] = useState<string | null>(null);
  const [convInputType, setConvInputType] = useState<ConverseInputType>(null);
  const [convOptions, setConvOptions] = useState<string[] | undefined>(undefined);
  const [convInput, setConvInput] = useState("");
  const [micListening, setMicListening] = useState(false);
  // Web Speech API feature-detect. A lazy initializer (not an effect) so
  // there's no extra render/cascading setState — safe because the mic
  // button it gates is only ever rendered once screen === "chat", well
  // after hydration, so there's no SSR/client mismatch risk in practice.
  const [micSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as SpeechWindow;
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  });

  const chatRef = useRef<HTMLDivElement>(null);
  const qaRef = useRef<HTMLDivElement>(null);
  const emailSectionRef = useRef<HTMLDivElement>(null);
  const freeInputRef = useRef<HTMLInputElement>(null);
  const convChatRef = useRef<HTMLDivElement>(null);
  const convInputRef = useRef<HTMLInputElement>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // Synchronous re-entrancy lock: setAwaitingName(false) is async, so a fast
  // double name-submit (Enter + click within the same tick) would otherwise run
  // beginQuestions() twice and print the first question ("assigned female at
  // birth?") twice. A ref flips immediately, so the second call bails.
  const questionsStartedRef = useRef(false);

  useEffect(() => {
    // stepIdx (not just messages/typing) because the chip row now renders
    // inside this scrollable pane, right under the last bot message — it
    // changes the pane's content height without changing messages/typing.
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, typing, stepIdx]);


  useEffect(() => {
    // The free-text input is the same DOM node across consecutive free-text
    // questions (age -> dxaScore -> dxaYear -> ...), so a plain autoFocus
    // prop only fires once on first mount. Re-focus it explicitly whenever
    // she lands on a new question, so she never has to click into it herself.
    // (step/chatReady aren't declared yet at this point in the component, so
    // the same condition is recomputed inline here.)
    const currentStep = STEPS[stepIdx];
    if (screen === "chat" && !typing && currentStep && currentStep.options.length === 0) {
      freeInputRef.current?.focus();
    }
  }, [stepIdx, screen, typing]);
  useEffect(() => {
    if (qaRef.current) qaRef.current.scrollTop = qaRef.current.scrollHeight;
  }, [qaMessages, qaTyping]);

  useEffect(() => {
    if (convChatRef.current) convChatRef.current.scrollTop = convChatRef.current.scrollHeight;
  }, [convMessages, convBusy]);

  useEffect(() => {
    if (
      screen === "chat" &&
      flowMode === "conversation" &&
      !convBusy &&
      (convInputType === "text" || convInputType === "number" || convField === "confirm")
    ) {
      convInputRef.current?.focus();
    }
  }, [convField, convInputType, convBusy, screen, flowMode]);

  function botSay(text: string, delay = 650) {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { role: "bot", text }]);
    }, delay);
  }

  // Asks her name first, before the real question flow starts (kept
  // deliberately outside the STEPS state machine -- inserting a step there
  // would mean renumbering every hardcoded stepIdx branch below). "Try an
  // example patient" skips this and goes straight to a canned result, so it
  // never touches userName.
  function start() {
    setScreen("chat");
    setMessages([]);
    setUserName("");
    setNameInput("");
    setAwaitingName(true);
    questionsStartedRef.current = false;
    botSay("Hi, I'm BoneBot 👋 Before we start — what should I call you?");
  }

  function submitName() {
    const name = nameInput.trim();
    if (!name || questionsStartedRef.current) return;
    questionsStartedRef.current = true;
    setMessages((m) => [...m, { role: "user", text: name }]);
    setUserName(name);
    setNameInput("");
    setAwaitingName(false);
    beginQuestions(name);
  }

  function beginQuestions(name: string) {
    setStepIdx(0);
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
    setPendingActivityResult(null);
    setActivityEditMode(false);
    setActivityEditSteps("");
    setActivityEditMinutes("");
    setActivityEditError("");
    setActivityImageFiles([]);
    setUnresolvedAnswerCount(0);
    setClarificationCounts({});
    setWeightInput("60");
    setWeightUnit("kg");
    setHeightUnit("cm");
    setHeightCmInput("162");
    setHeightFtInput("5");
    setHeightInInput("4");
    setBmiError("");
    const greetingName = name ? `, ${name}` : "";
    botSay(
      `Nice to meet you${greetingName}. I'll begin with four short questions. If your answers indicate we should take closer look, I'll ask some follow-up questions. Remember: this is a screening estimate, not a diagnosis.`
    );
    window.setTimeout(() => botSay(STEPS[0].q), 1400);
  }

  // THE shared scoring + explanation + results-screen path — used by BOTH
  // drivers (classic STEPS via runModel() below, and the AI-led conversation
  // via sendConverseTurn()'s readyToScore branch). Accepts an explicit name
  // (rather than always reading the userName state) because the "Try an
  // example" path calls setUserName() and this in the same tick — the state
  // update wouldn't be visible in this closure yet, so the very first
  // /api/assistant call would go out with no name.
  async function runModelFromFeatures(
    full: BoneFeatures,
    provided: Array<keyof BoneFeatures> | undefined,
    nameOverride?: string,
  ) {
    const explainerName = nameOverride ?? userName;
    setFeatures(full);
    const model = scoreBone(full, provided);
    setResult(model);

    const scoreFallback = `Your estimated T-score is ${model.estimatedTScore}. This is a screening estimate, not a DXA measurement or diagnosis.`;
    const implicationsFallback =
      model.category === "lower"
        ? "This result is reassuring, but it cannot decide on its own whether a scan is appropriate. Keep supporting your bone health and discuss screening at a routine GP visit if that is relevant to you."
        : "This screening result is a reason to discuss a DXA scan and wider fracture-risk assessment with your GP. It is not a diagnosis.";
    // Falls back to the static per-band CAT_META.desc — see its render site.
    const summaryFallback = CAT_META[CATEGORY_MAP[model.category]].desc;
    const getExplanation = async (explanationType: "score" | "implications" | "summary", fallback: string) => {
      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "consumer",
            result: model,
            features: full,
            explanationType,
            name: explainerName,
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
    const [scoreText, implicationsText, summaryText] = await Promise.all([
      getExplanation("score", scoreFallback),
      getExplanation("implications", implicationsFallback),
      getExplanation("summary", summaryFallback),
    ]);
    setScoreExplanation(scoreText);
    setImplicationsExplanation(implicationsText);
    setSummaryExplanation(summaryText);
    setQaMessages([{ role: "bot", text: "Ask a question about your bone-health screening result." }]);
    setScreen("results");
  }

  async function runModel(all: Record<StepKey, string>, nameOverride?: string) {
    const { features: full, provided } = mapAnswersToFeatures(all, bloodResults);
    await runModelFromFeatures(full, provided, nameOverride);
  }

  async function finishAtGate(message: string, triageResultValue?: TriageOutput) {
    setRouteMessage(
      triageResultValue
        ? "Your initial screening estimate is below BoneBot's threshold, so the longer questionnaire was not opened. This does not rule out osteoporosis or replace clinical advice."
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
      void finishAtGate(`Your initial screening estimate is ${triage.probabilityPercent}%, which is below BoneBot's threshold for opening the longer questionnaire. This does not rule out osteoporosis or replace clinical advice.`, triage);
      return;
    }
    setStepIdx(FULL_QUESTION_START);
    botSay("We’ll continue with the full questionnaire to produce a fuller screening estimate.");
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

  // ---------------- Conversational (AI-led) mode: turn driver ----------------
  // Routes chat bubbles to whichever transcript is active — reused by
  // uploadBloodResults() below so the SAME upload function works for both
  // the classic STEPS flow and the AI-led conversation.
  function pushChatMessage(role: "bot" | "user", text: string) {
    if (flowMode === "conversation") {
      setConvMessages((m) => [...m, { role, text }]);
    } else {
      setMessages((m) => [...m, { role, text }]);
    }
  }

  function startConversation() {
    setFlowMode("conversation");
    setScreen("chat");
    setConvMessages([]);
    setConvCollected({});
    setConvConfirmMode(false);
    setConvAwaitingConfirm(false);
    setConvField(null);
    setConvInputType(null);
    setConvOptions(undefined);
    setConvInput("");
    setBloodResults(null);
    setPendingBloodResults(null);
    setBloodEditMode(false);
    setBloodEditVitaminD("");
    setBloodEditCalcium("");
    setBloodEditError("");
    setBloodImageFiles([]);
    setResult(null);
    setFeatures(null);
    setTriageResult(null);
    setRouteMessage("");
    setScoreExplanation("");
    setImplicationsExplanation("");
    setSummaryExplanation("");
    setUserName("");
    void sendConverseTurn(null, {
      collected: {},
      messagesBase: [],
      confirmModeOverride: false,
      awaitingConfirmOverride: false,
    });
  }

  // The reachable classic-mode fallback — see AGENTS.md ("keep the STEPS
  // flow present and reachable"). Reuses the pre-existing start() function
  // untouched; only tags which driver is now active.
  function startClassic() {
    setFlowMode("classic");
    speechRecognitionRef.current?.stop();
    setMicListening(false);
    start();
  }

  // Optional voice playback of BoneBot's reply via the existing /api/tts
  // route — silent, best-effort; never blocks the conversation if
  // ElevenLabs is unavailable (see AGENTS.md "degrade gracefully").
  async function speak(text: string) {
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      void audio.play().catch(() => {});
    } catch {
      /* TTS is optional — silent fallback. */
    }
  }

  // THE conversational turn driver: sends the running transcript + collected
  // answers to /api/converse, then routes the response exactly per the
  // route's contract — gateExit/triageStop reuse the existing
  // finishAtGate() (same low-risk/no-result results screens as the classic
  // flow), and readyToScore reuses the existing runModelFromFeatures() (same
  // scoring + explanation calls + results sheet as the classic flow). This
  // function never decides eligibility, triage, or the final feature set
  // itself — that is entirely server-side (src/lib/intake-fields.ts), per
  // AGENTS.md ("the model predicts, the LLM only explains").
  async function sendConverseTurn(
    userText: string | null,
    opts?: {
      collected?: Record<string, unknown>;
      messagesBase?: ChatMessage[];
      confirmModeOverride?: boolean;
      awaitingConfirmOverride?: boolean;
    },
  ) {
    if (convBusy) return;
    const baseMessages = opts?.messagesBase ?? convMessages;
    const collected = opts?.collected ?? convCollected;
    const confirmModeValue = opts?.confirmModeOverride ?? convConfirmMode;
    const awaitingConfirmValue = opts?.awaitingConfirmOverride ?? convAwaitingConfirm;

    let nextMessages = baseMessages;
    if (userText !== null) {
      nextMessages = [...baseMessages, { role: "user", text: userText }];
      setConvMessages(nextMessages);
    }
    setConvInput("");
    setConvBusy(true);

    let data: ConverseTurnResponse | null = null;
    try {
      const response = await fetch("/api/converse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: toConverseMessages(nextMessages),
          collected,
          confirmMode: confirmModeValue,
          awaitingConfirm: awaitingConfirmValue,
        }),
      });
      if (response.ok) data = (await response.json()) as ConverseTurnResponse;
    } catch {
      /* handled below via null data — degrade gracefully, see AGENTS.md */
    }
    setConvBusy(false);

    if (!data) {
      setConvMessages((m) => [
        ...m,
        {
          role: "bot",
          text: "BoneBot's conversation mode is unavailable right now. You can try again, or switch to classic mode.",
        },
      ]);
      return;
    }

    const nextCollected = data.collected ?? {};
    setConvCollected(nextCollected);
    setConvAwaitingConfirm(Boolean(data.awaitingConfirm));
    setConvMessages((m) => [...m, { role: "bot", text: data!.reply }]);
    if (confirmModeValue) void speak(data.reply);

    if (data.gateExit) {
      setConvField(null);
      setConvInputType(null);
      setConvOptions(undefined);
      await finishAtGate(data.gateExit.message);
      return;
    }

    if (data.triageStop) {
      setConvField(null);
      setConvInputType(null);
      setConvOptions(undefined);
      await finishAtGate(data.triageStop.message, data.triageStop.triage);
      return;
    }

    if (data.readyToScore && data.features) {
      setConvField(null);
      setConvInputType(null);
      setConvOptions(undefined);
      await runModelFromFeatures(data.features, providedFromConverseCollected(nextCollected), userName || undefined);
      return;
    }

    setConvField(data.field);
    setConvInputType(data.inputType);
    setConvOptions(data.options);
  }

  // Web Speech API mic. Hidden entirely when unsupported (Safari/older
  // browsers) — see micSupported's feature-detect effect above; typing
  // always still works. Using it flips the session into confirmMode
  // (read-back-before-advancing), since voice transcription is error-prone —
  // see api/converse/route.ts's confirmMode module comment.
  function startMic() {
    if (micListening) return;
    const w = window as unknown as SpeechWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setConvConfirmMode(true);
        void sendConverseTurn(transcript, { confirmModeOverride: true });
      }
    };
    recognition.onerror = () => setMicListening(false);
    recognition.onend = () => setMicListening(false);
    speechRecognitionRef.current = recognition;
    setMicListening(true);
    recognition.start();
  }

  function stopMic() {
    speechRecognitionRef.current?.stop();
    setMicListening(false);
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
          "BoneBot's model was trained for adults assigned female at birth around and after menopause, so it cannot provide a reliable estimate here. Please speak with a clinician about your bone health.",
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
        // Menopausal status is inferred silently from age here (not asked,
        // not shown as a bot message) and just logged into answers.
        setAnswers({ ...nextAnswers, menopauseStatus: "Yes" });
        setStepIdx(3);
        botSay(STEPS[3].q);
        return;
      }
    }

    if (stepIdx === 3) {
      if (nextAnswers.assignedFemale !== "Yes") {
        void finishAtGate("BoneBot's model was trained for adults assigned female at birth around and after menopause. A clinician can help you find an appropriate bone-health assessment.");
      } else if (nextAnswers.existingCare === "Yes") {
        // Already-diagnosed / already-scanned / already-medicated — steer to
        // her GP rather than walking straight into the DXA sub-questions, but
        // let her choose to continue the survey anyway.
        setPendingExistingCareConfirm(true);
        botSay("In this case we recommend you consult your GP if you have any questions about your bone health. Do you want to continue the survey, or head back home?");
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
      // A DXA report is normally still valid for a couple of years — a very
      // recent one (e.g. "-2.5 from last year") is worth double-checking
      // rather than silently short-circuiting straight to the reported-score
      // explanation and skipping the full questionnaire.
      const yearNum = Number(opt);
      const currentYear = new Date().getFullYear();
      const isRecent = Number.isFinite(yearNum) && yearNum <= currentYear && currentYear - yearNum <= 2;
      if (isRecent) {
        setPendingRecentDxaAnswers(nextAnswers);
        botSay("That's a fairly recent scan. Do you want to continue with the full questionnaire anyway, or see the explanation of your reported score?");
      } else {
        showReportedDxa(nextAnswers);
      }
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
    if (key === "averageDailySteps") {
      const value = parseDailyActivity(text, 100_000);
      return value !== null && Number.isInteger(value) ? String(value) : null;
    }
    if (key === "averageDailyActiveMinutes") {
      const value = parseDailyActivity(text, 1_440);
      return value !== null ? String(value) : null;
    }
    if (/(not sure|don't know|do not know)/.test(lower)) return "Not sure";
    if (key === "fracture" && /\b(broke|broken|fracture)\b/.test(lower)) return "Yes";
    if (/\b(no|nope|never)\b/.test(lower)) return "No";
    if (/\b(don't|do not|didn't|did not)\b/.test(lower)) return "No";
    if (/\b(yes|yeah|yep|i do|i have)\b/.test(lower)) return "Yes";
    return null;
  }

  // Lets her type "vitamin D 55, calcium 2.3" directly instead of only
  // accepting a photo upload for the blood-results step. Same valid ranges as
  // the image-extraction path and the manual edit form (VITAMIN_D_RANGE /
  // CALCIUM_RANGE below) — an out-of-range number is treated as not found
  // rather than silently accepted.
  function parseBloodResultsText(raw: string): UploadedBloodResults | null {
    const lower = raw.toLowerCase();
    const vitaminDMatch = lower.match(/vit(?:amin)?\s*d[^\d]{0,10}(\d+(?:\.\d+)?)/);
    const calciumMatch = lower.match(/calcium[^\d]{0,10}(\d+(?:\.\d+)?)/);
    const vitaminD = vitaminDMatch ? Number(vitaminDMatch[1]) : null;
    const calcium = calciumMatch ? Number(calciumMatch[1]) : null;
    const vitaminDValid = vitaminD !== null && vitaminD >= 10 && vitaminD <= 250;
    const calciumValid = calcium !== null && calcium >= 1.5 && calcium <= 3.5;
    if (!vitaminDValid && !calciumValid) return null;
    return {
      vitaminD: vitaminDValid ? vitaminD : null,
      calcium: calciumValid ? calcium : null,
      alkalinePhosphatase: null,
      redBloodCellCount: null,
    };
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
    if (step.key === "bloodResults") {
      const parsedBloodResults = parseBloodResultsText(raw);
      if (parsedBloodResults) {
        setMessages((items) => [...items, { role: "user", text: raw }]);
        setFreeInput("");
        setPendingBloodResults(parsedBloodResults);
        return;
      }
    }
    const value = normaliseFreeAnswer(step.key, raw);
    if (value && value !== "Not sure" && value !== "Unknown") {
      if (step.key === "menopause") {
        const ageNum = Number(value);
        if (ageNum < 40 || ageNum > 58) {
          setMessages((items) => [
            ...items,
            { role: "user", text: raw },
            { role: "bot", text: `Just to double check — menopause at around age ${ageNum} is outside the typical range. Is that right?` },
          ]);
          setPendingMenopauseAge(ageNum);
          setFreeInput("");
          return;
        }
      }
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
          text: "Please enter an age from 18 to 110 years.",
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
        void finishAtGate("BoneBot cannot create a reliable screening estimate from the answers provided. Please contact your GP or another clinician with questions about your bone health.");
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
        body: JSON.stringify({ mode: "consumer", question: raw, stage: "questionnaire", name: userName }),
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
    // Snapshot to a plain array now — the caller resets the <input>'s value
    // right after this call, which also clears the live FileList. If the
    // setState updater ran after that reset (state updaters aren't
    // guaranteed synchronous), Array.from(files) would see an empty list.
    const selected = Array.from(files);
    setBloodImageFiles((prev) => {
      const room = MAX_IMAGES - prev.length;
      return room > 0 ? [...prev, ...selected.slice(0, room)] : prev;
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
          ? `I read: ${extracted.join(", ")}, but no vitamin D or calcium value — those are the two used in your estimate. Try another image, or type the value in below.`
          : "I could not identify a supported blood-result value in that image. Try another image, or type the value in below.";
        setBloodResults(body);
        // Deliberately don't advance the flow here — stay on this question so
        // the upload widget and the free-text field are both still there for
        // her to try again, instead of silently moving on with nothing scored.
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
      const missing = [
        extractedResults.vitaminD === null ? "vitamin D" : null,
        extractedResults.calcium === null ? "calcium" : null,
      ].filter(Boolean);
      pushChatMessage(
        "bot",
        `I read ${readText}.` +
          (contextParts.length ? ` Also ${contextParts.join(", ")} (context only, not scored).` : "") +
          (missing.length
            ? ` I didn't find a ${missing.join(" or ")} value — upload another image, or tap Edit below to add it.`
            : "") +
          " Please confirm before I include this in your estimate.",
      );
    } else if (message) {
      pushChatMessage("bot", message);
    }
  }

  function confirmMenopauseAge() {
    if (pendingMenopauseAge === null) return;
    const age = pendingMenopauseAge;
    setPendingMenopauseAge(null);
    answer(String(age), "Yes, that's right");
  }

  function rejectMenopauseAge() {
    setPendingMenopauseAge(null);
    setMessages((items) => [...items, { role: "user", text: "No, let me re-enter" }, { role: "bot", text: "No problem — what age was it?" }]);
  }

  function confirmExistingCareContinue() {
    setPendingExistingCareConfirm(false);
    setStepIdx(4);
    botSay(STEPS[4].q);
  }

  function confirmExistingCareReturnHome() {
    setPendingExistingCareConfirm(false);
    restart();
  }

  function confirmRecentDxaContinue() {
    if (!pendingRecentDxaAnswers) return;
    const nextAnswers = pendingRecentDxaAnswers;
    setPendingRecentDxaAnswers(null);
    continueAfterTriage(nextAnswers);
  }

  function confirmRecentDxaSeeExplanation() {
    if (!pendingRecentDxaAnswers) return;
    const nextAnswers = pendingRecentDxaAnswers;
    setPendingRecentDxaAnswers(null);
    showReportedDxa(nextAnswers);
  }

  const VITAMIN_D_RANGE = { min: 10, max: 250 };
  const CALCIUM_RANGE = { min: 1.5, max: 3.5 };

  function useTheseBloodValues() {
    if (!pendingBloodResults) return;
    const values = pendingBloodResults;
    setBloodResults(values);
    setPendingBloodResults(null);
    setBloodEditMode(false);
    if (flowMode === "conversation") {
      const merged = { ...convCollected };
      if (values.vitaminD !== null) merged.vitaminD = values.vitaminD;
      if (values.calcium !== null) merged.calcium = values.calcium;
      void sendConverseTurn("I uploaded my blood-test results.", { collected: merged });
      return;
    }
    if (STEPS[stepIdx]?.key === "bloodResults") answer("Uploaded", "Use these values");
  }

  function skipPendingBloodValues() {
    setPendingBloodResults(null);
    setBloodEditMode(false);
    if (flowMode === "conversation") {
      void sendConverseTurn("Skip — I don't have blood-test results.");
      return;
    }
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
    if (flowMode === "conversation") {
      const merged = { ...convCollected };
      if (edited.vitaminD !== null) merged.vitaminD = edited.vitaminD;
      if (edited.calcium !== null) merged.calcium = edited.calcium;
      void sendConverseTurn("I edited my blood-test values.", { collected: merged });
      return;
    }
    if (STEPS[stepIdx]?.key === "bloodResults") answer("Uploaded", "Edited values confirmed");
  }

  // Wearable/activity screenshot — up to MAX_IMAGES images, same queue-then-
  // analyze pattern as addBloodImages/removeBloodImage above.
  function addActivityImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    // See addBloodImages — snapshot before the caller resets input.value.
    const selected = Array.from(files);
    setActivityImageFiles((prev) => {
      const room = MAX_IMAGES - prev.length;
      return room > 0 ? [...prev, ...selected.slice(0, room)] : prev;
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
          "error" in body ? body.error : "BoneBot could not read that image. You can still enter your daily average manually.";
      } else if (body.weightBearingActivity === null) {
        message = "I could not identify steps or active minutes in that image. You can still enter either daily average manually.";
      } else {
        extracted = body;
      }
    } catch {
      message = "BoneBot could not read that image. You can still enter either daily average manually.";
    }
    setActivityUploadBusy(false);
    setActivityImageFiles([]);
    if (extracted) {
      setPendingActivityResult(extracted);
      setActivityEditMode(false);
      setActivityEditSteps(extracted.estimatedSteps?.toString() ?? "");
      setActivityEditMinutes(extracted.estimatedActiveMinutes?.toString() ?? "");
      setActivityEditError("");
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

  function commitActivityValues(result: UploadedActivityResult, display: string) {
    const existingSteps = parseDailyActivity(answers.averageDailySteps ?? "", 100_000);
    const existingMinutes = parseDailyActivity(answers.averageDailyActiveMinutes ?? "", 1_440);
    const steps = result.estimatedSteps ?? existingSteps;
    const minutes = result.estimatedActiveMinutes ?? existingMinutes;
    const nextAnswers = {
      ...answers,
      averageDailySteps: steps !== null ? String(steps) : "Not sure",
      averageDailyActiveMinutes: minutes !== null ? String(minutes) : "Not sure",
    };

    setAnswers(nextAnswers);
    setMessages((items) => [...items, { role: "user", text: display }]);
    setPendingActivityResult(null);
    setActivityEditMode(false);
    setActivityEditError("");

    const finalActivityIdx = STEPS.findIndex((item) => item.key === "averageDailyActiveMinutes");
    const nextIdx = finalActivityIdx + 1;
    setStepIdx(nextIdx);
    if (nextIdx < STEPS.length) {
      botSay(STEPS[nextIdx].q);
    } else {
      botSay("That's everything. Running your answers through the risk model…");
      void runModel(nextAnswers as Record<StepKey, string>);
    }
  }

  function useTheseActivityValues() {
    if (!pendingActivityResult) return;
    commitActivityValues(pendingActivityResult, "Use these activity averages");
  }

  function skipPendingActivityValues() {
    setPendingActivityResult(null);
    setActivityEditMode(false);
    setActivityEditError("");
  }

  function submitEditedActivityValues() {
    const steps = activityEditSteps.trim() ? parseDailyActivity(activityEditSteps, 100_000) : null;
    const minutes = activityEditMinutes.trim() ? parseDailyActivity(activityEditMinutes, 1_440) : null;
    if ((activityEditSteps.trim() && steps === null) || (activityEditMinutes.trim() && minutes === null)) {
      setActivityEditError("Enter 0–100,000 steps and 0–1,440 active minutes, or leave either field blank.");
      return;
    }
    const edited: UploadedActivityResult = {
      weightBearingActivity: activityLevelFromDailyAverages(steps, minutes),
      estimatedSteps: steps,
      estimatedActiveMinutes: minutes,
    };
    commitActivityValues(edited, "Use these edited activity averages");
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

  async function tryExample(patientId: string, answers: Record<StepKey, string>, name: string) {
    if (loadingExampleId) return;
    setLoadingExampleId(patientId);
    setUserName(name);
    await runModel(answers, name);
    setLoadingExampleId(null);
    setShowExampleMenu(false);
  }

  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Only shown factors — same "rounds to 0.0 isn't a driver" rule as the
  // on-screen "What drove this result" card, so the email matches what she
  // actually saw.
  function shownEmailContributions() {
    return (result?.contributions ?? []).filter((f) => Math.round(Math.abs(f.contribution) * 10) / 10 !== 0);
  }

  function buildResultEmail(): { subject: string; text: string; html: string } {
    if (!result) return { subject: "", text: "", html: "" };
    const contributions = shownEmailContributions();
    const lines = [
      `Dear ${userName || "there"},`,
      "Here are the results from your predicted T-score.",
      "",
      `BoneBot screening result: ${catMeta.label}`,
      "",
      `Estimated T-score: ${result.estimatedTScore}`,
      `Category: ${catMeta.label} (${T_SCORE_BANDS[{ low: 0, moderate: 1, elevated: 2 }[cat]].range})`,
      "",
      "What drove this result:",
      ...contributions.map((f) => {
        const detail = features ? factorDetail(f.factor, features) : { value: "" };
        const valueNote = detail.value ? ` (${detail.value})` : "";
        return `  ${f.contribution > 0 ? "+" : ""}${f.contribution.toFixed(1)}  ${f.factor}${valueNote}`;
      }),
      "",
      "Known risk factors for bone fracture after menopause:",
      ...KNOWN_RISK_FACTORS.map((r) => `  - ${r}`),
      "",
      "This is not a clinical tool: BoneBot is a screening estimate from a model trained on NHANES data, not a diagnosis or a bone-density measurement. Please discuss this result, and any changes based on it, with a clinical specialist such as your GP before acting on it.",
      "",
      "Learn more about osteoporosis and menopause:",
      ...RESOURCES.map((r) => `  - ${r.name}: ${r.url}`),
      "",
      "BoneBot, Hack-Nation 6th Global AI Hackathon",
    ];

    const heading = userName ? `${escapeHtml(userName)}&rsquo;s screening result` : "Your screening result";
    const rangeText = T_SCORE_BANDS[{ low: 0, moderate: 1, elevated: 2 }[cat]].range;
    const rows = contributions
      .map((f) => {
        const detail = features ? factorDetail(f.factor, features) : { value: "" };
        const isPositive = f.direction === "raises";
        const rowColor = isPositive ? "#0E7C6E" : "#B0442F";
        const sign = f.contribution > 0 ? "+" : "";
        return `<tr>
          <td style="padding:6px 0;font-size:13px;color:#221B16;">${escapeHtml(f.factor)}${
            detail.value ? `<br><span style="font-size:11px;color:#9AA5A2;">${escapeHtml(detail.value)}</span>` : ""
          }</td>
          <td style="padding:6px 0;font-size:13px;font-weight:700;color:${rowColor};text-align:right;white-space:nowrap;">${sign}${f.contribution.toFixed(1)}</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#F5F7F6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F7F6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:560px;background-color:#ffffff;border-radius:16px;border:1px solid #E3E9E7;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:20px 32px;border-bottom:1px solid #E3E9E7;">
                <span style="font-size:19px;font-weight:700;color:#221B16;">Bone<span style="color:#0E6E62;">Bot</span></span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#221B16;">
                  Dear ${escapeHtml(userName || "there")},<br>Here are the results from your predicted T-score.
                </p>
                <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5A6462;">${heading}</div>
                <div style="margin-top:10px;font-size:34px;font-weight:700;color:${catMeta.color};">${escapeHtml(catMeta.label)}</div>
                <div style="margin-top:14px;font-size:15px;line-height:1.6;color:#4A5452;">
                  Estimated T-score: <strong>${result.estimatedTScore}</strong> &mdash; ${escapeHtml(rangeText)} range.
                </div>
                ${
                  rows
                    ? `<div style="margin-top:28px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5A6462;">What drove this result</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:1px solid #E3E9E7;">
                  ${rows}
                </table>`
                    : ""
                }
                <div style="margin-top:28px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5A6462;">Known risk factors for bone fracture after menopause</div>
                <ul style="margin:8px 0 0;padding-left:18px;font-size:13px;line-height:1.7;color:#4A5452;">
                  ${KNOWN_RISK_FACTORS.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
                </ul>
                <div style="margin-top:28px;padding:16px;background-color:#F5F7F6;border-radius:12px;font-size:13px;line-height:1.6;color:#5A6462;">
                  <strong>This is not a clinical tool.</strong> BoneBot is a screening estimate from a model trained on NHANES data &mdash; not a diagnosis, a bone-density measurement, or medical advice. Please discuss this result, and any changes based on it, with a clinical specialist such as your GP before acting on it.
                </div>
                <div style="margin-top:20px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5A6462;">Learn more about osteoporosis and menopause</div>
                <ul style="margin:8px 0 0;padding-left:18px;font-size:13px;line-height:1.8;">
                  ${RESOURCES.map((r) => `<li><a href="${r.url}" style="color:#0E6E62;">${escapeHtml(r.name)}</a></li>`).join("")}
                </ul>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #E3E9E7;font-size:12px;color:#9AA5A2;">
                BoneBot &middot; Hack-Nation 6th Global AI Hackathon &middot; Screening flag, not a diagnosis
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    return {
      subject: `My BoneBot bone-health screening result: ${catMeta.label}`,
      text: lines.join("\n"),
      html,
    };
  }

  async function sendResultEmail() {
    if (!emailAddress.trim() || emailSendState === "sending") return;
    setEmailSendState("sending");
    setEmailSendError("");
    try {
      const { subject, text, html } = buildResultEmail();
      const r = await fetch("/api/send-result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: emailAddress.trim(), subject, text, html }),
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
    setSummaryExplanation("");
    setPendingMenopauseAge(null);
    setPendingExistingCareConfirm(false);
    setPendingRecentDxaAnswers(null);
    setShowExampleMenu(false);
    setLoadingExampleId(null);
    setFreeInput("");
    setBloodResults(null);
    setPendingBloodResults(null);
    setBloodEditMode(false);
    setBloodEditVitaminD("");
    setBloodEditCalcium("");
    setBloodEditError("");
    setBloodImageFiles([]);
    setPendingActivityResult(null);
    setActivityEditMode(false);
    setActivityEditSteps("");
    setActivityEditMinutes("");
    setActivityEditError("");
    setActivityImageFiles([]);
    setUnresolvedAnswerCount(0);
    setClarificationCounts({});
    setUncertaintyNotes([]);
    setWeightInput("60");
    setWeightUnit("kg");
    setHeightUnit("cm");
    setHeightCmInput("162");
    setHeightFtInput("5");
    setHeightInInput("4");
    setBmiError("");
    setEmailAddress("");
    setEmailSendState("idle");
    setEmailSendError("");
    setUserName("");
    setNameInput("");
    setAwaitingName(false);
    setFlowMode("conversation");
    setConvMessages([]);
    setConvBusy(false);
    setConvCollected({});
    setConvConfirmMode(false);
    setConvAwaitingConfirm(false);
    setConvField(null);
    setConvInputType(null);
    setConvOptions(undefined);
    setConvInput("");
    speechRecognitionRef.current?.stop();
    setMicListening(false);
  }

  // Wordmark click target from chat/results screens. Mid-chat it's the same
  // "are you sure" gate as the Start over button; from a finished results
  // screen there's nothing to lose, so it goes straight back.
  function goToLanding() {
    const hasProgress =
      screen === "chat" && (flowMode === "conversation" ? convMessages.length > 0 : messages.length > 1);
    if (hasProgress && !window.confirm("Start over? This clears your answers so far.")) return;
    restart();
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
          name: userName,
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
  // Several flows chain two botSay() calls with a setTimeout between them
  // (e.g. the name greeting, then the first question, a beat later) — typing
  // is false in that gap, so also require the step's own question to have
  // actually landed in the transcript before showing its chips/input.
  // Without this, answer options could flash in right after the FIRST
  // message, before the question they answer has appeared. Searching the
  // whole transcript (not just the last message) means a follow-up bot
  // message that re-asks in its own words (menopause-age outlier reject,
  // out-of-range age, the clarify loop) doesn't reset this back to false, so
  // free-text re-entry isn't silently blocked after one of those. STEPS[].q
  // strings are each unique, so this can't false-match a different step.
  const questionLanded = Boolean(step) && messages.some((m) => m.role === "bot" && m.text === step.q);
  // Confirm/re-ask prompts (menopause-age outlier, existing-care GP steer,
  // recent-DXA-score check) post their OWN bot message, not step.q — gate
  // those on chatReady, not inFlow, or questionLanded hides them.
  const chatReady = screen === "chat" && !typing;
  const convChatReady = screen === "chat" && flowMode === "conversation" && !convBusy;
  const inFlow = chatReady && step && messages.length > 1 && questionLanded;
  const progressPct = awaitingName ? 0 : Math.round((stepIdx / STEPS.length) * 100);
  const progressLabel = awaitingName
    ? "Getting started"
    : stepIdx < STEPS.length
      ? `Question ${Math.min(stepIdx + 1, STEPS.length)} of ${STEPS.length}`
      : "Analyzing…";

  const reduceMotion = Boolean(useReducedMotion());
  const reveal = reduceMotion ? revealItemReduced : revealItem;
  const cat = result ? CATEGORY_MAP[result.category] : "low";
  const catMeta = CAT_META[cat];
  const marker = result ? markerPercent(result.estimatedTScore) : 50;
  const rangeLeftPct = result ? markerPercent(result.tScoreRange[0]) : 50;
  const rangeRightPct = result ? markerPercent(result.tScoreRange[1]) : 50;
  const reportedActivitySteps = parseDailyActivity(answers.averageDailySteps ?? "", 100_000);
  const reportedActivityMinutes = parseDailyActivity(answers.averageDailyActiveMinutes ?? "", 1_440);

  return (
    <div
      className="flex h-full flex-col bg-[#FAF7F2] text-[#221B16] font-[family-name:var(--font-source-sans)]"
      style={{ ["--bw-accent" as string]: ACCENT }}
    >
      <style>{`@keyframes bw-blink { 0%,80%,100% { opacity: .25; } 40% { opacity: 1; } }`}</style>

      {screen === "landing" && (
        <div
          className={`flex flex-1 flex-col overflow-y-auto overflow-x-hidden ${LANDING_BODY_FONT} text-[18px] leading-[1.6]`}
          style={{ backgroundColor: LANDING_BG, color: "#2A2320" }}
        >
          {/* Top bar */}
          <header
            className="sticky top-0 z-20 flex flex-wrap items-center gap-5 px-5 py-[18px] sm:px-16"
            style={{ borderBottom: `1px solid ${LANDING_BORDER}`, backgroundColor: LANDING_BG }}
          >
            <div className={`${LANDING_HEADING_FONT} text-[24px] font-bold tracking-[-0.01em]`} style={{ color: LANDING_INK }}>
              Bone<span style={{ color: LANDING_ACCENT }}>Bot</span>
            </div>
            <div
              className="pl-5 text-[13px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: LANDING_MUTED, borderLeft: `1px solid ${LANDING_BORDER}` }}
            >
              Hack-Nation · Challenge 05
            </div>
            <button
              onClick={startConversation}
              className={`${LANDING_HEADING_FONT} ml-auto inline-flex min-h-[48px] items-center justify-center rounded-full px-[26px] text-[16px] font-semibold text-[#FAF7F2] transition-colors duration-150`}
              style={{ backgroundColor: LANDING_ACCENT }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = LANDING_ACCENT_HOVER)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = LANDING_ACCENT)}
            >
              Start screening
            </button>
          </header>

          {/* Hero */}
          <section className="mx-auto w-full max-w-[1240px] px-5 pt-[clamp(56px,9vw,120px)] pb-[clamp(48px,7vw,96px)] sm:px-16">
            <div className="flex max-w-[880px] flex-col gap-7">
              <p
                className="m-0 flex items-center gap-3 text-[14px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: LANDING_ACCENT }}
              >
                <span className="inline-block h-px w-7" style={{ backgroundColor: LANDING_ACCENT }} />
                Bone-health screening for postmenopausal women
              </p>
              <h1
                className={`${LANDING_HEADING_FONT} text-balance text-[clamp(42px,6.5vw,84px)] font-[480] leading-[1.04] tracking-[-0.015em]`}
                style={{ color: LANDING_INK, fontOpticalSizing: "auto" }}
              >
                Know your bone risk{" "}
                <em style={{ color: LANDING_ACCENT }}>before</em> you break something.
              </h1>
              <p className="m-0 max-w-[620px] text-pretty text-[clamp(19px,1.6vw,22px)] leading-[1.6]" style={{ color: LANDING_BODY }}>
                Three minutes. An NHANES-trained model does the maths. AI turns the result into plain English.
              </p>
              <p className="m-0 max-w-[620px] text-pretty text-[clamp(19px,1.6vw,22px)] leading-[1.6]" style={{ color: LANDING_BODY }}>
                Designed around bone changes after menopause. A bone-health tool built with women in mind.
              </p>
              <div className="mt-2 flex flex-wrap gap-3.5">
                <button
                  onClick={startConversation}
                  className={`${LANDING_HEADING_FONT} inline-flex min-h-[56px] items-center justify-center rounded-full px-[34px] text-[18px] font-semibold text-[#FAF7F2] transition-colors duration-150`}
                  style={{ backgroundColor: LANDING_ACCENT }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = LANDING_ACCENT_HOVER)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = LANDING_ACCENT)}
                >
                  Start screening
                </button>
                <button
                  onClick={() => setShowExampleMenu((v) => !v)}
                  className={`${LANDING_HEADING_FONT} inline-flex min-h-[56px] items-center justify-center rounded-full border-[1.5px] px-[34px] text-[18px] font-semibold transition-colors duration-150`}
                  style={{ borderColor: LANDING_BORDER_SECONDARY, color: LANDING_INK }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = LANDING_ACCENT;
                    e.currentTarget.style.color = LANDING_ACCENT;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = LANDING_BORDER_SECONDARY;
                    e.currentTarget.style.color = LANDING_INK;
                  }}
                >
                  Try an example
                </button>
              </div>
              <p className="m-0 text-[15px]" style={{ color: LANDING_MUTED }}>
                No account. No forms. About 3 minutes.
              </p>
              {showExampleMenu && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                  className="-mt-2 flex flex-wrap gap-2.5"
                >
                  {EXAMPLE_PATIENTS.map((patient) => {
                    const isLoading = loadingExampleId === patient.id;
                    return (
                      <motion.button
                        key={patient.id}
                        whileHover={loadingExampleId ? {} : { scale: 1.03 }}
                        whileTap={loadingExampleId ? {} : { scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => void tryExample(patient.id, patient.answers, patient.name)}
                        disabled={loadingExampleId !== null}
                        className="flex flex-col items-start gap-0.5 rounded-[14px] border-[1.5px] bg-white px-4 py-2.5 text-left transition-colors disabled:cursor-default disabled:opacity-60"
                        style={{ borderColor: LANDING_BORDER_SECONDARY }}
                      >
                        <span className={`${LANDING_HEADING_FONT} flex items-center gap-1.5 text-[14px] font-semibold`} style={{ color: LANDING_INK }}>
                          {isLoading && (
                            <span
                              aria-hidden
                              className="h-3 w-3 animate-spin rounded-full border-2"
                              style={{ borderColor: LANDING_BORDER_SECONDARY, borderTopColor: LANDING_ACCENT }}
                            />
                          )}
                          {patient.label}
                        </span>
                        <span className="text-[12px]" style={{ color: LANDING_MUTED }}>
                          {isLoading ? "Loading…" : patient.blurb}
                        </span>
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </div>
          </section>

          {/* Stat moment */}
          <section style={{ backgroundColor: LANDING_BAND_BG, borderTop: `1px solid ${LANDING_BORDER}`, borderBottom: `1px solid ${LANDING_BORDER}` }}>
            <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-end gap-[clamp(24px,5vw,72px)] px-5 py-[clamp(56px,8vw,110px)] sm:px-16">
              <div
                className={`${LANDING_HEADING_FONT} whitespace-nowrap text-[clamp(110px,17vw,230px)] font-normal leading-[0.85] tracking-[-0.03em]`}
                style={{ color: LANDING_ACCENT, fontOpticalSizing: "auto" }}
              >
                1<span className="mx-[0.08em] text-[0.42em] italic">in</span>2
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3.5 pb-[clamp(4px,1vw,14px)]" style={{ flexBasis: "260px" }}>
                <p className={`${LANDING_HEADING_FONT} m-0 max-w-[26ch] text-pretty text-[clamp(22px,2.2vw,30px)] leading-[1.3]`} style={{ color: LANDING_INK }}>
                  women over 50 will fracture a bone due to osteoporosis.
                </p>
                <p className="m-0 max-w-[44ch] text-pretty text-[16px] leading-[1.6]" style={{ color: LANDING_BODY }}>
                  Most are never screened until something breaks. Bone loss after menopause is usually silent —
                  screening earlier is how you get ahead of it.
                </p>
              </div>
            </div>
          </section>

          {/* Why trust it */}
          <section className="mx-auto w-full max-w-[1240px] px-5 py-[clamp(56px,8vw,110px)] sm:px-16">
            <div className="grid gap-[clamp(28px,5vw,80px)]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
              <div className="max-w-[420px]">
                <p className="m-0 text-[14px] font-semibold uppercase tracking-[0.16em]" style={{ color: LANDING_ACCENT }}>
                  Why trust it
                </p>
                <h2 className={`${LANDING_HEADING_FONT} m-0 mt-3.5 text-balance text-[clamp(28px,3vw,40px)] font-[480] leading-[1.15]`} style={{ color: LANDING_INK }}>
                  The model predicts. The AI only explains.
                </h2>
              </div>
              <div className="flex flex-col">
                {LANDING_WHY_TRUST_IT.map((pt) => (
                  <div key={pt.num} className="grid items-baseline gap-5 py-[26px]" style={{ gridTemplateColumns: "64px 1fr", borderTop: `1px solid ${LANDING_BORDER}` }}>
                    <div className={`${LANDING_HEADING_FONT} text-[22px] italic`} style={{ color: LANDING_ORNAMENT }}>
                      {pt.num}
                    </div>
                    <div className="flex flex-col gap-2">
                      <h3 className={`${LANDING_HEADING_FONT} m-0 text-[22px] font-semibold`} style={{ color: LANDING_INK }}>
                        {pt.title}
                      </h3>
                      <p className="m-0 max-w-[58ch] text-pretty text-[17px] leading-[1.6]" style={{ color: LANDING_BODY }}>
                        {pt.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Chat preview */}
          <section style={{ backgroundColor: LANDING_BAND_BG, borderTop: `1px solid ${LANDING_BORDER}` }}>
            <div
              className="mx-auto grid w-full max-w-[1240px] items-center gap-[clamp(32px,5vw,80px)] px-5 py-[clamp(56px,8vw,110px)] sm:px-16"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}
            >
              <div className="flex flex-col gap-[18px]">
                <p className="m-0 text-[14px] font-semibold uppercase tracking-[0.16em]" style={{ color: LANDING_ACCENT }}>
                  The screening
                </p>
                <h2 className={`${LANDING_HEADING_FONT} m-0 text-balance text-[clamp(28px,3vw,40px)] font-[480] leading-[1.15]`} style={{ color: LANDING_INK }}>
                  A conversation, not a questionnaire.
                </h2>
                <p className="m-0 text-pretty text-[18px] leading-[1.65]" style={{ color: LANDING_BODY }}>
                  Four quick questions decide whether a closer look is worth your time. If it is, BoneBot asks a
                  little more — in plain language, one question at a time. Answer with a tap or in your own words.
                </p>
              </div>
              <div
                className="overflow-hidden rounded-[18px]"
                style={{ backgroundColor: LANDING_BG, border: `1px solid ${LANDING_BORDER_INPUT}`, boxShadow: "0 2px 6px rgba(60,46,32,0.05), 0 18px 40px -24px rgba(60,46,32,0.18)" }}
              >
                <div className="flex items-center gap-3 px-[22px] py-3.5" style={{ borderBottom: `1px solid ${LANDING_BORDER}` }}>
                  <span className={`${LANDING_HEADING_FONT} text-[17px] font-semibold`} style={{ color: LANDING_INK }}>
                    BoneBot
                  </span>
                  <span
                    className="ml-auto rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.06em]"
                    style={{ color: LANDING_MUTED, border: `1px solid ${LANDING_BORDER_INPUT}` }}
                  >
                    Screening flag, not a diagnosis
                  </span>
                </div>
                <div className="flex flex-col gap-3.5 px-[22px] pb-[26px] pt-6">
                  <div
                    className="max-w-[82%] self-start rounded-[14px_14px_14px_4px] bg-white px-4 py-3 text-[16px] leading-[1.55]"
                    style={{ border: `1px solid ${LANDING_BORDER}`, color: "#2A2320" }}
                  >
                    Have your periods stopped for good?
                  </div>
                  <div className="max-w-[82%] self-end rounded-[14px_14px_4px_14px] px-4 py-3 text-[16px] leading-[1.55] text-[#FAF7F2]" style={{ backgroundColor: LANDING_ACCENT }}>
                    Yes
                  </div>
                  <div
                    className="max-w-[82%] self-start rounded-[14px_14px_14px_4px] bg-white px-4 py-3 text-[16px] leading-[1.55]"
                    style={{ border: `1px solid ${LANDING_BORDER}`, color: "#2A2320" }}
                  >
                    Since age 50, have you broken a bone after a minor fall or bump?
                  </div>
                  <div className="flex flex-wrap justify-end gap-2.5">
                    {["Yes", "No"].map((opt) => (
                      <span
                        key={opt}
                        className="inline-flex min-h-[44px] items-center rounded-full border-[1.5px] px-[22px] text-[15px] font-semibold"
                        style={{ borderColor: LANDING_ACCENT, color: LANDING_ACCENT }}
                      >
                        {opt}
                      </span>
                    ))}
                    <span
                      className="inline-flex min-h-[44px] items-center rounded-full border-[1.5px] px-[22px] text-[15px] font-semibold"
                      style={{ borderColor: LANDING_BORDER_SECONDARY, color: LANDING_MUTED }}
                    >
                      Not sure
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Disclaimer band */}
          <section style={{ backgroundColor: LANDING_DISCLAIMER_BG }}>
            <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-2.5 px-5 py-[clamp(40px,5vw,64px)] sm:px-16">
              <p className={`${LANDING_HEADING_FONT} m-0 max-w-[34em] text-pretty text-[clamp(20px,2vw,26px)] leading-[1.4]`} style={{ color: LANDING_BG }}>
                BoneBot is a screening flag, not a diagnosis.
              </p>
              <p className="m-0 max-w-[40em] text-pretty text-[17px] leading-[1.6]" style={{ color: LANDING_DISCLAIMER_SUB }}>
                It does not provide medical advice — discuss results with your clinician. Only a DXA scan measures
                bone density.
              </p>
            </div>
          </section>
        </div>
      )}

      {screen === "chat" && flowMode === "classic" && (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#FAF7F2]">
          <FloatingBones />
          <header className="relative z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#E3E9E7] bg-white/90 px-6 py-4 backdrop-blur-sm sm:px-12">
            <button
              type="button"
              onClick={goToLanding}
              className="font-[family-name:var(--font-fraunces)] text-[19px] font-bold tracking-[-0.02em] cursor-pointer"
            >
              Bone<span style={{ color: ACCENT }}>Bot</span>
            </button>
            <div className="hidden h-1.5 max-w-[320px] flex-1 overflow-hidden rounded-full bg-[#E3E9E7] sm:block">
              <div
                className="h-full rounded-full transition-[width] duration-400"
                style={{ backgroundColor: ACCENT, width: `${progressPct}%` }}
              />
            </div>
            <div className="text-[13px] font-medium text-[#5A6462]">{progressLabel}</div>
            {/* Wrapped as its own group so it drops to a second line as a
                unit on narrow phones, instead of the badge or button
                individually overflowing the viewport. */}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-[#FBF3DD] px-3 py-[5px] text-xs font-semibold text-[#8A6A1F]">
                Screening flag, not a diagnosis
              </div>
              <button
                onClick={() => {
                  if (messages.length <= 1 || window.confirm("Start over? This clears your answers so far.")) restart();
                }}
                className="rounded-lg border-[1.5px] border-[#C6CFCC] px-3.5 py-[7px] text-[13px] font-semibold text-[#4A5452] hover:border-[#0E6E62] hover:text-[#0E6E62]"
              >
                Start over
              </button>
            </div>
          </header>
          <div ref={chatRef} className="relative z-10 flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto flex max-w-[680px] flex-col gap-3.5">
              {messages.map((m, i) =>
                m.role === "bot" ? <BotBubble key={i} text={m.text} /> : <UserBubble key={i} text={m.text} />
              )}
              {typing && <TypingDots />}
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
            </div>
          </div>
          <div className="relative z-10 border-t border-[#E3E9E7] bg-white/90 px-6 py-5 backdrop-blur-sm">
            <div className="mx-auto flex max-w-[680px] flex-col gap-3">

              {awaitingName && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitName();
                  }}
                  className="flex gap-2 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white p-1.5 focus-within:border-[#0E6E62]"
                >
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(event) => setNameInput(event.target.value)}
                    placeholder="Your first name (or a nickname)"
                    aria-label="What should BoneBot call you?"
                    className="flex-1 border-0 bg-transparent px-2.5 py-2 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!nameInput.trim()}
                    className="rounded-[9px] px-4.5 py-2.5 font-[family-name:var(--font-fraunces)] text-sm font-bold text-white disabled:opacity-40"
                    style={{ backgroundColor: ACCENT }}
                  >
                    Continue
                  </button>
                </form>
              )}

              {chatReady && step?.key === "bloodResults" && pendingBloodResults && !bloodEditMode && (
                <div className="flex flex-col gap-3 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white px-4 py-3.5">
                  <div className="text-sm font-semibold text-[#221B16]">Confirm blood values</div>
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
                      className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E6E62] hover:text-[#0E6E62]"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}

              {chatReady && step?.key === "bloodResults" && pendingBloodResults && bloodEditMode && (
                <div className="flex flex-col gap-3 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white px-4 py-3.5">
                  <div className="text-sm font-semibold text-[#221B16]">Edit blood values</div>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex flex-col gap-1 text-xs font-medium text-[#5A6462]">
                      Vitamin D (nmol/L)
                      <input
                        type="number"
                        inputMode="decimal"
                        value={bloodEditVitaminD}
                        onChange={(event) => setBloodEditVitaminD(event.target.value)}
                        placeholder="e.g. 55"
                        className="w-32 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E6E62]"
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
                        className="w-32 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E6E62]"
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
                      className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E6E62] hover:text-[#0E6E62]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={skipPendingBloodValues}
                      className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E6E62] hover:text-[#0E6E62]"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}

              {inFlow && step.key === "weight" && (
                <div className="flex flex-col gap-3 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white px-4 py-3.5">
                  <div className="text-sm font-semibold text-[#221B16]">Weight & height</div>
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
                          className="w-24 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E6E62]"
                        />
                        <select
                          value={weightUnit}
                          onChange={(event) => setWeightUnit(event.target.value as "kg" | "lb")}
                          className="rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#0E6E62]"
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
                            className="w-24 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E6E62]"
                          />
                        ) : (
                          <>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={heightFtInput}
                              onChange={(event) => setHeightFtInput(event.target.value)}
                              placeholder="ft"
                              className="w-16 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E6E62]"
                            />
                            <input
                              type="number"
                              inputMode="decimal"
                              value={heightInInput}
                              onChange={(event) => setHeightInInput(event.target.value)}
                              placeholder="in"
                              className="w-16 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E6E62]"
                            />
                          </>
                        )}
                        <select
                          value={heightUnit}
                          onChange={(event) => setHeightUnit(event.target.value as "cm" | "ftin")}
                          className="rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#0E6E62]"
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

              {chatReady && step && isActivityStep(step.key) && pendingActivityResult && !activityEditMode && (
                <div className="flex flex-col gap-3 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white px-4 py-3.5">
                  <div className="text-sm font-semibold text-[#221B16]">Confirm activity averages</div>
                  <div className="text-sm leading-[1.5] text-[#4A5452]">
                    {pendingActivityResult.estimatedSteps !== null &&
                      `~${pendingActivityResult.estimatedSteps.toLocaleString()} steps/day. `}
                    {pendingActivityResult.estimatedActiveMinutes !== null &&
                      `~${pendingActivityResult.estimatedActiveMinutes} active minutes/day. `}
                    These values are an approximate proxy for the daily wrist-movement measure used in model training.
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={useTheseActivityValues}
                      className="rounded-full px-5 py-2.5 text-[15px] font-medium text-white transition-colors"
                      style={{ backgroundColor: ACCENT }}
                    >
                      Use these
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
                      className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E6E62] hover:text-[#0E6E62]"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}

              {chatReady && step && isActivityStep(step.key) && pendingActivityResult && activityEditMode && (
                <div className="flex flex-col gap-3 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white px-4 py-3.5">
                  <div className="text-sm font-semibold text-[#221B16]">Edit activity averages</div>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex flex-col gap-1 text-xs font-medium text-[#5A6462]">
                      Steps per day
                      <input
                        type="number"
                        inputMode="numeric"
                        value={activityEditSteps}
                        onChange={(event) => setActivityEditSteps(event.target.value)}
                        placeholder="e.g. 6500"
                        className="w-36 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E6E62]"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-[#5A6462]">
                      Active minutes per day
                      <input
                        type="number"
                        inputMode="decimal"
                        value={activityEditMinutes}
                        onChange={(event) => setActivityEditMinutes(event.target.value)}
                        placeholder="e.g. 30"
                        className="w-36 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E6E62]"
                      />
                    </label>
                  </div>
                  {activityEditError && <div className="text-[13px] text-[#B0442F]">{activityEditError}</div>}
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={submitEditedActivityValues}
                      className="rounded-full px-5 py-2.5 text-[15px] font-medium text-white"
                      style={{ backgroundColor: ACCENT }}
                    >
                      Save & continue
                    </button>
                    <button
                      onClick={() => setActivityEditMode(false)}
                      className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E6E62] hover:text-[#0E6E62]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {inFlow && isActivityStep(step.key) && !pendingActivityResult && (
                <div className="flex flex-col gap-2.5">
                  <p className="text-[13px] leading-[1.5] text-[#5A6462]">
                    {step.key === "averageDailySteps"
                      ? ACTIVITY_QUESTIONS.steps.helper
                      : ACTIVITY_QUESTIONS.minutes.helper}
                  </p>
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
                    className="flex cursor-pointer items-center gap-3 rounded-[12px] border-[1.5px] border-dashed border-[#C6CFCC] bg-[#F5F7F6] px-4 py-3 text-sm transition-colors hover:border-[#0E6E62] hover:bg-[#E4F0ED]"
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
                      <span className="font-semibold text-[#221B16]">
                        {activityImageFiles.length >= MAX_IMAGES
                          ? "Maximum 3 photos added"
                          : "Upload a weekly Apple Health, Watch, or activity-app summary"}
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
                  </div>
                </div>
              )}

              {chatReady && step?.key === "menopause" && pendingMenopauseAge !== null && (
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={confirmMenopauseAge}
                    className="rounded-full px-5 py-2.5 text-[15px] font-medium text-white transition-colors"
                    style={{ backgroundColor: ACCENT }}
                  >
                    Yes, that&apos;s right
                  </button>
                  <button
                    onClick={rejectMenopauseAge}
                    className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E6E62] hover:text-[#0E6E62]"
                  >
                    No, let me re-enter
                  </button>
                </div>
              )}

              {chatReady && step?.key === "existingCare" && pendingExistingCareConfirm && (
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={confirmExistingCareContinue}
                    className="rounded-full px-5 py-2.5 text-[15px] font-medium text-white transition-colors"
                    style={{ backgroundColor: ACCENT }}
                  >
                    Continue the survey
                  </button>
                  <button
                    onClick={confirmExistingCareReturnHome}
                    className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E6E62] hover:text-[#0E6E62]"
                  >
                    Return home
                  </button>
                </div>
              )}

              {chatReady && step?.key === "dxaYear" && pendingRecentDxaAnswers !== null && (
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={confirmRecentDxaContinue}
                    className="rounded-full px-5 py-2.5 text-[15px] font-medium text-white transition-colors"
                    style={{ backgroundColor: ACCENT }}
                  >
                    Continue the questionnaire
                  </button>
                  <button
                    onClick={confirmRecentDxaSeeExplanation}
                    className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E6E62] hover:text-[#0E6E62]"
                  >
                    See my score explanation
                  </button>
                </div>
              )}

              {inFlow &&
                !pendingBloodResults &&
                !pendingActivityResult &&
                pendingMenopauseAge === null &&
                !pendingExistingCareConfirm &&
                pendingRecentDxaAnswers === null &&
                step.key !== "weight" && (
                <div className="flex flex-col gap-2.5">
                  {/* Questions with chip options (Yes/No, etc.) are answered
                      by tapping a chip only — free typing is reserved for
                      questions that have no chips to pick from. */}
                  {step.options.length === 0 && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitFreeInput();
                      }}
                      className="flex gap-2 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white p-1.5 focus-within:border-[#0E6E62]"
                    >
                      <input
                        ref={freeInputRef}
                        // Age has no valid non-numeric answer (unlike dxaScore/
                        // dxaYear/menopause, which also accept a typed "not
                        // sure"/"unknown"), so it's the one free-text step
                        // that can safely be restricted to digits only.
                        type={step.key === "age" || isActivityStep(step.key) ? "number" : "text"}
                        inputMode={step.key === "age" || isActivityStep(step.key) ? "numeric" : undefined}
                        value={freeInput}
                        onChange={(event) => setFreeInput(event.target.value)}
                        placeholder={
                          step.key === "age"
                            ? "Type your age in years"
                            : step.key === "averageDailySteps"
                              ? "Average steps per day"
                              : step.key === "averageDailyActiveMinutes"
                                ? "Average active minutes per day"
                                : "Type your answer, or ask a bone-health question"
                        }
                        aria-label="Answer or ask a bone-health question"
                        disabled={flowQuestionBusy || extracting}
                        className="flex-1 border-0 bg-transparent px-2.5 py-2 text-sm outline-none disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={flowQuestionBusy || extracting || !freeInput.trim()}
                        className="rounded-[9px] px-4.5 py-2.5 font-[family-name:var(--font-fraunces)] text-sm font-bold text-white disabled:opacity-40"
                        style={{ backgroundColor: ACCENT }}
                      >
                        Send
                      </button>
                    </form>
                  )}

                  {SKIPPABLE[step.key] && step.key !== "bloodResults" && (
                    <button
                      type="button"
                      onClick={skipStep}
                      disabled={flowQuestionBusy}
                      className="self-end rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E6E62] hover:text-[#0E6E62] disabled:opacity-50"
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
                        className="flex cursor-pointer items-center gap-3 rounded-[12px] border-[1.5px] border-dashed border-[#C6CFCC] bg-[#F5F7F6] px-4 py-3 text-sm transition-colors hover:border-[#0E6E62] hover:bg-[#E4F0ED]"
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
                          <span className="font-semibold text-[#221B16]">
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
                          className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E6E62] hover:text-[#0E6E62] disabled:opacity-50"
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

      {screen === "chat" && flowMode === "conversation" && (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#FAF7F2]">
          <FloatingBones />
          <header className="relative z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#E3E9E7] bg-white/90 px-6 py-4 backdrop-blur-sm sm:px-12">
            <button
              type="button"
              onClick={goToLanding}
              className="font-[family-name:var(--font-fraunces)] text-[19px] font-bold tracking-[-0.02em] cursor-pointer"
            >
              Bone<span style={{ color: ACCENT }}>Bot</span>
            </button>
            <div className="text-[13px] font-medium text-[#5A6462]">AI-led conversation</div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-[#FBF3DD] px-3 py-[5px] text-xs font-semibold text-[#8A6A1F]">
                Screening flag, not a diagnosis
              </div>
              <button
                type="button"
                onClick={startClassic}
                className="rounded-lg border-[1.5px] border-[#C6CFCC] px-3.5 py-[7px] text-[13px] font-semibold text-[#4A5452] hover:border-[#0E6E62] hover:text-[#0E6E62]"
              >
                Classic mode
              </button>
              <button
                onClick={() => {
                  if (convMessages.length <= 1 || window.confirm("Start over? This clears your answers so far.")) restart();
                }}
                className="rounded-lg border-[1.5px] border-[#C6CFCC] px-3.5 py-[7px] text-[13px] font-semibold text-[#4A5452] hover:border-[#0E6E62] hover:text-[#0E6E62]"
              >
                Start over
              </button>
            </div>
          </header>
          <div ref={convChatRef} className="relative z-10 flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto flex max-w-[680px] flex-col gap-3.5">
              {convMessages.map((m, i) =>
                m.role === "bot" ? <BotBubble key={i} text={m.text} /> : <UserBubble key={i} text={m.text} />
              )}
              {convBusy && <TypingDots />}
            </div>
          </div>
          <div className="relative z-10 border-t border-[#E3E9E7] bg-white/90 px-6 py-5 backdrop-blur-sm">
            <div className="mx-auto flex max-w-[680px] flex-col gap-3">
              {micSupported && convChatReady && convField && (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => (micListening ? stopMic() : startMic())}
                    className="flex items-center gap-2 rounded-full border-[1.5px] px-4 py-2 text-[13px] font-semibold transition-colors"
                    style={
                      micListening
                        ? { borderColor: ACCENT, backgroundColor: ACCENT, color: "#fff" }
                        : { borderColor: "#C6CFCC", color: "#4A5452" }
                    }
                  >
                    <span aria-hidden>{micListening ? "⏹" : "🎤"}</span>
                    {micListening ? "Listening… tap to stop" : "Answer by voice"}
                  </button>
                  {convConfirmMode && <span className="text-[12px] text-[#9AA5A2]">Voice mode on</span>}
                </div>
              )}

              {convChatReady &&
                convField &&
                (convInputType === "boolean" || convInputType === "choice") &&
                convOptions &&
                convOptions.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-2.5">
                    {convOptions.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => void sendConverseTurn(opt)}
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

              {convChatReady && convField && convInputType === "image" && (
                <div className="flex flex-col gap-3">
                  {pendingBloodResults && !bloodEditMode && (
                    <div className="flex flex-col gap-3 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white px-4 py-3.5">
                      <div className="text-sm font-semibold text-[#221B16]">Confirm blood values</div>
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
                          className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E6E62] hover:text-[#0E6E62]"
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  )}

                  {pendingBloodResults && bloodEditMode && (
                    <div className="flex flex-col gap-3 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white px-4 py-3.5">
                      <div className="text-sm font-semibold text-[#221B16]">Edit blood values</div>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex flex-col gap-1 text-xs font-medium text-[#5A6462]">
                          Vitamin D (nmol/L)
                          <input
                            type="number"
                            inputMode="decimal"
                            value={bloodEditVitaminD}
                            onChange={(event) => setBloodEditVitaminD(event.target.value)}
                            placeholder="e.g. 55"
                            className="w-32 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E6E62]"
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
                            className="w-32 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0E6E62]"
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
                          className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E6E62] hover:text-[#0E6E62]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={skipPendingBloodValues}
                          className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E6E62] hover:text-[#0E6E62]"
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  )}

                  {!pendingBloodResults && (
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
                        className="flex cursor-pointer items-center gap-3 rounded-[12px] border-[1.5px] border-dashed border-[#C6CFCC] bg-[#F5F7F6] px-4 py-3 text-sm transition-colors hover:border-[#0E6E62] hover:bg-[#E4F0ED]"
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
                          <span className="font-semibold text-[#221B16]">
                            {bloodImageFiles.length >= MAX_IMAGES
                              ? "Maximum 3 photos added"
                              : "Attach a photo of your blood-test results"}
                          </span>
                          <span className="text-[13px] text-[#5A6462]">
                            Up to {MAX_IMAGES} images · {bloodImageFiles.length}/{MAX_IMAGES} added.
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
                          onClick={() => void sendConverseTurn("Skip — I don't have blood-test results.")}
                          disabled={uploadBusy}
                          className="rounded-full border-[1.5px] border-[#C6CFCC] px-5 py-2.5 text-[15px] font-medium text-[#4A5452] transition-colors hover:border-[#0E6E62] hover:text-[#0E6E62] disabled:opacity-50"
                        >
                          Skip — I don&apos;t have blood-test results
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {convChatReady &&
                convField &&
                (convInputType === "text" || convInputType === "number" || convField === "confirm") && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (convInput.trim()) void sendConverseTurn(convInput.trim());
                    }}
                    className="flex gap-2 rounded-[12px] border-[1.5px] border-[#D5DCDA] bg-white p-1.5 focus-within:border-[#0E6E62]"
                  >
                    <input
                      ref={convInputRef}
                      type={convInputType === "number" ? "number" : "text"}
                      inputMode={convInputType === "number" ? "numeric" : undefined}
                      value={convInput}
                      onChange={(event) => setConvInput(event.target.value)}
                      placeholder={convField === "confirm" ? "Or type a correction…" : "Type your answer"}
                      aria-label="Answer BoneBot"
                      disabled={convBusy}
                      className="flex-1 border-0 bg-transparent px-2.5 py-2 text-sm outline-none disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={convBusy || !convInput.trim()}
                      className="rounded-[9px] px-4.5 py-2.5 font-[family-name:var(--font-fraunces)] text-sm font-bold text-white disabled:opacity-40"
                      style={{ backgroundColor: ACCENT }}
                    >
                      Send
                    </button>
                  </form>
                )}

              {convBusy && <p className="text-right text-sm text-[#5A6462]">BoneBot is thinking…</p>}
            </div>
          </div>
        </div>
      )}

      {screen === "results" && !result && (
        <MotionConfig reducedMotion="user">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#FAF7F2]">
            <FloatingBones />
            <motion.header
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className="relative z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#E3E9E7] bg-white/90 px-6 py-4 backdrop-blur-sm sm:px-12"
            >
              <button
                type="button"
                onClick={goToLanding}
                className="font-[family-name:var(--font-fraunces)] text-[19px] font-bold tracking-[-0.02em] cursor-pointer"
              >
                Bone<span style={{ color: ACCENT }}>Bot</span>
              </button>
              <div className="text-[13px] font-medium text-[#5A6462]">Initial screening result</div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <div className="rounded-full bg-[#FBF3DD] px-3 py-[5px] text-xs font-semibold text-[#8A6A1F]">
                  Screening flag, not a diagnosis
                </div>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  onClick={restart}
                  className="rounded-lg border-[1.5px] border-[#C6CFCC] px-3.5 py-[7px] text-[13px] font-semibold text-[#4A5452] hover:border-[#0E6E62] hover:text-[#0E6E62]"
                >
                  Start over
                </motion.button>
              </div>
            </motion.header>
            <div className="relative z-10 flex flex-1 items-start justify-center overflow-y-auto px-6 py-10">
              <motion.div
                variants={revealContainer}
                initial="hidden"
                animate="visible"
                className="flex w-full max-w-2xl flex-col gap-5"
              >
                <motion.section variants={reveal} className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                  <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                    Your initial screening estimate
                  </div>
                  {triageResult && (
                    <>
                      <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-3xl font-bold text-[#221B16]">
                        Very low initial risk
                      </h1>
                      <p
                        className="mt-4 font-[family-name:var(--font-fraunces)] text-6xl font-bold tracking-[-0.02em]"
                        style={{ color: ACCENT }}
                      >
                        <AnimatedNumber value={triageResult.probabilityPercent} reduceMotion={reduceMotion} />%
                      </p>
                    </>
                  )}
                  {reportedDxa && (
                    <>
                      <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-3xl font-bold text-[#221B16]">
                        Reported T-score{" "}
                        <AnimatedNumber value={reportedDxa.score} decimals={1} reduceMotion={reduceMotion} />
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
                      <h2 className="font-[family-name:var(--font-fraunces)] text-base font-bold text-[#221B16]">
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
                </motion.section>

                <motion.section variants={reveal} className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                  <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                    Trusted resources
                  </div>
                  <TrustedResources />
                </motion.section>

                <motion.button
                  variants={reveal}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  onClick={restart}
                  className="self-start rounded-[10px] px-5 py-3 font-[family-name:var(--font-fraunces)] font-bold text-white"
                  style={{ backgroundColor: ACCENT }}
                >
                  Start over
                </motion.button>
              </motion.div>
            </div>
          </div>
        </MotionConfig>
      )}

      {screen === "results" && result && (
        <MotionConfig reducedMotion="user">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#FAF7F2]">
            <FloatingBones />
            <motion.header
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className="relative z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#E3E9E7] bg-white/90 px-6 py-4 backdrop-blur-sm sm:px-12"
            >
              <button
                type="button"
                onClick={goToLanding}
                className="font-[family-name:var(--font-fraunces)] text-[19px] font-bold tracking-[-0.02em] cursor-pointer"
              >
                Bone<span style={{ color: ACCENT }}>Bot</span>
              </button>
              <div className="hidden text-[13px] font-medium text-[#5A6462] sm:block">Screening complete</div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <div className="rounded-full bg-[#FBF3DD] px-3 py-[5px] text-xs font-semibold text-[#8A6A1F]">
                  Screening flag, not a diagnosis
                </div>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => emailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  className="flex items-center gap-1.5 rounded-lg border-[1.5px] border-[#C6CFCC] px-3.5 py-[7px] text-[13px] font-semibold text-[#4A5452] hover:border-[#0E6E62] hover:text-[#0E6E62]"
                >
                  <span aria-hidden>✉️</span> Email this result
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  onClick={restart}
                  className="rounded-lg border-[1.5px] border-[#C6CFCC] px-3.5 py-[7px] text-[13px] font-semibold text-[#4A5452] hover:border-[#0E6E62] hover:text-[#0E6E62]"
                >
                  Start over
                </motion.button>
              </div>
            </motion.header>

            <div className="relative z-10 flex-1 overflow-y-auto px-6 py-8 sm:px-12">
              <div className="mx-auto grid max-w-[1140px] grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_420px] 2xl:max-w-[1360px] 2xl:grid-cols-[1fr_460px]">
                <motion.div
                  variants={revealContainer}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-col gap-5"
                >
                  {!result.validated && (
                    <motion.p
                      variants={reveal}
                      className="rounded-[14px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-700"
                    >
                      ⚠️ Illustrative: coefficients not yet trained on NHANES. Do not present these numbers as real.
                    </motion.p>
                  )}

                  <motion.div variants={reveal} className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                    <div className="mb-6 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                      {userName ? `${userName}'s screening result` : "Your screening result"}
                    </div>

                    <>
                        <div className="mb-5 flex flex-wrap items-center gap-5">
                          <motion.div
                            initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.1 }}
                            className="font-[family-name:var(--font-fraunces)] text-[52px] font-bold tracking-[-0.02em]"
                            style={{ color: catMeta.color }}
                          >
                            {catMeta.label}
                          </motion.div>
                          <motion.div
                            initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.22 }}
                            className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
                            style={{ color: catMeta.color, backgroundColor: catMeta.bg }}
                          >
                            {catMeta.chip}
                          </motion.div>
                        </div>
                        <Markdown text={summaryExplanation || catMeta.desc} className="text-pretty text-base leading-[1.6] text-[#4A5452]" />
                      </>

                    <div className="mt-8 mb-2">
                        <div className="relative pt-[26px]">
                          <div className="flex h-3.5 overflow-hidden rounded-full">
                            <div className="w-1/3" style={{ backgroundColor: "#EFC3B8" }} />
                            <div className="w-1/3" style={{ backgroundColor: "#F0DFAE" }} />
                            <div className="w-1/3" style={{ backgroundColor: "#BFDDD3" }} />
                          </div>
                          {/* Uncertainty range — the shaded area, not just the point estimate */}
                          <motion.div
                            initial={reduceMotion ? false : { left: "50%", width: 0, opacity: 0 }}
                            animate={{
                              left: `${rangeLeftPct}%`,
                              width: `${Math.max(3, rangeRightPct - rangeLeftPct)}%`,
                              opacity: 1,
                            }}
                            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.15 }}
                            className="absolute top-[26px] h-3.5 rounded-full bg-[#221B16]/12 shadow-[inset_0_0_0_1px_rgba(34,27,22,0.18)]"
                          />
                          <motion.div
                            initial={reduceMotion ? false : { left: "50%", opacity: 0 }}
                            animate={{ left: `${marker}%`, opacity: 1 }}
                            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.15 }}
                            className="absolute top-0 -translate-x-1/2 rounded-md px-2.5 py-1 text-sm font-bold text-white shadow-md"
                            style={{ backgroundColor: "#0E6E62" }}
                          >
                            {result.estimatedTScore.toFixed(1)}
                          </motion.div>
                          <motion.div
                            initial={reduceMotion ? false : { left: "50%", opacity: 0 }}
                            animate={{ left: `${marker}%`, opacity: 1 }}
                            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.15 }}
                            className="absolute top-[26px] h-3.5 w-[3px] -translate-x-1/2 rounded-sm bg-[#0E6E62]"
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
                          The shaded area is the uncertainty range — your true score most likely sits inside it. A
                          T-score compares your bone density to a healthy young adult: 0 is average, and lower
                          (more negative) means less dense bone.
                        </p>
                      </div>
                  </motion.div>

                  <motion.div variants={reveal} ref={emailSectionRef} className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-6 sm:px-8">
                    <div className="font-[family-name:var(--font-fraunces)] text-base font-bold text-[#221B16]">
                      Keep a copy of this result
                    </div>
                    <div className="mt-0.5 text-[13px] text-[#5A6462]">
                      We&apos;ll email it to you. Bring it to your GP appointment.
                    </div>

                    {emailSendState === "sent" ? (
                      <motion.p
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: EASE_OUT }}
                        className="mt-4 flex items-center gap-2 text-sm font-semibold"
                        style={{ color: ACCENT }}
                      >
                        <span aria-hidden>✓</span> Sent to {emailAddress}.
                      </motion.p>
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
                          className="flex-1 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0E6E62] disabled:opacity-50"
                        />
                        <motion.button
                          whileHover={emailSendState === "sending" ? {} : { scale: 1.02 }}
                          whileTap={emailSendState === "sending" ? {} : { scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          type="submit"
                          disabled={emailSendState === "sending" || !emailAddress.trim()}
                          className="flex items-center justify-center gap-2 whitespace-nowrap rounded-[9px] px-5 py-2.5 font-[family-name:var(--font-fraunces)] text-sm font-bold text-white disabled:opacity-50"
                          style={{ backgroundColor: ACCENT }}
                        >
                          <span aria-hidden>✉️</span> {emailSendState === "sending" ? "Sending…" : "Email this result"}
                        </motion.button>
                      </form>
                    )}
                    {emailSendState === "error" && (
                      <p className="mt-2 text-sm text-[#B0442F]">{emailSendError || "Couldn't send that email right now."}</p>
                    )}
                  </motion.div>

                  {uncertaintyNotes.length > 0 && (
                    <motion.div variants={reveal} className="rounded-2xl border border-[#E6CC89] bg-[#FFF8E8] px-7 py-7 sm:px-8">
                      <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                        Answers needing clarification
                      </div>
                      <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-[1.6] text-[#4A5452]">
                        {uncertaintyNotes.map((note, index) => (
                          <li key={`${note}-${index}`}>{note}</li>
                        ))}
                      </ul>
                    </motion.div>
                  )}

                  <motion.div variants={reveal} className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                    <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                      What drove this result
                    </div>
                    <div className="mb-3 flex items-center justify-between text-[12px] font-semibold">
                      <span style={{ color: "#B0442F" }}>← Pulls your estimate down</span>
                      <span style={{ color: ACCENT }}>Supports your bones →</span>
                    </div>
                    <div className="flex flex-col gap-3.5">
                      {(() => {
                        // Anything that rounds to 0.0 at the displayed precision
                        // isn't a driver of the result — drop it instead of
                        // showing a meaningless "+0.0"/"-0.0" bar.
                        const shownContributions = result.contributions.filter(
                          (f) => Math.round(Math.abs(f.contribution) * 10) / 10 !== 0,
                        );
                        const maxAbs = Math.max(...shownContributions.map((f) => Math.abs(f.contribution)), 0.1);
                        return shownContributions.map((f, index) => {
                          const isPositive = f.direction === "raises";
                          // A near-zero contribution isn't meaningfully raising or
                          // lowering the estimate — color it neutral grey instead of
                          // implying a direction that barely matters. Anything that
                          // survived the 0.0-rounding filter above and still displays
                          // as a real value (e.g. "+0.1") should get its real color,
                          // so this threshold is well below the display precision.
                          const isNegligible = Math.abs(f.contribution) < 0.01;
                          const factorColor = isNegligible ? "#9AA5A2" : isPositive ? ACCENT : "#B0442F";
                          const halfWidthPct = Math.max(3, Math.round((Math.abs(f.contribution) / maxAbs) * 50));
                          const detail = features ? factorDetail(f.factor, features) : { value: "" };
                          return (
                            <motion.div
                              key={f.factor}
                              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.4, ease: EASE_OUT, delay: index * 0.05 }}
                              className="flex items-center gap-3"
                            >
                              <div className="w-[110px] flex-shrink-0 sm:w-[150px]">
                                <div className="truncate text-[13px] text-[#221B16]" title={f.factor}>
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
                                <motion.div
                                  initial={reduceMotion ? false : { width: 0 }}
                                  animate={{ width: `${halfWidthPct}%` }}
                                  transition={{ duration: 0.5, ease: EASE_OUT, delay: index * 0.05 + 0.1 }}
                                  className="absolute top-0 h-full rounded-full"
                                  style={
                                    isPositive
                                      ? { left: "50%", backgroundColor: factorColor }
                                      : { right: "50%", backgroundColor: factorColor }
                                  }
                                />
                              </div>
                              <div
                                className="w-10 flex-shrink-0 text-right font-[family-name:var(--font-fraunces)] text-[13px] font-bold"
                                style={{ color: factorColor }}
                              >
                                {f.contribution > 0 ? "+" : ""}
                                <AnimatedNumber value={f.contribution} decimals={1} reduceMotion={reduceMotion} />
                              </div>
                            </motion.div>
                          );
                        });
                      })()}
                    </div>
                    <div className="mt-5 text-[13px] leading-[1.5] text-[#5A6462]">
                      Bars show how much each answer moved your estimated T-score, including answers that didn&apos;t
                      move it at all. Anything you skipped uses a population average and isn&apos;t shown here.
                      Weights follow NHANES-derived clinical risk factors.
                    </div>
                  </motion.div>

                  <motion.div variants={reveal} className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]"
                      >
                        Understanding your estimated T-score
                      </span>
                      <AIWrittenBadge />
                    </div>
                    <Markdown text={scoreExplanation} className="mt-4 text-[15px] leading-[1.65] text-[#4A5452]" />
                  </motion.div>

                  <motion.div variants={reveal} className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                        What this means for you
                      </span>
                      <AIWrittenBadge />
                    </div>
                    <Markdown text={implicationsExplanation} className="mt-4 text-[15px] leading-[1.65] text-[#4A5452]" />
                  </motion.div>

                  {bloodResults && (
                    <motion.div variants={reveal} className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                      <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">Uploaded blood results</div>
                      <p className="mt-3 text-sm leading-[1.6] text-[#4A5452]">
                        {bloodResults.vitaminD !== null && `Vitamin D: ${bloodResults.vitaminD} nmol/L. `}
                        {bloodResults.calcium !== null && `Calcium: ${bloodResults.calcium} mmol/L. `}
                        {bloodResults.alkalinePhosphatase !== null && `ALP: ${bloodResults.alkalinePhosphatase} U/L. `}
                        {bloodResults.redBloodCellCount !== null && `RBC: ${bloodResults.redBloodCellCount}. `}
                        Vitamin D and calcium are included in the current estimate; ALP and RBC are contextual only.
                      </p>
                    </motion.div>
                  )}

                  {(reportedActivitySteps !== null || reportedActivityMinutes !== null) && (
                    <motion.div variants={reveal} className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                      <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">Activity input</div>
                      <p className="mt-3 text-sm leading-[1.6] text-[#4A5452]">
                        {reportedActivitySteps !== null && `~${reportedActivitySteps.toLocaleString()} steps/day. `}
                        {reportedActivityMinutes !== null && `~${reportedActivityMinutes} active minutes/day. `}
                        Used as an approximate proxy for the daily wrist-movement measure in the training data.
                      </p>
                    </motion.div>
                  )}

                  {result.category !== "lower" && (
                    <motion.div
                      variants={reveal}
                      className="flex flex-col items-start justify-between gap-5 rounded-2xl px-7 py-6 sm:flex-row sm:items-center sm:px-8"
                      style={{ backgroundColor: ACCENT }}
                    >
                      <div>
                        <div className="font-[family-name:var(--font-fraunces)] text-[19px] font-bold text-white">
                          Next step: talk to your GP about a DXA scan
                        </div>
                        <div className="mt-1 text-sm text-[#CBE6E0]">
                          A DXA scan is the actual diagnostic test. This screening tells you whether it&apos;s worth
                          asking for one.
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => qaAsk("What's a DXA scan?")}
                        className="whitespace-nowrap rounded-[9px] bg-white px-5 py-3 font-[family-name:var(--font-fraunces)] text-sm font-bold hover:bg-[#E4F0ED]"
                        style={{ color: ACCENT }}
                      >
                        What&apos;s a DXA scan?
                      </motion.button>
                    </motion.div>
                  )}

                  {features && (
                    <motion.div variants={reveal} className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                      <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                        How your estimate changes with age
                      </div>
                      <p className="mt-1.5 text-[13px] leading-[1.5] text-[#5A6462]">
                        Same profile, run through the model at each age bracket, with everything else held fixed. Your
                        answer is highlighted.
                      </p>
                      <div className="mt-6 flex h-[150px] items-end gap-1.5 sm:gap-2.5">
                        {AGE_BRACKETS.map((bracket, index) => {
                          const projected = scoreBone({ ...features, age: AGE_MIDPOINT[bracket] });
                          const isYours = AGE_MIDPOINT[bracket] === features.age;
                          // Same color-per-band scale as every other bar — your
                          // bracket isn't a different color, it's the same scale
                          // at full strength (others fade to 70% opacity).
                          const bracketColor = bandColor(projected.estimatedTScore);
                          return (
                            <motion.div
                              key={bracket}
                              initial={reduceMotion ? false : { opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.3, delay: index * 0.04 }}
                              className="flex flex-1 flex-col items-center gap-1.5"
                            >
                              <div
                                className="text-[11px]"
                                style={{ color: isYours ? bracketColor : "#5A6462", fontWeight: isYours ? 700 : 600 }}
                              >
                                {projected.estimatedTScore}
                              </div>
                              <div className="flex h-[100px] w-full items-end">
                                <motion.div
                                  initial={reduceMotion ? false : { height: 0 }}
                                  animate={{ height: `${Math.max(6, barHeightPercent(projected.estimatedTScore))}%` }}
                                  transition={{ duration: 0.5, ease: EASE_OUT, delay: index * 0.04 + 0.1 }}
                                  className="w-full rounded-t-[4px]"
                                  style={{
                                    backgroundColor: isYours ? bracketColor : bracketColor + "70",
                                  }}
                                  title={`${bracket}: estimated T-score ${projected.estimatedTScore}`}
                                />
                              </div>
                              <div
                                className="text-center text-[10px] leading-tight"
                                style={{ color: isYours ? bracketColor : "#9AA5A2", fontWeight: isYours ? 700 : 400 }}
                              >
                                {bracket}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  <motion.div variants={reveal} className="rounded-2xl border border-[#E3E9E7] bg-white px-7 py-7 sm:px-8">
                    <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A6462]">
                      Trusted resources
                    </div>
                    <TrustedResources />
                  </motion.div>
                </motion.div>

                {/* Fixed height on mobile (stacks below the report); on large
                    screens it pins alongside the long left column and grows to
                    fill the viewport instead of leaving a short, dead panel. */}
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.15 }}
                  className="flex h-[640px] flex-col rounded-2xl border border-[#E3E9E7] bg-white lg:sticky lg:top-0 lg:h-[calc(100vh-10rem)] lg:min-h-[420px]"
                >
                  <div className="border-b border-[#E3E9E7] px-6 py-[18px]">
                    <div className="font-[family-name:var(--font-fraunces)] text-base font-bold">Ask about your result</div>
                    <div className="mt-0.5 text-[13px] text-[#5A6462]">The AI explains; it never changes your score.</div>
                  </div>
                  <div ref={qaRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-5">
                    <AnimatePresence initial={false}>
                      {qaMessages.map((m, i) => (
                        <motion.div
                          key={i}
                          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, ease: EASE_OUT }}
                        >
                          {m.kind === "resources" ? (
                            <ResourcesCard />
                          ) : m.role === "bot" ? (
                            <BotBubble text={m.text} small />
                          ) : (
                            <UserBubble text={m.text} small />
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {qaTyping && <TypingDots small />}
                  </div>
                  <div className="flex flex-col gap-2.5 border-t border-[#E3E9E7] px-5 py-3.5">
                    <div className="flex flex-wrap gap-2">
                      {[`Why is my risk ${cat}?`, "What is a DXA scan?", "What can I do now?"].map((s) => (
                        <motion.button
                          key={s}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          transition={{ duration: 0.15 }}
                          onClick={() => qaAsk(s)}
                          className="rounded-full bg-[#EEF2F0] px-3.5 py-[7px] text-[13px] font-medium hover:bg-[#DCE7E3]"
                          style={{ color: ACCENT }}
                        >
                          {s}
                        </motion.button>
                      ))}
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        onClick={showResources}
                        className="rounded-full bg-[#EEF2F0] px-3.5 py-[7px] text-[13px] font-medium hover:bg-[#DCE7E3]"
                        style={{ color: ACCENT }}
                      >
                        Where can I learn more?
                      </motion.button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={qaInput}
                        onChange={(e) => setQaInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && qaInput.trim() && qaAsk(qaInput.trim())}
                        placeholder="Type a question…"
                        aria-label="Ask about your result"
                        className="flex-1 rounded-[9px] border-[1.5px] border-[#D5DCDA] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0E6E62]"
                      />
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => qaInput.trim() && qaAsk(qaInput.trim())}
                        className="rounded-[9px] px-4.5 py-2.5 font-[family-name:var(--font-fraunces)] text-sm font-bold text-white"
                        style={{ backgroundColor: ACCENT }}
                      >
                        Send
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </MotionConfig>
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
