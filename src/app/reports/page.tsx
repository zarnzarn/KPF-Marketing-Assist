import Link from "next/link";
import { campaigns, customers, products } from "@/data/mock";
import { Badge, BarList, Card, DataTable, PageHeader, TrendBars } from "@/components/ui";
import { MonthlyReportView } from "@/components/MonthlyReportView";
import { DATA_NOT_AVAILABLE } from "@/lib/constants";
import { formatCompactThb, formatMonth, formatThb } from "@/lib/dates";
import { loadReports, pickReport } from "@/lib/reports/loadReports";
import {
  campaignAlerts,
  decliningProducts,
  monthlyTrend,
  revenueByChannel,
  revenueByProduct,
  revenueBySegment,
  salesSummary,
} from "@/lib/queries";

export const metadata = { title: "Reports · Klong Phai Farm (Prototype)" };
export const dynamic = "force-dynamic"; // reads the report files on this computer on every visit

function Report({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card id={id} title={title} subtitle={subtitle}>
      {children}
    </Card>
  );
}

function monthLabel(month: string) {
  return month ? `${formatMonth(month)} ${month.slice(0, 4)}` : "Sample";
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const { source, reports, warnings } = await loadReports();
  const report = pickReport(reports, month);

  const sales = salesSummary();
  const b2b = customers.filter((c) => c.segment === "B2B");
  const withPerformance = campaigns.filter((c) => c.performance);

  return (
    <>
      <PageHeader title="Reports" subtitle="Your monthly marketing reports, then ready-made mock reports for layout testing." />

      <section aria-labelledby="monthly-heading" className="mb-10">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 id="monthly-heading" className="text-3xl font-semibold text-forest">Monthly reports</h2>
          <Badge tone={source === "local" ? "green" : "gold"}>{source === "local" ? "Read from your computer" : "MOCK sample (no report folder found)"}</Badge>
        </div>

        {source === "mock" && (
          <p className="mb-4 rounded-2xl bg-yolk-soft/70 p-4 text-sm text-ink ring-1 ring-yolk/40">
            No Word reports were found, so a mock sample is shown. To use your own reports, set <code className="font-semibold">REPORTS_DIR</code> in <code className="font-semibold">.env.local</code> (see the README) and restart the app. Your files stay on your computer and are never committed to GitHub.
          </p>
        )}
        {warnings.length > 0 && (
          <ul role="alert" className="mb-4 space-y-1 rounded-2xl bg-clay-soft p-4 text-sm text-clay ring-1 ring-clay/30">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        {reports.length > 1 && (
          <nav aria-label="Choose a month" className="mb-6 flex flex-wrap gap-2">
            {reports.map((r) => {
              const active = r.id === report.id;
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

        <MonthlyReportView report={report} />
      </section>

      <h2 className="mb-1 text-3xl font-semibold text-forest">Mock sample reports</h2>
      <p className="mb-5 text-sm text-muted">Invented figures for layout testing (not from your real reports). Seven report types.</p>
      <div className="space-y-6">
        <Report id="sales" title="Sales report" subtitle="Apr–Sep 2026 (mock)">
          <p className="mb-4 text-[15px]">
            <strong>FACT:</strong> September revenue was {formatThb(sales.current)}; six-month total {formatThb(sales.sixMonthTotal)}.
          </p>
          <TrendBars label="Total monthly revenue" points={monthlyTrend().map((p) => ({ label: formatMonth(p.month), value: p.revenue }))} format={formatCompactThb} />
        </Report>

        <Report id="marketing" title="Marketing report" subtitle="Campaign spend and approvals">
          <ul className="space-y-1.5 text-[15px]">
            <li><strong>FACT:</strong> {campaigns.filter((c) => c.status === "Active").length} active campaigns; {campaignAlerts().length} campaign alerts open.</li>
            <li><strong>FACT:</strong> Spend recorded: {formatThb(campaigns.reduce((s, c) => s + (c.spentThb ?? 0), 0))} (campaigns that have not started: {DATA_NOT_AVAILABLE})</li>
          </ul>
        </Report>

        <Report id="campaign" title="Campaign report" subtitle="Performance of campaigns with recorded results">
          <DataTable
            caption="Campaign performance"
            rows={withPerformance}
            rowKey={(c) => c.id}
            columns={[
              { header: "Campaign", cell: (c) => <span className="font-medium">{c.name}</span> },
              { header: "Reach", cell: (c) => c.performance!.reach.toLocaleString("en-US"), className: "text-right" },
              { header: "Clicks", cell: (c) => c.performance!.clicks.toLocaleString("en-US"), className: "text-right" },
              { header: "Orders", cell: (c) => c.performance!.orders, className: "text-right" },
              { header: "Revenue", cell: (c) => formatThb(c.performance!.revenueThb), className: "text-right" },
              { header: "Cost per order", cell: (c) => (c.spentThb && c.performance!.orders ? formatThb(c.spentThb / c.performance!.orders) : DATA_NOT_AVAILABLE), className: "text-right" },
            ]}
          />
          <p className="mt-2 text-sm text-muted">Planned and draft campaigns have no results yet: {DATA_NOT_AVAILABLE}</p>
        </Report>

        <Report id="product" title="Product report" subtitle="September revenue by product">
          <BarList format={formatCompactThb} items={revenueByProduct().map((r) => ({ label: r.product.name, value: r.current }))} />
          <p className="mt-3 text-sm"><strong>ANALYSIS:</strong> {decliningProducts().map((d) => d.product.name).join(", ")} is declining; see the Sales page.</p>
        </Report>

        <Report id="customer" title="Customer report" subtitle="Channels and segments">
          <BarList format={formatCompactThb} items={revenueByChannel().map((c) => ({ label: c.channel, value: c.current }))} />
          <ul className="mt-4 flex flex-wrap gap-4 text-sm">
            {revenueBySegment().map((s) => <li key={s.segment}><strong>{s.segment}:</strong> {formatCompactThb(s.current)}</li>)}
          </ul>
        </Report>

        <Report id="b2b" title="B2B report" subtitle="Hotels, restaurants, chefs, wholesale and corporate accounts">
          <DataTable
            caption="B2B accounts"
            rows={b2b}
            rowKey={(c) => c.id}
            columns={[
              { header: "Account", cell: (c) => <span className="font-medium">{c.name}</span> },
              { header: "Type", cell: (c) => c.type },
              { header: "Opportunity", cell: (c) => <Badge>{c.opportunity}</Badge> },
              { header: "Revenue by account", cell: () => <span className="text-muted">{DATA_NOT_AVAILABLE}</span> },
            ]}
          />
        </Report>

        <Report id="inventory" title="Inventory / availability report" subtitle="Stock status for every product (mock)">
          <DataTable
            caption="Inventory and availability"
            rows={products}
            rowKey={(p) => p.id}
            columns={[
              { header: "Product", cell: (p) => <span className="font-medium">{p.name}</span> },
              { header: "Availability", cell: (p) => <Badge>{p.availability}</Badge> },
              { header: "Stock", cell: (p) => <Badge>{p.stockStatus}</Badge> },
              { header: "Units", cell: (p) => p.stockUnits, className: "text-right" },
              { header: "Reorder level", cell: (p) => p.reorderLevel, className: "text-right" },
            ]}
          />
        </Report>
      </div>
    </>
  );
}
