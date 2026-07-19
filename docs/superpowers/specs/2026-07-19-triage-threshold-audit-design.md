# Triage Threshold Audit Design

## Goal

Choose a fixed lightweight osteoporosis-triage routing threshold without using the final held-out test set to select it, then report a transparent final audit at that locked threshold.

## Scope

The work changes only `model/train_bonebot.ipynb` and supporting test code. It does not change the live consumer-facing score, make a clinical claim, or add dependencies.

## Data flow

1. Split the lightweight analytic dataset into training (60%), validation (20%), and test (20%) sets with stratification.
2. Fit the logistic-regression triage model on training data only.
3. Score a predeclared candidate grid of thresholds from 1% to 10% on validation data only.
4. Select the highest threshold whose validation sensitivity is at least 95%; if none meets the target, report that the desired safety target was not met and do not claim a safe routing rule.
5. Lock that selected threshold and calculate the final audit once on the untouched held-out test data.

## Final held-out audit

At the locked threshold, the notebook will print:

- Sensitivity: proportion of DXA-defined osteoporosis cases routed to the extended assessment.
- Negative predictive value: proportion of people routed below the threshold who do not have DXA-defined osteoporosis.
- False-negative count and denominator: cases incorrectly routed below the threshold.
- Brier score and a 10-bin calibration table: whether predicted probabilities agree with observed prevalence.
- 95% nonparametric bootstrap confidence intervals for sensitivity and NPV, based on 2,000 resamples of the held-out test set.

The report will explicitly state that these are retrospective NHANES results for a research screening gate, not a diagnosis or a clinical deployment recommendation.

## T-score feature attribution

Continue to report each feature in T-score units. For a specific person, a binary feature contributes its fitted coefficient when present and zero otherwise; a numeric feature contributes its coefficient multiplied by the person’s value. Do not convert these to percentages or causal lifestyle promises.

## Testing

Extract the threshold-audit calculations into a small dependency-free Python module. Add tests using synthetic labels and probabilities to verify the confusion-matrix metrics, threshold selection, and bootstrap output bounds. The notebook imports the tested module and prints its results.

## Acceptance criteria

- Threshold selection never reads the held-out test labels before the threshold is locked.
- The notebook prints all five requested assessment items at the locked threshold.
- Sensitivity and NPV confidence intervals are reported and reproducible with a fixed random seed.
- The selected threshold and validation safety result are exported alongside existing model parameters.
