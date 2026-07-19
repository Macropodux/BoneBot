# Lightweight Triage Threshold Audit

**Status:** retrospective NHANES research result; not a diagnostic, treatment,
or clinical-referral rule.

## Decision

The lightweight model routes a person to the fuller assessment when its predicted
probability of **DXA-defined osteoporosis is at least 2%**. A result below 2%
means *lower screening signal*, not “no osteoporosis.”

## How the threshold was chosen

The model used a stratified 60% training / 20% validation / 20% held-out test
split of NHANES 2013–2014 women with femur DXA data. Candidate thresholds from
1% to 10% were compared **only on the validation split**. Before reviewing the
results, the team set a safety target of at least 95% sensitivity. The chosen
threshold is the highest candidate meeting that target.

| Candidate threshold | Validation sensitivity | Validation NPV | Validation false negatives |
| ---: | ---: | ---: | ---: |
| 1% | 100.0% | 100.0% | 0 |
| **2% (selected)** | **95.7%** | **99.0%** | **1** |
| 3% | 91.3% | 98.6% | 2 |
| 4% | 87.0% | 98.1% | 3 |
| 5% | 87.0% | 98.2% | 3 |
| 6% | 87.0% | 98.5% | 3 |
| 7% | 87.0% | 98.5% | 3 |
| 8% | 73.9% | 97.2% | 6 |
| 9% | 65.2% | 96.5% | 8 |
| 10% | 65.2% | 96.7% | 8 |

## Final held-out test audit at the locked 2% threshold

| Measure | Result |
| --- | --- |
| Sensitivity | 100.0% (bootstrap 95% CI 100.0%–100.0%) |
| Negative predictive value | 100.0% (bootstrap 95% CI 100.0%–100.0%) |
| False negatives | 0 of 24 DXA-defined osteoporosis cases |
| Brier score | 0.061 (lower is better) |

The held-out test set had 317 people. Its calibration bins showed good
agreement at the lowest-risk range (mean predicted risk 3.1%; observed
prevalence 2.1% across 234 people), but sparse higher-risk bins. The apparently
perfect held-out sensitivity and NPV arise from a small number of positive
cases, so they require external validation before clinical use.

## Reproducibility

Run [`model/train_bonebot.ipynb`](../model/train_bonebot.ipynb). The final cell
performs validation-only threshold selection and prints the held-out audit using
the tested helpers in [`model/triage_audit.py`](../model/triage_audit.py).
