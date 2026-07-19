# Floating Bones Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a playful, accessible floating-bone motif behind the BoneBot landing hero and deploy it to shared `main`.

**Architecture:** An isolated server-renderable `FloatingBones` component owns deterministic motif data and SVG rendering. The landing page mounts it as an `aria-hidden`, pointer-events-disabled background layer; CSS keyframes provide slow movement and stop under reduced-motion preferences.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, inline SVG, Vitest.

## Global Constraints

- Landing page only; do not alter questionnaire, results, APIs, model, or clinical copy.
- Use deterministic outlined vector motifs, not platform emoji.
- Keep motifs low-opacity, non-interactive, behind content, and clear of the central reading area.
- Respect `prefers-reduced-motion: reduce`.
- Add no dependency and perform no broad redesign.
- Commit directly to shared `main` without force-pushing.

---

### Task 1: Build and deploy the floating background

**Files:**
- Create: `src/app/FloatingBones.tsx`
- Create: `src/app/FloatingBones.test.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Produces: `FLOATING_BONES`, a readonly deterministic motif configuration, and default component `FloatingBones(): React.JSX.Element`.
- Consumes: no props and no client state; `page.tsx` mounts `<FloatingBones />` inside the landing container before the header.

- [ ] **Step 1: Write the failing configuration test**

```ts
import { describe, expect, it } from "vitest";
import { FLOATING_BONES } from "./FloatingBones";

describe("FloatingBones", () => {
  it("defines a deterministic, restrained landing-page motif", () => {
    expect(FLOATING_BONES).toHaveLength(9);
    expect(new Set(FLOATING_BONES.map((bone) => bone.id)).size).toBe(9);
    expect(FLOATING_BONES.every((bone) => bone.opacity <= 0.16)).toBe(true);
    expect(FLOATING_BONES.some((bone) => bone.tone === "coral")).toBe(true);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/FloatingBones.test.ts`

Expected: FAIL because `./FloatingBones` does not exist.

- [ ] **Step 3: Implement the isolated component**

Create nine deterministic motif objects containing `id`, edge-biased position, size, rotation, duration, delay, opacity, and `teal | coral` tone. Render each as an absolutely positioned wrapper containing a simple outlined bone SVG made from a rounded shaft and circular ends. Apply `aria-hidden="true"`, `pointer-events-none`, and `select-none` to the outer layer.

Include component-local CSS:

```css
@keyframes bone-float {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(var(--bone-rotation)); }
  50% { transform: translate3d(0, -12px, 0) rotate(calc(var(--bone-rotation) + 3deg)); }
}
@media (prefers-reduced-motion: reduce) {
  .floating-bone { animation: none !important; }
}
```

- [ ] **Step 4: Mount it on the landing page**

Import `FloatingBones` in `src/app/page.tsx` and insert `<FloatingBones />` immediately inside the `screen === "landing"` container, before the `z-10` header and main content.

- [ ] **Step 5: Verify GREEN and application integrity**

```bash
npm test -- src/app/FloatingBones.test.ts
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: tests, typecheck, and build pass; lint has no errors.

- [ ] **Step 6: Commit, rebase, and deploy**

```bash
git add src/app/FloatingBones.tsx src/app/FloatingBones.test.ts src/app/page.tsx docs/superpowers/plans/2026-07-19-floating-bones-background.md
git commit -m "Add floating bones landing background"
git pull --rebase origin main
git push origin main
```

Expected: push succeeds and `origin/main` contains the component and landing-page mount.
