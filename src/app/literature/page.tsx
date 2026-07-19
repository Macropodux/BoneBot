import type { Metadata } from "next";
import Link from "next/link";
import { THEME, HEADING_FONT, BODY_FONT } from "@/lib/editorial-theme";

// Every row here mirrors the "Source register" table in docs/EVIDENCE.md —
// same order, same wording. Add a row here only when a row is added there.

type LiteratureEntry = {
  role: string;
  label: string;
  url: string | null;
};

const LITERATURE: LiteratureEntry[] = [
  {
    role: "Current clinical guideline formally defining T-score/Z-score calculation and WHO diagnostic thresholds (normal / osteopenia / osteoporosis).",
    label: "LeBoff et al., 2022, \"The clinician's guide to prevention and treatment of osteoporosis\" (Osteoporos Int)",
    url: "https://link.springer.com/article/10.1007/s00198-021-05900-y",
  },
  {
    role: "Current review confirming DXA as the gold-standard method for osteoporosis risk stratification and diagnosis, and its role alongside FRAX/trabecular bone score in fracture-risk assessment.",
    label: "Shahane, Lim & Bolster, 2025, \"Updates on the Role of DXA in the Evaluation and Monitoring of Osteoporosis\" (Curr Rheumatol Rep, PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12578744/",
  },
  {
    role: "UK patient explanation of DXA, its limits, and clinical risk factors (including prior fracture, smoking, family history, low BMI and glucocorticoids).",
    label: "NHS: Bone density scan—when it is used",
    url: "https://www.nhs.uk/tests-and-treatments/dexa-scan/why-its-done/",
  },
  {
    role: "UK guideline for fracture-risk assessment, DXA, lifestyle and clinical management.",
    label: "NOGG 2024 guideline",
    url: "https://www.nogg.org.uk/sites/nogg/download/NOGG-Guideline-2024.pdf",
  },
  {
    role: "Screening context: all women 65+ and postmenopausal women under 65 at increased risk; not a recommendation for people with known fragility fracture or secondary osteoporosis.",
    label: "USPSTF clinical summary",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/document/ClinicalSummaryFinal/osteoporosis-screening",
  },
  {
    role: "NIH patient guidance on calcium, vitamin D, activity, smoking and alcohol.",
    label: "NIAMS osteoporosis guidance",
    url: "https://www.niams.nih.gov/health-topics/osteoporosis/diagnosis-treatment-and-steps-to-take",
  },
  {
    role: "Multi-ethnic longitudinal menopause-transition cohort: BMD loss was greatest around the final menstrual period.",
    label: "Finkelstein et al., 2012 (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/21976317/",
  },
  {
    role: "Randomised WHI evidence that hormone therapy affects BMD/fracture outcomes; supports context, never a treatment recommendation.",
    label: "Cauley et al., 2003 (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/14519707/",
  },
  {
    role: "Prospective Study of Osteoporotic Fractures analysis, supporting the importance of fracture history in later bone-risk assessment.",
    label: "Crandall et al., 2018 (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/29992510/",
  },
  {
    role: "Systematic review/meta-analysis of exercise training and BMD in postmenopausal women.",
    label: "Shojaa et al., 2023 (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10282053/",
  },
  {
    role: "Public DXA provenance for the training-data workflow; records measurement and variables.",
    label: "CDC NHANES DXA documentation",
    url: "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2013/DataFiles/DXX_H.htm",
  },
  {
    role: "Public wrist physical-activity-monitor provenance for the activity feature workflow.",
    label: "CDC NHANES PAM documentation",
    url: "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2013/DataFiles/PAXHR_H.htm",
  },
  {
    role: "Government-funded cohort data reference for heel ultrasound bone measures; not interchangeable with clinical DXA.",
    label: "UK Biobank bone-densitometry category",
    url: "https://biobank.ndph.ox.ac.uk/ukb/label.cgi?id=100018",
  },
  {
    role: "NHS pathology context: total ALP can be elevated in bone and liver disease.",
    label: "Eastern Pathology Alliance: ALP",
    url: "https://www.easternpathologyalliance.nhs.uk/tests/alkaline-phosphatase-alp/",
  },
  {
    role: "Cross-sectional postmenopausal cohort (n=168): higher ALP was associated with lower T-score only in the osteopenia subgroup; it explained about 7% of T-score variance and was not a predictor in the osteoporosis subgroup.",
    label: "Tariq et al., 2019 (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6572960/",
  },
  {
    role: "Mixed-sex, single-centre patient/control study plus mouse models. It found no difference in RBC, haemoglobin, or haematocrit between clinical osteoporosis cases and controls, demonstrating that CBC associations are not consistent enough for screening.",
    label: "Li et al., 2022",
    url: "https://www.frontiersin.org/articles/10.3389/fendo.2022.965290/full",
  },
  {
    role: "Evidence review of clinical and experimental CBC–bone literature; it concludes that clinical utility and integration into risk assessment need further validation.",
    label: "Ha et al., 2025 (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12765876/",
  },
  {
    role: "Prospective MrOS cohort of older men: faster hip BMD loss was associated with anaemia, high neutrophils, and low lymphocytes. It does not validate isolated RBC count in postmenopausal women.",
    label: "Valderrábano et al., 2017 (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5292053/",
  },
  {
    role: "Government health explanation of full blood count measures, including RBC and differential white-cell counts.",
    label: "MedlinePlus: Complete Blood Count",
    url: "https://medlineplus.gov/lab-tests/complete-blood-count-cbc/",
  },
  {
    role: "Small cross-sectional postmenopausal study reporting an ALC/BMD association; hypothesis-generating only.",
    label: "Di Monaco et al., 2004 (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/14691689/",
  },
  {
    role: "Cross-sectional study of peripheral blood-cell counts and BMD in healthy postmenopausal women; association, not prediction.",
    label: "Kim et al., 2011 (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/21786437/",
  },
  {
    role: "Population-based postmenopausal cohort with two assessments; differential counts did not consistently predict BMD or microarchitecture.",
    label: "Biver et al., 2022 (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/36111204/",
  },
  {
    role: "Individual-person meta-analysis of 29 prospective cohorts (~2M participants) commissioned to update FRAX: RA raised fracture risk (HR 1.49 any clinical fracture, HR 2.23 hip fracture) independent of glucocorticoid exposure and femoral-neck BMD.",
    label: "Kanis et al., 2025 (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/39955689/",
  },
  {
    role: "Meta-analysis of 13 studies: pooled fracture risk ratio 2.25 [1.76–2.87] in RA vs non-RA, 1.99 [1.58–2.50] in the female subgroup.",
    label: "Xue et al., 2017 (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6393106/",
  },
  {
    role: "Review of thyroid hormone disease mechanisms and effects on bone remodelling and fracture risk.",
    label: "Thyroid Hormone Diseases and Osteoporosis (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7230461/",
  },
  {
    role: "Meta-analysis: endogenous hyperthyroidism is associated with increased osteoporosis and fracture risk via increased bone resorption.",
    label: "Vestergaard & Mosekilde, 2003 (Thyroid)",
    url: "https://journals.sagepub.com/doi/abs/10.1089/105072503322238854",
  },
  {
    role: "Review: bone mineral density is reduced in treated adult coeliac disease, including in postmenopausal patients.",
    label: "Osteoporosis in treated adult coeliac disease (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1382674/",
  },
  {
    role: "Prospective cohort of newly diagnosed adult coeliac patients: bone mineral density alterations in 60.3%, with osteoporosis in roughly half of affected patients.",
    label: "Risk factors associated with osteoporosis in a cohort of prospectively diagnosed adult coeliac patients (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6169042/",
  },
  {
    role: "Review: fracture risk is markedly elevated in chronic kidney disease, particularly stages G3–G5D, and is an overlooked complication.",
    label: "Fracture Risk in Chronic Kidney Disease (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12298187/",
  },
  {
    role: "Systematic review: 18–32% of CKD patients also have osteoporosis, with fracture risk over 2.5x that of people without CKD.",
    label: "Osteoporosis in Patients with Chronic Kidney Diseases (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7555655/",
  },
  {
    role: "Global review: the large majority of postmenopausal women received no osteoporosis treatment in the period following a fragility fracture (GLOW and related cohorts).",
    label: "Osteoporosis in 2022: care gaps to screening and personalised medicine (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7614114/",
  },
  {
    role: "European primary-care cohort: about 75% of elderly women at high fracture risk received no osteoporosis treatment.",
    label: "Osteoporosis treatment gap in European primary care, Osteoporos Int 2020",
    url: "https://link.springer.com/article/10.1007/s00198-020-05557-z",
  },
  {
    role: "Cross-national review describing the fragility-fracture treatment gap as a persistent international phenomenon.",
    label: "Fragility fractures and the osteoporosis care gap: an international phenomenon",
    url: "https://www.sciencedirect.com/science/article/abs/pii/S0049017205002143",
  },
  {
    role: "Comparative review reporting FRAX sensitivity of only ~33% for DXA-defined osteoporosis in women aged 50–64 at a 10-year major-fracture threshold of 9.3%.",
    label: "Risk assessment tools for screening, Curr Osteoporos Rep 2015",
    url: "https://link.springer.com/article/10.1007/s11914-015-0282-z",
  },
  {
    role: "Network meta-analysis comparing OST, ORAI, SCORE, OSIRIS and FRAX, grouping SCORE/ORAI/OST as higher-sensitivity and FRAX/OSIRIS as higher-specificity.",
    label: "Comparative accuracy of screening tools for osteoporosis, Int J Nurs Stud 2025",
    url: "https://www.sciencedirect.com/science/article/abs/pii/S0020748925000380",
  },
  {
    role: "Performance review of the age + weight-only OST screening tool.",
    label: "OST performance review (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6068473/",
  },
  {
    role: "Systematic review and meta-analysis of clinical risk-assessment instruments, reporting pooled OST sensitivity ~89% / specificity ~41%.",
    label: "Systematic review & meta-analysis of clinical risk-assessment instruments, Osteoporos Int 2015",
    url: "https://link.springer.com/article/10.1007/s00198-015-3025-1",
  },
  {
    role: "NHANES machine-learning model for low bone density (12,108 adults ≥50); sex-stratified analysis shows age+BMI dominate in women, and menopause status and physical activity were excluded for missing data.",
    label: "Karaismailoglu & Karaismailoglu, Risk prediction of low bone density with ML, Balkan Med J 2025 (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12576511/",
  },
  {
    role: "NHANES 2005–2006 accelerometer study linking objectively measured activity to higher bone density and trabecular bone score in older adults.",
    label: "Accelerometry, BMD and trabecular bone score, NHANES 2005-2006, Arch Osteoporos 2019",
    url: "https://link.springer.com/article/10.1007/s11657-019-0583-4",
  },
  {
    role: "NHANES 2007–2018 analysis: ≥38 MET-hours/week of activity was linked to lower osteoporosis risk in post-menopausal women.",
    label: "Physical activity and spine BMD in post-menopausal women, NHANES 2007-2018, J Orthop Surg Res 2023",
    url: "https://link.springer.com/article/10.1186/s13018-023-03976-2",
  },
  {
    role: "UK Biobank study: even brief bouts of higher-intensity activity predicted bone health in pre- and post-menopausal women.",
    label: "Brief high-intensity activity and bone health, UK Biobank, Int J Epidemiol 2017",
    url: "https://academic.oup.com/ije/article/46/6/1847/3902973",
  },
  {
    role: "Demographic/socioeconomic analysis of Fitbit ownership showing wearable data skews toward younger, more active, more affluent people.",
    label: "Demographic/socioeconomic factors in Fitbit ownership, IJERPH 2025",
    url: "https://doi.org/10.3390/ijerph23070839",
  },
  {
    role: "UK analysis of physical-activity surveillance via apps/wearables and how representative that data is of the general population.",
    label: "Physical activity surveillance via apps/wearables: representativeness in the UK, JMIR 2019 (PMC)",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6371078/",
  },
  {
    role: "Commentary on wearable-device access becoming a social determinant of health.",
    label: "Access to wearables as a social determinant of health, Healthcare IT News",
    url: "https://www.healthcareitnews.com/news/access-wearables-could-become-social-determinant-health-researchers-warn",
  },
  {
    role: "Review of health literacy and health-IT/digital-health adoption (the \"digital divide\").",
    label: "Health literacy and health-IT adoption (PMC)",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5069402/",
  },
  {
    role: "Machine-learning comparison of accelerometric versus non-accelerometric factors for predicting fall risk in older adults.",
    label: "Predicting fall risk in older adults: ML comparison, Digit Health 2025 (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11951886/",
  },
  {
    role: "Wearable-sensor gait study reporting ~81.6% accuracy classifying future fallers in community-dwelling older adults.",
    label: "Prediction of fall risk using a wearable system (PMC)",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8545936/",
  },
  {
    role: "Source of the NHANES III young-adult proximal-femur BMD reference data used to derive T-scores.",
    label: "Looker et al., \"Updated data on proximal femur bone mineral levels of US adults\", Osteoporos Int 1998.",
    url: null,
  },
  {
    role: "Review of osteoporosis treatment outcomes: real-world medication adherence ~60%, ~70% discontinue within a year, and physicians overestimate adherence (perceived 69% vs actual <49%).",
    label: "A New Look at Osteoporosis Outcomes, Mayo Clin Proc",
    url: "https://www.mayoclinicproceedings.org/article/S0025-6196(11)61200-7/fulltext",
  },
  {
    role: "Review of the economic case for improving osteoporosis medication adherence.",
    label: "The Economics of Improving Medication Adherence in Osteoporosis (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3167669/",
  },
  {
    role: "Community-based cohort of sedentary women 70+: only 17% reached recommended activity levels in a walking programme.",
    label: "Predictors of Long-term Exercise Adherence in Older Women (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2828261/",
  },
  {
    role: "Cohort of mobile resistance-training app users: only 18.1% of beginners remained adherent at 6 months.",
    label: "Predictors of long-term resistance exercise adherence among beginners (SportRxiv)",
    url: "https://sportrxiv.org/index.php/server/preprint/view/709",
  },
  {
    role: "US healthcare-cost projection: osteoporotic fracture costs rising from ~$57B (2018) to over $95B/year by 2040 as fracture counts rise from 1.9M to 3.2M/year.",
    label: "Healthcare Policy Changes in Osteoporosis Can Improve Outcomes and Reduce Costs, JBMR Plus (PMC)",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6808223/",
  },
  {
    role: "US postmenopausal cohort: a single fracture is linked to roughly $30,000 in all-cause healthcare costs in the following year.",
    label: "Long-term economic burden of osteoporotic fracture in US postmenopausal women, Osteoporos Int 2020",
    url: "https://link.springer.com/article/10.1007/s00198-020-05769-3",
  },
];

export const metadata: Metadata = {
  title: "Literature — BoneBot",
  description: "The clinical evidence register BoneBot's model and explanations are built on.",
};

export default function Literature() {
  return (
    <div
      className={`flex h-full flex-col overflow-y-auto ${BODY_FONT}`}
      style={{ backgroundColor: THEME.bg, color: THEME.bodyPrimary }}
    >
      <div className="mx-auto w-full max-w-[920px] px-6 py-12">
        <Link
          href="/"
          className={`${HEADING_FONT} text-[15px] font-semibold tracking-[-0.01em]`}
          style={{ color: THEME.accent }}
        >
          ← BoneBot
        </Link>

        <h1
          className={`mt-6 ${HEADING_FONT} text-[2.4rem] font-medium leading-[1.05] tracking-[-0.02em]`}
          style={{ color: THEME.ink }}
        >
          Literature
        </h1>
        <p className="mt-3 max-w-[70ch] text-[15px] leading-[1.6]" style={{ color: THEME.body }}>
          Every clinical claim BoneBot makes is drawn from a reviewed source in this
          register, kept in sync with{" "}
          <code className="rounded px-1.5 py-0.5 text-[13px]" style={{ backgroundColor: THEME.bandBg }}>
            docs/EVIDENCE.md
          </code>
          . The deterministic model predicts; the LLM only explains from these
          sources — it does not introduce new clinical claims.
        </p>

        <div
          className="mt-8 overflow-x-auto rounded-[14px] border"
          style={{ borderColor: THEME.border, backgroundColor: THEME.bg }}
        >
          <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b" style={{ borderColor: THEME.border }}>
                <th
                  className={`w-[55%] px-5 py-3.5 ${HEADING_FONT} text-[13px] font-medium uppercase tracking-wide`}
                  style={{ color: THEME.muted }}
                >
                  Evidence role
                </th>
                <th className={`px-5 py-3.5 ${HEADING_FONT} text-[13px] font-medium uppercase tracking-wide`} style={{ color: THEME.muted }}>
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {LITERATURE.map((entry, i) => (
                <tr key={i} className="border-b align-top last:border-0" style={{ borderColor: THEME.border }}>
                  <td className="px-5 py-4 leading-[1.55]" style={{ color: THEME.bodyPrimary }}>
                    {entry.role}
                  </td>
                  <td className="px-5 py-4 leading-[1.55]">
                    {entry.url ? (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline underline-offset-2 transition-colors"
                        style={{ color: THEME.accent, textDecorationColor: THEME.border }}
                      >
                        {entry.label}
                      </a>
                    ) : (
                      <span className="font-semibold" style={{ color: THEME.bodyPrimary }}>
                        {entry.label}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-[13px]" style={{ color: THEME.muted }}>
          {LITERATURE.length} sources. See{" "}
          <code className="rounded px-1.5 py-0.5" style={{ backgroundColor: THEME.bandBg }}>
            docs/EVIDENCE.md
          </code>{" "}
          for curation rules, per-topic appraisals, and how each card is scoped and limited.
        </p>
      </div>
    </div>
  );
}
