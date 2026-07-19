"""Export the exact NHANES 2013-2014 analytic tables BoneBot was trained on,
as a downloadable benchmark artifact under model/data/.

Reproduces the download + merge + feature engineering + the EXACT train/test
split and outlier filter from `train_bonebot.ipynb` (same random_state=0,
test_size=0.25, MinCovDet 0.99 Mahalanobis), then writes:

  model/data/bonebot_nhanes_2013_2014.csv  - heavyweight T-score benchmark
      (women 50+ with a femur DXA). One row per respondent (SEQN) with the 13
      model features, the DXA femoral-neck BMD, the derived T-score label and
      osteoporosis flag, plus `split` (train/test) and `training_outlier` so the
      published split matches the paper exactly. The held-out test set is the
      280 rows with split == "test".
  model/data/bonebot_triage_2013_2014.csv  - lightweight triage benchmark
      (women 18+ with a femur DXA): age, BMI, postmenopausal flag, osteoporosis.
  model/data/nhanes_sources.sha256          - SHA-256 of every source .xpt file
      downloaded, so the raw NHANES fetch is hash-verifiable and this run is
      reproducible even if the CDC site changes.

Feature values are RAW analytic values (pre-imputation): genuine NHANES
missingness is preserved as empty cells, and imputation is a modeling step, not
part of the published data. The DXA scan (BMD / T-score) is the LABEL only and
is never a model feature.

Run:  python3.10 model/export_dataset.py
"""

import ssl
import urllib.request
import io
import os
import hashlib

import numpy as np
import pandas as pd
from scipy.stats import chi2
from sklearn.covariance import MinCovDet
from sklearn.model_selection import train_test_split

ssl._create_default_https_context = ssl._create_unverified_context

BASE = "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2013/DataFiles/"
HEADERS = {"User-Agent": "Mozilla/5.0"}
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(OUT_DIR, exist_ok=True)

_hashes: dict[str, str] = {}


def load(f):
    """Download an NHANES .xpt file, record its SHA-256, return a DataFrame."""
    req = urllib.request.Request(BASE + f + ".xpt", headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        raw = r.read()
    _hashes[f] = hashlib.sha256(raw).hexdigest()
    return pd.read_sas(io.BytesIO(raw), format="xport")


# --- 1. download + merge (all one row per person -> safe to merge on SEQN) ---
files = ["DEMO_H", "BMX_H", "DXXFEM_H", "RHQ_H", "OSQ_H", "SMQ_H",
         "ALQ_H", "MCQ_H", "VID_H", "BIOPRO_H", "PAQ_H"]
frames = {}
for f in files:
    try:
        frames[f] = load(f)
        print("loaded", f, frames[f].shape)
    except Exception as e:
        print("MISSING / renamed:", f, e)

merged = frames["DEMO_H"]
for f in files[1:]:
    if f in frames:
        merged = merged.merge(frames[f], on="SEQN", how="left")

REF_MEAN, REF_SD = 0.858, 0.120   # NHANES III young-adult white-female femoral-neck reference

# --- 2. heavyweight sample: women 50+ with a femur DXA scan ---
women = merged[(merged.RIAGENDR == 2) & (merged.RIDAGEYR >= 50) & (merged.DXXNKBMD.notna())].copy()

women["femoralNeckBMD"]         = women["DXXNKBMD"]
women["Tscore"]                 = (women["DXXNKBMD"] - REF_MEAN) / REF_SD      # target
women["age"]                    = women["RIDAGEYR"]
women["bmi"]                    = women["BMXBMI"]
women["vitaminD"]               = women["LBXVIDMS"]                            # nmol/L
women["calcium"]                = women["LBDSCASI"]                            # mmol/L
women["currentSmoker"]          = women["SMQ040"].isin([1, 2]).astype(int)
women["priorFragilityFracture"] = women[["OSQ010A", "OSQ010B", "OSQ010C"]].eq(1).any(axis=1).astype(int)
women["glucocorticoids"]        = (women["OSQ130"] == 1).astype(int)
women["highAlcohol"]            = (women["ALQ130"] >= 3).astype(int)
women["yearsSinceMenopause"]    = (women["RIDAGEYR"] - women["RHQ060"]).clip(lower=0)

scr = women["LBXSCR"]  # serum creatinine, mg/dL
k, alpha = 0.7, -0.241
egfr = (142 * np.minimum(scr / k, 1) ** alpha
        * np.maximum(scr / k, 1) ** -1.200
        * 0.9938 ** women["RIDAGEYR"] * 1.012)
women["thyroid"] = (women["MCQ160M"] == 1)
women["ckd"]     = (egfr < 60)
women["secondaryCondition"]  = (women["thyroid"] | women["ckd"]).astype(int)
women["rheumatoidArthritis"] = ((women["MCQ160A"] == 1) & (women["MCQ195"] == 2)).astype(int)
women["onHormoneTherapy"]    = (women["RHQ540"] == 1).astype(int)

# wearable activity: mean daily MIMS from the wrist accelerometer, normalised 0-1
pax = load("PAXDAY_H")
pax_valid = pax[pax["PAXWWMD"] >= 600]
day_stats = pax_valid.groupby("SEQN")["PAXMTSD"].agg(["mean", "size"]).reset_index()
day_stats = day_stats[day_stats["size"] >= 4]
act = day_stats[["SEQN", "mean"]].rename(columns={"mean": "daily_mims"})
women = women.merge(act, on="SEQN", how="left")
women["activity_level"] = (women["daily_mims"] / women["daily_mims"].quantile(0.95)).clip(0, 1)

women["osteoporosis"]   = (women["Tscore"] <= -2.5).astype(int)
women["postmenopausal"] = ((women["RIDAGEYR"] - women["RHQ060"]) >= 0).astype(int)

# --- 3. reproduce the EXACT split + outlier filter used to fit the model ---
features = ["age", "bmi", "yearsSinceMenopause", "activity_level",
            "priorFragilityFracture", "glucocorticoids", "currentSmoker",
            "highAlcohol", "vitaminD", "calcium", "rheumatoidArthritis",
            "onHormoneTherapy", "secondaryCondition"]
continuous_features = ["age", "bmi", "yearsSinceMenopause",
                       "activity_level", "vitaminD", "calcium"]

X_raw = women[features].copy()
y = women["Tscore"].copy()
Xtr_raw, Xte_raw, ytr_raw, yte_h = train_test_split(
    X_raw, y, test_size=0.25, random_state=0
)

women["split"] = np.where(women.index.isin(Xte_raw.index), "test", "train")

# outlier flag: MinCovDet on training-only, median-imputed continuous features
training_medians = Xtr_raw.median()
Xtr_imputed = Xtr_raw.fillna(training_medians)
robust_cov = MinCovDet(random_state=0).fit(Xtr_imputed[continuous_features])
maha = robust_cov.mahalanobis(Xtr_imputed[continuous_features])
cutoff = chi2.ppf(0.99, df=len(continuous_features))
outlier_idx = Xtr_raw.index[maha > cutoff]
women["training_outlier"] = np.where(women.index.isin(outlier_idx), 1, 0)

HEAVY_COLS = [
    "SEQN", "split", "training_outlier",
    # 13 model features (the scan is never among them)
    "age", "bmi", "yearsSinceMenopause", "activity_level",
    "priorFragilityFracture", "glucocorticoids", "currentSmoker",
    "highAlcohol", "vitaminD", "calcium", "rheumatoidArthritis",
    "onHormoneTherapy", "secondaryCondition",
    # label side (DXA-derived), kept for transparency, never a feature
    "femoralNeckBMD", "Tscore", "osteoporosis",
    # context
    "postmenopausal",
]
heavy = women[HEAVY_COLS].copy()
heavy["SEQN"] = heavy["SEQN"].astype(int)
heavy_path = os.path.join(OUT_DIR, "bonebot_nhanes_2013_2014.csv")
heavy.to_csv(heavy_path, index=False)
n_test = int((heavy["split"] == "test").sum())
n_train = int((heavy["split"] == "train").sum())
n_out = int(heavy["training_outlier"].sum())
print(f"\nheavyweight dataset: {heavy.shape[0]} women "
      f"(train {n_train}, test {n_test}, training outliers {n_out}) -> {heavy_path}")

# --- 4. lightweight triage sample: women 18+ with a femur DXA scan ---
fem = merged[(merged.RIAGENDR == 2) & (merged.DXXNKBMD.notna()) & (merged.RIDAGEYR >= 18)].copy()
fem["osteoporosis"]   = ((fem["DXXNKBMD"] - REF_MEAN) / REF_SD <= -2.5).astype(int)
fem["age"]            = fem["RIDAGEYR"]
fem["bmi"]            = fem["BMXBMI"]
fem["postmenopausal"] = ((fem["RIDAGEYR"] - fem["RHQ060"]) >= 0).astype(int)

triage = fem[["SEQN", "age", "bmi", "postmenopausal", "osteoporosis"]].copy()
triage["SEQN"] = triage["SEQN"].astype(int)
triage_path = os.path.join(OUT_DIR, "bonebot_triage_2013_2014.csv")
triage.to_csv(triage_path, index=False)
print(f"triage dataset:      {triage.shape[0]} women -> {triage_path}")

# --- 5. pin the source files by content hash ---
# If a manifest already exists (committed), verify this run's downloads against
# it before overwriting, so a rerun is hash-verified against the pinned sources.
manifest_path = os.path.join(OUT_DIR, "nhanes_sources.sha256")
if os.path.exists(manifest_path):
    expected = {}
    with open(manifest_path) as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#"):
                digest, name = line.split()
                expected[name] = digest
    mism = [n for n, h in _hashes.items()
            if f"{n}.xpt" in expected and expected[f"{n}.xpt"] != h]
    if mism:
        print("WARNING: source hash MISMATCH vs pinned manifest:", ", ".join(mism))
    else:
        print("source hashes verified against pinned manifest OK")

with open(manifest_path, "w") as fh:
    fh.write("# NHANES 2013-2014 source files (SHA-256), base URL:\n")
    fh.write(f"# {BASE}\n")
    for name in files + ["PAXDAY_H"]:
        if name in _hashes:
            fh.write(f"{_hashes[name]}  {name}.xpt\n")
print(f"source hash manifest -> {manifest_path}")
