// Business logic: pure functions over AppData. No UI code and no stored data in here.
// Every function works on empty data and returns empty results rather than guessing.

import { addDays, daysBetween, formatDate } from "./dates";
import type { AppData, CalendarItem, Customer, CustomerIssue, Task } from "./types";

// ---------- lookups ----------

export const getProduct = (d: AppData, id?: string) => d.products.find((p) => p.id === id);
export const getCustomer = (d: AppData, id?: string) => d.customers.find((c) => c.id === id);
export const getCampaign = (d: AppData, id?: string) => d.campaigns.find((c) => c.id === id);

const rank = { High: 0, Medium: 1, Low: 2 } as const;

// ---------- tasks ----------

export function openTasks(list: Task[]): Task[] {
  return list.filter((t) => t.status !== "Done");
}

export function overdueTasks(d: AppData): Task[] {
  return openTasks(d.tasks)
    .filter((t) => t.dueDate < d.today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function priorityTasksToday(d: AppData): Task[] {
  return openTasks(d.tasks)
    .filter((t) => t.dueDate >= d.today && (t.dueDate === d.today || t.priority === "High"))
    .sort((a, b) => rank[a.priority] - rank[b.priority] || a.dueDate.localeCompare(b.dueDate));
}

// ---------- follow-ups ----------

export function followUpsDue(d: AppData): Customer[] {
  return d.customers
    .filter((c) => c.followUpDate !== null && c.followUpDate <= d.today)
    .sort((a, b) => (a.followUpDate ?? "").localeCompare(b.followUpDate ?? ""));
}

export function upcomingFollowUps(d: AppData, days = 7): Customer[] {
  const end = addDays(d.today, days);
  return d.customers
    .filter((c) => c.followUpDate !== null && c.followUpDate > d.today && c.followUpDate <= end)
    .sort((a, b) => (a.followUpDate ?? "").localeCompare(b.followUpDate ?? ""));
}

// ---------- meetings ----------

export const meetingsOn = (d: AppData, date: string) =>
  d.meetings.filter((m) => m.date === date).sort((a, b) => a.start.localeCompare(b.start));

export const upcomingMeetings = (d: AppData) =>
  d.meetings
    .filter((m) => m.date >= d.today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));

// ---------- approvals & issues ----------

export const pendingApprovals = (d: AppData) => d.approvals.filter((a) => a.state === "Pending");

export function openIssues(list: CustomerIssue[]): CustomerIssue[] {
  return list.filter((i) => i.status !== "Resolved").sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// ---------- calendar ----------

export function calendarItems(d: AppData): CalendarItem[] {
  const items: CalendarItem[] = [];
  for (const m of d.meetings) {
    items.push({ id: m.id, title: m.title, date: m.date, start: m.start, end: m.end, type: "Meeting", href: "/meetings" });
  }
  for (const c of d.campaigns) {
    for (const ms of c.milestones) {
      items.push({ id: `${c.id}-${ms.date}-${ms.label}`, title: `${c.name}: ${ms.label}`, date: ms.date, type: "Campaign milestone", href: "/campaigns" });
    }
  }
  for (const c of d.content.filter((x) => x.status !== "Published")) {
    items.push({ id: c.id, title: `Deadline: ${c.title}`, date: c.dueDate, type: "Content deadline", href: "/content" });
  }
  for (const c of d.customers.filter((x) => x.followUpDate)) {
    items.push({ id: `fu-${c.id}`, title: `Follow up: ${c.name}`, date: c.followUpDate as string, type: "Follow-up", href: "/customers" });
  }
  for (const t of openTasks(d.tasks)) {
    items.push({ id: `task-${t.id}`, title: `Task due: ${t.title}`, date: t.dueDate, type: "Task", href: "/tasks" });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "99").localeCompare(b.start ?? "99"));
}

export const calendarItemsOn = (d: AppData, date: string) => calendarItems(d).filter((i) => i.date === date);

// ---------- alerts ----------

export interface Alert {
  id: string;
  area: "Campaign" | "Product" | "Channel";
  severity: "High" | "Medium" | "Low";
  message: string;
  href: string;
}

export function productAlerts(d: AppData): Alert[] {
  return d.products
    .filter((p) => p.stockStatus === "Low stock" || p.stockStatus === "Out of stock")
    .map((p) => ({
      id: `pal-${p.id}`,
      area: "Product" as const,
      severity: p.stockStatus === "Out of stock" ? ("High" as const) : ("Medium" as const),
      message: `${p.name}: ${p.stockStatus.toLowerCase()} (${p.stockUnits} units).`,
      href: "/products",
    }));
}

export function campaignAlerts(d: AppData): Alert[] {
  const result: Alert[] = [];
  for (const c of d.campaigns) {
    if (c.status === "Completed") continue;
    if (c.approvalStatus === "Pending approval") {
      result.push({ id: `cal-appr-${c.id}`, area: "Campaign", severity: "High", message: `${c.name} is waiting for approval.`, href: "/campaigns" });
    }
    const daysToStart = daysBetween(d.today, c.startDate);
    if (c.status === "Planned" && daysToStart >= 0 && daysToStart <= 14 && c.contentStatus !== "Ready") {
      result.push({ id: `cal-content-${c.id}`, area: "Campaign", severity: "Medium", message: `${c.name} starts in ${daysToStart} days and content is "${c.contentStatus.toLowerCase()}".`, href: "/campaigns" });
    }
    const daysToEnd = daysBetween(d.today, c.endDate);
    if (c.status === "Active" && daysToEnd >= 0 && daysToEnd <= 14) {
      result.push({ id: `cal-end-${c.id}`, area: "Campaign", severity: "Low", message: `${c.name} ends in ${daysToEnd} days.`, href: "/campaigns" });
    }
  }
  return result;
}

// ---------- recommended priorities ----------

export interface Priority {
  id: string;
  kind: "Issue" | "Task" | "Approval" | "Customer";
  title: string;
  reason: string;
  score: number;
  href: string;
}

export function recommendedPriorities(d: AppData): Priority[] {
  const list: Priority[] = [];
  for (const i of openIssues(d.issues).filter((x) => x.severity !== "Low")) {
    const days = Math.max(0, daysBetween(i.openedAt, d.today));
    list.push({ id: i.id, kind: "Issue", title: `Resolve: ${i.title}`, reason: `${i.severity}-severity customer issue open for ${days} days.`, score: (i.severity === "High" ? 90 : 60) + Math.min(days, 10), href: "/customers" });
  }
  for (const t of overdueTasks(d).filter((x) => x.priority === "High")) {
    list.push({ id: t.id, kind: "Task", title: t.title, reason: `High-priority task overdue since ${formatDate(t.dueDate)}.`, score: 85, href: "/tasks" });
  }
  for (const a of pendingApprovals(d)) {
    const days = Math.max(0, daysBetween(a.requestedAt, d.today));
    list.push({ id: a.id, kind: "Approval", title: `Decide: ${a.title}`, reason: `Approval (${a.actionType}) pending for ${days} day${days === 1 ? "" : "s"}.`, score: 55 + days * 3, href: "/marketing" });
  }
  for (const c of followUpsDue(d).filter((x) => x.opportunity === "Proposal sent" || x.opportunity === "At risk")) {
    list.push({ id: c.id, kind: "Customer", title: `Follow up: ${c.name}`, reason: `Opportunity is "${c.opportunity.toLowerCase()}" and follow-up is due.`, score: 70, href: "/customers" });
  }
  for (const t of priorityTasksToday(d).filter((x) => x.dueDate === d.today)) {
    list.push({ id: t.id, kind: "Task", title: t.title, reason: `${t.priority}-priority task due today.`, score: t.priority === "High" ? 75 : 50, href: "/tasks" });
  }
  const seen = new Set<string>();
  return list
    .sort((a, b) => b.score - a.score)
    .filter((p) => (seen.has(`${p.kind}:${p.id}`) ? false : (seen.add(`${p.kind}:${p.id}`), true)))
    .slice(0, 5);
}

/** True when the user has not entered anything yet. */
export function isEmpty(d: AppData): boolean {
  return [d.tasks, d.meetings, d.customers, d.campaigns, d.content, d.issues, d.approvals, d.documents].every((l) => l.length === 0);
}
