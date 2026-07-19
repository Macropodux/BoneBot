import { describe, expect, it } from "vitest";

import { resolveAmbiguousAnswer } from "./ambiguity";

describe("resolveAmbiguousAnswer", () => {
  it("asks one tailored clarification for a possible fragility fracture", () => {
    expect(resolveAmbiguousAnswer("fracture", 0)).toEqual({
      action: "clarify",
      message: "Was the break from a minor fall or low-impact injury, rather than a major accident?",
    });
  });

  it("marks a repeated ambiguous answer as unknown without adding risk", () => {
    expect(resolveAmbiguousAnswer("fracture", 1)).toEqual({
      action: "unknown",
      storedValue: "Not sure",
      note: "Your answer about a possible previous fragility fracture was uncertain, so the estimate did not assume that you had one. Please discuss this with a clinician.",
    });
  });
});
