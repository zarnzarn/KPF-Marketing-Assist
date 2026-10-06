// Mock "AI daily summary" for the Today page. Built only from mock data.
import { MOCK_TODAY } from "@/data/mock";
import { DATA_NOT_AVAILABLE } from "../constants";
import {
  campaignAlerts,
  decliningProducts,
  followUpsDue,
  meetingsOn,
  openIssues,
  overdueTasks,
  pendingApprovals,
  productAlerts,
  recommendedPriorities,
} from "../queries";
import type { AnswerBlock } from "./secretary";

export function dailySummary(): AnswerBlock[] {
  const overdue = overdueTasks();
  const meetings = meetingsOn(MOCK_TODAY);
  const issues = openIssues();
  const stock = productAlerts();
  const declining = decliningProducts();
  const top = recommendedPriorities()[0];

  return [
    {
      label: "FACT",
      text: `You have ${meetings.length} meetings today, ${overdue.length} overdue tasks, ${followUpsDue().length} follow-ups due, ${issues.length} open customer issues and ${pendingApprovals().length} approvals waiting.`,
    },
    {
      label: "FACT",
      text: `${stock.length} products have low stock and ${declining.length} product (${declining.map((d) => d.product.name).join(", ") || "none"}) has declining sales for 3 months. ${campaignAlerts().length} campaign alerts are open.`,
    },
    {
      label: "ANALYSIS",
      text: "Customer-facing replies and approvals are the bottleneck today. Several are waiting on you before marketing work can move forward.",
    },
    { label: "DATA GAP", text: `Why duck breast sales are falling and why wholesale orders dropped: ${DATA_NOT_AVAILABLE}` },
    { label: "RECOMMENDATION", text: top ? `Start with “${top.title}”. Then clear the oldest approvals before the 14:00 hotel call.` : "No urgent items are recorded." },
  ];
}
