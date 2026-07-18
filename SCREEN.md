# SCREEN — the product spec (exact input & output)

**The product is BoneBot** (`/assistant`) — a voice + photo bone-health assistant.
She gives BoneBot **as much objective data as possible via photos** (a blood test,
a watch screenshot), BoneBot **asks follow-up questions** for the history no screen
shows, then returns an **estimated-T-score report** — spoken back, in one of two
modes (*For me* / *For my GP*). The plain `/screen` form is the zero-dependency
**fallback demo**. No login.

- The narration is the demo script in `PROJECT.md` / `RUNBOOK.md §2`.
- The number comes from `src/lib/bone-model.ts` (a regression predicting an
  **estimated T-score**, trained on real DXA scans in NHANES) — computed
  deterministically. **The LLM only explains it; it never sets the number.**
- This file = what it looks like. Build to this; nothing more.

> **Build status (be honest in the demo):** voice in/out + the two modes + the
> estimate are wired (`/assistant`, `/api/assistant`, `/api/tts`). **Photo
> extraction (`/api/vision`) is designed here but NOT yet built** — it's the next
> feature. The `/screen` form works today as the fallback.

---

## What the output IS (read this first — judges will probe it)

We predict an **estimated T-score** — a bone-density number on the *same clinical
scale a DXA scan uses* (normal ≥ −1.0, osteopenia −1.0 to −2.5, osteoporosis
≤ −2.5). We learn *profile → T-score* from thousands of NHANES women who **were**
scanned, then estimate it for a woman who **was not**.

- It is an **estimate with uncertainty, never a measurement.** We show a **range**,
  not a bare number: *"estimated T-score ≈ −2.1, likely −2.8 to −1.4."* The range
  is our honesty — it replaces any hand-wavy "confidence %".
- The scan itself is never an input — it's the answer she goes and gets.
- 🔴 Label it **"estimated"** everywhere. Never imply we measured her bone density.

---

## INPUT — how BoneBot gathers the data

Principle: **as much objective data as possible via photos, then ask for the rest.**
Two channels:

**1. Photos → objective data (vision extraction).** She uploads:
- a **recent blood test** → BoneBot reads **vitamin D** and **calcium**;
- a **screenshot of her watch / activity app** → BoneBot reads **steps/day** and
  **active-minutes**.

The multimodal LLM extracts the numbers. It works on *any* device (Apple Watch,
Fitbit, Garmin) because it's just an image — which sidesteps the "Apple Health is
native-iOS-only" wall entirely. This is the multimodal integration the challenge
rewards, and it's *real* data, not a mocked "import" button.

**2. Follow-up questions → the history no screen shows.** BoneBot then asks for the
fields no photo contains: years since menopause, prior fracture, hormone therapy,
smoking, family history. Each question is **targeted** — it completes a model
feature, it doesn't wander into open chat.

Then BoneBot **confirms everything** and estimates.

### The objective / self-report split

| Comes from a PHOTO (objective) | BoneBot ASKS (history) |
|---|---|
| Vitamin D, calcium — blood test | Years since menopause |
| Steps / active-minutes — watch | Prior fragility fracture |
| | Hormone therapy · smoking · parental hip fracture |
| | Age · BMI (spoken or typed) |

### The model's features (what actually moves the number)

Mapped 1:1 to `BoneFeatures` in `bone-model.ts`:

| Field | Schema key | Notes |
|---|---|---|
| Age | `age` | years |
| Years since menopause | `yearsSinceMenopause` | the hormonal axis — our angle |
| BMI | `bmi` | protective to a point |
| On hormone therapy? | `onHormoneTherapy` | protective |
| Prior fragility fracture? | `priorFragilityFracture` | strong known risk factor |
| Parent broke a hip? | `parentalHipFracture` | known risk factor |
| Current smoker? | `currentSmoker` | risk factor |
| Weight-bearing activity | `weightBearingActivity` | 0–1, from the watch photo |

Plus, **once Emre trains them in:** vitamin D and calcium (NHANES has both — the
VID / BIOPRO files). Until then the vision layer extracts and *shows* them, but
they don't yet move the estimate — see guardrail 2.

### Three guardrails (honesty — a clinician judge will probe these)

1. **Confirm every extracted value before scoring.** BoneBot echoes back: *"I read
   vitamin D 42, calcium 2.3, ~4,000 steps — right?"* Never silently trust OCR of a
   health number.
2. **Only trained features move the estimate.** Extracted values are shown and
   confirmed as context; they change the T-score only once they're in the
   NHANES-trained model. 🔴 Emre decides which objective features are in v1.
3. **Transient, no storage.** Process images in memory, don't persist; use
   sample / de-identified documents in the demo.

🔬 **Movement honesty note:** steps / active-minutes are a **proxy** for
weight-bearing bone-loading, not a direct measure. We say so.

---

## OUTPUT — the report card

Built from `ModelOutput` (`estimatedTScore`, `tScoreRange`, `category`,
`contributions`) + the LLM's plain-English layer. The number is the model's; the
sentences (and the spoken voice) are the LLM's.

```text
┌─────────────────────────────────────────────┐
│   ESTIMATED T-SCORE   −2.1                   │  ← the headline number, clinical scale
│   likely range  −2.8 … −1.4                  │  ← the uncertainty (our honesty)
│   ⚠  osteoporosis range is plausible         │  ← band badge (colour-coded)
│                                              │
│   "Your estimated bone-density score is       │  ← LLM, warm + grounded,
│    about −2.1 — and it could be as low as     │    reads the number + factors,
│    −2.8, the osteoporosis range. The main     │    never invents a number
│    reasons are your six years since menopause,│
│    a prior fracture, and lower activity."      │
├─────────────────────────────────────────────┤
│   WHY  (what pushed the estimate down / up)  │  ← from contributions[]
│    ↓ Years since menopause  ↓ Prior fracture │
│    ↓ Low activity           ↑ Healthy BMI    │
├─────────────────────────────────────────────┤
│   YOUR DIGITAL TWIN — what you can change    │  ← counterfactual lever
│    If activity → High:  −2.1  →  −1.7        │
├─────────────────────────────────────────────┤
│   WHAT TO DO NEXT                            │  ← the strategy, per band
│    → Ask your GP for a DXA scan.             │
│    → Weight-bearing exercise, calcium & D.   │
├─────────────────────────────────────────────┤
│   ⓘ An estimate, not a diagnosis. A DXA scan │  ← always present
│     gives the real T-score.                  │
└─────────────────────────────────────────────┘
```

---

## The three bands → the strategy forward (the patient value)

`category` is derived in `bone-model.ts` from where the estimate **and its range**
sit on the clinical scale:

| Band | When | Colour | Meaning | **Next action for her** |
|---|---|---|---|---|
| **ELEVATED** | estimate ≤ −2.5, or range dips into osteoporosis | red | osteoporosis plausible | **See your GP for a DXA scan + fracture-risk review.** Start lifestyle now: weight-bearing + resistance exercise, calcium & vitamin D, stop smoking, limit alcohol. |
| **UNCERTAIN** | osteopenia zone, range doesn't reach −2.5 | amber | low-ish, unclear | **Mention it to your GP; a scan settles it.** Begin the same lifestyle steps. |
| **LOWER** | estimate ≥ −1.0 | green | reassuring for now | **No scan indicated on this estimate.** Keep active, calcium & vitamin D; re-check if things change. |

**"Uncertain" is deliberate** — when the range doesn't clearly cross a threshold,
we say so rather than fake precision. A confident wrong number is the worst outcome.

---

## Two modes — same model, two audiences (one toggle)

The estimate is computed once; **how it's presented depends on who's looking.** This
is our credibility edge — a licensed physician on the team means the GP view is
real, not cosplay.

### 👤 Consumer mode (*For me*) — warm, motivating, plain language

Her output has **two strands**, and which leads depends on the band:

- **Strand 1 — Lifestyle (what she can change now).** Weight-bearing + resistance
  exercise, calcium & vitamin D, stop smoking, limit alcohol — encouraging, powered
  by the digital-twin lever ("increase activity, −2.1 → −1.7"). Shows in **every** band.
- **Strand 2 — See a GP (the referral nudge).** For **elevated / uncertain**: "book
  a DXA scan and a fracture-risk review." Empowering, never alarming.

| Band | Which strand leads |
|---|---|
| Elevated | **Both** — lead with *see a GP*, then lifestyle. |
| Uncertain | **Both** — *mention it to your GP*, plus lifestyle now. |
| Lower | **Lifestyle only** — reassure + maintain. |

### 🩺 GP mode (*For my GP*) — concise, clinical, decision-support

- Estimated T-score + range + band (normal / osteopenia / osteoporosis).
- Factors, **separating known clinical risk factors from anything only
  statistically associated**. Objective inputs (labs, activity) flagged as measured.
- A **suggested action to weigh**, e.g. *"estimate in osteoporosis range, interval
  crosses −2.5 → consider DXA referral / FRAX assessment"* — a suggestion, not an
  instruction.
- Provenance: trained on NHANES, error (MAE) + interval coverage, "not a diagnostic
  device."

> **Scope note:** two modes = two LLM prompts, one model. Josh approves it into the
> demo before it's built. Consumer mode ships first; GP mode is the clinical-
> credibility stretch.

---

## BoneBot — the technical shape (`/assistant`)

Built additively so the plain `/screen` form remains the safe fallback demo.

- **Input:** photos (blood + watch → `/api/vision`, *next build*), plus **speak or
  type** (browser Web Speech API — no dependency, no key) for follow-ups.
- **The number:** `scoreBone()` runs **client-side** — deterministic, the model.
- **Voice out:** `/api/tts` → **ElevenLabs** (REST, no SDK dep); falls back to the
  browser voice if `ELEVENLABS_API_KEY` is absent.
- **Two modes** via `/api/assistant` (two system prompts, same model).
- **Graceful:** every route returns a plain 503 sentence without keys — no stack
  trace in front of a judge.
- 🔑 **Needs in Vercel:** `ANTHROPIC_API_KEY` (set) + `ELEVENLABS_API_KEY` (for voice).

### Stretch (optional, NOT the MVP): BoneBeats 🎵

ElevenLabs can generate music, so the consumer's lifestyle tips could become a short
upbeat encouragement song. Fun, shareable, sponsor-aligned — but a gimmick next to
the clinical moat, and it cuts against "simpler = punchier." Build only if
everything else is done and Josh green-lights it; consumer mode only, never clinician.

---

## The "not yet validated" banner (temporary state)

While `MODEL_IS_VALIDATED = false` in `bone-model.ts`, a visible strip reads:
*"Illustrative — coefficients not yet trained on NHANES."* It disappears the moment
Emre exports the real regression coefficients. **Never demo placeholder numbers
without this banner.**

---

## What the 3 minutes shows

Josh opens **BoneBot** → uploads a **blood test + a watch screenshot** → BoneBot
reads the objective numbers, **asks two quick history questions**, confirms → then
**speaks** the result: *estimated T-score −2.1, range −2.8…−1.4, osteoporosis
plausible* → the *why* → **what to do next (see GP + lifestyle)** → closes on
"trained on NHANES, published openly." The `/screen` form is the fallback if voice
or photos wobble. **One assistant, one conversation.**
