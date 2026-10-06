import { MOCK_TODAY, approvals, campaigns, contentItems, marketingActivities } from "@/data/mock";
import { Badge, Card, DataTable, List, ListItem, PageHeader, Stat } from "@/components/ui";
import { CampaignTimeline } from "@/components/CampaignTimeline";
import { formatCompactThb, formatDate } from "@/lib/dates";
import { PHASE1_NOTICE } from "@/lib/approvals";
import { campaignAlerts, pendingApprovals } from "@/lib/queries";
import { products } from "@/data/mock";

export const metadata = { title: "Marketing · Klong Phai Farm (Prototype)" };

export default function MarketingPage() {
  const active = campaigns.filter((c) => c.status === "Active");
  const upcoming = campaigns.filter((c) => c.status === "Planned" || c.status === "Draft");
  const contentCounts = ["Idea", "Draft", "In review", "Scheduled", "Published"].map((s) => ({
    status: s,
    count: contentItems.filter((c) => c.status === s).length,
  }));
  const priorities = [
    ...campaignAlerts().filter((a) => a.severity !== "Low").map((a) => a.message),
    ...products.filter((p) => p.attentionReason).map((p) => `${p.name}: ${p.attentionReason}`),
  ].slice(0, 5);

  return (
    <>
      <PageHeader title="Marketing" subtitle="Campaigns, content, PR, events and approvals in one view." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat accent="sage" label="Active campaigns" value={String(active.length)} note={`${upcoming.length} upcoming`} tone="flat" />
        <Stat accent="butter" label="Pending approvals" value={String(pendingApprovals().length)} note="Waiting for the Director" tone="down" />
        <Stat accent="sky" label="Content in review" value={String(contentItems.filter((c) => c.status === "In review").length)} note={`${contentItems.filter((c) => c.status === "Draft").length} drafts`} tone="flat" />
        <Stat accent="blush" label="Upcoming events" value={String(marketingActivities.filter((a) => a.type === "Event" && a.date >= MOCK_TODAY).length)} note="Next 60 days" tone="flat" />
      </div>

      <Card id="priorities" title="Marketing priorities" subtitle="What deserves attention first" className="mt-6">
        <ol className="list-decimal space-y-2 pl-5 text-[15px]">
          {priorities.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </Card>

      <Card id="calendar" title="Campaign calendar" subtitle="All campaigns on one timeline" href="/campaigns" className="mt-6">
        <CampaignTimeline campaigns={campaigns} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card id="active" title="Active campaigns" href="/campaigns">
          <List>
            {active.map((c) => (
              <ListItem key={c.id} href="/campaigns">
                <span>
                  <span className="block font-medium">{c.name}</span>
                  <span className="text-sm text-muted">
                    {c.performance
                      ? `${c.performance.orders} orders · ${formatCompactThb(c.performance.revenueThb)} revenue · budget used ${formatCompactThb(c.spentThb ?? 0)} / ${formatCompactThb(c.budgetThb)}`
                      : "Performance: Data not available."}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Badge>{c.status}</Badge>
                  <Badge>{c.approvalStatus}</Badge>
                </span>
              </ListItem>
            ))}
          </List>
        </Card>

        <Card id="upcoming" title="Upcoming campaigns" href="/campaigns">
          <List>
            {upcoming.map((c) => (
              <ListItem key={c.id} href="/campaigns">
                <span>
                  <span className="block font-medium">{c.name}</span>
                  <span className="text-sm text-muted">Starts {formatDate(c.startDate)} · content {c.contentStatus.toLowerCase()}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Badge>{c.status}</Badge>
                  <Badge>{c.approvalStatus}</Badge>
                </span>
              </ListItem>
            ))}
          </List>
        </Card>

        <Card id="content-status" title="Content status" href="/content">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {contentCounts.map((c) => (
              <li key={c.status} className="rounded-xl border border-line bg-white p-3 text-center">
                <p className="font-display text-2xl font-semibold text-forest">{c.count}</p>
                <p className="text-xs text-muted">{c.status}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card id="approvals" title="Pending approvals" subtitle={PHASE1_NOTICE}>
          <List>
            {approvals.filter((a) => a.state === "Pending").map((a) => (
              <ListItem key={a.id} href={a.relatedHref}>
                <span className="font-medium">{a.title}</span>
                <Badge tone="gold">{a.actionType}</Badge>
              </ListItem>
            ))}
          </List>
        </Card>
      </div>

      <Card id="activities" title="Marketing activities, PR and events" className="mt-6">
        <DataTable
          caption="Marketing activities"
          rows={[...marketingActivities].sort((a, b) => a.date.localeCompare(b.date))}
          rowKey={(a) => a.id}
          columns={[
            { header: "Activity", cell: (a) => <span className="font-medium">{a.title}</span> },
            { header: "Type", cell: (a) => <Badge tone="neutral">{a.type}</Badge> },
            { header: "Date", cell: (a) => formatDate(a.date) },
            { header: "Status", cell: (a) => <Badge>{a.status}</Badge> },
            { header: "Owner", cell: (a) => a.owner },
            { header: "Location", cell: (a) => a.location ?? "—" },
          ]}
        />
      </Card>
    </>
  );
}
