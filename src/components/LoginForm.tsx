"use client";

import { useId, useState } from "react";
import type { SupabaseSettings } from "@/lib/mode";
import { browserSupabase } from "@/lib/supabase/browser";

/** Asks Supabase to email a login link. It never says whether an address is allowed. */
export function LoginForm({ settings }: { settings: SupabaseSettings }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [problem, setProblem] = useState("");
  const id = useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setState("error");
      setProblem("Enter a valid email address.");
      return;
    }
    setState("sending");
    let error: { status?: number } | null = null;
    try {
      ({ error } = await browserSupabase(settings).auth.signInWithOtp({
        email: address,
        // Only an existing user (added in Supabase) can log in; nobody can sign up from here.
        options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
      }));
    } catch {
      setState("error");
      setProblem("Could not reach the login service. Check the internet connection and try again.");
      return;
    }
    // Supabase limits how often links are sent; that is the one error worth explaining.
    if (error && error.status === 429) {
      setState("error");
      setProblem("Too many login links were asked for. Wait a minute, then try again.");
      return;
    }
    setState("sent");
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium">
          Email address
        </label>
        <input
          id={id}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={state === "error"}
          aria-describedby={state === "error" ? `${id}-err` : undefined}
          className="w-full rounded-lg border border-line bg-white px-3 py-2"
        />
        {state === "error" && (
          <p id={`${id}-err`} className="mt-1 text-sm font-medium text-clay">
            {problem}
          </p>
        )}
      </div>
      <button type="submit" disabled={state === "sending"} className="w-full rounded-xl bg-forest px-5 py-2.5 font-semibold text-white hover:bg-sage disabled:opacity-70">
        {state === "sending" ? "Sending…" : "Send login link"}
      </button>
      <p role="status" className="text-sm font-medium text-sage">
        {state === "sent" ? "If this email is allowed, a login link is on its way. Open it on this device; it works once." : ""}
      </p>
    </form>
  );
}
