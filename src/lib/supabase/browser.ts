"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseSettings } from "../mode";

let client: SupabaseClient | null = null;

/** One Supabase client per browser tab. The settings come from the server (they are public). */
export function browserSupabase(settings: SupabaseSettings): SupabaseClient {
  client ??= createBrowserClient(settings.url, settings.key);
  return client;
}
