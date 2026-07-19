// AUTO-GENERATED from model/train_bonebot.ipynb (NHANES 2013-2014). Do not edit by hand.
// Regenerate whenever the model changes.
//
// Feature set matches what the app collects/imputes. Parental hip fracture is
// intentionally ABSENT: NHANES 2013-2014 has no family-history-of-fracture item,
// so it cannot be trained honestly and was dropped from both model and intake.

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

// Secondary osteoporosis (thyroid OR CKD) is now trained, so the question is
// asked and its coefficient is used.
export const SECONDARY_CONDITION_TRAINED = true;

export const tScoreModel = {
  intercept: -3.186696,
  coefficients: {
    age: -0.033275,
    bmi: 0.064727,
    yearsSinceMenopause: 0.001792,
    activityLevel: 0.023119,
    priorFragilityFracture: -0.390020,
    glucocorticoids: -0.136555,
    currentSmoker: -0.006611,
    highAlcohol: -0.060509,
    vitaminD: -0.001045,
    calcium: 0.961420,
    rheumatoidArthritis: -0.002845,
    onHormoneTherapy: 0.105799,
    secondaryCondition: -0.054497,
    // NHANES 2013-2014 has no family-history-of-fracture item, so this cannot be
    // trained. Kept at 0 (no effect on the estimate) only so the current intake
    // UI keeps compiling; the intake question should be removed, then this key.
    parentalHipFracture: 0,
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
    secondaryCondition: 0.0000,
    parentalHipFracture: 0.0000,
  },
  // Complete-data 95% half-width (z * residualStd). Used as the fallback and
  // when no provided-features set is passed; the per-person band (below) widens
  // it for imputed inputs.
  intervalHalfWidth: 1.8565,
  mae: 0.7250,
  // Per-person prediction interval. residualStd is the complete-data residual
  // SD; z its multiplier. When a feature is imputed at inference its variance is
  // added back: extra variance = coefficient^2 * featureVariances[feature],
  // summed over imputed features (see scoreBone). Empirical coverage under ~50%
  // induced missingness: 0.946 (target 0.95).
  intervals: {
    residualStd: 0.9472,
    z: 1.96,
    featureVariances: {
      age: 85.51958,
      bmi: 45.441713,
      yearsSinceMenopause: 145.714138,
      activityLevel: 0.042525,
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
