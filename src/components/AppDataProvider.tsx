"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { getServerUserData, getUserData, isStorageOk, setUserData, subscribe } from "@/lib/store/userData";
import { todayInThailand } from "@/lib/today";
import type { AppData, Product, ShopState, UserData } from "@/lib/types";

interface AppDataContextValue {
  data: AppData;
  /** False during the first render, before this browser's saved entries are read. */
  ready: boolean;
  /** False when this browser refused to save (storage full or blocked). Entries then last only for this visit. */
  storageOk: boolean;
  update: (fn: (data: UserData) => UserData) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);
const noop = () => () => {};

let firstSeenToday: string | null = null;

/**
 * The server's date stays in use until the real date in Thailand moves on (for example past midnight
 * with the tab left open). Layouts do not re-render on navigation, so the server value alone would freeze.
 */
function clientToday(serverToday: string): string {
  const now = todayInThailand();
  firstSeenToday ??= now;
  return now === firstSeenToday ? serverToday : now;
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

export function AppDataProvider({ today, products = [], shop, children }: { today: string; products?: Product[]; shop?: ShopState; children: ReactNode }) {
  const user = useSyncExternalStore(subscribe, getUserData, getServerUserData);
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const storageOk = useSyncExternalStore(subscribe, isStorageOk, () => true);
  const liveToday = useSyncExternalStore(subscribeToday, () => clientToday(today), () => today);
  const value = useMemo<AppDataContextValue>(
    () => ({ data: { ...user, today: liveToday, products, shop }, ready, storageOk, update: setUserData }),
    [user, liveToday, products, shop, ready, storageOk],
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used inside AppDataProvider");
  return value;
}

/**
 * Shows its content only after this browser's saved entries are read.
 * Before that, the page would wrongly say "No tasks yet" or "All clear" to someone who has entries.
 */
export function WhenReady({ children }: { children: ReactNode }) {
  const { ready } = useAppData();
  if (ready) return <>{children}</>;
  return (
    <p role="status" className="rounded-2xl bg-white/70 p-4 text-sm text-muted ring-1 ring-line">
      Loading your saved entries…
    </p>
  );
}
