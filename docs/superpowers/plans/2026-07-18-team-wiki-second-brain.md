# Team Wiki (Second Brain) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a queryable, citation-backed `llm-wiki` knowledge base from the project's six operating docs, committed to `main` and self-announcing via `AGENTS.md`, so every teammate's agent is grounded on the same rules/spec without re-reading six files each session.

**Architecture:** Standard `llm-wiki` layout (`wiki/` + `raw/` at repo root). Five `.md` docs are cited in place (not copied into `raw/`); only the challenge PDF — which has no text form elsewhere — gets copied into `raw/`. Source-only ingest pass: six `wiki/sources/` pages, no entity/concept extraction, no graph layer. `AGENTS.md` gets a short pointer stanza so the wiki is discoverable without being re-explained.

**Tech Stack:** `llm-wiki` plugin skill (v0.3.0) — `llm-wiki:wiki:init`, `llm-wiki:wiki:ingest`, `llm-wiki:wiki:lint` skills; bundled Python 3 scripts (`init_wiki.py`, `wiki_lint.py`, `wiki_stats.py`) at
`C:\Users\Francesco\.claude\plugins\cache\llm-wiki\llm-wiki\0.3.0\skills\llm-wiki\scripts\`; git (commit straight to `main`, no branches).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-18-team-wiki-second-brain-design.md`. Follow it; this plan implements it exactly.
- Wiki lives at `wiki/` + `raw/` at the project root, committed to `main` — no branches, per `AGENTS.md`'s git rules.
- **Raw sources cited in place.** `AGENTS.md`, `PROJECT.md`, `TASKBOARD.md`, `RUNBOOK.md`, `SCREEN.md` are NOT copied into `raw/`. Their source pages' `raw:` frontmatter points directly at the repo-relative path (e.g. `raw: "AGENTS.md"`). Only the challenge PDF is copied into `raw/`, since it has no text form elsewhere in the repo.
- **Ingest scope is exactly 6 sources**, no more: `AGENTS.md`, `PROJECT.md`, `TASKBOARD.md`, `RUNBOOK.md`, `SCREEN.md`, and the challenge PDF (`challange/1784383032781-05-Hack-Nation-Foundations-Model-for-Womens-Hormonal-Health.docx.pdf`). Do not ingest `RESEARCH.md`, `MOTIVATION.md`, `BUSINESS.md`, or `PLAYBOOK.md` — out of scope per the design.
- **Source-only pass, no entity/concept pages, no cross-linking, no graph layer.** `wiki_lint.py` will report each of the six source pages as an orphan (no inbound links) — that is expected for this pass, not a bug. Do not create entity/concept pages just to silence the warning.
- This is dev/team tooling only. Do not touch `src/`, `supabase/`, or any product file. Stay additive: new files under `wiki/` and `raw/`, one new section appended to `AGENTS.md`.
- Commit small and often, per `AGENTS.md` — one commit per task below, not one giant commit at the end.
- `wiki_lint.py` invocation used throughout:
  `python "C:\Users\Francesco\.claude\plugins\cache\llm-wiki\llm-wiki\0.3.0\skills\llm-wiki\scripts\wiki_lint.py" wiki/`

---

### Task 1: Bootstrap the wiki structure + SCHEMA.md customization + place the PDF

**Files:**
- Create (via `llm-wiki:wiki:init`): `wiki/SCHEMA.md`, `wiki/index.md`, `wiki/log.md`, `wiki/.page-template.md`, `wiki/graph/ontology.yaml`, `wiki/graph/README.md`, `wiki/graph/.gitignore`, `wiki/sources/`, `wiki/entities/`, `wiki/concepts/`, `wiki/synthesis/`, `raw/`, `raw/assets/`
- Create: `raw/hacknation-challenge-05-womens-hormonal-health-brief.pdf` (copy of `challange/1784383032781-05-Hack-Nation-Foundations-Model-for-Womens-Hormonal-Health.docx.pdf`)
- Modify: `wiki/SCHEMA.md` — "Tag taxonomy" and "Workflow customizations" sections

**Interfaces:**
- Produces: the tag taxonomy (`rules`, `spec`, `schedule`, `bonebot`, `hackathon`, `challenge-brief`) and the two SCHEMA.md customizations that Tasks 2–7 depend on (raw-in-place citation rule; source-only-pass rule).

- [ ] **Step 1: Run the wiki bootstrap**

Invoke the skill:
```
Skill(skill: "llm-wiki:wiki:init")
```
When it asks where the wiki should live, confirm the defaults (`wiki/`, `raw/`). When it asks about agent-memory integration, answer: target `AGENTS.md` (this is a multi-agent repo — four teammates, each running their own agent) — but tell it to hold off appending the stanza now; that happens in Task 8 of this plan, after all six sources exist, so the stanza can name them. Decline customizing `wiki/graph/ontology.yaml` — the graph layer is unused this pass.

- [ ] **Step 2: Verify the structure**

Run: `ls wiki wiki/sources wiki/entities wiki/concepts wiki/synthesis wiki/graph raw raw/assets`
Expected: all eight directories exist and list without error; `wiki/SCHEMA.md`, `wiki/index.md`, `wiki/log.md` are present.

- [ ] **Step 3: Copy the challenge PDF into `raw/`**

```bash
cp "challange/1784383032781-05-Hack-Nation-Foundations-Model-for-Womens-Hormonal-Health.docx.pdf" "raw/hacknation-challenge-05-womens-hormonal-health-brief.pdf"
```
Expected: `raw/hacknation-challenge-05-womens-hormonal-health-brief.pdf` exists (5 pages, confirmed via `pdftotext` during design research).

- [ ] **Step 4: Customize `wiki/SCHEMA.md`**

In the `## Tag taxonomy` section, replace the placeholder example list with:

```markdown
- `rules` — governance and process rules for the hackathon team.
- `spec` — product/technical specification content.
- `schedule` — timeline, milestones, deadlines.
- `bonebot` — content specific to the BoneBot product build.
- `hackathon` — content about the Hack-Nation event/team, not the product itself.
- `challenge-brief` — the original challenge brief material.
```

In the `## Workflow customizations` section, replace the empty placeholder with:

```markdown
- **Raw sources cited in place.** The project's core operating docs
  (`AGENTS.md`, `PROJECT.md`, `TASKBOARD.md`, `RUNBOOK.md`, `SCREEN.md`) are
  NOT copied into `raw/` — they're already canonical, single-owner files at
  the repo root. Their source pages' `raw:` frontmatter points directly at
  the repo-relative path (e.g. `raw: "AGENTS.md"`), not a `raw/` copy. Only
  sources with no text form elsewhere (e.g. the challenge PDF) get copied
  into `raw/`.
- **Source-only ingest, first pass.** The first 6 ingests (the 5 docs above
  + the challenge PDF) create `wiki/sources/` pages only — no entity or
  concept page extraction, no cross-linking between source pages.
  `wiki_lint.py` will report each of these as an orphan (no inbound links);
  that's expected until a later ingest pass extracts entities/concepts that
  link back to them. Do not manufacture entity/concept pages just to
  silence the orphan warning.
```

- [ ] **Step 5: Commit**

```bash
git add wiki raw
git commit -m "Bootstrap llm-wiki structure, scope raw-in-place + source-only convention"
```

---

### Task 2: Ingest `AGENTS.md`

**Files:**
- Create: `wiki/sources/agents-md-rules.md`
- Modify: `wiki/index.md`, `wiki/log.md`

**Interfaces:**
- Consumes: SCHEMA.md customizations from Task 1 (raw-in-place rule, source-only-pass rule, tag taxonomy).
- Produces: source page slug `agents-md-rules` — later tasks/queries cite it as `[[agents-md-rules]]`.

- [ ] **Step 1: Ingest**

Invoke:
```
Skill(skill: "llm-wiki:wiki:ingest", args: "AGENTS.md")
```
Per the SCHEMA.md customization, confirm the source is already correctly placed (no copy into `raw/` — cite in place). Give a brief 2–3 sentence takeaway summary instead of pausing for interactive back-and-forth (this is a scoped, pre-approved batch ingest, not exploratory research). Skip entity/concept extraction (Global Constraints).

Frontmatter for the new page:
```yaml
type: source
title: "AGENTS.md — Hack-Nation Team Rules"
raw: "AGENTS.md"
ingested: 2026-07-18
tags: [rules, hackathon]
created: 2026-07-18
updated: 2026-07-18
```

- [ ] **Step 2: Verify**

Run: `cat wiki/sources/agents-md-rules.md | head -10`
Expected: frontmatter matches Step 1 exactly.

Run: `grep -c "agents-md-rules" wiki/index.md wiki/log.md`
Expected: at least 1 match in each file (an index entry under `## Sources`, and a `## [2026-07-18] ingest | AGENTS.md — Hack-Nation Team Rules` line in the log).

- [ ] **Step 3: Lint**

Run: `python "C:\Users\Francesco\.claude\plugins\cache\llm-wiki\llm-wiki\0.3.0\skills\llm-wiki\scripts\wiki_lint.py" wiki/`
Expected: 1 orphan (`agents-md-rules` — expected per Global Constraints), 0 broken links, 0 oversized pages, 0 missing/malformed frontmatter, 0 duplicate slugs, 0 stale pages.

- [ ] **Step 4: Commit**

```bash
git add wiki
git commit -m "Ingest AGENTS.md into wiki"
```

---

### Task 3: Ingest `PROJECT.md`

**Files:**
- Create: `wiki/sources/project-md-spec.md`
- Modify: `wiki/index.md`, `wiki/log.md`

**Interfaces:**
- Consumes: SCHEMA.md customizations from Task 1.
- Produces: source page slug `project-md-spec`.

- [ ] **Step 1: Ingest**

Invoke:
```
Skill(skill: "llm-wiki:wiki:ingest", args: "PROJECT.md")
```
Same handling as Task 2, Step 1 (cite in place, brief takeaway summary, skip entity/concept extraction).

Frontmatter:
```yaml
type: source
title: "PROJECT.md — BoneBot Product Spec"
raw: "PROJECT.md"
ingested: 2026-07-18
tags: [spec, bonebot]
created: 2026-07-18
updated: 2026-07-18
```

- [ ] **Step 2: Verify**

Run: `cat wiki/sources/project-md-spec.md | head -10`
Expected: frontmatter matches Step 1 exactly.

Run: `grep -c "project-md-spec" wiki/index.md wiki/log.md`
Expected: at least 1 match in each file.

- [ ] **Step 3: Lint**

Run: `python "C:\Users\Francesco\.claude\plugins\cache\llm-wiki\llm-wiki\0.3.0\skills\llm-wiki\scripts\wiki_lint.py" wiki/`
Expected: 2 orphans total (`agents-md-rules`, `project-md-spec`), 0 broken links, 0 oversized pages, 0 missing/malformed frontmatter, 0 duplicate slugs, 0 stale pages.

- [ ] **Step 4: Commit**

```bash
git add wiki
git commit -m "Ingest PROJECT.md into wiki"
```

---

### Task 4: Ingest `TASKBOARD.md`

**Files:**
- Create: `wiki/sources/taskboard-md-plan.md`
- Modify: `wiki/index.md`, `wiki/log.md`

**Interfaces:**
- Consumes: SCHEMA.md customizations from Task 1.
- Produces: source page slug `taskboard-md-plan`.

- [ ] **Step 1: Ingest**

Invoke:
```
Skill(skill: "llm-wiki:wiki:ingest", args: "TASKBOARD.md")
```
Same handling as Task 2, Step 1.

Frontmatter:
```yaml
type: source
title: "TASKBOARD.md — 24-Hour Execution Plan"
raw: "TASKBOARD.md"
ingested: 2026-07-18
tags: [schedule, bonebot]
created: 2026-07-18
updated: 2026-07-18
```

- [ ] **Step 2: Verify**

Run: `cat wiki/sources/taskboard-md-plan.md | head -10`
Expected: frontmatter matches Step 1 exactly.

Run: `grep -c "taskboard-md-plan" wiki/index.md wiki/log.md`
Expected: at least 1 match in each file.

- [ ] **Step 3: Lint**

Run: `python "C:\Users\Francesco\.claude\plugins\cache\llm-wiki\llm-wiki\0.3.0\skills\llm-wiki\scripts\wiki_lint.py" wiki/`
Expected: 3 orphans total, 0 broken links, 0 oversized pages, 0 missing/malformed frontmatter, 0 duplicate slugs, 0 stale pages.

- [ ] **Step 4: Commit**

```bash
git add wiki
git commit -m "Ingest TASKBOARD.md into wiki"
```

---

### Task 5: Ingest `RUNBOOK.md`

**Files:**
- Create: `wiki/sources/runbook-md-schedule.md`
- Modify: `wiki/index.md`, `wiki/log.md`

**Interfaces:**
- Consumes: SCHEMA.md customizations from Task 1.
- Produces: source page slug `runbook-md-schedule`.

- [ ] **Step 1: Ingest**

Invoke:
```
Skill(skill: "llm-wiki:wiki:ingest", args: "RUNBOOK.md")
```
Same handling as Task 2, Step 1.

Frontmatter:
```yaml
type: source
title: "RUNBOOK.md — Team Runbook"
raw: "RUNBOOK.md"
ingested: 2026-07-18
tags: [schedule, hackathon]
created: 2026-07-18
updated: 2026-07-18
```

- [ ] **Step 2: Verify**

Run: `cat wiki/sources/runbook-md-schedule.md | head -10`
Expected: frontmatter matches Step 1 exactly.

Run: `grep -c "runbook-md-schedule" wiki/index.md wiki/log.md`
Expected: at least 1 match in each file.

- [ ] **Step 3: Lint**

Run: `python "C:\Users\Francesco\.claude\plugins\cache\llm-wiki\llm-wiki\0.3.0\skills\llm-wiki\scripts\wiki_lint.py" wiki/`
Expected: 4 orphans total, 0 broken links, 0 oversized pages, 0 missing/malformed frontmatter, 0 duplicate slugs, 0 stale pages.

- [ ] **Step 4: Commit**

```bash
git add wiki
git commit -m "Ingest RUNBOOK.md into wiki"
```

---

### Task 6: Ingest `SCREEN.md`

**Files:**
- Create: `wiki/sources/screen-md-spec.md`
- Modify: `wiki/index.md`, `wiki/log.md`

**Interfaces:**
- Consumes: SCHEMA.md customizations from Task 1.
- Produces: source page slug `screen-md-spec`.

- [ ] **Step 1: Ingest**

Invoke:
```
Skill(skill: "llm-wiki:wiki:ingest", args: "SCREEN.md")
```
Same handling as Task 2, Step 1.

Frontmatter:
```yaml
type: source
title: "SCREEN.md — Product Input/Output Spec"
raw: "SCREEN.md"
ingested: 2026-07-18
tags: [spec, bonebot]
created: 2026-07-18
updated: 2026-07-18
```

- [ ] **Step 2: Verify**

Run: `cat wiki/sources/screen-md-spec.md | head -10`
Expected: frontmatter matches Step 1 exactly.

Run: `grep -c "screen-md-spec" wiki/index.md wiki/log.md`
Expected: at least 1 match in each file.

- [ ] **Step 3: Lint**

Run: `python "C:\Users\Francesco\.claude\plugins\cache\llm-wiki\llm-wiki\0.3.0\skills\llm-wiki\scripts\wiki_lint.py" wiki/`
Expected: 5 orphans total, 0 broken links, 0 oversized pages, 0 missing/malformed frontmatter, 0 duplicate slugs, 0 stale pages.

- [ ] **Step 4: Commit**

```bash
git add wiki
git commit -m "Ingest SCREEN.md into wiki"
```

---

### Task 7: Ingest the challenge PDF

**Files:**
- Create: `wiki/sources/hacknation-challenge-05-brief.md`
- Modify: `wiki/index.md`, `wiki/log.md`

**Interfaces:**
- Consumes: SCHEMA.md customizations from Task 1; `raw/hacknation-challenge-05-womens-hormonal-health-brief.pdf` from Task 1, Step 3.
- Produces: source page slug `hacknation-challenge-05-brief`.

- [ ] **Step 1: Ingest**

Invoke:
```
Skill(skill: "llm-wiki:wiki:ingest", args: "raw/hacknation-challenge-05-womens-hormonal-health-brief.pdf")
```
The PDF is 5 pages and text-based (confirmed extractable via `pdftotext -layout` during design research) — read it directly or via `pdftotext -layout raw/hacknation-challenge-05-womens-hormonal-health-brief.pdf -` if the PDF-reading path is unavailable in the execution environment. Give a brief 2–3 sentence takeaway summary. Skip entity/concept extraction.

Frontmatter:
```yaml
type: source
title: "Hack-Nation Challenge 05 — Women's Hormonal Health Brief"
raw: "raw/hacknation-challenge-05-womens-hormonal-health-brief.pdf"
ingested: 2026-07-18
tags: [challenge-brief, hackathon]
created: 2026-07-18
updated: 2026-07-18
```

- [ ] **Step 2: Verify**

Run: `cat wiki/sources/hacknation-challenge-05-brief.md | head -10`
Expected: frontmatter matches Step 1 exactly.

Run: `grep -c "hacknation-challenge-05-brief" wiki/index.md wiki/log.md`
Expected: at least 1 match in each file.

- [ ] **Step 3: Lint**

Run: `python "C:\Users\Francesco\.claude\plugins\cache\llm-wiki\llm-wiki\0.3.0\skills\llm-wiki\scripts\wiki_lint.py" wiki/`
Expected: 6 orphans total, 0 broken links, 0 oversized pages, 0 missing/malformed frontmatter, 0 duplicate slugs, 0 stale pages.

- [ ] **Step 4: Commit**

```bash
git add wiki
git commit -m "Ingest challenge brief PDF into wiki"
```

---

### Task 8: Wire the `AGENTS.md` pointer stanza

**Files:**
- Modify: `AGENTS.md` (append new section at end of file)

**Interfaces:**
- Consumes: the six source slugs produced by Tasks 2–7 (named explicitly in the stanza).
- Produces: nothing consumed by later tasks — this is the terminal "make it discoverable" step.

- [ ] **Step 1: Append the stanza**

Using the Edit tool, append after the existing `## See also` section at the end of `AGENTS.md`:

```markdown

## LLM Wiki

This project has an LLM-curated wiki at `wiki/`, compiled from `AGENTS.md`,
`PROJECT.md`, `TASKBOARD.md`, `RUNBOOK.md`, `SCREEN.md`, and the Hack-Nation
Challenge 05 brief. Read `wiki/index.md` before re-reading those raw docs.
Full conventions in `wiki/SCHEMA.md`. Ingest and query workflows live in the
`llm-wiki` skill.
```

- [ ] **Step 2: Verify**

Run: `tail -10 AGENTS.md`
Expected: the new `## LLM Wiki` section is the last thing in the file, exactly as written in Step 1.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "Point AGENTS.md at the new team wiki"
```

---

### Task 9: Final verification

**Files:** none created or modified — this task only verifies Tasks 1–8.

**Interfaces:**
- Consumes: everything produced by Tasks 1–8.

- [ ] **Step 1: Full structural lint**

Run: `python "C:\Users\Francesco\.claude\plugins\cache\llm-wiki\llm-wiki\0.3.0\skills\llm-wiki\scripts\wiki_lint.py" wiki/`
Expected: exactly 6 orphans (`agents-md-rules`, `project-md-spec`, `taskboard-md-plan`, `runbook-md-schedule`, `screen-md-spec`, `hacknation-challenge-05-brief` — all expected per Global Constraints), 0 broken links, 0 oversized pages (hard or soft cap), 0 missing/malformed frontmatter, 0 duplicate slugs, 0 stale pages.

- [ ] **Step 2: Stats sanity check**

Run: `python "C:\Users\Francesco\.claude\plugins\cache\llm-wiki\llm-wiki\0.3.0\skills\llm-wiki\scripts\wiki_stats.py" wiki/`
Expected: 6 total pages, all `type: source`, well under the ~150-page / 300-line sharding threshold (no sharding needed).

- [ ] **Step 3: Query smoke test**

Ask (in the current session, using the `llm-wiki:wiki:query` skill or the query workflow directly): *"According to the wiki, what happens at 10:00 Sunday and what's the submission deadline?"*
Expected: the answer is derivable by reading `wiki/index.md` then `wiki/sources/runbook-md-schedule.md` and/or `wiki/sources/taskboard-md-plan.md` — cited with `[[wikilinks]]` — without opening `RUNBOOK.md` or `TASKBOARD.md` directly. This confirms the wiki actually serves its purpose (grounding a query without re-reading the raw docs).

- [ ] **Step 4: Working tree clean**

Run: `git status`
Expected: `nothing to commit, working tree clean` — everything from Tasks 1–8 is committed to `main`.

- [ ] **Step 5: Report**

Tell the user: wiki bootstrapped at `wiki/` + `raw/`, 6 sources ingested (list them), `AGENTS.md` now points at it, everything committed to `main` — ready for teammates to `git pull` and have their own agent sessions pick it up automatically.
