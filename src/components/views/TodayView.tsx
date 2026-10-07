"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, ClipboardCheck, MessageCircleWarning } from "lucide-react";
import { useAppData, WhenReady } from "@/components/AppDataProvider";
import { AnswerBlocks } from "@/components/AnswerBlocks";
import { ApprovalList } from "@/components/ApprovalList";
import { Badge, Card, EmptyState, List, ListItem, PageHeader, Stat } from "@/components/ui";
import { dailySummary } from "@/lib/ai/dailySummary";
import { PHASE1_NOTICE } from "@/lib/approvals";
import type { ChannelSnapshot } from "@/lib/channels/types";
import { DATA_NOT_AVAILABLE } from "@/lib/constants";
import { formatDate, formatLongDate } from "@/lib/dates";
import {
  calendarItemsOn,
  campaignAlerts,
  followUpsDue,
  getCustomer,
  isEmpty,
  meetingsOn,
  openIssues,
  overdueTasks,
  pendingApprovals,
  priorityTasksToday,
  productAlerts,
  recommendedPriorities,
  shopNote,
  upcomingMeetings,
} from "@/lib/queries";

const gettingStarted = [
  { href: "/tasks", label: "Add your tasks", note: "Priorities and overdue items come from here." },
  { href: "/meetings", label: "Add meetings", note: "Agenda and notes for meeting briefings." },
  { href: "/customers", label: "Add customers and B2B accounts", note: "Follow-up dates and customer issues." },
  { href: "/campaigns", label: "Add campaigns", note: "Dates, budget and approval status." },
  { href: "/channels", label: "Connect your channels", note: "Website, Facebook, Instagram and LINE OA (read-only)." },
  { href: "/reports", label: "Load your monthly reports", note: "Word files read from a folder on your computer." },
];

export function TodayView({ channels = [] }: { channels?: ChannelSnapshot[] }) {
  const { data } = useAppData();
  return (
    <>
      <PageHeader title="Today" subtitle={`${formatLongDate(data.today)}. What you need to know and do today.`} />
      {/* Nothing is concluded ("All clear", "Nothing urgent") until this browser's entries are read. */}
      <WhenReady>
        <TodayContent channels={channels} />
      </WhenReady>
    </>
  );
}

function TodayContent({ channels }: { channels: ChannelSnapshot[] }) {
  const { data } = useAppData();
  const overdue = overdueTasks(data);
  const followUps = followUpsDue(data);
  const issues = openIssues(data.issues);
  const approvals = pendingApprovals(data);
  const priorities = recommendedPriorities(data);
  const schedule = calendarItemsOn(data, data.today);
  const nextMeeting = meetingsOn(data, data.today)[0];
  const upcoming = upcomingMeetings(data).filter((m) => m.date > data.today).slice(0, 3);
  const channelProblems = channels
    .filter((c) => c.status === "error")
    .map((c) => ({ id: `ch-${c.channel}`, severity: "Medium", message: `${c.label}: ${c.message ?? "could not be read."}`, href: "/channels" }));
  const empty = isEmpty(data);
  const stockGap = shopNote(data);

  return (
    <>
      {empty && (
        <Card id="getting-started" title="Getting started" subtitle="This app has no sample data. Everything you see comes from you, your reports and your channels." tone="butter" className="mb-6">
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {gettingStarted.map((g, i) => (
              <li key={g.href}>
                <Link href={g.href} className="flex h-full gap-3 rounded-2xl bg-white/80 p-4 ring-1 ring-line hover:ring-yolk">
                  <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-soft font-semibold text-forest" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-semibold">{g.label}</span>
                    <span className="block text-sm text-muted">{g.note}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {!empty && (
        <section aria-labelledby="start-here" className="mb-6 rounded-3xl border border-yolk/40 bg-gradient-to-br from-yolk-soft via-[#fbf1d8] to-forest-soft p-6 shadow-[0_8px_24px_-14px_rgba(36,25,5,0.25)] sm:p-8">
          <p className="text-xs font-semibold tracking-[0.18em] text-[#6b4a05] uppercase">Start here</p>
          {priorities[0] ? (
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <h2 id="start-here" className="text-3xl font-semibold text-forest sm:text-4xl">{priorities[0].title}</h2>
                <p className="mt-2 text-base text-ink/80">{priorities[0].reason}</p>
                {nextMeeting && (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-sm font-medium ring-1 ring-line">
                    <CalendarClock className="h-4 w-4 text-sage" aria-hidden="true" />
                    First meeting today: {nextMeeting.start} {nextMeeting.title}
                  </p>
                )}
              </div>
              <Link href={priorities[0].href} className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 font-semibold text-white hover:bg-sage">
                Open it <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <h2 id="start-here" className="mt-2 text-3xl font-semibold text-forest">Nothing urgent is recorded today.</h2>
          )}
        </section>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat accent="blush" icon={<AlertTriangle className="h-5 w-5" />} label="Overdue tasks" value={String(overdue.length)} note={overdue.length ? "Needs action" : "All clear"} tone={overdue.length ? "down" : "up"} />
        <Stat accent="butter" icon={<ClipboardCheck className="h-5 w-5" />} label="Approvals waiting" value={String(approvals.length)} note="Decisions needed from you" tone="flat" />
        <Stat accent="sky" icon={<CalendarClock className="h-5 w-5" />} label="Follow-ups due" value={String(followUps.length)} note="Due today or earlier" tone={followUps.length ? "down" : "up"} />
        <Stat accent="sage" icon={<MessageCircleWarning className="h-5 w-5" />} label="Open customer issues" value={String(issues.length)} note={`${issues.filter((i) => i.severity === "High").length} high severity`} tone={issues.length ? "down" : "up"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card id="priorities" title="Recommended priorities" subtitle="Ranked by urgency. Start at the top." className="xl:col-span-3">
          {priorities.length === 0 ? (
            <EmptyState>Nothing to rank yet. Priorities come from your tasks, customer issues, follow-ups and approvals.</EmptyState>
          ) : (
            <ol className="space-y-3">
              {priorities.map((p, i) => (
                <li key={`${p.kind}-${p.id}`}>
                  <Link href={p.href} className="flex gap-4 rounded-2xl border border-line bg-white/80 p-4 hover:border-yolk hover:bg-white">
                    <span className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-soft text-lg font-semibold text-forest ring-1 ring-sage/30" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block font-semibold">{p.title}</span>
                      <span className="block text-sm text-muted">{p.reason}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card id="summary" title="AI daily summary" subtitle="Built only from what is recorded" tone="highlight" className="xl:col-span-2">
          <AnswerBlocks blocks={dailySummary(data)} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card id="schedule" title="Today's schedule" subtitle="Meetings, tasks, deadlines and follow-ups" href="/calendar" hrefLabel="Open calendar">
          {schedule.length === 0 ? (
            <EmptyState>Nothing scheduled today.</EmptyState>
          ) : (
            <List>
              {schedule.map((item) => (
                <ListItem key={item.id} href={item.href}>
                  <span>
                    <span className="block font-medium">{item.title}</span>
                    <span className="text-sm text-muted">{item.start ? `${item.start}-${item.end}` : "All day"}</span>
                  </span>
                  <Badge tone="neutral">{item.type}</Badge>
                </ListItem>
              ))}
            </List>
          )}
        </Card>

        <Card id="approvals" title="Pending approvals" subtitle={PHASE1_NOTICE}>
          <ApprovalList />
        </Card>

        <Card id="priority-tasks" title="Priority tasks" href="/tasks">
          {priorityTasksToday(data).length === 0 ? (
            <EmptyState>No high-priority or due-today tasks.</EmptyState>
          ) : (
            <List>
              {priorityTasksToday(data).slice(0, 5).map((t) => (
                <ListItem key={t.id} href="/tasks">
                  <span>
                    <span className="block font-medium">{t.title}</span>
                    <span className="text-sm text-muted">Due {formatDate(t.dueDate)} · {t.owner}</span>
                  </span>
                  <Badge>{t.priority}</Badge>
                </ListItem>
              ))}
            </List>
          )}
        </Card>

        <Card id="overdue" title="Overdue tasks" subtitle="Past their due date and not done" href="/tasks">
          {overdue.length === 0 ? (
            <EmptyState>No overdue tasks.</EmptyState>
          ) : (
            <List>
              {overdue.map((t) => (
                <ListItem key={t.id} href="/tasks">
                  <span>
                    <span className="block font-medium">{t.title}</span>
                    <span className="text-sm text-clay">Was due {formatDate(t.dueDate)} · {t.owner}</span>
                  </span>
                  <Badge tone="clay">Overdue</Badge>
                </ListItem>
              ))}
            </List>
          )}
        </Card>

        <Card id="follow-ups" title="Follow-ups" subtitle="Customers and B2B accounts to contact" href="/customers">
          {followUps.length === 0 ? (
            <EmptyState>No follow-ups due.</EmptyState>
          ) : (
            <List>
              {followUps.map((c) => (
                <ListItem key={c.id} href="/customers">
                  <span>
                    <span className="block font-medium">{c.name}</span>
                    <span className="text-sm text-muted">{c.lastInteractionNote || "No note"}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <Badge>{c.opportunity}</Badge>
                    <span className="text-xs text-muted">Due {formatDate(c.followUpDate as string)}</span>
                  </span>
                </ListItem>
              ))}
            </List>
          )}
        </Card>

        <Card id="issues" title="Important customer issues" href="/customers">
          {issues.length === 0 ? (
            <EmptyState>No open customer issues.</EmptyState>
          ) : (
            <List>
              {issues.map((i) => (
                <ListItem key={i.id} href="/customers">
                  <span>
                    <span className="block font-medium">{i.title}</span>
                    <span className="text-sm text-muted">{getCustomer(data, i.customerId)?.name ?? "No customer linked"} · opened {formatDate(i.openedAt)}</span>
                  </span>
                  <Badge>{i.severity}</Badge>
                </ListItem>
              ))}
            </List>
          )}
        </Card>
      </div>

      <h2 className="font-display mt-10 mb-3 text-2xl font-semibold text-forest">Alerts</h2>
      <div className="grid gap-6 md:grid-cols-3">
        <AlertCard title="Campaign alerts" tone="sky" alerts={campaignAlerts(data)} />
        <AlertCard title="Product and stock alerts" tone="butter" alerts={productAlerts(data)} empty={stockGap ? `${stockGap} ${DATA_NOT_AVAILABLE}` : "No alerts."} />
        <AlertCard title="Channel alerts" tone="blush" alerts={channelProblems} empty={channels.some((c) => c.status === "connected") ? "No alerts." : "No channels connected yet."} />
      </div>

      <Card id="upcoming-meetings" title="Upcoming meetings" href="/meetings" className="mt-6">
        {upcoming.length === 0 ? (
          <EmptyState>No upcoming meetings.</EmptyState>
        ) : (
          <List>
            {upcoming.map((m) => (
              <ListItem key={m.id} href="/meetings">
                <span>
                  <span className="block font-medium">{m.title}</span>
                  <span className="text-sm text-muted">{formatDate(m.date)} · {m.start}-{m.end}</span>
                </span>
              </ListItem>
            ))}
          </List>
        )}
      </Card>
    </>
  );
}

function AlertCard({ title, tone, alerts, empty = "No alerts." }: { title: string; tone: "sky" | "butter" | "blush" | "highlight"; alerts: { id: string; severity: string; message: string; href: string }[]; empty?: string }) {
  return (
    <Card title={title} tone={tone}>
      {alerts.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li key={a.id} className="text-sm">
              <Link href={a.href} className="block rounded-xl p-2 hover:bg-white/60">
                <Badge>{a.severity}</Badge>
                <span className="mt-1 block leading-relaxed">{a.message}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
