import { describe, expect, it } from "vitest";

import { adaptiveHalfWidth, type IntervalConfig } from "./bone-model";

// Illustrative variances/coefficients — the test checks the formula's behaviour,
// not the real trained numbers.
const coefficients = { bmi: 0.064, calcium: 0.95, smoking: 0.0002 };
const withVariances: IntervalConfig = {
  residualStd: 0.483,
  z: 1.96,
  featureVariances: { bmi: 30, calcium: 0.01, smoking: 0.09 },
  fixedHalfWidth: 0.9467,
};

describe("adaptiveHalfWidth", () => {
  it("returns the fixed half-width when no variances are exported", () => {
    const cfg = { ...withVariances, featureVariances: {} };
    expect(adaptiveHalfWidth(["bmi", "calcium"], coefficients, cfg)).toBe(0.9467);
  });

  it("gives the residual-only band when every feature was supplied", () => {
    const halfWidth = adaptiveHalfWidth([], coefficients, withVariances);
    expect(halfWidth).toBeCloseTo(1.96 * 0.483, 6);
  });

  it("widens the band when a feature is imputed", () => {
    const full = adaptiveHalfWidth([], coefficients, withVariances);
    const missingBmi = adaptiveHalfWidth(["bmi"], coefficients, withVariances);
    expect(missingBmi).toBeGreaterThan(full);
  });

  it("widens more as more features are imputed (adds in quadrature)", () => {
    const one = adaptiveHalfWidth(["bmi"], coefficients, withVariances);
    const two = adaptiveHalfWidth(["bmi", "calcium"], coefficients, withVariances);
    expect(two).toBeGreaterThan(one);
    // quadrature: variance = residual^2 + beta_bmi^2*var_bmi + beta_ca^2*var_ca
    const expected = 1.96 * Math.sqrt(0.483 ** 2 + 0.064 ** 2 * 30 + 0.95 ** 2 * 0.01);
    expect(two).toBeCloseTo(expected, 6);
  });

  it("barely moves for a low-variance feature (calcium is tightly regulated)", () => {
    const full = adaptiveHalfWidth([], coefficients, withVariances);
    const missingCalcium = adaptiveHalfWidth(["calcium"], coefficients, withVariances);
    expect(missingCalcium - full).toBeLessThan(0.05);
  });
});
