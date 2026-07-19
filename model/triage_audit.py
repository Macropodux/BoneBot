"""Validation-only threshold selection and held-out triage audit utilities."""

from typing import Iterable

import numpy as np


def _arrays(y_true: Iterable[int], probabilities: Iterable[float]):
    labels = np.asarray(list(y_true), dtype=int)
    scores = np.asarray(list(probabilities), dtype=float)
    if labels.ndim != 1 or scores.ndim != 1 or len(labels) != len(scores):
        raise ValueError("labels and probabilities must be one-dimensional and equally sized")
    if len(labels) == 0 or not np.isin(labels, [0, 1]).all():
        raise ValueError("labels must be a non-empty binary vector")
    if np.any((scores < 0) | (scores > 1)):
        raise ValueError("probabilities must lie between 0 and 1")
    return labels, scores


def _sensitivity(labels: np.ndarray, scores: np.ndarray, threshold: float) -> float:
    positives = labels == 1
    if not positives.any():
        return float("nan")
    return float((scores[positives] >= threshold).mean())


def select_threshold(y_true, probabilities, candidates, min_sensitivity: float):
    """Return the highest candidate meeting a predeclared validation sensitivity target."""
    labels, scores = _arrays(y_true, probabilities)
    passing = [
        float(threshold)
        for threshold in candidates
        if 0 <= threshold <= 1 and _sensitivity(labels, scores, threshold) >= min_sensitivity
    ]
    if not passing:
        raise ValueError("No candidate threshold met the validation sensitivity target")
    return max(passing)


def _calibration_bins(labels: np.ndarray, scores: np.ndarray, bins: int = 10):
    result = []
    edges = np.linspace(0, 1, bins + 1)
    for index in range(bins):
        lower, upper = edges[index], edges[index + 1]
        in_bin = (scores >= lower) & ((scores < upper) if index < bins - 1 else (scores <= upper))
        result.append(
            {
                "lower": float(lower),
                "upper": float(upper),
                "count": int(in_bin.sum()),
                "mean_predicted_risk": float(scores[in_bin].mean()) if in_bin.any() else float("nan"),
                "observed_prevalence": float(labels[in_bin].mean()) if in_bin.any() else float("nan"),
            }
        )
    return result


def _percentile_interval(values: list[float]):
    finite = np.asarray([value for value in values if np.isfinite(value)], dtype=float)
    if len(finite) == 0:
        return (float("nan"), float("nan"))
    return tuple(float(value) for value in np.percentile(finite, [2.5, 97.5]))


def audit_threshold(y_true, probabilities, threshold: float, bootstrap_samples: int = 2000, random_state: int = 0):
    """Calculate a final held-out audit at one already-locked threshold."""
    labels, scores = _arrays(y_true, probabilities)
    if not 0 <= threshold <= 1:
        raise ValueError("threshold must lie between 0 and 1")

    routed = scores >= threshold
    tp = int(np.sum(routed & (labels == 1)))
    fp = int(np.sum(routed & (labels == 0)))
    tn = int(np.sum(~routed & (labels == 0)))
    fn = int(np.sum(~routed & (labels == 1)))
    sensitivity = tp / (tp + fn) if tp + fn else float("nan")
    npv = tn / (tn + fn) if tn + fn else float("nan")

    rng = np.random.default_rng(random_state)
    sensitivity_draws, npv_draws = [], []
    for _ in range(bootstrap_samples):
        sample = rng.integers(0, len(labels), len(labels))
        sampled_labels, sampled_scores = labels[sample], scores[sample]
        sampled_routed = sampled_scores >= threshold
        sampled_tp = np.sum(sampled_routed & (sampled_labels == 1))
        sampled_fn = np.sum(~sampled_routed & (sampled_labels == 1))
        sampled_tn = np.sum(~sampled_routed & (sampled_labels == 0))
        sensitivity_draws.append(sampled_tp / (sampled_tp + sampled_fn) if sampled_tp + sampled_fn else float("nan"))
        npv_draws.append(sampled_tn / (sampled_tn + sampled_fn) if sampled_tn + sampled_fn else float("nan"))

    return {
        "threshold": float(threshold),
        "true_positives": tp,
        "false_positives": fp,
        "true_negatives": tn,
        "false_negatives": fn,
        "sensitivity": float(sensitivity),
        "npv": float(npv),
        "brier_score": float(np.mean((scores - labels) ** 2)),
        "calibration_bins": _calibration_bins(labels, scores),
        "sensitivity_ci95": _percentile_interval(sensitivity_draws),
        "npv_ci95": _percentile_interval(npv_draws),
    }
