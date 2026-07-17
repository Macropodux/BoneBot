<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Project: Hack-Nation 6th Global AI Hackathon

**This is a hackathon scaffold.** It exists so that when the challenges are revealed (Sat 18 Jul, 17:05 London) the team starts from a *deployed, working app* instead of an empty folder. Everything here is deliberately generic — the actual product gets built on top.

🔴 **Hard deadline: Sunday 19 July, 14:00 London.** No extension. A working ugly demo beats a beautiful broken one, every time.

## Team

Four scientists, no professional web engineers. All direct agents rather than hand-writing code.

- **Josh** — physicist & licensed physician. Product owner, design, demo video. **Decides scope cuts.**
- **Paula** (`paulatin4mente`) — Cambridge molecular neuroscientist. Builds via agents, domain validation.
- **Emre** — UCL computational neuroscientist. ML/data logic, Python/PyTorch.
- **4th member** — AI background. *(username TBC)*

Each runs their own agent on their own clone. **This file is the only thing keeping those agents consistent** — it matters.

⚠️ Four people share this repo. Before creating or heavily editing a file, prefer one that
nobody else is in. Collisions cost more than they look at 02:00.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `src/`, TypeScript) |
| Styling | Tailwind |
| DB + Auth | Supabase (Postgres) |
| LLM | Vercel AI SDK |
| Hosting | Vercel (auto-deploys from `main`) |
| Container | Docker |

**Chosen because agents write this stack most reliably, and Supabase/Vercel are event sponsors** — not because it's the team's existing expertise. It isn't.

## Rules

### Read the docs first
Full version-matched Next.js docs are at `node_modules/next/dist/docs/`. **Read them before writing Next.js code.** Most relevant here:

- `01-app/02-guides/authentication.md` — auth patterns
- `01-app/02-guides/streaming.md` — streaming responses
- `01-app/02-guides/environment-variables.md` — env vars & secrets
- `01-app/02-guides/data-security.md` — what must stay server-side
- `01-app/02-guides/self-hosting.md` — Docker / containers
- `01-app/01-getting-started/15-route-handlers.md` — API routes
- `01-app/04-community/upgrading/version-16.md` — **v16 breaking changes**

### Secrets
- 🔑 **API keys are server-side only.** Vercel environment variables. Never in client components, never in `NEXT_PUBLIC_*`, never committed.
- Anything prefixed `NEXT_PUBLIC_` ships to the browser. Treat it as public.
- Check no key is in the diff before committing. A key committed *once* lives in git history forever — and this repo may go public for judging.

### LLM calls
- Always via the **Vercel AI SDK**, never a provider SDK directly. The provider must stay swappable by env var.
- Currently **Anthropic** (team has existing credits). May switch to **OpenAI** on the day if event credits arrive. That switch must be a one-line change.
- Rate-limit any public endpoint. Judges click the live URL during the judging week (19–25 Jul) and it spends **our** money.
- Degrade gracefully when out of credit: *"demo limit reached"* beats a stack trace in front of a judge.

### Git
- **Commit straight to `main`. Small, often.** ⛔ No pull requests. No feature branches.
- `main` auto-deploys to production. **A broken commit breaks the live demo.** Run `npm run build` before pushing.
- Three people share this repo. Stay in your own files where possible.

### Scope
- ⛔ **Do not add dependencies without asking.** A surprise dep at 02:00 is a deploy failure at 02:30.
- ⛔ **Do not refactor.** Do not "improve while you're in there." Do the asked thing.
- ⛔ **No speculative abstraction.** This code has a 21-hour lifespan.
- If you've failed the same task twice, **stop and say so.** Don't try a third variation — surface the blocker.

### Demo-first
The team writes a 3-minute demo script *before* any product code. **If a thing isn't in the demo script, it doesn't get built.** If asked for something outside the script, ask whether it's actually needed.

The failure mode this team has: three scientists optimising for rigour — 8 hours on the model, 90 minutes on a broken UI. **Nobody scores the cross-validation.** Bias every decision toward "does it demo".

## Commands

```bash
npm run dev      # local dev server
npm run build    # MUST pass before pushing — main auto-deploys
npm run lint
```

## See also

`RUNBOOK.md` — the human runbook: schedule, timeline, checklists, strategy.
