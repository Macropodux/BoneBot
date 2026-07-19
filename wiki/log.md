# Wiki Log

Append-only chronological record of operations on the wiki. Each entry begins with `## [YYYY-MM-DD] <op> | <description>` so it's parseable with `grep "^## \[" log.md | tail -N`.

Operations:
- `ingest` — a source was processed into the wiki.
- `query` — a question was answered against the wiki (typically only logged when the answer was filed back as synthesis).
- `lint` — a health check was run.
- `schema` — the schema was modified.
- `shard` — an index was sharded.

---

## [2026-07-18] ingest | AGENTS.md — Hack-Nation Team Rules

Created `wiki/sources/agents-md-rules.md`. Raw source cited in place at
`AGENTS.md` (repo root), not copied into `raw/`, per SCHEMA.md's
raw-in-place rule. First-pass, source-only ingest — no entity/concept
extraction; page is an expected orphan pending a later ingest pass.

## [2026-07-18] ingest | PROJECT.md — BoneBot Spec and Plan

Created `wiki/sources/project-md-spec.md`. Raw source cited in place at `PROJECT.md`. Source-only ingest.

## [2026-07-18] ingest | TASKBOARD.md — Execution Plan

Created `wiki/sources/taskboard-md-plan.md`. Raw source cited in place at `TASKBOARD.md`. Source-only ingest.

## [2026-07-18] ingest | RUNBOOK.md — Team Runbook

Created `wiki/sources/runbook-md-schedule.md`. Raw source cited in place at `RUNBOOK.md`. Source-only ingest.

## [2026-07-18] ingest | SCREEN.md — Product and Interface Spec

Created `wiki/sources/screen-md-spec.md`. Raw source cited in place at `SCREEN.md`. Source-only ingest.

## [2026-07-18] ingest | Challenge 05 PDF — Official Guidelines

Created `wiki/sources/challenge-05-brief.md`. Raw source PDF read from `challange/` subdirectory. Source-only ingest.

## [2026-07-18] schema | Added the `evidence` tag

Added the `evidence` tag for vetted clinical and scientific material that
constrains BoneBot explanations.

## [2026-07-18] ingest | BoneBot Clinical Evidence Library

Created `wiki/sources/clinical-evidence-library.md`. Raw source cited in place at
`docs/EVIDENCE.md`; the runtime catalogue remains in `src/lib/bone-evidence.ts`.
This source records the evidence boundaries used to constrain LLM explanations,
including the evidence-only status of ALP and full-blood-count measures.

## [2026-07-19] ingest | AI_HANDOVER.md — Agent Handover

Created `wiki/sources/ai-handover-md.md`. Raw source cited in place at
`AI_HANDOVER.md`. The most current agreed architecture doc in the repo as of
this ingest — front-gate + triage model shape, the 9 agreed v1 model
features, cheap-vs-capable LLM tier split, evidence-driven explanation
rules. Source-only ingest.

## [2026-07-19] ingest | docs/INPUT_SPEC.md — Input Specification

Created `wiki/sources/input-spec-md.md`. Raw source cited in place at
`docs/INPUT_SPEC.md`. Canonical units/ranges/required-optional status for
every BoneBot input. Source-only ingest.

## [2026-07-19] refresh | SCREEN.md — Product and Interface Spec

Updated `wiki/sources/screen-md-spec.md` (surgical, not a full re-ingest):
added an update note flagging that `/assistant` no longer exists (the flow
moved to `/`), that photo/blood-test extraction (described as "not yet
built") is now built (`/api/blood-results`, `/api/document`), and that
`[[ai-handover-md]]` is now the more current architecture reference. The
output-card layout and category bands in the original ingest are still
accurate and were left as-is.
