# BoneBot benchmark & model card

An open benchmark and the trained model behind BoneBot's screening estimate.
The intended reusable asset is the **task and split**, not just the app: predict
DXA-defined bone health in postmenopausal women from a health profile plus
wearable activity, **without ever using the scan as an input**, with calibrated
uncertainty.

## The task

> Given a postmenopausal woman's age, BMI, years since menopause, wearable
> activity, and standard FRAX-style risk factors and labs, estimate her
> femoral-neck **T-score** (regression) and flag likely osteoporosis
> (classification) — with a calibrated uncertainty band and a "confirm with DXA"
> flag. **The DXA T-score is the label only; it must never appear as a feature.**

Two models share the feature pipeline:

- **Triage** (`triage` in `model-parameters.ts`) — age + BMI + postmenopausal
  status → P(osteoporosis). A cheap gate that decides whether the fuller
  questionnaire is worth the user's time; its threshold is tuned for safety
  (high sensitivity), audited in `../docs/TRIAGE_THRESHOLD_AUDIT.md`.
- **T-score model** (`tScoreModel`) — 13 features → estimated T-score with a
  per-person 95% prediction interval.

## Data

| | |
|---|---|
| Source | NHANES 2013–2014 (public, US CDC) |
| Cohort | Postmenopausal women with femur DXA **and** valid wrist-accelerometry |
| Sample | 1,119 women (788 train / 280 held-out test; 51 training outliers removed) |
| Label | Femoral-neck BMD → T-score vs the NHANES III young-adult female reference (Looker et al. 2010); osteoporosis = T ≤ −2.5 |

**Cycle note.** Wrist accelerometry and femur DXA co-occur in the same
respondents in **2013–2014** — the merge is keyed on respondent ID within that
cycle. Merging files that don't share respondents is the classic silent failure
here; this benchmark confirms the overlap before merging.

## Features (none is the scan)

age · BMI · years since menopause · wrist-accelerometry activity (MIMS, averaged
over valid wear days: ≥10 h wake-wear, ≥4 days) · prior fragility fracture ·
glucocorticoids · current smoker · high alcohol · vitamin D · calcium ·
rheumatoid arthritis · hormone therapy · secondary osteoporosis (thyroid/CKD).

The FRAX-style risk factors, labs, menopause history, and objective activity are
what let the model beat an age+weight baseline (see below).

## Method

Ridge regression, fitted after **training-only** median imputation, robust
Mahalanobis outlier filtering, and standardisation. Coefficients are exported to
their raw-scale equivalents in `model-parameters.ts` so the app scores raw inputs
with no Python at inference. The 95% prediction interval uses the complete-data
residual SD, and **adds back variance for each imputed feature** at inference, so
a sparser profile produces a visibly wider band.

## Results (held-out test)

| Metric | Value |
|---|---|
| T-score MAE | 0.727 T-score units |
| T-score R² | 0.276 |
| Interval coverage under ~50% induced missingness | 0.946 (target 0.95) |
| Triage AUC | 0.867 |

Ablation — osteoporosis classification on the same split:

| Model | AUC | PR-AUC |
|---|---|---|
| Baseline (age + BMI) | 0.772 | 0.280 |
| + menopause | 0.774 | 0.286 |
| + wearable activity | 0.773 | 0.301 |
| Full model | **0.789** | **0.350** |
| OST tool (age + weight, reference) | 0.779 | — |

The lift over baseline is modest on AUC but clearer on PR-AUC (0.280 → 0.350),
which matters more for a rare-positive screening target.

## Reproduce

```bash
# Fit, evaluate, and export coefficients + interval params
jupyter nbconvert --to notebook --execute model/train_bonebot.ipynb
# Triage threshold held-out audit
python model/triage_audit.py
```

`model-parameters.ts` is auto-generated from the notebook — regenerate it there,
never edit by hand.

## Intended use & limits

A **screening flag, not a diagnosis.** Only a DXA scan measures bone density.
Trained on NHANES (US, cross-sectional); applicability to other populations is
untested. Uncertain inputs are surfaced, not hidden. `MODEL_IS_VALIDATED` in
`../src/lib/bone-model.ts` gates whether the app presents numbers as real.

## License

Code MIT; benchmark, model card, and docs CC BY 4.0. See `../LICENSE`.
