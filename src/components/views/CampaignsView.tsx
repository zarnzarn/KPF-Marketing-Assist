"use client";

import { useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { CampaignTimeline } from "@/components/CampaignTimeline";
import { AddButton, DeleteButton, EntityForm, StatusMessage } from "@/components/EntityForm";
import { Badge, Card, DataTable, EmptyState, ProgressBar } from "@/components/ui";
import { DATA_NOT_AVAILABLE } from "@/lib/constants";
import { formatCompactThb, formatDate } from "@/lib/dates";
import { campaignFields, toCampaign, validateRange } from "@/lib/forms";
import { addItem, newId, removeItem } from "@/lib/store/userData";

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
                { header: "Dates", cell: (c) => `${formatDate(c.startDate)} - ${formatDate(c.endDate)}` },
                { header: "Budget", cell: (c) => (c.spentThb === null ? <span>{formatCompactThb(c.budgetThb)}<br /><span className="text-xs text-muted">Spent: {DATA_NOT_AVAILABLE}</span></span> : <div className="w-32"><p>{formatCompactThb(c.spentThb)} / {formatCompactThb(c.budgetThb)}</p><ProgressBar value={c.spentThb} max={c.budgetThb} label={`${c.name} budget used`} /></div>) },
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
