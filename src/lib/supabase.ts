import { createClient } from "@supabase/supabase-js";

// One shared Supabase client, built from the two public env vars.
//
// The anon key is browser-safe by design — it ships to the client and its job
// is to be public. Security is NOT "hide this key"; it's the Row Level Security
// policies on the table (see the SQL in RUNBOOK / the setup step). A table with
// RLS on and no policy denies everything, anon key or not.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
