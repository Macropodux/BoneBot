# SCREEN — the one page we ship (exact input & output)

**This is the whole product surface.** One page at `/screen`, no login, no
navigation. A profile form goes in; a screening report card comes out. Everything
else (other routes, Supabase, the scam/chat examples) stays hidden or deleted.

- The narration is the demo script in `PROJECT.md` / `RUNBOOK.md §2`.
- The numbers come from `src/lib/bone-model.ts` (the model predicts).
- The prose comes from the LLM in `src/app/api/screen/route.ts` (it only explains).
- This file = what it looks like. Build to this; nothing more.

---

## INPUT — the profile form (top of the page)

Eight fields, mapped 1:1 to `BoneFeatures` in `bone-model.ts`. Grouped so it reads
like a health check, not a spreadsheet.

```text
┌─────────────────────────────────────────────┐
│  BoneWise — bone-health screening            │
│  Data you already have → know if you need a  │
│  scan, before the first fracture.            │
├─────────────────────────────────────────────┤
│  ABOUT YOU                                   │
│   Age                        [ 58 ]          │
│   Years since menopause      [ 6  ]          │
│   BMI                        [ 24 ]          │
│                                              │
│  YOUR HISTORY                                │
│   On hormone therapy?        ( )Yes (•)No    │
│   Prior fragility fracture?  (•)Yes ( )No    │
│   Parent broke a hip?        ( )Yes (•)No    │
│   Current smoker?            ( )Yes (•)No    │
│                                              │
│  YOUR ACTIVITY  ← the wearable hero          │
│   Weight-bearing activity                    │
│   Low ●──────────○ High   [import from watch]│
│                                              │
│         [  See my bone-health screen  ]      │
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
| Weight-bearing activity | `weightBearingActivity` | 0–1, **the wearable feature**; an "import from watch" button pre-fills the slider |

---

## OUTPUT — the report card (renders below, on submit)

Built from `ModelOutput` (category, confidence, contributions) + the LLM's
plain-English layer. The numbers are the model's; the sentences are the LLM's.

```text
┌─────────────────────────────────────────────┐
│   ⚠  ELEVATED          confidence 78%        │  ← category badge (colour by result)
│                                              │
│   "Your screening result is elevated. The    │  ← LLM, warm + grounded,
│    main drivers are your six years since      │    reads the factor list —
│    menopause, a prior fracture, and lower     │    never invents a number
│    weight-bearing activity."                  │
├─────────────────────────────────────────────┤
│   WHY  (what moved your result)              │  ← from contributions[]
│    ↑ Years since menopause                   │
│    ↑ Prior fragility fracture                │
│    ↑ Low weight-bearing activity             │
│    ↓ Healthy BMI                             │
├─────────────────────────────────────────────┤
│   YOUR DIGITAL TWIN — what you can change    │  ← the counterfactual levers
│    If activity → High:  Elevated → UNCERTAIN │
│    Risk 78% ▁▂▃▅ → 55% ▁▂▃                    │  ← inline SVG, NO chart dep
│    "Activity is one of the few things you    │
│     can change — and it moves your screen."   │
├─────────────────────────────────────────────┤
│   ⓘ This is a screening flag, not a          │  ← always present, disclaimer
│     diagnosis. A DXA scan confirms.          │
└─────────────────────────────────────────────┘
```

---

## Three result states (design all three)

Category comes from the model's no-call band (`bone-model.ts`):

| Category | When | Colour | Meaning |
|---|---|---|---|
| **ELEVATED** | prob ≥ 0.60 | amber / red | flag — worth a scan |
| **UNCERTAIN** | 0.35–0.60 | grey | **honest no-call — a feature, not a bug** |
| **LOWER** | prob ≤ 0.35 | green | reassuring, still not a guarantee |

**"Uncertain" is deliberate.** A confident wrong screen is the worst outcome; the
model returns *uncertain* rather than guessing, and the card shows it proudly.

---

## The "not yet validated" banner (temporary state)

While `MODEL_IS_VALIDATED = false` in `bone-model.ts`, a visible strip across the
card reads: *"Illustrative — coefficients not yet trained on NHANES."* It disappears
the moment Emre exports the real coefficients. **Never demo placeholder numbers
without this banner.**

---

## What the 3 minutes shows

Josh types the persona's numbers → one click → the card animates in at **Elevated,
78%** → he points at the *why* → the *digital twin* lever moves her Elevated →
Uncertain as activity goes up → closes on the disclaimer + "trained on NHANES,
published openly." **One screen, one interaction, no navigation.**
