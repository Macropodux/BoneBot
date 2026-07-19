"""Scoring for the BoneBot T-score benchmark, decoupled from the notebook.

One function, pure NumPy, no scikit-learn — so anyone can plug in a different
model and score it against the same held-out set (model/data, split == "test").

    from model.eval import evaluate
    metrics = evaluate(y_true, y_pred)                       # {"mae", "r2", "n"}
    metrics = evaluate(y_true, y_pred, lower=lo, upper=hi)   # adds "coverage"

Metric definitions (see model/EVAL.md):
  mae      mean absolute error, |y_true - y_pred|, in T-score units (lower better)
  r2       coefficient of determination, 1 - SS_res / SS_tot (higher better)
  coverage fraction of test rows whose true T-score falls inside the model's
           [lower, upper] prediction interval; a calibrated 95% interval should
           cover ~0.95. Only returned when lower and upper are supplied.

CLI:
    python3 model/eval.py predictions.csv
where predictions.csv has columns: y_true, y_pred[, lower, upper].
"""

from __future__ import annotations

import numpy as np


def evaluate(y_true, y_pred, lower=None, upper=None) -> dict:
    """Score predictions against ground-truth T-scores.

    Args:
        y_true: array-like of true T-scores.
        y_pred: array-like of predicted (point-estimate) T-scores.
        lower, upper: optional array-likes giving each prediction's interval
            bounds. When both are given, "coverage" is added to the result.

    Returns:
        dict with keys "n", "mae", "r2", and (if intervals given) "coverage".
    """
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    if y_true.shape != y_pred.shape:
        raise ValueError(f"y_true {y_true.shape} and y_pred {y_pred.shape} must match")
    if y_true.size == 0:
        raise ValueError("no rows to score")

    mae = float(np.mean(np.abs(y_true - y_pred)))
    ss_res = float(np.sum((y_true - y_pred) ** 2))
    ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else float("nan")

    out = {"n": int(y_true.size), "mae": mae, "r2": r2}

    if lower is not None and upper is not None:
        lower = np.asarray(lower, dtype=float)
        upper = np.asarray(upper, dtype=float)
        if lower.shape != y_true.shape or upper.shape != y_true.shape:
            raise ValueError("lower/upper must match y_true shape")
        out["coverage"] = float(np.mean((y_true >= lower) & (y_true <= upper)))

    return out


if __name__ == "__main__":
    import sys
    import csv

    if len(sys.argv) != 2:
        print(__doc__)
        raise SystemExit(2)

    cols: dict[str, list] = {}
    with open(sys.argv[1], newline="") as fh:
        reader = csv.DictReader(fh)
        for name in reader.fieldnames or []:
            cols[name] = []
        for row in reader:
            for name in cols:
                cols[name].append(float(row[name]))

    if "y_true" not in cols or "y_pred" not in cols:
        raise SystemExit("predictions CSV needs at least 'y_true' and 'y_pred' columns")

    kw = {}
    if "lower" in cols and "upper" in cols:
        kw = {"lower": cols["lower"], "upper": cols["upper"]}
    result = evaluate(cols["y_true"], cols["y_pred"], **kw)
    for key, value in result.items():
        print(f"{key:>9}: {value}")
