# SCREEN — the one page we ship (exact input & output)

**This is the whole product surface.** One page at `/screen`, no login. A profile
form goes in; a **estimated-T-score report** comes out. One toggle switches
between **Consumer mode** (the woman) and **GP mode** (her clinician). Everything
else (other routes, Supabase, the scam/chat examples) stays hidden or deleted.

- The narration is the demo script in `PROJECT.md` / `RUNBOOK.md §2`.
- The number comes from `src/lib/bone-model.ts` (a regression predicting an
  **estimated T-score**, trained on real DXA scans in NHANES).
- The prose comes from the LLM in `src/app/api/screen/route.ts` (it only explains).
- This file = what it looks like. Build to this; nothing more.

---

## What the output IS (read this first — it's the thing judges will probe)

We predict an **estimated T-score** — a bone-density number on the *same clinical
scale a DXA scan uses* (normal ≥ −1.0, osteopenia −1.0 to −2.5, osteoporosis
≤ −2.5). We learn the mapping *profile → T-score* from thousands of NHANES women
who **were** scanned, then estimate it for a new woman who **was not**.

- It is an **estimate with uncertainty, never a measurement.** We show a **range**,
  not a bare number: *"estimated T-score ≈ −2.1, likely −2.8 to −1.4."* The range
  is our honesty — it replaces any hand-wavy "confidence %".
- The scan itself is never an input — it's the answer she goes and gets.
- 🔴 Label it **"estimated"** everywhere. Never imply we measured her bone density.

---

## INPUT — the profile form (top of the page)

Eight fields, mapped 1:1 to `BoneFeatures` in `bone-model.ts`.

```text
┌─────────────────────────────────────────────┐
│  BoneWise — bone-health screening            │
│  Data you already have → an estimated bone-  │
│  density score, before the first fracture.   │
├─────────────────────────────────────────────┤
│  ABOUT YOU                                   │
│   Age                        [ 58 ]          │
│   Years since menopause      [ 6  ]          │
│   BMI                        [ 22 ]          │
│                                              │
│  YOUR HISTORY                                │
│   On hormone therapy?        ( )Yes (•)No    │
│   Prior fragility fracture?  (•)Yes ( )No    │
│   Parent broke a hip?        (•)Yes ( )No    │
│   Current smoker?            ( )Yes (•)No    │
│                                              │
│  YOUR ACTIVITY  ← the wearable hero          │
│   Weight-bearing activity                    │
│   Low ●──────────○ High   [import from watch]│
│                                              │
│         [  Estimate my bone-density score  ] │
└─────────────────────────────────────────────┘
```

| Field | Schema key | Notes |
|---|---|---|
| Age | `age` | years |
| Years since menopause | `yearsSinceMenopause` | the hormonal axis — our angle |
| BMI | `bmi` | protective to a point |
| On hormone therapy? | `onHormoneTherapy` | protective |
| Prior fragility fracture? | `priorFragilityFracture` | strong known risk factor |
| Parent broke a hip? | `parentalHipFracture` | known risk factor |
| Current smoker? | `currentSmoker` | risk factor |
| Weight-bearing activity | `weightBearingActivity` | 0–1, **the wearable feature** |

### What the movement data is (and what she enters for it)

`weightBearingActivity` is a measure of **bone-loading** physical activity — the
kind that mechanically loads the skeleton and stimulates bone (walking, jogging,
stairs, dancing, resistance training). Non-weight-bearing (swimming, cycling)
counts less for bone. It's in the model because it's the **main modifiable
factor** — the lever the digital twin pulls.

She enters it one of three ways, all normalised to the same 0–1 scale:

1. **Quick self-report (default):** days/week of ≥30 min weight-bearing activity,
   or a Low / Moderate / High selector.
2. **Wearable import (the demo hero):** connect Apple Health / Google Fit / Fitbit
   → pull steps/day or active-minutes → normalise. Demo: "import from watch"
   pre-fills the slider.
3. **Training feature (NHANES):** derived from the wrist accelerometer (activity
   counts / MVPA minutes), same scale.

🔬 **Honesty note:** an accelerometer measures *overall movement* — a **proxy** for
weight-bearing loading, not weight-bearing specifically. Steps / active-minutes is
a reasonable proxy and we say so.

---

## OUTPUT — the report card (renders below, on submit)

Built from `ModelOutput` (`estimatedTScore`, `tScoreRange`, `category`,
`contributions`) + the LLM's plain-English layer. The number is the model's; the
sentences are the LLM's.

```text
┌─────────────────────────────────────────────┐
│   ESTIMATED T-SCORE   −2.1                   │  ← the headline number, clinical scale
│   likely range  −2.8 … −1.4                  │  ← the uncertainty (our honesty)
│   ⚠  osteoporosis range is plausible         │  ← category badge (colour by band)
│                                              │
│   "Your estimated bone-density score is       │  ← LLM, warm + grounded,
│    about −2.1 — and it could be as low as     │    reads the number + factors,
│    −2.8, which is the osteoporosis range.      │    never invents a number
│    The main reasons are your six years since  │
│    menopause, a prior fracture, and lower      │
│    weight-bearing activity."                   │
├─────────────────────────────────────────────┤
│   WHY  (what pushed the estimate down / up)  │  ← from contributions[]
│    ↓ Years since menopause                   │
│    ↓ Prior fragility fracture                │
│    ↓ Low weight-bearing activity             │
│    ↑ Healthy BMI                             │
├─────────────────────────────────────────────┤
│   YOUR DIGITAL TWIN — what you can change    │  ← counterfactual levers
│    If activity → High:  −2.1  →  −1.7        │
│    ▁▂▃  moves toward the osteopenia range     │  ← inline SVG, NO chart dep
├─────────────────────────────────────────────┤
│   WHAT TO DO NEXT                            │  ← the strategy, tailored per band
│    → Ask your GP for a DXA scan + fracture-  │
│      risk review.                            │
│    → Weight-bearing + resistance exercise,   │
│      calcium & vitamin D, stop smoking.      │
├─────────────────────────────────────────────┤
│   ⓘ An estimate, not a diagnosis. A DXA scan │  ← always present
│     gives the real T-score.                  │
└─────────────────────────────────────────────┘
```

---

## The three bands → the strategy forward (this is the patient value)

`category` is derived in `bone-model.ts` from where the estimate **and its range**
sit on the clinical scale:

| Band | When | Colour | What it means | **Next action for her** |
|---|---|---|---|---|
| **ELEVATED** | estimate ≤ −2.5, or range dips into osteoporosis | red | osteoporosis is plausible | **See your GP for a DXA scan + fracture-risk review.** Start bone-protective lifestyle now: weight-bearing + resistance exercise, calcium & vitamin D, stop smoking, limit alcohol. |
| **UNCERTAIN** | osteopenia zone, range doesn't reach −2.5 | amber | low-ish, but unclear | **Mention it to your GP at your next visit; a scan settles it.** Begin the same lifestyle steps — they help regardless. |
| **LOWER** | estimate ≥ −1.0 | green | reassuring for now | **No scan indicated on this estimate.** Keep bones strong — stay active (weight-bearing), calcium & vitamin D; re-check if things change (a new fracture, more years since menopause). |

**"Uncertain" is deliberate** — when the range doesn't clearly cross a threshold,
we say so rather than fake precision. A confident wrong number is the worst outcome.

---

## Two modes — same model, two audiences (one toggle)

The estimated T-score is computed once; **how it's presented depends on who's
looking.** A toggle at the top switches between the two. This is our credibility
edge — a licensed physician on the team means the GP view is real, not cosplay.

### 👤 Consumer mode (the woman) — warm, motivating, plain language

Goal: help her understand her estimate and **act**. Her output has **two strands**,
and which one leads depends on the band:

- **Strand 1 — Lifestyle (what she can change now).** Weight-bearing + resistance
  exercise, calcium & vitamin D, stop smoking, limit alcohol — framed
  encouragingly, powered by the digital-twin lever ("increase activity and your
  estimate moves −2.1 → −1.7"). This strand shows in **every** band.
- **Strand 2 — See a GP (the referral nudge).** For **elevated / uncertain**:
  "book a DXA scan and a fracture-risk review." Empowering, never alarming.

| Band | Which strand leads |
|---|---|
| Elevated | **Both** — lead with *see a GP for a scan*, then lifestyle. |
| Uncertain | **Both** — *mention it to your GP*, plus start lifestyle now. |
| Lower | **Lifestyle only** — reassure + maintain; no GP nudge. |

Tone: no jargon, no diagnosis, "estimated" throughout. The LLM system prompt for
this mode is warm and constructive.

### 🩺 GP mode (the clinician) — concise, clinical, decision-support

Goal: give a GP what they need to **decide**, framed as decision support with a
human in the loop (never a directive).

- Estimated T-score + range on the clinical scale, with the band (normal /
  osteopenia / osteoporosis).
- Contributing factors, **separating known clinical risk factors from anything
  only statistically associated**.
- A **suggested clinical action**, e.g. *"estimate in osteoporosis range, interval
  crosses −2.5 → consider DXA referral / FRAX assessment."* Phrased as a
  suggestion the GP weighs, not an instruction.
- Model provenance: trained on NHANES, error (MAE) + interval coverage, "not a
  diagnostic device."

Tone: terse, evidence-flagged. This is what a clinical judge (e.g. Verily) wants
to see, and it's the regulator-conscious framing the challenge rewards.

> **Scope note:** two modes = two LLM prompts + two card layouts on one page, same
> model underneath. It's a real feature — Josh approves it into the demo before
> it gets built. If time is tight, Consumer mode ships first; GP mode is the
> stretch that showcases the clinical credibility.

---

## BoneBot — the voice format (`/assistant`)

The chat/voice version of the product, built additively so the plain `/screen`
form still works as the safe fallback demo.

- **Input:** type, or **speak** (browser Web Speech API — no dependency, no key).
- **The number:** `scoreBone()` runs **client-side** — deterministic, the model.
  BoneBot never sets the T-score.
- **Voice out:** `/api/tts` calls **ElevenLabs** (REST, no SDK dep); falls back to
  the browser voice if `ELEVENLABS_API_KEY` is absent.
- **Two modes** (toggle): *For me* (consumer — what to do: lifestyle / see a GP)
  and *For my GP* (clinician — whether to act: decision support). Same model, two
  system prompts in `/api/assistant`.
- **Graceful:** both routes return a plain 503 sentence without keys — no stack
  trace in front of a judge.
- 🔑 **Needs in Vercel:** `ANTHROPIC_API_KEY` (already set) + `ELEVENLABS_API_KEY`.

### Stretch (optional, NOT the MVP): BoneBeats 🎵

ElevenLabs can generate music, so the consumer's lifestyle tips could become a
short upbeat encouragement song. Fun, shareable, sponsor-aligned — but a gimmick
next to the clinical moat, and it cuts against "simpler = punchier." Park it:
build only if everything else is done and Josh green-lights it, and keep it firmly
in consumer mode, never clinician.

---

## The "not yet validated" banner (temporary state)

While `MODEL_IS_VALIDATED = false` in `bone-model.ts`, a visible strip reads:
*"Illustrative — coefficients not yet trained on NHANES."* It disappears the moment
Emre exports the real regression coefficients. **Never demo placeholder numbers
without this banner.**

---

## What the 3 minutes shows

Josh types the persona's numbers → one click → the card shows **estimated T-score
−2.1, range −2.8…−1.4, osteoporosis plausible** → he points at the *why* → the
*digital twin* lever nudges the score up as activity rises → closes on **what to do
next (see GP + lifestyle)** and "trained on NHANES, published openly." **One screen,
one interaction, no navigation.**
