import Link from "next/link";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { ReportBlockView } from "@/components/MonthlyReportView";
import { loadReports } from "@/lib/reports/loadReports";
import type { ReportBlock } from "@/lib/reports/types";

export const metadata = { title: "Sales · Klong Phai Farm" };
export const dynamic = "force-dynamic"; // reads the monthly report files on this computer

const accents = ["sage", "butter", "sky", "blush"] as const;

export default async function SalesPage() {
  const { reports } = await loadReports();
  const latest = reports[0];
  const blocks: ReportBlock[] = latest ? [...latest.intro, ...latest.sections.flatMap((s) => s.blocks)] : [];
  const kpis = blocks.find((b) => b.type === "kpis");
  const salesSection = latest?.sections.find((s) => /sales highlights/i.test(s.title));
  const branchSection = latest?.sections.find((s) => /supermarket/i.test(s.title));

  return (
    <>
      <PageHeader title="Sales" subtitle="Sales figures from your latest monthly report. Other months are on the Reports page." />

      {!latest ? (
        <EmptyState>
          Data not available. Sales figures come from your monthly report files. Set the report folder as explained on the{" "}
          <Link href="/reports" className="font-semibold text-sage underline">Reports page</Link>.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <Card id="latest" title={latest.title} subtitle="Read from your computer" href={`/reports?month=${latest.month}`} hrefLabel="Full report" tone="butter">
            {kpis?.type === "kpis" ? (
              <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
                {kpis.items.map((item, i) => (
                  <Stat key={item.label} accent={accents[i % 4]} label={item.label} value={item.value} note={item.note} tone="flat" />
                ))}
              </div>
            ) : (
              <EmptyState>This report has no summary tiles.</EmptyState>
            )}
          </Card>

          {[salesSection, branchSection].filter(Boolean).map((section) => (
            <Card key={section!.title} id={`sales-${section!.number}`} title={section!.title}>
              <div className="space-y-4">
                {section!.blocks.filter((b) => b.type === "table" || b.type === "bullets").map((b, i) => (
                  <ReportBlockView key={i} block={b} caption={section!.title} />
                ))}
              </div>
            </Card>
          ))}

          <p className="text-sm text-muted">Product-level sales are not in the monthly reports: Data not available.</p>
        </div>
      )}
    </>
  );
}
