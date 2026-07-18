// THE MODEL — deterministic estimated-T-score regression.
//
// This is the science, and it is the part a physician stands behind. It MUST be
// trained on real NHANES DXA (bone-density) data. Right now the coefficients are
// PLACEHOLDERS: the directions are textbook and defensible, the magnitudes are
// invented.
//
// 🔴 DO NOT present these numbers as validated. Emre: replace COEFFICIENTS with
//    the NHANES-trained regression coefficients (and RANGE_HALF_WIDTH with the
//    model's residual spread / prediction interval), then flip MODEL_IS_VALIDATED
//    to true. Until then the UI shows a "not yet validated" banner.
//
// What it predicts: an ESTIMATED T-SCORE — a bone-density value on the same
// clinical scale a DXA scan uses (normal ≥ -1.0, osteopenia -2.5..-1.0,
// osteoporosis ≤ -2.5). We learn profile → T-score from NHANES women who WERE
// scanned, then estimate it for a woman who was NOT. It is an estimate WITH
// UNCERTAINTY, never a measurement — so we always return a range, and the screen
// says "a DXA scan gives the real T-score".
//
// Why linear regression: the challenge and good sense both favor a model that is
// interpretable and honest about uncertainty over a big opaque one. Scoring is a
// dot product — trivial to run here in TS from exported coefficients, so the whole
// app stays in the deployed scaffold with no separate Python service.
//
// Architecture rule (see api/screen/route.ts): the MODEL predicts the number; the
// LLM only EXPLAINS it. The LLM never sets the T-score.

export type BoneFeatures = {
  age: number; // years
  yearsSinceMenopause: number; // years since final menstrual period
  onHormoneTherapy: boolean;
  priorFragilityFracture: boolean;
  bmi: number; // kg/m^2
  weightBearingActivity: number; // 0-1, derived from wearable steps / active minutes
  currentSmoker: boolean;
  parentalHipFracture: boolean;
  glucocorticoids: boolean; // long-term oral steroid use
  rheumatoidArthritis: boolean;
  highAlcohol: boolean; // >= 3 units/day (FRAX threshold)
  vitaminD: number; // serum 25-OH-D, nmol/L (photo-extracted lab)
  calcium: number; // serum calcium, mmol/L (photo-extracted lab)
};

// Regression coefficients in T-SCORE units. DIRECTIONS are textbook (safe to
// show); MAGNITUDES are placeholders pending NHANES training.
const COEFFICIENTS = {
  intercept: -0.1,
  age: -0.03, // older → lower T-score
  yearsSinceMenopause: -0.06, // longer since estrogen loss → lower
  onHormoneTherapy: 0.3, // protective
  priorFragilityFracture: -0.7, // strong known risk factor
  bmi: 0.04, // higher BMI protects bone density (to a point)
  weightBearingActivity: 1.0, // activity protects bone — the wearable lever
  currentSmoker: -0.3,
  parentalHipFracture: -0.4,
  glucocorticoids: -0.5, // steroids strongly suppress bone formation — a top drug cause (FRAX)
  rheumatoidArthritis: -0.3, // chronic inflammation lowers BMD independently (FRAX variable)
  highAlcohol: -0.3, // impairs bone formation and raises fall risk (FRAX ≥3 units/day)
  vitaminD: 0.004, // 25-OH-D enables calcium absorption + mineralisation; per nmol/L
  calcium: 0.02, // serum calcium mainly flags secondary causes (e.g. hyperparathyroidism) —
  //               weak direct BMD signal (it's tightly regulated); Emre may drop after training
};

// The ± half-width of the uncertainty range around the estimate. Placeholder:
// the real value is the model's residual SD / prediction-interval half-width.
const RANGE_HALF_WIDTH = 0.6;

// Flip to true ONLY when COEFFICIENTS come from an NHANES-trained, validated model.
export const MODEL_IS_VALIDATED = false;

export type FactorContribution = {
  factor: string;
  contribution: number; // signed push on the estimated T-score, in T-score units
  direction: "raises" | "lowers";
};

export type ModelOutput = {
  estimatedTScore: number; // point estimate on the clinical scale
  tScoreRange: [number, number]; // [low, high] uncertainty interval
  category: "elevated" | "uncertain" | "lower";
  contributions: FactorContribution[]; // sorted by magnitude — the explanation
  validated: boolean;
};

const round1 = (x: number) => Math.round(x * 10) / 10;

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
    ["Glucocorticoid use", COEFFICIENTS.glucocorticoids * (f.glucocorticoids ? 1 : 0)],
    ["Rheumatoid arthritis", COEFFICIENTS.rheumatoidArthritis * (f.rheumatoidArthritis ? 1 : 0)],
    ["High alcohol intake", COEFFICIENTS.highAlcohol * (f.highAlcohol ? 1 : 0)],
    ["Vitamin D", COEFFICIENTS.vitaminD * f.vitaminD],
    ["Serum calcium", COEFFICIENTS.calcium * f.calcium],
  ];

  const estimate = COEFFICIENTS.intercept + terms.reduce((s, [, v]) => s + v, 0);
  const low = estimate - RANGE_HALF_WIDTH;
  const high = estimate + RANGE_HALF_WIDTH;

  // The band, from where the estimate AND its range sit on the clinical scale.
  // Honesty over false precision: if the range doesn't clearly reach the
  // osteoporosis line, we say "uncertain" rather than guess.
  // - elevated:  osteoporosis is plausible (estimate ≤ -2.5, or the range dips to it)
  // - lower:     comfortably normal (estimate ≥ -1.0)
  // - uncertain: the osteopenia zone in between
  let category: ModelOutput["category"];
  if (estimate <= -2.5 || low <= -2.5) category = "elevated";
  else if (estimate >= -1.0) category = "lower";
  else category = "uncertain";

  const contributions = terms
    .filter(([, v]) => Math.abs(v) > 1e-3)
    .map(([factor, v]): FactorContribution => ({
      factor,
      contribution: v,
      direction: v > 0 ? "raises" : "lowers",
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return {
    estimatedTScore: round1(estimate),
    tScoreRange: [round1(low), round1(high)],
    category,
    contributions,
    validated: MODEL_IS_VALIDATED,
  };
}
