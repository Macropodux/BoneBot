-- Run this once in the Supabase dashboard → SQL Editor → New query → Run.
-- Creates the table the scam example logs to.
--
-- Why you run it (not the app): creating tables is a privileged operation.
-- The app only holds the anon key, which by design cannot change the schema —
-- it can only read/write rows, and only where a policy below allows it.

create table if not exists scam_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  verdict text not null,
  confidence int not null,
  summary text not null,
  message_preview text not null
);

-- Row Level Security: with RLS on and no policy, EVERYTHING is denied — even
-- with a valid key. The two policies below open read + insert to the anon key.
alter table scam_checks enable row level security;

create policy "public read" on scam_checks
  for select using (true);

create policy "public insert" on scam_checks
  for insert with check (true);

-- ⚠️ Honest note: `using (true)` / `with check (true)` means anyone with the
-- anon key (which ships to every browser) can read and insert. Fine for a
-- throwaway demo. For a real product you'd scope these to an authenticated
-- user (e.g. `using (auth.uid() = user_id)`).
