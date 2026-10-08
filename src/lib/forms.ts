// Field definitions, validation and entity builders for the "add your own" forms.
// Pure functions (no UI), so they are easy to test.

import { isIsoDate } from "./dates";
import type {
  ApprovalStatus,
  Campaign,
  CampaignStatus,
  ContentItem,
  ContentProgress,
  ContentStatus,
  ContentType,
  Customer,
  CustomerIssue,
  CustomerType,
  Meeting,
  OpportunityStatus,
  Segment,
  Severity,
} from "./types";

export interface FieldConfig {
  name: string;
  label: string;
  type: "text" | "textarea" | "date" | "time" | "select" | "number";
  required?: boolean;
  options?: readonly string[];
  hint?: string;
  maxLength?: number;
  /** Extra check for one field; returns an error message, or nothing when the value is fine. */
  validate?: (value: string) => string | undefined;
}

export type FormValues = Record<string, string>;
export type FormErrors = Record<string, string>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function initialValues(fields: FieldConfig[], defaults: FormValues = {}): FormValues {
  return Object.fromEntries(fields.map((f) => [f.name, defaults[f.name] ?? (f.type === "select" && f.required ? (f.options?.[0] ?? "") : "")]));
}

export function validateFields(fields: FieldConfig[], values: FormValues): FormErrors {
  const errors: FormErrors = {};
  for (const f of fields) {
    const value = (values[f.name] ?? "").trim();
    if (!value) {
      if (f.required) errors[f.name] = `${f.label} is required.`;
      continue;
    }
    const max = f.maxLength ?? (f.type === "textarea" ? 2000 : 140);
    if (value.length > max) errors[f.name] = `${f.label} must be ${max} characters or fewer.`;
    else if (f.type === "date" && !isIsoDate(value)) errors[f.name] = `Enter a valid date for ${f.label.toLowerCase()}.`;
    else if (f.type === "time" && !TIME.test(value)) errors[f.name] = `Enter a time like 09:30 for ${f.label.toLowerCase()}.`;
    else if (f.type === "number" && !(Number.isFinite(Number(value)) && Number(value) >= 0)) errors[f.name] = `${f.label} must be a number of 0 or more.`;
    else if (f.type === "select" && f.options && !f.options.includes(value)) errors[f.name] = `Choose a value for ${f.label.toLowerCase()}.`;
    else {
      const custom = f.validate?.(value);
      if (custom) errors[f.name] = custom;
    }
  }
  return errors;
}

/** Cross-field checks that a single field cannot express. `strict` means the end must be after the start, not equal to it. */
export function validateRange(values: FormValues, start: string, end: string, message: string, strict = false): FormErrors {
  const a = (values[start] ?? "").trim();
  const b = (values[end] ?? "").trim();
  return a && b && (strict ? b <= a : b < a) ? { [end]: message } : {};
}

const lines = (text: string) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const t = (v: string | undefined) => (v ?? "").trim();

// ---------- field sets ----------

export const meetingFields: FieldConfig[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "date", label: "Date", type: "date", required: true },
  { name: "start", label: "Start time", type: "time", required: true },
  { name: "end", label: "End time", type: "time", required: true },
  { name: "location", label: "Location", type: "text" },
  { name: "participants", label: "Participants (one per line)", type: "textarea", hint: "Use roles or company names. Do not store personal phone numbers or emails." },
  { name: "agenda", label: "Agenda (one item per line)", type: "textarea" },
  { name: "notes", label: "Notes", type: "textarea" },
  { name: "previousDiscussion", label: "Previous discussion", type: "textarea" },
];

const customerTypes: readonly CustomerType[] = ["Hotel", "Restaurant", "Chef", "Wholesale", "Retail Partner", "Corporate", "B2C Segment"];
const opportunities: readonly OpportunityStatus[] = ["New lead", "Qualified", "Proposal sent", "Negotiation", "Active account", "At risk", "Dormant"];

export const customerFields: FieldConfig[] = [
  { name: "name", label: "Business or segment name", type: "text", required: true, hint: "A business (hotel, restaurant, shop) or a customer segment. No private individuals." },
  { name: "type", label: "Type", type: "select", required: true, options: customerTypes },
  { name: "opportunity", label: "Opportunity status", type: "select", required: true, options: opportunities },
  { name: "lastInteractionDate", label: "Last interaction date", type: "date" },
  { name: "lastInteractionNote", label: "Last interaction", type: "text" },
  { name: "followUpDate", label: "Follow-up date", type: "date" },
  { name: "notes", label: "Notes", type: "textarea", hint: "Do not type personal phone numbers or emails here." },
];

const campaignStatuses: readonly CampaignStatus[] = ["Draft", "Planned", "Active", "Paused", "Completed"];
const contentProgress: readonly ContentProgress[] = ["Not started", "In progress", "Ready", "Published"];
const approvalStatuses: readonly ApprovalStatus[] = ["Not required", "Pending approval", "Approved", "Rejected"];

export const campaignFields: FieldConfig[] = [
  { name: "name", label: "Campaign name", type: "text", required: true },
  { name: "objective", label: "Objective", type: "text", required: true },
  { name: "channels", label: "Channels (comma separated)", type: "text" },
  { name: "targetAudience", label: "Target audience", type: "text" },
  { name: "startDate", label: "Start date", type: "date", required: true },
  { name: "endDate", label: "End date", type: "date", required: true },
  { name: "budgetThb", label: "Budget (THB)", type: "number" },
  { name: "spentThb", label: "Spent so far (THB)", type: "number" },
  { name: "status", label: "Status", type: "select", required: true, options: campaignStatuses },
  { name: "contentStatus", label: "Content status", type: "select", required: true, options: contentProgress },
  { name: "approvalStatus", label: "Approval status", type: "select", required: true, options: approvalStatuses },
  { name: "milestones", label: "Milestones (one per line: YYYY-MM-DD label)", type: "textarea", validate: (text) => milestoneError(text) },
];

const contentTypes: readonly ContentType[] = ["Facebook", "Instagram", "Website", "LINE OA", "PR", "Email", "B2B materials"];
const contentStatuses: readonly ContentStatus[] = ["Idea", "Draft", "In review", "Scheduled", "Published"];

export const contentFields: FieldConfig[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "type", label: "Platform", type: "select", required: true, options: contentTypes },
  { name: "status", label: "Status", type: "select", required: true, options: contentStatuses },
  { name: "approvalStatus", label: "Approval status", type: "select", required: true, options: approvalStatuses },
  { name: "dueDate", label: "Due date", type: "date", required: true },
  { name: "publishDate", label: "Publish date", type: "date" },
  { name: "draftText", label: "Draft text", type: "textarea", hint: "Drafts are never published from this app." },
];

const severities: readonly Severity[] = ["High", "Medium", "Low"];

export const issueFields: FieldConfig[] = [
  { name: "title", label: "Issue", type: "text", required: true },
  { name: "severity", label: "Severity", type: "select", required: true, options: severities },
  { name: "openedAt", label: "Opened on", type: "date", required: true },
  { name: "summary", label: "Summary", type: "textarea" },
];

// ---------- builders (form values -> stored entity) ----------

const segmentOf: Record<CustomerType, Segment> = {
  Hotel: "B2B",
  Restaurant: "B2B",
  Chef: "B2B",
  Wholesale: "B2B",
  Corporate: "B2B",
  "Retail Partner": "Retail",
  "B2C Segment": "B2C",
};

export function toMeeting(id: string, v: FormValues): Meeting {
  return {
    id,
    title: t(v.title),
    date: t(v.date),
    start: t(v.start),
    end: t(v.end),
    location: t(v.location),
    participants: lines(v.participants ?? ""),
    agenda: lines(v.agenda ?? ""),
    notes: t(v.notes),
    previousDiscussion: t(v.previousDiscussion),
    actionItems: [],
    followUps: [],
  };
}

export function toCustomer(id: string, v: FormValues): Customer {
  const type = t(v.type) as CustomerType;
  return {
    id,
    name: t(v.name),
    type,
    segment: segmentOf[type] ?? "B2B",
    lastInteractionDate: t(v.lastInteractionDate) || null, // blank stays blank, never "today"
    lastInteractionNote: t(v.lastInteractionNote),
    followUpDate: t(v.followUpDate) || null,
    opportunity: t(v.opportunity) as OpportunityStatus,
    notes: t(v.notes),
  };
}

const MILESTONE = /^(\d{4}-\d{2}-\d{2})\s+(.+)$/;
const isMilestone = (line: string) => {
  const m = line.match(MILESTONE);
  return !!m && isIsoDate(m[1]);
};

/** "2026-10-12 Content ready" lines -> milestones. The form refuses unreadable lines first (see milestoneError). */
export function parseMilestones(text: string): { date: string; label: string }[] {
  return lines(text)
    .filter(isMilestone)
    .map((line) => line.match(MILESTONE) as RegExpMatchArray)
    .map((m) => ({ date: m[1], label: m[2].trim() }));
}

/** Names the milestone lines that cannot be read, so none disappear silently. */
export function milestoneError(text: string): string | undefined {
  const bad = lines(text).filter((line) => !isMilestone(line));
  if (bad.length === 0) return undefined;
  const shown = bad.slice(0, 3).map((l) => `"${l.slice(0, 40)}"`).join(", ");
  return `Write each milestone as a real date then a label, like 2026-10-12 Content ready. Not readable: ${shown}${bad.length > 3 ? ` and ${bad.length - 3} more` : ""}.`;
}

export function toCampaign(id: string, v: FormValues): Campaign {
  const budget = t(v.budgetThb);
  const spent = t(v.spentThb);
  return {
    id,
    name: t(v.name),
    objective: t(v.objective),
    channels: t(v.channels).split(",").map((c) => c.trim()).filter(Boolean),
    targetAudience: t(v.targetAudience),
    startDate: t(v.startDate),
    endDate: t(v.endDate),
    budgetThb: budget ? Number(budget) : null, // blank stays unknown, never ฿0
    spentThb: spent ? Number(spent) : null,
    status: t(v.status) as CampaignStatus,
    contentStatus: t(v.contentStatus) as ContentProgress,
    approvalStatus: t(v.approvalStatus) as ApprovalStatus,
    productIds: [],
    milestones: parseMilestones(v.milestones ?? ""),
    performance: null, // results are never typed in or guessed; they come from connected channels
  };
}

export function toContent(id: string, v: FormValues): ContentItem {
  return {
    id,
    title: t(v.title),
    type: t(v.type) as ContentType,
    status: t(v.status) as ContentStatus,
    approvalStatus: t(v.approvalStatus) as ApprovalStatus,
    dueDate: t(v.dueDate),
    publishDate: t(v.publishDate) || undefined,
    draftText: t(v.draftText) || undefined,
  };
}

export function toIssue(id: string, v: FormValues, customerId?: string): CustomerIssue {
  return {
    id,
    title: t(v.title),
    severity: t(v.severity) as Severity,
    customerId: customerId || undefined,
    status: "Open",
    openedAt: t(v.openedAt),
    summary: t(v.summary),
  };
}
