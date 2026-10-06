"use client";

import { useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { AddButton, DeleteButton, EntityForm, StatusMessage } from "@/components/EntityForm";
import { Badge, Card, DataTable, EmptyState, Stat, type Column } from "@/components/ui";
import type { ChannelSnapshot } from "@/lib/channels/types";
import { formatDate } from "@/lib/dates";
import { contentFields, toContent } from "@/lib/forms";
import { addItem, newId, removeItem } from "@/lib/store/userData";
import type { ContentItem, ContentType } from "@/lib/types";

const platforms: ContentType[] = ["Facebook", "Instagram", "Website", "LINE OA", "PR", "Email", "B2B materials"];
const accents = ["sage", "butter", "sky", "blush"] as const;

export function ContentView({ channels = [] }: { channels?: ChannelSnapshot[] }) {
  const { data, update } = useAppData();
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const sorted = [...data.content].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const drafts = sorted.filter((c) => c.status !== "Published");
  const posts = channels.filter((c) => (c.channel === "facebook" || c.channel === "instagram") && c.status === "connected");

  const columns: Column<ContentItem>[] = [
    { header: "Content", cell: (c) => <span className="font-medium">{c.title}</span> },
    { header: "Platform", cell: (c) => <Badge tone="neutral">{c.type}</Badge> },
    { header: "Status", cell: (c) => <Badge>{c.status}</Badge> },
    { header: "Approval", cell: (c) => <Badge>{c.approvalStatus}</Badge> },
    { header: "Due / publish date", cell: (c) => formatDate(c.publishDate ?? c.dueDate) },
    {
      header: "Actions",
      cell: (c) => (
        <DeleteButton
          label={c.title}
          onClick={() => {
            update((u) => removeItem(u, "content", c.id));
            setMessage("Content deleted.");
          }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <AddButton label="Add content" onClick={() => setAdding(true)} />
        <StatusMessage text={message} />
      </div>

      {adding && (
        <EntityForm
          title="Add content"
          fields={contentFields}
          defaults={{ dueDate: data.today, status: "Draft", approvalStatus: "Not required" }}
          submitLabel="Save content"
          onCancel={() => setAdding(false)}
          onSubmit={(v) => {
            update((u) => addItem(u, "content", toContent(newId("cnt"), v)));
            setAdding(false);
            setMessage("Content saved. Nothing is published from this app.");
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-7">
        {platforms.map((p, i) => (
          <Stat key={p} accent={accents[i % 4]} label={p} value={String(data.content.filter((c) => c.type === p).length)} />
        ))}
      </div>

      <Card id="calendar" title="Content calendar" subtitle="Your content, sorted by due date">
        {sorted.length === 0 ? <EmptyState>No content yet. Use &ldquo;Add content&rdquo; to plan a post, article or message.</EmptyState> : <DataTable caption="Content calendar" rows={sorted} rowKey={(c) => c.id} columns={columns} />}
      </Card>

      {drafts.length > 0 && (
        <Card id="drafts" title="Draft content" subtitle="Not published">
          <ul className="space-y-3">
            {drafts.map((c) => (
              <li key={c.id} className="rounded-xl border border-line bg-white p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{c.title}</p>
                  <span className="flex gap-2"><Badge tone="neutral">{c.type}</Badge><Badge>{c.status}</Badge><Badge>{c.approvalStatus}</Badge></span>
                </div>
                <p className="mt-2 text-sm text-muted">{c.draftText ?? "Draft text: Data not available."}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card id="channel-posts" title="Recent posts from your channels" subtitle="Read-only, from connected Facebook and Instagram">
        {posts.length === 0 ? (
          <EmptyState>Facebook and Instagram are not connected. Connect them on the Channels page.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {posts.flatMap((ch) =>
              ch.items.map((item) => (
                <li key={`${ch.channel}-${item.id}`} className="rounded-xl border border-line bg-white p-3.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{ch.label}</Badge>
                    {item.date && <span className="text-muted">{formatDate(item.date)}</span>}
                  </div>
                  <p className="mt-1.5">{item.title}</p>
                  {item.detail && <p className="mt-1 text-muted">{item.detail}</p>}
                </li>
              )),
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}
