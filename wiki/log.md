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

## [2026-07-18] ingest | PROJECT.md — BoneWise Spec and Plan

Created `wiki/sources/project-md-spec.md`. Raw source cited in place at `PROJECT.md`. Source-only ingest.

## [2026-07-18] ingest | TASKBOARD.md — Execution Plan

Created `wiki/sources/taskboard-md-plan.md`. Raw source cited in place at `TASKBOARD.md`. Source-only ingest.

## [2026-07-18] ingest | RUNBOOK.md — Team Runbook

Created `wiki/sources/runbook-md-schedule.md`. Raw source cited in place at `RUNBOOK.md`. Source-only ingest.

## [2026-07-18] ingest | SCREEN.md — Product and Interface Spec

Created `wiki/sources/screen-md-spec.md`. Raw source cited in place at `SCREEN.md`. Source-only ingest.

## [2026-07-18] ingest | Challenge 05 PDF — Official Guidelines

Created `wiki/sources/challenge-05-brief.md`. Raw source PDF read from `challange/` subdirectory. Source-only ingest.
