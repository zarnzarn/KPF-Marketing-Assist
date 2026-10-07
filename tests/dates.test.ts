import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatCompactThb, formatDate, formatDateRange, formatLongDate, formatMonth, formatThb, formatWeekday, isIsoDate, startOfWeek, weekDays } from "@/lib/dates";
import { todayInThailand } from "@/lib/today";

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

describe("todayInThailand", () => {
  it("uses Thailand time (UTC+7), so late evening UTC is already tomorrow", () => {
    expect(todayInThailand(new Date("2026-10-06T16:59:00Z"))).toBe("2026-10-06");
    expect(todayInThailand(new Date("2026-10-06T17:00:00Z"))).toBe("2026-10-07");
  });
});

describe("isIsoDate (real calendar dates only)", () => {
  it.each(["2026-02-28", "2028-02-29", "2026-12-31", "2026-01-01"])("accepts %s", (d) => expect(isIsoDate(d)).toBe(true));
  it.each(["2026-02-29", "2026-02-30", "2026-02-31", "2026-04-31", "2026-13-01", "2026-00-10", "2026-1-5", "06/10/2026", "", "2026-10-06T00:00"])("refuses %j", (d) => expect(isIsoDate(d)).toBe(false));
});

describe("formatDateRange", () => {
  it("always shows the year, once when both dates share it", () => {
    expect(formatDateRange("2026-10-01", "2026-10-31")).toBe("1 Oct - 31 Oct 2026");
  });
  it("shows both years when a range crosses into the next year", () => {
    expect(formatDateRange("2026-12-15", "2027-01-10")).toBe("15 Dec 2026 - 10 Jan 2027");
  });
});
