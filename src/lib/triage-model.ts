// The front-gate model is deliberately separate from the T-score regression.
// It estimates whether a full assessment is warranted; it never diagnoses
// osteoporosis and it never sets or alters the eventual T-score.
//
// These coefficients are an ILLUSTRATIVE routing placeholder until Emre exports
// a trained, calibrated model and its validation metrics. Keep the validation
// warning visible anywhere this percentage is shown.

export const TRIAGE_MODEL_IS_VALIDATED = false;
export const TRIAGE_THRESHOLD = 0.05;

export type MenopauseStatus = "yes" | "no" | "not-sure";

export type TriageFeatures = {
  age: number;
  menopauseStatus: MenopauseStatus;
};

export type TriageOutput = {
  estimatedProbability: number;
  probabilityPercent: number;
  thresholdPercent: number;
  proceedToFullAssessment: boolean;
  validated: boolean;
};

const COEFFICIENTS = {
  intercept: -8.5,
  age: 0.12,
  menopauseYes: 0.85,
  menopauseNotSure: 0.25,
};

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));
const round1 = (value: number) => Math.round(value * 10) / 10;

export function scoreTriage(features: TriageFeatures): TriageOutput {
  const menopauseTerm =
    features.menopauseStatus === "yes"
      ? COEFFICIENTS.menopauseYes
      : features.menopauseStatus === "not-sure"
        ? COEFFICIENTS.menopauseNotSure
        : 0;
  const probability = sigmoid(COEFFICIENTS.intercept + COEFFICIENTS.age * features.age + menopauseTerm);

  return {
    estimatedProbability: probability,
    probabilityPercent: round1(probability * 100),
    thresholdPercent: TRIAGE_THRESHOLD * 100,
    proceedToFullAssessment: probability > TRIAGE_THRESHOLD,
    validated: TRIAGE_MODEL_IS_VALIDATED,
  };
}
