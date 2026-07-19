# Ambiguous Intake Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ask one question-specific clarification for ambiguous intake answers, then continue with an explicitly disclosed neutral/default value if the person remains uncertain.

**Architecture:** Extend intake state with per-field uncertainty provenance while keeping the deterministic model inputs typed as they are today. The intake parser and UI map ambiguous free text to a clarification state; after one unsuccessful clarification, they record the field as unknown and pass its documented model default to scoring.

**Tech Stack:** Next.js 16, TypeScript, Zod, Vitest, existing deterministic intake and triage modules.

## Global Constraints

- No ambiguous answer may be silently treated as a confirmed “No.”
- Every ambiguity gets exactly one question-specific clarification before a default is applied.
- Unknown values use neutral/exported defaults, never a positive risk coefficient.
- Final result notes disclose every unknown/defaulted field.
- Do not alter trained model coefficients or the audited 2% triage threshold.
- Vitest is the single approved new dev dependency for deterministic intake-flow tests.

---

### Task 1: Add deterministic unknown-answer provenance

**Files:**
- Modify: `src/lib/intake-schema.ts`
- Create: `src/lib/intake-schema.test.ts`
- Modify: `package.json`

**Interfaces:**
- Adds `uncertainFields: (keyof IntakeAnswers)[]` to the intake state accepted by `nextIntakeStep`.
- Adds `unknownFieldNote(field: keyof IntakeAnswers): string` for result-note copy.

- [ ] **Step 1: Install Vitest and add a `test` script.**

```bash
npm install --save-dev vitest
```

- [ ] **Step 2: Write a failing test** that passes an uncertain `priorFragilityFracture` field after a clarification attempt and expects the next response to continue with an uncertainty note rather than a `false` answer.

```ts
expect(nextIntakeStep({
  age: 62,
  menopauseStatus: "yes",
  hasExistingBoneCare: false,
  priorFragilityFracture: undefined,
  uncertainFields: ["priorFragilityFracture"],
})).toMatchObject({ state: "full-assessment" });
```

- [ ] **Step 3: Run the focused test** with `npm test -- src/lib/intake-schema.test.ts` and confirm it fails because `uncertainFields` is unsupported.
- [ ] **Step 4: Implement the Zod schema, response state, and default mapping** so uncertainty remains distinct from the typed model value.
- [ ] **Step 5: Re-run the focused test** and confirm it passes.

### Task 2: Ask one tailored clarification before defaulting

**Files:**
- Modify: `src/lib/intake-schema.ts`
- Modify: `src/app/page.tsx`
- Test: `src/lib/intake-schema.test.ts`

**Interfaces:**
- Adds `clarificationAttempts: Partial<Record<keyof IntakeAnswers, 0 | 1>>`.
- Adds `clarificationQuestion(field: keyof IntakeAnswers): IntakeQuestion` for all supported field types.

- [ ] **Step 1: Write failing tests** for a possible fragility fracture and an ambiguous numeric answer; each must return a tailored clarification on its first ambiguity.
- [ ] **Step 2: Run the focused tests** and confirm both fail before implementation.
- [ ] **Step 3: Implement the shared one-clarification rule** in the server-owned state machine and map the client’s unparseable response to it.
- [ ] **Step 4: Re-run focused tests** and confirm they pass.

### Task 3: Disclose unknown/defaulted fields in the result

**Files:**
- Modify: `src/lib/intake-schema.ts`
- Modify: `src/app/page.tsx`
- Test: `src/lib/intake-schema.test.ts`

**Interfaces:**
- `IntakeResponse.notes` includes a user-readable note for every uncertain field whose default was used.

- [ ] **Step 1: Write a failing result test** that expects a note naming an uncertain possible fragility fracture and advising clinician discussion.
- [ ] **Step 2: Run the focused test** and confirm it fails before implementation.
- [ ] **Step 3: Add the result-note rendering** without altering the displayed T-score formula.
- [ ] **Step 4: Run focused tests, lint, and production build.**
- [ ] **Step 5: Commit the scoped implementation to `main`.**
