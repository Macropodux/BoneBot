---
type: source
title: "RUNBOOK.md — Team Runbook"
raw: "RUNBOOK.md"
ingested: 2026-07-18
tags: [schedule, hackathon]
created: 2026-07-18
updated: 2026-07-18
---

# RUNBOOK.md — Team Runbook

`RUNBOOK.md` is the team's central coordination guide detailing the event schedule, rules of engagement, technical architecture constraints, setup checklists, and strategy.

## Key Rules & Strategy

- **Demo-Script Priority:** The 3-minute demo script must be written before any code is produced. This prevents the scientific team from spending all time on model tuning at the expense of a functional, presenter-friendly interface.
- **Scope Cut Authority:** Josh (physician/product owner) acts as the sole decision-maker for scope cuts.
- **Rules of Engagement:** Commit directly to `main` with small, frequent pushes. No feature branches or pull requests are used, allowing for rapid iterations. Run `npm run build` locally before pushing to prevent breaking the live deployment on Vercel.
- **Venture Lab Focus:** The target is to qualify for the Venture Lab / EWOR incubation program (top 7% of submissions). The team's edge relies on clinical credibility (physician + Cambridge/UCL neuroscientists), high-quality video production, and agent-led coding efficiency.

## Technical Architecture Constraints

- **Remote Inference:** The application is built around model orchestration. The LLM model is accessed via API endpoints using the Vercel AI SDK, allowing providers (e.g. Anthropic, OpenAI) to be swapped with a single environment variable change.
- **Secret Hygiene:** All API keys must remain strictly server-side in Vercel environment variables.
- **Rate-Limiting & Credit Limits:** Public endpoints must be protected to prevent credit depletion during judging week (19–25 July). Out-of-credit errors must be caught and fail gracefully with user-facing messages.
- **Stateless Scaffold:** Supabase integration is pre-wired but optional; the MVP should prioritize stateless input-to-output processing unless persistent state is required.

## Checklists and Cadence

- **Hacking Hours:** Starts Saturday 17:15 BST and concludes Sunday 14:00 BST.
- **Feature Freeze:** Sunday 10:00 BST.
- **Record & Edit Video:** Sunday 10:00–12:30 BST.
- **Submit Target:** Sunday 13:00 BST.
- **Testing Check:** Verify the live site using incognito windows and mobile devices prior to submission.

## Where this fits

First-pass, source-only ingest. This page compiles the operational schedule and logistics constraints for the team.
