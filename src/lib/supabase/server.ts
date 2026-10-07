import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseSettings } from "../mode";

/** A Supabase client that acts as the logged-in user (from the session cookie). Server only. */
export async function serverSupabase() {
  const settings = supabaseSettings();
  if (!settings) throw new Error("Supabase is not set up.");
  const store = await cookies();
  return createServerClient(settings.url, settings.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called while rendering a page, where cookies are read-only. The proxy refreshes them instead.
        }
      },
    },
  });
}
