import type { Channel, SalesRow, Segment } from "@/lib/types";

// MOCK sales data. Generated deterministically from the table below so the
// numbers are stable between runs. These are invented, not real results.

export const SALES_MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];

export const channelSegment: Record<Channel, Segment> = {
  Website: "B2C",
  "LINE OA": "B2C",
  "Online Channels": "B2C",
  Supermarket: "Retail",
  "Gourmet Grocery": "Retail",
  Hotel: "B2B",
  Restaurant: "B2B",
  Wholesale: "B2B",
  Corporate: "B2B",
};

// base = revenue in the first month (THB); trend = change per month.
const salesPlan: { productId: string; channel: Channel; base: number; trend: number }[] = [
  { productId: "prd-whole-chicken", channel: "Website", base: 142000, trend: 0.04 },
  { productId: "prd-whole-chicken", channel: "LINE OA", base: 118000, trend: 0.03 },
  { productId: "prd-whole-chicken", channel: "Supermarket", base: 205000, trend: 0.02 },
  { productId: "prd-whole-chicken", channel: "Restaurant", base: 98000, trend: 0.05 },
  { productId: "prd-chicken-breast", channel: "Website", base: 96000, trend: 0.06 },
  { productId: "prd-chicken-breast", channel: "Online Channels", base: 64000, trend: 0.07 },
  { productId: "prd-chicken-breast", channel: "Supermarket", base: 132000, trend: 0.03 },
  { productId: "prd-chicken-thigh", channel: "Supermarket", base: 88000, trend: 0.01 },
  { productId: "prd-chicken-thigh", channel: "LINE OA", base: 52000, trend: 0.02 },
  { productId: "prd-eggs-10", channel: "Website", base: 74000, trend: 0.03 },
  { productId: "prd-eggs-10", channel: "LINE OA", base: 83000, trend: 0.04 },
  { productId: "prd-eggs-10", channel: "Supermarket", base: 176000, trend: 0.015 },
  { productId: "prd-eggs-10", channel: "Gourmet Grocery", base: 69000, trend: 0.02 },
  { productId: "prd-eggs-tray", channel: "Hotel", base: 154000, trend: 0.035 },
  { productId: "prd-eggs-tray", channel: "Restaurant", base: 121000, trend: 0.04 },
  { productId: "prd-eggs-tray", channel: "Wholesale", base: 97000, trend: 0.01 },
  { productId: "prd-whole-duck", channel: "Restaurant", base: 112000, trend: 0.06 },
  { productId: "prd-whole-duck", channel: "Hotel", base: 86000, trend: 0.05 },
  { productId: "prd-whole-duck", channel: "Gourmet Grocery", base: 48000, trend: 0.02 },
  { productId: "prd-duck-breast", channel: "Gourmet Grocery", base: 72000, trend: -0.09 },
  { productId: "prd-duck-breast", channel: "Restaurant", base: 66000, trend: -0.1 },
  { productId: "prd-duck-breast", channel: "Hotel", base: 54000, trend: -0.08 },
  { productId: "prd-bone-broth", channel: "Website", base: 41000, trend: 0.08 },
  { productId: "prd-bone-broth", channel: "Gourmet Grocery", base: 36000, trend: 0.05 },
  { productId: "prd-foodservice-pack", channel: "Hotel", base: 188000, trend: 0.03 },
  { productId: "prd-foodservice-pack", channel: "Corporate", base: 124000, trend: 0.045 },
  { productId: "prd-foodservice-pack", channel: "Wholesale", base: 142000, trend: -0.02 },
];

export const salesRows: SalesRow[] = salesPlan.flatMap((plan) =>
  SALES_MONTHS.map((month, i) => ({
    month,
    productId: plan.productId,
    channel: plan.channel,
    revenueThb: Math.round(plan.base * Math.pow(1 + plan.trend, i)),
  })),
);
