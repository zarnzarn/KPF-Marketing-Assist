"use client";

import { useAppData } from "@/components/AppDataProvider";
import { Badge, EmptyState, List } from "@/components/ui";
import { decide } from "@/lib/approvals";
import { formatDate } from "@/lib/dates";
import { pendingApprovals } from "@/lib/queries";
import { updateItem } from "@/lib/store/userData";

/** Pending approval requests with Approve / Reject. Approving only changes the status here. */
export function ApprovalList() {
  const { data, update } = useAppData();
  const list = pendingApprovals(data);
  if (list.length === 0) return <EmptyState>Nothing is waiting for approval.</EmptyState>;

  const set = (id: string, decision: "Approved" | "Rejected") =>
    update((u) => {
      const request = u.approvals.find((a) => a.id === id);
      return request ? updateItem(u, "approvals", id, decide(request, decision)) : u;
    });

  return (
    <List>
      {list.map((a) => (
        <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
          <span>
            <span className="block font-medium">{a.title}</span>
            <span className="text-sm text-muted">Requested {formatDate(a.requestedAt)}</span>
            <span className="mt-1 block">
              <Badge tone="gold">{a.actionType}</Badge>
            </span>
          </span>
          <span className="flex gap-2">
            <button type="button" onClick={() => set(a.id, "Approved")} className="rounded-lg bg-forest px-3 py-1.5 text-xs font-semibold text-white hover:bg-sage">
              Approve<span className="sr-only"> {a.title}</span>
            </button>
            <button type="button" onClick={() => set(a.id, "Rejected")} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:border-clay">
              Reject<span className="sr-only"> {a.title}</span>
            </button>
          </span>
        </li>
      ))}
    </List>
  );
}
