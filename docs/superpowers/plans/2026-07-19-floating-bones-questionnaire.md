# Questionnaire Background and Copy Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse the existing nine-bone animated background throughout the questionnaire and make landing/questionnaire copy coherent, precise, and evidence-aligned.

**Architecture:** The existing `FloatingBones` component remains the single motif implementation. A focused source-level copy regression test locks critical language and removes superseded claims. The chat screen becomes a positioned translucent composition and mounts a second component instance behind its header, scrolling messages, and answer controls.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Vitest.

## Global Constraints

- Use the exact same nine motifs, opacity, animation, colors, and mobile behavior as the landing page.
- Keep all questionnaire content and controls above the decorative layer.
- Preserve pointer, keyboard, scrolling, upload, progress, restart, and reduced-motion behavior.
- Preserve the two approved activity questions verbatim.
- Do not change answer semantics, model coefficients, routing, or APIs.
- Permit only one downstream factor-label correction needed to match the trained secondary-condition feature.
- Add no dependency and perform no broad redesign.
- Commit directly to shared `main` without force-pushing.

---

### Task 1: Lock and revise critical copy

**Files:**
- Create: `src/app/page-copy.test.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/lib/bone-model.ts`

**Interfaces:**
- Consumes: user-facing source copy and the existing trained secondary-condition semantics.
- Produces: coherent landing/questionnaire copy and a regression test that rejects superseded or misleading wording.

- [ ] **Step 1: Write the failing copy test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const model = readFileSync(new URL("../lib/bone-model.ts", import.meta.url), "utf8");

describe("landing and questionnaire copy", () => {
  it("uses clear landing language and removes superseded claims", () => {
    expect(page).toContain("Know when your bones may need a closer look");
    expect(page).not.toContain("Most bone-health research and tools were built around men");
    expect(page).not.toContain("How active are you day-to-day");
  });

  it("keeps the condition question faithful to the trained feature", () => {
    expect(page).not.toContain("coeliac disease");
    expect(model).toContain("Thyroid or chronic kidney disease");
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/page-copy.test.ts`

Expected: FAIL on the old landing claim and old secondary-condition wording.

- [ ] **Step 3: Revise landing copy exactly**

- Headline: `Know when your bones may need a closer look—before a fracture happens.`
- Supporting copy: `A three-minute conversational screen estimates your T-score using an NHANES-trained model. AI explains the result; it never sets or changes it.`
- Safety line: `Designed around bone changes after menopause. This is a screening estimate—not a diagnosis or a substitute for DXA.`
- CTA: `Try an example`.
- Cards:
  - `Often silent` / `Bone loss may cause no symptoms until a fracture occurs.`
  - `Model-led` / `A model trained on NHANES data produces the estimate. AI only explains it.`
  - `Adaptive` / `Four initial questions, with follow-ups only when a closer look may help. No account needed.`

- [ ] **Step 4: Revise questionnaire copy**

Use direct, consistent wording:
- `How old are you?`
- `Have you been diagnosed with osteoporosis, had a DXA bone-density scan, or taken medicine for your bones?`
- `Since age 50, have you broken a bone after a minor fall, bump, or similar low-impact injury?`
- `Have you taken corticosteroid tablets, such as prednisolone or prednisone, for three months or longer?`
- `If you have recent blood-test results, upload clear images now. Otherwise, choose Skip.`
- `What are your weight and height? BoneBot uses them to calculate your BMI.`
- `Have you been diagnosed with thyroid disease or chronic kidney disease?`

Change the associated factor label to `Thyroid or chronic kidney disease`. Replace “more precise result” with “fuller screening estimate,” and describe low triage as below the questionnaire threshold rather than as a recommendation.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- src/app/page-copy.test.ts`

Expected: PASS.

---

### Task 2: Reuse the background in the questionnaire

**Files:**
- Modify: `src/app/FloatingBones.test.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: default `FloatingBones()` component with its existing `aria-hidden` and non-interactive behavior.
- Produces: two mounts in `page.tsx`, one under the landing screen and one under the chat screen.

- [ ] **Step 1: Write the failing structural test**

```ts
import { readFileSync } from "node:fs";

it("mounts the shared motif on landing and questionnaire screens", () => {
  const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
  expect(page.match(/<FloatingBones \/>/g)).toHaveLength(2);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/FloatingBones.test.ts`

Expected: FAIL because `page.tsx` currently contains one mount.

- [ ] **Step 3: Mount the existing component behind chat**

Change the chat screen wrapper to `relative` with the established cream-to-pale-teal background, insert `<FloatingBones />` before the header, and give the header, message viewport, and answer footer `relative z-10` positioning. Use translucent white on header/footer and retain their borders.

- [ ] **Step 4: Verify GREEN and application integrity**

```bash
npm test -- src/app/FloatingBones.test.ts
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: tests, typecheck, and build pass; lint has no errors.

- [ ] **Step 5: Run full verification, commit, and deploy**

```bash
git add src/app/FloatingBones.test.ts src/app/page-copy.test.ts src/app/page.tsx src/lib/bone-model.ts docs/superpowers/specs/2026-07-19-floating-bones-questionnaire-design.md docs/superpowers/plans/2026-07-19-floating-bones-questionnaire.md
git commit -m "Polish questionnaire copy and background"
git pull --rebase origin main
git push origin main
```

Expected: push succeeds and `origin/main` contains two `FloatingBones` mounts.
