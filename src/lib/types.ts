// Shared types for the Phase 1 prototype. All data is MOCK data.

export type Segment = "B2C" | "Retail" | "B2B";

export type Channel =
  | "Website"
  | "LINE OA"
  | "Online Channels"
  | "Supermarket"
  | "Gourmet Grocery"
  | "Hotel"
  | "Restaurant"
  | "Wholesale"
  | "Corporate";

export type Priority = "High" | "Medium" | "Low";
export type Severity = "High" | "Medium" | "Low";

export type ProductStatus = "Active" | "Launching" | "Paused";
export type Availability = "Available" | "Limited" | "Unavailable" | "Coming soon";
export type StockStatus = "In stock" | "Low stock" | "Out of stock" | "Not stocked yet";

export interface Product {
  id: string;
  name: string;
  category: "Free-range chicken" | "Eggs" | "Duck" | "Specialty poultry" | "Premium frozen" | "B2B food-service";
  status: ProductStatus;
  priceThb: number;
  priceUnit: string;
  channels: Channel[];
  availability: Availability;
  stockStatus: StockStatus;
  stockUnits: number;
  reorderLevel: number;
  isNew: boolean;
  attentionReason?: string; // set only when marketing attention is needed
}

export interface SalesRow {
  month: string; // YYYY-MM
  productId: string;
  channel: Channel;
  revenueThb: number;
}

export type CustomerType =
  | "Hotel"
  | "Restaurant"
  | "Chef"
  | "Wholesale"
  | "Retail Partner"
  | "Corporate"
  | "B2C Segment";

export type OpportunityStatus =
  | "New lead"
  | "Qualified"
  | "Proposal sent"
  | "Negotiation"
  | "Active account"
  | "At risk"
  | "Dormant";

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  segment: Segment;
  contactName: string;
  phone: string;
  email: string;
  lastInteractionDate: string;
  lastInteractionNote: string;
  followUpDate: string | null;
  opportunity: OpportunityStatus;
  notes: string;
}

export type TaskStatus = "To do" | "In progress" | "Done";

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
  owner: string;
  campaignId?: string;
  customerId?: string;
  productId?: string;
}

export interface ActionItem {
  text: string;
  owner: string;
  due: string;
  done: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  start: string; // HH:MM
  end: string;
  location: string;
  participants: string[];
  agenda: string[];
  notes: string;
  previousDiscussion: string;
  actionItems: ActionItem[];
  followUps: string[];
}

export type CalendarItemType =
  | "Meeting"
  | "Event"
  | "Campaign milestone"
  | "Content deadline"
  | "Follow-up";

export interface CalendarItem {
  id: string;
  title: string;
  date: string;
  start?: string;
  end?: string;
  type: CalendarItemType;
  href: string;
}

export type CampaignStatus = "Draft" | "Planned" | "Active" | "Paused" | "Completed";
export type ApprovalStatus = "Not required" | "Pending approval" | "Approved" | "Rejected";
export type ContentProgress = "Not started" | "In progress" | "Ready" | "Published";

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  channels: string[];
  targetAudience: string;
  startDate: string;
  endDate: string;
  budgetThb: number;
  spentThb: number | null;
  status: CampaignStatus;
  contentStatus: ContentProgress;
  approvalStatus: ApprovalStatus;
  productIds: string[];
  milestones: { date: string; label: string }[];
  performance: null | {
    reach: number;
    clicks: number;
    orders: number;
    revenueThb: number;
  };
}

export type ContentType =
  | "Facebook"
  | "Instagram"
  | "Website"
  | "LINE OA"
  | "PR"
  | "Email"
  | "B2B materials";

export type ContentStatus = "Idea" | "Draft" | "In review" | "Scheduled" | "Published";

export interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  status: ContentStatus;
  campaignId?: string;
  productId?: string;
  approvalStatus: ApprovalStatus;
  dueDate: string;
  publishDate?: string;
  draftText?: string;
}

export type ApprovalActionType =
  | "Publish content"
  | "Send external message"
  | "Send customer email"
  | "Send supplier email"
  | "Change product price"
  | "Launch campaign"
  | "Change promotion"
  | "Confirm commercial commitment"
  | "Share sensitive business information"
  | "Create internal task"
  | "Update internal note";

export type ApprovalState = "Pending" | "Approved" | "Rejected";

export interface ApprovalRequest {
  id: string;
  actionType: ApprovalActionType;
  title: string;
  requestedAt: string;
  state: ApprovalState;
  relatedHref: string;
}

export interface CustomerIssue {
  id: string;
  title: string;
  severity: Severity;
  customerId?: string;
  productId?: string;
  status: "Open" | "In progress" | "Resolved";
  openedAt: string;
  summary: string;
}

export interface BusinessAlert {
  id: string;
  area: "Business" | "Campaign" | "Product" | "Sales";
  severity: Severity;
  message: string;
  href: string;
}

export interface InboxMessage {
  id: string;
  from: string;
  channel: "LINE OA" | "Email" | "Phone note" | "Internal";
  subject: string;
  receivedAt: string;
  preview: string;
  href: string;
}

export interface MarketingActivity {
  id: string;
  title: string;
  type: "PR" | "Event" | "Social" | "Partnership" | "Website";
  date: string;
  status: "Planned" | "In progress" | "Done";
  owner: string;
  location?: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  kind: "PDF" | "Spreadsheet" | "Slides" | "Word" | "Image";
  uploadedAt: string;
  sizeKb: number;
  summary: string;
  tags: string[];
  campaignId?: string;
  productId?: string;
  customerId?: string;
}

export interface BrandRule {
  id: string;
  rule: string;
}

export interface SourceRecord {
  kind: "Product" | "Customer" | "Task" | "Campaign" | "Meeting" | "Content" | "Issue" | "Approval" | "Sales" | "Document";
  id: string;
  label: string;
  href: string;
}
