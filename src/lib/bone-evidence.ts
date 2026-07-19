// BoneBot's local, clinician-reviewed evidence library.
//
// This is intentionally small and static: no database, no retrieval service and
// no web request happens when a person uses BoneBot. The LLM receives only the
// selected cards below, plus the deterministic model output. Add a new medical
// claim only after it has been reviewed and given a source in docs/EVIDENCE.md.

export type EvidenceTopic =
  | "age"
  | "menopause"
  | "hormone-therapy"
  | "prior-fragility-fracture"
  | "bmi"
  | "weight-bearing-activity"
  | "smoking"
  | "glucocorticoids"
  | "rheumatoid-arthritis"
  | "alcohol"
  | "vitamin-d"
  | "calcium"
  | "alkaline-phosphatase"
  | "absolute-lymphocyte-count"
  | "red-blood-cell-count"
  | "thyroid-disease"
  | "coeliac-disease"
  | "chronic-kidney-disease"
  | "dxa-and-fracture-risk"
  | "care-gap"
  | "screening-tool-comparison"
  | "wearable-activity-evidence"
  | "wearable-data-bias"
  | "fall-risk"
  | "treatment-adherence"
  | "economic-burden";

export type EvidenceSource = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  type: "guideline" | "government" | "cohort" | "observational-study" | "trial" | "review" | "systematic-review" | "dataset";
};

export type EvidenceCard = {
  id: string;
  topic: EvidenceTopic;
  approvedWording: string;
  limits: string;
  sourceIds: string[];
};

export const EVIDENCE_SOURCES: EvidenceSource[] = [
  {
    id: "nhs-dxa",
    title: "Bone density scan (DXA scan): when it is used",
    publisher: "NHS",
    url: "https://www.nhs.uk/tests-and-treatments/dexa-scan/why-its-done/",
    type: "government",
  },
  {
    id: "nogg-2024",
    title: "UK clinical guideline for the prevention and treatment of osteoporosis",
    publisher: "National Osteoporosis Guideline Group",
    url: "https://www.nogg.org.uk/sites/nogg/download/NOGG-Guideline-2024.pdf",
    type: "guideline",
  },
  {
    id: "uspstf-2025",
    title: "Osteoporosis to Prevent Fractures: Screening",
    publisher: "U.S. Preventive Services Task Force",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/document/ClinicalSummaryFinal/osteoporosis-screening",
    type: "guideline",
  },
  {
    id: "niams-osteoporosis",
    title: "Osteoporosis: Diagnosis, Treatment, and Steps to Take",
    publisher: "NIH National Institute of Arthritis and Musculoskeletal and Skin Diseases",
    url: "https://www.niams.nih.gov/health-topics/osteoporosis/diagnosis-treatment-and-steps-to-take",
    type: "government",
  },
  {
    id: "swan-bmd-2012",
    title: "Bone mineral density loss in relation to the final menstrual period in SWAN",
    publisher: "Journal of Bone and Mineral Research (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/21976317/",
    type: "cohort",
  },
  {
    id: "whi-ht-fracture-2003",
    title: "Effects of estrogen plus progestin on risk of fracture and bone mineral density: WHI randomized trial",
    publisher: "JAMA (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/14519707/",
    type: "trial",
  },
  {
    id: "sof-fracture-2018",
    title: "Incident fracture and accelerated hip BMD loss: Study of Osteoporotic Fractures",
    publisher: "Journal of Bone and Mineral Research (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/29992510/",
    type: "cohort",
  },
  {
    id: "exercise-meta-2023",
    title: "Exercise training and bone mineral density in postmenopausal women: systematic review and meta-analysis",
    publisher: "Frontiers in Physiology (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10282053/",
    type: "systematic-review",
  },
  {
    id: "nhanes-dxa-2013-14",
    title: "NHANES 2013–2014 DXA documentation and codebook",
    publisher: "CDC National Center for Health Statistics",
    url: "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2013/DataFiles/DXX_H.htm",
    type: "dataset",
  },
  {
    id: "nhanes-pam-2013-14",
    title: "NHANES 2013–2014 Physical Activity Monitor documentation and codebook",
    publisher: "CDC National Center for Health Statistics",
    url: "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2013/DataFiles/PAXHR_H.htm",
    type: "dataset",
  },
  {
    id: "uk-biobank-bone",
    title: "UK Biobank heel bone densitometry data category",
    publisher: "UK Biobank",
    url: "https://biobank.ndph.ox.ac.uk/ukb/label.cgi?id=100018",
    type: "dataset",
  },
  {
    id: "nhs-alp",
    title: "Alkaline phosphatase (ALP) test information",
    publisher: "Eastern Pathology Alliance (NHS)",
    url: "https://www.easternpathologyalliance.nhs.uk/tests/alkaline-phosphatase-alp/",
    type: "government",
  },
  {
    id: "alp-tariq-2019",
    title: "Alkaline phosphatase is a predictor of bone mineral density in postmenopausal females",
    publisher: "Pakistan Journal of Medical Sciences (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6572960/",
    type: "observational-study",
  },
  {
    id: "cbc-li-2022",
    title: "Relationship between indices of circulating blood cells and bone homeostasis in osteoporosis",
    publisher: "Frontiers in Endocrinology",
    url: "https://www.frontiersin.org/articles/10.3389/fendo.2022.965290/full",
    type: "observational-study",
  },
  {
    id: "cbc-ha-2025",
    title: "Complete Blood Count Parameters and Bone Health: Clinical and Experimental Evidence",
    publisher: "Endocrinology and Metabolism (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12765876/",
    type: "review",
  },
  {
    id: "mros-cbc-2017",
    title: "Bone Density Loss Is Associated with Blood Cell Counts",
    publisher: "Journal of Bone and Mineral Research (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5292053/",
    type: "cohort",
  },
  {
    id: "medlineplus-cbc",
    title: "Complete Blood Count (CBC)",
    publisher: "MedlinePlus, U.S. National Library of Medicine",
    url: "https://medlineplus.gov/lab-tests/complete-blood-count-cbc/",
    type: "government",
  },
  {
    id: "alc-bmd-2004",
    title: "Total lymphocyte count and femoral bone mineral density in postmenopausal women",
    publisher: "Journal of Bone and Mineral Metabolism (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/14691689/",
    type: "observational-study",
  },
  {
    id: "rbc-bmd-2011",
    title: "Positive association between peripheral blood cell counts and BMD in postmenopausal women",
    publisher: "Yonsei Medical Journal (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/21786437/",
    type: "observational-study",
  },
  {
    id: "osteolaus-blood-counts-2022",
    title: "Differential blood counts do not consistently predict BMD and microarchitecture at homeostasis",
    publisher: "JBMR Plus (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/36111204/",
    type: "cohort",
  },
  {
    id: "ra-frax-ipd-2025",
    title: "Rheumatoid arthritis and subsequent fracture risk: an individual person meta-analysis to update FRAX",
    publisher: "Osteoporosis International (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/39955689/",
    type: "systematic-review",
  },
  {
    id: "ra-fracture-meta-2017",
    title: "Bone fracture risk in patients with rheumatoid arthritis: A meta-analysis",
    publisher: "Medicine (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6393106/",
    type: "systematic-review",
  },
  {
    id: "dxa-role-review-2025",
    title: "Updates on the Role of DXA in the Evaluation and Monitoring of Osteoporosis",
    publisher: "Current Rheumatology Reports (Shahane, Lim & Bolster, 2025)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12578744/",
    type: "review",
  },
  {
    id: "bhof-clinicians-guide-2022",
    title: "The clinician's guide to prevention and treatment of osteoporosis",
    publisher: "Osteoporosis International (Bone Health and Osteoporosis Foundation)",
    url: "https://link.springer.com/article/10.1007/s00198-021-05900-y",
    type: "guideline",
  },
  {
    id: "thyroid-osteoporosis-review-2021",
    title: "Thyroid Hormone Diseases and Osteoporosis",
    publisher: "PMC (NIH)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7230461/",
    type: "review",
  },
  {
    id: "hyperthyroidism-fracture-meta-2003",
    title: "Hyperthyroidism, Bone Mineral, and Fracture Risk—A Meta-Analysis",
    publisher: "Thyroid (Vestergaard & Mosekilde, 2003)",
    url: "https://journals.sagepub.com/doi/abs/10.1089/105072503322238854",
    type: "systematic-review",
  },
  {
    id: "coeliac-osteoporosis-review-2007",
    title: "Osteoporosis in treated adult coeliac disease",
    publisher: "PMC (NIH)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1382674/",
    type: "review",
  },
  {
    id: "coeliac-osteoporosis-cohort-2018",
    title: "Risk factors associated with osteoporosis in a cohort of prospectively diagnosed adult coeliac patients",
    publisher: "PMC (NIH)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6169042/",
    type: "cohort",
  },
  {
    id: "ckd-fracture-review-2025",
    title: "Fracture Risk in Chronic Kidney Disease: Addressing an Overlooked Complication",
    publisher: "PMC (NIH)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12298187/",
    type: "review",
  },
  {
    id: "ckd-osteoporosis-systematic-review-2020",
    title: "Osteoporosis in Patients with Chronic Kidney Diseases: A Systemic Review",
    publisher: "PMC (NIH)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7555655/",
    type: "systematic-review",
  },
  {
    id: "glow-care-gaps-2022",
    title: "Osteoporosis in 2022: care gaps to screening and personalised medicine",
    publisher: "PMC (NIH)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7614114/",
    type: "review",
  },
  {
    id: "eu-primary-care-gap-2020",
    title: "Osteoporosis treatment gap in European primary care",
    publisher: "Osteoporosis International",
    url: "https://link.springer.com/article/10.1007/s00198-020-05557-z",
    type: "cohort",
  },
  {
    id: "intl-fracture-care-gap",
    title: "Fragility fractures and the osteoporosis care gap: an international phenomenon",
    publisher: "ScienceDirect",
    url: "https://www.sciencedirect.com/science/article/abs/pii/S0049017205002143",
    type: "review",
  },
  {
    id: "frax-sensitivity-2015",
    title: "Risk assessment tools for screening",
    publisher: "Current Osteoporosis Reports",
    url: "https://link.springer.com/article/10.1007/s11914-015-0282-z",
    type: "review",
  },
  {
    id: "screening-tools-network-meta-2025",
    title: "Comparative accuracy of screening tools for osteoporosis: a network meta-analysis",
    publisher: "International Journal of Nursing Studies",
    url: "https://www.sciencedirect.com/science/article/abs/pii/S0020748925000380",
    type: "systematic-review",
  },
  {
    id: "ost-performance-review",
    title: "OST performance review (age + weight tool)",
    publisher: "PMC (NIH)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6068473/",
    type: "review",
  },
  {
    id: "screening-tools-meta-2015",
    title: "Systematic review and meta-analysis of clinical risk-assessment instruments",
    publisher: "Osteoporosis International",
    url: "https://link.springer.com/article/10.1007/s00198-015-3025-1",
    type: "systematic-review",
  },
  {
    id: "nhanes-ml-karaismailoglu-2025",
    title: "Risk prediction of low bone density with machine learning",
    publisher: "Balkan Medical Journal (Karaismailoglu & Karaismailoglu, 2025)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12576511/",
    type: "observational-study",
  },
  {
    id: "accelerometry-bmd-nhanes-2019",
    title: "Accelerometry, BMD and trabecular bone score, NHANES 2005-2006",
    publisher: "Archives of Osteoporosis",
    url: "https://link.springer.com/article/10.1007/s11657-019-0583-4",
    type: "observational-study",
  },
  {
    id: "activity-spine-bmd-nhanes-2023",
    title: "Physical activity and spine BMD in post-menopausal women, NHANES 2007-2018",
    publisher: "Journal of Orthopaedic Surgery and Research",
    url: "https://link.springer.com/article/10.1186/s13018-023-03976-2",
    type: "observational-study",
  },
  {
    id: "ukb-brief-activity-bone-2017",
    title: "Brief high-intensity activity and bone health, UK Biobank",
    publisher: "International Journal of Epidemiology",
    url: "https://academic.oup.com/ije/article/46/6/1847/3902973",
    type: "cohort",
  },
  {
    id: "wearable-ownership-bias-2025",
    title: "Demographic and socioeconomic factors in Fitbit ownership",
    publisher: "International Journal of Environmental Research and Public Health",
    url: "https://doi.org/10.3390/ijerph23070839",
    type: "observational-study",
  },
  {
    id: "wearable-surveillance-representativeness-2019",
    title: "Physical activity surveillance via apps/wearables: representativeness in the UK",
    publisher: "JMIR (PMC)",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6371078/",
    type: "observational-study",
  },
  {
    id: "wearable-social-determinant-2019",
    title: "Access to wearables as a social determinant of health",
    publisher: "Healthcare IT News",
    url: "https://www.healthcareitnews.com/news/access-wearables-could-become-social-determinant-health-researchers-warn",
    type: "review",
  },
  {
    id: "health-literacy-digital-divide-2016",
    title: "Health literacy and health-IT adoption (digital divide)",
    publisher: "PMC (NIH)",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5069402/",
    type: "review",
  },
  {
    id: "fall-risk-ml-comparison-2025",
    title: "Predicting fall risk in older adults: ML comparison of accelerometric vs non-accelerometric factors",
    publisher: "Digital Health (PMC)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11951886/",
    type: "observational-study",
  },
  {
    id: "fall-risk-wearable-2021",
    title: "Prediction of fall risk in community-dwelling older adults using a wearable system",
    publisher: "PMC (NIH)",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8545936/",
    type: "observational-study",
  },
  {
    id: "looker-tscore-reference-1998",
    title: "Updated data on proximal femur bone mineral levels of US adults",
    publisher: "Osteoporosis International (Looker et al., 1998)",
    url: "https://link.springer.com/article/10.1007/s001980050034",
    type: "observational-study",
  },
  {
    id: "adherence-mayo-2011",
    title: "A New Look at Osteoporosis Outcomes: The Influence of Treatment, Compliance, Persistence, and Adherence",
    publisher: "Mayo Clinic Proceedings",
    url: "https://www.mayoclinicproceedings.org/article/S0025-6196(11)61200-7/fulltext",
    type: "review",
  },
  {
    id: "adherence-economics-2011",
    title: "The Economics of Improving Medication Adherence in Osteoporosis",
    publisher: "PMC (NIH)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3167669/",
    type: "review",
  },
  {
    id: "exercise-adherence-older-women-2010",
    title: "Predictors of Long-term Exercise Adherence in a Community-Based Sample of Older Women",
    publisher: "PMC (NIH)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2828261/",
    type: "cohort",
  },
  {
    id: "resistance-app-adherence-2023",
    title: "Predictors of long-term resistance exercise adherence among beginners: evidence from mobile app users",
    publisher: "SportRxiv",
    url: "https://sportrxiv.org/index.php/server/preprint/view/709",
    type: "observational-study",
  },
  {
    id: "osteoporosis-cost-policy-2019",
    title: "Healthcare Policy Changes in Osteoporosis Can Improve Outcomes and Reduce Costs in the United States",
    publisher: "JBMR Plus (PMC)",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6808223/",
    type: "review",
  },
  {
    id: "fracture-economic-burden-2020",
    title: "Long-term direct and indirect economic burden associated with osteoporotic fracture in US postmenopausal women",
    publisher: "Osteoporosis International",
    url: "https://link.springer.com/article/10.1007/s00198-020-05769-3",
    type: "observational-study",
  },
];

export const EVIDENCE_CARDS: EvidenceCard[] = [
  {
    id: "dxa-context",
    topic: "dxa-and-fracture-risk",
    approvedWording:
      "A DXA scan measures bone density, but clinicians interpret it alongside fracture-risk factors and the wider health picture.",
    limits: "Do not call this estimated T-score a DXA result, diagnosis, or fracture-risk calculation.",
    sourceIds: ["nhs-dxa", "nogg-2024", "bhof-clinicians-guide-2022", "dxa-role-review-2025", "looker-tscore-reference-1998"],
  },
  {
    id: "age",
    topic: "age",
    approvedWording:
      "Age is one of several factors clinicians consider when assessing bone and fracture risk.",
    limits: "Do not use age alone to say that a person does or does not need a scan.",
    sourceIds: ["nhs-dxa", "uspstf-2025"],
  },
  {
    id: "menopause",
    topic: "menopause",
    approvedWording:
      "Bone loss accelerates around the final menstrual period as oestrogen levels fall, then continues more slowly after menopause.",
    limits: "Do not infer an individual's rate of bone loss from years since menopause.",
    sourceIds: ["swan-bmd-2012", "nhs-dxa"],
  },
  {
    id: "hormone-therapy",
    topic: "hormone-therapy",
    approvedWording:
      "Hormone therapy can affect bone health, but whether it is suitable is an individual clinical decision that balances benefits and risks.",
    limits: "Never recommend starting, stopping, or changing hormone therapy.",
    sourceIds: ["whi-ht-fracture-2003", "nogg-2024"],
  },
  {
    id: "prior-fragility-fracture",
    topic: "prior-fragility-fracture",
    approvedWording:
      "A fracture after a minor fall or injury is an important reason to discuss bone and fracture assessment with a clinician.",
    limits: "Do not say that this screening tool diagnoses osteoporosis or replaces clinical assessment after a fracture.",
    sourceIds: ["nhs-dxa", "sof-fracture-2018"],
  },
  {
    id: "bmi",
    topic: "bmi",
    approvedWording:
      "Body weight and body composition can be relevant to bone health, but BMI is only one part of an overall assessment.",
    limits: "Do not recommend weight gain or loss for bone health from this result.",
    sourceIds: ["nhs-dxa", "nogg-2024"],
  },
  {
    id: "weight-bearing-activity",
    topic: "weight-bearing-activity",
    approvedWording:
      "Regular weight-bearing and muscle-strengthening activity supports bone health and is commonly included in bone-health guidance.",
    limits: "Do not promise that activity will change this estimated score or prescribe an exercise programme; activity should suit the person's ability and safety needs.",
    sourceIds: ["nogg-2024", "exercise-meta-2023", "niams-osteoporosis"],
  },
  {
    id: "smoking",
    topic: "smoking",
    approvedWording:
      "Smoking is a recognised risk factor considered in bone-health assessment; stopping smoking supports overall health.",
    limits: "Offer supportive, non-judgmental language and do not imply smoking is the sole explanation for a result.",
    sourceIds: ["nhs-dxa", "nogg-2024"],
  },
  {
    id: "glucocorticoids",
    topic: "glucocorticoids",
    approvedWording:
      "Long-term oral glucocorticoid use is a recognised reason to discuss bone health with a clinician.",
    limits: "Never advise changing prescribed steroid medication.",
    sourceIds: ["nhs-dxa", "nogg-2024"],
  },
  {
    id: "rheumatoid-arthritis",
    topic: "rheumatoid-arthritis",
    approvedWording:
      "Rheumatoid arthritis is one of the health conditions that can be relevant when clinicians assess bone and fracture risk.",
    limits: "Do not attribute an individual result to rheumatoid arthritis or give disease-management advice.",
    sourceIds: ["nhs-dxa", "nogg-2024", "ra-frax-ipd-2025", "ra-fracture-meta-2017"],
  },
  {
    id: "alcohol",
    topic: "alcohol",
    approvedWording:
      "Heavy alcohol use is a recognised risk factor considered in bone-health assessment; reducing high alcohol intake can support overall health.",
    limits: "Do not provide a personalised alcohol plan or say alcohol is the sole explanation for a result.",
    sourceIds: ["nhs-dxa", "nogg-2024", "niams-osteoporosis"],
  },
  {
    id: "vitamin-d",
    topic: "vitamin-d",
    approvedWording:
      "Vitamin D helps the body absorb calcium and is relevant to bone health. A clinician can interpret a blood result in context.",
    limits: "Do not diagnose deficiency or recommend a supplement dose from this screen.",
    sourceIds: ["niams-osteoporosis", "nogg-2024"],
  },
  {
    id: "calcium",
    topic: "calcium",
    approvedWording:
      "Calcium is important for bone health, but a serum calcium result alone does not measure bone density.",
    limits: "Do not diagnose osteoporosis or recommend calcium supplements from serum calcium alone.",
    sourceIds: ["nhs-dxa", "niams-osteoporosis", "nogg-2024"],
  },
  {
    id: "alkaline-phosphatase",
    topic: "alkaline-phosphatase",
    approvedWording:
      "Alkaline phosphatase (ALP) can be part of a clinician-led investigation for conditions that affect bone health. Total ALP is non-specific: an abnormal result can have bone, liver, or other causes.",
    limits:
      "Do not use ALP to diagnose osteoporosis, estimate a T-score, or advise treatment. A result outside its laboratory reference range needs interpretation with the rest of the blood tests and clinical history; persistent low ALP also warrants clinical attention.",
    sourceIds: ["nogg-2024", "nhs-alp", "alp-tariq-2019"],
  },
  {
    id: "absolute-lymphocyte-count",
    topic: "absolute-lymphocyte-count",
    approvedWording:
      "An absolute lymphocyte count is part of a full blood count and needs clinical interpretation in the context of immune and blood health; it does not measure bone density.",
    limits:
      "Limited observational studies report associations with BMD, but blood-cell counts have not consistently predicted BMD or bone microarchitecture. Do not use ALC to estimate a T-score, fracture risk, or osteoporosis status.",
    sourceIds: ["medlineplus-cbc", "alc-bmd-2004", "osteolaus-blood-counts-2022"],
  },
  {
    id: "red-blood-cell-count",
    topic: "red-blood-cell-count",
    approvedWording:
      "A red blood cell count is part of a full blood count and helps clinicians assess blood-health concerns; it does not measure bone density.",
    limits:
      "A reported association with BMD in a cross-sectional postmenopausal sample does not establish prediction or cause. Do not use RBC count to estimate a T-score, fracture risk, anaemia, or osteoporosis status.",
    sourceIds: [
      "medlineplus-cbc",
      "rbc-bmd-2011",
      "osteolaus-blood-counts-2022",
      "cbc-li-2022",
      "cbc-ha-2025",
      "mros-cbc-2017",
    ],
  },
  {
    id: "thyroid-disease",
    topic: "thyroid-disease",
    approvedWording:
      "Thyroid conditions — including an overactive thyroid and long-term thyroid-hormone treatment after thyroid surgery — are a recognised cause of bone loss separate from age and menopause.",
    limits:
      "Do not diagnose a thyroid condition, comment on thyroid-hormone dosing, or advise changing thyroid medication. Direct an existing thyroid diagnosis or treatment concern back to the prescribing clinician.",
    sourceIds: ["nogg-2024", "thyroid-osteoporosis-review-2021", "hyperthyroidism-fracture-meta-2003"],
  },
  {
    id: "coeliac-disease",
    topic: "coeliac-disease",
    approvedWording:
      "Coeliac disease and other causes of poor nutrient absorption are a recognised cause of lower bone density, separate from age and menopause.",
    limits:
      "Do not diagnose coeliac disease or malabsorption, or give dietary or gluten-free treatment advice. Direct concerns to the clinician managing the condition.",
    sourceIds: ["nogg-2024", "coeliac-osteoporosis-review-2007", "coeliac-osteoporosis-cohort-2018"],
  },
  {
    id: "chronic-kidney-disease",
    topic: "chronic-kidney-disease",
    approvedWording:
      "Chronic kidney disease is a recognised cause of increased fracture risk and bone changes, separate from age and menopause.",
    limits:
      "Do not diagnose chronic kidney disease, estimate kidney function, or give kidney-related bone treatment advice. Direct results to the clinician managing kidney health.",
    sourceIds: ["nogg-2024", "ckd-fracture-review-2025", "ckd-osteoporosis-systematic-review-2020"],
  },
  {
    id: "care-gap",
    topic: "care-gap",
    approvedWording:
      "Even after a fragility fracture — the clearest possible warning sign — most women are never started on osteoporosis treatment, and under-diagnosis is a major driver of that gap. This is why widening who gets screened matters.",
    limits:
      "General epidemiological context only. Do not use this to claim that a specific person has been under-treated, or to comment on any individual's treatment history.",
    sourceIds: ["glow-care-gaps-2022", "eu-primary-care-gap-2020", "intl-fracture-care-gap"],
  },
  {
    id: "screening-tool-comparison",
    topic: "screening-tool-comparison",
    approvedWording:
      "Established clinical screening tools (OST, ORAI, SCORE, OSIRIS, FRAX) trade sensitivity against specificity and mostly rely on a handful of static inputs like age and weight; a recent NHANES machine-learning model shows a similar pattern for women. BoneBot is a research screening tool exploring whether menopause status and objective activity add value beyond that.",
    limits:
      "Do not claim BoneBot outperforms these validated clinical tools or that it replaces them for individual clinical decision-making; it is a research benchmark, not a validated clinical calculator.",
    sourceIds: [
      "frax-sensitivity-2015",
      "screening-tools-network-meta-2025",
      "ost-performance-review",
      "screening-tools-meta-2015",
      "nhanes-ml-karaismailoglu-2025",
    ],
  },
  {
    id: "wearable-activity-evidence",
    topic: "wearable-activity-evidence",
    approvedWording:
      "Objectively measured activity (from a wrist accelerometer, not a step count someone reports) has been linked to higher bone density and better bone measures in older and post-menopausal women, including from brief bouts of higher-intensity movement.",
    limits:
      "Supports why BoneBot asks about activity; do not promise that changing activity will change a person's estimated score, and do not prescribe an exercise programme from this card alone.",
    sourceIds: ["accelerometry-bmd-nhanes-2019", "activity-spine-bmd-nhanes-2023", "ukb-brief-activity-bone-2017"],
  },
  {
    id: "wearable-data-bias",
    topic: "wearable-data-bias",
    approvedWording:
      "Consumer wearable and fitness-app data tends to over-represent people who are younger, more active and more affluent, so BoneBot trains on NHANES's research-grade, provisioned accelerometer data instead of app- or device-volunteered activity data.",
    limits:
      "Explains a design choice about the training data; not a statement about any individual person's own device, app, or data.",
    sourceIds: [
      "wearable-ownership-bias-2025",
      "wearable-surveillance-representativeness-2019",
      "wearable-social-determinant-2019",
      "health-literacy-digital-divide-2016",
    ],
  },
  {
    id: "fall-risk",
    topic: "fall-risk",
    approvedWording:
      "A fall is what typically turns low bone density into a fracture, and research has used wearable-measured gait and movement patterns to help identify people at higher risk of falling.",
    limits:
      "BoneBot does not assess fall risk or gait today. Do not estimate an individual's fall risk from this card; direct fall concerns to a clinician or a falls-prevention service.",
    sourceIds: ["fall-risk-ml-comparison-2025", "fall-risk-wearable-2021"],
  },
  {
    id: "treatment-adherence",
    topic: "treatment-adherence",
    approvedWording:
      "Even once diagnosed and prescribed medication or an exercise programme, real-world adherence is often poor — many people stop osteoporosis medication within the first year, and structured exercise programmes see high drop-off, especially among older, less active women.",
    limits:
      "General context on a well-documented gap, not personalised adherence coaching, a treatment plan, or medication advice.",
    sourceIds: [
      "adherence-mayo-2011",
      "adherence-economics-2011",
      "exercise-adherence-older-women-2010",
      "resistance-app-adherence-2023",
    ],
  },
  {
    id: "economic-burden",
    topic: "economic-burden",
    approvedWording:
      "Osteoporotic fractures carry a large and rising healthcare cost, with a single fracture linked to roughly $30,000 in care costs in the following year — part of why earlier identification matters.",
    limits:
      "Population-level context only. Do not give individual cost, insurance, or billing advice.",
    sourceIds: ["osteoporosis-cost-policy-2019", "fracture-economic-burden-2020"],
  },
];

const FACTOR_TO_CARD: Record<string, string> = {
  Age: "age",
  "Years since menopause": "menopause",
  "Hormone therapy": "hormone-therapy",
  "Prior fragility fracture": "prior-fragility-fracture",
  "Body mass index": "bmi",
  "Weight-bearing activity": "weight-bearing-activity",
  "Current smoker": "smoking",
  "Glucocorticoid use": "glucocorticoids",
  "Rheumatoid arthritis": "rheumatoid-arthritis",
  "High alcohol intake": "alcohol",
  "Vitamin D": "vitamin-d",
  "Serum calcium": "calcium",
  "Alkaline phosphatase": "alkaline-phosphatase",
};

export function selectEvidence(factors: string[]): { cards: EvidenceCard[]; sources: EvidenceSource[] } {
  const cardIds = new Set(["dxa-context", ...factors.map((factor) => FACTOR_TO_CARD[factor]).filter(Boolean)]);
  return evidenceForCardIds(cardIds);
}

const QUESTION_EVIDENCE: [string, RegExp][] = [
  ["dxa-context", /\b(dexa|dxa|scan|t[ -]?score|score|result|screening)\b/i],
  ["age", /\bage\b/i],
  ["menopause", /\b(menopause|menopausal|periods?)\b/i],
  ["hormone-therapy", /\b(hrt|hormone)\b/i],
  ["prior-fragility-fracture", /\b(fracture|broken bone|break a bone|minor fall)\b/i],
  ["bmi", /\b(bmi|weight|body mass)\b/i],
  ["weight-bearing-activity", /\b(exercise|activity|active|weight[- ]bearing|strength|resistance)\b/i],
  ["smoking", /\b(smok|cigarette|vape)\b/i],
  ["glucocorticoids", /\b(steroid|prednisone|glucocorticoid)\b/i],
  ["rheumatoid-arthritis", /\b(rheumatoid|arthritis|\bra\b)\b/i],
  ["alcohol", /\b(alcohol|drink)\b/i],
  ["vitamin-d", /\b(vitamin d|vitamin-d)\b/i],
  ["calcium", /\bcalcium\b/i],
  ["thyroid-disease", /\b(thyroid|thyroidectomy|hyperthyroid)\w*\b/i],
  ["coeliac-disease", /\b(coeliac|celiac|malabsorption)\b/i],
  ["chronic-kidney-disease", /\b(kidney|renal|dialysis|ckd)\b/i],
  ["care-gap", /\b(untreated|treatment gap|under[- ]?diagnos|undiagnosed|care gap|no treatment)\b/i],
  ["screening-tool-comparison", /\b(frax|\bost\b|orai|osiris|other (risk )?(tools|calculators)|how (accurate|good|reliable) is this|compare[sd]?)\b/i],
  ["wearable-activity-evidence", /\b(accelerometer|wearable|wrist monitor|activity tracker)\b/i],
  ["wearable-data-bias", /\b(fitness app|fitness tracker|who (wears|owns) a wearable|representative(ness)?|selection bias)\b/i],
  ["fall-risk", /\b(fall|falls|falling|gait|balance)\b/i],
  ["treatment-adherence", /\b(adherence|stick (to|with)|stop(ped)? taking|compliance|keep up (with )?(my )?exercise|drop ?out)\b/i],
  ["economic-burden", /\b(cost|expensive|afford|healthcare spending|economic burden)\b/i],
];

const GENERAL_BONE_HEALTH = /\b(bone|osteoporosis|osteopenia|prevent|protect|keep healthy|what can i do)\b/i;

/**
 * Returns only the clinician-approved cards relevant to a user question. A
 * missing result deliberately means the question is outside BoneBot's scope.
 */
export function selectEvidenceForQuestion(question: string): { cards: EvidenceCard[]; sources: EvidenceSource[] } | null {
  const text = question.trim();
  if (!text) return null;

  const cardIds = new Set<string>();
  for (const [cardId, matcher] of QUESTION_EVIDENCE) {
    if (matcher.test(text)) cardIds.add(cardId);
  }
  if (GENERAL_BONE_HEALTH.test(text)) {
    cardIds.add("dxa-context");
    cardIds.add("weight-bearing-activity");
    cardIds.add("smoking");
    cardIds.add("alcohol");
  }

  return cardIds.size ? evidenceForCardIds(cardIds) : null;
}

export function evidenceForCardIds(cardIds: Set<string>): { cards: EvidenceCard[]; sources: EvidenceSource[] } {
  const cards = EVIDENCE_CARDS.filter((card) => cardIds.has(card.id));
  const sourceIds = new Set(cards.flatMap((card) => card.sourceIds));
  const sources = EVIDENCE_SOURCES.filter((source) => sourceIds.has(source.id));
  return { cards, sources };
}

export function evidencePrompt(cards: EvidenceCard[]): string {
  return cards
    .map(
      (card) =>
        `[${card.id}] Approved wording: ${card.approvedWording}\nLimit: ${card.limits}\nSources: ${card.sourceIds.join(", ")}`,
    )
    .join("\n\n");
}

export function usesOnlySelectedEvidence(
  evidenceIds: string[],
  cards: EvidenceCard[],
): boolean {
  const allowedIds = new Set(cards.map((card) => card.id));
  return evidenceIds.length > 0 && evidenceIds.every((id) => allowedIds.has(id));
}

/**
 * Combines multiple evidence selections (e.g. question-keyword matches plus a
 * person's own result-based cards) into one deduplicated set. Null/undefined
 * selections are ignored, so callers can pass through an absent selection
 * (e.g. no result supplied) without a separate branch.
 */
export function mergeEvidence(
  ...selections: ({ cards: EvidenceCard[]; sources: EvidenceSource[] } | null | undefined)[]
): { cards: EvidenceCard[]; sources: EvidenceSource[] } {
  const cardIds = new Set<string>();
  for (const selection of selections) {
    for (const card of selection?.cards ?? []) cardIds.add(card.id);
  }
  return evidenceForCardIds(cardIds);
}

/**
 * Relaxed citation check for the Q&A path, where an answer may be grounded in
 * the supplied result/model context instead of, or as well as, an evidence
 * card. Unlike usesOnlySelectedEvidence, this does not require at least one
 * citation — but it still rejects any citation that wasn't actually supplied,
 * so the model can never claim support from a card it wasn't given.
 */
export function citesOnlyAllowedEvidence(
  evidenceIds: string[],
  cards: EvidenceCard[],
): boolean {
  const allowedIds = new Set(cards.map((card) => card.id));
  return evidenceIds.every((id) => allowedIds.has(id));
}
