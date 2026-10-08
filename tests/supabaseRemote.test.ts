import { describe, expect, it } from "vitest";
import { supabaseRemote } from "@/lib/store/remote";
import { EMPTY_USER_DATA } from "@/lib/types";
import { fakeSupabase } from "./helpers/fakeSupabase";

const UID = "user-1";

describe("saving entries in Supabase", () => {
  it("reads only the user's own row", async () => {
    const { client, queries } = fakeSupabase(() => ({ data: { data: { tasks: [] }, updated_at: "2026-10-06T03:00:00.123456+00:00" } }));
    await expect(supabaseRemote(client, UID).load()).resolves.toEqual({ data: { tasks: [] }, version: "2026-10-06T03:00:00.123456+00:00" });
    expect(queries[0]).toMatchObject({ table: "user_data", steps: [["select", "data, updated_at"], ["eq", "user_id", UID], ["maybeSingle"]] });
  });

  it("starts empty when nothing is saved yet, and says so when the database cannot be reached", async () => {
    await expect(supabaseRemote(fakeSupabase(() => ({ data: null })).client, UID).load()).resolves.toEqual({ data: null, version: null });
    await expect(supabaseRemote(fakeSupabase(() => ({ error: { message: "x" } })).client, UID).load()).rejects.toThrow();
  });

  it("creates the row on the first save", async () => {
    const { client, queries } = fakeSupabase(() => ({ data: { updated_at: "v2" } }));
    await expect(supabaseRemote(client, UID).save(EMPTY_USER_DATA, null)).resolves.toEqual({ ok: true, version: "v2" });
    expect(queries[0].steps[0]).toEqual(["insert", { user_id: UID, data: EMPTY_USER_DATA }]);
  });

  it("reports a conflict when another device created the row first", async () => {
    const { client } = fakeSupabase(() => ({ error: { code: "23505" } }));
    await expect(supabaseRemote(client, UID).save(EMPTY_USER_DATA, null)).resolves.toEqual({ ok: false, conflict: true });
  });

  it("updates only if nobody saved since the version it read", async () => {
    const { client, queries } = fakeSupabase(() => ({ data: [{ updated_at: "v3" }] }));
    await expect(supabaseRemote(client, UID).save(EMPTY_USER_DATA, "v2")).resolves.toEqual({ ok: true, version: "v3" });
    expect(queries[0].steps).toEqual([["update", { data: EMPTY_USER_DATA }], ["eq", "user_id", UID], ["eq", "updated_at", "v2"], ["select", "updated_at"]]);
  });

  it("reports a conflict when the row changed in between", async () => {
    const { client } = fakeSupabase(() => ({ data: [] }));
    await expect(supabaseRemote(client, UID).save(EMPTY_USER_DATA, "v2")).resolves.toEqual({ ok: false, conflict: true });
  });
});
