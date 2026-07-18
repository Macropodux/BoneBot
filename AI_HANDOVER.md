# BoneBot AI Intake & Results — Agent Handover

**Status:** working draft, 18 July 2026
**Audience:** agents working on the chat, AI integration, model, and results UI

## Product in one sentence

BoneBot is a zero-login, consumer-facing bone-health screening tool for postmenopausal women. It collects a health profile, optional lab/wearable evidence, and returns an **estimated** DXA-style T-score with an uncertainty range and clear next steps. It is a screening flag, never a diagnosis.

## Non-negotiable architecture

```
chat / voice / photos -> validated structured features -> deterministic model -> model output -> LLM explanation
```

**The model predicts; the LLM extracts and explains.** The LLM must never set, calculate, or alter the T-score, confidence interval, risk band, or early-exit decision.

## Agreed user flow

### 1. Lightweight chat gate

The conversation begins with four short questions. A low-cost LLM may parse free-text or transcribed-voice answers, but the server owns the state machine and the decision made from each answer.

1. **“Were you assigned female at birth?”**
   `No` -> exit: BoneBot is not calibrated for this person.
2. **“How old are you?”**
   This is the main input to the lightweight triage model; it is not a hard eligibility cutoff.
3. **“Have your periods stopped for good (menopause)?”**
   `Yes`, `No`, or `Not sure` -> feeds the lightweight triage alongside age.
4. **“Have you already been diagnosed with osteoporosis, had a bone scan, or taken bone medication?”**
   `Yes` -> do not produce a new estimate. Ask for the most recent DXA T-score. If known, explain the **reported** result and give cautious, non-treatment guidance; if unknown, direct the person to their GP/scan provider.

The lightweight model uses age and menopause status to estimate P(osteoporosis): a validated result at or below 1% may safely stop the full questionnaire with prevention advice, while a result above 1% proceeds to the full assessment. Until Emre supplies that validated model, threshold, and calibration evidence, the first four questions are routing only; they must not claim “99% chance you do not have osteoporosis.”

### 2. Deep multimodal intake

Eligible users continue through one question at a time. The capable model can extract evidence from:

- typed free text;
- transcribed voice input (the UI/browser transcribes before sending it);
- blood-test photos;
- smartwatch/wearable screenshots;
- typed equivalents when users do not want to upload a photo.

For every extracted item, retain provenance: `chat`, `voice transcript`, `blood-test image`, `wearable image`, or `calculated`. For images, show a confirmation turn, e.g. “I read vitamin D as 42 nmol/L — is that correct?”

### 3. Score and result sheet

Only when every required feature has been validated:

1. Call the deterministic NHANES-trained model.
2. Receive its estimated T-score, interval, band, model status, and per-feature contributions.
3. Send that fixed output plus approved evidence cards to the LLM.
4. Show the results sheet: entered inputs and provenance, model contributions, T-score/range, confidence/uncertainty, plain-language explanation, lifestyle/GP guidance, and the DXA/clinician disclaimer.

## Demo path

The UI needs a **Demo** button with no chat required:

```
Demo button -> fixed fictional persona -> deterministic model -> results sheet -> LLM demo explanation
```

The demo explanation uses an explicit `mode: "demo"` flag. It must explain only the precomputed demo output, refer to the fictional persona rather than the viewer, and clearly state that it is not individual advice. It does **not** need a separate provider or a separate scoring model.

## Model features

### V1 agreed core inputs

1. Age
2. BMI
3. Vitamin D (blood)
4. Calcium (blood)
5. Current smoker (yes/no)
6. Prior fragility fracture (yes/no)
7. Long-term steroids (yes/no)
8. High alcohol intake, 3+ per day (yes/no)
9. Years since menopause

### Planned additions — only add when included in the trained model

- Weight-bearing activity
- Hormone replacement therapy
- Parental hip fracture
- Rheumatoid arthritis

Do not collect an extra factor and silently use it in a nine-feature model. If a value is collected for future use, label it as such and do not make it affect the v1 score.

## Input extraction and validation rules

The LLM may recognise phrasing and units, but deterministic server code must own conversion and validation.

- Example: `140 lb` -> convert server-side to kilograms -> calculate BMI.
- Example: vitamin D and calcium -> extract raw value + raw unit -> convert server-side to a canonical model unit.
- The feature contract must define canonical unit, accepted range, required/optional status, missing-data rule, question intent, and source/provenance for every feature.
- An invalid or implausible value gets at most two targeted clarification attempts.
- If a required value remains unresolved, do **not** score. Route to a clinician/DXA-safe message instead.
- Optional values may only default when the trained model and UI disclose the default explicitly.

## Evidence-driven explanations

Do **not** ask the LLM to search the web or rely on its general medical knowledge for each result. For the hackathon MVP, use a small versioned local evidence pack rather than a database/RAG system.

Each evidence card should contain:

- the factor it applies to;
- an approved, cautious plain-language statement;
- approved lifestyle/GP wording;
- a source citation;
- boundaries (for example, no medication advice).

The explanation call receives only the cards relevant to the person’s validated inputs and model contributions. It must not make unsupported numerical claims such as “this raised your risk by 20%” unless that exact claim is supported by the trained model/validation.

## LLM responsibilities

### Cheap text model

Used for the chat loop, one turn at a time:

1. Server selects the required next field/question.
2. LLM extracts a typed answer from the user’s free text or voice transcript: value, unit if relevant, confidence, and evidence/source.
3. Server converts, validates, retries, and advances the state.

The cheap model does not choose the next field or decide eligibility.

### Capable multimodal model

Used only after the gate for image extraction and eventually for the final plain-language explanation. It must return structured data for images and request confirmation when evidence is ambiguous.

### Existing explanation route

`src/app/api/screen/route.ts` already calls `scoreBone()` first and then uses the Vercel AI SDK to generate a structured report. Keep that separation. Add the demo-mode context and evidence-card context there or in a closely scoped helper.

## Current repository state

### Existing product code

- `src/lib/bone-model.ts` — deterministic model interface; its coefficients are currently **placeholders** and `MODEL_IS_VALIDATED = false`.
- `src/app/api/screen/route.ts` — scores first, then asks the LLM for a structured explanation; gracefully returns a model-only result if the LLM is unavailable.
- `src/app/screen/page.tsx` — existing form/result UI owned by the web-app contributor. Do not overwrite it without coordination.
- `src/app/assistant/` — separate voice-oriented prototype, not yet the agreed chat flow.

### New uncommitted backend draft from this work

- `src/lib/intake-schema.ts`
  - deterministic first-four-question state machine;
  - existing-DXA T-score route;
  - draft full-questionnaire feature assembly;
  - draft activity mapping and disclosed defaults.
- `src/app/api/intake/route.ts`
  - validates structured answers and returns the next intake state.

This draft deliberately has **no UI changes** and does not yet call an LLM. It is an API contract/starter for the web-app and AI integration work. It must be evolved to accept free-text turns, use the cheap extractor, preserve provenance and retry count, and await the final model-feature contract before being treated as complete.

## What is still needed

### From Emre / model lane

- final feature dictionary and transforms;
- canonical units and safe plausible ranges, especially vitamin D and calcium;
- required/optional/missing-data policy;
- trained coefficients, intercept, label definition, interval method, contribution method, model version;
- held-out validation metrics, calibration/coverage, and validated flag;
- separately trained early-exit model with threshold and confidence/NPV evidence.

### From clinical/product lane

- approved evidence cards and citations;
- advice boundaries and escalation wording;
- demo persona inputs and expected demo narrative;
- lab-photo fields to extract and their possible report units;
- wearable screenshot fields to extract and the validated activity transformation, if activity enters the model.

### From web-app lane

- chat UI that sends each free-text/voice turn plus current state to the intake API;
- image upload and user confirmation UI;
- demo button;
- results page showing model inputs, provenance, contributions, interval, validation status, report, and disclaimers.

## Safety and delivery rules

- Screening flag, never diagnosis; confirm with DXA and clinician.
- No treatment recommendations.
- While the model is unvalidated, show the placeholder/validation warning prominently.
- API keys remain server-side; all LLM calls use Vercel AI SDK.
- Keep the demo zero-login.
- Before an implementation pass: `git status --short`, then `git pull --ff-only` when it is safe to do so. Do not pull blindly over uncommitted overlapping work.
- Run `npm run build` before pushing. On this machine, the last build was blocked by fetching the existing Google Geist fonts; `npx tsc --noEmit` passed for the intake draft. Existing lint also has a pre-existing error in `src/app/scam/page.tsx`.
