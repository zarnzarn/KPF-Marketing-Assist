import { describe, expect, it } from "vitest";
import { DATA_NOT_AVAILABLE, answerQuestion, quickActions, selectTool, suggestedQuestions } from "@/lib/ai/secretary";
import { dailySummary } from "@/lib/ai/dailySummary";

const labels = ["FACT", "ANALYSIS", "ESTIMATE", "RECOMMENDATION", "DATA GAP"];

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
  ])("%s -> %s", (question, tool) => {
    expect(selectTool(question)).toBe(tool);
  });

  it("every quick action and suggested question maps to a real tool", () => {
    for (const q of [...quickActions, ...suggestedQuestions]) expect(selectTool(q)).not.toBe("unknown");
  });

  it("is not case sensitive", () => {
    expect(selectTool("WHAT IS OVERDUE")).toBe("overdue");
  });

  it("returns unknown for empty or unrelated input", () => {
    expect(selectTool("")).toBe("unknown");
    expect(selectTool("   ")).toBe("unknown");
    expect(selectTool("Tell me a joke about llamas")).toBe("unknown");
  });
});

describe("answerQuestion", () => {
  it("says 'Data not available.' with a DATA GAP when it cannot answer", () => {
    const answer = answerQuestion("What will the weather be?");
    expect(answer.tool).toBe("unknown");
    expect(answer.blocks.find((b) => b.label === "DATA GAP")?.text).toBe(DATA_NOT_AVAILABLE);
    expect(answer.sources).toEqual([]);
  });

  it("handles empty input without throwing", () => {
    expect(() => answerQuestion("")).not.toThrow();
  });

  it("labels every block with a known label", () => {
    for (const q of quickActions) {
      const answer = answerQuestion(q);
      expect(answer.blocks.length).toBeGreaterThan(0);
      for (const b of answer.blocks) {
        expect(labels).toContain(b.label);
        expect(b.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("cites source records for data-based answers", () => {
    for (const q of quickActions) expect(answerQuestion(q).sources.length).toBeGreaterThan(0);
  });

  it("marks the overdue list as FACT and a recommendation separately", () => {
    const a = answerQuestion("What is overdue?");
    expect(a.blocks.some((b) => b.label === "FACT")).toBe(true);
    expect(a.blocks.some((b) => b.label === "RECOMMENDATION")).toBe(true);
  });

  it("draft requests only prepare an action that needs approval and never sends", () => {
    const a = answerQuestion("Draft a LINE message for the weekend promotion");
    expect(a.actionPreview?.needsApproval).toBe(true);
    expect(a.actionPreview?.actionType).toBe("Send external message");
    expect(a.actionPreview?.draftText).toMatch(/Draft only/);
    expect(a.blocks.some((b) => b.label === "DATA GAP" && b.text.includes(DATA_NOT_AVAILABLE))).toBe(true);
  });

  it("does not invent offer details or prices in the draft", () => {
    const text = answerQuestion("Draft a LINE message").actionPreview?.draftText ?? "";
    expect(text).not.toMatch(/฿|\d+\s?%|discount|free delivery/i);
  });
});

describe("dailySummary", () => {
  it("includes facts, analysis, a data gap and a recommendation", () => {
    const labelsUsed = new Set(dailySummary().map((b) => b.label));
    for (const l of ["FACT", "ANALYSIS", "DATA GAP", "RECOMMENDATION"]) expect(labelsUsed).toContain(l);
  });
});
