---
type: source
title: "AI_HANDOVER.md — Agent Handover: Intake & Results Architecture"
raw: "AI_HANDOVER.md"
ingested: 2026-07-19
tags: [spec, bonebot]
created: 2026-07-19
updated: 2026-07-19
---

# AI_HANDOVER.md — Agent Handover: Intake & Results Architecture

The single most authoritative in-repo doc for BoneBot's intended chat/model/LLM
architecture as of 2026-07-19 (marked "working draft, 18 July 2026"). Audience:
agents working on chat, AI integration, model, and results UI. Where this
disagrees with an older doc (e.g. `SCREEN.md`'s earlier drafts), this is the
more recent, more binding source — cross-check dates before trusting either.

## Non-negotiable architecture

```
chat / voice / photos -> validated structured features -> deterministic model -> model output -> LLM explanation
```

The model predicts; the LLM extracts and explains. The LLM must never set,
calculate, or alter the T-score, confidence interval, risk band, or
early-exit decision.

## Agreed user flow

1. **Lightweight chat gate** — 4 short questions (assigned-female-at-birth,
   age, menopause status, already-diagnosed). A cheap LLM may parse free text
   or voice transcript, but the **server owns the state machine and the
   decision**. Age + menopause status feed a lightweight triage model
   estimating P(osteoporosis); at/below the routing threshold (5% as of this
   doc) stops with prevention advice, above it proceeds to the full
   questionnaire.
2. **Deep multimodal intake** — one question at a time; a capable model can
   extract from typed text, voice transcript, blood-test photos, or wearable
   screenshots. Every extracted item keeps provenance (`chat` / `voice
   transcript` / `blood-test image` / `wearable image` / `calculated`).
   Images get a confirmation turn before use.
3. **Score and result sheet** — only once every required feature is
   validated: call the deterministic NHANES-trained model, then send its
   fixed output + approved evidence cards to the LLM for explanation. Result
   sheet shows: entered inputs + provenance, model contributions, T-score +
   range, confidence/uncertainty, plain-language explanation, lifestyle/GP
   guidance, DXA/clinician disclaimer.

A separate **Demo button** path exists: fixed fictional persona -> the same
deterministic model -> results sheet -> an LLM explanation using an explicit
`mode: "demo"` flag (explains only the precomputed demo output, refers to the
persona not the viewer, states it isn't individual advice — no separate
provider/model needed).

## Model features

**V1 agreed core inputs (9):** age, BMI, vitamin D (blood), calcium (blood),
current smoker, prior fragility fracture, long-term steroids, high alcohol
intake (3+/day), years since menopause.

**Planned additions — only when included in the trained model:**
weight-bearing activity, hormone replacement therapy, and rheumatoid arthritis.
Explicit rule: never collect a factor and silently use
it in a nine-feature model — if collected for future use, label it as such
and don't let it affect the v1 score.

## Input extraction and validation rules

The LLM may recognise phrasing/units, but **deterministic server code must
own conversion and validation** (e.g. `140 lb` -> converted server-side to
kg; vitamin D/calcium -> raw value + unit extracted, then converted
server-side to the canonical model unit). Every feature needs: canonical
unit, accepted range, required/optional status, missing-data rule, question
intent, provenance. An invalid/implausible value gets at most two targeted
clarification attempts; if a required value stays unresolved, **do not
score** — route to a clinician/DXA-safe message instead. Optional values may
only default when the trained model and UI explicitly disclose the default.

## Evidence-driven explanations

Do not let the LLM search the web or rely on general medical knowledge per
result — for the hackathon MVP, use a small versioned local evidence pack
(not RAG/a database). Each card: the factor it applies to, an approved
cautious plain-language statement, approved lifestyle/GP wording, a source
citation, boundaries (e.g. no medication advice). The explanation call
receives only cards relevant to the person's validated inputs and model
contributions, and must not make unsupported numerical claims ("this raised
your risk by 20%") unless the trained model/validation actually supports it.

## LLM responsibilities — two tiers

- **Cheap text model** (per-turn chat loop): server selects the next
  field/question; LLM extracts a typed answer from free text/voice
  (value, unit, confidence, evidence/source); server converts, validates,
  retries, advances state. The cheap model does **not** choose the next
  field or decide eligibility.
- **Capable multimodal model**: used only after the gate, for image
  extraction and the final plain-language explanation. Must return
  structured data for images and request confirmation when ambiguous.

`src/app/api/screen/route.ts` already scores first then calls the AI SDK for
a structured report — keep that separation; add demo-mode/evidence-card
context there or in a closely scoped helper.

## Repository state at time of writing (2026-07-19, pre-dawn)

- `src/lib/bone-model.ts` — deterministic model interface; coefficients were
  **placeholders**, `MODEL_IS_VALIDATED = false` (this has since changed —
  see `model/model-parameters.ts`, wired in later the same night).
- `src/app/screen/page.tsx` — existing form/result UI, "owned by the web-app
  contributor, do not overwrite without coordination."
- `src/app/assistant/` — called out as "a separate voice-oriented prototype,
  not yet the agreed chat flow" (this path was later deleted and its
  functionality folded into `src/app/page.tsx`).
- New at the time: `src/lib/intake-schema.ts` (deterministic first-four-
  question state machine + existing-DXA T-score route + draft full-
  questionnaire assembly) and `src/app/api/intake/route.ts` (validates
  structured answers, returns next intake state) — explicitly a no-UI,
  no-LLM-yet API contract/starter, not treated as complete.

## What was still needed (as of this doc)

- **Model lane:** final feature dictionary + transforms, canonical units +
  safe ranges (esp. vitamin D/calcium), required/optional/missing-data
  policy, trained coefficients + validation metrics + validated flag,
  separately trained early-exit model with threshold/confidence evidence.
- **Clinical/product lane:** approved evidence cards + citations, advice
  boundaries/escalation wording, demo persona + narrative, lab-photo and
  wearable-screenshot fields to extract.
- **Web-app lane:** chat UI sending each turn + state to the intake API,
  image upload + confirmation UI, demo button, results page showing inputs,
  provenance, contributions, interval, validation status, disclaimers.

## Safety and delivery rules (repeats/reinforces AGENTS.md)

Screening flag never diagnosis; no treatment recommendations; prominent
placeholder/validation warning while unvalidated; API keys server-side only,
all LLM calls via Vercel AI SDK; zero-login demo; `git status --short` then
`git pull --ff-only` before an implementation pass, never pull blindly over
uncommitted overlapping work; run `npm run build` before pushing.

## Where this fits

Supersedes the older `[[screen-md-spec]]` narrative on chat architecture
specifics (front-gate model shape, feature list, LLM-tier split) — treat this
page as authoritative for architecture questions and `[[screen-md-spec]]` as
authoritative for exact UI/output-card layout, checking dates if they seem to
disagree. No entity/concept pages exist yet — first-pass, source-only ingest.
