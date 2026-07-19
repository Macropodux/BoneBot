---
type: source
title: "PROJECT.md — BoneBot Spec and Plan"
raw: "PROJECT.md"
ingested: 2026-07-18
tags: [spec, bonebot, hackathon]
created: 2026-07-18
updated: 2026-07-18
---

# PROJECT.md — BoneBot Spec and Plan

`PROJECT.md` is the primary spec and execution plan for **BoneBot**, the project chosen for Hack-Nation Challenge 05 (Women's Hormonal Health). BoneBot is designed to provide hormone-aware bone-health screening for postmenopausal women by combining a user's health profile with wearable activity data.

## Core Flow and Concept

The product is built around the **BoneBot** voice and photo assistant:
- A user talks to BoneBot and uploads photos (blood test for vitamin D and calcium, and a watch/activity screenshot for step count and active minutes).
- BoneBot asks targeted follow-up questions to collect key medical and reproductive history (years since menopause, prior fractures, hormone therapy, and smoking).
- BoneBot outputs an **estimated T-score with an uncertainty range** (e.g. "≈ −2.1, likely −2.8 to −1.4"), identifies top contributing factors, and offers actionable, non-diagnostic guidance (see GP for a DXA scan, lifestyle modifications like weight-bearing exercise).

## Architecture

The project enforces a strict boundary between the predictive model and the LLM:
- **The model predicts. The LLM only explains.**
- The predictive model is a deterministic linear regression trained on National Health and Nutrition Examination Survey (NHANES) DXA bone density and wearable activity data.
- The scoring code is implemented entirely in TypeScript (`src/lib/bone-model.ts`) using exported coefficients to eliminate the need for an external Python service.
- The LLM receives the model's output and translates it into warm, non-diagnostic, explanatory language, but never sets or overrides the numerical T-score.

## 3-Minute Demo Script

The demo script defines the scope of the MVP:
1. **0:00–0:20 (Problem):** Highlighting that 1 in 2 postmenopausal women will fracture, and estrogen loss combined with inactivity accelerates bone loss.
2. **0:20–0:40 (Gap):** Showing how static questionnaires ignore wearable/activity data.
3. **0:40–1:40 (Demo):** Demonstrating the flow with a 58-year-old female persona, generating an estimated T-score of -2.1 (osteoporosis plausible).
4. **1:40–2:20 (Science):** Explaining the NHANES training, the prediction interval, and the open-source benchmark.
5. **2:20–3:00 (Impact):** Pointing to earlier screenings, reproducible model, and open benchmarks.

## Data Plan and Team Roles

- **NHANES dataset:** Overlap cycle identified as **2013–2014** (containing both wrist-accelerometer and femur-DXA data).
- **Emre (ML):** Assemble NHANES data, train the regression model, report MAE + interval coverage, export coefficients to `bone-model.ts`, and flip `MODEL_IS_VALIDATED`.
- **Josh (Clinical/Demo):** Own the clinical framing, system prompt, demo script, and final video narration.
- **Paula (Validation/Biology):** Perform feature direction sanity-checks, define the train/validation splits, and help write the benchmark methodology document.
- **4th Member (App/Polish):** Implement the UI pass, integrate watch/blood-test image upload, promote `/screen` (or `/assistant`) as the main home page, and clean up throwaway scaffold code (e.g. `/scam`, `/chat`).

## Where this fits

First-pass, source-only ingest. This summary page serves as a key reference for the project scope, MVP features, and development roles.
