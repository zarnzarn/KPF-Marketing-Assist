// Reads a report file uploaded in the online app. Server only (uses the Word reader).
import { isMarketingReport } from "./fileRules";
import { ReportParseError, monthFromText, parseReport } from "./parseReport";
import type { MonthlyReport } from "./types";

/** Same rules as the folder reader: it must be a readable marketing report with a month. */
export async function readUploadedReport(buffer: Buffer, fileName: string): Promise<{ report: MonthlyReport } | { problem: string }> {
  let report: MonthlyReport;
  try {
    report = await parseReport(buffer, fileName);
  } catch (error) {
    return { problem: error instanceof ReportParseError ? error.message : `"${fileName}" could not be read as a Word (.docx) file.` };
  }
  if (!isMarketingReport(fileName, report.title)) return { problem: `"${fileName}" does not look like a monthly marketing report (its title or name does not say "Marketing Report").` };
  const month = report.month || monthFromText(fileName);
  if (!month) return { problem: `The month could not be read from "${report.title || fileName}". Use a title like "Marketing Report 1-30 September 2026".` };
  return { report: { ...report, month, id: month } };
}
