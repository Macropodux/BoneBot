# PROJECT — Hormone-aware bone-health screening for postmenopausal women

**Hack-Nation Challenge 05 — Women's Hormonal Health.** Product name: **BoneBot**.

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

A postmenopausal woman talks to **BoneBot**. She gives it as much objective data
as possible via **photos** — a blood test (→ vitamin D, calcium) and a watch
screenshot (→ steps, active-minutes) — and BoneBot **asks follow-up questions** for
the history no screen shows (years since menopause, prior fracture, hormone
therapy, smoking, family history). She gets back: an **estimated T-score with an
uncertainty range** (on the clinical scale a DXA uses), the band it falls in, the
factors driving it, the one or two things she can change (chiefly activity), and a clear
"this is an estimate, not a diagnosis — a DXA scan gives the real T-score."

**Consumer-focused:** the build targets the **woman herself** — warm guidance
(lifestyle, and a GP visit when warranted). A clinician view is future work, not
this build. See `SCREEN.md`.

## 3-minute demo script (the thing we build to)

- **0:00–0:20 — Problem.** "1 in 2 postmenopausal women will fracture. Most are
  never screened until they break a bone. Estrogen loss drives it; activity
  protects it — and we can flag who needs a scan from data women already have."
- **0:20–0:40 — Gap.** Current risk tools are static questionnaires; none use
  the movement data a wearable already collects.
- **0:40–1:40 — Demo.** Meet [persona], 58, six years postmenopausal, a prior
  wrist fracture, low activity. She enters it → **estimated T-score −2.1, likely
  −2.8 to −1.4 — the osteoporosis range is plausible.** Top factors: years since
  menopause, prior fracture, low weight-bearing activity.
  "This is an estimate, not a diagnosis — a DXA scan confirms. The good
  news: weight-bearing activity is one of the few things you can change." Show
  the explanation, the modifiable-factor nudge, the disclaimer.
- **1:40–2:20 — Science.** "Trained and validated on NHANES bone-density (DXA)
  data — [N] postmenopausal women — with a held-out split; we report error (MAE)
  and how often the true score falls inside our range. It says *uncertain* rather
  than faking precision. And we publish the model + benchmark openly." (Foundation value.)
- **2:20–3:00 — Impact.** "Data women already have → an earlier, personalized
  prompt to get screened, before the first fracture. A foundation others extend."
  Josh (physician) closes on credibility.

## Architecture — the honest design

**The model predicts. The LLM only explains.** The prediction is a **regression**
trained on NHANES DXA data that outputs an **estimated T-score + uncertainty
range**; scoring runs in TS from exported coefficients (a linear dot product — no
separate Python service). The LLM receives the model's output and turns it into
plain, warm, honest language — it never sets the number. This keeps every number traceable to
validated data, which is exactly what the challenge rewards and what a physician
can stand behind.

```
profile + activity → scoreBone() [deterministic, NHANES-trained] → {estimatedTScore, range, category, factors}
                                                                        ↓
                                              LLM explains the model's output (grounded, no invention)
                                                                        ↓
                                                        report card in the app
```

Files already drafted:
- `src/lib/bone-model.ts` — the model. Coefficients are trained and validated
  (`MODEL_IS_VALIDATED = true`); exported from `model/model-parameters.ts`. See
  `model/README.md` for performance.
- `src/lib/bone-schema.ts` — the LLM explanation shape.
- `src/app/api/screen/route.ts` — the loop (model → LLM → report).
- `src/app/screen/page.tsx` — functional form + result card (design later).

## Data plan

- **Primary: NHANES.** DXA bone-density (the ground-truth label), reproductive /
  hormonal history, labs, and wrist-accelerometer activity (2011–2014 cycles) —
  the "wearable" feature, with a clean measured label, all in one open dataset.
- **First 30 min = data spike.** Get NHANES DXA + reproductive + accelerometer
  into one dataframe keyed by respondent. Confirm the T-score label and the
  activity feature line up before modeling.
- **Reusable asset:** publish the trained model + a benchmark (features →
  estimated T-score, per-subject / grouped split, error + interval-coverage
  report). Success criterion #3.

## Honesty rules (non-negotiable — the challenge kills unsupported claims)

- Screening flag, **never** a diagnosis. Every result carries "confirm with DXA
  and your clinician."
- If coefficients are ever unvalidated, the UI must show the "not yet
  validated" banner — see `MODEL_IS_VALIDATED` in `bone-model.ts`. Do not demo
  placeholder numbers as validated.
- Report **uncertain** honestly — a confident wrong screen is the worst outcome.
- Separate known clinical risk factors from anything only statistically
  associated. No treatment advice.

## Roles / agent tasks (pick one, own its files)

- **Emre — the model.** Data spike → train a regression on NHANES DXA to predict
  the T-score → report error (MAE) + interval coverage → export coefficients into
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
