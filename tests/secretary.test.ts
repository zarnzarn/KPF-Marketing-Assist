import { describe, expect, it } from "vitest";
import { DATA_NOT_AVAILABLE, answerQuestion, quickActions, selectTool, suggestedQuestions } from "@/lib/ai/secretary";
import { dailySummary } from "@/lib/ai/dailySummary";
import type { ChannelSnapshot } from "@/lib/channels/types";
import { parseReport } from "@/lib/reports/parseReport";
import { emptyData, fixtureData } from "./fixtures";
import { makeDocx, sampleReportParts } from "./helpers/makeDocx";

const labels = ["FACT", "ANALYSIS", "ESTIMATE", "RECOMMENDATION", "DATA GAP"];
const ctx = { data: fixtureData };
const empty = { data: emptyData() };

describe("selectTool", () => {
  it.each([
    ["What should I do first today?", "firstToday"],
    ["What is overdue?", "overdue"],
    ["What needs follow-up?", "followUps"],
    ["What marketing issues should I know?", "marketingIssues"],
    ["What campaigns need attention?", "campaignAttention"],
    ["What should I prepare for today's meetings?", "meetingPrep"],
    ["What are the biggest business concerns?", "businessConcerns"],
    ["Draft a LINE message for the weekend promotion", "draftMessage"],
    ["What is waiting for my approval?", "approvals"],
    ["Which products need marketing attention?", "productAttention"],
    ["Summarize the latest monthly report", "monthlyReport"],
    ["How were supermarket sales in September?", "monthlyReport"],
    ["How are our channels doing?", "channels"],
    ["How many Instagram followers do we have?", "channels"],
  ])("%s -> %s", (question, tool) => {
    expect(selectTool(question)).toBe(tool);
  });

  it("every quick action and suggested question maps to a real tool", () => {
    for (const q of [...quickActions, ...suggestedQuestions]) expect(selectTool(q)).not.toBe("unknown");
  });

  it("returns unknown for empty or unrelated input", () => {
    expect(selectTool("")).toBe("unknown");
    expect(selectTool("   ")).toBe("unknown");
    expect(selectTool("Tell me a joke about llamas")).toBe("unknown");
  });
});

describe("answers from data", () => {
  it("labels every block and cites sources for data-based quick actions", () => {
    for (const q of quickActions) {
      const answer = answerQuestion(q, ctx);
      expect(answer.blocks.length).toBeGreaterThan(0);
      for (const b of answer.blocks) {
        expect(labels).toContain(b.label);
        expect(b.text.length).toBeGreaterThan(0);
      }
    }
    for (const q of ["What should I do first today?", "What is overdue?", "What needs follow-up?", "What should I prepare for today's meetings?"]) {
      expect(answerQuestion(q, ctx).sources.length).toBeGreaterThan(0);
    }
  });

  it("lists overdue tasks as FACT with a separate RECOMMENDATION", () => {
    const a = answerQuestion("What is overdue?", ctx);
    expect(a.blocks.filter((b) => b.label === "FACT").length).toBeGreaterThan(1);
    expect(a.blocks.some((b) => b.label === "RECOMMENDATION")).toBe(true);
  });

  it("draft requests only prepare an action that needs approval, without invented offers or prices", () => {
    const a = answerQuestion("Draft a LINE message for the weekend promotion", ctx);
    expect(a.actionPreview?.needsApproval).toBe(true);
    expect(a.actionPreview?.actionType).toBe("Send external message");
    expect(a.blocks.some((b) => b.label === "DATA GAP" && b.text.includes(DATA_NOT_AVAILABLE))).toBe(true);
    expect(answerQuestion("Draft a LINE message", empty).actionPreview?.draftText).not.toMatch(/฿|\d+\s?%|discount|free delivery/i);
  });

  it("says Data not available for unrelated questions", () => {
    const answer = answerQuestion("What will the weather be?", ctx);
    expect(answer.tool).toBe("unknown");
    expect(answer.blocks[0]).toEqual({ label: "DATA GAP", text: DATA_NOT_AVAILABLE });
  });
});

describe("a brand-new user with no data", () => {
  it.each([...quickActions, "What is waiting for my approval?", "Which products need marketing attention?", "Summarize the latest monthly report", "How are our channels doing?"])(
    "%s -> no invented facts",
    (q) => {
      const answer = answerQuestion(q, empty);
      expect(answer.blocks.some((b) => b.label === "ANALYSIS" || b.label === "ESTIMATE")).toBe(false);
      const facts = answer.blocks.filter((b) => b.label === "FACT");
      for (const f of facts) expect(f.text).toMatch(/^(No |Nothing )/);
      expect(answer.sources).toEqual([]);
    },
  );

  it("the daily summary admits there is no data", () => {
    expect(dailySummary(emptyData())[0]).toEqual({ label: "DATA GAP", text: DATA_NOT_AVAILABLE });
  });

  it("the daily summary counts real entries when there are some", () => {
    const blocks = dailySummary(fixtureData);
    expect(blocks[0].label).toBe("FACT");
    expect(blocks[0].text).toMatch(/^Today: \d+ meeting/);
    expect(blocks.some((b) => b.label === "FACT" && /low or out of stock/.test(b.text))).toBe(true);
  });

  it("never reports zero stock problems as a fact when the shop is not connected", () => {
    const blocks = dailySummary({ ...fixtureData, products: [] });
    expect(blocks.some((b) => b.label === "FACT" && /stock/.test(b.text))).toBe(false);
    expect(blocks).toContainEqual({ label: "DATA GAP", text: "Products and stock: Data not available. (shop not connected)." });
  });
});

describe("channels tool", () => {
  const channels: ChannelSnapshot[] = [
    { channel: "facebook", label: "Facebook", status: "connected", metrics: [{ label: "Followers", value: "1,234" }], items: [] },
    { channel: "line", label: "LINE OA", status: "not_configured", metrics: [], items: [] },
    { channel: "instagram", label: "Instagram", status: "error", metrics: [], items: [], message: "The access token has expired." },
  ];

  it("repeats connected numbers as FACT and marks the rest as DATA GAP", () => {
    const a = answerQuestion("How are our channels doing?", { data: emptyData(), channels });
    expect(a.blocks).toContainEqual({ label: "FACT", text: "Facebook: Followers 1,234" });
    expect(a.blocks.filter((b) => b.label === "DATA GAP").map((b) => b.text)).toEqual([
      `LINE OA (not connected): ${DATA_NOT_AVAILABLE}`,
      `Instagram (The access token has expired.): ${DATA_NOT_AVAILABLE}`,
    ]);
    expect(a.sources).toEqual([{ kind: "Channel", id: "facebook", label: "Facebook", href: "/channels" }]);
  });

  it("lists channel errors among business concerns", () => {
    const a = answerQuestion("What are the biggest business concerns?", { data: emptyData(), channels });
    expect(a.blocks.some((b) => b.text.includes("Instagram could not be read"))).toBe(true);
  });
});

describe("monthly report tool", () => {
  it("does not hijack the existing questions", () => {
    expect(selectTool("What is overdue?")).toBe("overdue");
    expect(selectTool("What campaigns need attention?")).toBe("campaignAttention");
  });

  it("answers from the report only, with the report as a source", async () => {
    const sep = await parseReport(await makeDocx(sampleReportParts("1-30 September 2026")), "sep.docx");
    const answer = answerQuestion("Summarize the latest monthly report", { ...empty, reports: [sep] });
    const text = answer.blocks.map((b) => b.text).join("\n");
    expect(answer.tool).toBe("monthlyReport");
    expect(text).toContain("TOTAL SALES: THB 111K (+1.0% vs last month)");
    expect(text).toContain("Invented observation A.");
    expect(text).toContain("Action plan in the report: Send invented broadcast: Marketing / Early Oct");
    expect(answer.sources).toEqual([{ kind: "Report", id: "2026-09", label: sep.title, href: "/reports?month=2026-09" }]);
  });

  it("repeats the report's own missing-data note as a DATA GAP, word for word", async () => {
    const sep = await parseReport(await makeDocx(sampleReportParts()), "sep.docx");
    const gap = answerQuestion("Summarize the monthly report", { ...empty, reports: [sep] }).blocks.find((b) => b.label === "DATA GAP");
    expect(gap?.text).toBe("Checkout tracking is not set up yet, so conversion rate is not reported this month.");
  });

  it("picks the month that was asked for", async () => {
    const aug = await parseReport(await makeDocx(sampleReportParts("1-31 August 2026")), "aug.docx");
    const sep = await parseReport(await makeDocx(sampleReportParts("1-30 September 2026")), "sep.docx");
    expect(answerQuestion("Show me the August report", { ...empty, reports: [sep, aug] }).sources[0].id).toBe("2026-08");
    expect(answerQuestion("Latest report please", { ...empty, reports: [sep, aug] }).sources[0].id).toBe("2026-09");
  });

  it("answers about one topic from the matching section only", async () => {
    const sep = await parseReport(await makeDocx(sampleReportParts()), "sep.docx");
    const text = answerQuestion("How are sales doing?", { ...empty, reports: [sep] }).blocks.map((b) => b.text).join("\n");
    expect(text).toContain("Website: 10,000 / 12,000 / +20.0%");
    expect(text).not.toContain("Action plan in the report");
  });

  it("never invents numbers: every figure in the answer appears in the report", async () => {
    const sep = await parseReport(await makeDocx(sampleReportParts()), "sep.docx");
    const answer = answerQuestion("Summarize the latest monthly report", { ...empty, reports: [sep] });
    const reportText = JSON.stringify(sep);
    const figures = answer.blocks.flatMap((b) => (b.text.match(/\d[\d,.]*/g) ?? []).map((f) => f.replace(/[.,]+$/, "")));
    for (const f of figures) expect(reportText).toContain(f);
  });
});
