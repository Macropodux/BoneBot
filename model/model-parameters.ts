// AUTO-GENERATED from model/train_bonebot.ipynb (NHANES 2013-2014). Do not edit by hand.
// Regenerate whenever the model changes.
//
// Feature set matches what the app collects/imputes.
// Activity is objective wrist-accelerometry (MIMS), averaged over valid wear
// days only (>=10 h wake-wear, >=4 days) so low-wear days do not masquerade as
// inactivity.

export const triage = {
  intercept: -4.638858,
  coefficients: {
    age: 0.088939,
    bmi: -0.126995,
    postmenopausal: -0.158907,
  },
  bmiMedian: 28.0000,
  threshold: 0.02,
  auc: 0.8666,
} as const;

// Secondary osteoporosis (thyroid OR CKD) is trained, so the question is asked
// and its coefficient is used.
export const SECONDARY_CONDITION_TRAINED = true;

export const tScoreModel = {
  intercept: -3.574560,
  coefficients: {
    age: -0.031843,
    bmi: 0.066326,
    yearsSinceMenopause: 0.002001,
    activityLevel: 0.320833,
    priorFragilityFracture: -0.377236,
    glucocorticoids: -0.135299,
    currentSmoker: 0.008751,
    highAlcohol: -0.069274,
    vitaminD: -0.001059,
    calcium: 0.975935,
    rheumatoidArthritis: 0.001246,
    onHormoneTherapy: 0.107144,
    secondaryCondition: -0.045588,
  },
  imputationDefaults: {
    bmi: 28.1000,
    yearsSinceMenopause: 17.0000,
    activityLevel: 0.6798,
    priorFragilityFracture: 0.0000,
    glucocorticoids: 0.0000,
    currentSmoker: 0.0000,
    highAlcohol: 0.0000,
    vitaminD: 75.3000,
    calcium: 2.3750,
    rheumatoidArthritis: 0.0000,
    onHormoneTherapy: 0.0000,
    secondaryCondition: 0.0000,
  },
  // Complete-data 95% half-width (z * residualStd). Used as the fallback and
  // when no provided-features set is passed; the per-person band (below) widens
  // it for imputed inputs.
  intervalHalfWidth: 1.8532,
  mae: 0.7250,
  // Per-person prediction interval. residualStd is the complete-data residual
  // SD; z its multiplier. When a feature is imputed at inference its variance is
  // added back: extra variance = coefficient^2 * featureVariances[feature],
  // summed over imputed features (see scoreBone). Empirical coverage under ~50%
  // induced missingness: 0.946 (target 0.95).
  intervals: {
    residualStd: 0.9455,
    z: 1.96,
    featureVariances: {
      age: 85.51958,
      bmi: 45.441713,
      yearsSinceMenopause: 145.714138,
      activityLevel: 0.029007,
      priorFragilityFracture: 0.10277,
      glucocorticoids: 0.062588,
      currentSmoker: 0.128333,
      highAlcohol: 0.071011,
      vitaminD: 1121.666374,
      calcium: 0.008936,
      rheumatoidArthritis: 0.067971,
      onHormoneTherapy: 0.222421,
      secondaryCondition: 0.222718,
    } as Partial<Record<string, number>>,
  },
} as const;
