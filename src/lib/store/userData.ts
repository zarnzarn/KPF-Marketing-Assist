// The user's own entries (tasks, meetings, customers...). Stored ONLY in this
// browser's localStorage. Nothing here is sent anywhere.
// Pure helpers first (easy to test), then a tiny external store for React.

import { EMPTY_USER_DATA, type UserData } from "../types";

export const STORAGE_KEY = "kpf-user-data-v1";
type ListKey = keyof UserData;
type Item<K extends ListKey> = UserData[K][number];

/** Reads saved data. Anything missing, broken or of the wrong shape becomes an empty list. */
export function parseUserData(raw: string | null): UserData {
  if (!raw) return EMPTY_USER_DATA;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_USER_DATA;
  }
  if (!parsed || typeof parsed !== "object") return EMPTY_USER_DATA;
  const source = parsed as Record<string, unknown>;
  const result = { ...EMPTY_USER_DATA };
  for (const key of Object.keys(EMPTY_USER_DATA) as ListKey[]) {
    const list = source[key];
    (result as Record<ListKey, unknown[]>)[key] = Array.isArray(list)
      ? list.filter((item) => item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string")
      : [];
  }
  return result;
}

export function addItem<K extends ListKey>(data: UserData, key: K, item: Item<K>): UserData {
  return { ...data, [key]: [item, ...data[key]] };
}

export function updateItem<K extends ListKey>(data: UserData, key: K, id: string, patch: Partial<Item<K>>): UserData {
  if (!data[key].some((x) => x.id === id)) throw new Error(`${key}: ${id} not found.`);
  return { ...data, [key]: data[key].map((x) => (x.id === id ? { ...x, ...patch } : x)) };
}

export function removeItem<K extends ListKey>(data: UserData, key: K, id: string): UserData {
  return { ...data, [key]: data[key].filter((x) => x.id !== id) };
}

export function newId(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

// ---------- external store (browser only) ----------

let current: UserData | null = null;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // private mode or blocked storage: work in memory only
  }
}

export function getUserData(): UserData {
  if (current === null) {
    try {
      current = parseUserData(storage()?.getItem(STORAGE_KEY) ?? null);
    } catch {
      current = EMPTY_USER_DATA;
    }
  }
  return current;
}

export const getServerUserData = () => EMPTY_USER_DATA;

export function setUserData(update: (data: UserData) => UserData): void {
  current = update(getUserData());
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // storage full or blocked: keep the change in memory for this visit
  }
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      current = parseUserData(e.newValue);
      listener();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** For tests: forget the in-memory copy so the next read comes from storage again. */
export function resetUserDataCache(): void {
  current = null;
}
