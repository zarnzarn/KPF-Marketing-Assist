import Link from "next/link";
import { Badge, PageHeader } from "@/components/ui";
import { MonthlyReportView } from "@/components/MonthlyReportView";
import { formatMonth } from "@/lib/dates";
import { loadReports, pickReport } from "@/lib/reports/loadReports";

export const metadata = { title: "Reports · Klong Phai Farm" };
export const dynamic = "force-dynamic"; // reads the report files on this computer on every visit

function monthLabel(month: string) {
  return month ? `${formatMonth(month)} ${month.slice(0, 4)}` : "Undated";
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const { source, reports, warnings, notes } = await loadReports();
  const report = pickReport(reports, month);

  return (
    <>
      <PageHeader title="Reports" subtitle="Your monthly marketing reports, read from a folder on your computer. Never uploaded or committed to GitHub." />

      <section aria-labelledby="monthly-heading" className="mb-10">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 id="monthly-heading" className="text-3xl font-semibold text-forest">Monthly reports</h2>
          <Badge tone={source === "local" ? "green" : "gold"}>{source === "local" ? "Read from your computer" : "No reports found"}</Badge>
        </div>

        {source === "none" && (
          <div className="mb-4 rounded-2xl bg-yolk-soft/70 p-4 text-sm text-ink ring-1 ring-yolk/40">
            <p className="font-semibold">Data not available. No marketing report files were found.</p>
            <p className="mt-1">
              Set <code className="font-semibold">REPORTS_DIR</code> in <code className="font-semibold">.env.local</code> to your report folder (for example <code>REPORTS_DIR=D:/Report/2026</code>) and restart the app. Month sub-folders are fine. Your files stay on your computer and are never committed to GitHub.
            </p>
          </div>
        )}
        {warnings.length > 0 && (
          <ul role="alert" className="mb-4 space-y-1 rounded-2xl bg-clay-soft p-4 text-sm text-clay ring-1 ring-clay/30">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        {notes.length > 0 && (
          <ul className="mb-4 space-y-1 rounded-2xl bg-sky-soft/70 p-4 text-sm text-sky-ink ring-1 ring-sky-ink/20">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        {reports.length > 1 && (
          <nav aria-label="Choose a month" className="mb-6 flex flex-wrap gap-2">
            {reports.map((r) => {
              const active = r.id === report?.id;
              return (
                <Link
                  key={r.id}
                  href={`/reports?month=${r.month}`}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ${active ? "bg-forest text-white ring-forest" : "bg-white/70 text-forest ring-line hover:bg-white"}`}
                >
                  {monthLabel(r.month)}
                </Link>
              );
            })}
          </nav>
        )}

        {report && <MonthlyReportView report={report} />}
      </section>

    </>
  );
}
