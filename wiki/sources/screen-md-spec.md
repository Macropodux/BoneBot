---
type: source
title: "SCREEN.md — Product and Interface Spec"
raw: "SCREEN.md"
ingested: 2026-07-18
tags: [spec, bonebot]
created: 2026-07-18
updated: 2026-07-18
---

# SCREEN.md — Product and Interface Spec

`SCREEN.md` defines the exact user flows, input modalities, feature mappings, and reporting templates for the **BoneBot** assistant.

## The Core Product: BoneBot (`/assistant`)

BoneBot is an interactive voice and image-enabled assistant. The plain form interface at `/screen` acts as a zero-dependency fallback for the demo.
- **Input Processing:**
  - **Vision Extraction:** Users upload a recent blood test (extracts vitamin D and calcium) and a watch screenshot (extracts steps and active minutes).
  - **Speech/Chat follow-ups:** BoneBot prompts for clinical history (menopause years, prior fractures, hormone therapy, smoking, etc.) via type or voice input.
- **Honesty Guardrails:**
  - Every extracted value from vision OCR must be explicitly confirmed by the user before scoring: *"I read vitamin D 42, calcium 2.3, ~4,000 steps — right?"*
  - Only features supported by the trained model impact the estimated T-score.
  - Image files are processed in-memory and are never stored.

## The Estimated T-Score Output

The model estimates a point T-score and a prediction interval mapping to the standard clinical DXA scale:
- **Range Output:** Always show an uncertainty interval rather than a single point estimate (e.g., *"estimated T-score -2.1, likely -2.8 to -1.4"*).
- **Diagnostic Disclaimer:** Explicitly frame results as a screening flag, not a medical diagnosis, stating: *"A DXA scan confirms your real T-score."*

## Output Categorization & Actionable Guidance

The estimated risk is grouped into three bands:
1. **Elevated (Red):** Estimate $\le -2.5$ or uncertainty range dips into the osteoporosis zone. Recommendation: See GP for a DXA scan, start exercise and supplement guidelines.
2. **Uncertain (Amber):** T-score falls in the osteopenia zone (between $-1.0$ and $-2.5$). Recommendation: Discuss with GP, start exercise and lifestyle guidelines.
3. **Lower (Green):** Estimate $\ge -1.0$ (normal bone density). Recommendation: Continue regular activity and supplements.

## Additional Features & MVP Scope

- **Digital Twin Counterfactual:** The UI should feature a counterfactual comparison showing how modifying a factor affects the score (e.g., *"If activity level goes from Low to High, estimated T-score changes from -2.1 to -1.7"*).
- **Fall-Risk Stratification (Stretch):** A secondary classification based on fall history, gait speed, and balance factors to complement the bone-density assessment.
- **Clinical Mode:** Excluded from the MVP scope; the hackathon build focuses solely on the postmenopausal consumer.
- **Speech Stack:** Browser Web Speech API for voice input; ElevenLabs API for spoken output with a fallback to the browser's speech synthesis.

## Where this fits

First-pass, source-only ingest. This document provides the layout and copy spec for the interface and LLM generation schemas.
