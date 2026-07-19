# Wiki Index

The catalog of all pages in this wiki. Each entry: a wikilink to the page and a one-line summary. The LLM reads this first when answering queries to identify candidate pages.

Keep summaries tight — one line each. The index is engineered to be cheap to read; a fat index defeats its purpose.

When this file exceeds ~300 lines or the wiki passes ~150 pages, shard into `wiki/indexes/<type>.md` and replace this file with a directory of shards. See the `scaling-playbook.md` reference in the `llm-wiki` skill for the migration procedure.

---

## Sources

- [[agents-md-rules]] — AGENTS.md: Hack-Nation team rules (secrets, LLM calls, git workflow, scope cuts, demo-first bias, no login wall).
- [[project-md-spec]] — PROJECT.md: Spec and execution plan mapping the MVP flow, 3-minute demo script, NHANES data spike, and team responsibilities.
- [[screen-md-spec]] — SCREEN.md: Front-end layouts, input OCR specs, target variables, output reporting, and ElevenLabs speech synthesis constraints.
- [[challenge-05-brief]] — Challenge 05 PDF: Official Hack-Nation guidelines, criteria (Impact, Tech, Foundation), recommended datasets, and deliverables.
- [[clinical-evidence-library]] — Local, versioned evidence cards and source register that constrain BoneBot's clinical explanations.
- [[ai-handover-md]] — AI_HANDOVER.md: the most current agreed architecture (front-gate + triage, 9 v1 model features, cheap-vs-capable LLM split, evidence-driven explanations). Supersedes SCREEN.md on architecture specifics.
- [[input-spec-md]] — docs/INPUT_SPEC.md: canonical units, required/optional status, and valid ranges for every BoneBot input.

## Entities

(populated as entity pages are created)

## Concepts

(populated as concept pages are created)

## Synthesis

(populated as query answers are filed back)
