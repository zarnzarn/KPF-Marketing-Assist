"use client";

import { useState, useSyncExternalStore } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { browserEntries, canImportBrowserEntries, importBrowserEntries, subscribe } from "@/lib/store/userData";

/** Online mode, first visit: offers to move entries made earlier in this browser into the account. */
export function ImportBrowserEntries() {
  const { online } = useAppData();
  const can = useSyncExternalStore(subscribe, canImportBrowserEntries, () => false);
  const [message, setMessage] = useState("");
  if (!online || (!can && !message)) return null;
  const count = Object.values(browserEntries()).reduce((n, list) => n + list.length, 0);

  async function move() {
    const ok = await importBrowserEntries();
    setMessage(ok ? "Your entries were moved to your account. They are now on every device you log in from." : "The entries could not be moved. Check the internet connection and try again.");
  }

  return (
    <section aria-labelledby="import-heading" className="mb-6 rounded-3xl border border-yolk/50 bg-yolk-soft/70 p-5">
      <h2 id="import-heading" className="text-xl font-semibold text-forest">Entries found in this browser</h2>
      {can && (
        <>
          <p className="mt-1 text-sm">This browser still has {count} entr{count === 1 ? "y" : "ies"} you made before logging in. Move them to your account so they are saved online?</p>
          <button type="button" onClick={() => void move()} className="mt-3 rounded-xl bg-forest px-4 py-2 font-semibold text-white hover:bg-sage">
            Move entries to my account
          </button>
        </>
      )}
      <p role="status" className="mt-2 text-sm font-medium text-sage">
        {message}
      </p>
    </section>
  );
}
