export type AmbiguityResolution =
  | { action: "clarify"; message: string }
  | { action: "unknown"; storedValue: "Not sure"; note: string };

const clarificationByQuestion: Record<string, string> = {
  fracture: "Was the break from a minor fall or low-impact injury, rather than a major accident?",
  parent: "Do you know whether either parent had a hip fracture? If you are not sure, that is okay.",
  smoke: "Do you currently smoke tobacco or use nicotine products regularly?",
  steroids: "Have you taken steroid tablets, such as prednisolone, for three months or more?",
  menopauseStatus: "Have your periods stopped permanently, rather than temporarily?",
  menopause: "About how old were you when your periods stopped permanently?",
  weight: "Do you weigh under 57 kg (about 9 stone)?",
  dxaScore: "Please enter the T-score exactly as it appears on your DXA report, or say you do not know it.",
  dxaYear: "What year was your most recent DXA scan? You can say you do not know.",
};

const labelByQuestion: Record<string, string> = {
  fracture: "a possible previous fragility fracture",
  parent: "parental hip-fracture history",
  smoke: "current smoking",
  steroids: "long-term steroid use",
  menopauseStatus: "menopause status",
  menopause: "age at menopause",
  weight: "weight",
  dxaScore: "your previous DXA T-score",
  dxaYear: "the year of your previous DXA scan",
};

export function resolveAmbiguousAnswer(questionKey: string, clarificationAttempts: number): AmbiguityResolution {
  const label = labelByQuestion[questionKey] ?? "this answer";
  if (clarificationAttempts === 0) {
    return {
      action: "clarify",
      message: clarificationByQuestion[questionKey] ?? "Could you choose the answer that fits best? If you are still unsure, just say so.",
    };
  }

  if (questionKey === "fracture") {
    return {
      action: "unknown",
      storedValue: "Not sure",
      note: "Your answer about a possible previous fragility fracture was uncertain, so the estimate did not assume that you had one. Please discuss this with a clinician.",
    };
  }

  return {
    action: "unknown",
    storedValue: "Not sure",
    note: `Your answer about ${label} was uncertain, so the estimate did not assume a risk value. Please discuss this with a clinician.`,
  };
}
