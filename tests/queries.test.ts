import { describe, expect, it } from "vitest";
import { MOCK_TODAY, tasks } from "@/data/mock";
import {
  calendarItems,
  campaignAlerts,
  decliningProducts,
  followUpsDue,
  getCustomer,
  getProduct,
  openTasks,
  overdueTasks,
  percentChange,
  priorityTasksToday,
  productAlerts,
  recommendedPriorities,
  revenue,
  revenueBySegment,
  salesSummary,
  upcomingMeetings,
} from "@/lib/queries";

describe("tasks", () => {
  it("finds overdue tasks and never includes done or future tasks", () => {
    const overdue = overdueTasks();
    expect(overdue.length).toBeGreaterThan(0);
    for (const t of overdue) {
      expect(t.status).not.toBe("Done");
      expect(t.dueDate < MOCK_TODAY).toBe(true);
    }
  });

  it("returns no overdue tasks for an empty list", () => {
    expect(overdueTasks(MOCK_TODAY, [])).toEqual([]);
  });

  it("orders priority tasks High first", () => {
    const list = priorityTasksToday();
    expect(list[0].priority).toBe("High");
    expect(list.every((t) => t.dueDate >= MOCK_TODAY)).toBe(true);
  });

  it("openTasks excludes Done", () => {
    expect(openTasks().length).toBe(tasks.filter((t) => t.status !== "Done").length);
  });
});

describe("follow-ups, meetings and calendar", () => {
  it("lists follow-ups due today or earlier, oldest first", () => {
    const list = followUpsDue();
    expect(list.length).toBeGreaterThan(0);
    const dates = list.map((c) => c.followUpDate as string);
    expect([...dates].sort()).toEqual(dates);
    expect(dates.every((d) => d <= MOCK_TODAY)).toBe(true);
  });

  it("ignores customers with no follow-up date", () => {
    expect(followUpsDue(MOCK_TODAY).some((c) => c.followUpDate === null)).toBe(false);
  });

  it("only returns meetings from today onwards", () => {
    expect(upcomingMeetings().every((m) => m.date >= MOCK_TODAY)).toBe(true);
  });

  it("builds calendar items of all five types", () => {
    const types = new Set(calendarItems().map((i) => i.type));
    expect(types).toEqual(new Set(["Meeting", "Event", "Campaign milestone", "Content deadline", "Follow-up"]));
  });
});

describe("sales", () => {
  it("segments add up to total monthly revenue", () => {
    const total = revenue({ month: "2026-09" });
    const sum = revenueBySegment("2026-09").reduce((s, r) => s + r.current, 0);
    expect(sum).toBe(total);
  });

  it("summary compares September with August", () => {
    const s = salesSummary();
    expect(s.month).toBe("2026-09");
    expect(s.change).toBeCloseTo(((s.current - s.previous) / s.previous) * 100);
  });

  it("flags duck breast as declining and nothing growing", () => {
    const names = decliningProducts().map((d) => d.product.id);
    expect(names).toContain("prd-duck-breast");
    expect(names).not.toContain("prd-eggs-10");
  });

  it("returns null (data not available) when the previous value is zero", () => {
    expect(percentChange(100, 0)).toBeNull();
  });

  it("returns zero revenue for an unknown product", () => {
    expect(revenue({ productId: "does-not-exist" })).toBe(0);
  });
});

describe("alerts and priorities", () => {
  it("raises product alerts only for low or out of stock products", () => {
    const alerts = productAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    for (const a of alerts) {
      const id = a.id.replace("pal-", "");
      expect(["Low stock", "Out of stock"]).toContain(getProduct(id)?.stockStatus);
    }
  });

  it("raises a campaign alert for campaigns waiting for approval", () => {
    expect(campaignAlerts().some((a) => a.message.includes("waiting for approval"))).toBe(true);
  });

  it("returns at most five recommended priorities, highest score first", () => {
    const list = recommendedPriorities();
    expect(list.length).toBeLessThanOrEqual(5);
    expect(list.length).toBeGreaterThan(0);
    const scores = list.map((p) => p.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});

describe("lookups with missing data", () => {
  it("returns undefined for unknown ids", () => {
    expect(getCustomer("nope")).toBeUndefined();
    expect(getCustomer(undefined)).toBeUndefined();
    expect(getProduct(undefined)).toBeUndefined();
  });
});
