"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { SupabaseSettings } from "@/lib/mode";
import { supabaseRemote } from "@/lib/store/remote";
import { connectRemote, flushSave, getSaveStatus, getServerUserData, getUserData, isLoaded, loadRemote, setUserData, subscribe, type SaveStatus } from "@/lib/store/userData";
import { browserSupabase } from "@/lib/supabase/browser";
import { todayInThailand } from "@/lib/today";
import type { AppData, Product, ShopState, UserData } from "@/lib/types";

interface AppDataContextValue {
  data: AppData;
  /** False until this browser's (or the online account's) saved entries are read. */
  ready: boolean;
  /** Whether the latest change was saved (see SaveStatus in src/lib/store/userData.ts). */
  saveStatus: SaveStatus;
  /** False when saving does not work right now (browser storage refused, or the database could not be reached). */
  storageOk: boolean;
  /** True in online mode (entries are saved in the user's account). */
  online: boolean;
  update: (fn: (data: UserData) => UserData) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);
const noop = () => () => {};

/**
 * The later of the server's date and this computer's date in Thailand, so "today" moves on past midnight
 * even with the tab left open (layouts do not re-render on navigation, so the server value alone would freeze).
 * YYYY-MM-DD strings compare correctly as text.
 */
function clientToday(serverToday: string): string {
  const now = todayInThailand();
  return now > serverToday ? now : serverToday;
}

/** Re-checks the date every minute and whenever the tab comes back, so "today" moves on after midnight in Thailand. */
function subscribeToday(onChange: () => void): () => void {
  const timer = setInterval(onChange, 60_000);
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    clearInterval(timer);
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

export interface RemoteSettings extends SupabaseSettings {
  userId: string;
}

export function AppDataProvider({ today, products = [], shop, remote, children }: { today: string; products?: Product[]; shop?: ShopState; remote?: RemoteSettings; children: ReactNode }) {
  // Online: switch the store to the user's account before anything reads it, so browser entries never flash on screen.
  useState(() => {
    if (remote && typeof window !== "undefined") connectRemote(supabaseRemote(browserSupabase(remote), remote.userId), remote.userId);
    return null;
  });
  const user = useSyncExternalStore(subscribe, getUserData, getServerUserData);
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const loaded = useSyncExternalStore(subscribe, isLoaded, () => false);
  const saveStatus = useSyncExternalStore(subscribe, getSaveStatus, () => "local" as SaveStatus);
  const liveToday = useSyncExternalStore(subscribeToday, () => clientToday(today), () => today);

  useEffect(() => {
    if (!remote) return;
    // Back to this tab: pick up changes made on another device (only when nothing here is unsaved).
    const refresh = () => document.visibilityState === "visible" && void loadRemote();
    // Leaving with unsaved changes: save now and ask the browser to wait.
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (["saving", "save-failed"].includes(getSaveStatus())) {
        void flushSave();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [remote]);

  const value = useMemo<AppDataContextValue>(
    () => ({
      data: { ...user, today: liveToday, products, shop },
      ready: hydrated && loaded,
      saveStatus,
      storageOk: !["local-failed", "save-failed", "load-failed"].includes(saveStatus),
      online: !!remote,
      update: setUserData,
    }),
    [user, liveToday, products, shop, hydrated, loaded, saveStatus, remote],
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used inside AppDataProvider");
  return value;
}

/**
 * Shows its content only after the saved entries are read.
 * Before that, the page would wrongly say "No tasks yet" or "All clear" to someone who has entries.
 */
export function WhenReady({ children }: { children: ReactNode }) {
  const { ready, saveStatus } = useAppData();
  if (ready) return <>{children}</>;
  if (saveStatus === "load-failed") {
    return (
      <div role="alert" className="rounded-2xl bg-clay-soft p-4 text-sm text-clay ring-1 ring-clay/30">
        <p className="font-semibold">Your saved entries could not be loaded, so nothing is shown and nothing is saved.</p>
        <p className="mt-1">Check the internet connection, then try again.</p>
        <button type="button" onClick={() => void loadRemote()} className="mt-3 rounded-xl bg-forest px-4 py-2 font-semibold text-white hover:bg-sage">
          Try again
        </button>
      </div>
    );
  }
  return (
    <p role="status" className="rounded-2xl bg-white/70 p-4 text-sm text-muted ring-1 ring-line">
      Loading your saved entries…
    </p>
  );
}
