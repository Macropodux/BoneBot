# Homepage Copy Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the final approved playful homepage wording and render the adaptive card with the numeral 4.

**Architecture:** Update only static landing-page copy in `page.tsx`. Extend the existing source-level copy regression test to lock all exact messages and the adaptive card stat without changing behavior or styling elsewhere.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest.

## Global Constraints

- Use `fracture`, never `fraction`.
- Preserve the approved wording exactly.
- Render the adaptive card's stat as numeral `4`, not the word `four`.
- Preserve the two-line headline and two-line supporting-message structure.
- Do not change questionnaire behavior, model logic, APIs, results, or styling.
- Commit directly to shared `main` without force-pushing.

---

### Task 1: Lock and apply final homepage copy

**Files:**
- Modify: `src/app/page-copy.test.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: static homepage JSX.
- Produces: exact approved headline, supporting message, menopause message, and adaptive-card stat/body.

- [ ] **Step 1: Extend the copy test first**

```ts
expect(page).toContain("Know your bone fracture risk");
expect(page).toContain("before you break something.");
expect(page).toContain("Three minutes. An NHANES-trained model does the maths.");
expect(page).toContain("AI turns the result into plain English.");
expect(page).toContain("Designed around bone changes after menopause.");
expect(page).toContain("A bone-health tool built with women in mind.");
expect(page).toContain('{ stat: "4", body: "quick written questions to start. We only ask more if your answers suggest a closer look." }');
expect(page).not.toContain("bone fraction risk");
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/page-copy.test.ts`

Expected: FAIL because the current approved-but-earlier copy is still present.

- [ ] **Step 3: Apply exact copy and deliberate line breaks**

Render:

```tsx
Know your bone fracture risk
<br />
before you break something.
```

Render the supporting copy as two block lines:

```tsx
<span className="block">Three minutes. An NHANES-trained model does the maths.</span>
<span className="block">AI turns the result into plain English.</span>
```

Replace the menopause message with `Designed around bone changes after menopause. A bone-health tool built with women in mind.` Set the adaptive card object to `{ stat: "4", body: "quick written questions to start. We only ask more if your answers suggest a closer look." }`.

- [ ] **Step 4: Verify and commit**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
git add src/app/page-copy.test.ts src/app/page.tsx docs/superpowers/plans/2026-07-19-homepage-copy-refinement.md
git commit -m "Refine playful homepage copy"
git pull --rebase origin main
git push origin main
```

Expected: tests and build pass; `origin/main` contains the exact copy and numeral `4`.
