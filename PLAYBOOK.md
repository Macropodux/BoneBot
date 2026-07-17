# Saturday Build Playbook

Open this when you need to build a thing *right now* and want the fastest correct
path. `AGENTS.md` = rules the agent reads automatically. `RUNBOOK.md` = schedule
& strategy. **This file = what to type when you're tired.**

Golden rule: **describe the outcome, point at the example, let the agent build.**
You are the director, not the typist.

---

## 0. First move Saturday (before any code)

1. Challenge drops 17:05. Pick one in ≤45 min. **Josh decides.**
2. Write the 3-minute demo script — the narration — BEFORE code. (RUNBOOK §2.)
3. Rename the Vercel project now if you're going to (RUNBOOK — it breaks the URL later).
4. `git pull` on every laptop. Then everyone starts a **fresh Claude Code in the repo folder.**
5. Delete the throwaway examples once you know what you're building:
   `src/app/scam/ src/app/chat/ src/app/api/scam/ src/app/api/chat/ src/lib/scam-schema.ts`
   (Keep `src/lib/supabase.ts` and `src/app/api/` — the plumbing.)

---

## 1. The pattern every AI feature follows

The scam detector is the template. Any "take input X → give smart output Y" feature is the same three files:

| File | Role | Copy from |
|---|---|---|
| `src/lib/<feature>-schema.ts` | zod schema — the shape the model MUST return | `scam-schema.ts` |
| `src/app/api/<feature>/route.ts` | system prompt (the expertise) + `generateObject` | `api/scam/route.ts` |
| `src/app/<feature>/page.tsx` | paste/upload box + rendered result card | `scam/page.tsx` |

**Prompt that works:**
> "Build a new feature at `/triage` following the exact pattern of the scam detector
> (`src/lib/scam-schema.ts`, `src/app/api/scam/route.ts`, `src/app/scam/page.tsx`).
> It takes [INPUT] and returns [STRUCTURED OUTPUT: fields]. The system prompt should
> make it act as [EXPERT ROLE] checking for [CRITERIA]. Read AGENTS.md first."

Then **you** rewrite the system prompt — that's the domain expertise, and it's the part
only Josh/Emre/Paula can write. Don't let the agent guess clinical/scientific judgement.

---

## 2. Go-to prompts

**Streaming chat (conversation, not one-shot):** copy `api/chat/route.ts` + `chat/page.tsx`.
Use for open-ended assistants; use the scam pattern for "analyse this → verdict".

**Add a page:** "Add a page at `/foo`." (Folder = URL. `src/app/foo/page.tsx`.)

**Persist something:**
> "Add a Supabase table `<name>` with columns [...]. Write the SQL to `supabase/<name>.sql`
> following `supabase/scam_checks.sql`, and wire the insert/read like the scam route."

Then run the SQL yourself in the Supabase dashboard (the anon key can't create tables).
**Only persist when *remembering* is the feature** — not by reflex.

**Make it look good:** invoke the design skill, or:
> "Redesign `/foo` to look polished and distinctive. No generic AI aesthetic — no Inter,
> no purple gradients. Cohesive palette, real typographic hierarchy. Keep it working."

**Give the model a tool (→ agent):**
> "Add a tool the model can call in `api/foo/route.ts` using the AI SDK's `tools` option:
> a function `search(query)` that [...]. Loop until it stops calling tools. Read AGENTS.md."

**Tune the model:** in the route — `model: anthropic(MODEL)` and `providerOptions.anthropic`
`{ effort: "high", thinking: { type: "adaptive" } }`. Decide once you know the workload.

---

## 3. When it breaks (known gotchas — don't re-debug these)

| Symptom | Cause | Fix |
|---|---|---|
| Build fails `EPERM: unlink .next/...` | OneDrive locking files | `rm -rf .next` and rebuild. Not your code. |
| Env var change had no effect | Dev server reads env at startup | Restart `npm run dev`. Vercel: env only applies to NEW deploys. |
| API 500, `API key is invalid` | Key revoked/disabled | Regenerate in Anthropic console, update `.env.local` AND Vercel. |
| Live site not updating after push | Broke the build → deploy failed | Check Vercel deployments; `npm run build` locally first. |
| Agent failed the same task twice | It's stuck | Stop. Change approach or do it yourself. Don't re-prompt a third time. |

---

## 4. Non-negotiables under pressure

- **Build before you push.** `main` auto-deploys; a broken push breaks the live demo.
- **Commit to `main`, small and often.** No PRs, no branches. Say out loud which file you own.
- **Josh cuts scope. Alone.** A committee at 03:00 cuts nothing.
- **Feature freeze 10:00 Sun.** After that: only polish, video, rehearsal.
- **Submit at 13:00, not 14:00.** The buffer is where the thing that always goes wrong goes wrong.
- **No login wall.** Judges bounce. Spend cap + (maybe) rate limit, never auth.
- **Demo-first.** If it's not in the 3-min script, don't build it.
