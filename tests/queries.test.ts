import { describe, expect, it } from "vitest";
import {
  calendarItems,
  campaignAlerts,
  followUpsDue,
  getCustomer,
  getProduct,
  isEmpty,
  openIssues,
  openTasks,
  overdueTasks,
  pendingApprovals,
  priorityTasksToday,
  productAlerts,
  recommendedPriorities,
  upcomingFollowUps,
  upcomingMeetings,
} from "@/lib/queries";
import { FIXTURE_TODAY, emptyData, fixtureData as d } from "./fixtures";

describe("tasks", () => {
  it("finds overdue tasks and never includes done or future tasks", () => {
    const overdue = overdueTasks(d);
    expect(overdue.length).toBeGreaterThan(0);
    for (const t of overdue) {
      expect(t.status).not.toBe("Done");
      expect(t.dueDate < FIXTURE_TODAY).toBe(true);
    }
  });

  it("orders priority tasks High first and only from today on", () => {
    const list = priorityTasksToday(d);
    expect(list[0].priority).toBe("High");
    expect(list.every((t) => t.dueDate >= FIXTURE_TODAY)).toBe(true);
  });

  it("openTasks excludes Done", () => {
    expect(openTasks(d.tasks).every((t) => t.status !== "Done")).toBe(true);
  });

  it("uses the given today, not a fixed date", () => {
    expect(overdueTasks({ ...d, today: "2000-01-01" })).toEqual([]);
  });
});

describe("follow-ups, meetings and calendar", () => {
  it("lists follow-ups due today or earlier, oldest first", () => {
    const dates = followUpsDue(d).map((c) => c.followUpDate as string);
    expect(dates.length).toBeGreaterThan(0);
    expect([...dates].sort()).toEqual(dates);
    expect(dates.every((x) => x <= FIXTURE_TODAY)).toBe(true);
  });

  it("lists upcoming follow-ups within 7 days only", () => {
    for (const c of upcomingFollowUps(d)) {
      expect(c.followUpDate! > FIXTURE_TODAY).toBe(true);
      expect(c.followUpDate! <= "2026-10-13").toBe(true);
    }
  });

  it("only returns meetings from today onwards", () => {
    expect(upcomingMeetings(d).every((m) => m.date >= FIXTURE_TODAY)).toBe(true);
  });

  it("builds calendar items from meetings, tasks, milestones, deadlines and follow-ups", () => {
    const types = new Set(calendarItems(d).map((i) => i.type));
    expect(types).toEqual(new Set(["Meeting", "Task", "Campaign milestone", "Content deadline", "Follow-up"]));
  });
});

describe("alerts and priorities", () => {
  it("raises product alerts only for low or out of stock products", () => {
    const alerts = productAlerts(d);
    expect(alerts.length).toBeGreaterThan(0);
    for (const a of alerts) expect(["Low stock", "Out of stock"]).toContain(getProduct(d, a.id.replace("pal-", ""))?.stockStatus);
  });

  it("raises a campaign alert for campaigns waiting for approval", () => {
    expect(campaignAlerts(d).some((a) => a.message.includes("waiting for approval"))).toBe(true);
  });

  it("returns at most five unique priorities, highest score first", () => {
    const list = recommendedPriorities(d);
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(5);
    const scores = list.map((p) => p.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(new Set(list.map((p) => `${p.kind}:${p.id}`)).size).toBe(list.length);
  });

  it("sorts open issues by severity and hides resolved ones", () => {
    const list = openIssues(d.issues);
    expect(list.every((i) => i.status !== "Resolved")).toBe(true);
    expect(list[0].severity).toBe("High");
  });

  it("counts pending approvals only", () => {
    expect(pendingApprovals(d).every((a) => a.state === "Pending")).toBe(true);
  });
});

describe("empty data (a new user)", () => {
  const e = emptyData();
  it.each([
    ["overdueTasks", () => overdueTasks(e)],
    ["priorityTasksToday", () => priorityTasksToday(e)],
    ["followUpsDue", () => followUpsDue(e)],
    ["upcomingMeetings", () => upcomingMeetings(e)],
    ["calendarItems", () => calendarItems(e)],
    ["productAlerts", () => productAlerts(e)],
    ["campaignAlerts", () => campaignAlerts(e)],
    ["recommendedPriorities", () => recommendedPriorities(e)],
    ["pendingApprovals", () => pendingApprovals(e)],
  ])("%s returns an empty list", (_name, fn) => {
    expect(fn()).toEqual([]);
  });

  it("isEmpty is true only when nothing is recorded", () => {
    expect(isEmpty(e)).toBe(true);
    expect(isEmpty(d)).toBe(false);
  });
});

describe("lookups with missing data", () => {
  it("returns undefined for unknown ids", () => {
    expect(getCustomer(d, "nope")).toBeUndefined();
    expect(getCustomer(d, undefined)).toBeUndefined();
    expect(getProduct(emptyData(), "anything")).toBeUndefined();
  });
});
