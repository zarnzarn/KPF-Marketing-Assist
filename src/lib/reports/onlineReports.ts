import "server-only";
import { serverSupabase } from "../supabase/server";
import { sortReports } from "./fileRules";
import type { MonthlyReport, ReportLoadResult } from "./types";

/** A stored report must still look like a report before it is shown (never trust stored JSON blindly). */
export function isStoredReport(value: unknown): value is MonthlyReport {
  const r = value as Partial<MonthlyReport> | null;
  return !!r && typeof r === "object" && typeof r.id === "string" && typeof r.title === "string" && typeof r.month === "string" && Array.isArray(r.intro) && Array.isArray(r.sections);
}

/** The reports this user uploaded, already read and saved as JSON when they were uploaded. */
export async function loadOnlineReports(): Promise<ReportLoadResult> {
  const supabase = await serverSupabase();
  const { data, error } = await supabase.from("reports").select("report, file_name");
  if (error) return { source: "none", reports: [], warnings: ["The uploaded reports could not be loaded. Try again in a moment."], notes: [] };
  const rows = (data ?? []) as { report: unknown; file_name: string }[];
  const reports = rows.map((row) => row.report).filter(isStoredReport);
  const warnings = rows.length > reports.length ? [`${rows.length - reports.length} stored report could not be shown. Upload it again.`] : [];
  return reports.length ? { source: "online", reports: sortReports(reports), warnings, notes: [] } : { source: "none", reports: [], warnings, notes: [] };
}
