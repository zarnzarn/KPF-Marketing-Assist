// Reads monthly marketing reports (.docx) from a folder on THIS computer.
// Server-side only (uses the file system). Real report files are never copied
// into the repository: see "Real data exception" in AGENTS.md.

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { mockMonthlyReport } from "@/data/mock/monthlyReport";
import { monthFromText, parseReport } from "./parseReport";
import type { MonthlyReport, ReportLoadResult } from "./types";

export const DEFAULT_REPORTS_DIR = path.join("data", "private", "reports");
const MAX_DEPTH = 3; // e.g. REPORTS_DIR/2026/Sep - 2026/report.docx
const REPORT_NAME = /marketing[\s_-]*report/i;

/** The folder to read, from REPORTS_DIR (in .env.local) or the private default. */
export function reportsDir(env: Record<string, string | undefined> = process.env): string {
  const configured = (env.REPORTS_DIR ?? "").trim().replace(/^["']|["']$/g, "");
  return configured || path.join(process.cwd(), DEFAULT_REPORTS_DIR);
}

/** Every .docx in the folder and its sub-folders (Word's ~$ lock files and hidden folders are ignored). */
async function findDocx(root: string, dir = root, depth = 0): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (depth < MAX_DEPTH && !entry.name.startsWith(".") && entry.name !== "node_modules") found.push(...(await findDocx(root, full, depth + 1)));
    } else if (/\.docx$/i.test(entry.name) && !entry.name.startsWith("~$")) {
      found.push(full);
    }
  }
  return found;
}

const cache = new Map<string, { signature: string; report: MonthlyReport }>();

export async function loadReports(dir: string = reportsDir()): Promise<ReportLoadResult> {
  const warnings: string[] = [];
  const notes: string[] = [];

  try {
    await readdir(dir);
  } catch {
    return { source: "mock", reports: [mockMonthlyReport], warnings, notes };
  }

  const candidates: { report: MonthlyReport; mtime: number; rel: string }[] = [];
  let skipped = 0;

  for (const file of await findDocx(dir)) {
    const rel = path.relative(dir, file);
    try {
      const info = await stat(file);
      const signature = `${info.mtimeMs}:${info.size}`;
      let report = cache.get(file)?.signature === signature ? cache.get(file)!.report : undefined;
      if (!report) {
        report = await parseReport(await readFile(file), path.basename(file));
        cache.set(file, { signature, report });
      }

      // Only marketing reports count. Other Word files (sources, notes, drafts) are skipped quietly.
      if (!REPORT_NAME.test(path.basename(file)) && !REPORT_NAME.test(report.title)) {
        skipped++;
        continue;
      }

      // If the title has no date range, use the folder or file name, e.g. "Mar - 2026".
      const month = report.month || monthFromText(rel);
      candidates.push({ report: month ? { ...report, month, id: month } : report, mtime: info.mtimeMs, rel });
    } catch (error) {
      const reason = error instanceof Error ? error.message : `"${path.basename(file)}" could not be read.`;
      warnings.push(rel.includes(path.sep) ? `${rel}: ${reason}` : reason);
    }
  }

  // One report per month: if there are several files for a month, keep the most recently saved.
  const byId = new Map<string, (typeof candidates)[number]>();
  for (const c of candidates) {
    const existing = byId.get(c.report.id);
    if (!existing) byId.set(c.report.id, c);
    else {
      const [keep, drop] = c.mtime > existing.mtime ? [c, existing] : [existing, c];
      byId.set(c.report.id, keep);
      notes.push(`Two files found for the same month. Using the newer one (${keep.rel}); ignoring ${drop.rel}.`);
    }
  }
  if (skipped > 0) notes.push(`${skipped} other Word file${skipped === 1 ? " was" : "s were"} skipped because ${skipped === 1 ? "it is" : "they are"} not a marketing report.`);

  const reports = Array.from(byId.values()).map((c) => c.report);
  if (reports.length === 0) return { source: "mock", reports: [mockMonthlyReport], warnings, notes };

  // Newest month first; reports without a readable month go last.
  reports.sort((a, b) => (b.month || "").localeCompare(a.month || ""));
  return { source: "local", reports, warnings, notes };
}

export function pickReport(reports: MonthlyReport[], month?: string): MonthlyReport {
  return reports.find((r) => r.month === month) ?? reports[0];
}
