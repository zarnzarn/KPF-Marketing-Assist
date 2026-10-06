"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { getServerUserData, getUserData, setUserData, subscribe } from "@/lib/store/userData";
import type { AppData, Product, UserData } from "@/lib/types";

interface AppDataContextValue {
  data: AppData;
  /** False during the first render, before this browser's saved entries are read. */
  ready: boolean;
  update: (fn: (data: UserData) => UserData) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);
const noop = () => () => {};

export function AppDataProvider({ today, products = [], children }: { today: string; products?: Product[]; children: ReactNode }) {
  const user = useSyncExternalStore(subscribe, getUserData, getServerUserData);
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const value = useMemo<AppDataContextValue>(
    () => ({ data: { ...user, today, products }, ready, update: setUserData }),
    [user, today, products, ready],
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used inside AppDataProvider");
  return value;
}
