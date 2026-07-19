# Triage Threshold Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Select a lightweight-triage threshold on validation data and print an honest, bootstrapped held-out-test audit at the locked threshold.

**Architecture:** Extract pure metric and threshold-selection functions into a Python module so synthetic tests can validate the calculations. The NHANES notebook will use a train/validation/test split, choose the threshold from validation only, then audit the untouched test split. Model coefficients remain in T-score units; a separate 0–10 per-person influence score is exported for explanation only.

**Tech Stack:** Python 3, NumPy, pandas, scikit-learn, unittest, Jupyter notebook, TypeScript export.

## Global Constraints

- No additional project dependencies.
- The 5% threshold is a candidate, not a test-set-tuned result.
- A selected threshold must meet validation sensitivity of at least 95%; otherwise the notebook must say no candidate met the target.
- Results are research-screening metrics, not diagnostic or clinical-deployment claims.
- Do not convert T-score coefficients into causal or population percentages.

---

### Task 1: Tested threshold-audit module

**Files:**
- Create: `model/triage_audit.py`
- Create: `model/test_triage_audit.py`

**Interfaces:**
- Produces `select_threshold(y_true, probabilities, candidates, min_sensitivity)` and `audit_threshold(y_true, probabilities, threshold, bootstrap_samples, random_state)`.
- `audit_threshold` returns sensitivity, NPV, false-negative count, Brier score, calibration bins, and bootstrap 95% intervals for sensitivity and NPV.

- [ ] **Step 1: Write failing tests** for a synthetic binary classification result, asserting the chosen threshold meets the sensitivity target and the audit returns exact confusion-matrix values plus bounded confidence intervals.
- [ ] **Step 2: Run the tests** with `python3 -m unittest model/test_triage_audit.py` and confirm they fail because the module does not exist.
- [ ] **Step 3: Implement pure NumPy audit functions** with undefined NPV/bootstrap draws represented as `NaN` and excluded from percentile calculation.
- [ ] **Step 4: Re-run the unit tests** and confirm they pass.

### Task 2: Notebook validation/test protocol

**Files:**
- Modify: `model/train_bonebot.ipynb`

**Interfaces:**
- Consumes `select_threshold` and `audit_threshold` from `model/triage_audit.py`.
- Produces a printed candidate-threshold table, a locked-threshold validation result, a final held-out-test audit, and an exported `threshold` value.

- [ ] **Step 1: Add a notebook assertion test cell** that imports the audit module and executes its unit tests.
- [ ] **Step 2: Replace the existing two-way lightweight split** with stratified 60/20/20 training/validation/test splits; train on training data only.
- [ ] **Step 3: Score 1%–10% candidate thresholds on validation data**, lock the largest candidate at or above 95% sensitivity, and print the candidate table.
- [ ] **Step 4: Run exactly one final audit on the untouched test split** and print sensitivity, NPV, false negatives, Brier score, calibration bins, and bootstrap confidence intervals.
- [ ] **Step 5: Export the locked threshold and the final audit summary** into `model/model-parameters.ts` comments/metadata only after the model run has produced them.

### Task 3: Evidence and handoff

**Files:**
- Modify: `model/train_bonebot.ipynb`
- Modify: `model/model-parameters.ts` after a successful run

- [ ] **Step 1: Run the notebook end-to-end** against NHANES data.
- [ ] **Step 2: Record the selected validation threshold and final held-out audit output.**
- [ ] **Step 3: Review the output for test-set leakage and unsupported clinical language.**
- [ ] **Step 4: Run `npm run build` before committing the small, scoped change to `main`.**
