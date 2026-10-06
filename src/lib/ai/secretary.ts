// MOCK AI secretary. No real AI is used in Phase 1.
// It picks a "tool" from the question, reads MOCK data, and answers with every
// statement labelled FACT / ANALYSIS / ESTIMATE / RECOMMENDATION / DATA GAP.
// It can only READ data and PREPARE drafts. It has no send / publish / reprice /
// launch tools.

import { MOCK_TODAY, businessAlerts, contentItems, products } from "@/data/mock";
import { requiresApproval } from "../approvals";
import { DATA_NOT_AVAILABLE } from "../constants";
import { formatDate } from "../dates";
import {
  campaignAlerts,
  followUpsDue,
  getCampaign,
  getCustomer,
  getProduct,
  meetingsOn,
  openIssues,
  overdueTasks,
  pendingApprovals,
  productAlerts,
  recommendedPriorities,
  salesAlerts,
} from "../queries";
import type { MonthlyReport, ReportBlock } from "../reports/types";
import type { ApprovalActionType, SourceRecord } from "../types";

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
  | "unknown";

export { DATA_NOT_AVAILABLE };

const toolRules: { tool: ToolName; pattern: RegExp }[] = [
  { tool: "draftMessage", pattern: /\b(draft|write|compose)\b.*\b(message|line|broadcast|caption|post)\b/i },
  { tool: "monthlyReport", pattern: /\breports?\b|monthly|\b(september|august|sep|aug)\b|supermarket|branch|facebook|website traffic|sales/i },
  { tool: "overdue", pattern: /overdue|late task|past due|behind schedule/i },
  { tool: "followUps", pattern: /follow[\s-]?up/i },
  { tool: "approvals", pattern: /approv|waiting for me|sign[\s-]?off/i },
  { tool: "meetingPrep", pattern: /meeting|brief|prepare for/i },
  { tool: "campaignAttention", pattern: /campaign/i },
  { tool: "marketingIssues", pattern: /marketing issue|issues? (should|to) (i )?know|complaint/i },
  { tool: "productAttention", pattern: /product/i },
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
  "Draft a LINE message for the weekend promotion",
  "Which products need marketing attention?",
  "What is waiting for my approval?",
  "Summarize the latest monthly report",
];

const src = {
  task: (id: string, label: string): SourceRecord => ({ kind: "Task", id, label, href: "/tasks" }),
  customer: (id: string): SourceRecord => ({ kind: "Customer", id, label: getCustomer(id)?.name ?? id, href: "/customers" }),
  campaign: (id: string): SourceRecord => ({ kind: "Campaign", id, label: getCampaign(id)?.name ?? id, href: "/campaigns" }),
  product: (id: string): SourceRecord => ({ kind: "Product", id, label: getProduct(id)?.name ?? id, href: "/products" }),
};

function unique(sources: SourceRecord[]): SourceRecord[] {
  const seen = new Set<string>();
  return sources.filter((s) => (seen.has(`${s.kind}:${s.id}`) ? false : (seen.add(`${s.kind}:${s.id}`), true)));
}

/** Extra data the secretary may read. Real monthly reports are loaded on the server and passed in. */
export interface SecretaryContext {
  reports?: MonthlyReport[];
}

export function answerQuestion(question: string, context: SecretaryContext = {}): SecretaryAnswer {
  const tool = selectTool(question);
  switch (tool) {
    case "firstToday":
      return firstToday();
    case "overdue":
      return overdue();
    case "followUps":
      return followUps();
    case "marketingIssues":
      return marketingIssues();
    case "campaignAttention":
      return campaignAttention();
    case "meetingPrep":
      return meetingPrep();
    case "businessConcerns":
      return businessConcerns();
    case "draftMessage":
      return draftMessage();
    case "approvals":
      return approvalsAnswer();
    case "productAttention":
      return productAttention();
    case "monthlyReport":
      return monthlyReportAnswer(question, context.reports ?? []);
    default:
      return {
        tool: "unknown",
        title: "I can't answer that from the mock data",
        blocks: [
          { label: "DATA GAP", text: DATA_NOT_AVAILABLE },
          { label: "RECOMMENDATION", text: "Try one of the quick actions, or ask about tasks, follow-ups, campaigns, meetings or business concerns." },
        ],
        sources: [],
      };
  }
}

function firstToday(): SecretaryAnswer {
  const top = recommendedPriorities().slice(0, 3);
  return {
    tool: "firstToday",
    title: "What to do first today",
    blocks: [
      ...top.map((p, i) => ({ label: "FACT" as const, text: `${i + 1}. ${p.title} — ${p.reason}` })),
      { label: "ANALYSIS", text: "Items are ranked by severity, how long they have been open, and whether a customer is waiting." },
      { label: "RECOMMENDATION", text: top[0] ? `Start with: ${top[0].title}` : "Nothing urgent is recorded." },
    ],
    sources: unique(top.map((p) => ({ kind: p.kind, id: p.id, label: p.title, href: p.href }))),
  };
}

function overdue(): SecretaryAnswer {
  const list = overdueTasks();
  if (list.length === 0) {
    return { tool: "overdue", title: "Overdue tasks", blocks: [{ label: "FACT", text: "No overdue tasks are recorded." }], sources: [] };
  }
  return {
    tool: "overdue",
    title: `${list.length} overdue tasks`,
    blocks: [
      ...list.map((t) => ({ label: "FACT" as const, text: `${t.title} (due ${formatDate(t.dueDate)}, owner: ${t.owner}, ${t.priority} priority)` })),
      { label: "ANALYSIS", text: `${list.filter((t) => t.priority === "High").length} of these are high priority and involve customers who are waiting.` },
      { label: "RECOMMENDATION", text: "Clear the high-priority customer replies first, then reschedule the rest." },
    ],
    sources: list.map((t) => src.task(t.id, t.title)),
  };
}

function followUps(): SecretaryAnswer {
  const list = followUpsDue();
  return {
    tool: "followUps",
    title: `${list.length} follow-ups due or overdue`,
    blocks: [
      ...list.map((c) => ({ label: "FACT" as const, text: `${c.name} — follow-up ${formatDate(c.followUpDate as string)}; status "${c.opportunity.toLowerCase()}"; last: ${c.lastInteractionNote}` })),
      { label: "ANALYSIS", text: "Accounts marked 'at risk' or 'proposal sent' are the most time-sensitive." },
      { label: "DATA GAP", text: "Reasons for reduced Harbor Wholesale orders are not recorded: " + DATA_NOT_AVAILABLE },
      { label: "RECOMMENDATION", text: "Prepare drafts for each follow-up and review them before anything is sent." },
    ],
    sources: list.map((c) => src.customer(c.id)),
  };
}

function marketingIssues(): SecretaryAnswer {
  const issues = openIssues();
  const pending = pendingApprovals();
  return {
    tool: "marketingIssues",
    title: "Marketing issues to know",
    blocks: [
      ...issues.map((i) => ({ label: "FACT" as const, text: `${i.severity} — ${i.title}: ${i.summary}` })),
      { label: "FACT", text: `${pending.length} approvals are pending, so some content and campaigns cannot move forward.` },
      { label: "ANALYSIS", text: "Open customer issues and pending approvals are the main things slowing marketing work." },
      { label: "RECOMMENDATION", text: "Reply to the egg complaint first, then clear approvals that unblock the weekend and launch content." },
    ],
    sources: unique([
      ...issues.map((i) => (i.customerId ? src.customer(i.customerId) : src.product(i.productId as string))),
    ]),
  };
}

function campaignAttention(): SecretaryAnswer {
  const alerts = campaignAlerts();
  return {
    tool: "campaignAttention",
    title: "Campaigns that need attention",
    blocks: [
      ...alerts.map((a) => ({ label: "FACT" as const, text: a.message })),
      { label: "ESTIMATE", text: "If the launch approvals slip past 12 Oct, the 20 Oct sausage start date is at risk (estimate based on the content timeline, not a recorded fact)." },
      { label: "DATA GAP", text: `Sausage launch stock plan: ${DATA_NOT_AVAILABLE}` },
      { label: "RECOMMENDATION", text: "Decide the weekend promotion after checking chicken breast stock, and schedule an approval review for the launch." },
    ],
    sources: unique(["cmp-weekend-fresh", "cmp-sausage-launch", "cmp-duck-chef"].map(src.campaign)),
  };
}

function meetingPrep(): SecretaryAnswer {
  const today = meetingsOn(MOCK_TODAY);
  return {
    tool: "meetingPrep",
    title: `Prepare for ${today.length} meetings today`,
    blocks: [
      ...today.flatMap((m) => [
        { label: "FACT" as const, text: `${m.start}–${m.end} ${m.title}. Agenda: ${m.agenda.join("; ")}.` },
        { label: "FACT" as const, text: `Previous discussion: ${m.previousDiscussion}` },
      ]),
      { label: "ANALYSIS", text: "The hotel call involves duck, where stock is limited, so volume commitments carry risk." },
      { label: "RECOMMENDATION", text: "Do not confirm duck volumes or prices on the call. Collect requirements and bring a proposal for approval." },
    ],
    sources: today.map((m) => ({ kind: "Meeting" as const, id: m.id, label: m.title, href: "/meetings" })),
  };
}

function businessConcerns(): SecretaryAnswer {
  const sales = salesAlerts();
  const stock = productAlerts();
  return {
    tool: "businessConcerns",
    title: "Biggest business concerns",
    blocks: [
      ...sales.map((a) => ({ label: "FACT" as const, text: a.message })),
      ...stock.map((a) => ({ label: "FACT" as const, text: a.message })),
      ...businessAlerts.map((a) => ({ label: "FACT" as const, text: a.message })),
      { label: "ANALYSIS", text: "Duck is the clearest concern: breast sales are falling while whole duck stock is limited." },
      { label: "DATA GAP", text: `Reasons for falling duck breast sales: ${DATA_NOT_AVAILABLE}` },
      { label: "RECOMMENDATION", text: "Ask the B2B team for reasons behind the duck breast decline before changing any prices or promotions." },
    ],
    sources: unique([
      src.product("prd-duck-breast"),
      src.product("prd-whole-duck"),
      src.product("prd-chicken-breast"),
      src.customer("cus-harbor-wholesale"),
    ]),
  };
}

function draftMessage(): SecretaryAnswer {
  const item = contentItems.find((c) => c.id === "cnt-weekend-line");
  const stock = getProduct("prd-chicken-breast");
  return {
    tool: "draftMessage",
    title: "Draft LINE message (not sent)",
    blocks: [
      { label: "FACT", text: `A draft already exists: "${item?.title ?? DATA_NOT_AVAILABLE}".` },
      { label: "DATA GAP", text: `Offer details and price: ${DATA_NOT_AVAILABLE} The promotion has not been decided.` },
      { label: "FACT", text: `Chicken breast stock is "${stock?.stockStatus.toLowerCase()}", so the brand rule says it should not be promoted as freely available.` },
      { label: "RECOMMENDATION", text: "Review the draft below, fill in offer details after the promotion decision, then submit for approval." },
    ],
    sources: [
      { kind: "Content", id: "cnt-weekend-line", label: item?.title ?? "LINE OA weekend broadcast", href: "/content" },
      src.product("prd-chicken-breast"),
    ],
    actionPreview: {
      title: "Send LINE OA weekend broadcast",
      description: "Draft only. It will not be sent. In Phase 1 this only creates an approval request.",
      actionType: "Send external message",
      needsApproval: requiresApproval("Send external message"),
      draftText: item?.draftText,
    },
  };
}

function approvalsAnswer(): SecretaryAnswer {
  const list = pendingApprovals();
  return {
    tool: "approvals",
    title: `${list.length} approvals waiting for you`,
    blocks: [
      ...list.map((a) => ({ label: "FACT" as const, text: `${a.actionType}: ${a.title} (requested ${formatDate(a.requestedAt)})` })),
      { label: "ANALYSIS", text: "Content and campaign approvals unblock the weekend promotion and the sausage launch timeline." },
      { label: "RECOMMENDATION", text: "Review the oldest requests first. Remember: in Phase 1 an approval only changes a status." },
    ],
    sources: list.map((a) => ({ kind: "Approval" as const, id: a.id, label: a.title, href: a.relatedHref })),
  };
}

function productAttention(): SecretaryAnswer {
  const list = products.filter((p) => p.attentionReason);
  return {
    tool: "productAttention",
    title: `${list.length} products need marketing attention`,
    blocks: [
      ...list.map((p) => ({ label: "FACT" as const, text: `${p.name}: ${p.attentionReason}` })),
      { label: "ANALYSIS", text: "Stock-limited products should not be pushed with promotions until supply is confirmed." },
      { label: "RECOMMENDATION", text: "Hold promotions on low-stock items and focus campaign effort on the sausage launch content." },
    ],
    sources: list.map((p) => src.product(p.id)),
  };
}

// ---------- monthly reports ----------
// Answers repeat only what the report says. Nothing is calculated or invented.

const GAP_PATTERN = /not (yet )?(set up|available|included|reported|tracked)|was not|no data/i;

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
    if (block.type === "table") return block.rows.slice(0, maxRows).map((row) => `${row[0]}: ${row.slice(1).filter(Boolean).join(" / ")}`);
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
  const mock = report.isMock ? " (MOCK sample, invented numbers)" : "";
  const topic = sectionTopics.find((t) => t.pattern.test(question));
  const topicSection = topic ? report.sections.find((s) => topic.section.test(s.title)) : undefined;
  const blocks: AnswerBlock[] = [{ label: "FACT", text: `Source: ${report.title}${mock}.` }];

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
