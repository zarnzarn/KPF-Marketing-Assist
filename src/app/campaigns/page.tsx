import { campaigns } from "@/data/mock";
import { Badge, Card, DataTable, PageHeader, ProgressBar } from "@/components/ui";
import { DATA_NOT_AVAILABLE } from "@/lib/constants";
import { formatCompactThb, formatDate } from "@/lib/dates";
import { getProduct } from "@/lib/queries";

export const metadata = { title: "Campaigns · Klong Phai Farm (Prototype)" };

export default function CampaignsPage() {
  return (
    <>
      <PageHeader title="Campaigns" subtitle="Objectives, budgets, performance and approval status for every campaign." />
      <Card id="table" title="All campaigns">
        <DataTable
          caption="Campaigns"
          rows={campaigns}
          rowKey={(c) => c.id}
          columns={[
            { header: "Campaign", cell: (c) => <div><p className="font-semibold">{c.name}</p><p className="mt-0.5 max-w-xs text-xs text-muted">{c.objective}</p></div> },
            { header: "Channel", cell: (c) => c.channels.join(", ") },
            { header: "Target audience", cell: (c) => <span className="block max-w-[11rem]">{c.targetAudience}</span> },
            { header: "Dates", cell: (c) => `${formatDate(c.startDate)} – ${formatDate(c.endDate)}` },
            { header: "Budget", cell: (c) => (c.spentThb === null ? <span>{formatCompactThb(c.budgetThb)}<br /><span className="text-xs text-muted">Spent: {DATA_NOT_AVAILABLE}</span></span> : <div className="w-32"><p>{formatCompactThb(c.spentThb)} / {formatCompactThb(c.budgetThb)}</p><ProgressBar value={c.spentThb} max={c.budgetThb} label={`${c.name} budget used`} /></div>) },
            { header: "Status", cell: (c) => <Badge>{c.status}</Badge> },
            { header: "Performance", cell: (c) => (c.performance ? <ul className="text-xs"><li>Reach {c.performance.reach.toLocaleString("en-US")}</li><li>Clicks {c.performance.clicks.toLocaleString("en-US")}</li><li>Orders {c.performance.orders}</li><li>Revenue {formatCompactThb(c.performance.revenueThb)}</li></ul> : <span className="text-muted">{DATA_NOT_AVAILABLE}</span>) },
            { header: "Content", cell: (c) => <Badge tone={c.contentStatus === "Ready" || c.contentStatus === "Published" ? "green" : c.contentStatus === "Not started" ? "neutral" : "gold"}>{c.contentStatus}</Badge> },
            { header: "Approval", cell: (c) => <Badge>{c.approvalStatus}</Badge> },
            { header: "Related products", cell: (c) => <ul className="max-w-[12rem] text-xs">{c.productIds.map((id) => <li key={id}>{getProduct(id)?.name ?? id}</li>)}</ul> },
          ]}
        />
      </Card>
    </>
  );
}
