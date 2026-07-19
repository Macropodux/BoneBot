# Remove Unsupported Family-History Input

## Goal

Remove the unsupported family-history input from the entire tracked repository and from the user's working notebook copy. The product must no longer ask for it, represent it in model data, score it, explain it, document it, or retain historical references to it.

## Scope

- Remove the intake question, example answer, skip handling, free-text normalization, displayed answer details, and extraction prompt support.
- Remove the feature from TypeScript model types, generated parameters, imputation defaults, contribution calculations, intake schemas, and evidence routing.
- Remove all related prose from product, benchmark, evidence, task, screen, wiki-source, and training-notebook documentation.
- Preserve unrelated clinical inputs and teammate changes.
- Replace the Desktop working notebook with the final repository notebook after making a timestamped backup.

## Data Flow After Removal

The intake proceeds directly from the preceding fracture-history question to the next remaining risk question. The feature vector no longer contains a family-history field. Model scoring and per-person uncertainty calculations operate only on trained or deliberately supported fields.

## Regression Protection

Add an automated repository scan covering tracked source, model, documentation, and notebook files. It must fail while any removed question text, display label, schema key, model key, or close terminology remains. This test is written and observed failing before production edits, then rerun after the purge.

## Verification

1. Regression scan reports no remaining references.
2. Existing Python tests pass.
3. TypeScript type-check passes.
4. ESLint reports no errors.
5. Production build completes.
6. Git diff contains only the intended purge, regression protection, specification/plan, and Desktop notebook update (the Desktop backup remains untracked by the repository).
7. After rebasing onto current `origin/main`, push the verified commit and confirm the remote branch contains it.

## Git and Local-File Safety

Do not force-push. Rebase normally if teammates advanced `main`, resolving only conflicts within this change's scope. Do not stage the existing handoff transcripts or Python cache. Back up the Desktop notebook before overwriting it.
