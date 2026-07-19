import { describe, expect, it } from "vitest";

import {
  ACTIVITY_QUESTIONS,
  activityLevelFromDailyAverages,
  parseDailyActivity,
} from "./activity-input";

describe("activity input", () => {
  it("uses the approved seven-day question copy", () => {
    expect(ACTIVITY_QUESTIONS.steps.question).toBe(
      "Over the past 7 days, about how many steps did you average per day?",
    );
    expect(ACTIVITY_QUESTIONS.minutes.question).toBe(
      "Over the past 7 days, about how many active or exercise minutes did you average per day?",
    );
  });

  it("maps either available value and averages both normalized values", () => {
    expect(activityLevelFromDailyAverages(5000, null)).toBe(0.5);
    expect(activityLevelFromDailyAverages(null, 22.5)).toBe(0.5);
    expect(activityLevelFromDailyAverages(10000, 0)).toBe(0.5);
    expect(activityLevelFromDailyAverages(null, null)).toBeNull();
  });

  it("accepts bounded daily averages only", () => {
    expect(parseDailyActivity("7500", 100000)).toBe(7500);
    expect(parseDailyActivity("", 100000)).toBeNull();
    expect(parseDailyActivity("Not sure", 100000)).toBeNull();
    expect(parseDailyActivity("-1", 1440)).toBeNull();
    expect(parseDailyActivity("1441", 1440)).toBeNull();
  });
});
