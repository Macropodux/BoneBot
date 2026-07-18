import { z } from "zod";
import type { BoneFeatures } from "@/lib/bone-model";
import {
  scoreTriage,
  type MenopauseStatus,
  type TriageOutput,
} from "@/lib/triage-model";

// The server owns this state machine. An LLM may explain an outcome, but it
// must never choose the next question, triage route, or screening result.
export const IntakeAnswersSchema = z.object({
  assignedFemaleAtBirth: z.boolean().optional(),
  age: z.number().int().min(18).max(120).optional(),
  menopauseStatus: z.enum(["yes", "no", "not-sure"]).optional(),
  hasExistingBoneCare: z.boolean().optional(),
  knowsDxaTScore: z.boolean().optional(),
  dxaTScore: z.number().min(-6).max(4).optional(),
  dxaYear: z.number().int().min(1900).max(2100).optional(),
  dxaYearKnown: z.boolean().optional(),
  yearsSinceMenopause: z.number().min(0).max(80).optional(),
  onHormoneTherapy: z.boolean().optional(),
  priorFragilityFracture: z.boolean().optional(),
  heightCm: z.number().min(100).max(230).optional(),
  weightKg: z.number().min(30).max(250).optional(),
  averageDailySteps: z.number().min(0).max(100000).optional(),
  currentSmoker: z.boolean().optional(),
  parentalHipFracture: z.boolean().optional(),
});

export type IntakeAnswers = z.infer<typeof IntakeAnswersSchema>;
export type IntakeInputKind = "choice" | "number" | "year";
export type IntakeChoiceValue = boolean | MenopauseStatus;

export type IntakeQuestion = {
  id: keyof IntakeAnswers;
  text: string;
  input: IntakeInputKind;
  options?: { label: string; value: IntakeChoiceValue }[];
  hint?: string;
  canSkip?: boolean;
};

export type DxaAssessment = {
  tScore: number;
  band: "osteoporosis-range" | "low-bone-density-range" | "normal-range";
  label: string;
  summary: string;
  recommendation: string;
  scanTiming: string;
};

export type IntakeResponse = {
  state:
    | "triage"
    | "not-eligible"
    | "existing-care"
    | "dxa-result"
    | "low-risk"
    | "full-assessment"
    | "ready";
  message: string;
  question: IntakeQuestion | null;
  features: BoneFeatures | null;
  missingRequired: string[];
  notes: string[];
  dxaAssessment: DxaAssessment | null;
  triage: TriageOutput | null;
};

const yesNo = [
  { label: "Yes", value: true },
  { label: "No", value: false },
] satisfies IntakeQuestion["options"];

const menopauseOptions = [
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
  { label: "Not sure", value: "not-sure" },
] satisfies IntakeQuestion["options"];

const nowYear = () => new Date().getFullYear();

function question(
  id: keyof IntakeAnswers,
  text: string,
  input: IntakeInputKind,
  options?: IntakeQuestion["options"],
  hint?: string,
  canSkip?: boolean,
): IntakeQuestion {
  return { id, text, input, options, hint, canSkip };
}

function response(
  state: IntakeResponse["state"],
  message: string,
  questionValue: IntakeQuestion | null,
  options: Partial<Omit<IntakeResponse, "state" | "message" | "question">> = {},
): IntakeResponse {
  return {
    state,
    message,
    question: questionValue,
    features: null,
    missingRequired: [],
    notes: [],
    dxaAssessment: null,
    triage: null,
    ...options,
  };
}

export function nextIntakeStep(answers: IntakeAnswers): IntakeResponse {
  if (answers.assignedFemaleAtBirth === undefined) {
    return response(
      "triage",
      "I’ll start with four short questions to choose the right next step.",
      question("assignedFemaleAtBirth", "Were you assigned female at birth?", "choice", yesNo),
    );
  }

  if (!answers.assignedFemaleAtBirth) {
    return response(
      "not-eligible",
      "BoneBot is currently calibrated for people assigned female at birth. It would not be appropriate to estimate your bone density here. A clinician can help you find the right assessment.",
      null,
    );
  }

  if (answers.age === undefined) {
    return response(
      "triage",
      "Thank you.",
      question("age", "How old are you?", "number", undefined, "Your age is used in the initial screening estimate."),
    );
  }

  if (answers.menopauseStatus === undefined) {
    return response(
      "triage",
      "One more detail helps tailor the initial screen.",
      question("menopauseStatus", "Have your periods stopped for good (menopause)?", "choice", menopauseOptions),
    );
  }

  if (answers.hasExistingBoneCare === undefined) {
    return response(
      "triage",
      "One final check before I estimate a screening probability.",
      question(
        "hasExistingBoneCare",
        "Have you already been diagnosed with osteoporosis, had a bone scan, or taken bone medication?",
        "choice",
        yesNo,
      ),
    );
  }

  if (answers.hasExistingBoneCare) return existingBoneCareStep(answers);

  const triage = scoreTriage({
    age: answers.age,
    menopauseStatus: answers.menopauseStatus,
  });
  if (!triage.proceedToFullAssessment) {
    return response(
      "low-risk",
      `Your initial screening estimate is ${triage.probabilityPercent}% — below BoneBot’s ${triage.thresholdPercent}% threshold for the full assessment.`,
      null,
      {
        triage,
        notes: [
          "This is an initial screening estimate, not a diagnosis or a measurement of bone density.",
          "The current triage coefficients are illustrative until they are trained and validated on the intended data.",
        ],
      },
    );
  }

  return fullAssessmentStep(answers, triage);
}

function existingBoneCareStep(answers: IntakeAnswers): IntakeResponse {
  if (answers.knowsDxaTScore === undefined) {
    return response(
      "existing-care",
      "Because you may already have a scan result, diagnosis, or treatment plan, I won’t replace it with an estimate.",
      question(
        "knowsDxaTScore",
        "Do you know the T-score from your most recent DXA bone-density scan?",
        "choice",
        yesNo,
        "It is usually on the scan report. If you do not know it, choose No.",
      ),
    );
  }

  if (!answers.knowsDxaTScore) {
    return response(
      "existing-care",
      "Please ask your GP or the clinic that arranged the scan for the report and its recommended follow-up. It would not be safe to substitute a new estimate here.",
      null,
    );
  }

  if (answers.dxaTScore === undefined) {
    return response(
      "existing-care",
      "I can explain the reported score, but I will not replace the original DXA report or your clinician’s advice.",
      question("dxaTScore", "What was the T-score on your most recent DXA scan?", "number", undefined, "For example: -2.1. Enter the number exactly as shown on the report."),
    );
  }

  if (answers.dxaYear === undefined && answers.dxaYearKnown !== false) {
    return response(
      "existing-care",
      "One final detail helps put the result in context.",
      question("dxaYear", "What year was that DXA scan done?", "year", undefined, "A year is enough. You can skip this if you are not sure.", true),
    );
  }

  const dxaAssessment = interpretDxaTScore(answers.dxaTScore, answers.dxaYear);
  return response("dxa-result", dxaAssessment.summary, null, {
    dxaAssessment,
    notes: ["This is an explanation of a self-reported DXA T-score, not a replacement for the scan report or clinical assessment."],
  });
}

function fullAssessmentStep(answers: IntakeAnswers, triage: TriageOutput): IntakeResponse {
  const questions: IntakeQuestion[] = [
    question("yearsSinceMenopause", "About how many years has it been since your periods stopped for good?", "number", undefined, "Enter 0 if this was within the last year."),
    question("onHormoneTherapy", "Are you currently taking hormone replacement therapy (HRT)?", "choice", yesNo),
    question("priorFragilityFracture", "Since age 50, have you broken a bone after a minor fall, knock, or injury?", "choice", yesNo),
    question("heightCm", "What is your height in centimetres?", "number", undefined, "For example: 165 cm."),
    question("weightKg", "What is your weight in kilograms?", "number", undefined, "For example: 62 kg."),
    question("averageDailySteps", "About how many steps do you average each day?", "number", undefined, "Use your watch or phone average if you have it. A rough estimate is fine."),
    question("currentSmoker", "Do you currently smoke?", "choice", yesNo),
    question("parentalHipFracture", "Has either of your parents had a hip fracture?", "choice", yesNo),
  ];

  const next = questions.find((item) => answers[item.id] === undefined);
  if (next) {
    return response("full-assessment", "Your initial screen is above the 5% threshold, so I’ll ask a few more questions for the T-score estimate.", next, {
      missingRequired: requiredFeatureLabels(answers),
      triage,
    });
  }

  return response("ready", "Thank you. I have the information needed to create your screening estimate.", null, {
    features: toBoneFeatures(answers),
    triage,
    notes: [
      "BMI was calculated from the height and weight you entered.",
      "Weight-bearing activity was estimated from average daily steps using a provisional rubric: under 3,000 = 0.15; 3,000–4,999 = 0.30; 5,000–7,999 = 0.50; 8,000–9,999 = 0.70; 10,000+ = 0.85.",
      "The current model uses disclosed default values for glucocorticoid use, rheumatoid arthritis, high alcohol intake, vitamin D, and calcium because this short questionnaire does not collect them.",
    ],
  });
}

function requiredFeatureLabels(answers: IntakeAnswers): string[] {
  const labels: [keyof IntakeAnswers, string][] = [
    ["yearsSinceMenopause", "years since menopause"],
    ["onHormoneTherapy", "hormone therapy"],
    ["priorFragilityFracture", "prior fragility fracture"],
    ["heightCm", "height"],
    ["weightKg", "weight"],
    ["averageDailySteps", "average daily steps"],
    ["currentSmoker", "current smoking"],
    ["parentalHipFracture", "parental hip fracture"],
  ];
  return labels.filter(([key]) => answers[key] === undefined).map(([, label]) => label);
}

function toBoneFeatures(answers: IntakeAnswers): BoneFeatures {
  const heightMetres = answers.heightCm! / 100;
  return {
    age: answers.age!,
    yearsSinceMenopause: answers.yearsSinceMenopause!,
    onHormoneTherapy: answers.onHormoneTherapy!,
    priorFragilityFracture: answers.priorFragilityFracture!,
    bmi: round1(answers.weightKg! / (heightMetres * heightMetres)),
    weightBearingActivity: activityFromSteps(answers.averageDailySteps!),
    currentSmoker: answers.currentSmoker!,
    parentalHipFracture: answers.parentalHipFracture!,
    glucocorticoids: false,
    rheumatoidArthritis: false,
    highAlcohol: false,
    vitaminD: 50,
    calcium: 2.4,
  };
}

function activityFromSteps(steps: number): number {
  if (steps < 3000) return 0.15;
  if (steps < 5000) return 0.3;
  if (steps < 8000) return 0.5;
  if (steps < 10000) return 0.7;
  return 0.85;
}

function interpretDxaTScore(tScore: number, year?: number): DxaAssessment {
  const band = tScore <= -2.5 ? "osteoporosis-range" : tScore < -1 ? "low-bone-density-range" : "normal-range";
  const label = band === "osteoporosis-range" ? "Osteoporosis range" : band === "low-bone-density-range" ? "Low bone density range" : "Normal bone-density range";
  const summary = `The T-score you reported (${tScore.toFixed(1)}) is in the ${label.toLowerCase()} on the DXA scale. This is a reported scan result, not a BoneBot estimate.`;
  const recommendation =
    band === "osteoporosis-range"
      ? "Please discuss the report and your fracture risk with your GP or osteoporosis service. Keep following any existing treatment plan unless your clinician changes it."
      : band === "low-bone-density-range"
        ? "Discuss the report alongside your wider fracture risk with your GP, especially if you have had a recent fracture or your health or medicines have changed. Weight-bearing and resistance activity, if safe for you, can support bone health."
        : "This score is reassuring, but it should still be read alongside the original report, your fracture history, and any current treatment plan. Continue bone-healthy lifestyle habits and discuss new concerns with your GP.";
  return { tScore, band, label, summary, recommendation, scanTiming: scanTimingMessage(year) };
}

function scanTimingMessage(year?: number): string {
  if (!year) return "Bone density changes slowly, but repeat-scan timing is individual. Ask your clinician when your last scan should be reviewed.";
  const age = Math.max(0, nowYear() - year);
  if (age <= 2) return `Your scan was in ${year}. It is relatively recent, but its meaning still depends on the original report, your treatment, fractures, and other risk factors.`;
  if (age <= 5) return `Your scan was in ${year}. Follow-up DXA scans are commonly spaced about 2–5 years apart, but the right timing depends on your risk factors and treatment plan.`;
  return `Your scan was in ${year}. Because it is more than five years old, ask your clinician whether your bone health and fracture risk should be reassessed sooner, especially if anything has changed.`;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
