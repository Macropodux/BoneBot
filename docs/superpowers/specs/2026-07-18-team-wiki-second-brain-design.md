# Team wiki ("second brain") — design

**Date:** 2026-07-18
**Status:** approved
**Scope:** dev/team tooling only — no product code, no build/runtime impact on the BoneBot app.

## Problem

Four people run their own agents against this repo. `AGENTS.md` is the only file
keeping those agents consistent, but the operating context is spread across six
files (`AGENTS.md`, `PROJECT.md`, `TASKBOARD.md`, `RUNBOOK.md`, `SCREEN.md`, and
the challenge PDF in `challange/`). Anyone starting a fresh agent session has to
re-read all of them to get grounded, and there's no shared, queryable place that
compiles them.

## Goal

A queryable, citation-backed knowledge base ("wiki") built from the existing
operating docs, shared via the same git workflow the team already uses
(commit straight to `main`, no branches), so every teammate's agent — including
ones that haven't seen this conversation — knows it exists and can consult it.

## Architecture

- Standard `llm-wiki` layout at the project root: `wiki/` (LLM-owned pages) and
  `raw/` (source material).
- `raw/` holds only the challenge PDF (`challange/*.docx.pdf`) — the one source
  that has no text form elsewhere in the repo.
- The five `.md` docs (`AGENTS.md`, `PROJECT.md`, `TASKBOARD.md`, `RUNBOOK.md`,
  `SCREEN.md`) are **not** copied into `raw/`. They stay canonical at repo root;
  wiki source pages cite them in place. Rationale: they're already
  single-owner, actively-edited files — duplicating them creates a second copy
  that goes stale the moment someone edits the original.
- No graph layer (`wiki/graph/`) for this pass — six static sources don't need
  typed entity relationships, and it's optional per the skill.

## Ingest scope (6 sources → 6 `wiki/sources/` pages)

1. `AGENTS.md` — the rules
2. `PROJECT.md` — the product spec
3. `TASKBOARD.md` — who/when
4. `RUNBOOK.md` — schedule & non-negotiables
5. `SCREEN.md` — exact product input/output spec
6. Challenge PDF (`challange/1784383032781-...pdf`) — the original brief

Explicitly deferred (not ingested this pass): `RESEARCH.md`, `MOTIVATION.md`,
`BUSINESS.md`, `PLAYBOOK.md` — supporting material rather than docs that change
what an agent should do right now. Addable later via a normal ingest.

`wiki/index.md` catalogs all 6 with one-line summaries, per the skill's
index-first navigation convention.

## Sharing mechanism

`wiki/` and `raw/` are committed to `main` like everything else in this repo —
no new git workflow, just more files. Teammates get it on their next `git pull`.

To make the wiki self-announcing (so nobody has to be told it exists), append a
short stanza to `AGENTS.md` pointing at the wiki, following the skill's
agent-memory-integration convention. `AGENTS.md` is `@`-imported by `CLAUDE.md`
and already described in this repo as "the only thing keeping those agents
consistent" — every teammate's agent already reads it on session start.

## Out of scope for this pass

- Graph layer / typed entity relationships.
- Ingesting `RESEARCH.md`, `MOTIVATION.md`, `BUSINESS.md`, `PLAYBOOK.md`.
- A living decision log (captured team decisions as the night progresses) — the
  user chose static reference only.
- Any change to product code, `src/`, or the demo.

## Risks / notes

- This adds files to a repo that's mid-hackathon build. Kept strictly additive
  (`wiki/`, `raw/`, one stanza in `AGENTS.md`) — no touch to `src/` or any file
  another teammate owns per the TASKBOARD lane split.
- Python is required for the bundled `llm-wiki` scripts (search/lint/stats);
  not required for basic ingest/query, which are LLM-driven markdown writes.
