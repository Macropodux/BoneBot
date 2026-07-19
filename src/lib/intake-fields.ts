// BoneBot — field schema + deterministic gate/triage/assembly logic for the
// conversational intake (/api/converse). This is the ONLY thing that decides
// eligibility, the next question, the triage stop, and the final BoneFeatures
// object. An LLM may extract a candidate value from free text and phrase a
// question, but it never runs any of the logic in this file — see AGENTS.md
// ("the model predicts, the LLM only explains") and api/converse/route.ts.
//
// Field set, ranges, and defaults are derived from (and kept consistent
// with) the existing scripted flow — src/app/page.tsx's STEPS array,
// normaliseFreeAnswer(), and mapAnswersToFeatures() — plus bone-model.ts's
// BoneFeatures and triage-model.ts's scoreTriage(). Those files are NOT
// modified; this is an additive alternative intake.

import type { BoneFeatures } from "@/lib/bone-model";
import { scoreTriage, type MenopauseStatus, type TriageOutput } from "@/lib/triage-model";
import { ACTIVITY_QUESTIONS, activityLevelFromDailyAverages, parseDailyActivity } from "@/lib/activity-input";
import { tScoreModel, SECONDARY_CONDITION_TRAINED } from "../../model/model-parameters";

export type Collected = Record<string, unknown>;

export type FieldStage = "triage" | "deep";
export type FieldInputType = "text" | "boolean" | "number" | "choice" | "image";

export type FieldKey =
  | "assignedFemaleAtBirth"
  | "age"
  | "menopauseStatus"
  | "hasExistingBoneCare"
  | "menopauseAge"
  | "priorFragilityFracture"
  | "currentSmoker"
  | "glucocorticoids"
  | "weightKg"
  | "heightCm"
  | "averageDailySteps"
  | "averageDailyActiveMinutes"
  | "secondaryCondition"
  | "vitaminD"
  | "calcium";

// null is a distinct, valid "explicitly skipped -> use the population default"
// sentinel — different from `undefined` (field not yet collected at all).
export type FieldValue = string | number | boolean | null;

export type ParseResult = { ok: true; value: FieldValue } | { ok: false };

export type FieldDef = {
  key: FieldKey;
  question: string;
  inputType: FieldInputType;
  options?: string[];
  stage: FieldStage;
  // Whether this field must be resolved (a real value OR an explicit skip)
  // before the deep stage can finish. Fields with required:false are never
  // put on the "ask next" queue — they stay on the population default unless
  // the user volunteers them (or a client-side upload flow, e.g. the existing
  // /api/blood-results photo route, pre-populates them into `collected`).
  required: boolean;
  // Whether a "skip / not sure" reply is accepted as a valid answer (stored
  // as `null`, resolved to the model's population-average default at
  // assembly time) rather than being rejected as unparseable.
  skippable: boolean;
  // Short parsing guidance surfaced to the extraction LLM only — never used
  // for validation itself.
  hint?: string;
  // Deterministic validator. The LLM only ever PROPOSES a raw string; this
  // function is what actually decides whether it becomes a stored value.
  parse: (raw: string) => ParseResult;
};

// Mirrors src/app/page.tsx's MENOPAUSE_CERTAIN_AGE: by this age menopausal
// status is medically settled, so we infer postmenopausal rather than asking.
// Duplicated (not imported) because page.tsx is a client component, not a lib.
export const MENOPAUSE_CERTAIN_AGE = 60;

// Mirrors src/app/page.tsx's BMI_RANGE sanity check on the weight+height step.
export const BMI_RANGE = { min: 12, max: 60 } as const;

// Mirrors the blood-results manual-edit ranges in src/app/page.tsx
// (VITAMIN_D_RANGE / CALCIUM_RANGE).
const VITAMIN_D_RANGE = { min: 10, max: 250 } as const;
const CALCIUM_RANGE = { min: 1.5, max: 3.5 } as const;

const round1 = (value: number) => Math.round(value * 10) / 10;

const SKIP_RE = /^(skip|n\/a|na|no idea|unknown|not[- ]?sure|don'?t know|do not know)$/i;

function parseBoolean(raw: string): ParseResult {
  const t = raw.trim().toLowerCase();
  if (/^(yes|y|true|yeah|yep)$/.test(t)) return { ok: true, value: true };
  if (/^(no|n|false|nope|never)$/.test(t)) return { ok: true, value: false };
  return { ok: false };
}

function parseSkippableBoolean(raw: string): ParseResult {
  if (SKIP_RE.test(raw.trim().toLowerCase())) return { ok: true, value: null };
  return parseBoolean(raw);
}

// values: canonical lowercase option values (e.g. ["yes", "no"]). A skip /
// "not sure" reply resolves to the literal string "not-sure" — a genuine
// answer for fields like menopauseStatus, not a null "no value" sentinel.
function parseChoice(values: string[]) {
  return (raw: string): ParseResult => {
    const t = raw.trim().toLowerCase();
    if (!t) return { ok: false };
    if (SKIP_RE.test(t)) return { ok: true, value: "not-sure" };
    for (const v of values) {
      if (t === v || t.startsWith(v)) return { ok: true, value: v };
    }
    return { ok: false };
  };
}

function parseNumber(min: number, max: number, opts: { integer?: boolean } = {}, skippable = false) {
  return (raw: string): ParseResult => {
    const t = raw.trim();
    if (!t) return { ok: false };
    if (skippable && SKIP_RE.test(t.toLowerCase())) return { ok: true, value: null };
    const cleaned = t.replace(/[^0-9.+-]/g, "");
    if (!cleaned) return { ok: false };
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return { ok: false };
    if (opts.integer && !Number.isInteger(n)) return { ok: false };
    if (n < min || n > max) return { ok: false };
    return { ok: true, value: n };
  };
}

// Reuses the shared activity-input parser (same comma-stripping and skip-word
// handling as the scripted flow) but keeps "explicit skip" and "could not
// parse" distinguishable, which parseDailyActivity alone collapses to null.
function parseActivity(max: number) {
  return (raw: string): ParseResult => {
    const t = raw.trim();
    if (!t) return { ok: false };
    if (SKIP_RE.test(t.toLowerCase())) return { ok: true, value: null };
    const v = parseDailyActivity(t, max);
    return v === null ? { ok: false } : { ok: true, value: v };
  };
}

export const FIELDS: FieldDef[] = [
  // ---------------- TRIAGE (ordered) ----------------
  // Feeds scoreTriage() + the eligibility gates. Always asked in this order.
  {
    key: "assignedFemaleAtBirth",
    question: "Were you assigned female at birth?",
    inputType: "boolean",
    options: ["Yes", "No"],
    stage: "triage",
    required: true,
    skippable: false,
    parse: parseBoolean,
  },
  {
    key: "age",
    question: "How old are you?",
    inputType: "number",
    stage: "triage",
    required: true,
    skippable: false,
    hint: "An age in years, 18-110.",
    parse: parseNumber(18, 110, { integer: true }),
  },
  {
    key: "menopauseStatus",
    question: "Have your periods stopped for good?",
    inputType: "choice",
    options: ["Yes", "No", "Not sure"],
    stage: "triage",
    required: true,
    skippable: false,
    parse: parseChoice(["yes", "no"]),
  },
  {
    key: "hasExistingBoneCare",
    question:
      "Have you been diagnosed with osteoporosis, had a DXA bone-density scan, or taken medicine for your bones?",
    inputType: "boolean",
    options: ["Yes", "No"],
    stage: "triage",
    required: true,
    skippable: false,
    parse: parseBoolean,
  },

  // ---------------- DEEP (required, "next uncollected" order) ----------------
  {
    key: "menopauseAge",
    question: "At what age did you reach menopause? If you're not sure, just say so.",
    inputType: "number",
    stage: "deep",
    required: true,
    skippable: true,
    hint: "Age in years, roughly 18-70, or a skip word such as 'not sure'.",
    parse: parseNumber(18, 70, {}, true),
  },
  {
    key: "priorFragilityFracture",
    question:
      "Since age 50, have you broken a bone after a minor fall, bump, or similar low-impact injury?",
    inputType: "boolean",
    options: ["Yes", "No"],
    stage: "deep",
    required: true,
    skippable: true,
    parse: parseSkippableBoolean,
  },
  {
    key: "currentSmoker",
    question: "Do you currently smoke?",
    inputType: "boolean",
    options: ["Yes", "No"],
    stage: "deep",
    required: true,
    skippable: true,
    parse: parseSkippableBoolean,
  },
  {
    key: "glucocorticoids",
    question:
      "Have you taken corticosteroid tablets, such as prednisolone or prednisone, for three months or longer?",
    inputType: "boolean",
    options: ["Yes", "No"],
    stage: "deep",
    required: true,
    skippable: true,
    parse: parseSkippableBoolean,
  },
  {
    key: "weightKg",
    question:
      'What are your weight and height? BoneBot uses them to calculate your BMI (e.g. "70 kg, 165 cm").',
    inputType: "text",
    stage: "deep",
    required: true,
    skippable: true,
    hint: "A weight in kilograms, roughly 30-250.",
    parse: parseNumber(30, 250, {}, true),
  },
  {
    key: "heightCm",
    question: "And your height, in centimetres?",
    inputType: "number",
    stage: "deep",
    required: true,
    skippable: true,
    hint: "A height in centimetres, roughly 100-230.",
    parse: parseNumber(100, 230, {}, true),
  },
  {
    key: "averageDailySteps",
    question: ACTIVITY_QUESTIONS.steps.question,
    inputType: "number",
    stage: "deep",
    required: true,
    skippable: true,
    hint: ACTIVITY_QUESTIONS.steps.helper,
    parse: parseActivity(100_000),
  },
  {
    key: "averageDailyActiveMinutes",
    question: ACTIVITY_QUESTIONS.minutes.question,
    inputType: "number",
    stage: "deep",
    required: true,
    skippable: true,
    hint: ACTIVITY_QUESTIONS.minutes.helper,
    parse: parseActivity(1_440),
  },
  // Appended (not inserted) and gated on SECONDARY_CONDITION_TRAINED, exactly
  // like page.tsx's STEPS array, so field order stays stable either way.
  ...(SECONDARY_CONDITION_TRAINED
    ? [
        {
          key: "secondaryCondition" as const,
          question: "Have you been diagnosed with thyroid disease or chronic kidney disease?",
          inputType: "choice" as const,
          options: ["Yes", "No", "Not sure"],
          stage: "deep" as const,
          required: true,
          skippable: true,
          parse: parseChoice(["yes", "no"]),
        },
      ]
    : []),

  // ---------- DEEP, optional (never actively asked) ----------
  // Mirrors FIELD_DEFAULTS / SKIPPABLE in page.tsx: blood-test values are
  // user-provided only when given (typically via the existing photo-upload
  // route, which the client can use to pre-populate `collected` before/between
  // /api/converse turns) — this endpoint never prompts for them itself, so it
  // never needs to handle image bytes. Still declared here (inputType
  // "image") so a client knows how to collect them if it chooses to.
  {
    key: "vitaminD",
    question: "Do you have a recent vitamin D blood-test result? You can upload a photo, or tell me the number.",
    inputType: "image",
    stage: "deep",
    required: false,
    skippable: true,
    hint: `A vitamin D value in nmol/L, roughly ${VITAMIN_D_RANGE.min}-${VITAMIN_D_RANGE.max}.`,
    parse: parseNumber(VITAMIN_D_RANGE.min, VITAMIN_D_RANGE.max, {}, true),
  },
  {
    key: "calcium",
    question: "Do you have a recent calcium blood-test result?",
    inputType: "image",
    stage: "deep",
    required: false,
    skippable: true,
    hint: `A serum calcium value in mmol/L, roughly ${CALCIUM_RANGE.min}-${CALCIUM_RANGE.max}.`,
    parse: parseNumber(CALCIUM_RANGE.min, CALCIUM_RANGE.max, {}, true),
  },
];

const FIELD_MAP = new Map(FIELDS.map((f) => [f.key, f]));

export function getField(key: string): FieldDef | undefined {
  return FIELD_MAP.get(key as FieldKey);
}

const DEEP_REQUIRED_KEYS = FIELDS.filter((f) => f.stage === "deep" && f.required).map((f) => f.key);

// All fields not yet collected — offered to the extraction LLM as its
// candidate set so one reply can fill in several fields at once. The
// existing-care routing choice ("Continue / Head home") is NOT a field here;
// it is a deterministic routing marker handled entirely in api/converse.
export function outstandingApplicableFields(collected: Collected): FieldDef[] {
  return FIELDS.filter((f) => collected[f.key] === undefined);
}

// Silent, deterministic inferences applied after merging any new extracted
// values and before re-deciding the next step. Never LLM-driven.
export function applyDeterministicInferences(collected: Collected): Collected {
  const next = { ...collected };

  // Mirrors page.tsx's MENOPAUSE_CERTAIN_AGE gate-skip: by this age,
  // menopausal status is medically settled, so infer it instead of asking.
  if (typeof next.age === "number" && next.age >= MENOPAUSE_CERTAIN_AGE && next.menopauseStatus === undefined) {
    next.menopauseStatus = "yes";
  }

  // The weight+height question is presented and answered as ONE step (like
  // page.tsx's dedicated BMI entry) — if either half was explicitly skipped,
  // treat both as skipped so the flow doesn't stall waiting on the other half.
  if (next.weightKg === null || next.heightCm === null) {
    next.weightKg = null;
    next.heightCm = null;
  }

  // BMI sanity check (mirrors page.tsx's BMI_RANGE guard on submitWeightHeight):
  // an out-of-range combination is almost always a unit mix-up, not a real
  // person — revert both so the flow re-asks rather than silently scoring
  // a nonsense BMI.
  if (typeof next.weightKg === "number" && typeof next.heightCm === "number") {
    const bmi = round1(next.weightKg / (next.heightCm / 100) ** 2);
    if (bmi < BMI_RANGE.min || bmi > BMI_RANGE.max) {
      delete next.weightKg;
      delete next.heightCm;
    }
  }

  return next;
}

export const SEX_INELIGIBLE_MESSAGE =
  "BoneBot's model was trained for adults assigned female at birth around and after menopause, so it cannot provide a reliable estimate here. Please speak with a clinician about your bone health.";

export const NOT_POSTMENOPAUSAL_MESSAGE =
  "BoneBot is calibrated for use around and after menopause, so this screening tool isn't the right fit for you right now. If you have any bone-health concerns in the meantime, please speak with your GP.";

// Existing-care routing gate (see decide() and api/converse). Deterministic,
// server-owned copy — the LLM never phrases these.
export const EXISTING_CARE_GP_MESSAGE =
  "Since you've already been diagnosed or scanned, it's best to discuss any bone-health questions with your GP. Would you like to continue the questionnaire anyway, or head back home?";

export const EXISTING_CARE_HOME_MESSAGE =
  "No problem — since you've already been diagnosed or scanned, your GP is the best person to talk to about your bone health. Take care.";

export type Decision =
  | { kind: "gateExit"; message: string }
  | { kind: "gateChoice"; message: string; field: string; options: string[] }
  | { kind: "triageStop"; message: string; triage: TriageOutput }
  | { kind: "ask"; field: FieldDef }
  | { kind: "ready" };

// THE deterministic core: gates, the triage decision, and next-question
// selection. No LLM call happens anywhere in this function — see AGENTS.md.
export function decide(collected: Collected): Decision {
  const assignedFemaleAtBirth = collected.assignedFemaleAtBirth;
  if (assignedFemaleAtBirth === undefined) return { kind: "ask", field: getField("assignedFemaleAtBirth")! };
  if (assignedFemaleAtBirth === false) return { kind: "gateExit", message: SEX_INELIGIBLE_MESSAGE };

  const age = collected.age;
  if (typeof age !== "number") return { kind: "ask", field: getField("age")! };

  const menopauseStatus = collected.menopauseStatus;
  if (menopauseStatus === undefined) return { kind: "ask", field: getField("menopauseStatus")! };
  if (menopauseStatus === "no" && age < MENOPAUSE_CERTAIN_AGE) {
    return { kind: "gateExit", message: NOT_POSTMENOPAUSAL_MESSAGE };
  }

  const hasExistingBoneCare = collected.hasExistingBoneCare;
  if (hasExistingBoneCare === undefined) return { kind: "ask", field: getField("hasExistingBoneCare")! };

  if (hasExistingBoneCare === true) {
    // Already diagnosed / scanned / on bone medication: we don't run our own
    // screening on top of existing care. Recommend the GP and offer a
    // deterministic routing choice — continue the questionnaire anyway, or
    // head home. The reply is captured and parsed in api/converse; this gate
    // never asks for a T-score or scan year.
    const continueOrHome = collected.continueOrHome;
    if (continueOrHome === undefined) {
      return {
        kind: "gateChoice",
        message: EXISTING_CARE_GP_MESSAGE,
        field: "continueOrHome",
        options: ["Continue", "Head home"],
      };
    }
    if (continueOrHome === "head-home") {
      return { kind: "gateExit", message: EXISTING_CARE_HOME_MESSAGE };
    }
    // continueOrHome === "continue" -> fall through to ordinary triage +
    // deep questionnaire, exactly as if there were no existing diagnosis.
  }

  const triage = scoreTriage({ age, menopauseStatus: menopauseStatus as MenopauseStatus });
  if (!triage.proceedToFullAssessment) {
    return {
      kind: "triageStop",
      message: `Your initial screening estimate is ${triage.probabilityPercent}%, which is below BoneBot's threshold for opening the longer questionnaire. This does not rule out osteoporosis or replace clinical advice.`,
      triage,
    };
  }

  for (const key of DEEP_REQUIRED_KEYS) {
    if (collected[key] === undefined) return { kind: "ask", field: getField(key)! };
  }

  return { kind: "ready" };
}

// Assembles the final BoneFeatures the client sends to the EXISTING
// /api/screen route. Every value here is either a validated, user-supplied
// answer or the model's own published population-average default — never an
// LLM guess. Mirrors mapAnswersToFeatures()/FIELD_DEFAULTS in page.tsx.
export function assembleFeatures(collected: Collected): BoneFeatures {
  const age = collected.age as number;

  const menopauseAge = typeof collected.menopauseAge === "number" ? collected.menopauseAge : null;
  const yearsSinceMenopause =
    menopauseAge !== null ? Math.max(0, age - menopauseAge) : tScoreModel.imputationDefaults.yearsSinceMenopause;

  const weightKg = typeof collected.weightKg === "number" ? collected.weightKg : null;
  const heightCm = typeof collected.heightCm === "number" ? collected.heightCm : null;
  const bmi =
    weightKg !== null && heightCm !== null
      ? round1(weightKg / (heightCm / 100) ** 2)
      : tScoreModel.imputationDefaults.bmi;

  const steps = typeof collected.averageDailySteps === "number" ? collected.averageDailySteps : null;
  const minutes = typeof collected.averageDailyActiveMinutes === "number" ? collected.averageDailyActiveMinutes : null;
  const weightBearingActivity = activityLevelFromDailyAverages(steps, minutes) ?? tScoreModel.imputationDefaults.activityLevel;

  const boolOrDefault = (v: unknown, d: number) => (typeof v === "boolean" ? v : Boolean(d));
  const choiceBoolOrDefault = (v: unknown, d: number) => (v === "yes" ? true : v === "no" ? false : Boolean(d));

  return {
    age,
    yearsSinceMenopause,
    // Never asked in this short flow — same illustrative population default
    // as page.tsx's FIELD_DEFAULTS, not a measurement.
    onHormoneTherapy: Boolean(tScoreModel.imputationDefaults.onHormoneTherapy),
    priorFragilityFracture: boolOrDefault(collected.priorFragilityFracture, tScoreModel.imputationDefaults.priorFragilityFracture),
    bmi,
    weightBearingActivity,
    currentSmoker: boolOrDefault(collected.currentSmoker, tScoreModel.imputationDefaults.currentSmoker),
    glucocorticoids: boolOrDefault(collected.glucocorticoids, tScoreModel.imputationDefaults.glucocorticoids),
    rheumatoidArthritis: Boolean(tScoreModel.imputationDefaults.rheumatoidArthritis),
    highAlcohol: Boolean(tScoreModel.imputationDefaults.highAlcohol),
    vitaminD: typeof collected.vitaminD === "number" ? collected.vitaminD : tScoreModel.imputationDefaults.vitaminD,
    calcium: typeof collected.calcium === "number" ? collected.calcium : tScoreModel.imputationDefaults.calcium,
    secondaryCondition: choiceBoolOrDefault(collected.secondaryCondition, tScoreModel.imputationDefaults.secondaryCondition),
  };
}
