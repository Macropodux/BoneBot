# SCREEN — the product spec (exact input & output)

**The product is BoneBot** (`/assistant`) — a voice + photo bone-health assistant.
She gives BoneBot **as much objective data as possible via photos** (a blood test,
a watch screenshot), BoneBot **asks follow-up questions** for the history no screen
shows, then returns an **estimated-T-score report** — spoken back, **built for her,
the consumer** (a clinician view is future work, not this build). The plain `/screen` form is the zero-dependency
**fallback demo**. No login.

- The narration is the demo script in `PROJECT.md`.
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

## Front-gate: 4 questions → soft triage (before the full assessment)

Four opening questions feed a **lightweight triage model** that estimates the
*probability* osteoporosis is even plausible — a **graded screen, not a hard
cutoff**. It answers "should we even look?" before the heavyweight model estimates
the actual T-score.

1. **"Were you assigned female at birth?"** *(yes/no)*
   → eligibility — the model is trained on women. *No* → general bone-health info, stop.
2. **"How old are you?"** *(number)*
   → the **main driver of the triage probability**. Replaces a hard "50+" cutoff —
   the model grades age continuously.
3. **"Have your periods stopped for good (menopause)?"** *(yes / no / not sure)*
   → feeds the triage alongside age; being postmenopausal sharply raises the probability.
4. **"Have you already been diagnosed with osteoporosis, had a bone scan, or take
   bone medication?"** *(yes/no)*
   → routing. *Yes* → ask for her **real T-score** and interpret it (skip the
   estimate; unknown → point her to her GP). *No* → run the assessment.

**Flow:**
- Q1 *No* → general info, stop.
- Q4 *Yes* → real-T-score path.
- Else → the lightweight model takes **age (Q2) + menopause (Q3)** → **P(osteoporosis)**:
  - **≤ 5%** (e.g. a younger, premenopausal woman) → "your initial screening estimate is very low"
    + prevention tips; no full assessment.
  - **> 5%** → proceed to the **full questionnaire + heavyweight T-score estimate**.

**Two models, two jobs:**
- **Lightweight (triage):** logistic regression on a *broad* female age range →
  P(osteoporosis). Answers "should we even look?"
- **Heavyweight (estimate):** the regression on eligible women → the estimated
  T-score. Answers "how are your bones?"

The **prior-fragility-fracture** question moves into the **main questionnaire** — it
sharpens the T-score (a heavyweight feature) but doesn't drive the triage.

### Why each is evidence-based

- **Q1 (female):** women carry ~2–3× the osteoporotic-fracture risk of men — about
  **1 in 3 women vs 1 in 5 men over 50** (International Osteoporosis Foundation) —
  because oestrogen is central to bone maintenance. The model is also trained on
  women only, so it's valid only for them.
- **Q2 (age):** osteoporosis risk **rises steeply with age** — the triage model
  learns this gradient from a broad age range, so a 23-year-old comes out ~0% and an
  older woman clearly higher. A *number* (not a cutoff) lets it grade risk smoothly.
- **Q3 (menopause):** oestrogen loss at menopause is the primary driver of
  accelerated bone loss; mean age of natural menopause ≈ **51**. Postmenopausal
  status sharply raises risk on top of age.
- **Q4 (already diagnosed):** screening tools are for the **undiagnosed**; a woman
  already diagnosed or treated follows her care pathway — and we capture her **real**
  T-score rather than estimate one. Standard screening-design practice.

*(The prior-fragility-fracture question — a core FRAX predictor that roughly doubles
fracture risk independent of BMD — is asked in the main questionnaire, where it
sharpens the T-score estimate.)*

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
| | Hormone therapy · smoking |
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
| Current smoker? | `currentSmoker` | risk factor |
| Weight-bearing activity | `weightBearingActivity` | 0–1, from the watch photo |
| Long-term steroids? | `glucocorticoids` | **top drug cause** of bone loss — steroids suppress bone formation (FRAX variable) |
| Rheumatoid arthritis? | `rheumatoidArthritis` | chronic inflammation lowers BMD independently of steroids (FRAX variable) |
| Alcohol ≥ 3 units/day? | `highAlcohol` | impairs bone formation and raises fall risk (FRAX threshold) |
| Vitamin D (25-OH-D) | `vitaminD` | enables calcium absorption + mineralisation; deficiency (common in postmenopausal / housebound women) → secondary hyperparathyroidism + bone loss, and is linked to falls. **Modifiable** (supplementation), objective/photo-extracted — but a *modest* independent BMD predictor: a lever more than a strong signal |
| Serum calcium | `calcium` | mainly flags **secondary causes** (e.g. hyperparathyroidism) — it's tightly regulated, so a weak *direct* BMD predictor (objective, photo-extracted) |

**Why these:** `glucocorticoids`, `rheumatoidArthritis`, `highAlcohol` are established
**FRAX variables** — adding them both improves accuracy and strengthens the "beats
FRAX" story. `vitaminD` / `calcium` are the objective labs from the blood-test photo
(NHANES has both — VID / BIOPRO files). Emre confirms each feature's weight when he
trains on NHANES; serum calcium in particular may be dropped as a direct predictor.

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

## Add-on (optional): fall-risk stratification

Fracture risk = **fragile bone × the chance of falling.** BoneBot estimates the bone
side (T-score); this add-on stratifies the **fall side** and combines them.

**Why it's worth it:**
- Most fragility fractures happen *from a fall* — weak bone alone rarely breaks.
- Fall risk is **highly modifiable** (balance/strength training, home safety,
  medication review, vision, vitamin D) → more lifestyle levers, more engagement,
  more referral opportunities (balance-focused PTs).
- **Fills a FRAX gap** — FRAX handles falls poorly, so this is a concrete "why not
  just use FRAX?" answer.

**Fall-risk factors** (evidence-based; a simple stratifier for the hackathon, *not*
a novel trained model): prior falls (strongest predictor), age, gait/balance
problems, muscle weakness / low activity, sedating & blood-pressure meds +
polypharmacy, vision, postural dizziness, fear of falling, low vitamin D.
Wearable tie-in: gait speed & step regularity from the accelerometer — still "data
she already has."

**Combined view** (stratify low/moderate/high — don't over-precise):

|  | Low fall risk | High fall risk |
|---|---|---|
| **Strong bone** | Low fracture risk | Moderate — focus falls prevention |
| **Fragile bone** | Moderate — bone + scan | **High — scan + falls prevention, urgently** |

Honesty: a screening stratifier from evidence-based factors, not a validated
probability. **Add-on, not core** — Josh's scope call; keep the T-score story clean.

---

## The consumer product (GP mode = future work)

**Decision: the hackathon build is consumer-only.** One audience, done well. The
clinician view is kept below as future work, not this weekend's build — and the
physician-on-the-team credibility still carries, through the clinical honesty of the
estimate and guidance, not a separate screen.

### 👤 Consumer (*the woman*) — warm, motivating, plain language

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

### 🩺 GP mode — FUTURE WORK (post-hackathon, not this build)

- Estimated T-score + range + band (normal / osteopenia / osteoporosis).
- Factors, **separating known clinical risk factors from anything only
  statistically associated**. Objective inputs (labs, activity) flagged as measured.
- A **suggested action to weigh**, e.g. *"estimate in osteoporosis range, interval
  crosses −2.5 → consider DXA referral / FRAX assessment"* — a suggestion, not an
  instruction.
- Provenance: trained on NHANES, error (MAE) + interval coverage, "not a diagnostic
  device."

> **Decision:** consumer-only for the hackathon. GP mode stays documented as a
> strong post-hackathon expansion; the physician credibility carries the pitch
> regardless of whether the GP UI ships.

---

## BoneBot — the technical shape (`/assistant`)

Built additively so the plain `/screen` form remains the safe fallback demo.

- **Input:** photos (blood + watch → `/api/vision`, *next build*), plus **speak or
  type** (browser Web Speech API — no dependency, no key) for follow-ups.
- **The number:** `scoreBone()` runs **client-side** — deterministic, the model.
- **Voice out:** `/api/tts` → **ElevenLabs** (REST, no SDK dep); falls back to the
  browser voice if `ELEVENLABS_API_KEY` is absent.
- **Consumer** is the demo path via `/api/assistant`. (A clinician system prompt
  exists in code as future-work scaffolding — not the demo.)
- **Graceful:** every route returns a plain 503 sentence without keys — no stack
  trace in front of a judge.
- 🔑 **Needs in Vercel:** `ANTHROPIC_API_KEY` (set) + `ELEVENLABS_API_KEY` (for voice).

### Stretch (optional, NOT the MVP): BoneBeats 🎵

ElevenLabs can generate music, so the consumer's lifestyle tips could become a short
upbeat encouragement song. Fun, shareable, sponsor-aligned — but a gimmick next to
the clinical moat, and it cuts against "simpler = punchier." Build only if
everything else is done and Josh green-lights it; consumer mode only, never clinician.

---

## The "not yet validated" banner (historical — resolved 2026-07-19)

`MODEL_IS_VALIDATED` is now `true` (real NHANES-trained coefficients, see
`model/model-parameters.ts`, `model/README.md`), so this banner no longer
shows. It remains in the code as a dead path for if the model is ever
unvalidated again: while `MODEL_IS_VALIDATED = false` in `bone-model.ts`, a
visible strip reads *"Illustrative — coefficients not yet trained on NHANES."*
**Never demo placeholder numbers without this banner.**

---

## What the 3 minutes shows

Josh opens **BoneBot** → uploads a **blood test + a watch screenshot** → BoneBot
reads the objective numbers, **asks two quick history questions**, confirms → then
**speaks** the result: *estimated T-score −2.1, range −2.8…−1.4, osteoporosis
plausible* → the *why* → **what to do next (see GP + lifestyle)** → closes on
"trained on NHANES, published openly." The `/screen` form is the fallback if voice
or photos wobble. **One assistant, one conversation.**
