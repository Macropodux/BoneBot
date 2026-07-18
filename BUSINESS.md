# BUSINESS — BoneBot go-to-market (for the pitch)

Not a hackathon build doc — this is the venture thesis, for the Venture Lab / EWOR
pitch. Bias every claim toward "a clinician and an investor would both believe it."

## Thesis (one line)

Osteoporosis is massively under-screened; hip fractures cost the NHS ~£1bn+/year.
BoneBot estimates bone density from data a woman already has (labs + wearable),
triages **who needs a DXA scan**, and drives earlier case-finding — sold **B2B**.

## The value proposition (quantifiable — lead with this)

- **Cost avoidance:** every prevented hip fracture saves a health system tens of
  thousands; earlier screening → earlier treatment → fewer fractures.
- **Capacity optimisation:** DXA scanners are scarce — BoneBot triages *who* to
  scan, cutting low-yield scans and prioritising high-risk women.
- **Engagement:** the consumer mode motivates behaviour change (activity, D/calcium)
  — the piece FRAX and static risk tools lack.

## Who pays — buyers ranked by speed to "yes"

| # | Segment | The person to reach | Why | Speed |
|---|---|---|---|---|
| 1 | **Femtech / menopause platforms** (Peppy, Maven, Health & Her, Stella, Elvie) | **CMO / Head of Clinical** + **Head of Partnerships/Product** | Want clinical depth; light regulatory bar as a screening feature; instant distribution | **Fast** — the beachhead |
| 2 | **Pharma** (Amgen, UCB, Lilly) | **Medical Affairs / Market Access directors** | Underdiagnosis underuses their drugs → they fund case-finding | Fast money, position carefully (clinician-led) |
| 3 | **NHS** (health systems / primary care) | **ICB commissioner** *and* **PCN Clinical Director** + a **fracture-liaison / rheumatology clinical champion** | Fracture cost avoidance + DXA capacity | Slow (12–24mo), biggest prize |
| 4 | **Employers / benefits** | **Head of Benefits / CPO**, Occupational Health | Menopause-at-work benefits booming | Usually reached *via* the femtech channel |
| 5 | **Payers (US)** | **VP Population Health**, Medicare Advantage / VBC orgs | Value-based care fracture savings | Later |

> **The rule across all of them:** you need a **clinical champion (who wants it)**
> *and* an **economic buyer (who pays it)**. Pitching only one stalls.

## Business model

- **API / usage licensing** to femtech platforms & wearables (start here).
- **Per-practice SaaS or per-screen** pricing to health systems (later).
- **Outcomes / value-based** contracts (share of fracture-cost savings) — sticky,
  but only once validated.
- **Pharma-sponsored case-finding** — fast revenue, reputational care required.

## Differentiation — "why not just use FRAX?"

FRAX (Sheffield) is the free, standard fracture-risk tool. BoneBot must clearly beat
it: FRAX uses **no objective wearable/lab data** and has **zero engagement layer**.
BoneBot uses the numbers already on her watch/phone, finds cases earlier, and
motivates behaviour change. Real differentiation — but it must be *proven* to move
outcomes, not just asserted.

## The moat is NOT the algorithm

The NHANES model + benchmark are **open** (the challenge requires it). Defensibility
comes from: **prospective validation in the target population**, **regulatory
clearance**, **clinical partnerships / distribution**, and the **multimodal
ingestion** (photos of labs + wearable screenshots). A competitor can copy the repo;
they can't copy the validation and the channel.

## Regulatory path (say this out loud — investors will ask)

An estimated T-score that guides "get a scan / don't" is likely **Software as a
Medical Device**: MHRA/CE (UK/EU), FDA Class II 510(k) (US). Clinician-in-the-loop
**decision support** (the GP mode) gets softer treatment than a consumer diagnostic
— which is *why the GP mode matters*. The hackathon ships as a research prototype
("not a diagnostic device"); the business needs a credible SaMD roadmap. Owning this
answer is the team's edge — a licensed physician who understands the path.

## Recommended sequence

1. **Wedge:** API into a femtech/menopause platform as a screening + engagement
   feature (fastest revenue, lightest regulation).
2. **Validate:** prospective study in the target population; publish.
3. **Graduate:** clinician decision-support product for NHS / payers, once cleared.

## Key risks

- Regulatory cost & timeline (SaMD).
- Liability from a false "lower risk" → missed osteoporosis.
- Slow public-sector procurement → fund early growth via femtech/pharma.
- Proving outcome benefit vs FRAX.
