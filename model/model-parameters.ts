// AUTO-GENERATED from model/train_bonebot.ipynb (NHANES 2013-2014). Do not edit by hand.
// Regenerate whenever the model changes.
//
// Feature set matches what the app collects/imputes.
// Activity is objective wrist-accelerometry (MIMS), averaged over valid wear
// days only (>=10 h wake-wear, >=4 days) so low-wear days do not masquerade as
// inactivity. The Ridge model was fitted after training-only median imputation,
// robust Mahalanobis outlier filtering, and standardisation. The values below
// are the exported raw-scale equivalents, so the app can score raw inputs.

export const triage = {
  intercept: -4.638858,
  coefficients: {
    age: 0.088939,
    bmi: -0.126995,
    postmenopausal: -0.158907,
  },
  bmiMedian: 28.0000,
  // Refer for full assessment at P(osteoporosis) >= 1%. Lowered from 2% so the
  // triage catches ~99% of DXA-defined cases on validation (see notebook cell 7:
  // TARGET_SENSITIVITY = 0.99), trading more referrals for fewer missed cases.
  threshold: 0.01,
  auc: 0.8666,
} as const;

// Secondary osteoporosis (thyroid OR CKD) is trained, so the question is asked
// and its coefficient is used.
export const SECONDARY_CONDITION_TRAINED = true;

export const tScoreModel = {
  intercept: -4.024468,
  coefficients: {
    age: -0.031870,
    bmi: 0.069652,
    yearsSinceMenopause: 0.001773,
    activityLevel: 0.279435,
    priorFragilityFracture: -0.364870,
    glucocorticoids: -0.103762,
    currentSmoker: -0.000036,
    highAlcohol: -0.033828,
    vitaminD: -0.000731,
    calcium: 1.124829,
    rheumatoidArthritis: -0.001976,
    onHormoneTherapy: 0.130588,
    secondaryCondition: -0.031610,
  },
  imputationDefaults: {
    bmi: 27.8000,
    yearsSinceMenopause: 16.0000,
    activityLevel: 0.6752,
    priorFragilityFracture: 0.0000,
    glucocorticoids: 0.0000,
    currentSmoker: 0.0000,
    highAlcohol: 0.0000,
    vitaminD: 76.0000,
    calcium: 2.3750,
    rheumatoidArthritis: 0.0000,
    onHormoneTherapy: 0.0000,
    secondaryCondition: 0.0000,
  },
  // Complete-data 95% half-width (z * residualStd). Used as the fallback and
  // when no provided-features set is passed; the per-person band (below) widens
  // it for imputed inputs.
  intervalHalfWidth: 1.8546,
  mae: 0.7270,
  // Per-person prediction interval. residualStd is the complete-data residual
  // SD; z its multiplier. When a feature is imputed at inference its variance is
  // added back: extra variance = coefficient^2 * featureVariances[feature],
  // summed over imputed features (see scoreBone). Empirical coverage under ~50%
  // induced missingness: 0.946 (target 0.95).
  intervals: {
    residualStd: 0.9462,
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
