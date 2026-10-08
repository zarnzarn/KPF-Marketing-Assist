"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { deleteReport, processReport } from "@/app/(app)/reports/actions";
import type { SupabaseSettings } from "@/lib/mode";
import { checkReportFile, storagePath } from "@/lib/reports/fileRules";
import { browserSupabase } from "@/lib/supabase/browser";

/** Online mode: upload a monthly report (.docx) into the user's private storage, or remove one. */
export function ReportUpload({ settings, userId, months }: { settings: SupabaseSettings; userId: string; months: { id: string; title: string }[] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const id = useId();
  const router = useRouter();

  const say = (text: string, error = false) => {
    setMessage(text);
    setIsError(error);
  };

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = checkReportFile(file.name, file.size);
    if (problem) return say(problem, true);
    setBusy(true);
    say(`Uploading "${file.name}"…`);
    const path = storagePath(userId, file.name, Date.now());
    try {
      const { error } = await browserSupabase(settings).storage.from("reports").upload(path, file, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: false });
      if (error) {
        say("The file could not be uploaded. Check the internet connection and try again.", true);
        return;
      }
      say("Reading the report…");
      const result = await processReport(path, file.name);
      say(result.message, !result.ok);
      if (result.ok) router.refresh();
    } catch {
      say("The file could not be uploaded. Check the internet connection and try again.", true);
    } finally {
      setBusy(false);
    }
  }

  async function remove(month: string, title: string) {
    if (!window.confirm(`Remove "${title}" from the app?`)) return;
    setBusy(true);
    const result = await deleteReport(month);
    say(result.message, !result.ok);
    setBusy(false);
    if (result.ok) router.refresh();
  }

  return (
    <div className="mb-6 rounded-2xl bg-white/70 p-4 ring-1 ring-line">
      <input id={id} type="file" accept=".docx" disabled={busy} onChange={(e) => void onFile(e)} className="peer sr-only" />
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-forest/30 bg-forest-soft/40 p-6 text-center peer-focus-visible:ring-2 peer-focus-visible:ring-forest peer-focus-visible:ring-offset-2 hover:border-yolk"
      >
        <UploadCloud className="h-7 w-7 text-sage" aria-hidden="true" />
        <span className="font-semibold text-forest">Upload a monthly report (.docx)</span>
        <span className="text-sm text-muted">Saved privately in your account. A new file for the same month replaces the old one.</span>
      </label>
      <p role={isError ? "alert" : "status"} className={`mt-3 text-sm font-medium break-words ${isError ? "text-clay" : "text-sage"}`}>
        {message}
      </p>
      {months.length > 0 && (
        <ul className="mt-3 divide-y divide-line text-sm">
          {months.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="break-words">{m.title}</span>
              <button type="button" disabled={busy} onClick={() => void remove(m.id, m.title)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-clay hover:border-clay">
                Remove<span className="sr-only"> {m.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
