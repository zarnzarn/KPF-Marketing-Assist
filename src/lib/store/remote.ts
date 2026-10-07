// Saves the user's entries in their own Supabase project (table user_data, one row per user).
// Row-level security means a logged-in user can only ever read or write their own row.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserData } from "../types";

export interface RemoteLoad {
  data: unknown;
  /** The row's updated_at, used to notice changes made on another device. Null when nothing is saved yet. */
  version: string | null;
}

export type RemoteSave = { ok: true; version: string } | { ok: false; conflict: true };

export interface RemoteClient {
  load(): Promise<RemoteLoad>;
  /** Saves only if nobody else saved since `version`; otherwise reports a conflict. Throws when the database cannot be reached. */
  save(data: UserData, version: string | null): Promise<RemoteSave>;
}

export function supabaseRemote(supabase: SupabaseClient, userId: string): RemoteClient {
  return {
    async load() {
      const { data, error } = await supabase.from("user_data").select("data, updated_at").eq("user_id", userId).maybeSingle();
      if (error) throw new Error("load failed");
      return data ? { data: data.data, version: String(data.updated_at) } : { data: null, version: null };
    },
    async save(entries, version) {
      if (version === null) {
        const { data, error } = await supabase.from("user_data").insert({ user_id: userId, data: entries }).select("updated_at").single();
        if (error?.code === "23505") return { ok: false, conflict: true }; // another device saved first
        if (error || !data) throw new Error("save failed");
        return { ok: true, version: String(data.updated_at) };
      }
      const { data, error } = await supabase.from("user_data").update({ data: entries }).eq("user_id", userId).eq("updated_at", version).select("updated_at");
      if (error) throw new Error("save failed");
      if (!data || data.length === 0) return { ok: false, conflict: true };
      return { ok: true, version: String(data[0].updated_at) };
    },
  };
}
