# BoneBot — Input Specification

Units, whether each input is required, and its valid range. **The 4 gate answers +
age are required**; everything else is optional — blank optional fields are
auto-imputed, so the estimate sharpens as more is filled in. Flag any value outside
its valid range as a likely typo (e.g. vitamin D of 500 = wrong units).

| Input | Unit | Required? | Valid range (+ note) |
|---|---|---|---|
| Assigned female at birth | yes/no | **Required** (gate) | — |
| Age | years | **Required** | 18–110 (tool targets 40–100) |
| Periods stopped (menopause) | yes / no / not sure | **Required** (triage) | — |
| Already diagnosed / scanned / on bone meds | yes/no | **Required** (routing) | — |
| Previous T-score (only if diagnosed) | SD (unitless) | Optional | −5.0 to +3.0 |
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
| Average daily steps (past 7 days) | steps/day | Optional | 0–100,000; manual entry or confirmed activity-app screenshot |
| Average daily active/exercise minutes (past 7 days) | minutes/day | Optional | 0–1,440; excludes ordinary standing time |

> **Note on ALP and RBC:** these can be *entered and shown as clinician context*,
> but per [`EVIDENCE.md`](EVIDENCE.md) they are **not model features** — they are not
> weighted into the T-score estimate (ALP predicts T-score only in the osteopenia
> subgroup ~7% variance; CBC counts don't reliably predict BMD). The model's inputs
> are the other fields.

> **Note on wearable activity:** steps and active/exercise minutes are practical
> consumer-device proxies for the daily wrist-movement (MIMS) measure used in
> model training; they are not equivalent to MIMS. Each available value is
> normalized deterministically (10,000 steps/day and 45 active minutes/day map
> to 1.0, capped at 1.0), and the two normalized values are averaged when both
> are supplied. If neither is supplied, the published population-average
> activity default is used.

## Unit conversions (for a user reading a lab report)

- **Vitamin D:** US labs report ng/mL — multiply by 2.5 to get nmol/L.
- **Calcium:** US labs report mg/dL — multiply by 0.25 to get mmol/L.

---

*Rule of thumb for the form: the 4 gate answers + age are mandatory; everything else
is optional and improves accuracy. Anything outside the valid range → warn the user
it looks like a typo or wrong units.*
