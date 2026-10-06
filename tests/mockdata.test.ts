import { describe, expect, it } from "vitest";
import {
  approvals,
  brandRules,
  campaigns,
  contentItems,
  customers,
  documents,
  issues,
  meetings,
  products,
  salesRows,
  tasks,
} from "@/data/mock";
import { DATA_NOT_AVAILABLE } from "@/lib/constants";
import { addDays, daysBetween, startOfWeek, weekDays } from "@/lib/dates";

const ids = (list: { id: string }[]) => new Set(list.map((x) => x.id));

describe("mock data integrity", () => {
  it("has unique ids in every collection", () => {
    for (const list of [products, customers, tasks, meetings, campaigns, contentItems, approvals, issues, documents]) {
      expect(ids(list).size).toBe(list.length);
    }
  });

  it("only references records that exist", () => {
    const p = ids(products), c = ids(customers), g = ids(campaigns);
    for (const t of tasks) {
      if (t.productId) expect(p.has(t.productId)).toBe(true);
      if (t.customerId) expect(c.has(t.customerId)).toBe(true);
      if (t.campaignId) expect(g.has(t.campaignId)).toBe(true);
    }
    for (const x of contentItems) {
      if (x.productId) expect(p.has(x.productId)).toBe(true);
      if (x.campaignId) expect(g.has(x.campaignId)).toBe(true);
    }
    for (const x of campaigns) for (const id of x.productIds) expect(p.has(id)).toBe(true);
    for (const x of salesRows) expect(p.has(x.productId)).toBe(true);
    for (const x of issues) {
      if (x.customerId) expect(c.has(x.customerId)).toBe(true);
      if (x.productId) expect(p.has(x.productId)).toBe(true);
    }
    for (const x of documents) {
      if (x.productId) expect(p.has(x.productId)).toBe(true);
      if (x.customerId) expect(c.has(x.customerId)).toBe(true);
      if (x.campaignId) expect(g.has(x.campaignId)).toBe(true);
    }
  });

  it("contains no real-looking personal information", () => {
    for (const c of customers) {
      expect(c.email === DATA_NOT_AVAILABLE || c.email.endsWith("@example.com")).toBe(true);
      expect(c.phone === DATA_NOT_AVAILABLE || /^000-000-\d{4}$/.test(c.phone)).toBe(true);
    }
  });

  it("marks every named customer organization as mock", () => {
    for (const c of customers.filter((x) => x.type !== "Chef" && x.type !== "B2C Segment")) expect(c.name).toMatch(/\(Mock\)/);
  });

  it("campaigns without results use null, not made-up numbers", () => {
    for (const c of campaigns.filter((x) => x.status === "Planned" || x.status === "Draft")) expect(c.performance).toBeNull();
  });

  it("is deterministic: 27 plans x 6 months of sales rows", () => {
    expect(salesRows).toHaveLength(27 * 6);
    expect(salesRows.every((r) => r.revenueThb > 0)).toBe(true);
  });

  it("includes brand rules about claims and approvals", () => {
    const text = brandRules.map((r) => r.rule).join(" ");
    expect(text).toMatch(/claims/i);
    expect(text).toMatch(/approval/i);
  });

  it("does not record certifications or awards", () => {
    const all = JSON.stringify([products, campaigns, contentItems]);
    expect(all).not.toMatch(/certified|award|organic/i);
  });
});

describe("date helpers", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-10-06", -6)).toBe("2026-09-30");
  });
  it("counts days between dates", () => {
    expect(daysBetween("2026-10-06", "2026-10-20")).toBe(14);
    expect(daysBetween("2026-10-20", "2026-10-06")).toBe(-14);
  });
  it("finds Monday for any weekday and Sunday", () => {
    expect(startOfWeek("2026-10-06")).toBe("2026-10-05");
    expect(startOfWeek("2026-10-11")).toBe("2026-10-05");
    expect(weekDays("2026-10-06")).toHaveLength(7);
  });
});

import { formatDate, formatLongDate, formatMonth, formatThb, formatWeekday, formatCompactThb } from "@/lib/dates";

describe("date and money formatting (same text on server and browser)", () => {
  it("formats dates by hand", () => {
    expect(formatDate("2026-10-06")).toBe("6 Oct");
    expect(formatLongDate("2026-10-06")).toBe("Tuesday 6 October 2026");
    expect(formatWeekday("2026-10-11")).toBe("Sun");
    expect(formatMonth("2026-09")).toBe("Sep");
  });
  it("formats Thai baht", () => {
    expect(formatThb(1234567)).toBe("฿1,234,567");
    expect(formatCompactThb(3110000)).toBe("฿3.11M");
    expect(formatCompactThb(447000)).toBe("฿447K");
    expect(formatCompactThb(950)).toBe("฿950");
  });
});
