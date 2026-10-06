// Business logic: pure functions that read MOCK data. No UI code in here.

import {
  MOCK_TODAY,
  approvals,
  campaigns,
  channelSegment,
  contentItems,
  customers,
  issues,
  marketingActivities,
  meetings,
  products,
  salesRows,
  SALES_MONTHS,
  tasks,
} from "@/data/mock";
import { addDays, daysBetween, formatDate } from "./dates";
import type {
  CalendarItem,
  Campaign,
  Channel,
  Customer,
  CustomerIssue,
  Product,
  Segment,
  Task,
} from "./types";

// ---------- lookups ----------

export const getProduct = (id?: string) => products.find((p) => p.id === id);
export const getCustomer = (id?: string) => customers.find((c) => c.id === id);
export const getCampaign = (id?: string) => campaigns.find((c) => c.id === id);

const priorityRank = { High: 0, Medium: 1, Low: 2 } as const;

// ---------- tasks ----------

export function openTasks(list: Task[] = tasks): Task[] {
  return list.filter((t) => t.status !== "Done");
}

export function overdueTasks(today = MOCK_TODAY, list: Task[] = tasks): Task[] {
  return openTasks(list)
    .filter((t) => t.dueDate < today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function priorityTasksToday(today = MOCK_TODAY, list: Task[] = tasks): Task[] {
  return openTasks(list)
    .filter((t) => t.dueDate === today || t.priority === "High")
    .filter((t) => t.dueDate >= today)
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.dueDate.localeCompare(b.dueDate));
}

// ---------- follow-ups ----------

export function followUpsDue(today = MOCK_TODAY, list: Customer[] = customers): Customer[] {
  return list
    .filter((c) => c.followUpDate !== null && c.followUpDate <= today)
    .sort((a, b) => (a.followUpDate ?? "").localeCompare(b.followUpDate ?? ""));
}

export function upcomingFollowUps(today = MOCK_TODAY, days = 7, list: Customer[] = customers): Customer[] {
  const end = addDays(today, days);
  return list
    .filter((c) => c.followUpDate !== null && c.followUpDate > today && c.followUpDate <= end)
    .sort((a, b) => (a.followUpDate ?? "").localeCompare(b.followUpDate ?? ""));
}

// ---------- meetings ----------

export const meetingsOn = (date: string) =>
  meetings.filter((m) => m.date === date).sort((a, b) => a.start.localeCompare(b.start));

export const upcomingMeetings = (today = MOCK_TODAY) =>
  meetings
    .filter((m) => m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));

// ---------- approvals & issues ----------

export const pendingApprovals = () => approvals.filter((a) => a.state === "Pending");

export function openIssues(list: CustomerIssue[] = issues): CustomerIssue[] {
  const rank = { High: 0, Medium: 1, Low: 2 } as const;
  return list.filter((i) => i.status !== "Resolved").sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// ---------- calendar ----------

export function calendarItems(): CalendarItem[] {
  const items: CalendarItem[] = [];
  for (const m of meetings) {
    items.push({ id: m.id, title: m.title, date: m.date, start: m.start, end: m.end, type: "Meeting", href: "/meetings" });
  }
  for (const a of marketingActivities.filter((x) => x.type === "Event")) {
    items.push({ id: a.id, title: a.title, date: a.date, type: "Event", href: "/marketing" });
  }
  for (const c of campaigns) {
    for (const ms of c.milestones) {
      items.push({ id: `${c.id}-${ms.date}`, title: `${c.name}: ${ms.label}`, date: ms.date, type: "Campaign milestone", href: "/campaigns" });
    }
  }
  for (const c of contentItems.filter((x) => x.status !== "Published")) {
    items.push({ id: c.id, title: `Deadline: ${c.title}`, date: c.dueDate, type: "Content deadline", href: "/content" });
  }
  for (const c of customers.filter((x) => x.followUpDate)) {
    items.push({ id: `fu-${c.id}`, title: `Follow up: ${c.name}`, date: c.followUpDate as string, type: "Follow-up", href: "/customers" });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "99").localeCompare(b.start ?? "99"));
}

export const calendarItemsOn = (date: string) => calendarItems().filter((i) => i.date === date);

// ---------- sales ----------

export function revenue(filter: { month?: string; channel?: Channel; productId?: string; segment?: Segment } = {}): number {
  return salesRows
    .filter((r) => !filter.month || r.month === filter.month)
    .filter((r) => !filter.channel || r.channel === filter.channel)
    .filter((r) => !filter.productId || r.productId === filter.productId)
    .filter((r) => !filter.segment || channelSegment[r.channel] === filter.segment)
    .reduce((sum, r) => sum + r.revenueThb, 0);
}

export const latestMonth = SALES_MONTHS[SALES_MONTHS.length - 1];
export const previousMonth = SALES_MONTHS[SALES_MONTHS.length - 2];

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null; // cannot calculate: Data not available
  return ((current - previous) / previous) * 100;
}

export function salesSummary() {
  const current = revenue({ month: latestMonth });
  const previous = revenue({ month: previousMonth });
  return {
    month: latestMonth,
    current,
    previous,
    change: percentChange(current, previous),
    sixMonthTotal: revenue(),
  };
}

export function revenueByChannel(month = latestMonth) {
  const channels = Array.from(new Set(salesRows.map((r) => r.channel)));
  return channels
    .map((channel) => ({
      channel,
      segment: channelSegment[channel],
      current: revenue({ month, channel }),
      previous: revenue({ month: previousMonth, channel }),
    }))
    .sort((a, b) => b.current - a.current);
}

export function revenueBySegment(month = latestMonth) {
  return (["B2C", "Retail", "B2B"] as Segment[]).map((segment) => ({
    segment,
    current: revenue({ month, segment }),
    previous: revenue({ month: previousMonth, segment }),
  }));
}

export function revenueByProduct(month = latestMonth) {
  return products
    .map((product) => {
      const current = revenue({ month, productId: product.id });
      const previous = revenue({ month: previousMonth, productId: product.id });
      return { product, current, previous, change: percentChange(current, previous) };
    })
    .filter((r) => r.current > 0 || r.previous > 0)
    .sort((a, b) => b.current - a.current);
}

export function monthlyTrend(filter: { segment?: Segment; productId?: string } = {}) {
  return SALES_MONTHS.map((month) => ({ month, revenue: revenue({ month, ...filter }) }));
}

export const topProducts = (n = 3) => revenueByProduct().slice(0, n);

/** Products whose revenue fell in each of the last three months. */
export function decliningProducts(): { product: Product; change: number | null }[] {
  const last3 = SALES_MONTHS.slice(-3);
  return products
    .filter((p) => {
      const series = last3.map((month) => revenue({ month, productId: p.id }));
      return series.every((v) => v > 0) && series[1] < series[0] && series[2] < series[1];
    })
    .map((product) => ({
      product,
      change: percentChange(revenue({ month: latestMonth, productId: product.id }), revenue({ month: previousMonth, productId: product.id })),
    }));
}

// ---------- alerts ----------

export interface Alert {
  id: string;
  area: "Campaign" | "Product" | "Sales";
  severity: "High" | "Medium" | "Low";
  message: string;
  href: string;
}

export function productAlerts(): Alert[] {
  return products
    .filter((p) => p.stockStatus === "Low stock" || p.stockStatus === "Out of stock")
    .map((p) => ({
      id: `pal-${p.id}`,
      area: "Product" as const,
      severity: p.stockStatus === "Out of stock" ? ("High" as const) : ("Medium" as const),
      message: `${p.name}: ${p.stockStatus.toLowerCase()} (${p.stockUnits} units, reorder level ${p.reorderLevel}).`,
      href: "/products",
    }));
}

export function campaignAlerts(today = MOCK_TODAY, list: Campaign[] = campaigns): Alert[] {
  const result: Alert[] = [];
  for (const c of list) {
    if (c.status === "Completed") continue;
    if (c.approvalStatus === "Pending approval") {
      result.push({ id: `cal-appr-${c.id}`, area: "Campaign", severity: "High", message: `${c.name} is waiting for approval.`, href: "/campaigns" });
    }
    const daysToStart = daysBetween(today, c.startDate);
    if (c.status === "Planned" && daysToStart >= 0 && daysToStart <= 14 && c.contentStatus !== "Ready") {
      result.push({ id: `cal-content-${c.id}`, area: "Campaign", severity: "Medium", message: `${c.name} starts in ${daysToStart} days and content is "${c.contentStatus.toLowerCase()}".`, href: "/campaigns" });
    }
    const daysToEnd = daysBetween(today, c.endDate);
    if (c.status === "Active" && daysToEnd >= 0 && daysToEnd <= 14) {
      result.push({ id: `cal-end-${c.id}`, area: "Campaign", severity: "Low", message: `${c.name} ends in ${daysToEnd} days.`, href: "/campaigns" });
    }
  }
  return result;
}

export function salesAlerts(): Alert[] {
  return decliningProducts().map(({ product, change }) => ({
    id: `sal-${product.id}`,
    area: "Sales" as const,
    severity: "High" as const,
    message: `${product.name} revenue has fallen for 3 months in a row${change === null ? "" : ` (${change.toFixed(1)}% vs last month)`}.`,
    href: "/sales",
  }));
}

// ---------- recommended priorities & daily summary ----------

export interface Priority {
  id: string;
  kind: "Issue" | "Task" | "Approval" | "Customer";
  title: string;
  reason: string;
  score: number;
  href: string;
}

export function recommendedPriorities(today = MOCK_TODAY): Priority[] {
  const list: Priority[] = [];
  for (const i of openIssues().filter((x) => x.severity !== "Low")) {
    const days = daysBetween(i.openedAt, today);
    list.push({ id: i.id, kind: "Issue", title: `Resolve: ${i.title}`, reason: `${i.severity}-severity customer issue open for ${days} days.`, score: (i.severity === "High" ? 90 : 60) + Math.min(days, 10), href: "/customers" });
  }
  for (const t of overdueTasks(today).filter((x) => x.priority === "High")) {
    list.push({ id: t.id, kind: "Task", title: t.title, reason: `High-priority task overdue since ${formatDate(t.dueDate)}.`, score: 85, href: "/tasks" });
  }
  for (const a of pendingApprovals()) {
    const days = daysBetween(a.requestedAt, today);
    list.push({ id: a.id, kind: "Approval", title: `Decide: ${a.title}`, reason: `Approval (${a.actionType}) pending for ${days} day${days === 1 ? "" : "s"}.`, score: 55 + days * 3, href: a.relatedHref });
  }
  for (const c of followUpsDue(today).filter((x) => x.opportunity === "Proposal sent" || x.opportunity === "At risk")) {
    list.push({ id: c.id, kind: "Customer", title: `Follow up: ${c.name}`, reason: `Opportunity is "${c.opportunity.toLowerCase()}" and follow-up is due.`, score: 70, href: "/customers" });
  }
  return list.sort((a, b) => b.score - a.score).slice(0, 5);
}
