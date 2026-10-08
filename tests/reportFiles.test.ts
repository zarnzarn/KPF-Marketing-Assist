import { describe, expect, it } from "vitest";
import { MAX_REPORT_BYTES, checkReportFile, isOwnPath, storagePath } from "@/lib/reports/fileRules";
import { isStoredReport } from "@/lib/reports/onlineReports";
import { readUploadedReport } from "@/lib/reports/upload";
import { makeDocx, sampleReportParts } from "./helpers/makeDocx";

const UID = "00000000-0000-4000-8000-000000000001";

describe("report file checks before upload", () => {
  it("accepts a Word file up to 10 MB", () => {
    expect(checkReportFile("Marketing_Report_Sep.docx", 2_000_000)).toBeNull();
    expect(checkReportFile("REPORT.DOCX", MAX_REPORT_BYTES)).toBeNull();
  });
  it.each([
    ["report.pdf", 100, "Word file"],
    ["~$report.docx", 100, "lock file"],
    ["report.docx", 0, "empty"],
    ["report.docx", MAX_REPORT_BYTES + 1, "10 MB"],
  ])("refuses %s (%i bytes)", (name, size, words) => {
    expect(checkReportFile(name, size)).toContain(words);
  });
});

describe("storage paths", () => {
  it("puts the file in the user's own folder with a safe name", () => {
    expect(storagePath(UID, "Marketing Report ก.ย. 2026 (final).docx", 1700000000000)).toMatch(new RegExp(`^${UID}/1700000000000-[\\w.-]+\\.docx$`));
    const tricky = storagePath(UID, "../../etc/passwd.docx", 1);
    expect(tricky).not.toContain("..");
    expect(isOwnPath(UID, tricky)).toBe(true);
  });
  it("refuses paths outside the user's folder or with tricks", () => {
    for (const p of [`other/${UID}.docx`, `${UID}/../x.docx`, `${UID}/a/b.docx`, `${UID}\\x.docx`, `${UID}x/y.docx`, "x.docx"]) expect(isOwnPath(UID, p)).toBe(false);
  });
});

describe("reading an uploaded report", () => {
  it("reads a synthetic marketing report and sets its month as its id", async () => {
    const result = await readUploadedReport(await makeDocx(sampleReportParts("1-30 September 2026")), "upload.docx");
    expect("report" in result && result.report).toMatchObject({ id: "2026-09", month: "2026-09" });
  });
  it("refuses a file that is not a Word document", async () => {
    const result = await readUploadedReport(Buffer.from("not a zip"), "notes.docx");
    expect("problem" in result && result.problem).toContain("could not be read");
  });
  it("refuses a Word file that is not a marketing report", async () => {
    const result = await readUploadedReport(await makeDocx([{ p: "KLONG PHAI FARM", bold: true }, { p: "Meeting notes 1-30 September 2026" }, { p: "Synthetic notes from a synthetic meeting." }]), "notes.docx");
    expect("problem" in result && result.problem).toContain("does not look like a monthly marketing report");
  });
  it("refuses a marketing report without a readable month", async () => {
    const result = await readUploadedReport(await makeDocx([{ p: "Marketing Report" }, { p: "No dates here." }]), "Marketing_Report.docx");
    expect("problem" in result && result.problem).toContain("month could not be read");
  });
  it("only shows stored reports that still have the report shape", async () => {
    const good = await readUploadedReport(await makeDocx(sampleReportParts()), "r.docx");
    expect(isStoredReport("report" in good ? good.report : null)).toBe(true);
    for (const bad of [null, "text", { id: "x" }, { id: "x", title: "t", month: "m", intro: [], sections: "no" }]) expect(isStoredReport(bad)).toBe(false);
  });
});
