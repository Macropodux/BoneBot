# Unsupported Family-History Input Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the unsupported family-history input and every related reference from tracked repository content, then synchronize the user's Desktop notebook.

**Architecture:** A tracked-file regression test defines the forbidden-reference boundary. Production changes then remove the field from both intake implementations, the deterministic scorer, generated model parameters, extraction/ambiguity helpers, evidence routing, and documentation; the training notebook remains the canonical local notebook.

**Tech Stack:** Next.js 16, TypeScript, React, Zod, Vitest, Python `unittest`, Jupyter notebook JSON, Git.

## Global Constraints

- Remove every related mention, including historical documentation.
- Preserve unrelated teammate work and all remaining clinical inputs.
- Add no dependency and perform no unrelated refactor.
- Do not stage the existing handoff transcripts or `model/__pycache__/`.
- Do not force-push.
- Back up the Desktop notebook before overwriting it.

---

### Task 1: Establish the repository-wide regression boundary

**Files:**
- Create: `model/test_removed_family_history.py`

**Interfaces:**
- Consumes: `git ls-files` output rooted at the repository.
- Produces: a `unittest` that rejects the removed camel-case key, user-facing wording, factor label, and evidence slug without storing those strings literally in the test itself.

- [ ] **Step 1: Write the failing test**

```python
import base64
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
BANNED = tuple(
    base64.b64decode(value).decode("utf-8")
    for value in (
        "cGFyZW50YWxIaXBGcmFjdHVyZQ==",
        "cGFyZW50YWwgaGlwIGZyYWN0dXJl",
        "cGFyZW50YWwtaGlwLWZyYWN0dXJl",
        "cGFyZW50cyBldmVyIGZyYWN0dXJlIGEgaGlw",
        "cGFyZW50cyBoYWQgYSBoaXAgZnJhY3R1cmU=",
        "cGFyZW50IGJyb2tlIGEgaGlw",
    )
)
SKIP = {pathlib.Path(__file__).relative_to(ROOT).as_posix()}


class RemovedFamilyHistoryTest(unittest.TestCase):
    def test_tracked_repository_has_no_removed_references(self):
        tracked = subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True).splitlines()
        matches = []
        for relative in tracked:
            if relative in SKIP:
                continue
            path = ROOT / relative
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8", errors="ignore").lower()
            for term in BANNED:
                if term.lower() in text:
                    matches.append(f"{relative}: {term}")
        self.assertEqual([], matches, "Removed references remain:\n" + "\n".join(matches))
```

- [ ] **Step 2: Run test to verify RED**

Run: `/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -m unittest model/test_removed_family_history.py`

Expected: FAIL listing current source, model, notebook, and documentation references.

- [ ] **Step 3: Commit the failing regression test**

```bash
git add model/test_removed_family_history.py
git commit -m "Test removal of unsupported family-history input"
```

---

### Task 2: Remove the field from runtime model and intake code

**Files:**
- Modify: `src/lib/bone-model.ts`
- Modify: `src/lib/intake-schema.ts`
- Modify: `src/lib/ambiguity.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/api/extract/route.ts`
- Modify: `model/model-parameters.ts`

**Interfaces:**
- Consumes: existing `BoneFeatures`, `StepKey`, `IntakeAnswersSchema`, `scoreBone`, and generated parameter objects.
- Produces: the same public interfaces minus the unsupported field; questionnaire progression skips directly to smoking after prior fracture history.

- [ ] **Step 1: Remove the runtime model property**

Delete the unsupported property from `BoneFeatures`, the corresponding scoring term, coefficient, imputation default, and any interval variance. Do not alter any remaining numeric parameter.

- [ ] **Step 2: Remove it from the conversational page flow**

Delete its `StepKey` member, `STEPS` entry, example answer, `SKIPPABLE` entry, feature mapping/default, provided-feature handling, factor-detail case, and free-text normalizer branch. Keep the order and behavior of every remaining step unchanged.

- [ ] **Step 3: Remove it from the server-owned intake flow**

Delete the Zod property, full-assessment question, required-feature label, and `toBoneFeatures` assignment in `src/lib/intake-schema.ts`.

- [ ] **Step 4: Remove helper and extraction support**

Delete its ambiguity prompt/label entries from `src/lib/ambiguity.ts` and its extraction allowlist entry from `src/app/api/extract/route.ts`.

- [ ] **Step 5: Run focused type verification**

Run: `npx tsc --noEmit`

Expected: PASS with no references to a missing property.

---

### Task 3: Remove evidence, notebook, and documentation references

**Files:**
- Modify: `src/lib/bone-evidence.ts`
- Modify: `model/train_bonebot.ipynb`
- Modify: `README.md`
- Modify: `TASKBOARD.md`
- Modify: `SCREEN.md`
- Modify: `MOTIVATION.md`
- Modify: `wiki/sources/project-md-spec.md`
- Modify: `wiki/sources/ai-handover-md.md`
- Modify: any additional tracked file reported by Task 1

**Interfaces:**
- Consumes: Task 1's tracked-file scan.
- Produces: repository content with no removed evidence card, routing map, prose, notebook export note, or historical comparison reference.

- [ ] **Step 1: Remove evidence-library support**

Delete the evidence topic union member, complete evidence-card object, factor-to-card mapping, and question-routing expression for the removed input. Preserve its cited sources if another evidence card uses them; otherwise delete only now-orphaned source entries.

- [ ] **Step 2: Remove the notebook export reference**

Edit the notebook JSON source cell to remove the obsolete export reminder. Do not rerun or alter model coefficients because the field already had coefficient zero and was absent from training.

- [ ] **Step 3: Remove all prose references**

Rewrite affected sentences and table rows so they remain grammatical while omitting the removed input entirely. This includes comparative/background material as explicitly requested.

- [ ] **Step 4: Run the regression scan to verify GREEN**

Run: `/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -m unittest model/test_removed_family_history.py`

Expected: PASS.

- [ ] **Step 5: Search for semantic leftovers**

Run the tracked-file regression test again after reviewing the complete diff.

Expected: no output related to the removed input.

---

### Task 4: Verify the application and synchronize local notebook

**Files:**
- Modify: `/Users/macbook/Desktop/CV, Transcripts & Documents/Emreapplications/Hack-Nation.ipynb`
- Create: timestamped Desktop backup beside that notebook

**Interfaces:**
- Consumes: verified `model/train_bonebot.ipynb`.
- Produces: byte-identical Desktop working copy and a retained pre-change backup.

- [ ] **Step 1: Run all repository verification**

```bash
/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -m unittest model/test_triage_audit.py model/test_removed_family_history.py
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all tests and build pass; lint has no errors.

- [ ] **Step 2: Back up and replace the Desktop notebook**

```bash
cp "/Users/macbook/Desktop/CV, Transcripts & Documents/Emreapplications/Hack-Nation.ipynb" "/Users/macbook/Desktop/CV, Transcripts & Documents/Emreapplications/Hack-Nation.before-family-history-removal.ipynb"
cp model/train_bonebot.ipynb "/Users/macbook/Desktop/CV, Transcripts & Documents/Emreapplications/Hack-Nation.ipynb"
```

- [ ] **Step 3: Verify notebook identity**

Run: `cmp model/train_bonebot.ipynb "/Users/macbook/Desktop/CV, Transcripts & Documents/Emreapplications/Hack-Nation.ipynb"`

Expected: exit 0 with no output.

- [ ] **Step 4: Commit only intended repository changes**

```bash
git add src model README.md TASKBOARD.md SCREEN.md MOTIVATION.md wiki docs/superpowers/plans/2026-07-19-remove-unsupported-family-history-input.md
git status --short
git commit -m "Remove unsupported family-history input"
```

Expected: handoff transcripts, Python cache, and Desktop backup are not staged.

- [ ] **Step 5: Rebase, reverify, and push**

```bash
git pull --rebase origin main
/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -m unittest model/test_triage_audit.py model/test_removed_family_history.py
npm test
npx tsc --noEmit
npm run build
git push origin main
```

Expected: push succeeds without force; `main` and `origin/main` point to the final verified commit.
