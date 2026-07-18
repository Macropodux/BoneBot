---
type: source
title: "BoneWise Clinical Evidence Library"
authors: "BoneWise team"
url: ""
raw: "docs/EVIDENCE.md"
ingested: 2026-07-18
tags: [bonewise, evidence, spec]
created: 2026-07-18
updated: 2026-07-18
---

# BoneWise Clinical Evidence Library

The local evidence library is the bounded clinical context supplied to BoneBot's
LLM explanation layer. It pairs a compact runtime catalogue in
`src/lib/bone-evidence.ts` with a human-reviewable source register in
`docs/EVIDENCE.md`; it is deliberately not live web retrieval or a RAG system.

## Role in the product

BoneWise's deterministic model produces the estimated T-score and contributing
factors. The server selects only the relevant evidence cards and provides them to
the LLM, which must not introduce a clinical claim beyond the cards' approved
wording and limits. A generated explanation with an unknown evidence-card ID is
discarded.

The catalogue combines current UK and US guidance (including NHS, NOGG, NIH and
USPSTF), peer-reviewed studies, and public research-data documentation (NHANES
and UK Biobank). Longitudinal menopause and fracture context is represented by
SWAN, WHI and SOF. It does not validate the model: that depends on the planned
NHANES training, held-out evaluation and uncertainty calibration.

## Blood-test evidence boundaries

The current product specification extracts vitamin D and calcium from a blood-test
photo. ALP and red-blood-cell count are recorded as evidence-only, clinician
context cards: neither is a current `BoneFeatures` input, coefficient, category
rule, or lifestyle target.

- Total ALP is non-specific and may have bone, liver, or other causes. NOGG uses
  it as part of clinician-led investigation for osteoporosis or fragility fracture;
  it is not a direct osteoporosis or T-score test.
- A full blood count can be clinically relevant, but research on RBC and other
  blood-cell measures has mixed results. It cannot be used to infer a T-score,
  fracture probability, anaemia, or osteoporosis status in BoneWise.

## Where this fits

- [[project-md-spec]] — establishes the model-predicts/LLM-explains boundary.
- [[screen-md-spec]] — defines the current consumer blood-test inputs and output
  constraints.
