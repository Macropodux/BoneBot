# Questionnaire Background and Copy Audit Design

## Goal

Extend the landing page's floating-bone visual identity through the conversational questionnaire and make every user-facing sentence on the landing and questionnaire screens clear, coherent, consistent, and appropriately supported.

## Visual Treatment

- Reuse the existing `FloatingBones` component and the exact same nine motif definitions.
- Preserve the existing opacity, color, animation, responsive visibility, and reduced-motion behavior.
- Mount the motif once behind the complete questionnaire screen.
- Keep the chat header, message viewport, progress display, answer controls, upload controls, and footer above the decorative layer.
- Use slightly translucent questionnaire surfaces where needed so the motifs remain visible while text contrast stays unchanged.

## Copy Audit

- Review the landing headline, supporting copy, buttons, badges, and all three fact cards.
- Review every questionnaire greeting, question, helper, transition, upload instruction, confirmation, validation message, fallback, progress label, and restart instruction.
- Correct grammar, unclear antecedents, inconsistent terminology, awkward phrasing, duplicated instructions, and text that does not match the available control.
- Use “screening estimate, not a diagnosis” consistently and never imply that BoneBot measures bone density or replaces DXA.
- Check factual/clinical claims against the repository evidence library and authoritative guidance; soften or remove claims that are stronger than their support.
- Preserve these approved questions verbatim:
  1. “Over the past 7 days, about how many steps did you average per day?”
  2. “Over the past 7 days, about how many active or exercise minutes did you average per day?”
- Keep activity language explicit that steps and active minutes are practical proxies, not equivalent to the MIMS measure used in training.
- Use these approved homepage messages verbatim:
  - Headline: **Know your bone fracture risk before you break something.** Render as two deliberate lines.
  - Supporting message: **Three minutes. An NHANES-trained model does the maths. AI turns the result into plain English.** Render as two deliberate lines.
  - Menopause message: **Designed around bone changes after menopause. A bone-health tool built with women in mind.**
- The adaptive card uses stat **4** and text **quick written questions to start. We only ask more if your answers suggest a closer look.**
- Do not broadly edit results-page copy. A narrow downstream label correction is allowed when required to keep a revised question faithful to the trained model.

## Accessibility and Interaction

- Keep the layer `aria-hidden`, non-selectable, and pointer-events disabled.
- Do not place motifs in the document focus order.
- Do not change keyboard, scrolling, upload, answer, progress, or restart behavior.
- Continue disabling animation under `prefers-reduced-motion: reduce`.

## Scope

- Modify only the questionnaire screen composition and any component test needed to prove the reused motif contract.
- Do not change answers, model features, scoring, or APIs.
- Copy edits may change landing/questionnaire wording but must not change routing or data semantics.
- Add no dependency and perform no broad redesign.

## Verification and Deployment

- Add a failing structural assertion that the questionnaire mounts the shared motif.
- Add focused assertions for critical approved copy and the absence of superseded or unsupported wording.
- Run Vitest, TypeScript, lint, and production build.
- Rebase and push directly to shared `main` without force-pushing.
