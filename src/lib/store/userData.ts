// The user's own entries (tasks, meetings, customers...). Saved in this browser (local mode)
// or in the user's own Supabase row (online mode). Nothing here is sent anywhere else.
// Pure helpers first (easy to test), then a tiny external store for React.

import { EMPTY_USER_DATA, type UserData } from "../types";
import type { RemoteClient } from "./remote";

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
  return parseUserDataValue(parsed);
}

/** The same checks for data that is already an object (for example the online database row). */
export function parseUserDataValue(parsed: unknown): UserData {
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
// Local mode keeps entries in this browser (localStorage). Online mode keeps them in the user's
// Supabase row (see remote.ts): changes are saved a moment after they are made, and the screen
// always says whether they were saved.

/**
 * local / local-failed: this browser's storage (failed = the browser refused to save).
 * loading / load-failed: online, reading the saved entries. Nothing is saved until loading worked.
 * saving / saved / save-failed: online, the state of the last change.
 * conflict: online, another device saved first; its newer entries were loaded instead.
 */
export type SaveStatus = "local" | "local-failed" | "loading" | "load-failed" | "saving" | "saved" | "save-failed" | "conflict";

let current: UserData | null = null;
let status: SaveStatus = "local";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// online mode only
let remote: RemoteClient | null = null;
let remoteKey = "";
let version: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
let dirty = false;
export const SAVE_DELAY_MS = 600;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // private mode or blocked storage: work in memory only
  }
}

export function getUserData(): UserData {
  if (current === null) {
    if (remote) return EMPTY_USER_DATA; // online: nothing is shown until the saved entries arrive
    const store = storage();
    if (typeof window !== "undefined" && !store) status = "local-failed";
    try {
      current = parseUserData(store?.getItem(STORAGE_KEY) ?? null);
    } catch {
      current = EMPTY_USER_DATA;
      status = "local-failed";
    }
  }
  return current;
}

export function getSaveStatus(): SaveStatus {
  getUserData();
  return status;
}

/** True when the entries on screen are the saved ones (local mode, or online after loading worked). */
export const isLoaded = () => !["loading", "load-failed"].includes(getSaveStatus());

/** Kept for the local banner: false when this browser refused to save. */
export const isStorageOk = () => getSaveStatus() !== "local-failed";

export const getServerUserData = () => EMPTY_USER_DATA;

export function setUserData(update: (data: UserData) => UserData): void {
  if (remote && !isLoaded()) return; // never save over the online entries before they were read
  current = update(getUserData());
  if (remote) {
    status = "saving";
    scheduleSave();
  } else {
    const store = storage();
    try {
      if (!store) throw new Error("no storage");
      store.setItem(STORAGE_KEY, JSON.stringify(current));
      status = "local";
    } catch {
      status = "local-failed"; // storage full or blocked: the change lasts only for this visit, and the app says so
    }
  }
  notify();
}

function scheduleSave() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flushSave();
  }, SAVE_DELAY_MS);
}

/** Saves the latest entries now. Resolves when every pending change has been tried. */
export async function flushSave(): Promise<void> {
  if (!remote || !isLoaded()) return; // never save before the online entries were read: that would overwrite them
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (inFlight) {
    dirty = true; // save again with the newest entries when this one finishes
    return inFlight;
  }
  const client = remote;
  const snapshot = getUserData();
  inFlight = (async () => {
    try {
      const result = await client.save(snapshot, version);
      if (client !== remote) return;
      if (result.ok) {
        version = result.version;
        status = dirty ? "saving" : "saved";
      } else {
        // Another device saved first: show its newer entries rather than overwrite them.
        dirty = false;
        const latest = await client.load();
        current = parseUserDataValue(latest.data);
        version = latest.version;
        status = "conflict";
      }
    } catch {
      if (client === remote) status = "save-failed";
    } finally {
      inFlight = null;
      notify();
    }
    if (dirty && client === remote && status === "saving") {
      dirty = false;
      await flushSave();
    }
  })();
  return inFlight;
}

/**
 * Switches this tab to online saving for one user. Safe to call more than once for the same user.
 * The entries are read straight away; until then nothing is shown or saved.
 */
export function connectRemote(client: RemoteClient, key: string): void {
  if (remote && remoteKey === key) return;
  remote = client;
  remoteKey = key;
  current = null;
  version = null;
  dirty = false;
  status = "loading";
  void loadRemote();
}

/** (Re)reads the online entries. Used at start, by "Try again", and when the tab comes back into view. */
export async function loadRemote(): Promise<void> {
  const client = remote;
  if (!client) return;
  if (status === "saving" || inFlight || timer) return; // never replace changes that are not saved yet
  const first = status === "loading" || status === "load-failed";
  if (status === "load-failed") {
    status = "loading";
    notify();
  }
  try {
    const loaded = await client.load();
    if (client !== remote) return;
    if (!first && loaded.version === version) return; // nothing new
    current = parseUserDataValue(loaded.data);
    version = loaded.version;
    if (first || status === "conflict") status = "saved";
  } catch {
    if (client === remote && first) status = "load-failed";
  }
  notify();
}

/** Entries still kept in this browser from local mode (empty when there are none). */
export function browserEntries(): UserData {
  return parseUserData(storage()?.getItem(STORAGE_KEY) ?? null);
}

const hasEntries = (d: UserData) => Object.values(d).some((list) => list.length > 0);

/** True when this browser still has local entries and the online account has none yet. */
export function canImportBrowserEntries(): boolean {
  return !!remote && getSaveStatus() === "saved" && !hasEntries(getUserData()) && hasEntries(browserEntries());
}

/** Moves the entries kept in this browser to the online account. The browser copy is removed only after they were saved. */
export async function importBrowserEntries(): Promise<boolean> {
  if (!canImportBrowserEntries()) return false;
  const entries = browserEntries();
  setUserData(() => entries);
  await flushSave();
  if (getSaveStatus() !== "saved") return false;
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // the copy stays; harmless
  }
  notify();
  return true;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (remote) return; // online entries do not live in this browser
    // key === null means another tab cleared all storage; re-read so the next edit cannot bring old data back.
    if (e.key === null || e.key === STORAGE_KEY) {
      try {
        current = parseUserData(storage()?.getItem(STORAGE_KEY) ?? null);
      } catch {
        current = EMPTY_USER_DATA;
      }
      listener();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** For tests: forget everything held in memory (and leave online mode). */
export function resetUserDataCache(): void {
  if (timer) clearTimeout(timer);
  current = null;
  status = "local";
  remote = null;
  remoteKey = "";
  version = null;
  timer = null;
  inFlight = null;
  dirty = false;
}
