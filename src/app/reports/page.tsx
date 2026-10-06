import { campaigns, customers, products } from "@/data/mock";
import { Badge, BarList, Card, DataTable, PageHeader } from "@/components/ui";
import { DATA_NOT_AVAILABLE } from "@/lib/constants";
import { formatCompactThb, formatMonth, formatThb } from "@/lib/dates";
import {
  campaignAlerts,
  decliningProducts,
  monthlyTrend,
  revenueByChannel,
  revenueByProduct,
  revenueBySegment,
  salesSummary,
} from "@/lib/queries";
import { TrendBars } from "@/components/ui";

export const metadata = { title: "Reports · Klong Phai Farm (Prototype)" };

function Report({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card id={id} title={title} subtitle={subtitle}>
      {children}
    </Card>
  );
}

export default function ReportsPage() {
  const sales = salesSummary();
  const b2b = customers.filter((c) => c.segment === "B2B");
  const withPerformance = campaigns.filter((c) => c.performance);

  return (
    <>
      <PageHeader title="Reports" subtitle="Seven ready-made mock reports. Figures come from mock data and are for layout testing only." />
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
