import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isAllowedEmail, isOnline, setupProblem } from "../mode";
import { serverSupabase } from "../supabase/server";

export type Viewer = { mode: "local" } | { mode: "online"; userId: string; email: string };

/**
 * Who is using the app. Checked on the server, against Supabase and ALLOWED_EMAIL.
 * Null means "not allowed in" (not signed in, a different email, or setup missing).
 * This is the real check; the proxy only redirects early.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (setupProblem()) return null;
  if (!isOnline()) return { mode: "local" };
  const supabase = await serverSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !isAllowedEmail(data.user.email)) return null;
  return { mode: "online", userId: data.user.id, email: data.user.email as string };
});

/** For pages and server actions: continue only for the allowed user, otherwise go to the login (or setup) page. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(setupProblem() ? "/setup" : "/login");
  return viewer;
}
