---
type: source
title: "docs/INPUT_SPEC.md — Input Specification"
raw: "docs/INPUT_SPEC.md"
ingested: 2026-07-19
tags: [spec, bonebot]
created: 2026-07-19
updated: 2026-07-19
---

# docs/INPUT_SPEC.md — Input Specification

The units, required/optional status, and valid range for every BoneBot
input, sourced from the team's shared Google Doc. The canonical reference
for validating or displaying any model input.

## Required vs optional

The 4 gate answers (assigned female at birth, age, periods stopped, already
diagnosed/scanned/on bone meds) plus age are **required**. Everything else is
optional — blank optional fields are auto-imputed, and the estimate sharpens
as more is filled in. Any value outside its valid range should be flagged as
a likely typo (e.g. vitamin D of 500 = wrong units).

## Ranges

| Input | Unit | Required? | Valid range (note) |
|---|---|---|---|
| Assigned female at birth | yes/no | Required (gate) | — |
| Age | years | Required | 18–110 (tool targets 40–100) |
| Periods stopped (menopause) | yes/no/not sure | Required (triage) | — |
| Already diagnosed/scanned/on bone meds | yes/no | Required (routing) | — |
| Previous T-score (if diagnosed) | SD (unitless) | Optional | −5.0 to +3.0 |
| BMI | kg/m² | Optional | 12–60 (normal 18.5–25) |
| Vitamin D (25-OH-D) | **nmol/L** | Optional | 10–250 (deficient <30, sufficient 50–125). US ng/mL × 2.5 = nmol/L |
| Calcium (serum) | **mmol/L** | Optional | 1.5–3.5 (normal 2.2–2.6). US mg/dL × 0.25 = mmol/L |
| ALP (alkaline phosphatase) | IU/L | Optional | 20–400 (normal ~30–130) |
| RBC (red blood cells) | ×10⁶/µL | Optional | 2.5–7.0 (normal women 3.9–5.0) |
| Current smoker | yes/no | Optional | — |
| Prior fragility fracture | yes/no | Optional | — |
| Long-term steroids (glucocorticoids) | yes/no | Optional | — |
| Alcohol ≥ 3 units/day | yes/no | Optional | — |
| Years since menopause | years | Optional (auto: age − menopause age) | 0–60 |
| Activity level | Low/Moderate/High → 0–1 | Optional | 0–1 |

**ALP and RBC** may be entered and shown as clinician context, but per
`[[clinical-evidence-library]]` are **not model features** — not weighted
into the T-score estimate (ALP predicts T-score only in the osteopenia
subgroup, ~7% variance; CBC counts don't reliably predict BMD).

## Unit conversions (for a user reading a lab report)

- Vitamin D: US labs report ng/mL — multiply by 2.5 to get nmol/L.
- Calcium: US labs report mg/dL — multiply by 0.25 to get mmol/L.

## Where this fits

Directly informs the valid-range checks anywhere BoneBot takes typed or
extracted input (e.g. `src/app/page.tsx`'s T-score entry, `src/app/api/
document/route.ts`'s PDF-extraction schema) and is the source for the
"years since menopause = age − menopause age" auto-impute rule used
throughout the app. No entity/concept pages exist yet — first-pass,
source-only ingest.
