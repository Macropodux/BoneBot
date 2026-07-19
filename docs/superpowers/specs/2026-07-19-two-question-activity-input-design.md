# Two-Question Activity Input Design

## Goal

Replace the single Low/Moderate/High activity question with two concrete daily-average inputs that better match the wearable-derived activity signal available to users.

## Exact Questions

1. **Over the past 7 days, about how many steps did you average per day?**
   - Helper: **Enter the average shown in Apple Health or your activity app, or upload a weekly activity summary.**
2. **Over the past 7 days, about how many active or exercise minutes did you average per day?**
   - Helper: **Use the daily average from your watch or activity app. This does not include ordinary standing time.**

## Interaction

- Ask the questions sequentially in the conversational intake.
- Each accepts a manual number or values extracted from an optional Apple Watch, Apple Health, or comparable activity-app screenshot.
- Keep screenshot upload available alongside both questions; one upload may populate both values.
- Show extracted values for confirmation before using them.
- Permit either value to be skipped independently.

## Data Handling

- Store average daily steps and average daily active/exercise minutes separately.
- Map each available value to the model's existing 0–1 activity input using deterministic code, never the language model.
- If both values are supplied, combine their normalized scores by arithmetic mean.
- If only one is supplied, use that normalized score.
- If neither is supplied, retain the published population-average imputation default and do not present activity as a user-provided result driver.
- Label the inputs as practical proxies for the daily wrist-movement measure used in model training; do not claim they are equivalent to MIMS.

## Scope

- Update the primary conversational flow, screenshot confirmation state, deterministic activity mapping, example-patient data, and relevant documentation/tests.
- Keep the server-owned intake schema consistent with the same two inputs.
- Do not retrain or change model coefficients.
- Do not change unrelated clinical questions, model logic, or visual styling.

## Verification

- Write failing tests for the two-input deterministic mapping and questionnaire sequence before production changes.
- Verify manual entry, screenshot autofill/confirmation, independent skipping, one-value mapping, two-value averaging, and both-missing fallback.
- Run Vitest, Python tests, TypeScript, lint, and production build before deployment.
- Rebase and push directly to shared `main` without force-pushing.
