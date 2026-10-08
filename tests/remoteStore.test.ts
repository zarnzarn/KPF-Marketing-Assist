import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RemoteClient, RemoteSave } from "@/lib/store/remote";
import {
  STORAGE_KEY,
  SAVE_DELAY_MS,
  canImportBrowserEntries,
  connectRemote,
  flushSave,
  getSaveStatus,
  getUserData,
  importBrowserEntries,
  isLoaded,
  loadRemote,
  resetUserDataCache,
  setUserData,
} from "@/lib/store/userData";
import { EMPTY_USER_DATA, type UserData } from "@/lib/types";
import { tasks } from "./fixtures";

/** An in-memory stand-in for the user's Supabase row. */
function fakeRemote(initial: UserData | null = null) {
  let row: { data: UserData; version: string } | null = initial ? { data: initial, version: "v1" } : null;
  let n = 1;
  const client = {
    failLoad: false,
    failSave: false,
    saves: [] as UserData[],
    load: vi.fn(async () => {
      if (client.failLoad) throw new Error("offline");
      return row ? { data: row.data, version: row.version } : { data: null, version: null };
    }),
    save: vi.fn(async (data: UserData, version: string | null): Promise<RemoteSave> => {
      if (client.failSave) throw new Error("offline");
      if ((row?.version ?? null) !== version) return { ok: false, conflict: true };
      client.saves.push(data);
      row = { data, version: `v${++n}` };
      return { ok: true, version: row.version };
    }),
    /** Another device saves. */
    changeElsewhere(data: UserData) {
      row = { data, version: `v${++n}` };
    },
  };
  return client as typeof client & RemoteClient;
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const addTask = (title: string) => setUserData((d) => ({ ...d, tasks: [{ ...tasks[0], id: `t-${title}`, title }, ...d.tasks] }));

beforeEach(() => {
  localStorage.clear();
  resetUserDataCache();
});
afterEach(() => {
  vi.useRealTimers();
  resetUserDataCache();
});

describe("online saving", () => {
  it("shows nothing until the saved entries are loaded, then shows them", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: [tasks[1]] })); // browser entries must not flash on screen
    const remote = fakeRemote({ ...EMPTY_USER_DATA, tasks: [tasks[0]] });
    connectRemote(remote, "user-1");
    expect(getSaveStatus()).toBe("loading");
    expect(getUserData()).toEqual(EMPTY_USER_DATA);
    await flush();
    expect(isLoaded()).toBe(true);
    expect(getUserData().tasks).toEqual([tasks[0]]);
  });

  it("saves a moment after a change, then says saved", async () => {
    vi.useFakeTimers();
    const remote = fakeRemote();
    connectRemote(remote, "user-1");
    await vi.runAllTimersAsync();
    addTask("A");
    addTask("B");
    expect(getSaveStatus()).toBe("saving");
    expect(remote.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(remote.save).toHaveBeenCalledTimes(1); // both changes in one save
    expect(remote.saves[0].tasks.map((t) => t.title)).toEqual(["B", "A"]);
    expect(getSaveStatus()).toBe("saved");
  });

  it("never saves over the online entries when they could not be loaded", async () => {
    const remote = fakeRemote({ ...EMPTY_USER_DATA, tasks: [tasks[0]] });
    remote.failLoad = true;
    connectRemote(remote, "user-1");
    await flush();
    expect(getSaveStatus()).toBe("load-failed");
    addTask("A");
    await flushSave();
    expect(remote.save).not.toHaveBeenCalled();
    remote.failLoad = false;
    await loadRemote();
    expect(getSaveStatus()).toBe("saved");
    expect(getUserData().tasks).toEqual([tasks[0]]);
  });

  it("says when a save failed, and saves on Try again", async () => {
    const remote = fakeRemote();
    connectRemote(remote, "user-1");
    await flush();
    remote.failSave = true;
    addTask("A");
    await flushSave();
    expect(getSaveStatus()).toBe("save-failed");
    remote.failSave = false;
    await flushSave();
    expect(getSaveStatus()).toBe("saved");
    expect(remote.saves.at(-1)?.tasks[0].title).toBe("A");
  });

  it("shows the newer entries from another device instead of overwriting them", async () => {
    const remote = fakeRemote({ ...EMPTY_USER_DATA });
    connectRemote(remote, "user-1");
    await flush();
    remote.changeElsewhere({ ...EMPTY_USER_DATA, tasks: [tasks[2]] });
    addTask("Mine");
    await flushSave();
    expect(getSaveStatus()).toBe("conflict");
    expect(getUserData().tasks).toEqual([tasks[2]]);
  });

  it("picks up changes from another device when nothing here is unsaved", async () => {
    const remote = fakeRemote({ ...EMPTY_USER_DATA });
    connectRemote(remote, "user-1");
    await flush();
    remote.changeElsewhere({ ...EMPTY_USER_DATA, tasks: [tasks[3]] });
    await loadRemote();
    expect(getUserData().tasks).toEqual([tasks[3]]);
  });

  it("moves browser entries to an empty account, then removes the browser copy", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: [tasks[0]] }));
    const remote = fakeRemote();
    connectRemote(remote, "user-1");
    await flush();
    expect(canImportBrowserEntries()).toBe(true);
    await expect(importBrowserEntries()).resolves.toBe(true);
    expect(remote.saves.at(-1)?.tasks).toEqual([tasks[0]]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(canImportBrowserEntries()).toBe(false);
  });

  it("does not offer the move when the account already has entries", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: [tasks[0]] }));
    connectRemote(fakeRemote({ ...EMPTY_USER_DATA, tasks: [tasks[1]] }), "user-1");
    await flush();
    expect(canImportBrowserEntries()).toBe(false);
  });

  it("keeps the browser copy when the move could not be saved", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: [tasks[0]] }));
    const remote = fakeRemote();
    connectRemote(remote, "user-1");
    await flush();
    remote.failSave = true;
    await expect(importBrowserEntries()).resolves.toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});
