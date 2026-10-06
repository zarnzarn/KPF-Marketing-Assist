// Shared types. The app holds no mock data: data comes from the user's own
// entries (browser only), local monthly report files and read-only channel connections.

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
  category: string;
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
  /** No personal contact details (names, phones, emails) are stored, by design. */
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
  | "Task"
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
  kind: "Product" | "Customer" | "Task" | "Campaign" | "Meeting" | "Content" | "Issue" | "Approval" | "Sales" | "Document" | "Report" | "Channel";
  id: string;
  label: string;
  href: string;
}

/** Everything the user has entered. Lives only in this browser (localStorage). */
export interface UserData {
  tasks: Task[];
  meetings: Meeting[];
  customers: Customer[];
  campaigns: Campaign[];
  content: ContentItem[];
  issues: CustomerIssue[];
  approvals: ApprovalRequest[];
  documents: DocumentRecord[];
}

/** What pages and the AI secretary read: the user's entries plus real, read-only sources. */
export interface AppData extends UserData {
  /** Today's date (YYYY-MM-DD) in Thailand. */
  today: string;
  /** Products from the connected shop, if any. */
  products: Product[];
}

export const EMPTY_USER_DATA: UserData = {
  tasks: [],
  meetings: [],
  customers: [],
  campaigns: [],
  content: [],
  issues: [],
  approvals: [],
  documents: [],
};
