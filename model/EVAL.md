# Evaluating against the BoneBot T-score benchmark

This benchmark is a **task + a frozen split + a scoring function**, so a
different model can be scored on identical terms. The data lives in
`model/data/`; the scorer is `model/eval.py`.

## The held-out set

`model/data/bonebot_nhanes_2013_2014.csv`, rows where `split == "test"` — **280
women**, none of which were seen during fitting. Train on `split == "train"`
(839 rows; the paper additionally drops 51 `training_outlier == 1` rows, leaving
788). Predict the `Tscore` column from the 13 feature columns (everything except
`SEQN`, `split`, `training_outlier`, `femoralNeckBMD`, `Tscore`, `osteoporosis`,
`postmenopausal`). **`femoralNeckBMD` and `Tscore` are the label — never feed
them, or anything DXA-derived, to the model.**

## Metric definitions

| Metric | Definition | Direction |
|---|---|---|
| `mae` | mean absolute error `mean(\|y_true − y_pred\|)`, in T-score units | lower is better |
| `r2` | `1 − SS_res/SS_tot`, `SS_res = Σ(y_true−y_pred)²`, `SS_tot = Σ(y_true−mean(y_true))²` | higher is better |
| `coverage` | fraction of test rows with `lower ≤ y_true ≤ upper`; a calibrated 95% interval covers ≈ 0.95 | closer to nominal (0.95) is better |

`coverage` is only defined for models that emit a prediction interval; point-only
models report `mae` and `r2`.

BoneBot's own held-out numbers: **MAE 0.727**, **R² 0.276**, and interval
**coverage 0.946** under ~50% induced missingness (target 0.95).

## Scoring signature

```python
from model.eval import evaluate

# point predictions only
evaluate(y_true, y_pred)                     # -> {"n", "mae", "r2"}

# with a prediction interval
evaluate(y_true, y_pred, lower=lo, upper=hi)  # -> {"n", "mae", "r2", "coverage"}
```

`evaluate` is pure NumPy — copy it into any project, no BoneBot dependency.

## Worked example

```python
import pandas as pd
from model.eval import evaluate

df = pd.read_csv("model/data/bonebot_nhanes_2013_2014.csv")
test = df[df.split == "test"]

y_true = test.Tscore.to_numpy()
y_pred = your_model.predict(test[FEATURES])          # your model here
print(evaluate(y_true, y_pred))
```

Or from a predictions file with columns `y_true,y_pred[,lower,upper]`:

```bash
python3 model/eval.py predictions.csv
```

## Reproducing the data

`model/data/*.csv` is a **frozen snapshot** committed to the repo, so the
benchmark is runnable even if the NHANES site changes. To rebuild it from
source, `python3.10 model/export_dataset.py` re-downloads the NHANES 2013–2014
`.xpt` files and records their SHA-256 in `model/data/nhanes_sources.sha256`;
compare against that manifest to confirm the sources are unchanged.
