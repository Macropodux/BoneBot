# BoneBot evidence library

This directory documents the small, local evidence library used by BoneBot.
It is deliberately not a database or retrieval-augmented generation system.
At request time, the server selects cards from `src/lib/bone-evidence.ts` that
match the deterministic model's contributing factors. The LLM receives only
those cards and the model output; it must not introduce new clinical claims.
The team wiki indexes this register at
[`wiki/sources/clinical-evidence-library.md`](../wiki/sources/clinical-evidence-library.md).

## T-score definition

A T-score expresses a person's measured bone mineral density (BMD) as the number
of standard deviations (SD) it lies above or below the mean BMD of a healthy
young-adult reference population of the same sex:

```
T-score = (measured BMD − young-adult reference mean BMD) / young-adult reference SD
```

Per WHO diagnostic criteria (as codified in current clinical guidance), at the hip
or spine: **T-score <= -2.5** defines osteoporosis, **-2.5 < T-score < -1.0**
defines osteopenia (low bone mass), and **T-score >= -1.0** is normal. A T-score is
distinct from a **Z-score**, which compares BMD to an age-matched (not
young-adult) reference and is used clinically to flag secondary causes of bone
loss, not to diagnose postmenopausal osteoporosis. BoneBot's `estimatedTScore` is
a model-estimated approximation of this same DXA-scale statistic — it is never a
substitute for a measured DXA T-score. Sources: `bhof-clinicians-guide-2022`,
`looker-tscore-reference-1998` (the NHANES III young-adult reference population
the T-score is computed against).

## Clinical boundaries

- BoneBot estimates a DXA-scale T-score; it does not measure bone density,
  diagnose osteoporosis, calculate fracture probability, or prescribe treatment.
- DXA results are interpreted with clinical fracture-risk factors, not in
  isolation. A prior fragility fracture, long-term glucocorticoids, and other
  high-risk contexts need clinician assessment rather than a reassurance from
  this screen.
- The primary prediction dataset is NHANES (cross-sectional). It cannot prove
  that changing a model feature will change an individual's future fracture risk.
- Lifestyle cards use cautious, general wording. They never supply medication,
  hormone-therapy, calcium, or vitamin-D dose advice.
- ALP is a clinician-context card only. It is not a current model feature and
  must not be weighted into a T-score or fracture-risk estimate without a
  separately validated modelling and clinical-review decision.
- Absolute lymphocyte count (ALC) and red blood cell (RBC) count are retained as
  contextual full-blood-count cards only. They are not current model features
  and must not be weighted into a T-score or fracture-risk estimate without a
  separately validated modelling and clinical-review decision.
- Thyroid disease, coeliac disease, and chronic kidney disease are contextual,
  chat-only cards answering "does this affect my bones?" style questions.
  None are collected in the questionnaire or weighted into a T-score or
  fracture-risk estimate today. Thyroid disease and chronic kidney disease
  feed a single pending `secondaryCondition` `BoneFeatures` input that stays
  inert until `SECONDARY_CONDITION_TRAINED` flips true and a validated
  coefficient lands. Coeliac disease is excluded from that feature by NHANES
  data availability (see "Secondary-cause cards" below), not policy, and is
  not on a path to becoming a model input under the current training cycle.

## Curation rules

1. Each card has one narrow, approved statement, explicit limits, and source
   identifiers.
2. Prefer a current clinical guideline, government health source, systematic
   review, randomised trial, or prospective cohort. Do not cite blogs,
   commercial health sites, or model-generated summaries.
3. Add a source and a card in the same pull/commit.
4. Review the library before a release and at least annually. Record substantial
   updates in this file's git history.

## Source register

| ID | Evidence role | Source |
| --- | --- | --- |
| `bhof-clinicians-guide-2022` | Current clinical guideline formally defining T-score/Z-score calculation and WHO diagnostic thresholds (normal / osteopenia / osteoporosis). | [LeBoff et al., 2022, "The clinician's guide to prevention and treatment of osteoporosis" (Osteoporos Int)](https://link.springer.com/article/10.1007/s00198-021-05900-y) |
| `dxa-role-review-2025` | Current review confirming DXA as the gold-standard method for osteoporosis risk stratification and diagnosis, and its role alongside FRAX/trabecular bone score in fracture-risk assessment. | [Shahane, Lim & Bolster, 2025, "Updates on the Role of DXA in the Evaluation and Monitoring of Osteoporosis" (Curr Rheumatol Rep, PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12578744/) |
| `nhs-dxa` | UK patient explanation of DXA, its limits, and clinical risk factors (including prior fracture, smoking, family history, low BMI and glucocorticoids). | [NHS: Bone density scan—when it is used](https://www.nhs.uk/tests-and-treatments/dexa-scan/why-its-done/) |
| `nogg-2024` | UK guideline for fracture-risk assessment, DXA, lifestyle and clinical management. | [NOGG 2024 guideline](https://www.nogg.org.uk/sites/nogg/download/NOGG-Guideline-2024.pdf) |
| `uspstf-2025` | Screening context: all women 65+ and postmenopausal women under 65 at increased risk; not a recommendation for people with known fragility fracture or secondary osteoporosis. | [USPSTF clinical summary](https://www.uspreventiveservicestaskforce.org/uspstf/document/ClinicalSummaryFinal/osteoporosis-screening) |
| `niams-osteoporosis` | NIH patient guidance on calcium, vitamin D, activity, smoking and alcohol. | [NIAMS osteoporosis guidance](https://www.niams.nih.gov/health-topics/osteoporosis/diagnosis-treatment-and-steps-to-take) |
| `swan-bmd-2012` | Multi-ethnic longitudinal menopause-transition cohort: BMD loss was greatest around the final menstrual period. | [Finkelstein et al., 2012 (PubMed)](https://pubmed.ncbi.nlm.nih.gov/21976317/) |
| `whi-ht-fracture-2003` | Randomised WHI evidence that hormone therapy affects BMD/fracture outcomes; supports context, never a treatment recommendation. | [Cauley et al., 2003 (PubMed)](https://pubmed.ncbi.nlm.nih.gov/14519707/) |
| `sof-fracture-2018` | Prospective Study of Osteoporotic Fractures analysis, supporting the importance of fracture history in later bone-risk assessment. | [Crandall et al., 2018 (PubMed)](https://pubmed.ncbi.nlm.nih.gov/29992510/) |
| `exercise-meta-2023` | Systematic review/meta-analysis of exercise training and BMD in postmenopausal women. | [Shojaa et al., 2023 (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10282053/) |
| `nhanes-dxa-2013-14` | Public DXA provenance for the training-data workflow; records measurement and variables. | [CDC NHANES DXA documentation](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2013/DataFiles/DXX_H.htm) |
| `nhanes-pam-2013-14` | Public wrist physical-activity-monitor provenance for the activity feature workflow. | [CDC NHANES PAM documentation](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2013/DataFiles/PAXHR_H.htm) |
| `uk-biobank-bone` | Government-funded cohort data reference for heel ultrasound bone measures; not interchangeable with clinical DXA. | [UK Biobank bone-densitometry category](https://biobank.ndph.ox.ac.uk/ukb/label.cgi?id=100018) |
| `nhs-alp` | NHS pathology context: total ALP can be elevated in bone and liver disease. | [Eastern Pathology Alliance: ALP](https://www.easternpathologyalliance.nhs.uk/tests/alkaline-phosphatase-alp/) |
| `alp-tariq-2019` | Cross-sectional postmenopausal cohort (n=168): higher ALP was associated with lower T-score only in the osteopenia subgroup; it explained about 7% of T-score variance and was not a predictor in the osteoporosis subgroup. | [Tariq et al., 2019 (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6572960/) |
| `cbc-li-2022` | Mixed-sex, single-centre patient/control study plus mouse models. It found no difference in RBC, haemoglobin, or haematocrit between clinical osteoporosis cases and controls, demonstrating that CBC associations are not consistent enough for screening. | [Li et al., 2022](https://www.frontiersin.org/articles/10.3389/fendo.2022.965290/full) |
| `cbc-ha-2025` | Evidence review of clinical and experimental CBC–bone literature; it concludes that clinical utility and integration into risk assessment need further validation. | [Ha et al., 2025 (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12765876/) |
| `mros-cbc-2017` | Prospective MrOS cohort of older men: faster hip BMD loss was associated with anaemia, high neutrophils, and low lymphocytes. It does not validate isolated RBC count in postmenopausal women. | [Valderrábano et al., 2017 (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5292053/) |
| `medlineplus-cbc` | Government health explanation of full blood count measures, including RBC and differential white-cell counts. | [MedlinePlus: Complete Blood Count](https://medlineplus.gov/lab-tests/complete-blood-count-cbc/) |
| `alc-bmd-2004` | Small cross-sectional postmenopausal study reporting an ALC/BMD association; hypothesis-generating only. | [Di Monaco et al., 2004 (PubMed)](https://pubmed.ncbi.nlm.nih.gov/14691689/) |
| `rbc-bmd-2011` | Cross-sectional study of peripheral blood-cell counts and BMD in healthy postmenopausal women; association, not prediction. | [Kim et al., 2011 (PubMed)](https://pubmed.ncbi.nlm.nih.gov/21786437/) |
| `osteolaus-blood-counts-2022` | Population-based postmenopausal cohort with two assessments; differential counts did not consistently predict BMD or microarchitecture. | [Biver et al., 2022 (PubMed)](https://pubmed.ncbi.nlm.nih.gov/36111204/) |
| `ra-frax-ipd-2025` | Individual-person meta-analysis of 29 prospective cohorts (~2M participants) commissioned to update FRAX: RA raised fracture risk (HR 1.49 any clinical fracture, HR 2.23 hip fracture) independent of glucocorticoid exposure and femoral-neck BMD. | [Kanis et al., 2025 (PubMed)](https://pubmed.ncbi.nlm.nih.gov/39955689/) |
| `ra-fracture-meta-2017` | Meta-analysis of 13 studies: pooled fracture risk ratio 2.25 [1.76–2.87] in RA vs non-RA, 1.99 [1.58–2.50] in the female subgroup. | [Xue et al., 2017 (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6393106/) |
| `thyroid-osteoporosis-review-2021` | Review of thyroid hormone disease mechanisms and effects on bone remodelling and fracture risk. | [Thyroid Hormone Diseases and Osteoporosis (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7230461/) |
| `hyperthyroidism-fracture-meta-2003` | Meta-analysis: endogenous hyperthyroidism is associated with increased osteoporosis and fracture risk via increased bone resorption. | [Vestergaard & Mosekilde, 2003 (Thyroid)](https://journals.sagepub.com/doi/abs/10.1089/105072503322238854) |
| `coeliac-osteoporosis-review-2007` | Review: bone mineral density is reduced in treated adult coeliac disease, including in postmenopausal patients. | [Osteoporosis in treated adult coeliac disease (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC1382674/) |
| `coeliac-osteoporosis-cohort-2018` | Prospective cohort of newly diagnosed adult coeliac patients: bone mineral density alterations in 60.3%, with osteoporosis in roughly half of affected patients. | [Risk factors associated with osteoporosis in a cohort of prospectively diagnosed adult coeliac patients (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6169042/) |
| `ckd-fracture-review-2025` | Review: fracture risk is markedly elevated in chronic kidney disease, particularly stages G3–G5D, and is an overlooked complication. | [Fracture Risk in Chronic Kidney Disease (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12298187/) |
| `ckd-osteoporosis-systematic-review-2020` | Systematic review: 18–32% of CKD patients also have osteoporosis, with fracture risk over 2.5x that of people without CKD. | [Osteoporosis in Patients with Chronic Kidney Diseases (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7555655/) |
| `glow-care-gaps-2022` | Global review: the large majority of postmenopausal women received no osteoporosis treatment in the period following a fragility fracture (GLOW and related cohorts). | [Osteoporosis in 2022: care gaps to screening and personalised medicine (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7614114/) |
| `eu-primary-care-gap-2020` | European primary-care cohort: about 75% of elderly women at high fracture risk received no osteoporosis treatment. | [Osteoporosis treatment gap in European primary care, Osteoporos Int 2020](https://link.springer.com/article/10.1007/s00198-020-05557-z) |
| `intl-fracture-care-gap` | Cross-national review describing the fragility-fracture treatment gap as a persistent international phenomenon. | [Fragility fractures and the osteoporosis care gap: an international phenomenon](https://www.sciencedirect.com/science/article/abs/pii/S0049017205002143) |
| `frax-sensitivity-2015` | Comparative review reporting FRAX sensitivity of only ~33% for DXA-defined osteoporosis in women aged 50–64 at a 10-year major-fracture threshold of 9.3%. | [Risk assessment tools for screening, Curr Osteoporos Rep 2015](https://link.springer.com/article/10.1007/s11914-015-0282-z) |
| `screening-tools-network-meta-2025` | Network meta-analysis comparing OST, ORAI, SCORE, OSIRIS and FRAX, grouping SCORE/ORAI/OST as higher-sensitivity and FRAX/OSIRIS as higher-specificity. | [Comparative accuracy of screening tools for osteoporosis, Int J Nurs Stud 2025](https://www.sciencedirect.com/science/article/abs/pii/S0020748925000380) |
| `ost-performance-review` | Performance review of the age + weight-only OST screening tool. | [OST performance review (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6068473/) |
| `screening-tools-meta-2015` | Systematic review and meta-analysis of clinical risk-assessment instruments, reporting pooled OST sensitivity ~89% / specificity ~41%. | [Systematic review & meta-analysis of clinical risk-assessment instruments, Osteoporos Int 2015](https://link.springer.com/article/10.1007/s00198-015-3025-1) |
| `nhanes-ml-karaismailoglu-2025` | NHANES machine-learning model for low bone density (12,108 adults ≥50); sex-stratified analysis shows age+BMI dominate in women, and menopause status and physical activity were excluded for missing data. | [Karaismailoglu & Karaismailoglu, Risk prediction of low bone density with ML, Balkan Med J 2025 (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12576511/) |
| `accelerometry-bmd-nhanes-2019` | NHANES 2005–2006 accelerometer study linking objectively measured activity to higher bone density and trabecular bone score in older adults. | [Accelerometry, BMD and trabecular bone score, NHANES 2005-2006, Arch Osteoporos 2019](https://link.springer.com/article/10.1007/s11657-019-0583-4) |
| `activity-spine-bmd-nhanes-2023` | NHANES 2007–2018 analysis: ≥38 MET-hours/week of activity was linked to lower osteoporosis risk in post-menopausal women. | [Physical activity and spine BMD in post-menopausal women, NHANES 2007-2018, J Orthop Surg Res 2023](https://link.springer.com/article/10.1186/s13018-023-03976-2) |
| `ukb-brief-activity-bone-2017` | UK Biobank study: even brief bouts of higher-intensity activity predicted bone health in pre- and post-menopausal women. | [Brief high-intensity activity and bone health, UK Biobank, Int J Epidemiol 2017](https://academic.oup.com/ije/article/46/6/1847/3902973) |
| `wearable-ownership-bias-2025` | Demographic/socioeconomic analysis of Fitbit ownership showing wearable data skews toward younger, more active, more affluent people. | [Demographic/socioeconomic factors in Fitbit ownership, IJERPH 2025](https://doi.org/10.3390/ijerph23070839) |
| `wearable-surveillance-representativeness-2019` | UK analysis of physical-activity surveillance via apps/wearables and how representative that data is of the general population. | [Physical activity surveillance via apps/wearables: representativeness in the UK, JMIR 2019 (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6371078/) |
| `wearable-social-determinant-2019` | Commentary on wearable-device access becoming a social determinant of health. | [Access to wearables as a social determinant of health, Healthcare IT News](https://www.healthcareitnews.com/news/access-wearables-could-become-social-determinant-health-researchers-warn) |
| `health-literacy-digital-divide-2016` | Review of health literacy and health-IT/digital-health adoption (the "digital divide"). | [Health literacy and health-IT adoption (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5069402/) |
| `fall-risk-ml-comparison-2025` | Machine-learning comparison of accelerometric versus non-accelerometric factors for predicting fall risk in older adults. | [Predicting fall risk in older adults: ML comparison, Digit Health 2025 (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11951886/) |
| `fall-risk-wearable-2021` | Wearable-sensor gait study reporting ~81.6% accuracy classifying future fallers in community-dwelling older adults. | [Prediction of fall risk using a wearable system (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8545936/) |
| `looker-tscore-reference-1998` | Source of the NHANES III young-adult proximal-femur BMD reference data used to derive T-scores. | Looker et al., "Updated data on proximal femur bone mineral levels of US adults", Osteoporos Int 1998. |
| `adherence-mayo-2011` | Review of osteoporosis treatment outcomes: real-world medication adherence ~60%, ~70% discontinue within a year, and physicians overestimate adherence (perceived 69% vs actual <49%). | [A New Look at Osteoporosis Outcomes, Mayo Clin Proc](https://www.mayoclinicproceedings.org/article/S0025-6196(11)61200-7/fulltext) |
| `adherence-economics-2011` | Review of the economic case for improving osteoporosis medication adherence. | [The Economics of Improving Medication Adherence in Osteoporosis (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3167669/) |
| `exercise-adherence-older-women-2010` | Community-based cohort of sedentary women 70+: only 17% reached recommended activity levels in a walking programme. | [Predictors of Long-term Exercise Adherence in Older Women (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2828261/) |
| `resistance-app-adherence-2023` | Cohort of mobile resistance-training app users: only 18.1% of beginners remained adherent at 6 months. | [Predictors of long-term resistance exercise adherence among beginners (SportRxiv)](https://sportrxiv.org/index.php/server/preprint/view/709) |
| `osteoporosis-cost-policy-2019` | US healthcare-cost projection: osteoporotic fracture costs rising from ~$57B (2018) to over $95B/year by 2040 as fracture counts rise from 1.9M to 3.2M/year. | [Healthcare Policy Changes in Osteoporosis Can Improve Outcomes and Reduce Costs, JBMR Plus (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6808223/) |
| `fracture-economic-burden-2020` | US postmenopausal cohort: a single fracture is linked to roughly $30,000 in all-cause healthcare costs in the following year. | [Long-term economic burden of osteoporotic fracture in US postmenopausal women, Osteoporos Int 2020](https://link.springer.com/article/10.1007/s00198-020-05769-3) |

## Source use and limits

SWAN, WHI and SOF establish scientifically valuable longitudinal context, but
they are not BoneBot's training dataset and do not validate its prediction.
NHANES is the intended training/benchmark data source; the exact cycles,
variables, sample exclusions, model coefficients, performance, and uncertainty
calibration must be published with the trained model before
`MODEL_IS_VALIDATED` can become `true`.

### ALP appraisal

Tariq et al. is a small, single-centre cross-sectional study. Its ALP association
was limited to the osteopenia subgroup, cannot establish causality, and does not
provide a decision threshold. Total ALP is non-specific, so a bone source cannot
be assumed from an isolated result. NOGG includes ALP in routine investigation of
osteoporosis/fragility fracture and flags persistent *low* ALP as a possible sign
of metabolic bone disease. BoneBot must therefore explain ALP only as a result
to discuss with the clinician, never as evidence of osteoporosis or a target for
lifestyle intervention.

### ALC and RBC interpretation

ALC is treated here as **absolute lymphocyte count**. It and RBC count are
full-blood-count measures, not bone-turnover markers and not DXA substitutes.
The literature includes small cross-sectional associations with BMD, but the
more informative population-based repeated-assessment cohort did not find that
differential blood counts consistently predict BMD or bone microarchitecture.
Accordingly, BoneBot may only explain what the measures are and direct an
abnormal result back to the clinician who ordered the test; it must not attach a
model weight or use either result to diagnose anaemia, immune disease,
osteoporosis, or fracture risk.

The requested four-paper review adds important guardrails: Li et al. includes
animal work and a mixed-sex clinical sample, and found no RBC, haemoglobin, or
haematocrit difference in its clinical comparison. Ha et al.'s 2025 review
describes plausible mechanisms but calls for further validation. The longitudinal
MrOS study links faster hip BMD loss with anaemia in older men, not an isolated
RBC-count threshold for postmenopausal women.

### Rheumatoid arthritis appraisal

Rheumatoid arthritis (RA) is a recognised, *independent* clinical risk factor
for fracture — not merely a proxy for the long-term glucocorticoid use that
often accompanies it, which is already a separate model feature. Kanis et al.,
2025 is an individual-person meta-analysis of 29 prospective cohorts
(~2 million participants) run to update FRAX: RA raised fracture risk (HR 1.49
for any clinical fracture, HR 2.23 for hip fracture) after adjusting for
glucocorticoid exposure and femoral-neck BMD. Xue et al., 2017 (13 pooled
studies) found a similar-sized association (RR 2.25 overall, RR 1.99 in the
female subgroup). This is why FRAX and NOGG retain RA as a standalone clinical
risk factor alongside, not instead of, glucocorticoid use. It supports the
*direction* of the model's existing `rheumatoidArthritis` coefficient in
`bone-model.ts`; the coefficient's magnitude remains a placeholder pending
NHANES training, per that file's own validation note.

### Secondary-cause cards: thyroid disease, coeliac disease, chronic kidney disease

NOGG (already registered as `nogg-2024`) and NICE list thyroid disease
(particularly hyperthyroidism and long-term thyroid-hormone treatment),
coeliac disease and other malabsorption, and chronic kidney disease among the
recognised secondary causes of osteoporosis, alongside age and menopause.
All three currently ship as **chat-only evidence cards** answering
condition-specific questions in BoneBot's "ask about your result" flow, and
none are `BoneFeatures` inputs or carry a model coefficient today.

Thyroid disease and chronic kidney disease are, however, on a defined (if
untrained) path into the model. `model/train_bonebot.ipynb` derives a single
pending `secondaryCondition` feature — see `bone-model.ts` and
`model-parameters.ts` — as thyroid disease (NHANES `MCQ160M`) **or** chronic
kidney disease (eGFR < 60, CKD-EPI 2021, from serum creatinine `LBXSCR`). It
stays inert (coefficient `0`, question not asked) behind the
`SECONDARY_CONDITION_TRAINED` flag until the model is retrained with a real
coefficient. **Coeliac disease is excluded from that feature, and cannot be
added to it under the current training data**: NHANES 2013-2014 — BoneBot's
training cycle — never ran coeliac serology; that panel only exists in the
2009-2010 cycle. Coeliac disease therefore has no source variable to derive a
model feature from and remains a chat-only card, not a "not yet validated"
input like the other two — closing that gap would need a retrain on a
different NHANES cycle, not just a coefficient.

- **Thyroid disease.** Vestergaard & Mosekilde's 2003 meta-analysis found
  endogenous hyperthyroidism raises osteoporosis and fracture risk through
  increased bone resorption; a 2021 mechanistic review situates
  thyroid-hormone disease (including post-thyroidectomy TSH-suppression
  therapy) as a recognised bone-remodelling risk. The card must not comment on
  medication dosing or TSH-suppression targets — those are prescribing
  decisions for the clinician managing the person's thyroid treatment.
- **Coeliac disease.** A 2018 prospective cohort found bone mineral density
  alterations in 60.3% of newly diagnosed adult coeliac patients (osteopenia
  or osteoporosis), and a review of treated adult coeliac disease found reduced
  BMD persists even after treatment, including in postmenopausal patients. The
  card must not diagnose coeliac disease or malabsorption, or give dietary or
  gluten-free treatment advice. Unlike the other two cards, this one has no
  route to becoming a `secondaryCondition` model input under the current
  NHANES training cycle (see above).
- **Chronic kidney disease.** A 2020 systematic review found 18–32% of CKD
  patients also have osteoporosis with over 2.5x the fracture risk of the
  general population, rising to roughly 4x in advanced disease; a 2025 review
  describes CKD-related fracture risk as an overlooked complication. The card
  must not diagnose CKD, estimate kidney function, or give kidney-related bone
  treatment advice.

All three follow the same clinical-boundary rule as ALP/ALC/RBC today: BoneBot
may explain the recognised association and redirect the person to the
clinician managing that condition, never diagnose it, estimate its severity,
or advise on its treatment. That rule holds regardless of the model-input
distinction above — even once `SECONDARY_CONDITION_TRAINED` is true and
thyroid/CKD feed `secondaryCondition`, the per-condition chat cards still may
not diagnose or give dosing/treatment advice.

### Motivation-context cards: why screening, activity monitoring, and adherence matter

`MOTIVATION.md` cites a further ~20 sources that establish *why* BoneBot exists
(the screening care gap, how existing tools compare, why an objective activity
signal was chosen, why NHANES over consumer wearables, and the adherence and
cost case for early identification) rather than *how* to weigh an individual
factor. These are added as chat-only evidence cards — like the secondary-cause
cards above, none are `BoneFeatures` model inputs or carry a model coefficient.
They exist so BoneBot can answer "why should I bother getting screened?", "how
is this different from other risk calculators?", "why does this app use a
wearable?", or "what about falls?" with an approved, sourced answer instead of
declining or improvising.

- **Care gap** (`care-gap`). Even after a fragility fracture, most women are
  never started on osteoporosis treatment (`glow-care-gaps-2022`,
  `eu-primary-care-gap-2020`, `intl-fracture-care-gap`). Context for why
  earlier screening matters; must not be used to claim an individual person
  has been under-treated.
- **Screening-tool comparison** (`screening-tool-comparison`). Existing
  clinical tools (OST, ORAI, SCORE, OSIRIS, FRAX) trade sensitivity against
  specificity and mostly reduce to age and weight; a recent NHANES ML model
  shows the same pattern (`frax-sensitivity-2015`,
  `screening-tools-network-meta-2025`, `ost-performance-review`,
  `screening-tools-meta-2015`, `nhanes-ml-karaismailoglu-2025`). BoneBot must
  not claim to outperform these tools clinically or use this card to suggest
  it replaces validated calculators.
- **Wearable activity evidence** (`wearable-activity-evidence`). Objectively
  measured activity (accelerometery) has been linked to bone density and
  fracture-relevant outcomes in older and post-menopausal women
  (`accelerometry-bmd-nhanes-2019`, `activity-spine-bmd-nhanes-2023`,
  `ukb-brief-activity-bone-2017`). Supports why BoneBot asks about activity;
  must not be used to promise that a change in activity will change a
  person's estimated score.
- **Wearable data bias** (`wearable-data-bias`). Consumer wearable/fitness-app
  data over-represents younger, more active, more affluent users, so BoneBot
  trains on NHANES's provisioned research-grade accelerometer data instead
  (`wearable-ownership-bias-2025`, `wearable-surveillance-representativeness-2019`,
  `wearable-social-determinant-2019`, `health-literacy-digital-divide-2016`).
  Explains a design choice; not a statement about any individual's own device
  or data.
- **Fall risk** (`fall-risk`). Gait and movement patterns measured by
  wearables have been used in research to help flag people at higher risk of
  a fall, which is what turns low bone density into a fracture
  (`fall-risk-ml-comparison-2025`, `fall-risk-wearable-2021`). BoneBot must
  state plainly that it does not assess fall risk or gait today, and direct
  any fall concerns to a clinician or falls-prevention service.
- **Treatment and exercise adherence** (`treatment-adherence`). Even once
  diagnosed and prescribed medication or exercise, real-world adherence is
  often poor (`adherence-mayo-2011`, `adherence-economics-2011`,
  `exercise-adherence-older-women-2010`, `resistance-app-adherence-2023`).
  General context only — never personalised adherence coaching or a
  treatment/exercise plan.
- **Economic burden** (`economic-burden`). Osteoporotic fractures carry a
  large, rising healthcare cost, and a single fracture is linked to roughly
  $30,000 in the following year's care (`osteoporosis-cost-policy-2019`,
  `fracture-economic-burden-2020`). Population-level context; no individual
  cost, insurance, or billing advice.
