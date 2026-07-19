# Why This Matters: Research Backing & Project Rationale

*Motivation, evidence base, and design rationale for the Osteoporosis Screening Benchmark (HackNation Challenge 05).*

**Aim:** an accessible risk-assessment tool to help prevent osteoporotic bone
fractures in peri- and post-menopausal women — flagging who should be referred
for a DXA scan **before** a first fracture, using routinely available data plus an
objective wearable-activity signal, delivered through a friendly conversational
interface. Screening triage, **not** diagnosis.

---

## 1. The problem: women are diagnosed too late

Osteoporosis is a silent disease — it is subclinical until a fracture occurs, and
patients consistently underestimate their own fracture risk. Because there are no
symptoms, the first "diagnosis" for a large share of women is the fracture itself.
The downstream numbers are stark:

- **Roughly one in two women over 50** will suffer an osteoporotic fracture in her
  remaining lifetime.
- Even *after* a fragility fracture — the clearest possible warning sign — the GLOW
  study of 60,000+ older women across 10 countries found **more than 80% did not
  receive osteoporosis treatment**. In an international hip-fracture cohort, only
  ~27% were started on fracture-prevention medication afterward.
- Across European primary care, about **75% of elderly women at high fracture risk
  receive no osteoporosis treatment**, with under-diagnosis a key driver.

So the gap is not only *treatment* — it is *identification*. Women who never get
screened never enter the pathway. A tool that widens the top of the funnel (who
gets flagged for a DXA) targets the rate-limiting step.

---

## 2. Where current risk-assessment tools fail women

**What exists.** The USPSTF endorses a set of clinical triage tools to decide who
should get a DXA: OST, ORAI, SCORE, OSIRIS, and FRAX. They are useful but blunt.

**What they rely on.** Mostly a handful of static clinical inputs. The table below
breaks down each tool's inputs, its high-risk cut-off, its reported accuracy, and
why it is limiting.

| Tool | Inputs it uses | High-risk cut-off | Reported sensitivity / specificity* | Key limitation |
|---|---|---|---|---|
| **OST** (Osteoporosis Self-assessment Tool) | Age, weight only (score = 0.2 x [weight_kg - age]) | score < 2 | ~89% / ~41% (pooled, cut-off <1) | Reduces bone risk to two variables; ignores fracture history, menopause detail, activity, and everything behavioural. |
| **ORAI** (Osteoporosis Risk Assessment Instrument) | Age, weight, current estrogen use | score >= 9 | ~90-94% / ~30-41% | Adds only estrogen use to age+weight; high sensitivity but low specificity, so it sends many low-risk women for unnecessary DXA. |
| **SCORE** (Simple Calculated Osteoporosis Risk Estimation) | Age, weight, race/ethnicity, rheumatoid arthritis, prior non-traumatic fracture after 45, estrogen use | score >= 6 | ~90%+ / ~30-40% (AUC < 0.75) | More inputs, but all static and self-reported; includes a race-based term; still no behavioural, activity, or longitudinal signal. |
| **OSIRIS** (Osteoporosis Index of Risk) | Age, weight, current HRT use, prior low-impact fracture | score <= 1 | higher-specificity group: lower sensitivity, higher specificity than ORAI/SCORE | Same static risk-factor family; the fracture input only helps *after* a fracture has already happened. |
| **FRAX** (Fracture Risk Assessment Tool) | Age, sex, height, weight (BMI), prior fracture, current smoking, glucocorticoid use, rheumatoid arthritis, secondary osteoporosis, alcohol >= 3 units/day (optionally femoral-neck BMD) | 10-yr major-fracture probability >= 9.3% (varies by guideline) | ~33% / high (women 50-64) | Richest inputs, but still lacks a physical-activity or falls term and has poor sensitivity (~33% for T <= -2.5) in women 50-64. |

\* Approximate figures for detecting DXA-defined osteoporosis (T <= -2.5) in
post-menopausal women, drawn from systematic reviews and meta-analyses. Sensitivity
and specificity vary substantially with the chosen cut-off, skeletal site, and
population — the network meta-analysis groups SCORE/ORAI/OST as *higher-sensitivity*
and FRAX/OSIRIS as *higher-specificity*. Note the recurring pattern: the tools are
tuned to catch cases (high sensitivity) at the cost of many false positives (low
specificity, ~30-45%), i.e. lots of unnecessary DXA referrals — except FRAX, which
flips to high specificity but then misses roughly two-thirds of osteoporotic women
aged 50-64.

**Why they are limiting as a group.** They share four structural weaknesses:
they capture a single point in time rather than an ongoing signal; they lean on
static, self-reported clinical facts (and none use any *objective* measure of how
much a woman actually moves); the simpler ones (OST, ORAI, OSIRIS) effectively
collapse to age + weight, trading specificity away to keep sensitivity; and every
one of them depends on a clinician sitting down to administer it. That is exactly
the space our tool targets — an objective wearable-activity signal and a
self-serve conversational front-end.

**How accurate they are.** They trade sensitivity against specificity, and the
sensitivity can be poor in exactly the group we care about: a FRAX threshold of
>=9.3% had only ~**33% sensitivity** for detecting a T-score <= -2.5 in women aged
50-64. Two-thirds of osteoporotic women in that age band would be missed.

**How accessible they are.** The confirmatory test (DXA) needs specialised
equipment, a referral, and travel/cost that many women never reach — which is why
the clinical tools exist as a filter in the first place. But the filter is only as
good as its inputs, and it depends on a clinician remembering to run it.

**What the state of the art still misses.** The most recent NHANES machine-learning
model (Karaismailoglu & Karaismailoglu, *Balkan Med J* 2025) is instructive. It
trained on 12,108 adults >=50 — **6,292 men and 5,816 women** — to predict low bone
density. Three things stand out for us:

1. **The disease is concentrated in women, but women are the minority of the data.**
   Low bone density affected **58.7% of the women vs 31.5% of the men** in that
   cohort, yet women were only 48% of the training set. A pooled model spends much
   of its capacity separating men from women (sex was its single strongest
   predictor) rather than resolving risk *within* women.
2. **For women, it effectively collapses to age + BMI.** Their sex-stratified
   analysis shows that once you look only at women, the top predictors are age and
   BMI — i.e. essentially the OST tool again, plus some biochemistry.
3. **They discarded the two most relevant modalities.** Their own limitations state
   that **menopausal status and physical activity were excluded due to missing
   data.** For a women's bone-health model, estrogen/menopause status and objective
   activity are central — and they are exactly what we build on.

**Our positioning:** same open data source, but a women-specific model that recovers
the menopause and physical-activity signal the field drops, targets the
osteoporosis-defining threshold (T <= -2.5), and ships as a reusable open benchmark
(their data was "available on request", with no public splits or code).

---

## 3. Our tool: what makes it different

### 3a. Why a wearable-activity signal should help

Mechanical loading builds and preserves bone, so *how much and how intensely a woman
actually moves* is biologically tied to bone density — and it is information the
clinical tools ignore. The evidence supports including this modality in the
NHANES 2011–2014 wrist-accelerometry training data described in `PROJECT.md`:

- In older adults, objectively measured accelerometer activity has been associated
  with higher bone density and trabecular bone score; higher moderate-to-vigorous
  activity tracked with better femoral-neck and hip measures.
- In post-menopausal women (NHANES 2007-2018), performing **>=38 MET-hours/week** was
  linked to lower osteoporosis risk.
- In **UK Biobank**, even brief bouts of higher-intensity activity predicted bone
  health in pre- and post-menopausal women — suggesting intensity/impact features,
  not just step counts, carry signal.

The scientific question our benchmark answers is precisely: **does this objective
activity signal add predictive value over the age/weight/lab factors the existing
tools already use?** No prior open NHANES benchmark answers it, because they dropped
the modality.

### 3b. Why a friendly conversational interface helps

The clinical tools fail partly because they depend on a clinician sitting down to
compute them. A conversational front-end lets a woman self-serve:

- **Natural-language intake.** Instead of a clinical form, she can describe her
  routines and habits in her own words ("I walk the dog twice a day, I did HRT for
  a couple of years, my mum broke her hip") and the system maps that to model
  inputs. This lowers the literacy and effort barrier that formal questionnaires
  impose.
- **Nutritional context.** Calcium and vitamin D status are established contributors
  to bone health (and vitamin D/calcium are among the few things already widely
  prescribed for bone). A chat interface can capture dietary and supplement habits
  that a five-field risk calculator never asks about, and NHANES carries dietary and
  serum vitamin-D data to train on.
- **Comprehension.** The result is only useful if she understands it and acts on it.
  A conversational layer can explain the "why" and the next step ("this suggests
  asking your GP about a DXA scan") without medical jargon.

Guardrail: the interface must never drift into diagnosis or treatment advice. Its
job is to explain a screening result and route to a clinician and a DXA scan.

---

## 4. Datasets: what we use and how we stay honest

### 4a. What's available

- **NHANES 2011–2014 (primary).** DXA bone density, reproductive/hormonal history,
  laboratory measures, and objective wrist-accelerometer activity are combined by
  respondent (SEQN). This is the multimodal dataset used to train and validate the
  model; the wrist-accelerometer measure is the project's wearable feature.
- **mcPHASES (PhysioNet)** and consumer-wearable sets: useful as a *future* bridge
  to hormone/wearable modelling, but not training data here (young, premenopausal,
  no bone measures).

### 4b. How we leverage them

- **Splits.** Stratified on the osteoporosis label, grouped by participant (SEQN),
  fixed seed; ~70/15/15 train/validation/test. Validation is used only for
  probability calibration; the test set is touched once, for final numbers.
- **Label.** DXA-defined femoral-neck **T-score <= -2.5**, using the NHANES III
  young-adult reference (Looker et al.). The scan is the label only and is never a
  feature (enforced by an automated anti-leakage check).

### 4c. How we avoid bias (a design priority, not an afterthought)

Wearable-derived datasets primarily
represent **younger, more active, and more affluent** people, and fitness-tracker
ownership is confounded with race, socioeconomic status, and health literacy —
enough that some researchers warn wearable access is becoming a *social determinant
of health*. A model trained on volunteered consumer-app data would learn the habits
of the women **least** likely to be under-screened, and would generalise poorly to
the women who most need flagging.

Our mitigations:

1. **Use research-grade, provisioned-device data.** NHANES issued the same
   accelerometer to a probability sample of the US population, so activity data
   isn't conditioned on someone choosing to buy and wear a tracker. This structurally
   avoids the ownership-selection bias.
2. **Report subgroup performance.** We evaluate by race/ethnicity and age band, not
   just in aggregate, so any performance gap is visible rather than hidden.
3. **Be explicit about the reference population.** The T-score reference was derived
   on non-Hispanic white women; we document this and flag it as a fairness caveat
   rather than assuming it transfers.
4. **Honest n.** After the multimodal intersection the sample is smaller than the
   pooled-cycle studies; we report it plainly and use stratified CV rather than
   over-engineering.

### 4d. How we evaluate

Because the osteoporosis-positive class is a minority, accuracy alone is misleading,
so evaluation splits by what each model does:

- **Heavyweight T-score regression.** MAE and R² on a held-out split.
- **Ablation classifier (does our added signal beat the field's age+BMI baseline?).**
  ROC-AUC and PR-AUC for age+BMI alone, +menopause, +wearable activity, and the
  full feature set, benchmarked against an OST-style age+weight reference. This is
  the headline result: the field drops menopause status and objective wearable
  activity, and the ablation shows both add PR-AUC over the baseline the existing
  tools already use.
- **Lightweight triage routing model.** A locked-threshold protocol, not a single
  aggregate score: threshold candidates are compared on a validation split only,
  the highest candidate meeting a predeclared ≥95% sensitivity safety target is
  locked, and a one-time held-out audit then reports sensitivity, negative
  predictive value, false-negative count, Brier score, 10-bin calibration, and
  bootstrap 95% confidence intervals at that locked threshold. Full method and
  results in [`docs/TRIAGE_THRESHOLD_AUDIT.md`](docs/TRIAGE_THRESHOLD_AUDIT.md),
  computed by the tested helpers in `model/triage_audit.py` and run from
  `model/train_bonebot.ipynb`.

---

## 5. Architecture: separate the prediction from the message

Two distinct components, deliberately decoupled — as built and deployed:

1. **Risk models (quantitative).** Two linear models, both trained in
   `model/train_bonebot.ipynb` on NHANES 2013-2014 with scikit-learn and exported as
   plain coefficients into `model/model-parameters.ts`, which the app re-executes
   directly as a TypeScript dot product — no separate Python service and no model
   artifact loaded at runtime:
   - A **logistic-regression triage gate** (`src/lib/triage-model.ts`, age + BMI +
     menopausal status only) returns an estimated probability and a
     `proceedToFullAssessment` flag against the locked threshold from
     `docs/TRIAGE_THRESHOLD_AUDIT.md` (2%, chosen on validation only for >=95%
     sensitivity, then audited once on a held-out split).
   - A **Ridge regression** over the full feature set (`src/lib/bone-model.ts`)
     returns an estimated T-score, a 95% prediction interval, a three-band
     `elevated / uncertain / lower` category, and per-factor contributions computed
     as signed linear terms (`coefficient x value`) — not SHAP. `"uncertain"` is the
     de facto no-call state, replacing an earlier hard `T <= -2.5` cutoff that
     over-flagged.
   This is the part that is benchmarked and validated (§4d).
2. **Message-delivery layer (LLM).** A language model (`src/app/api/assistant/route.ts`,
   via the Vercel AI SDK) receives only the finished numeric output above — plus a
   fixed, clinician-approved evidence-card library it may cite from — and turns it
   into a clear, non-alarming explanation for the user — comprehensive and
   informative, assuming **no prior medical or biological knowledge**, and always
   ending in a concrete next step (e.g. "worth asking your GP about a DXA scan").
   Every claim it makes is checked server-side against the cited evidence before
   being shown. It also drives the natural-language intake in section 3b. The
   result-email step is deliberately *not* LLM-generated: it is a static,
   client-built template (the user's own model output plus a hardcoded general
   risk-factor list and resource links) sent verbatim through a thin proxy.

Keeping these separate matters: the LLM never invents the risk number, and the risk
number never reaches the user as a bare, frightening figure. The model is
auditable; the message is humane. The LLM must not add diagnoses or treatment
recommendations beyond the validated model's scope.

---

## 6. Marketability (future work — not for the hackathon build)

Not a challenge deliverable, but worth noting as a sustainability path.

### 6a. From one-off screen to continuous, wearable-linked score

The hackathon build is a single-timepoint screen. The natural product evolution is
a companion app that links to a woman's existing fitness tracker (Apple Health,
Fitbit, Garmin, Oura) so the same wrist-accelerometer signal that drives the NHANES
model (section 3a) keeps flowing in after the first assessment, rather than being
captured once and going stale. That turns a single risk flag into a **living score**
that updates as her activity actually changes — and gives the product a reason for
her to open it again, which a one-shot screening tool otherwise lacks.

### 6b. Compliance is the actual bottleneck — and the actual market

Identifying risk is only half the problem; the bigger, and more monetisable, gap is
that women who are told to change their habits mostly don't sustain it, and women
prescribed medication mostly don't stay on it:

- **Medication adherence.** In real-world practice, adherence to osteoporosis
  medication is only around **60%**, and this **drops further with treatment
  duration** — pooled good-adherence estimates fall from ~53% at 1-6 months to ~43%
  at 13-24 months. As many as **70% of patients discontinue within the first year**,
  and about half stop within one to two years.
- **The perception gap.** Physicians believe **~69%** of their patients are
  adherent; claims data shows the true figure is **under 49%**. Clinicians
  structurally cannot see non-adherence happening — which is exactly the gap a
  connected app, not a clinic visit, is positioned to close.
- **Exercise adherence is worse, and worst in exactly our target group.** General
  exercise-program dropout runs to roughly **50% within the first 3-6 months**.
  Among sedentary women aged 70+ in a walking program — our demographic — only
  **17%** reached the recommended 150 minutes/week. Even fitness-app users fare
  poorly: only **18.1% of beginner users of a mobile resistance-training app
  remained adherent at 6 months**, with a median drop-off at 14 weeks.
- **What actually keeps people compliant.** Supervised sessions get 70-90%
  attendance, versus ~50% unsupervised — the presence of accountability, not the
  exercise itself, is the lever. That is precisely what a habit-tracking,
  wearable-linked companion app can supply outside a clinical setting: reminders,
  visible streaks, and a running connection back to *her own* risk score moving up
  or down.

This reframes the product: the screening flag is the hook, but **habit-formation
and adherence support around a woman's own moving risk score is the retention and
revenue engine** — closer to a chronic-condition management app than a one-time
calculator.

### 6c. Why this is worth paying for: the cost side

Osteoporotic fractures cost the US healthcare system directly on the order of
**$57 billion/year in 2018**, projected to exceed **$95 billion/year by 2040** as
fracture counts rise from **1.9 million to 3.2 million/year** over the same period.
A single fracture drives roughly **$30,000** in all-cause healthcare costs in the
following year. Under-screening (section 1) and non-adherence (6b) are both
upstream, addressable causes of that spend — which is the commercial case for a
payer, employer-wellness plan, or insurer to subsidise a tool that measurably
improves either.

### 6d. Connector model and guardrails

The tool could also act as a **connector**, linking women flagged as higher-risk to
appropriate services — gyms, personal trainers, nutritionists, run clubs, and
health professionals — and earn referral or booking fees. Because weight-bearing
exercise and nutrition are front-line, non-pharmacological levers for bone health,
this is a plausibly *aligned* incentive, and pairs naturally with 6b: the connector
supplies the service, the habit-tracking layer supplies the accountability to
actually use it.

Ethical guardrails if this is ever pursued: referral incentives must never distort
the clinical message or push paid services over a needed medical referral;
recommendations should be transparent about any commercial relationship; and the
primary call-to-action for a higher-risk result must remain "see a clinician / get a
DXA", not "book this PT".

---

## 7. Extras: fall-risk stratification from gait

Osteoporosis raises the *consequence* of a fall (fragile bones fracture); frailty and
gait decline raise the *probability* of a fall. Combining the two would stratify not
just "who has weak bones" but "who is likely to have a **fracture-inducing fall**" —
the outcome we actually want to prevent. (~30% of adults over 65 fall each year.)

The wearable modality supports this directly. Accelerometer-derived gait features
(cadence, gait speed, stability/variability, sedentary-bout patterns) have been used
to predict falls, and:

- Wearable-sensor gait models have reported ~**80%+ accuracy** for classifying future
  fallers in community-dwelling older adults, and can **outperform traditional
  clinical fall assessments**.
- **Combining** accelerometric and clinical/non-accelerometric factors consistently
  beats either alone — the same multimodal thesis as our bone-density model.

A natural extension: a second model that scores fall risk from gait, then combines it
with the bone-density risk to prioritise the women most likely to fracture. Future
work, not a core hackathon deliverable.

**Note:** consumer platforms already expose default gait/fall-risk metrics we don't
currently have data for — Apple Health (Walking Steadiness, Walking Asymmetry,
Double Support Time, step length/speed), Garmin (cadence, stride length), Fitbit/
Google (gait speed, step length, stance/swing time, double support time), and Oura
(inactive time, activity volume, HRV/sleep recovery as frailty precursors). None are
in our current dataset; flagged here as candidate inputs for a future gait/fall-risk
model, complementary to bone-density risk.

---

## 8. Responsible use

This is a research benchmark and a screening-triage demonstrator — **not a medical
device and not a diagnosis**. Every prediction routes back to a clinician and a DXA
scan. Limitations (cross-sectional single-cycle data, self-reported fields, small n
after the multimodal intersection, reference-population assumptions, and the wearable
selection issues discussed above) are reported honestly rather than hidden.

---

## References

1. Osteoporosis in 2022: care gaps to screening and personalised medicine (GLOW; >80% untreated after fracture) — PMC7614114. https://pmc.ncbi.nlm.nih.gov/articles/PMC7614114/
2. The clinician's guide to prevention and treatment of osteoporosis (silent until fracture; at-risk not screened) — Osteoporos Int 2022. https://link.springer.com/article/10.1007/s00198-021-05900-y
3. Osteoporosis treatment gap in European primary care (~75% of at-risk women untreated) — Osteoporos Int 2020. https://link.springer.com/article/10.1007/s00198-020-05557-z
4. Fragility fractures and the osteoporosis care gap: an international phenomenon — ScienceDirect. https://www.sciencedirect.com/science/article/abs/pii/S0049017205002143
5. USPSTF, Osteoporosis to prevent fractures: screening. https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/osteoporosis-screening
6. Risk assessment tools for screening (FRAX ~33% sensitivity; tool comparison) — Curr Osteoporos Rep 2015. https://link.springer.com/article/10.1007/s11914-015-0282-z
7. Comparative accuracy of screening tools (network meta-analysis) — Int J Nurs Stud 2025. https://www.sciencedirect.com/science/article/abs/pii/S0020748925000380
8. OST performance review (age + weight tool) — PMC6068473. https://pmc.ncbi.nlm.nih.gov/articles/PMC6068473/
8b. Systematic review & meta-analysis of clinical risk-assessment instruments (pooled OST sensitivity 89% / specificity 41%) — Osteoporos Int 2015. https://link.springer.com/article/10.1007/s00198-015-3025-1
9. Karaismailoglu & Karaismailoglu, Risk prediction of low bone density with ML (NHANES; 6,292 M / 5,816 F; dropped menopause + physical activity) — Balkan Med J 2025. https://pmc.ncbi.nlm.nih.gov/articles/PMC12576511/
10. Accelerometry, BMD and trabecular bone score, NHANES 2005-2006 — Arch Osteoporos 2019. https://link.springer.com/article/10.1007/s11657-019-0583-4
11. Physical activity and spine BMD in post-menopausal women, NHANES 2007-2018 (>=38 MET-h/wk) — J Orthop Surg Res 2023. https://link.springer.com/article/10.1186/s13018-023-03976-2
12. Brief high-intensity activity and bone health, UK Biobank — Int J Epidemiol 2017. https://academic.oup.com/ije/article/46/6/1847/3902973
13. Demographic/socioeconomic factors in Fitbit ownership (wearable data skews younger/active/affluent) — IJERPH 2025. https://doi.org/10.3390/ijerph23070839
14. Physical activity surveillance via apps/wearables: representativeness in the UK — JMIR 2019. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6371078/
15. Access to wearables as a social determinant of health — Healthcare IT News. https://www.healthcareitnews.com/news/access-wearables-could-become-social-determinant-health-researchers-warn
16. Health literacy and health-IT adoption (digital divide) — PMC5069402. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5069402/
17. Predicting fall risk in older adults: ML comparison of accelerometric vs non-accelerometric factors — Digit Health 2025. https://pmc.ncbi.nlm.nih.gov/articles/PMC11951886/
18. Prediction of fall risk in community-dwelling older adults using a wearable system (~81.6% accuracy) — PMC8545936. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8545936/
19. Looker et al., Updated proximal femur BMD reference data (T-score reference) — Osteoporos Int 1998.
20. A New Look at Osteoporosis Outcomes: The Influence of Treatment, Compliance, Persistence, and Adherence (~60% real-world adherence; 70% discontinue within 1 year; physician-perceived 69% vs actual <49% adherent) — Mayo Clin Proc. https://www.mayoclinicproceedings.org/article/S0025-6196(11)61200-7/fulltext
21. The Economics of Improving Medication Adherence in Osteoporosis — PMC3167669. https://pmc.ncbi.nlm.nih.gov/articles/PMC3167669/
22. Predictors of Long-term Exercise Adherence in a Community-Based Sample of Older Women (sedentary women 70+; only 17% reached recommended activity) — PMC2828261. https://pmc.ncbi.nlm.nih.gov/articles/PMC2828261/
23. Predictors of long-term resistance exercise adherence among beginners: evidence from a large cohort of mobile app users (18.1% adherent at 6 months) — SportRxiv. https://sportrxiv.org/index.php/server/preprint/view/709
24. Healthcare Policy Changes in Osteoporosis Can Improve Outcomes and Reduce Costs in the United States ($57B in 2018 rising to >$95B by 2040; 1.9M to 3.2M fractures/year) — JBMR Plus / PMC6808223. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6808223/
25. Long-term direct and indirect economic burden associated with osteoporotic fracture in US postmenopausal women (~$30,000 in all-cause costs in year following fracture) — Osteoporos Int 2020. https://link.springer.com/article/10.1007/s00198-020-05769-3
