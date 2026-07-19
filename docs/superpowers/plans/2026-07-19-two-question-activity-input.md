# Two-Question Activity Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the qualitative activity chip with exact seven-day average steps and active-minute questions supporting manual entry or screenshot autofill.

**Architecture:** A shared pure activity module owns exact question copy, validation bounds, and deterministic conversion to the model's existing 0–1 activity input. Both intake implementations and the screenshot API consume it; the primary chat keeps screenshot confirmation but replaces Low/Moderate/High editing with editable numeric values.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Vercel AI SDK, Vitest.

## Global Constraints

- Use the approved question and helper text verbatim.
- Allow manual entry or optional screenshot autofill.
- Permit either input to be skipped independently.
- Use deterministic arithmetic; the LLM may extract visible values but never choose the activity score.
- Keep the current trained coefficient and imputation default unchanged.
- Add no dependency and make no unrelated UI or clinical-model changes.
- Commit directly to shared `main` without force-pushing.

---

### Task 1: Create the shared activity-input contract

**Files:**
- Create: `src/lib/activity-input.ts`
- Create: `src/lib/activity-input.test.ts`
- Modify: `src/app/api/activity-extract/route.ts`

**Interfaces:**
- Produces: `ACTIVITY_QUESTIONS`, `activityLevelFromDailyAverages(steps, minutes): number | null`, and `parseDailyActivity(value, maximum): number | null`.
- Consumes: screenshot-extracted daily averages or manually entered daily averages.

- [ ] **Step 1: Write failing unit tests**

```ts
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
    expect(parseDailyActivity("Not sure", 100000)).toBeNull();
    expect(parseDailyActivity("-1", 1440)).toBeNull();
    expect(parseDailyActivity("1441", 1440)).toBeNull();
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/activity-input.test.ts`

Expected: FAIL because `activity-input.ts` does not exist.

- [ ] **Step 3: Implement the shared contract**

Export the exact approved copy and deterministic mapping. Normalize steps by `10_000`, minutes by `45`, clamp each to `0..1`, average available normalized values, and round to two decimals. Return `null` when neither exists. Validation bounds are `0..100_000` steps and `0..1_440` active minutes.

- [ ] **Step 4: Reuse the mapping in the screenshot route**

Delete the route-local mapping function, import `activityLevelFromDailyAverages`, and retain the existing extraction schema and visible-value-only prompt. Update error text to direct users to manual steps/minutes entry rather than qualitative levels.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- src/lib/activity-input.test.ts`

Expected: 3 tests pass.

---

### Task 2: Replace the primary chat activity step

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `ACTIVITY_QUESTIONS`, `activityLevelFromDailyAverages`, and `parseDailyActivity` from Task 1.
- Produces: `StepKey` members `averageDailySteps` and `averageDailyActiveMinutes`, two sequential questions, manual numeric answers, and screenshot confirmation capable of filling both.

- [ ] **Step 1: Replace qualitative step definitions**

Remove the `activity` key, `ACTIVITY_LEVEL_MAP`, and Low/Moderate/High example answer. Add two steps after weight using the exact shared question strings. Add both keys to `SKIPPABLE`; example values are `6500` and `30`.

- [ ] **Step 2: Map manual or confirmed values deterministically**

Parse the two answer strings. Confirmed screenshot values take precedence only after the user accepts them. Call `activityLevelFromDailyAverages`; use `tScoreModel.imputationDefaults.activityLevel` when it returns `null`. Add `weightBearingActivity` to `provided` only when at least one value is present.

- [ ] **Step 3: Update deterministic free-text validation**

For `averageDailySteps`, accept whole values from `0..100_000`. For `averageDailyActiveMinutes`, accept numeric values from `0..1_440`. Treat “not sure” as the existing skippable unknown path.

- [ ] **Step 4: Adapt screenshot confirmation**

Show the extracted steps/day and active minutes/day in numeric inputs. Replace qualitative-level editing with direct editing of those two values. “Use these” stores the confirmed result and advances beyond both activity questions; a missing extracted field remains unknown. “Skip” dismisses the screenshot proposal without silently accepting values, leaving the current manual question available.

- [ ] **Step 5: Show screenshot upload beside both questions**

Use an `isActivityStep` helper for both keys. Keep the image queue and analysis controls visible on either question, while retaining the normal numeric text input and independent skip control. Update copy to “Upload a weekly Apple Health, Watch, or activity-app summary.”

- [ ] **Step 6: Update result wording**

Display confirmed/manual steps and minutes and state: “Used as an approximate proxy for the daily wrist-movement measure in the training data.” Remove language claiming a qualitative activity level was chosen.

- [ ] **Step 7: Verify TypeScript and tests**

```bash
npx tsc --noEmit
npm test
```

Expected: PASS.

---

### Task 3: Keep the server-owned intake and documentation consistent

**Files:**
- Modify: `src/lib/intake-schema.ts`
- Modify: `README.md`
- Modify: `docs/INPUT_SPEC.md`

**Interfaces:**
- Consumes: shared activity question copy and mapping.
- Produces: intake schema fields `averageDailySteps` and `averageDailyActiveMinutes`; the same question order and deterministic score as the primary chat.

- [ ] **Step 1: Extend the intake schema**

Add `averageDailyActiveMinutes: z.number().min(0).max(1440).optional()`. Use the exact shared question/helper copy for both fields and allow each to be skipped.

- [ ] **Step 2: Use the shared mapping**

Replace `activityFromSteps` with `activityLevelFromDailyAverages(answers.averageDailySteps ?? null, answers.averageDailyActiveMinutes ?? null)`. Fall back to the published imputation default only when both are absent.

- [ ] **Step 3: Update documentation honestly**

Document the seven-day average inputs, screenshot option, deterministic `10,000 steps / 45 active minutes` normalization, and that they are practical proxies rather than equivalent to NHANES MIMS.

- [ ] **Step 4: Run full verification**

```bash
npm test
/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -m unittest model/test_triage_audit.py model/test_removed_family_history.py
npx tsc --noEmit
npm run lint
npm run build
```

Expected: tests, typecheck, and build pass; lint has no errors.

- [ ] **Step 5: Commit and deploy**

```bash
git add src/app/page.tsx src/app/api/activity-extract/route.ts src/lib/activity-input.ts src/lib/activity-input.test.ts src/lib/intake-schema.ts README.md docs/INPUT_SPEC.md docs/superpowers/plans/2026-07-19-two-question-activity-input.md
git commit -m "Ask for daily steps and active minutes"
git pull --rebase origin main
git push origin main
```

Expected: push succeeds and `origin/main` contains both exact questions and the shared deterministic mapping.
