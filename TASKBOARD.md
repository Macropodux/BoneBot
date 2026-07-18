# TASKBOARD — 24-Hour Execution Plan (BoneWise)

**One-page "who does what, when."** The authoritative clock is `RUNBOOK.md §3`;
the spec is `PROJECT.md`; the rules are `AGENTS.md`. This board maps the team's
tasks onto that clock. If this ever disagrees with RUNBOOK, RUNBOOK wins.

**Deadline: Sun 19 Jul 14:00 London — submit by 13:00.**

---

## The project in one line

An open, **hormone-aware osteoporosis screening benchmark** for postmenopausal
women: predict DXA-defined low bone density from a health profile + wearable
activity, **without using the scan as an input**, with calibrated confidence, a
no-call band, and a "confirm with a DXA scan" flag. Model predicts (NHANES-trained,
exported to `bone-model.ts`); **the LLM only explains**.

**🔴 Anti-leakage rule:** the DXA scan (BMD / T-score) is the *label only*. It must
never appear in the feature set. Whoever trains the model verifies this.

---

## Roles

| Member | Lane | Owns |
|---|---|---|
| **Josh** — physician, product | Demo + scope | 3-min demo script, system prompt / clinical framing in `api/screen/route.ts`, the "survives a physician" gate on every claim, video. **Decides scope cuts, alone.** |
| **Emre** (`eyavuz21`) — comp. neuroscientist | **The model** | NHANES data spike → train logistic regression → calibrate (Brier, reliability curve) → export coefficients into `bone-model.ts` → flip `MODEL_IS_VALIDATED`. Publish the benchmark. |
| **Paula** (`paulatin4mente`) — mol. neuroscientist | Validation + biology | Grouped/per-subject split, sanity-check feature directions, benchmark methodology doc. |
| **4th member** — AI background | App + polish | Design pass on `screen/page.tsx`, wearable-input UX, user-test the flow, promote `/screen` to home + delete scam/chat examples. |

Stay in your own files. Say out loud what you're editing (AGENTS.md).

---

## Timeline & per-person allocation (London time, from RUNBOOK §3)

| Time | Block | Josh | Emre | Paula | 4th |
|---|---|---|---|---|---|
| 17:15–18:00 | Pick challenge (Josh decides) | lead | — | — | — |
| 18:00–19:00 | **Write demo script — NO CODE** | lead | input | input | input |
| 19:00–19:30 | Rebrand + redeploy scaffold | — | — | — | lead |
| 19:30–02:00 | **Build core (~6.5h)** | system prompt + framing | **data spike → model v1** | split + feature checks | wire `/screen` to real model, delete examples |
| 02:00–07:00 | Sleep (staggered, one reachable) | | | | |
| 07:00–10:00 | Finish + fix | polish narration | calibrate + export coeffs, flip validated flag | benchmark doc | UI polish + honest-uncertainty display |
| **10:00** | 🧊 **FEATURE FREEZE** | | | | |
| 10:00–12:30 | Record + edit video | **lead** | metrics on camera | biology credibility beat | run app on camera |
| 12:30–13:00 | Submit | | repo/benchmark links | | live URL check (incognito + phone) |
| 13:00–14:00 | Buffer | | | | |

---

## Milestones (hard checkpoints)

- **◆ M1 (≈22:00 Sat):** NHANES analytic table assembled — features + low-BMD label
  keyed by respondent. Data spike confirms label + activity feature line up.
- **◆ M2 (≈02:00 Sun):** end-to-end works — real (even rough) model scores in the app,
  first calibration numbers, `MODEL_IS_VALIDATED` path exercised.
- **◆ M3 (10:00 Sun):** FEATURE FREEZE — only polish, video, rehearsal after this.

---

## Emre's data lane — the specifics

**Label:** low bone density from NHANES femur DXA (femoral-neck / total-femur BMD →
T-score ≤ −2.5). NHANES gives BMD, **not** T-scores — compute them vs the NHANES III
young-adult female reference. Cite Looker et al. 2010.

**Features (none is the scan):** age, years since menopause, hormone therapy, prior
fragility fracture, BMI, weight-bearing activity (from the wrist accelerometer),
smoking, parental hip fracture — the shape already in `bone-model.ts`.

**⚠️ First job of the data spike — confirm the cycle.** We want wrist-accelerometer +
femur-DXA in the *same* respondents. Wrist accelerometry ran 2011–2012 and 2013–2014;
femur DXA appears to run 2013–2014 (2011–2012 looks to lack it). **Confirm the overlap
cycle is 2013–2014 before merging** — merging files that don't share respondents is the
classic silent failure. (Hip accelerometer + DXA also co-occur in 2005–2006 as a
fallback if activity intensity matters more than a wrist device.)

**Output:** trained, calibrated logistic-regression coefficients exported into
`bone-model.ts`; then flip `MODEL_IS_VALIDATED = true`. Until then the UI shows the
"not yet validated" banner — never demo placeholder numbers as real.

**Reusable asset (Foundation Value):** publish model + benchmark (features → low BMD,
grouped split, calibration report) openly.

---

## Deliverables checklist → judging

| Deliverable | Owner | Criterion |
|---|---|---|
| Live `/screen` demo (no login), risk + confidence + no-call + "confirm with DXA" | 4th / Josh | Technical Excellence |
| NHANES-trained, calibrated model in `bone-model.ts`, validated flag on | Emre | Technical Excellence |
| Open benchmark: features → low BMD, grouped split, calibration report | Emre / Paula | Foundation Value |
| 3-min demo video | Josh | All three |
| README (3-sentence what-it-is) + open license | Josh / 4th | Foundation Value |
| Limitations / responsible-use ("flag, not diagnosis") | Josh | Women's Health Impact |

---

## Risk register

| Risk | Counter |
|---|---|
| Wrong NHANES cycle → files don't share respondents | Confirm 2013–2014 overlap in the data spike **before** modeling. |
| Accelerometry file huge / slow to summarise | Fall back to the self-reported activity questionnaire; wearable feature is the story, not a blocker. |
| Model accuracy modest | Acceptable — honest calibration + a no-call score higher than an inflated number. Never fake it; show the "not yet validated" banner until real. |
| Data leakage (scan in features) | Drop all BMD/DXA columns before training; Emre verifies. |
| 8h on the model, broken UI | Demo-script first; freeze 10:00; bias every call toward "does it demo". |
| Scope creep after 22:00 | Default answer is no. Josh cuts, alone. |
| Broken live demo on a judge's Wednesday click | Spend cap + graceful degradation + re-check the URL mid-week. |
| Submitting at 13:59 | Submit at 13:00. |
