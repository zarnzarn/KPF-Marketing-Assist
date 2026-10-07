// AI secretary (rule-based, no AI model yet).
// It picks a "tool" from the question and answers ONLY from the user's data,
// local monthly reports and read-only channel snapshots. Every statement is
// labelled FACT / ANALYSIS / ESTIMATE / RECOMMENDATION / DATA GAP.
// It can only READ and PREPARE drafts. There are no send / publish / reprice /
// launch tools.

import { requiresApproval } from "../approvals";
import { DATA_NOT_AVAILABLE } from "../constants";
import { formatDate } from "../dates";
import {
  campaignAlerts,
  followUpsDue,
  getProduct,
  isEmpty,
  meetingsOn,
  openIssues,
  overdueTasks,
  pendingApprovals,
  productAlerts,
  recommendedPriorities,
  shopGap,
} from "../queries";
import type { MonthlyReport, ReportBlock } from "../reports/types";
import type { ChannelSnapshot } from "../channels/types";
import type { AppData, ApprovalActionType, SourceRecord } from "../types";

export type AnswerLabel = "FACT" | "ANALYSIS" | "ESTIMATE" | "RECOMMENDATION" | "DATA GAP";

export interface AnswerBlock {
  label: AnswerLabel;
  text: string;
}

export interface ActionPreview {
  title: string;
  description: string;
  actionType: ApprovalActionType;
  needsApproval: boolean;
  draftText?: string;
}

export interface SecretaryAnswer {
  tool: ToolName;
  title: string;
  blocks: AnswerBlock[];
  sources: SourceRecord[];
  actionPreview?: ActionPreview;
}

export type ToolName =
  | "firstToday"
  | "overdue"
  | "followUps"
  | "marketingIssues"
  | "campaignAttention"
  | "meetingPrep"
  | "businessConcerns"
  | "draftMessage"
  | "approvals"
  | "productAttention"
  | "monthlyReport"
  | "channels"
  | "unknown";

export { DATA_NOT_AVAILABLE };

const toolRules: { tool: ToolName; pattern: RegExp }[] = [
  { tool: "draftMessage", pattern: /\b(draft|write|compose)\b.*\b(message|line|broadcast|caption|post)\b/i },
  { tool: "channels", pattern: /\b(channels?|instagram|followers?|ga4|google analytics|shop|website traffic|line oa)\b/i },
  { tool: "monthlyReport", pattern: /\breports?\b|monthly|\b(january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b|supermarket|branch|facebook|sales/i },
  { tool: "overdue", pattern: /overdue|late task|past due|behind schedule/i },
  { tool: "followUps", pattern: /follow[\s-]?up/i },
  { tool: "approvals", pattern: /approv|waiting for me|sign[\s-]?off/i },
  { tool: "meetingPrep", pattern: /meeting|brief|prepare for/i },
  { tool: "campaignAttention", pattern: /campaign/i },
  { tool: "marketingIssues", pattern: /marketing issue|issues? (should|to) (i )?know|complaint/i },
  { tool: "productAttention", pattern: /product|stock/i },
  { tool: "businessConcerns", pattern: /concern|risk|worr|biggest/i },
  { tool: "firstToday", pattern: /first|priorit|today|start/i },
];

/** Chooses which tool should answer. Pure function, easy to test. */
export function selectTool(question: string): ToolName {
  const text = question.trim();
  if (!text) return "unknown";
  return toolRules.find((rule) => rule.pattern.test(text))?.tool ?? "unknown";
}

export const quickActions = [
  "What should I do first today?",
  "What is overdue?",
  "What needs follow-up?",
  "What marketing issues should I know?",
  "What campaigns need attention?",
  "What should I prepare for today's meetings?",
  "What are the biggest business concerns?",
];

export const suggestedQuestions = [
  "Summarize the latest monthly report",
  "How are our channels doing?",
  "What is waiting for my approval?",
  "Draft a LINE message for the weekend promotion",
];

/** Data the secretary may read. Everything is passed in; nothing is stored in this module. */
export interface SecretaryContext {
  data: AppData;
  reports?: MonthlyReport[];
  channels?: ChannelSnapshot[];
}

const gap = (what?: string): AnswerBlock => ({ label: "DATA GAP", text: what ? `${what}: ${DATA_NOT_AVAILABLE}` : DATA_NOT_AVAILABLE });

function nothingYet(tool: ToolName, title: string, howToAdd: string): SecretaryAnswer {
  return { tool, title, blocks: [gap(), { label: "RECOMMENDATION", text: howToAdd }], sources: [] };
}

function unique(sources: SourceRecord[]): SourceRecord[] {
  const seen = new Set<string>();
  return sources.filter((s) => (seen.has(`${s.kind}:${s.id}`) ? false : (seen.add(`${s.kind}:${s.id}`), true)));
}

export function answerQuestion(question: string, context: SecretaryContext): SecretaryAnswer {
  const d = context.data;
  switch (selectTool(question)) {
    case "firstToday":
      return firstToday(d);
    case "overdue":
      return overdue(d);
    case "followUps":
      return followUps(d);
    case "marketingIssues":
      return marketingIssues(d);
    case "campaignAttention":
      return campaignAttention(d);
    case "meetingPrep":
      return meetingPrep(d);
    case "businessConcerns":
      return businessConcerns(d, context.channels ?? []);
    case "draftMessage":
      return draftMessage(d);
    case "approvals":
      return approvalsAnswer(d);
    case "productAttention":
      return productAttention(d);
    case "monthlyReport":
      return monthlyReportAnswer(question, context.reports ?? []);
    case "channels":
      return channelsAnswer(context.channels ?? []);
    default:
      return {
        tool: "unknown",
        title: "I can't answer that from your data",
        blocks: [gap(), { label: "RECOMMENDATION", text: "Try a quick action, or ask about tasks, follow-ups, campaigns, meetings, monthly reports or channels." }],
        sources: [],
      };
  }
}

function firstToday(d: AppData): SecretaryAnswer {
  const top = recommendedPriorities(d).slice(0, 3);
  if (top.length === 0) return nothingYet("firstToday", "What to do first today", "Add tasks, follow-ups or customer issues, and I will rank them for you.");
  return {
    tool: "firstToday",
    title: "What to do first today",
    blocks: [
      ...top.map((p, i) => ({ label: "FACT" as const, text: `${i + 1}. ${p.title} (${p.reason})` })),
      { label: "ANALYSIS", text: "Ranked by severity, how long each item has been open, and whether a customer is waiting." },
      { label: "RECOMMENDATION", text: `Start with: ${top[0].title}` },
    ],
    sources: unique(top.map((p) => ({ kind: p.kind, id: p.id, label: p.title, href: p.href }))),
  };
}

function overdue(d: AppData): SecretaryAnswer {
  if (d.tasks.length === 0) return nothingYet("overdue", "Overdue tasks", "Add your tasks on the Tasks page.");
  const list = overdueTasks(d);
  if (list.length === 0) return { tool: "overdue", title: "Overdue tasks", blocks: [{ label: "FACT", text: "No overdue tasks." }], sources: [] };
  const high = list.filter((t) => t.priority === "High").length;
  return {
    tool: "overdue",
    title: `${list.length} overdue task${list.length === 1 ? "" : "s"}`,
    blocks: [
      ...list.map((t) => ({ label: "FACT" as const, text: `${t.title} (due ${formatDate(t.dueDate)}, owner: ${t.owner}, ${t.priority} priority)` })),
      { label: "ANALYSIS", text: `${high} of ${list.length} ${list.length === 1 ? "is" : "are"} high priority.` },
      { label: "RECOMMENDATION", text: "Finish or reschedule the high-priority items first." },
    ],
    sources: list.map((t) => ({ kind: "Task" as const, id: t.id, label: t.title, href: "/tasks" })),
  };
}

function followUps(d: AppData): SecretaryAnswer {
  if (d.customers.length === 0) return nothingYet("followUps", "Follow-ups", "Add customers and B2B accounts with a follow-up date on the Customers & B2B page.");
  const list = followUpsDue(d);
  if (list.length === 0) return { tool: "followUps", title: "Follow-ups", blocks: [{ label: "FACT", text: "No follow-ups are due today or overdue." }], sources: [] };
  return {
    tool: "followUps",
    title: `${list.length} follow-up${list.length === 1 ? "" : "s"} due or overdue`,
    blocks: [
      ...list.map((c) => ({ label: "FACT" as const, text: `${c.name}: follow-up ${formatDate(c.followUpDate as string)}; status "${c.opportunity.toLowerCase()}"; last note: ${c.lastInteractionNote || DATA_NOT_AVAILABLE}` })),
      { label: "RECOMMENDATION", text: "Prepare a draft for each one and review it before anything is sent." },
    ],
    sources: list.map((c) => ({ kind: "Customer" as const, id: c.id, label: c.name, href: "/customers" })),
  };
}

function marketingIssues(d: AppData): SecretaryAnswer {
  const issues = openIssues(d.issues);
  const pending = pendingApprovals(d);
  if (issues.length === 0 && pending.length === 0) return nothingYet("marketingIssues", "Marketing issues", "Record customer issues on the Customers & B2B page. Approvals appear when you create approval requests.");
  return {
    tool: "marketingIssues",
    title: "Marketing issues to know",
    blocks: [
      ...issues.map((i) => ({ label: "FACT" as const, text: `${i.severity}: ${i.title}. ${i.summary}` })),
      { label: "FACT", text: `${pending.length} approval${pending.length === 1 ? " is" : "s are"} pending.` },
      { label: "RECOMMENDATION", text: "Handle high-severity customer issues first, then clear the oldest approvals." },
    ],
    sources: unique(issues.map((i) => ({ kind: "Issue" as const, id: i.id, label: i.title, href: "/customers" }))),
  };
}

function campaignAttention(d: AppData): SecretaryAnswer {
  if (d.campaigns.length === 0) return nothingYet("campaignAttention", "Campaigns", "Add your campaigns on the Campaigns page.");
  const alerts = campaignAlerts(d);
  if (alerts.length === 0) return { tool: "campaignAttention", title: "Campaigns", blocks: [{ label: "FACT", text: "No campaign needs attention right now." }], sources: [] };
  return {
    tool: "campaignAttention",
    title: "Campaigns that need attention",
    blocks: [...alerts.map((a) => ({ label: "FACT" as const, text: a.message })), { label: "RECOMMENDATION", text: "Clear pending approvals first, then finish content for campaigns starting soon." }],
    sources: unique(d.campaigns.filter((c) => alerts.some((a) => a.id.endsWith(c.id))).map((c) => ({ kind: "Campaign" as const, id: c.id, label: c.name, href: "/campaigns" }))),
  };
}

function meetingPrep(d: AppData): SecretaryAnswer {
  const today = meetingsOn(d, d.today);
  if (today.length === 0) return nothingYet("meetingPrep", "Today's meetings", "Add meetings with agenda and notes on the Meetings page.");
  return {
    tool: "meetingPrep",
    title: `Prepare for ${today.length} meeting${today.length === 1 ? "" : "s"} today`,
    blocks: [
      ...today.flatMap((m) => [
        { label: "FACT" as const, text: `${m.start}-${m.end} ${m.title}. Agenda: ${m.agenda.join("; ") || DATA_NOT_AVAILABLE}.` },
        { label: "FACT" as const, text: `Previous discussion: ${m.previousDiscussion || DATA_NOT_AVAILABLE}` },
      ]),
      { label: "RECOMMENDATION", text: "Do not confirm prices, volumes or commitments in a meeting without approval." },
    ],
    sources: today.map((m) => ({ kind: "Meeting" as const, id: m.id, label: m.title, href: "/meetings" })),
  };
}

function businessConcerns(d: AppData, channels: ChannelSnapshot[]): SecretaryAnswer {
  const blocks: AnswerBlock[] = [
    ...openIssues(d.issues).filter((i) => i.severity === "High").map((i) => ({ label: "FACT" as const, text: `High-severity issue: ${i.title}.` })),
    ...productAlerts(d).map((a) => ({ label: "FACT" as const, text: a.message })),
    ...campaignAlerts(d).filter((a) => a.severity === "High").map((a) => ({ label: "FACT" as const, text: a.message })),
    ...channels.filter((c) => c.status === "error").map((c) => ({ label: "FACT" as const, text: `${c.label} could not be read: ${c.message ?? DATA_NOT_AVAILABLE}` })),
  ];
  // Missing sources are named, so "nothing recorded" is never read as "nothing wrong".
  const stock = shopGap(d);
  const missing: AnswerBlock[] = [
    ...(stock ? [gap(`Stock levels (${stock})`)] : []),
    ...channels.filter((c) => c.status === "not_configured" && c.channel !== "shop").map((c) => gap(`${c.label} (not connected)`)),
  ];
  if (blocks.length === 0) {
    if (isEmpty(d) && d.products.length === 0 && !channels.some((c) => c.status === "connected")) {
      return nothingYet("businessConcerns", "Business concerns", "Concerns come from customer issues, stock levels, campaigns and channel connections. Add your entries and connect your channels.");
    }
    return {
      tool: "businessConcerns",
      title: "Business concerns",
      blocks: [{ label: "FACT", text: "No high-severity customer issues, stock alerts, high-severity campaign alerts or channel errors are recorded." }, ...missing],
      sources: [],
    };
  }
  return { tool: "businessConcerns", title: "Biggest business concerns", blocks: [...blocks, ...missing, gap("Root causes")], sources: [] };
}

function draftMessage(d: AppData): SecretaryAnswer {
  // Prefer a draft that has text; a titled draft with no text is a gap, not something to "use".
  const lineDrafts = d.content.filter((c) => c.type === "LINE OA" && c.status !== "Published");
  const existing = lineDrafts.find((c) => c.draftText) ?? lineDrafts[0];
  const draftText =
    existing?.draftText ??
    "Draft only (not sent): [Write the LINE message here in the brand voice.] Offer details and prices: Data not available until the promotion is decided.";
  return {
    tool: "draftMessage",
    title: "Draft LINE message (not sent)",
    blocks: [
      existing?.draftText ? { label: "FACT", text: `Using your saved draft "${existing.title}".` } : existing ? gap(`Draft text for "${existing.title}"`) : gap("A saved LINE OA draft"),
      gap("Offer details and prices"),
      { label: "RECOMMENDATION", text: "Fill in the offer after it is decided, check the brand rules, then create an approval request." },
    ],
    sources: existing ? [{ kind: "Content", id: existing.id, label: existing.title, href: "/content" }] : [],
    actionPreview: {
      title: "Send LINE OA broadcast",
      description: "Draft only. Creating an approval request does not send anything.",
      actionType: "Send external message",
      needsApproval: requiresApproval("Send external message"),
      draftText,
    },
  };
}

function approvalsAnswer(d: AppData): SecretaryAnswer {
  const list = pendingApprovals(d);
  if (list.length === 0) return { tool: "approvals", title: "Approvals", blocks: [{ label: "FACT", text: "Nothing is waiting for your approval." }], sources: [] };
  return {
    tool: "approvals",
    title: `${list.length} approval${list.length === 1 ? "" : "s"} waiting for you`,
    blocks: [
      ...list.map((a) => ({ label: "FACT" as const, text: `${a.actionType}: ${a.title} (requested ${formatDate(a.requestedAt)})` })),
      { label: "RECOMMENDATION", text: "Review the oldest first. Approving only changes the status here; nothing is sent." },
    ],
    sources: list.map((a) => ({ kind: "Approval" as const, id: a.id, label: a.title, href: "/marketing" })),
  };
}

function productAttention(d: AppData): SecretaryAnswer {
  if (d.products.length === 0) {
    return { tool: "productAttention", title: "Products", blocks: [gap(`Products and stock (${shopGap(d)})`), { label: "RECOMMENDATION", text: "Check the shop on the Channels page to see products, prices and stock." }], sources: [] };
  }
  const alerts = productAlerts(d);
  if (alerts.length === 0) return { tool: "productAttention", title: "Products", blocks: [{ label: "FACT", text: "No product is low or out of stock." }], sources: [] };
  return {
    tool: "productAttention",
    title: `${alerts.length} product${alerts.length === 1 ? "" : "s"} low or out of stock`,
    blocks: [...alerts.map((a) => ({ label: "FACT" as const, text: a.message })), { label: "RECOMMENDATION", text: "Do not promote these products until stock is confirmed." }],
    sources: alerts.map((a) => {
      const p = getProduct(d, a.id.replace("pal-", ""));
      return { kind: "Product" as const, id: p?.id ?? a.id, label: p?.name ?? a.message, href: "/products" };
    }),
  };
}

function channelsAnswer(channels: ChannelSnapshot[]): SecretaryAnswer {
  const connected = channels.filter((c) => c.status === "connected");
  if (connected.length === 0) return nothingYet("channels", "Channels", "Connect your channels on the Channels page (read-only).");
  // A metric the channel did not send is a DATA GAP, even on a connected channel.
  const blocks: AnswerBlock[] = connected.flatMap((c) =>
    c.metrics.map((m): AnswerBlock => (m.value === DATA_NOT_AVAILABLE ? gap(`${c.label}: ${m.label}${m.note ? ` (${m.note})` : ""}`) : { label: "FACT", text: `${c.label}: ${m.label} ${m.value}${m.note ? ` (${m.note})` : ""}` })),
  );
  for (const c of channels.filter((x) => x.status !== "connected")) blocks.push(gap(`${c.label} (${c.status === "error" ? c.message ?? "error" : "not connected"})`));
  return {
    tool: "channels",
    title: "How your channels are doing",
    blocks: blocks.length ? blocks : [gap()],
    sources: connected.map((c) => ({ kind: "Channel" as const, id: c.channel, label: c.label, href: "/channels" })),
  };
}


// ---------- monthly reports ----------
// Answers repeat only what the report says. Nothing is calculated or invented.

// Only sentences about missing data; "The promotion was not renewed" is a fact, not a gap.
const GAP_PATTERN = /not (yet )?(set up|available|included|reported|tracked|provided|collected)|data (was|is) not|no data\b/i;

const sectionTopics: { pattern: RegExp; section: RegExp }[] = [
  { pattern: /supermarket|branch/i, section: /supermarket/i },
  { pattern: /website|google/i, section: /website/i },
  { pattern: /facebook|social/i, section: /social|facebook/i },
  { pattern: /\bline\b/i, section: /line/i },
  { pattern: /sales/i, section: /sales highlights/i },
];

function blockLines(blocks: ReportBlock[], maxRows = 8): string[] {
  return blocks.flatMap((block) => {
    if (block.type === "bullets") return block.items.slice(0, 4);
    // Each value keeps its column heading; a blank cell is said to be missing, not dropped.
    if (block.type === "table") return block.rows.slice(0, maxRows).map((row) => `${row[0]}: ${row.slice(1).map((v, i) => `${block.headers[i + 1] || `Column ${i + 2}`} ${v || DATA_NOT_AVAILABLE}`).join("; ")}`);
    return [];
  });
}

function allText(report: MonthlyReport): string[] {
  const blocks = [...report.intro, ...report.sections.flatMap((s) => s.blocks)];
  return blocks.flatMap((b) => {
    if (b.type === "paragraph") return [b.text];
    if (b.type === "bullets") return b.items;
    if (b.type === "callout") return b.paragraphs;
    return [];
  });
}

function chooseReport(question: string, reports: MonthlyReport[]): MonthlyReport {
  const months = [["january", "jan"], ["february", "feb"], ["march", "mar"], ["april", "apr"], ["may"], ["june", "jun"], ["july", "jul"], ["august", "aug"], ["september", "sep"], ["october", "oct"], ["november", "nov"], ["december", "dec"]];
  const asked = months.findIndex((names) => names.some((n) => new RegExp(`\\b${n}\\b`, "i").test(question)));
  if (asked >= 0) {
    const key = `-${String(asked + 1).padStart(2, "0")}`;
    const match = reports.find((r) => r.month.endsWith(key));
    if (match) return match;
  }
  return reports[0];
}

function monthlyReportAnswer(question: string, reports: MonthlyReport[]): SecretaryAnswer {
  if (reports.length === 0) {
    return {
      tool: "monthlyReport",
      title: "No monthly report available",
      blocks: [
        { label: "DATA GAP", text: DATA_NOT_AVAILABLE },
        { label: "RECOMMENDATION", text: "Point REPORTS_DIR at your monthly report folder (see the README), then ask again." },
      ],
      sources: [],
    };
  }

  const report = chooseReport(question, reports);
  const topic = sectionTopics.find((t) => t.pattern.test(question));
  const topicSection = topic ? report.sections.find((s) => topic.section.test(s.title)) : undefined;
  const blocks: AnswerBlock[] = [{ label: "FACT", text: `Source: ${report.title}.` }];

  if (topicSection) {
    for (const line of blockLines(topicSection.blocks)) blocks.push({ label: "FACT", text: line });
  } else {
    const kpis = [...report.intro, ...report.sections.flatMap((s) => s.blocks)].find((b) => b.type === "kpis");
    if (kpis?.type === "kpis") {
      for (const k of kpis.items) blocks.push({ label: "FACT", text: `${k.label}: ${k.value}${k.note ? ` (${k.note})` : ""}` });
    }
    const observation = report.sections.find((s) => /key observation/i.test(s.title)) ?? report.sections.find((s) => /executive summary/i.test(s.title));
    for (const line of observation ? blockLines(observation.blocks) : []) blocks.push({ label: "FACT", text: line });
    const plan = report.sections.find((s) => /action plan/i.test(s.title));
    for (const line of plan ? blockLines(plan.blocks, 4) : []) blocks.push({ label: "FACT", text: `Action plan in the report: ${line}` });
  }

  // The report's own notes about missing data are repeated word for word.
  const gaps = Array.from(new Set(allText(report).filter((t) => GAP_PATTERN.test(t)))).slice(0, 3);
  for (const gap of gaps) blocks.push({ label: "DATA GAP", text: gap });
  if (blocks.length === 1) blocks.push({ label: "DATA GAP", text: DATA_NOT_AVAILABLE });

  return {
    tool: "monthlyReport",
    title: report.title,
    blocks,
    sources: [{ kind: "Report", id: report.id, label: report.title, href: report.month ? `/reports?month=${report.month}` : "/reports" }],
  };
}
