---
type: source
title: "AGENTS.md — Hack-Nation Team Rules"
raw: "AGENTS.md"
ingested: 2026-07-18
tags: [rules, hackathon]
created: 2026-07-18
updated: 2026-07-18
---

# AGENTS.md — Hack-Nation Team Rules

`AGENTS.md` is the operating-rules document for the team building BoneWise, a
hormone-aware bone-health screening tool, at the 6th Global AI Hackathon
(Hack-Nation). It is the coordination mechanism for four scientists — none
professional web engineers — who each direct their own coding agent against a
shared repository. The file frames itself as the one artifact keeping those
agents consistent, and states a hard deadline of Sunday 19 July, 14:00
London, with no extension.

## Team and product framing

The team has four members: Josh (physicist and licensed physician; product
owner, design, demo video, and scope-cut decisions), Paula (`paulatin4mente`,
molecular neuroscientist), Emre (computational neuroscientist; ML/data logic
in Python/PyTorch), and a fourth member with an AI background (username
TBC). Because up to four people edit the repo concurrently, the file warns
against creating or heavily editing files others are likely working in —
"collisions cost more than they look at 02:00."

The chosen product is BoneWise (Challenge 05, Women's Hormonal Health); full
spec detail lives in `PROJECT.md`, not this file. The core architectural rule
stated here: an NHANES-trained model in `bone-model.ts` produces the risk
prediction, and the LLM's role is limited to explaining that prediction —
never to setting or overriding the risk score. The product is a screening
flag, not a diagnosis. The scam-detector and chat example code
(`src/app/scam`, `src/app/chat`) are labeled as disposable reference patterns
to be deleted once the real product replaces them.

## Stack

Next.js 16 (App Router, `src/`, TypeScript), Tailwind, Supabase
(Postgres) for DB/auth, the Vercel AI SDK for LLM calls, Vercel hosting with
auto-deploy from `main`, and Docker for containerization. The file is
explicit that this stack was chosen because coding agents produce it most
reliably and because Supabase/Vercel are event sponsors — not because it
matches the team's prior expertise.

## Rules

**Secrets.** API keys are server-side only, delivered via Vercel environment
variables. They must never appear in client components or in
`NEXT_PUBLIC_*`-prefixed variables (anything with that prefix ships to the
browser and should be treated as public), and never get committed — a key
committed once persists in git history permanently, which matters because the
repo may go public for judging.

**LLM calls.** All calls go through the Vercel AI SDK, never a provider SDK
directly, so the provider stays swappable by environment variable. The
active provider is Anthropic (existing team credits), with a possible
same-day switch to OpenAI if event credits arrive — that switch must be a
one-line change. Public endpoints must be rate-limited, since judges will hit
the live URL during judging week (19–25 July) and consume the team's own
credits. Out-of-credit failures should degrade gracefully with a message like
"demo limit reached" rather than surfacing a stack trace.

**Git.** Commit straight to `main`, small and often. No pull requests, no
feature branches. Because `main` auto-deploys to production, a broken commit
breaks the live demo — `npm run build` must pass before pushing. Contributors
should stay in their own files where possible.

**Scope.** No new dependencies without asking (a surprise dependency at 02:00
risks a deploy failure at 02:30). No refactoring or "improving while in
there" — do only the asked task. No speculative abstraction, since the code
has roughly a 21-hour lifespan. If the same task fails twice, stop and
surface the blocker rather than attempting a third variation.

**No login wall in front of the demo.** Judges face 400+ submissions in a
week; a signup form in front of the product causes a real fraction to leave
before scoring it. The demo must work with zero setup — no account, no wall.
If accounts are genuinely required, the product should offer a "try the
demo" button that skips straight in, or ship pre-seeded credentials on the
landing page. Supabase is wired into the scaffold but its use is optional:
it earns its place only if the product needs to remember something across
page loads or users. A stateless input-to-LLM-to-output demo is a fine
outcome; using Supabase merely because it was already set up is called out
as the mistake to avoid.

**Demo-first.** The team writes the 3-minute demo script before writing any
product code, and anything not in that script does not get built. Requests
for work outside the script should be questioned first. The document names
the team's specific failure mode explicitly: three scientists over-indexing
on rigor (e.g., 8 hours on the model, 90 minutes on a broken UI) when "nobody
scores the cross-validation" — every decision should be biased toward
whether it demos well.

## Commands

Three npm scripts are called out: `npm run dev` (local dev server), `npm run
build` (must pass before pushing, since `main` auto-deploys), and `npm run
lint`.

## Also referenced

The file points to `node_modules/next/dist/docs/` for version-matched
Next.js 16 documentation (breaking changes vs. training-data assumptions),
and to `RUNBOOK.md` as the separate human-facing runbook covering schedule,
timeline, checklists, and strategy.

## Where this fits

First-pass, source-only ingest — no entity or concept pages exist yet in
this wiki, so this page has no outbound wikilinks. A later ingest pass
is expected to extract entities (e.g. team members, BoneWise) and concepts
(e.g. the demo-first principle, the no-login-wall rule) and link back to this
page as their source.
