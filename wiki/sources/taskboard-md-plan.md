---
type: source
title: "TASKBOARD.md — Execution Plan"
raw: "TASKBOARD.md"
ingested: 2026-07-18
tags: [schedule, bonebot, hackathon]
created: 2026-07-18
updated: 2026-07-18
---

# TASKBOARD.md — Execution Plan

`TASKBOARD.md` is the operational taskboard mapping team responsibilities, time blocks, checkpoints, risks, and deliverables onto the hackathon schedule.

## Role Allocations

- **Josh (Clinical/Demo):** Handles video narration/editing, clinical framing, and final system prompts in `/api/screen`. Decides all scope cuts.
- **Emre (Model/Data):** Oversees NHANES data processing, model training, error reporting (MAE + interval coverage), exporting coefficients to `bone-model.ts`, and validating the model.
- **Paula (Validation/Biology):** Focuses on validation splits, checking biological plausibility of feature directions, and writing the benchmark methodology document.
- **4th Member (App/UX):** Owns UI implementation, watch/blood test photo inputs, user testing, promoting `/screen` to home page, and deleting legacy scaffold files.

## Hard Milestones and Schedule

- **◆ M1 (~22:00 Sat):** Assemble the NHANES analytic table containing features and low-BMD labels for overlapping respondents.
- **◆ M2 (~02:00 Sun):** Verify that the end-to-end pipeline works using the real model scoring in the app.
- **◆ M3 (10:00 Sun):** **Feature Freeze.** No new code. Transition to video recording, documentation, and submissions.
- **Submission Target:** 13:00 Sunday (with a 1-hour buffer before the 14:00 deadline).

## Core Judging Priorities (Technical Excellence & Foundation Value)

The board prioritizes steps to address the "Foundation Value" criteria, aiming to build a reusable scientific asset:
1. **Train Model on NHANES:** Replace placeholder coefficients with real coefficients, determine prediction intervals, and flip `MODEL_IS_VALIDATED` to true.
2. **Publish the Benchmark:** Document features, splits, MAE, and prediction interval coverage.
3. **Open-Source License:** Add an open MIT (code) + CC-BY (benchmark/docs) license.
4. **Clean Demo:** Focus on the core user flow first.

## Data Moat & Leakage Prevention

- **Label definition:** T-score computed vs. NHANES III young-adult female reference (Looker et al. 2010).
- **Anti-leakage rule:** The true DXA bone mineral density (BMD) or T-score must never be included in the predictive features (it is the label only).
- **Cycle verification:** Ensure respondents overlap on wrist-accelerometer and femur-DXA features. Overlap is identified in the 2013–2014 NHANES cycle.

## Where this fits

First-pass, source-only ingest. This page tracks progress against the project schedule, roles, and validation criteria.
