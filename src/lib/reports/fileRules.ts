// Rules for report files, shared by the folder reader, the upload box and the server. Pure functions.
import type { MonthlyReport } from "./types";

const REPORT_NAME = /marketing[\s_-]*report/i;

/** Real monthly reports are about 2 MB (with charts); 10 MB leaves room without allowing huge files. */
export const MAX_REPORT_BYTES = 10 * 1024 * 1024;

/** Only marketing reports count: the file name or the report title must say "Marketing Report". */
export function isMarketingReport(fileName: string, title: string): boolean {
  return REPORT_NAME.test(fileName) || REPORT_NAME.test(title);
}

/** Newest month first; reports without a readable month go last. */
export function sortReports(reports: MonthlyReport[]): MonthlyReport[] {
  return [...reports].sort((a, b) => (b.month || "").localeCompare(a.month || ""));
}

/** A problem with the chosen file before it is uploaded, or null when it may be uploaded. */
export function checkReportFile(name: string, size: number): string | null {
  if (!/\.docx$/i.test(name)) return "Choose a Word file (.docx). Other file types are not read.";
  if (name.startsWith("~$")) return "That is a Word lock file, not the report. Choose the report itself.";
  if (size <= 0) return "The file is empty.";
  if (size > MAX_REPORT_BYTES) return "The file is larger than 10 MB. Save the report without very large pictures and try again.";
  return null;
}

/** A safe storage name: the user's own folder, a time stamp and the file name with odd characters removed. */
export function storagePath(userId: string, fileName: string, now: number): string {
  const safe = fileName.normalize("NFKD").replace(/[^\w.-]+/g, "_").replace(/\.{2,}/g, ".").replace(/_+/g, "_").replace(/^[._]+/, "").slice(-80) || "report.docx";
  return `${userId}/${now}-${safe}`;
}

/** True when a storage path is inside the user's own folder and has no tricks such as "..". */
export function isOwnPath(userId: string, filePath: string): boolean {
  return filePath.startsWith(`${userId}/`) && !filePath.includes("..") && !filePath.includes("\\") && filePath.split("/").length === 2;
}
