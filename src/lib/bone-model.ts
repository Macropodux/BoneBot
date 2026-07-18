// THE MODEL — deterministic bone-health risk scoring.
//
// This is the science, and it is the part a physician stands behind. It MUST be
// trained on real NHANES DXA (bone-density) data. Right now the coefficients are
// PLACEHOLDERS: the directions are textbook and defensible, the magnitudes are
// invented.
//
// 🔴 DO NOT present these numbers as validated. Emre: replace COEFFICIENTS with
//    the NHANES-trained logistic-regression coefficients, then flip
//    MODEL_IS_VALIDATED to true. Until then the UI shows a "not yet validated"
//    banner so nobody demos placeholder numbers as real.
//
// Why logistic regression: the challenge and good sense both favor a model that
// is calibrated and explainable over a big opaque one. Scoring is a dot product
// plus a sigmoid — trivial to run here in TS from exported coefficients, so the
// whole app stays in the deployed scaffold with no separate Python service.
//
// Architecture rule (see api/screen/route.ts): the MODEL predicts; the LLM only
// EXPLAINS the model's output. The LLM never sets the risk. That keeps every
// number traceable to validated data.

export type BoneFeatures = {
  age: number; // years
  yearsSinceMenopause: number; // years since final menstrual period
  onHormoneTherapy: boolean;
  priorFragilityFracture: boolean;
  bmi: number; // kg/m^2
  weightBearingActivity: number; // 0-1, derived from wearable steps / active minutes
  currentSmoker: boolean;
  parentalHipFracture: boolean;
};

// Log-odds coefficients. DIRECTIONS are textbook (safe to show); MAGNITUDES are
// placeholders pending NHANES training.
const COEFFICIENTS = {
  intercept: -1.5,
  age: 0.04, // older → higher risk
  yearsSinceMenopause: 0.06, // longer since estrogen loss → higher risk
  onHormoneTherapy: -0.5, // protective
  priorFragilityFracture: 1.1, // strong known risk factor
  bmi: -0.06, // higher BMI is protective for bone density (to a point)
  weightBearingActivity: -0.8, // activity protects bone — the wearable lever
  currentSmoker: 0.4,
  parentalHipFracture: 0.5,
};

// Flip to true ONLY when COEFFICIENTS come from NHANES-trained, validated model.
export const MODEL_IS_VALIDATED = false;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export type FactorContribution = {
  factor: string;
  contribution: number; // signed log-odds contribution for this person
  direction: "raises" | "lowers";
};

export type ModelOutput = {
  probability: number; // 0-1, predicted risk of low bone density
  category: "elevated" | "uncertain" | "lower";
  confidence: number; // 0-100
  contributions: FactorContribution[]; // sorted by magnitude — the explanation
  validated: boolean;
};

export function scoreBone(f: BoneFeatures): ModelOutput {
  const terms: [string, number][] = [
    ["Age", COEFFICIENTS.age * f.age],
    ["Years since menopause", COEFFICIENTS.yearsSinceMenopause * f.yearsSinceMenopause],
    ["Hormone therapy", COEFFICIENTS.onHormoneTherapy * (f.onHormoneTherapy ? 1 : 0)],
    ["Prior fragility fracture", COEFFICIENTS.priorFragilityFracture * (f.priorFragilityFracture ? 1 : 0)],
    ["Body mass index", COEFFICIENTS.bmi * f.bmi],
    ["Weight-bearing activity", COEFFICIENTS.weightBearingActivity * f.weightBearingActivity],
    ["Current smoker", COEFFICIENTS.currentSmoker * (f.currentSmoker ? 1 : 0)],
    ["Parental hip fracture", COEFFICIENTS.parentalHipFracture * (f.parentalHipFracture ? 1 : 0)],
  ];

  const logit = COEFFICIENTS.intercept + terms.reduce((s, [, v]) => s + v, 0);
  const probability = sigmoid(logit);

  // The no-call band: honesty over false confidence. A confident wrong screen
  // is worse than "uncertain — get a scan to be sure". Tune with the real model.
  let category: ModelOutput["category"];
  if (probability >= 0.6) category = "elevated";
  else if (probability <= 0.35) category = "lower";
  else category = "uncertain";

  // Placeholder confidence: distance from the coin-flip line. The real version
  // uses the calibrated model's reliability (Brier / reliability curve).
  const confidence = Math.round(Math.min(1, Math.abs(probability - 0.5) * 2) * 100);

  const contributions = terms
    .filter(([, v]) => Math.abs(v) > 1e-3)
    .map(([factor, v]): FactorContribution => ({
      factor,
      contribution: v,
      direction: v > 0 ? "raises" : "lowers",
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return { probability, category, confidence, contributions, validated: MODEL_IS_VALIDATED };
}
