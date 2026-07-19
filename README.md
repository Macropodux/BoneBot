# BoneBot

**BoneBot is a hormone-aware bone-health screening assistant for postmenopausal
women.** It turns a woman's health profile — menopause history, risk factors, and
simple labs — into an **estimated T-score with an uncertainty range**, the factors
driving it, and a clear prompt to confirm with a DXA scan when warranted. It is a
**screening flag, never a diagnosis**: an NHANES-trained model makes every
prediction, and the LLM only explains it in plain language.

**Live demo (no login needed):** https://bonebot.vercel.app/

Built in 24 hours for the **Hack-Nation 6th Global AI Hackathon — Challenge 05,
Women's Hormonal Health**.

## Why

1 in 2 postmenopausal women will suffer an osteoporotic fracture, and most are
never screened until they break a bone. Estrogen loss after menopause accelerates
bone loss, but existing risk tools are static questionnaires. BoneBot flags who
needs a scan earlier, from data women already have.

## How it works

1. **Triage gate** — a lightweight model (age, BMI, postmenopausal status)
   decides whether the fuller questionnaire is worth the user's time. Its
   threshold was chosen for safety (validation sensitivity ≥ 95%); see
   `docs/TRIAGE_THRESHOLD_AUDIT.md` for the held-out audit.
2. **T-score estimate** — a fuller model (age, BMI, years since menopause,
   activity, prior fragility fracture, glucocorticoids, smoking, alcohol,
   vitamin D, calcium, rheumatoid arthritis, and hormone therapy) produces an
   estimated T-score with an uncertainty range and
   per-factor contributions in T-score units.
3. **Explanation** — the LLM (via the Vercel AI SDK) explains the model's
   output. It never sets or adjusts the risk itself. Ambiguous answers are
   clarified once, then treated as *unknown* — never as a positive risk factor —
   and flagged on the results page.

Model training and the threshold audit live in `model/`; canonical input
definitions are in `docs/INPUT_SPEC.md`; the clinical evidence constraining the
explanations is in `docs/EVIDENCE.md`.

## Limitations & responsible use

BoneBot outputs an **estimate, not a diagnosis**. Only a DXA scan measures bone
density. The model is trained on NHANES data and its applicability outside that
population is untested. Uncertain inputs are surfaced, not hidden, and users are
directed to discuss results with a clinician.

## Development

```bash
npm run dev      # local dev server
npm run build    # must pass before pushing — main auto-deploys
npm run lint
```

Stack: Next.js 16 (App Router, TypeScript), Tailwind, Vercel AI SDK, Vercel
hosting.

## License

Code is released under the [MIT License](LICENSE). The benchmark, evidence
documents, and documentation (`docs/`) are released under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See `LICENSE` for
details.
