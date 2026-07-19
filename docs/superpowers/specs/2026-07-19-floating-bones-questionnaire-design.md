# Floating Bones Questionnaire Background Design

## Goal

Extend the landing page's floating-bone visual identity through the conversational questionnaire without changing its content or interaction model.

## Visual Treatment

- Reuse the existing `FloatingBones` component and the exact same nine motif definitions.
- Preserve the existing opacity, color, animation, responsive visibility, and reduced-motion behavior.
- Mount the motif once behind the complete questionnaire screen.
- Keep the chat header, message viewport, progress display, answer controls, upload controls, and footer above the decorative layer.
- Use slightly translucent questionnaire surfaces where needed so the motifs remain visible while text contrast stays unchanged.

## Accessibility and Interaction

- Keep the layer `aria-hidden`, non-selectable, and pointer-events disabled.
- Do not place motifs in the document focus order.
- Do not change keyboard, scrolling, upload, answer, progress, or restart behavior.
- Continue disabling animation under `prefers-reduced-motion: reduce`.

## Scope

- Modify only the questionnaire screen composition and any component test needed to prove the reused motif contract.
- Do not change questions, answers, model features, scoring, APIs, results, or clinical copy.
- Add no dependency and perform no broad redesign.

## Verification and Deployment

- Add a failing structural assertion that the questionnaire mounts the shared motif.
- Run Vitest, TypeScript, lint, and production build.
- Rebase and push directly to shared `main` without force-pushing.
