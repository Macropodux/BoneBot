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
substitute for a measured DXA T-score. Source: `bhof-clinicians-guide-2022`.

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

## Curation rules

1. Each card has one narrow, approved statement, explicit limits, and source
   identifiers.
2. Prefer a current clinical guideline, government health source, systematic
   review, randomised trial, or prospective cohort. Do not cite blogs,
   commercial health sites, or model-generated summaries.
3. Add a source and a card in the same pull/commit. Josh (clinical lead) must
   approve any new user-facing medical wording before deployment.
4. Review the library before a release and at least annually. Record substantial
   updates in this file's git history.

## Source register

| ID | Evidence role | Source |
| --- | --- | --- |
| `bhof-clinicians-guide-2022` | Current clinical guideline formally defining T-score/Z-score calculation and WHO diagnostic thresholds (normal / osteopenia / osteoporosis). | [LeBoff et al., 2022, "The clinician's guide to prevention and treatment of osteoporosis" (Osteoporos Int)](https://link.springer.com/article/10.1007/s00198-021-05900-y) |
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
