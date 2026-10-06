import { describe, expect, it } from "vitest";
import {
  campaignFields,
  contentFields,
  customerFields,
  initialValues,
  issueFields,
  meetingFields,
  parseMilestones,
  toCampaign,
  toContent,
  toCustomer,
  toIssue,
  toMeeting,
  validateFields,
  validateRange,
} from "@/lib/forms";

describe("validateFields", () => {
  it("requires required fields", () => {
    const errors = validateFields(meetingFields, initialValues(meetingFields));
    expect(Object.keys(errors).sort()).toEqual(["date", "end", "start", "title"]);
    expect(errors.title).toBe("Title is required.");
  });

  it("rejects bad dates, times, numbers and select values", () => {
    expect(validateFields(meetingFields, { title: "x", date: "6/10/2026", start: "9am", end: "25:00" })).toMatchObject({
      date: expect.stringContaining("valid date"),
      start: expect.stringContaining("09:30"),
      end: expect.stringContaining("09:30"),
    });
    const campaign = { ...initialValues(campaignFields), name: "n", objective: "o", startDate: "2026-10-01", endDate: "2026-10-31", budgetThb: "-5", status: "Launched!" };
    const errors = validateFields(campaignFields, campaign);
    expect(errors.budgetThb).toContain("0 or more");
    expect(errors.status).toContain("Choose");
  });

  it("rejects very long text", () => {
    expect(validateFields(issueFields, { title: "x".repeat(141), severity: "High", openedAt: "2026-10-06" }).title).toContain("140");
  });

  it("checks ranges across two fields", () => {
    expect(validateRange({ start: "10:00", end: "09:00" }, "start", "end", "bad")).toEqual({ end: "bad" });
    expect(validateRange({ start: "09:00", end: "10:00" }, "start", "end", "bad")).toEqual({});
    expect(validateRange({ start: "", end: "10:00" }, "start", "end", "bad")).toEqual({});
  });

  it("defaults required selects to their first option", () => {
    expect(initialValues(customerFields).type).toBe("Hotel");
  });
});

describe("builders", () => {
  it("turns multi-line text into lists and trims values", () => {
    const m = toMeeting("m1", { title: " Plan ", date: "2026-10-06", start: "09:00", end: "10:00", participants: "Marketing\n\n Sales ", agenda: "One\nTwo" });
    expect(m).toMatchObject({ id: "m1", title: "Plan", participants: ["Marketing", "Sales"], agenda: ["One", "Two"], actionItems: [] });
  });

  it("customers get a segment from their type and never store personal contact fields", () => {
    const c = toCustomer("c1", { name: "Hotel A", type: "Retail Partner", opportunity: "Qualified", followUpDate: "" }, "2026-10-06");
    expect(c.segment).toBe("Retail");
    expect(c.followUpDate).toBeNull();
    expect(c.lastInteractionDate).toBe("2026-10-06");
    expect(Object.keys(c)).not.toEqual(expect.arrayContaining(["phone"]));
    expect(Object.keys(c).some((k) => /phone|email|contact/i.test(k))).toBe(false);
  });

  it("campaigns never get typed-in results", () => {
    const c = toCampaign("x", { name: "N", objective: "O", channels: "LINE OA, Website ,", startDate: "2026-10-01", endDate: "2026-10-31", budgetThb: "1000", spentThb: "", status: "Planned", contentStatus: "Not started", approvalStatus: "Not required", milestones: "2026-10-10 Brief\nnot a milestone\n2026-13-40 Bad" });
    expect(c.channels).toEqual(["LINE OA", "Website"]);
    expect(c.spentThb).toBeNull();
    expect(c.performance).toBeNull();
    expect(c.milestones).toEqual([{ date: "2026-10-10", label: "Brief" }]);
  });

  it("parses milestones and ignores invalid lines", () => {
    expect(parseMilestones("")).toEqual([]);
  });

  it("content and issues map optional fields to undefined", () => {
    expect(toContent("c", { title: "T", type: "LINE OA", status: "Draft", approvalStatus: "Not required", dueDate: "2026-10-06", publishDate: "", draftText: "" })).toMatchObject({ publishDate: undefined, draftText: undefined });
    expect(toIssue("i", { title: "T", severity: "High", openedAt: "2026-10-06" }, "")).toMatchObject({ status: "Open", customerId: undefined });
  });

  it("every field set has unique field names", () => {
    for (const fields of [meetingFields, customerFields, campaignFields, contentFields, issueFields]) {
      expect(new Set(fields.map((f) => f.name)).size).toBe(fields.length);
    }
  });
});
