import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadReports, pickReport, reportsDir } from "@/lib/reports/loadReports";
import { monthFromText } from "@/lib/reports/parseReport";
import { makeDocx, sampleReportParts } from "./helpers/makeDocx";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "kpf-reports-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("loadReports", () => {
  it("reads every .docx, newest month first", async () => {
    await writeFile(path.join(dir, "Marketing_Report_Aug.docx"), await makeDocx(sampleReportParts("1-31 August 2026")));
    await writeFile(path.join(dir, "Marketing_Report_Sep.docx"), await makeDocx(sampleReportParts("1-30 September 2026")));
    const result = await loadReports(dir);
    expect(result.source).toBe("local");
    expect(result.reports.map((r) => r.month)).toEqual(["2026-09", "2026-08"]);
    expect(result.warnings).toEqual([]);
  });

  it("ignores Word lock files and other file types", async () => {
    await writeFile(path.join(dir, "Marketing_Report_Sep.docx"), await makeDocx(sampleReportParts()));
    await writeFile(path.join(dir, "~$Marketing_Report_Sep.docx"), "lock file, not a real document");
    await writeFile(path.join(dir, "notes.txt"), "hello");
    await writeFile(path.join(dir, "sheet.xlsx"), "not a word file");
    const result = await loadReports(dir);
    expect(result.reports).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it("warns about a broken file but still returns the good ones", async () => {
    await writeFile(path.join(dir, "good.docx"), await makeDocx(sampleReportParts()));
    await writeFile(path.join(dir, "broken.docx"), "this is not a zip file");
    const result = await loadReports(dir);
    expect(result.source).toBe("local");
    expect(result.reports).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("broken.docx");
  });

  it("falls back to the mock sample when the folder does not exist", async () => {
    const result = await loadReports(path.join(dir, "does-not-exist"));
    expect(result.source).toBe("mock");
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].isMock).toBe(true);
  });

  it("falls back to the mock sample when the folder has no reports", async () => {
    const result = await loadReports(dir);
    expect(result.source).toBe("mock");
  });

  it("falls back to the mock sample but keeps the warning when every file is broken", async () => {
    await writeFile(path.join(dir, "broken.docx"), "nope");
    const result = await loadReports(dir);
    expect(result.source).toBe("mock");
    expect(result.warnings).toHaveLength(1);
  });

  it("picks up a changed file instead of using stale cache", async () => {
    const file = path.join(dir, "Marketing_Report.docx");
    await writeFile(file, await makeDocx(sampleReportParts("1-30 September 2026")));
    expect((await loadReports(dir)).reports[0].month).toBe("2026-09");
    await writeFile(file, await makeDocx([...sampleReportParts("1-31 October 2026"), { p: "Extra line to change the file size." }]));
    expect((await loadReports(dir)).reports[0].month).toBe("2026-10");
  });
});

describe("monthly sub-folders (like D:/Report/2026/Sep - 2026)", () => {
  const put = async (rel: string, parts = sampleReportParts()) => {
    const file = path.join(dir, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, await makeDocx(parts));
    return file;
  };

  it("finds reports inside month folders", async () => {
    await put("Aug - 2026/Marketing_Report_1-31_Aug_2026.docx", sampleReportParts("1-31 August 2026"));
    await put("Sep - 2026/Marketing_Report_01-30_Sep_2026.docx", sampleReportParts("1-30 September 2026"));
    const result = await loadReports(dir);
    expect(result.source).toBe("local");
    expect(result.reports.map((r) => r.month)).toEqual(["2026-09", "2026-08"]);
  });

  it("skips Word files that are not marketing reports, and says so", async () => {
    await put("Sep - 2026/Marketing_Report_Sep.docx");
    await put("Sep - 2026/Source_Online_Sales.docx", [{ p: "Sales source notes" }, { p: "Some numbers" }]);
    const result = await loadReports(dir);
    expect(result.reports).toHaveLength(1);
    expect(result.warnings).toEqual([]);
    expect(result.notes).toEqual(["1 other Word file was skipped because it is not a marketing report."]);
  });

  it("uses the folder name for the month when the title has no date range", async () => {
    await put("Mar - 2026/Marketing_Report.docx", [{ p: "Marketing Report" }, { p: "1  Executive Summary", bold: true }, { p: "Some text." }]);
    const result = await loadReports(dir);
    expect(result.reports[0].month).toBe("2026-03");
    expect(result.reports[0].id).toBe("2026-03");
  });

  it("keeps the newest file when a month has two reports", async () => {
    const older = await put("Sep - 2026/Marketing_Report_draft.docx");
    const newer = await put("Sep - 2026/Marketing_Report_final.docx");
    await utimes(older, new Date("2026-10-01"), new Date("2026-10-01"));
    await utimes(newer, new Date("2026-10-05"), new Date("2026-10-05"));
    const result = await loadReports(dir);
    expect(result.reports).toHaveLength(1);
    expect(result.notes[0]).toContain("Marketing_Report_final.docx");
  });

  it("shows the folder in a warning when a file inside a month folder is broken", async () => {
    await put("Sep - 2026/Marketing_Report_good.docx");
    await mkdir(path.join(dir, "Oct - 2026"));
    await writeFile(path.join(dir, "Oct - 2026", "Marketing_Report_bad.docx"), "not a word file");
    const result = await loadReports(dir);
    expect(result.reports).toHaveLength(1);
    expect(result.warnings[0]).toContain("Oct - 2026");
    expect(result.warnings[0]).toContain("Marketing_Report_bad.docx");
  });

  it("does not look deeper than 3 levels, or inside hidden folders", async () => {
    await put("a/b/c/d/Marketing_Report_too_deep.docx");
    await put(".hidden/Marketing_Report_hidden.docx");
    const result = await loadReports(dir);
    expect(result.source).toBe("mock");
  });
});

describe("monthFromText", () => {
  it.each([
    ["Mar - 2026", "2026-03"],
    ["Sep-2026", "2026-09"],
    ["Aug - 2026/Marketing_Report.docx", "2026-08"],
    ["September 2026", "2026-09"],
    ["Dec_2025", "2025-12"],
  ])("%s -> %s", (text, month) => {
    expect(monthFromText(text)).toBe(month);
  });
  it("returns an empty string when there is no month and year", () => {
    expect(monthFromText("Monthly report")).toBe("");
    expect(monthFromText("2026")).toBe("");
  });
});

describe("reportsDir", () => {
  it("uses REPORTS_DIR when set, without surrounding quotes", () => {
    expect(reportsDir({ REPORTS_DIR: "D:/Report/Monthly report" })).toBe("D:/Report/Monthly report");
    expect(reportsDir({ REPORTS_DIR: '"D:/Report/Monthly report"' })).toBe("D:/Report/Monthly report");
  });
  it("defaults to the private folder when empty or missing", () => {
    expect(reportsDir({ REPORTS_DIR: "  " })).toContain(path.join("data", "private", "reports"));
    expect(reportsDir({})).toContain(path.join("data", "private", "reports"));
  });
});

describe("pickReport", () => {
  it("picks the requested month, or the newest when it is missing or unknown", async () => {
    await writeFile(path.join(dir, "a.docx"), await makeDocx(sampleReportParts("1-31 August 2026")));
    await writeFile(path.join(dir, "b.docx"), await makeDocx(sampleReportParts("1-30 September 2026")));
    const { reports } = await loadReports(dir);
    expect(pickReport(reports, "2026-08").month).toBe("2026-08");
    expect(pickReport(reports, undefined).month).toBe("2026-09");
    expect(pickReport(reports, "1999-01").month).toBe("2026-09");
  });
});
