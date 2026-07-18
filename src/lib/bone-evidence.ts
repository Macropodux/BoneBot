// BoneWise's local, clinician-reviewed evidence library.
//
// This is intentionally small and static: no database, no retrieval service and
// no web request happens when a person uses BoneWise. The LLM receives only the
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
  | "parental-hip-fracture"
  | "glucocorticoids"
  | "rheumatoid-arthritis"
  | "alcohol"
  | "vitamin-d"
  | "calcium"
  | "alkaline-phosphatase"
  | "absolute-lymphocyte-count"
  | "red-blood-cell-count"
  | "dxa-and-fracture-risk";

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
    title: "Bone density scan (DEXA scan): when it is used",
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
];

export const EVIDENCE_CARDS: EvidenceCard[] = [
  {
    id: "dxa-context",
    topic: "dxa-and-fracture-risk",
    approvedWording:
      "A DXA scan measures bone density, but clinicians interpret it alongside fracture-risk factors and the wider health picture.",
    limits: "Do not call this estimated T-score a DXA result, diagnosis, or fracture-risk calculation.",
    sourceIds: ["nhs-dxa", "nogg-2024"],
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
    id: "parental-hip-fracture",
    topic: "parental-hip-fracture",
    approvedWording:
      "A family history of hip fracture is one of the risk factors clinicians may take into account when assessing fracture risk.",
    limits: "Do not say that a family history determines a person's bone density or future fracture.",
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
    sourceIds: ["nhs-dxa", "nogg-2024"],
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
];

const FACTOR_TO_CARD: Record<string, string> = {
  Age: "age",
  "Years since menopause": "menopause",
  "Hormone therapy": "hormone-therapy",
  "Prior fragility fracture": "prior-fragility-fracture",
  "Body mass index": "bmi",
  "Weight-bearing activity": "weight-bearing-activity",
  "Current smoker": "smoking",
  "Parental hip fracture": "parental-hip-fracture",
  "Glucocorticoid use": "glucocorticoids",
  "Rheumatoid arthritis": "rheumatoid-arthritis",
  "High alcohol intake": "alcohol",
  "Vitamin D": "vitamin-d",
  "Serum calcium": "calcium",
  "Alkaline phosphatase": "alkaline-phosphatase",
};

export function selectEvidence(factors: string[]): { cards: EvidenceCard[]; sources: EvidenceSource[] } {
  const cardIds = new Set(["dxa-context", ...factors.map((factor) => FACTOR_TO_CARD[factor]).filter(Boolean)]);
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
