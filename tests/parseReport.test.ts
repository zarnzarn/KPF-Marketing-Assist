import { describe, expect, it } from "vitest";
import { ReportParseError, monthFromTitle, parseReport, parseThb } from "@/lib/reports/parseReport";
import { makeDocx, sampleReportParts } from "./helpers/makeDocx";

describe("parseReport (synthetic report)", () => {
  it("reads title, month and id", async () => {
    const report = await parseReport(await makeDocx(sampleReportParts()), "sample.docx");
    expect(report.title).toBe("Marketing Report 1-30 September 2026");
    expect(report.month).toBe("2026-09");
    expect(report.id).toBe("2026-09");
  });

  it("finds the numbered sections in order", async () => {
    const report = await parseReport(await makeDocx(sampleReportParts()), "sample.docx");
    expect(report.sections.map((s) => [s.number, s.title])).toEqual([
      [1, "Executive Summary"],
      [2, "Sales Highlights"],
      [4, "Website Performance"],
      [7, "Key Observation"],
      [8, "Action Plan"],
      [9, "Bottom Line"],
    ]);
  });

  it("turns a one-row table of short cells into KPI tiles", async () => {
    const report = await parseReport(await makeDocx(sampleReportParts()), "sample.docx");
    const kpis = report.sections[0].blocks.find((b) => b.type === "kpis");
    expect(kpis).toEqual({
      type: "kpis",
      items: [
        { label: "TOTAL SALES", value: "THB 111K", note: "+1.0% vs last month" },
        { label: "ONLINE SALES", value: "THB 22K", note: "+2.0% vs last month" },
        { label: "SUPERMARKET SALES", value: "THB 89K", note: "+3.0% vs last month" },
      ],
    });
  });

  it("groups bullet lines and removes the bullet characters", async () => {
    const report = await parseReport(await makeDocx(sampleReportParts()), "sample.docx");
    const bullets = report.sections[0].blocks.find((b) => b.type === "bullets");
    expect(bullets).toEqual({ type: "bullets", items: ["Overall: invented summary line one.", "Online: invented summary line two."] });
  });

  it("reads tables with a header row", async () => {
    const report = await parseReport(await makeDocx(sampleReportParts()), "sample.docx");
    const table = report.sections[1].blocks.find((b) => b.type === "table");
    expect(table).toMatchObject({ type: "table", headers: ["Channel", "Prev", "Now", "Change"] });
    expect(table?.type === "table" && table.rows).toHaveLength(3);
    expect(table?.type === "table" && table.rows[2]).toEqual(["Grand total", "100,000", "101,000", "+1.0%"]);
  });

  it("keeps a numbered-looking sentence as text, not a heading", async () => {
    const report = await parseReport(await makeDocx(sampleReportParts()), "sample.docx");
    const paragraphs = report.sections[1].blocks.filter((b) => b.type === "paragraph");
    expect(paragraphs).toEqual([{ type: "paragraph", text: "4 of 6 branches grew in this invented month." }]);
    expect(report.sections.some((s) => s.title.startsWith("of 6"))).toBe(false);
  });

  it("turns a one-row table with long text into a callout", async () => {
    const report = await parseReport(await makeDocx(sampleReportParts()), "sample.docx");
    const callout = report.sections.at(-1)?.blocks[0];
    expect(callout).toEqual({ type: "callout", paragraphs: ["Bottom Line for Someone", "Invented bottom line one.", "Invented bottom line two."] });
  });

  it("reads the first month of a 'vs' title", async () => {
    const report = await parseReport(await makeDocx(sampleReportParts("1-31 August 2026  vs.  1-31 July 2026")), "x.docx");
    expect(report.month).toBe("2026-08");
  });

  it("handles a heading written with a dot, like '1.  Executive Summary'", async () => {
    const buffer = await makeDocx([{ p: "Marketing Report 1-31 August 2026" }, { p: "1.  Executive Summary", bold: true }, { p: "A paragraph." }]);
    const report = await parseReport(buffer, "a.docx");
    expect(report.sections[0]).toMatchObject({ number: 1, title: "Executive Summary" });
  });

  it("falls back to the file name for the month when the title has none", async () => {
    const report = await parseReport(await makeDocx([{ p: "Weekly note" }, { p: "1  Summary", bold: true }]), "Report_1-30_Nov_2026.docx");
    expect(report.month).toBe("");
    expect(report.id).toBe("report-1-30-nov-2026");
  });
});

describe("parseReport (invalid input)", () => {
  it("rejects a file that is not a Word document", async () => {
    await expect(parseReport(Buffer.from("this is plain text"), "bad.docx")).rejects.toBeInstanceOf(ReportParseError);
    await expect(parseReport(Buffer.from("nope"), "bad.docx")).rejects.toThrow('"bad.docx"');
  });

  it("rejects an empty document", async () => {
    await expect(parseReport(await makeDocx([]), "empty.docx")).rejects.toThrow("no readable text");
  });
});

describe("parseThb", () => {
  it.each([
    ["฿1,234", 1234],
    ["THB 123K", 123_000],
    ["1.2M", 1_200_000],
    ["45,678", 45_678],
    ["-฿500", -500],
  ])("%s -> %d", (text, value) => {
    expect(parseThb(text)).toBe(value);
  });

  it.each(["", "+12.4% vs Jul", "Supermarket", "N/A"])("returns null for %j", (text) => {
    expect(parseThb(text)).toBeNull();
  });
});

describe("monthFromTitle", () => {
  it("reads month and year", () => {
    expect(monthFromTitle("Marketing Report 1-30 September 2026")).toBe("2026-09");
    expect(monthFromTitle("1–31 December 2025")).toBe("2025-12");
  });
  it("returns an empty string when there is no date range", () => {
    expect(monthFromTitle("Quarterly review")).toBe("");
    expect(monthFromTitle("")).toBe("");
  });
});
