"use client";

import { useAppData } from "@/components/AppDataProvider";
import { ApprovalList } from "@/components/ApprovalList";
import { CampaignTimeline } from "@/components/CampaignTimeline";
import { Badge, Card, EmptyState, List, ListItem, Stat } from "@/components/ui";
import { PHASE1_NOTICE } from "@/lib/approvals";
import type { ChannelSnapshot } from "@/lib/channels/types";
import { formatDate } from "@/lib/dates";
import { campaignAlerts, pendingApprovals, productAlerts } from "@/lib/queries";


export function MarketingView({ channels = [] }: { channels?: ChannelSnapshot[] }) {
  const { data } = useAppData();
  const active = data.campaigns.filter((c) => c.status === "Active");
  const upcoming = data.campaigns.filter((c) => c.status === "Planned" || c.status === "Draft");
  const contentCounts = ["Idea", "Draft", "In review", "Scheduled", "Published"].map((s) => ({ status: s, count: data.content.filter((c) => c.status === s).length }));
  const priorities = [...campaignAlerts(data).filter((a) => a.severity !== "Low"), ...productAlerts(data)].map((a) => a.message).slice(0, 5);
  const social = channels.filter((c) => ["facebook", "instagram", "line"].includes(c.channel));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat accent="sage" label="Active campaigns" value={String(active.length)} note={`${upcoming.length} upcoming`} tone="flat" />
        <Stat accent="butter" label="Pending approvals" value={String(pendingApprovals(data).length)} note="Waiting for you" tone="flat" />
        <Stat accent="sky" label="Content in review" value={String(data.content.filter((c) => c.status === "In review").length)} note={`${data.content.filter((c) => c.status === "Draft").length} drafts`} tone="flat" />
        <Stat accent="blush" label="Channels connected" value={`${channels.filter((c) => c.status === "connected").length}/${channels.length || 6}`} note="See the Channels page" tone="flat" />
      </div>

      {social.some((c) => c.status === "connected") && (
        <Card id="social" title="Social channels" subtitle="Read-only numbers from your connected channels" href="/channels" hrefLabel="Channels" tone="highlight">
          <div className="grid gap-4 md:grid-cols-3">
            {social.filter((c) => c.status === "connected").map((c) => (
              <div key={c.channel} className="rounded-2xl bg-white/70 p-4 ring-1 ring-line">
                <p className="font-semibold text-forest">{c.label}</p>
                <dl className="mt-2 space-y-1 text-sm">
                  {c.metrics.slice(0, 4).map((m) => (
                    <div key={m.label} className="flex justify-between gap-2"><dt className="text-muted">{m.label}</dt><dd className="font-semibold">{m.value}</dd></div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card id="priorities" title="Marketing priorities" subtitle="From campaign status and stock levels">
        {priorities.length === 0 ? <EmptyState>Nothing needs attention. Priorities appear when campaigns wait for approval, start soon or products run low.</EmptyState> : (
          <ol className="list-decimal space-y-2 pl-5 text-[15px]">
            {priorities.map((p) => <li key={p}>{p}</li>)}
          </ol>
        )}
      </Card>

      <Card id="calendar" title="Campaign calendar" href="/campaigns">
        {data.campaigns.length === 0 ? <EmptyState>No campaigns yet. Add them on the Campaigns page.</EmptyState> : <CampaignTimeline campaigns={data.campaigns} today={data.today} />}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="active" title="Active campaigns" href="/campaigns">
          {active.length === 0 ? <EmptyState>No active campaigns.</EmptyState> : (
            <List>
              {active.map((c) => (
                <ListItem key={c.id} href="/campaigns">
                  <span>
                    <span className="block font-medium">{c.name}</span>
                    <span className="text-sm text-muted">Ends {formatDate(c.endDate)} · performance: Data not available.</span>
                  </span>
                  <Badge>{c.approvalStatus}</Badge>
                </ListItem>
              ))}
            </List>
          )}
        </Card>

        <Card id="upcoming" title="Upcoming campaigns" href="/campaigns">
          {upcoming.length === 0 ? <EmptyState>No upcoming campaigns.</EmptyState> : (
            <List>
              {upcoming.map((c) => (
                <ListItem key={c.id} href="/campaigns">
                  <span>
                    <span className="block font-medium">{c.name}</span>
                    <span className="text-sm text-muted">Starts {formatDate(c.startDate)} · content {c.contentStatus.toLowerCase()}</span>
                  </span>
                  <Badge>{c.status}</Badge>
                </ListItem>
              ))}
            </List>
          )}
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
          <ApprovalList />
        </Card>
      </div>
    </div>
  );
}
