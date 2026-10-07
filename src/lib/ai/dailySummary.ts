// "AI daily summary" for the Today page. Counts only what is recorded; never guesses.
import { DATA_NOT_AVAILABLE } from "../constants";
import {
  campaignAlerts,
  followUpsDue,
  isEmpty,
  meetingsOn,
  openIssues,
  overdueTasks,
  pendingApprovals,
  productAlerts,
  recommendedPriorities,
  shopGap,
  stockScope,
} from "../queries";
import type { AppData } from "../types";
import type { AnswerBlock } from "./secretary";

export function dailySummary(d: AppData): AnswerBlock[] {
  if (isEmpty(d) && d.products.length === 0) {
    return [
      { label: "DATA GAP", text: DATA_NOT_AVAILABLE },
      { label: "RECOMMENDATION", text: "Add your tasks, meetings and customers, and connect your channels. The summary is built only from what you record." },
    ];
  }

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const blocks: AnswerBlock[] = [
    {
      label: "FACT",
      text: `Today: ${plural(meetingsOn(d, d.today).length, "meeting")}, ${plural(overdueTasks(d).length, "overdue task")}, ${plural(followUpsDue(d).length, "follow-up")} due, ${plural(openIssues(d.issues).length, "open customer issue")} and ${plural(pendingApprovals(d).length, "approval")} waiting.`,
    },
  ];

  const campaigns = campaignAlerts(d).length;
  if (campaigns) blocks.push({ label: "FACT", text: `${plural(campaigns, "campaign alert")} open.` });
  // Stock counts are facts only when the shop is connected; otherwise the number is unknown, not zero.
  if (d.products.length > 0) blocks.push({ label: "FACT", text: `${plural(productAlerts(d).length, "product")} low or out of stock${stockScope(d)}.` });
  else blocks.push({ label: "DATA GAP", text: `Products and stock: ${DATA_NOT_AVAILABLE} (${shopGap(d)}).` });

  const top = recommendedPriorities(d)[0];
  blocks.push(top ? { label: "RECOMMENDATION", text: `Start with "${top.title}".` } : { label: "FACT", text: "Nothing urgent is recorded." });
  return blocks;
}
