# Floating Bones Background Design

## Goal

Make BoneBot's landing page more playful and memorable with floating bone motifs while preserving the credibility and readability of a health-screening product.

## Visual Direction

- Show decorative outlined bone shapes only on the landing page.
- Use a small set of deterministic positions, sizes, rotations, and animation delays so server and client rendering remain identical.
- Keep motifs behind all content at low opacity, using the established teal palette with a restrained coral accent.
- Prefer clean vector-like CSS/SVG shapes over platform-dependent emoji rendering.
- Keep the central headline, supporting copy, and primary action visually unobstructed.

## Motion and Accessibility

- Use slow, low-amplitude floating motion rather than attention-seeking bouncing.
- Mark every motif `aria-hidden` and make it non-interactive.
- Disable animation under `prefers-reduced-motion: reduce`.
- Maintain existing contrast and keyboard behavior.

## Scope

- Add one isolated decorative component and wire it into the existing landing-page background.
- Do not alter questionnaire, model, results, APIs, or clinical copy.
- Reuse the established typography and colors; add no dependency and perform no broad redesign.

## Verification and Deployment

- Add a focused component test or structural regression assertion before implementation.
- Run Vitest, TypeScript, lint, and the production build.
- Confirm the landing page renders the decorative layer without affecting interaction.
- Rebase onto shared `main`, push directly, and confirm `origin/main` contains the deployed change.
