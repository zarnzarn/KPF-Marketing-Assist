// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DATA_NOT_AVAILABLE } from "@/lib/constants";
import { fixtureUserData } from "./fixtures";
import { makeDocx, sampleReportParts } from "./helpers/makeDocx";

// Everything outside the app is replaced: login, channels, reports, Ollama, Supabase. Synthetic data only.
const viewer = { current: { mode: "online", userId: "u1", email: "director@example.com" } as Record<string, string> };
vi.mock("@/lib/auth/session", () => ({ requireViewer: async () => viewer.current }));
vi.mock("@/lib/data/server", () => ({
  viewerChannels: async () => [{ channel: "line", label: "LINE OA", status: "connected", metrics: [{ label: "Friends", value: "1,234" }], items: [] }],
  viewerReports: async () => ({ source: "none", reports: [], warnings: [], notes: [] }),
}));
const ollamaChat = vi.fn();
vi.mock("@/lib/ai/ollama", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/ollama")>()), ollamaChat: (...a: unknown[]) => ollamaChat(...a) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const storage = { download: vi.fn(), remove: vi.fn() };
const db: { rows: Record<string, unknown>[]; upserts: unknown[]; failUpsert: boolean } = { rows: [], upserts: [], failUpsert: false };
vi.mock("@/lib/supabase/server", () => ({
  serverSupabase: async () => ({
    storage: { from: () => storage },
    from: () => {
      const b: Record<string, unknown> = {};
      for (const n of ["select", "eq", "delete"]) b[n] = () => b;
      b.maybeSingle = async () => ({ data: db.rows[0] ?? null, error: null });
      b.upsert = async (row: unknown) => (db.failUpsert ? { error: { message: "x" } } : (db.upserts.push(row), { error: null }));
      b.then = (r: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(r);
      return b;
    },
  }),
}));

beforeEach(() => {
  vi.stubEnv("OLLAMA_API_KEY", "test-ollama-key-1234567890");
  ollamaChat.mockReset();
  storage.download.mockReset();
  storage.remove.mockReset();
  db.rows = [];
  db.upserts = [];
  db.failUpsert = false;
  viewer.current = { mode: "online", userId: "u1", email: "director@example.com" };
});
afterEach(() => vi.unstubAllEnvs());

describe("askSecretary", () => {
  it("answers with checked, labelled lines from Ollama", async () => {
    ollamaChat.mockResolvedValue("FACT: LINE OA has 1,234 friends.\nFACT: LINE OA has 9,999 friends.\nRECOMMENDATION: Post twice a week.");
    const { askSecretary } = await import("@/app/(app)/secretary/actions");
    const answer = await askSecretary("How is LINE doing?", fixtureUserData, "2026-10-06");
    expect(answer.tool).toBe("ai");
    expect(answer.blocks[0]).toEqual({ label: "FACT", text: "LINE OA has 1,234 friends." });
    expect(answer.blocks[1].label).toBe("ESTIMATE"); // 9,999 is not in the data
    expect(answer.sources).toEqual([{ kind: "Channel", id: "line", label: "LINE OA", href: "/channels" }]);
    const [messages] = ollamaChat.mock.calls[0];
    expect(messages[0].role).toBe("system");
    expect(messages[1].content).toContain(fixtureUserData.tasks[0].title);
  });

  it("falls back to the rule-based answer, and says why, when Ollama fails", async () => {
    const { ChannelError } = await import("@/lib/channels/readOnlyFetch");
    ollamaChat.mockRejectedValue(new ChannelError("The service did not answer in time.", "timeout"));
    const { askSecretary } = await import("@/app/(app)/secretary/actions");
    const answer = await askSecretary("Tell me something", fixtureUserData, "2026-10-06");
    expect(answer.tool).not.toBe("ai");
    expect(answer.blocks.at(-1)).toEqual({ label: "DATA GAP", text: `AI answer: ${DATA_NOT_AVAILABLE} (The service did not answer in time.)` });
  });

  it("does not call Ollama without a key", async () => {
    vi.stubEnv("OLLAMA_API_KEY", "");
    const { askSecretary } = await import("@/app/(app)/secretary/actions");
    const answer = await askSecretary("Tell me something", fixtureUserData, "2026-10-06");
    expect(ollamaChat).not.toHaveBeenCalled();
    expect(answer.blocks.at(-1)?.text).toContain("add OLLAMA_API_KEY");
  });

  it("ignores broken entries and an odd date from the browser", async () => {
    ollamaChat.mockResolvedValue("ANALYSIS: ok");
    const { askSecretary } = await import("@/app/(app)/secretary/actions");
    await askSecretary("Hi there", { tasks: "not a list", meetings: [{ no: "id" }] }, "<script>");
    const context = ollamaChat.mock.calls[0][0][1].content as string;
    expect(context).toMatch(/Today \(Thailand\): \d{4}-\d{2}-\d{2}/);
    expect(context).toContain("Tasks: []");
  });
});

describe("processReport", () => {
  const PATH = "u1/1700000000000-Marketing_Report.docx";

  it("reads an uploaded report once and saves it for its month", async () => {
    const buf = await makeDocx(sampleReportParts("1-30 September 2026"));
    storage.download.mockResolvedValue({ data: new Blob([new Uint8Array(buf)]), error: null });
    const { processReport } = await import("@/app/(app)/reports/actions");
    await expect(processReport(PATH, "Marketing_Report.docx")).resolves.toMatchObject({ ok: true });
    expect(db.upserts[0]).toMatchObject({ user_id: "u1", id: "2026-09", file_path: PATH });
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("replaces the old file when a month is uploaded again", async () => {
    db.rows = [{ file_path: "u1/old.docx" }];
    storage.download.mockResolvedValue({ data: new Blob([new Uint8Array(await makeDocx(sampleReportParts()))]), error: null });
    const { processReport } = await import("@/app/(app)/reports/actions");
    await processReport(PATH, "Marketing_Report.docx");
    expect(storage.remove).toHaveBeenCalledWith(["u1/old.docx"]);
  });

  it("refuses a path outside the user's own folder without touching storage", async () => {
    const { processReport } = await import("@/app/(app)/reports/actions");
    await expect(processReport("u2/x.docx", "x.docx")).resolves.toMatchObject({ ok: false });
    await expect(processReport("u1/../u2/x.docx", "x.docx")).resolves.toMatchObject({ ok: false });
    expect(storage.download).not.toHaveBeenCalled();
  });

  it("removes a file that is not a marketing report and says why", async () => {
    storage.download.mockResolvedValue({ data: new Blob([new Uint8Array(Buffer.from("not a zip"))]), error: null });
    const { processReport } = await import("@/app/(app)/reports/actions");
    const result = await processReport(PATH, "notes.docx");
    expect(result).toMatchObject({ ok: false });
    expect(storage.remove).toHaveBeenCalledWith([PATH]);
    expect(db.upserts).toEqual([]);
  });

  it("is not used in local mode", async () => {
    viewer.current = { mode: "local" };
    const { processReport, deleteReport } = await import("@/app/(app)/reports/actions");
    await expect(processReport(PATH, "x.docx")).resolves.toMatchObject({ ok: false });
    await expect(deleteReport("2026-09")).resolves.toMatchObject({ ok: false });
  });

  it("deletes only a real month id", async () => {
    const { deleteReport } = await import("@/app/(app)/reports/actions");
    await expect(deleteReport("../x")).resolves.toMatchObject({ ok: false, message: "Unknown report." });
    db.rows = [{ file_path: "u1/a.docx" }];
    await expect(deleteReport("2026-09")).resolves.toMatchObject({ ok: true });
    expect(storage.remove).toHaveBeenCalledWith(["u1/a.docx"]);
  });
});
