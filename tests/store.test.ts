import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EMPTY_USER_DATA } from "@/lib/types";
import {
  STORAGE_KEY,
  addItem,
  getServerUserData,
  getUserData,
  newId,
  parseUserData,
  removeItem,
  resetUserDataCache,
  setUserData,
  subscribe,
  updateItem,
} from "@/lib/store/userData";
import { fixtureUserData, tasks } from "./fixtures";

beforeEach(() => {
  localStorage.clear();
  resetUserDataCache();
});
afterEach(() => resetUserDataCache());

describe("parseUserData", () => {
  it("returns empty lists for nothing saved, broken JSON or the wrong shape", () => {
    expect(parseUserData(null)).toEqual(EMPTY_USER_DATA);
    expect(parseUserData("{not json")).toEqual(EMPTY_USER_DATA);
    expect(parseUserData("42")).toEqual(EMPTY_USER_DATA);
    expect(parseUserData('"text"')).toEqual(EMPTY_USER_DATA);
  });

  it("keeps valid lists and drops items without an id", () => {
    const parsed = parseUserData(JSON.stringify({ tasks: [tasks[0], { title: "no id" }, null, 5], meetings: "not a list" }));
    expect(parsed.tasks).toEqual([tasks[0]]);
    expect(parsed.meetings).toEqual([]);
    expect(parsed.customers).toEqual([]);
  });

  it("round-trips saved data", () => {
    expect(parseUserData(JSON.stringify(fixtureUserData))).toEqual(fixtureUserData);
  });
});

describe("pure list helpers", () => {
  it("adds to the top without changing the original", () => {
    const next = addItem(EMPTY_USER_DATA, "tasks", tasks[0]);
    expect(next.tasks).toEqual([tasks[0]]);
    expect(EMPTY_USER_DATA.tasks).toEqual([]);
  });
  it("updates and removes by id", () => {
    const data = { ...EMPTY_USER_DATA, tasks: [tasks[0], tasks[1]] };
    expect(updateItem(data, "tasks", tasks[1].id, { title: "Changed" }).tasks[1].title).toBe("Changed");
    expect(removeItem(data, "tasks", tasks[0].id).tasks).toEqual([tasks[1]]);
  });
  it("throws when updating an unknown id", () => {
    expect(() => updateItem(EMPTY_USER_DATA, "tasks", "nope", { title: "x" })).toThrow("not found");
  });
  it("creates unique ids with a prefix", () => {
    const a = newId("tsk");
    expect(a.startsWith("tsk-")).toBe(true);
    expect(newId("tsk")).not.toBe(a);
  });
});

describe("browser store", () => {
  it("the server snapshot is always empty (hydration-safe)", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fixtureUserData));
    expect(getServerUserData()).toEqual(EMPTY_USER_DATA);
  });

  it("reads what is saved in this browser", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fixtureUserData));
    expect(getUserData().tasks).toHaveLength(fixtureUserData.tasks.length);
  });

  it("saves changes, keeps the same object until a change, and notifies listeners", () => {
    const first = getUserData();
    expect(getUserData()).toBe(first);
    let calls = 0;
    const stop = subscribe(() => calls++);
    setUserData((u) => addItem(u, "tasks", tasks[0]));
    expect(calls).toBe(1);
    expect(getUserData()).not.toBe(first);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).tasks).toEqual([tasks[0]]);
    stop();
    setUserData((u) => u);
    expect(calls).toBe(1);
  });

  it("falls back to empty data when saved data is corrupt", () => {
    localStorage.setItem(STORAGE_KEY, "{corrupt");
    expect(getUserData()).toEqual(EMPTY_USER_DATA);
  });
});
