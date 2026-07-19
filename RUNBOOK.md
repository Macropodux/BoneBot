# Hack-Nation 6th Global AI Hackathon — Team Runbook

**Team (4):** Josh (product / agents / design / video) · Paula `paulatin4mente` (build + domain) · Emre ✅ confirmed (ML + data) · 4th member, AI background *(username TBC)*

> **Four people, one small app, 20 hours.** Three builders in the same codebase is about the ceiling — a fourth pair of hands in the same files costs more in collisions than it adds. Give member 4 a lane that isn't `src/app/`: data/ML, or owning user testing + demo prep. Decide this before Saturday, not at 02:00.
**Hub:** HALKIN, London
**Status of this doc:** living. Times confirmed from the official participant deck (p.2). Anything marked ⚠️ is unverified.

---

## 1. The clock — London (BST)

The deck states all times in **ET**. London is **ET + 5h**. These are the converted times. *Trust these, not memory — the informal "challenges at 6pm" is about an hour late.*

| When (London) | What |
|---|---|
| **Sat 18 Jul, 16:00** | Arrive HALKIN. Set up, wifi, power, seats. |
| **Sat 16:15 – 17:05** | Kick-off & speaker session |
| **Sat 17:05 – 17:15** | ⚡ **CHALLENGES REVEALED** |
| **Sat 17:15** | **Hacking begins (T+0)** |
| **Sun 19 Jul, 14:00** | 🔴 **SUBMISSION DEADLINE — hard stop** |
| Sat 25 Jul, 17:00 – 19:00 | Finalist pitches (3 min) — *only if top 3 in your challenge* |
| Sat 25 Jul, 19:15 | Awards ceremony |

**Total build window: ~20h45m.**

### What this means
- **Everything ships Sunday 14:00.** The 25th is not a second chance. If it isn't submitted Sunday, there is no 25th.
- **The pitch deck is NOT a weekend job.** It's for the 25th, only if you're a finalist, and you'd have a full week to make it. Do not build slides on Saturday.
- **Judging runs all week (19→25 Jul).** ~200 judges, ~400 submissions. They have *days*, not minutes. Your repo may actually get read. Your live URL will get clicked — possibly on Wednesday.

---

## 2. The one rule that matters

> ### ✍️ Write the 3-minute demo script BEFORE writing any code.

Not the architecture. Not the model. The **narration**:

> *"We open on X. The user does Y. The screen shows Z. That number changes because…"*

Then build **exactly** what the script needs and nothing else.

**Why this rule exists:** we are three scientists. Our instinct is to make it *correct*. Left alone we will spend 8 hours on the model, 90 minutes on a broken UI, and demo something that doesn't run. **Nobody scores your cross-validation.** The demo script is the defence against ourselves.

---

## 3. Timeline (London time)

| Time | Block | Notes |
|---|---|---|
| 17:15 – 18:00 | **Pick the challenge** | 45 min hard cap. Decision is Josh's. |
| 18:00 – 19:00 | **Write the demo script** | ⛔ NO CODE. Whole team. |
| 19:00 – 19:30 | **Rebrand + redeploy scaffold** | Proves the pipeline works under the new name |
| 19:30 – 02:00 | **Build core** (~6.5h) | Ugly is fine. Working is not optional. |
| 02:00 – 07:00 | **Sleep** ⚠️ *plan TBC with team* | |
| 07:00 – 10:00 | **Finish + fix** | |
| **10:00** | 🧊 **FEATURE FREEZE** | Non-negotiable. Nothing new after this. |
| 10:00 – 12:30 | **Record + edit video** | Josh leads. This is our edge — protect the time. |
| 12:30 – 13:00 | **Submit** | |
| 13:00 – 14:00 | **Buffer** | The thing that always goes wrong goes wrong here. |
| **14:00** | 🔴 **DEADLINE** | |

**Submit at 13:00, not 14:00.** You can resubmit if there's time left. You cannot submit late.

---

## 4. Rules of engagement

### Git
- **One repo on GitHub, private, all three as collaborators.**
- ⛔ **No pull requests. No feature branches.** Everyone commits straight to `main`, small and often.
- **Clear file ownership** so we rarely touch the same file. Say out loud what you're editing.
- Vercel auto-deploys from `main` — a broken commit to main breaks the live demo. Commit small.

*Why: PR ceremony at 02:00 with three people who don't do this daily produces merge conflicts, not demos.*

### Scope
- **Josh decides scope cuts.** Not a committee. At 03:00 a committee cuts nothing and misses the freeze.
- Default answer to "should we also add…" after 22:00 is **no**.

### Agents
- Agents write the code. We review and direct.
- No new dependencies without asking — a surprise dep at 02:00 is a deploy failure at 02:30.
- If an agent has failed twice on the same thing, stop and change the approach. Don't re-prompt a third time.

---

## 5. Architecture facts (read once, saves an hour of confusion)

**Where does the "AI" come from?**
Our container does **not** contain a model. It contains **orchestration**. The app makes an HTTPS call to an LLM API (Anthropic now, OpenAI on the day if they give credits). The model is *rented, not shipped*.

**So what is the product?** Everything around the model: the prompts, the tool definitions, the loop deciding when to search vs. answer, the data we feed it, the interface, the judgment about what to surface. That *is* the product.

**Consequences:**
- 🔑 API key lives in a **Vercel environment variable, server-side only**. Never in client code. Leak it and it gets drained.
- 💸 **Judges clicking our URL spend our money.** Rate-limit it. Set a hard spend cap with auto-reload.
- ⏳ Credits **must survive until 25 Jul**. If they run out mid-week, judges score a broken app.
- 🛑 Handle the out-of-credit case gracefully: *"demo limit reached"* beats a stack trace.
- 🐳 Docker wraps our **code**. The model stays remote.

**The stack:** Next.js + Supabase (auth + Postgres) + Vercel + Vercel AI SDK.
- Chosen because agents write it more reliably than anything else, Supabase/Vercel are event sponsors, and Josh's Tailwind + design instincts transfer 1:1.
- **Vercel AI SDK** abstracts the LLM provider → swapping Anthropic → OpenAI is one line + an env var.
- **The live URL is free from Vercel** (`something.vercel.app`) on first deploy. No webserver needed. joshpeters.de is not involved.

---

## 6. Pre-event checklist

### Accounts & keys
- [x] GitHub repo created, private — **github.com/Macropodux/hacknation-scaffold**
- [x] Paula (`paulatin4mente`) accepted · Emre (`eyavuz21`) invited · 4th member TBC
- [x] Vercel connected, **auto-deploy from `main` verified working (~15s)**
- [x] Supabase project created (London region)
- [x] Anthropic API key in Vercel — **marked Sensitive, Production + Preview**
      *(Sensitive vars can't target Development; irrelevant — we use `npm run dev` + `.env.local`)*
- [ ] Spend cap + auto-reload set on Anthropic console ⚠️ **must outlast 25 Jul**
- [x] HALKIN hub — **all registered, in person** ✓

### ⚠️ If you rename the Vercel project on Saturday, do it in the FIRST HOUR
Renaming changes the `.vercel.app` URL and **the old one stops resolving**. Judges click that
link for a week (19–25 Jul). Rename before you submit, or don't rename at all.

### The scaffold — *deployed and clicked-through, or it doesn't count*
Live: **https://bonebot.vercel.app/** (moved with the BoneBot rename — the old
`hacknation-scaffold.vercel.app` URL now 404s) — the status board there reports which
commit is deployed and lights each row below as it gets wired.

- [x] Next.js app live at a Vercel URL
- [x] **LLM streaming verified in production** — real tokens, chunk by chunk, via the AI SDK.
      Model is `ANTHROPIC_MODEL` (default `claude-sonnet-5`); provider swap to OpenAI is one line.
      Out-of-key returns a plain 503 sentence, not a stack trace — verified.
- [x] **Postgres round-trip verified** — write from one request, read back from another;
      rows from different machines land in the same DB (`supabase/scam_checks.sql` = the table).
      Write path degrades gracefully: a missing/broken DB still returns the verdict.
- [ ] ~~Supabase auth: sign up + log in~~ — **deliberately skipped.** See the no-login-wall
      rule in `AGENTS.md`. Build it only if a challenge genuinely needs accounts.
- [ ] File upload — only if needed
- [x] Tailwind in place — design system still to do
- [x] `Dockerfile` builds and runs — **verified: image builds, container serves 200** ⚠️ *(the containerization requirement itself is still unconfirmed — belt and braces)*
- [ ] A throwaway demo feature proving every layer end-to-end — **deleted on Saturday**

### Agent setup
- [x] `AGENTS.md` with stack conventions + hard rules (`CLAUDE.md` imports it via `@AGENTS.md`, so Claude Code / Cursor / Copilot all get the same instructions)
- [x] Next.js 16 docs bundled at `node_modules/next/dist/docs/` — `AGENTS.md` points agents there instead of stale training data
- [ ] MCP: Supabase, Vercel
- [ ] Prompt library for the 02:00 tasks

### Demo kit (Josh)
- [ ] Video project pre-set: timeline, LUTs, lower-thirds, licensed music
- [ ] Screen recording tested **on the actual machine**
- [ ] "Why us" beat drafted — it's the same regardless of challenge: *licensed physician + Cambridge molecular neuroscientist + UCL computational neuroscientist*

### Logistics
- [ ] Chargers, adapters, extension lead, headphones
- [ ] Backup internet (phone hotspot) — **test it**
- [ ] Sleep plan agreed with team
- [ ] Emre confirmed

---

## 7. Submission checklist (Sunday)

- [ ] Live URL works — **in an incognito window, from a phone, not just your laptop**
- [ ] Repo is public or judges have access
- [ ] Demo video uploaded + link works
- [ ] Written submission on the hackathon site
- [ ] README explains what it is in 3 sentences
- [ ] API key **not** in the repo (check the commit history, not just the current files)
- [ ] Spend cap still active
- [ ] **Submitted by 13:00**

---

## 8. Strategy notes

**What we're optimising:** learning first, Venture Lab second, prize is a bonus.

**Venture Lab takes the top 30 teams** out of 400+ submissions — roughly the top 7%. That's a far more realistic target than winning a challenge outright, and it's the thing we actually want. Includes EWOR ("YC of Europe"), 3-month incubation, senior mentor, co-founder matching, Investor Day.

**Our edge is not out-coding the room.** It's:
1. **Clinical/scientific credibility** — we can say what a clinician would actually accept, and what's real vs. a plausible-looking artifact. The 20th RAG-chatbot team cannot fake this.
2. **Demo craft** — Josh does this professionally. Every winner in the deck has a video.
3. **Agent leverage** — all three of us can direct agents.

**Precedent worth knowing (deck p.8):** Dr. Janet Brinz — "AI researcher & dentist" — launched Finmedio out of this and won a $10K Harvard grant. A clinician who turned this into a venture. That's the path.

**Do NOT assume a health challenge.** Past winners: generative 3D jewelry, thermal drone anomaly detection, multilingual WhatsApp scam detection, financial document analysis, protein structure prediction. Sample challenges this round: ElevenLabs sports coach, AkashX FinDocGPT, aircraft CAD generation. **One in five was bio.** Health is upside, not a plan. Pick on demo potential; the credibility angle can be bent onto most challenges.

**Judges include:** Greylock, Founders Fund, OpenAI, Databricks, Meta, Microsoft, Nvidia, YC — and, relevant to us, **Verily** (Alphabet's health arm) and **Tinos Therapeutics**.

**Calibration:** Natalie Chan — 6× hackathon winner, Imperial, London-based, self-described "master in winning hackathons" — is plausibly in our room.

---

## 9. Known failure modes

| Failure | Counter |
|---|---|
| 8h on the model, 90min on a broken UI | Demo script first. Feature freeze 10:00. |
| Merge conflict at 03:00 | No PRs. Commit to main, small, loud. |
| Docker/deploy hell at 03:00 | Scaffold is deployed **before** Saturday. |
| Committee paralysis on scope | Josh decides. Alone. |
| Falling in love with a pre-built idea | We pre-build **nothing** challenge-specific. |
| Broken demo on judge's Wednesday click | Spend cap + graceful degradation + check the URL mid-week. |
| Submitting at 13:59 | Submit at 13:00. |
