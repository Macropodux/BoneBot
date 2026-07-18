# PROJECT — Hormone-aware bone-health screening for postmenopausal women

**Hack-Nation Challenge 05 — Women's Hormonal Health.** Working name: **BoneWise**
(rename freely — but if you rename the Vercel project, do it in the first hour;
it changes the URL judges click for a week).

> **Read this before spawning an agent.** It is the shared brain. `AGENTS.md` =
> the rules; this = the plan; `PLAYBOOK.md` = how to build fast; `RUNBOOK.md` =
> schedule & non-negotiables.

---

## One line

Turn a postmenopausal woman's health profile and her wearable activity into an
earlier, personalized prompt to get a bone-density scan — before the first
fracture — with honest, calibrated, explainable predictions.

## The problem (the demo hook)

1 in 2 postmenopausal women will suffer an osteoporotic fracture. Most are never
screened until they break a bone, because DXA scans are under-used and there is
no good way to know who is at risk early. The biology is clear: estrogen loss
after menopause accelerates bone loss, and weight-bearing activity protects it —
yet no tool combines a woman's hormonal history with the movement data her
wearable already collects.

## The one flow (build backward from this)

A postmenopausal woman enters her profile (age, years since menopause, hormone
therapy, prior fracture, BMI, a couple of risk factors) and her recent activity
(from a wearable). She gets back: a screening result — **elevated / uncertain /
lower** — with a calibrated confidence, the factors driving it, the one or two
things she can change (chiefly activity), and a clear "this is a flag, not a
diagnosis — a DXA scan confirms." Nothing else. No login.

## 3-minute demo script (the thing we build to)

- **0:00–0:20 — Problem.** "1 in 2 postmenopausal women will fracture. Most are
  never screened until they break a bone. Estrogen loss drives it; activity
  protects it — and we can flag who needs a scan from data women already have."
- **0:20–0:40 — Gap.** Current risk tools are static questionnaires; none use
  the movement data a wearable already collects.
- **0:40–1:40 — Demo.** Meet [persona], 58, six years postmenopausal, a prior
  wrist fracture, low activity. She enters it → **Elevated, 78% confidence.** Top
  factors: years since menopause, prior fracture, low weight-bearing activity.
  "This is a screening flag, not a diagnosis — a DXA scan confirms. The good
  news: weight-bearing activity is one of the few things you can change." Show
  the explanation, the modifiable-factor nudge, the disclaimer.
- **1:40–2:20 — Science.** "Trained and validated on NHANES bone-density (DXA)
  data — [N] postmenopausal women — with a held-out split and honest calibration.
  It returns *uncertain* rather than guessing. And we publish the model +
  benchmark openly." (Foundation value.)
- **2:20–3:00 — Impact.** "Data women already have → an earlier, personalized
  prompt to get screened, before the first fracture. A foundation others extend."
  Josh (physician) closes on credibility.

## Architecture — the honest design

**The model predicts. The LLM only explains.** The prediction is a calibrated
logistic-regression model trained on NHANES DXA data; scoring runs in TS from
exported coefficients (a dot product + sigmoid — no separate Python service).
The LLM receives the model's output and turns it into plain, warm, honest
language — it never sets the risk. This keeps every number traceable to
validated data, which is exactly what the challenge rewards and what a physician
can stand behind.

```
profile + activity → scoreBone() [deterministic, NHANES-trained] → {category, confidence, factors}
                                                                        ↓
                                              LLM explains the model's output (grounded, no invention)
                                                                        ↓
                                                        report card in the app
```

Files already drafted:
- `src/lib/bone-model.ts` — the model. **Coefficients are PLACEHOLDERS.** 🔴
- `src/lib/bone-schema.ts` — the LLM explanation shape.
- `src/app/api/screen/route.ts` — the loop (model → LLM → report).
- `src/app/screen/page.tsx` — functional form + result card (design later).

## Data plan

- **Primary: NHANES.** DXA bone-density (the ground-truth label), reproductive /
  hormonal history, labs, and wrist-accelerometer activity (2011–2014 cycles) —
  the "wearable" feature, with a clean measured label, all in one open dataset.
- **First 30 min = data spike.** Get NHANES DXA + reproductive + accelerometer
  into one dataframe keyed by respondent. Confirm the low-BMD label and the
  activity feature line up before modeling.
- **Reusable asset:** publish the trained model + a benchmark (features → low
  BMD, per-subject / grouped split, calibration report). Success criterion #3.

## Honesty rules (non-negotiable — the challenge kills unsupported claims)

- Screening flag, **never** a diagnosis. Every result carries "confirm with DXA
  and your clinician."
- Placeholder coefficients show a "not yet validated" banner until the real
  NHANES model lands. Do not demo placeholder numbers as validated.
- Report **uncertain** honestly — a confident wrong screen is the worst outcome.
- Separate known clinical risk factors from anything only statistically
  associated. No treatment advice.

## Roles / agent tasks (pick one, own its files)

- **Emre — the model.** Data spike → train logistic regression on NHANES DXA →
  calibration (Brier, reliability curve) → export coefficients into
  `bone-model.ts` → flip `MODEL_IS_VALIDATED`. This is the science; it's the moat.
- **Josh — clinical + demo.** Own the system prompt in `api/screen/route.ts`
  (the medical framing), the "does this survive a physician" gate on every claim,
  the demo script, and the video.
- **Paula — validation + biology.** Grouped/per-subject split, sanity-check
  feature directions, help write the benchmark methodology doc.
- **4th — app + polish.** Design pass on `screen/page.tsx`, wearable-data input
  (paste steps / upload a sample), user-testing the flow. Consider promoting
  `/screen` to the home page and deleting the old status board + scam/chat
  examples.

## Success-criteria map (how we're judged — Challenge 05)

1. **Women's health impact** — reach (postmenopausal women, under-screened) +
   quality of life (earlier screening, before fracture).
2. **Technical excellence** — validated model, honest calibration, a no-call.
3. **Foundation value** — publish the model + NHANES benchmark others reuse.

## What to delete once this is the product

`src/app/scam/` `src/app/api/scam/` `src/lib/scam-schema.ts` `src/app/chat/`
`src/app/api/chat/` — the throwaway examples. Keep `supabase.ts` and the plumbing.
