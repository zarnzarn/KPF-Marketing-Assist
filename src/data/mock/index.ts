// Single entry point for all MOCK data. The app never reads data from anywhere
// else, so a real data source can later replace this module without touching pages.

/** The fixed "today" used by the whole prototype so every page agrees. */
export const MOCK_TODAY = "2026-10-06";

export { products } from "./products";
export { salesRows, SALES_MONTHS, channelSegment } from "./sales";
export { customers } from "./customers";
export {
  campaigns,
  contentItems,
  marketingActivities,
  approvals,
  brandRules,
} from "./marketing";
export { tasks, meetings, issues, businessAlerts, messages, documents } from "./operations";
