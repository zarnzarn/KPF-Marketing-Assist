"use client";

import { useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { CampaignTimeline } from "@/components/CampaignTimeline";
import { AddButton, DeleteButton, EntityForm, StatusMessage } from "@/components/EntityForm";
import { Badge, Card, DataTable, EmptyState, ProgressBar } from "@/components/ui";
import { DATA_NOT_AVAILABLE } from "@/lib/constants";
import { formatCompactThb, formatDateRange } from "@/lib/dates";
import { campaignFields, toCampaign, validateRange } from "@/lib/forms";
import { addItem, newId, removeItem } from "@/lib/store/userData";
import type { Campaign } from "@/lib/types";

/** Budget and spend, showing "Data not available." for anything not entered. The bar appears only when both are known. */
function BudgetCell({ c }: { c: Campaign }) {
  const budget = c.budgetThb === null ? DATA_NOT_AVAILABLE : formatCompactThb(c.budgetThb);
  const spent = c.spentThb === null ? DATA_NOT_AVAILABLE : formatCompactThb(c.spentThb);
  if (c.spentThb === null || c.budgetThb === null || c.budgetThb <= 0) {
    return (
      <span className="block max-w-[11rem]">
        Budget: {budget}
        <span className="block text-xs text-muted">Spent: {spent}</span>
      </span>
    );
  }
  return (
    <div className="w-32">
      <p>
        {spent} / {budget}
      </p>
      <ProgressBar value={c.spentThb} max={c.budgetThb} label={`${c.name} budget used`} />
    </div>
  );
}

export function CampaignsView() {
  const { data, update } = useAppData();
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <AddButton label="Add campaign" onClick={() => setAdding(true)} />
        <StatusMessage text={message} />
      </div>

      {adding && (
        <EntityForm
          title="Add campaign"
          fields={campaignFields}
          defaults={{ startDate: data.today, endDate: data.today }}
          submitLabel="Save campaign"
          extraValidate={(v) => validateRange(v, "startDate", "endDate", "End date must be on or after the start date.")}
          onCancel={() => setAdding(false)}
          onSubmit={(v) => {
            update((u) => addItem(u, "campaigns", toCampaign(newId("cmp"), v)));
            setAdding(false);
            setMessage("Campaign added. Nothing is launched from this app.");
          }}
        />
      )}

      {data.campaigns.length === 0 ? (
        <EmptyState>No campaigns yet. Use &ldquo;Add campaign&rdquo; to plan one. Results are never typed in or guessed; they will come from connected channels.</EmptyState>
      ) : (
        <>
          <Card id="timeline" title="Campaign calendar">
            <CampaignTimeline campaigns={data.campaigns} today={data.today} />
          </Card>
          <Card id="table" title="All campaigns">
            <DataTable
              caption="Campaigns"
              rows={data.campaigns}
              rowKey={(c) => c.id}
              columns={[
                { header: "Campaign", cell: (c) => <div><p className="font-semibold">{c.name}</p><p className="mt-0.5 max-w-xs text-xs text-muted">{c.objective}</p></div> },
                { header: "Channel", cell: (c) => c.channels.join(", ") || "—" },
                { header: "Target audience", cell: (c) => <span className="block max-w-[11rem]">{c.targetAudience || "—"}</span> },
                { header: "Dates", cell: (c) => <span className="whitespace-nowrap">{formatDateRange(c.startDate, c.endDate)}</span> },
                { header: "Budget", cell: (c) => <BudgetCell c={c} /> },
                { header: "Status", cell: (c) => <Badge>{c.status}</Badge> },
                { header: "Performance", cell: () => <span className="text-muted">{DATA_NOT_AVAILABLE}</span> },
                { header: "Content", cell: (c) => <Badge tone={c.contentStatus === "Ready" || c.contentStatus === "Published" ? "green" : c.contentStatus === "Not started" ? "neutral" : "gold"}>{c.contentStatus}</Badge> },
                { header: "Approval", cell: (c) => <Badge>{c.approvalStatus}</Badge> },
                {
                  header: "Actions",
                  cell: (c) => (
                    <DeleteButton
                      label={c.name}
                      onClick={() => {
                        update((u) => removeItem(u, "campaigns", c.id));
                        setMessage("Campaign deleted.");
                      }}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
