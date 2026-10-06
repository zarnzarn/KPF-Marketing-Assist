import type {
  BusinessAlert,
  CustomerIssue,
  DocumentRecord,
  InboxMessage,
  Meeting,
  Task,
} from "@/lib/types";

// MOCK tasks, meetings, issues, alerts, messages and documents.

export const tasks: Task[] = [
  { id: "tsk-promo-decision", title: "Decide weekend promotion for chicken breast (check stock first)", priority: "High", status: "To do", dueDate: "2026-10-06", owner: "Marketing Director", campaignId: "cmp-weekend-fresh", productId: "prd-chicken-breast" },
  { id: "tsk-lotus-reply", title: "Approve reply to Lotus Terrace about cracked eggs", priority: "High", status: "To do", dueDate: "2026-10-05", owner: "Marketing Director", customerId: "cus-lotus-restaurant" },
  { id: "tsk-riverside-quote", title: "Send duck banquet quote to Riverside Grand Hotel", priority: "High", status: "In progress", dueDate: "2026-10-06", owner: "B2B sales lead", customerId: "cus-riverside-hotel", productId: "prd-whole-duck" },
  { id: "tsk-gourmet-duck", title: "Explain duck breast shipment change to Gourmet Corner", priority: "High", status: "To do", dueDate: "2026-10-04", owner: "B2B sales lead", customerId: "cus-gourmet-corner", productId: "prd-duck-breast" },
  { id: "tsk-promo-calendar", title: "Prepare November promotion calendar for CityFresh", priority: "Medium", status: "In progress", dueDate: "2026-10-12", owner: "Retail manager", customerId: "cus-cityfresh" },
  { id: "tsk-sausage-content", title: "Review sausage launch content set", priority: "High", status: "In progress", dueDate: "2026-10-08", owner: "Content lead", campaignId: "cmp-sausage-launch", productId: "prd-chef-sausage" },
  { id: "tsk-tasting-run", title: "Confirm chef tasting event guest list", priority: "Medium", status: "To do", dueDate: "2026-10-07", owner: "Events team", campaignId: "cmp-duck-chef" },
  { id: "tsk-harbor-call", title: "Call Harbor Wholesale about reduced orders", priority: "Medium", status: "To do", dueDate: "2026-10-03", owner: "B2B sales lead", customerId: "cus-harbor-wholesale" },
  { id: "tsk-brochure", title: "Finish corporate gifting brochure draft", priority: "Medium", status: "To do", dueDate: "2026-10-15", owner: "Content lead", campaignId: "cmp-yearend-gifting", customerId: "cus-orchid-corporate" },
  { id: "tsk-weekly-report", title: "Prepare weekly marketing report", priority: "Low", status: "To do", dueDate: "2026-10-09", owner: "Marketing analyst" },
  { id: "tsk-photo", title: "Book product photo session for new sausage", priority: "Low", status: "Done", dueDate: "2026-10-02", owner: "Content lead", productId: "prd-chef-sausage" },
];

export const meetings: Meeting[] = [
  {
    id: "mtg-weekly-marketing",
    title: "Weekly marketing stand-up",
    date: "2026-10-06",
    start: "09:30",
    end: "10:00",
    location: "Meeting room A (Mock)",
    participants: ["Marketing Director", "Content lead", "Social media lead", "Marketing analyst"],
    agenda: ["Weekend Fresh Table performance", "Sausage launch content status", "Pending approvals"],
    notes: "Bring the Weekend Fresh Table numbers and the list of pending approvals.",
    previousDiscussion: "Last week: agreed to focus launch content on chefs and premium grocery. Promotion offer was left undecided.",
    actionItems: [
      { text: "Share launch content draft for review", owner: "Content lead", due: "2026-10-08", done: false },
      { text: "Send weekly report", owner: "Marketing analyst", due: "2026-10-02", done: true },
    ],
    followUps: ["Confirm promotion decision after stock check"],
  },
  {
    id: "mtg-riverside",
    title: "Call with Riverside Grand Hotel – year-end banquet",
    date: "2026-10-06",
    start: "14:00",
    end: "14:45",
    location: "Phone / video (Mock)",
    participants: ["Marketing Director", "B2B sales lead", "Khun Ploy (Mock)"],
    agenda: ["Duck volumes for banquet", "Delivery schedule", "Pricing discussion (no commitment without approval)"],
    notes: "Duck stock is limited; do not confirm volumes before checking allocation.",
    previousDiscussion: "Hotel asked for a duck quote on 1 Oct. Quote is still being prepared.",
    actionItems: [
      { text: "Send duck quote", owner: "B2B sales lead", due: "2026-10-06", done: false },
    ],
    followUps: ["Share delivery schedule options", "Check duck allocation with operations"],
  },
  {
    id: "mtg-launch-review",
    title: "Sausage launch readiness review",
    date: "2026-10-08",
    start: "11:00",
    end: "12:00",
    location: "Meeting room B (Mock)",
    participants: ["Marketing Director", "Content lead", "PR lead", "Operations lead"],
    agenda: ["Launch content approvals", "Stock plan for launch", "PR timeline", "Go / no-go criteria"],
    notes: "Operations stock plan for the sausage is Data not available.",
    previousDiscussion: "Launch date set tentatively for 20 Oct pending stock confirmation.",
    actionItems: [
      { text: "Confirm first production batch size", owner: "Operations lead", due: "2026-10-07", done: false },
    ],
    followUps: ["Decide launch go / no-go by 16 Oct"],
  },
  {
    id: "mtg-cityfresh",
    title: "CityFresh Supermarket – November shelf plan",
    date: "2026-10-09",
    start: "10:00",
    end: "11:00",
    location: "CityFresh office (Mock)",
    participants: ["Marketing Director", "Retail manager", "Khun Mali (Mock)"],
    agenda: ["Promotion calendar", "New product listing", "Stock commitments"],
    notes: "Any commitments on volume or price need approval before confirming.",
    previousDiscussion: "CityFresh asked for the November promotion calendar by 15 Oct.",
    actionItems: [],
    followUps: ["Send promotion calendar after meeting"],
  },
];

export const issues: CustomerIssue[] = [
  { id: "iss-cracked-eggs", title: "Cracked eggs in two trays", severity: "High", customerId: "cus-lotus-restaurant", productId: "prd-eggs-tray", status: "Open", openedAt: "2026-09-29", summary: "Restaurant reported cracked eggs on delivery. No reply sent yet (reply drafted, pending approval)." },
  { id: "iss-duck-supply", title: "Smaller duck breast shipments", severity: "Medium", customerId: "cus-gourmet-corner", productId: "prd-duck-breast", status: "Open", openedAt: "2026-09-18", summary: "Premium grocery partner asked why shipments were smaller. Explanation not yet sent." },
  { id: "iss-late-delivery", title: "Delivery arrived 2 hours late", severity: "Low", customerId: "cus-riverside-hotel", status: "In progress", openedAt: "2026-09-26", summary: "Hotel mentioned a late delivery. Operations is reviewing the route." },
  { id: "iss-packaging", title: "Packaging label misprint on bone broth", severity: "Low", productId: "prd-bone-broth", status: "Resolved", openedAt: "2026-09-12", summary: "Label misprint corrected for new batches." },
];

export const businessAlerts: BusinessAlert[] = [
  { id: "bal-packaging", area: "Business", severity: "Medium", message: "Packaging supplier lead time reported as longer; launch stock plan may be affected (details: Data not available).", href: "/documents" },
  { id: "bal-b2b-orders", area: "Business", severity: "Medium", message: "Two B2B wholesale accounts have reduced order volume; reasons not recorded (data gap).", href: "/customers" },
  { id: "bal-launch-docs", area: "Campaign", severity: "Medium", message: "Sausage launch needs approvals and content review before the 16 Oct go / no-go.", href: "/campaigns" },
];

export const messages: InboxMessage[] = [
  { id: "msg-riverside", from: "Khun Ploy (Mock) – Riverside Grand Hotel", channel: "Email", subject: "Duck quote for banquet", receivedAt: "2026-10-05", preview: "Could you confirm duck quantities and delivery dates for the banquet menu?", href: "/customers" },
  { id: "msg-cityfresh", from: "Khun Mali (Mock) – CityFresh", channel: "Email", subject: "November promotion calendar", receivedAt: "2026-10-04", preview: "Please share your promotion plan for November so we can plan shelf space.", href: "/customers" },
  { id: "msg-line-feedback", from: "LINE OA customer (Mock)", channel: "LINE OA", subject: "Question about frozen breast availability", receivedAt: "2026-10-05", preview: "Is the frozen chicken breast available for the weekend?", href: "/products" },
  { id: "msg-chef-arun", from: "Chef Arun (Mock)", channel: "Phone note", subject: "Tasting event RSVP", receivedAt: "2026-10-03", preview: "Happy to attend the tasting and bring two colleagues.", href: "/calendar" },
];

export const documents: DocumentRecord[] = [
  { id: "doc-sept-sales", name: "September sales summary.xlsx", kind: "Spreadsheet", uploadedAt: "2026-10-02", sizeKb: 184, summary: "Mock summary: monthly revenue by channel, with duck breast showing a decline.", tags: ["sales", "monthly"], productId: "prd-duck-breast" },
  { id: "doc-sausage-brief", name: "Sausage launch brief.pdf", kind: "PDF", uploadedAt: "2026-09-24", sizeKb: 642, summary: "Mock summary: launch objectives, target audiences, tentative date 20 Oct. Product claims list: Data not available.", tags: ["launch", "brief"], campaignId: "cmp-sausage-launch", productId: "prd-chef-sausage" },
  { id: "doc-gifting-draft", name: "Corporate gifting brochure draft.pptx", kind: "Slides", uploadedAt: "2026-10-01", sizeKb: 2310, summary: "Mock summary: draft brochure outline for gift sets. Pricing pages not filled in.", tags: ["B2B", "brochure"], campaignId: "cmp-yearend-gifting", customerId: "cus-orchid-corporate" },
  { id: "doc-lotus-complaint", name: "Lotus Terrace complaint note.docx", kind: "Word", uploadedAt: "2026-09-29", sizeKb: 38, summary: "Mock summary: restaurant reported cracked eggs in two trays; photos attached.", tags: ["complaint", "quality"], customerId: "cus-lotus-restaurant", productId: "prd-eggs-tray" },
  { id: "doc-brand-guide", name: "Brand tone and marketing rules.pdf", kind: "PDF", uploadedAt: "2026-08-15", sizeKb: 1210, summary: "Mock summary: warm and premium tone, no invented claims, approvals for external actions.", tags: ["brand", "rules"] },
];
