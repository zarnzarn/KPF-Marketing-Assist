import Link from "next/link";
import { MOCK_TODAY, businessAlerts, messages } from "@/data/mock";
import { AnswerBlocks } from "@/components/AnswerBlocks";
import { Badge, Card, EmptyState, List, ListItem, PageHeader, Stat } from "@/components/ui";
import { dailySummary } from "@/lib/ai/dailySummary";
import { formatDate, formatLongDate } from "@/lib/dates";
import {
  calendarItemsOn,
  campaignAlerts,
  followUpsDue,
  getCustomer,
  openIssues,
  overdueTasks,
  pendingApprovals,
  priorityTasksToday,
  productAlerts,
  recommendedPriorities,
  salesAlerts,
  upcomingMeetings,
} from "@/lib/queries";
import { PHASE1_NOTICE } from "@/lib/approvals";

export default function TodayPage() {
  const overdue = overdueTasks();
  const followUps = followUpsDue();
  const issues = openIssues();
  const approvals = pendingApprovals();
  const priorities = recommendedPriorities();
  const schedule = calendarItemsOn(MOCK_TODAY);
  const upcoming = upcomingMeetings().filter((m) => m.date > MOCK_TODAY).slice(0, 3);

  return (
    <>
      <PageHeader title="Today" subtitle={`${formatLongDate(MOCK_TODAY)} — what you need to know and do today.`} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Overdue tasks" value={String(overdue.length)} note={overdue.length ? "Needs action" : "All clear"} tone={overdue.length ? "down" : "up"} />
        <Stat label="Approvals waiting" value={String(approvals.length)} note="Decisions needed from you" tone="flat" />
        <Stat label="Follow-ups due" value={String(followUps.length)} note="Due today or earlier" tone={followUps.length ? "down" : "up"} />
        <Stat label="Open customer issues" value={String(issues.length)} note={`${issues.filter((i) => i.severity === "High").length} high severity`} tone="down" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card id="priorities" title="Recommended priorities" subtitle="Ranked by urgency. Start at the top." className="xl:col-span-3">
          <ol className="space-y-3">
            {priorities.map((p, i) => (
              <li key={p.id}>
                <Link href={p.href} className="flex gap-4 rounded-xl border border-line bg-white p-3.5 hover:border-yolk">
                  <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-lg font-semibold text-white" aria-hidden="true">
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
        </Card>

        <Card id="summary" title="AI daily summary" subtitle="Mock summary built from mock data" tone="highlight" className="xl:col-span-2">
          <AnswerBlocks blocks={dailySummary()} onDark />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card id="schedule" title="Today's schedule" subtitle="Meetings, deadlines and follow-ups" href="/calendar" hrefLabel="Open calendar">
          {schedule.length === 0 ? (
            <EmptyState>Nothing scheduled today.</EmptyState>
          ) : (
            <List>
              {schedule.map((item) => (
                <ListItem key={item.id} href={item.href}>
                  <span>
                    <span className="block font-medium">{item.title}</span>
                    <span className="text-sm text-muted">{item.start ? `${item.start}–${item.end}` : "All day"}</span>
                  </span>
                  <Badge tone="neutral">{item.type}</Badge>
                </ListItem>
              ))}
            </List>
          )}
        </Card>

        <Card id="approvals" title="Pending approvals" subtitle={PHASE1_NOTICE} href="/marketing" hrefLabel="See in Marketing">
          <List>
            {approvals.map((a) => (
              <ListItem key={a.id} href={a.relatedHref}>
                <span>
                  <span className="block font-medium">{a.title}</span>
                  <span className="text-sm text-muted">Requested {formatDate(a.requestedAt)}</span>
                </span>
                <Badge tone="gold">{a.actionType}</Badge>
              </ListItem>
            ))}
          </List>
        </Card>

        <Card id="priority-tasks" title="Priority tasks" href="/tasks">
          <List>
            {priorityTasksToday().slice(0, 5).map((t) => (
              <ListItem key={t.id} href="/tasks">
                <span>
                  <span className="block font-medium">{t.title}</span>
                  <span className="text-sm text-muted">Due {formatDate(t.dueDate)} · {t.owner}</span>
                </span>
                <Badge>{t.priority}</Badge>
              </ListItem>
            ))}
          </List>
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
          <List>
            {followUps.map((c) => (
              <ListItem key={c.id} href="/customers">
                <span>
                  <span className="block font-medium">{c.name}</span>
                  <span className="text-sm text-muted">{c.lastInteractionNote}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Badge>{c.opportunity}</Badge>
                  <span className="text-xs text-muted">Due {formatDate(c.followUpDate as string)}</span>
                </span>
              </ListItem>
            ))}
          </List>
        </Card>

        <Card id="issues" title="Important customer issues" href="/customers">
          <List>
            {issues.map((i) => (
              <ListItem key={i.id} href="/customers">
                <span>
                  <span className="block font-medium">{i.title}</span>
                  <span className="text-sm text-muted">{getCustomer(i.customerId)?.name ?? "No customer linked"} · opened {formatDate(i.openedAt)}</span>
                </span>
                <Badge>{i.severity}</Badge>
              </ListItem>
            ))}
          </List>
        </Card>
      </div>

      <h2 className="font-display mt-10 mb-3 text-2xl font-semibold text-forest">Alerts</h2>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <AlertCard title="Campaign alerts" alerts={campaignAlerts()} />
        <AlertCard title="Product alerts" alerts={productAlerts()} />
        <AlertCard title="Sales alerts" alerts={salesAlerts()} />
        <AlertCard title="Business alerts" alerts={businessAlerts} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card id="upcoming-meetings" title="Upcoming meetings" href="/meetings">
          <List>
            {upcoming.map((m) => (
              <ListItem key={m.id} href="/meetings">
                <span>
                  <span className="block font-medium">{m.title}</span>
                  <span className="text-sm text-muted">{formatDate(m.date)} · {m.start}–{m.end}</span>
                </span>
              </ListItem>
            ))}
          </List>
        </Card>

        <Card id="messages" title="Important messages" subtitle="Mock inbox: nothing is connected to real email or LINE">
          <List>
            {messages.map((m) => (
              <ListItem key={m.id} href={m.href}>
                <span>
                  <span className="block font-medium">{m.subject}</span>
                  <span className="text-sm text-muted">{m.from} — {m.preview}</span>
                </span>
                <Badge tone="neutral">{m.channel}</Badge>
              </ListItem>
            ))}
          </List>
        </Card>
      </div>
    </>
  );
}

function AlertCard({ title, alerts }: { title: string; alerts: { id: string; severity: string; message: string; href: string }[] }) {
  return (
    <Card title={title}>
      {alerts.length === 0 ? (
        <EmptyState>No alerts.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li key={a.id} className="text-sm">
              <Link href={a.href} className="block rounded-md hover:bg-forest-soft/50">
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
