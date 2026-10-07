"use client";

import { useState } from "react";
import { testOllama } from "@/app/(app)/secretary/actions";

/** Channels page: one button that checks the AI model connection (sends a tiny test question). */
export function OllamaTest() {
  const [state, setState] = useState<{ busy: boolean; ok?: boolean; message: string }>({ busy: false, message: "" });
  async function run() {
    setState({ busy: true, message: "Testing…" });
    try {
      const result = await testOllama();
      setState({ busy: false, ok: result.ok, message: result.message });
    } catch {
      setState({ busy: false, ok: false, message: "The test could not run. Try again." });
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={state.busy} onClick={() => void run()} className="rounded-xl border border-forest/30 bg-forest-soft px-4 py-2 text-sm font-semibold text-forest hover:bg-yolk-soft disabled:opacity-70">
        Test the AI connection
      </button>
      <p role="status" className={`text-sm font-medium ${state.ok === false ? "text-clay" : "text-sage"}`}>
        {state.message}
      </p>
    </div>
  );
}
