// Scaffold status board. Replace this whole page on Saturday once the
// challenge is picked — it exists to prove the pipeline, not to be kept.
//
// The commit SHA is rendered from VERCEL_GIT_COMMIT_SHA so "is the live site
// running my latest push?" is answerable by looking, not by digging through
// the Vercel dashboard.

const sha = process.env.VERCEL_GIT_COMMIT_SHA;
const env = process.env.VERCEL_ENV ?? "local";

// Presence of the env var is what we can check at a glance. It does not prove
// the key works — only that it is configured.
const checks = [
  {
    name: "Deploy",
    ready: true,
    detail: "You are reading this, so Next.js + Vercel work",
  },
  {
    name: "Container",
    ready: true,
    detail: "Dockerfile builds, runs, serves 200",
  },
  {
    name: "Database + Auth",
    ready: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    detail: "Supabase — set NEXT_PUBLIC_SUPABASE_URL",
  },
  {
    name: "LLM",
    ready: Boolean(process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY),
    detail: "AI SDK — set ANTHROPIC_API_KEY (or OPENAI_API_KEY)",
  },
];

export default function Home() {
  const done = checks.filter((c) => c.ready).length;

  return (
    <div className="min-h-screen bg-white px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto flex max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
            Hack-Nation · 6th Global AI Hackathon
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Scaffold status
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Pre-built so that when the challenges drop at{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              17:05 Saturday
            </span>
            , we start from a deployed app instead of an empty folder.
          </p>
        </header>

        <section className="flex flex-col gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
          {checks.map((c) => (
            <div
              key={c.name}
              className="flex items-start gap-4 bg-white p-4 dark:bg-zinc-950"
            >
              <span
                aria-hidden
                className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                  c.ready ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {c.name}
                  <span className="sr-only">
                    {c.ready ? " — ready" : " — not configured"}
                  </span>
                </span>
                <span className="text-sm text-zinc-500">{c.detail}</span>
              </div>
            </div>
          ))}
        </section>

        <footer className="flex flex-col gap-2 font-mono text-xs text-zinc-500">
          <div className="flex justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <span>{done} / {checks.length} wired</span>
            <span>{env}</span>
          </div>
          <div className="flex justify-between">
            <span>commit</span>
            <span className="text-zinc-900 dark:text-zinc-100">
              {sha ? sha.slice(0, 7) : "local dev"}
            </span>
          </div>
          <p className="pt-2 text-zinc-400 dark:text-zinc-600">
            Deadline: Sunday 19 July, 14:00 London. Submit at 13:00.
          </p>
        </footer>
      </main>
    </div>
  );
}
