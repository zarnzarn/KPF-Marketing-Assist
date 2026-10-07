// How the app runs, decided by settings (environment variables).
//
//  - Online: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set.
//    A login is required and entries and reports are saved in the user's own Supabase project.
//  - Local: no Supabase settings. Entries stay in this browser and reports are read from
//    REPORTS_DIR. Used on the user's own computer, in development and in tests.
//
// On a host (Vercel sets VERCEL=1) the app never runs in local mode: without the settings
// every page shows "Setup needed" and no data.

type Env = Record<string, string | undefined>;

export interface SupabaseSettings {
  url: string;
  /** The publishable (anon) key. It is public by design; access is limited by row-level security. */
  key: string;
}

const value = (env: Env, name: string) => (env[name] ?? "").trim().replace(/^["']|["']$/g, "");

export function supabaseSettings(env: Env = process.env): SupabaseSettings | null {
  const url = value(env, "NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const key = value(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || value(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return /^https:\/\/[^/\s]+$/.test(url) && key ? { url, key } : null;
}

export const isOnline = (env: Env = process.env) => supabaseSettings(env) !== null;

/** The one email address that may log in (lower case), or "" when it is not set. */
export const allowedEmail = (env: Env = process.env) => value(env, "ALLOWED_EMAIL").toLowerCase();

export function isAllowedEmail(email: string | null | undefined, env: Env = process.env): boolean {
  const allowed = allowedEmail(env);
  return allowed !== "" && typeof email === "string" && email.trim().toLowerCase() === allowed;
}

export type SetupProblem = "supabase" | "allowed-email";

/** What is missing before the app may show any data, or null when it is ready. */
export function setupProblem(env: Env = process.env): SetupProblem | null {
  if (env.VERCEL === "1" && !isOnline(env)) return "supabase";
  if (isOnline(env) && !allowedEmail(env)) return "allowed-email";
  return null;
}
