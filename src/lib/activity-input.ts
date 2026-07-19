export const ACTIVITY_QUESTIONS = {
  steps: {
    question: "Over the past 7 days, about how many steps did you average per day?",
    helper: "Enter the average shown in Apple Health or your activity app, or upload a weekly activity summary.",
  },
  minutes: {
    question: "Over the past 7 days, about how many active or exercise minutes did you average per day?",
    helper: "Use the daily average from your watch or activity app. This does not include ordinary standing time.",
  },
} as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function activityLevelFromDailyAverages(
  steps: number | null,
  minutes: number | null,
): number | null {
  const scores = [
    steps !== null ? clamp01(steps / 10_000) : null,
    minutes !== null ? clamp01(minutes / 45) : null,
  ].filter((score): score is number => score !== null);

  if (scores.length === 0) return null;
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100;
}

export function parseDailyActivity(value: string, maximum: number): number | null {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned || /^(not sure|unknown|skip)$/i.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
}
