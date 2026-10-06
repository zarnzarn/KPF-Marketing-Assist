import { Badge, BarList, Card, ChangeText, DataTable, PageHeader, Stat, TrendBars } from "@/components/ui";
import { loadReports } from "@/lib/reports/loadReports";
import { formatCompactThb, formatMonth, formatThb } from "@/lib/dates";
import {
  decliningProducts,
  latestMonth,
  monthlyTrend,
  percentChange,
  revenue,
  revenueByChannel,
  revenueByProduct,
  revenueBySegment,
  salesAlerts,
  salesSummary,
  topProducts,
} from "@/lib/queries";

export const metadata = { title: "Sales · Klong Phai Farm (Prototype)" };
export const dynamic = "force-dynamic"; // reads the monthly report files on this computer

const trendPoints = (points: { month: string; revenue: number }[]) => points.map((p) => ({ label: formatMonth(p.month), value: p.revenue }));

export default async function SalesPage() {
  const { source, reports } = await loadReports();
  const latest = source === "local" ? reports[0] : undefined;
  const kpiBlock = latest && [...latest.intro, ...latest.sections.flatMap((x) => x.blocks)].find((b) => b.type === "kpis");
  const summary = salesSummary();
  const segments = revenueBySegment();
  const byProduct = revenueByProduct();
  const websiteNow = revenue({ month: latestMonth, channel: "Website" });
  const websitePrev = revenue({ month: "2026-08", channel: "Website" });

  return (
    <>
      <PageHeader title="Sales" subtitle="Mock sales figures for April–September 2026. Latest month is September." />

      {latest && kpiBlock?.type === "kpis" && (
        <Card id="latest-report" title="From your latest monthly report" subtitle={`${latest.title} · real figures read from your computer`} href={`/reports?month=${latest.month}`} hrefLabel="Open report" tone="butter" className="mb-6">
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
            {kpiBlock.items.map((item, i) => (
              <Stat key={item.label} accent={(["sage", "butter", "sky", "blush"] as const)[i % 4]} label={item.label} value={item.value} note={item.note} tone="flat" />
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">The charts and tables below are <strong>mock data</strong> (product-level figures are not in the monthly reports).</p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat accent="sage" label="September revenue (mock)" value={formatCompactThb(summary.current)} note={summary.change === null ? "Data not available." : `${summary.change >= 0 ? "▲" : "▼"} ${Math.abs(summary.change).toFixed(1)}% vs August`} tone={summary.change !== null && summary.change < 0 ? "down" : "up"} />
        <Stat accent="butter" label="Six-month revenue" value={formatCompactThb(summary.sixMonthTotal)} note="Apr–Sep 2026 (mock)" tone="flat" />
        <Stat accent="sky" label="Website sales, Sep (mock)" value={formatCompactThb(websiteNow)} note={`${(percentChange(websiteNow, websitePrev) ?? 0).toFixed(1)}% vs August`} tone="up" />
        <Stat accent="blush" label="Sales alerts (mock)" value={String(salesAlerts().length)} note="Declining products" tone="down" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card id="trend" title="Sales trend" subtitle="Total monthly revenue" className="lg:col-span-2">
          <TrendBars label="Total monthly revenue" points={trendPoints(monthlyTrend())} format={formatCompactThb} />
        </Card>
        <Card id="segments" title="B2C · Retail · B2B" subtitle="September revenue by segment">
          <ul className="space-y-4">
            {segments.map((s) => (
              <li key={s.segment} className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold">{s.segment}</span>
                  <span className="text-sm text-muted">{formatThb(s.current)}</span>
                </span>
                <ChangeText change={percentChange(s.current, s.previous)} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card id="channels" title="Sales by channel" subtitle="September revenue">
          <BarList format={formatCompactThb} items={revenueByChannel().map((c) => ({ label: `${c.channel} (${c.segment})`, value: c.current }))} />
        </Card>
        <Card id="top" title="Top products" subtitle="September revenue">
          <BarList format={formatCompactThb} items={topProducts(5).map((p) => ({ label: p.product.name, value: p.current }))} />
        </Card>
      </div>

      <Card id="declining" title="Declining products" subtitle="Revenue fell three months in a row" className="mt-6">
        {decliningProducts().map(({ product, change }) => (
          <div key={product.id} className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">{product.name}</p>
            <ChangeText change={change} />
            <Badge tone="clay">Needs review</Badge>
          </div>
        ))}
        <p className="mt-3 text-sm text-muted">Reason for the decline: Data not available.</p>
      </Card>

      <Card id="by-product" title="Sales by product" className="mt-6">
        <DataTable
          caption="Sales by product, September versus August"
          rows={byProduct}
          rowKey={(r) => r.product.id}
          columns={[
            { header: "Product", cell: (r) => <span className="font-medium">{r.product.name}</span> },
            { header: "Sep revenue", cell: (r) => formatThb(r.current), className: "text-right" },
            { header: "Aug revenue", cell: (r) => formatThb(r.previous), className: "text-right" },
            { header: "Change", cell: (r) => <ChangeText change={r.change} />, className: "text-right" },
          ]}
        />
      </Card>

      <Card id="alerts" title="Important sales alerts" className="mt-6">
        <ul className="space-y-2">
          {salesAlerts().map((a) => (
            <li key={a.id} className="flex gap-3 text-[15px]"><Badge>{a.severity}</Badge>{a.message}</li>
          ))}
        </ul>
      </Card>
    </>
  );
}
