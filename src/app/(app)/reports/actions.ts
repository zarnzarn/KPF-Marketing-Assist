"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth/session";
import { isOwnPath } from "@/lib/reports/fileRules";
import { readUploadedReport } from "@/lib/reports/upload";
import { serverSupabase } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const BUCKET = "reports";
const refresh = () => ["/reports", "/sales", "/secretary"].forEach((p) => revalidatePath(p));

/**
 * After the browser uploaded a .docx to the user's own storage folder: read it once and save the
 * readable report, so pages never have to read the Word file again. A file that is not a readable
 * marketing report is removed again.
 */
export async function processReport(filePath: string, fileName: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (viewer.mode !== "online") return { ok: false, message: "Uploading is only used in the online app. Locally, reports are read from REPORTS_DIR." };
  if (typeof filePath !== "string" || !isOwnPath(viewer.userId, filePath)) return { ok: false, message: "That file is not in your own storage folder." };
  const name = String(fileName ?? "").slice(0, 200);
  const supabase = await serverSupabase();

  const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(filePath);
  if (downloadError || !blob) return { ok: false, message: "The uploaded file could not be read back. Try again." };

  const read = await readUploadedReport(Buffer.from(await blob.arrayBuffer()), name);
  if ("problem" in read) {
    await supabase.storage.from(BUCKET).remove([filePath]);
    return { ok: false, message: read.problem };
  }

  // One report per month: a new upload for the same month replaces the old one.
  const { data: old } = await supabase.from("reports").select("file_path").eq("id", read.report.id).maybeSingle();
  const { error } = await supabase
    .from("reports")
    .upsert({ user_id: viewer.userId, id: read.report.id, file_name: name, file_path: filePath, report: read.report, uploaded_at: new Date().toISOString() }, { onConflict: "user_id,id" });
  if (error) {
    await supabase.storage.from(BUCKET).remove([filePath]);
    return { ok: false, message: "The report could not be saved. Try again." };
  }
  if (old?.file_path && old.file_path !== filePath) await supabase.storage.from(BUCKET).remove([old.file_path]);
  refresh();
  return { ok: true, message: `"${read.report.title}" was added.` };
}

/** Removes one month's report (the saved report and its Word file). */
export async function deleteReport(month: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (viewer.mode !== "online") return { ok: false, message: "Reports are read from REPORTS_DIR in local mode." };
  if (!/^\d{4}-\d{2}$/.test(String(month))) return { ok: false, message: "Unknown report." };
  const supabase = await serverSupabase();
  const { data: row } = await supabase.from("reports").select("file_path").eq("id", month).maybeSingle();
  const { error } = await supabase.from("reports").delete().eq("id", month);
  if (error) return { ok: false, message: "The report could not be removed. Try again." };
  if (row?.file_path) await supabase.storage.from(BUCKET).remove([row.file_path]);
  refresh();
  return { ok: true, message: "Report removed." };
}
