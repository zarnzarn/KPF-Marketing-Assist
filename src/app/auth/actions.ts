"use server";

import { redirect } from "next/navigation";
import { isOnline } from "@/lib/mode";
import { serverSupabase } from "@/lib/supabase/server";

/** Signs out on this device and goes back to the login page. */
export async function signOut(): Promise<void> {
  if (isOnline()) {
    const supabase = await serverSupabase();
    await supabase.auth.signOut();
  }
  redirect(isOnline() ? "/login" : "/");
}
