// AUTO-GENERATED from model/train_bonebot.ipynb (NHANES 2013-2014). Do not edit by hand.
// Regenerate whenever the model changes.

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

// When true, the "secondary osteoporosis" question (thyroid / coeliac / CKD) is
// asked and its coefficient is used. Keep FALSE until the model is retrained
// with the feature and the real coefficient + variance below are filled in by
// the notebook. Shipping a fabricated coefficient would break the honesty rule.
export const SECONDARY_CONDITION_TRAINED = false;

export const tScoreModel = {
  intercept: -3.114305,
  coefficients: {
    age: -0.033543,
    bmi: 0.064050,
    yearsSinceMenopause: 0.001517,
    activityLevel: 0.025549,
    priorFragilityFracture: -0.380274,
    glucocorticoids: -0.154893,
    currentSmoker: 0.000167,
    highAlcohol: -0.054386,
    vitaminD: -0.001115,
    calcium: 0.950348,
    rheumatoidArthritis: -0.003796,
    onHormoneTherapy: 0.109861,
    parentalHipFracture: -0.240893,
    // PENDING RETRAIN: thyroid/CKD "secondary osteoporosis" flag. 0 has no
    // effect until SECONDARY_CONDITION_TRAINED flips true with a real value.
    secondaryCondition: 0,
  },
  imputationDefaults: {
    bmi: 28.1000,
    yearsSinceMenopause: 17.0000,
    activityLevel: 0.6585,
    priorFragilityFracture: 0.0000,
    glucocorticoids: 0.0000,
    currentSmoker: 0.0000,
    highAlcohol: 0.0000,
    vitaminD: 75.3000,
    calcium: 2.3750,
    rheumatoidArthritis: 0.0000,
    onHormoneTherapy: 0.0000,
    parentalHipFracture: 0.0000,
    secondaryCondition: 0.0000,
  },
  intervalHalfWidth: 0.9467,
  mae: 0.7226,
  // Per-person prediction interval. `residualStd` is the complete-data residual
  // SD; `z` its multiplier (so z * residualStd == intervalHalfWidth). When a
  // feature is not supplied at inference we impute its mean, so its variance is
  // added back: extra variance = coefficient^2 * featureVariances[feature],
  // summed over imputed features (see scoreBone). `featureVariances` are the
  // training-set variances; leave the object empty until the notebook exports
  // them, in which case the band falls back to the fixed intervalHalfWidth.
  intervals: {
    residualStd: 0.4830,
    z: 1.96,
    featureVariances: {} as Partial<Record<string, number>>,
  },
} as const;
