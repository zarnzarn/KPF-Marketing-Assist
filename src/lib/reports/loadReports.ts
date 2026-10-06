// Reads monthly marketing reports (.docx) from a folder on THIS computer.
// Server-side only (uses the file system). Real report files are never copied
// into the repository: see "Real data exception" in AGENTS.md.

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { mockMonthlyReport } from "@/data/mock/monthlyReport";
import { parseReport } from "./parseReport";
import type { MonthlyReport, ReportLoadResult } from "./types";

export const DEFAULT_REPORTS_DIR = path.join("data", "private", "reports");

/** The folder to read, from REPORTS_DIR (in .env.local) or the private default. */
export function reportsDir(env: Record<string, string | undefined> = process.env): string {
  const configured = (env.REPORTS_DIR ?? "").trim().replace(/^["']|["']$/g, "");
  return configured || path.join(process.cwd(), DEFAULT_REPORTS_DIR);
}

const cache = new Map<string, { signature: string; report: MonthlyReport }>();

export async function loadReports(dir: string = reportsDir()): Promise<ReportLoadResult> {
  const warnings: string[] = [];
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return { source: "mock", reports: [mockMonthlyReport], warnings };
  }

  // Ignore Word's temporary lock files (~$...) and anything that is not a .docx.
  const files = names.filter((n) => /\.docx$/i.test(n) && !n.startsWith("~$"));
  const reports: MonthlyReport[] = [];

  for (const name of files) {
    const file = path.join(dir, name);
    try {
      const info = await stat(file);
      const signature = `${info.mtimeMs}:${info.size}`;
      const cached = cache.get(file);
      if (cached?.signature === signature) {
        reports.push(cached.report);
        continue;
      }
      const report = await parseReport(await readFile(file), name);
      cache.set(file, { signature, report });
      reports.push(report);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : `"${name}" could not be read.`);
    }
  }

  if (reports.length === 0) return { source: "mock", reports: [mockMonthlyReport], warnings };

  // Newest month first; reports without a readable month go last.
  reports.sort((a, b) => (b.month || "").localeCompare(a.month || ""));
  return { source: "local", reports, warnings };
}

export function pickReport(reports: MonthlyReport[], month?: string): MonthlyReport {
  return reports.find((r) => r.month === month) ?? reports[0];
}
