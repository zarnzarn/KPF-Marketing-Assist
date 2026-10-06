import { describe, expect, it } from "vitest";
import { approvals } from "./fixtures";
import { ApprovalError, decide, requiresApproval } from "@/lib/approvals";
import type { ApprovalActionType } from "@/lib/types";

describe("requiresApproval", () => {
  const external: ApprovalActionType[] = [
    "Publish content",
    "Send external message",
    "Send customer email",
    "Send supplier email",
    "Change product price",
    "Launch campaign",
    "Change promotion",
    "Confirm commercial commitment",
    "Share sensitive business information",
  ];
  it.each(external)("%s requires approval", (action) => {
    expect(requiresApproval(action)).toBe(true);
  });

  it("internal actions do not require approval", () => {
    expect(requiresApproval("Create internal task")).toBe(false);
    expect(requiresApproval("Update internal note")).toBe(false);
  });
});

describe("decide", () => {
  const pending = approvals.find((a) => a.state === "Pending")!;

  it("approves a pending request without mutating the original", () => {
    const result = decide(pending, "Approved");
    expect(result.state).toBe("Approved");
    expect(pending.state).toBe("Pending");
  });

  it("rejects a pending request", () => {
    expect(decide(pending, "Rejected").state).toBe("Rejected");
  });

  it("cannot change a request that is already decided", () => {
    const done = decide(pending, "Approved");
    expect(() => decide(done, "Rejected")).toThrow(ApprovalError);
  });

  it("mock approvals only cover actions that need approval", () => {
    for (const a of approvals) expect(requiresApproval(a.actionType)).toBe(true);
  });
});
