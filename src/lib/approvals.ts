// Approval rules. Phase 1: approving only changes a status. Nothing is ever
// sent, published, repriced or launched from this app.

import type { ApprovalActionType, ApprovalRequest, ApprovalState } from "./types";

const EXTERNAL_OR_HIGH_RISK: ApprovalActionType[] = [
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

export function requiresApproval(action: ApprovalActionType): boolean {
  return EXTERNAL_OR_HIGH_RISK.includes(action);
}

export class ApprovalError extends Error {}

/** Returns a new request with the new state. Only pending requests can change. */
export function decide(request: ApprovalRequest, decision: Exclude<ApprovalState, "Pending">): ApprovalRequest {
  if (request.state !== "Pending") {
    throw new ApprovalError(`Request ${request.id} is already ${request.state.toLowerCase()}.`);
  }
  return { ...request, state: decision };
}

export const PHASE1_NOTICE =
  "Approving only records your decision. Nothing is sent, published, repriced or launched from this app.";
