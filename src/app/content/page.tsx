import { contentItems } from "@/data/mock";
import { Badge, Card, DataTable, PageHeader, Stat, type Column } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { getCampaign, getProduct } from "@/lib/queries";
import type { ContentItem, ContentType } from "@/lib/types";

export const metadata = { title: "Content · Klong Phai Farm (Prototype)" };

const platforms: ContentType[] = ["Facebook", "Instagram", "Website", "LINE OA", "PR", "Email", "B2B materials"];

const columns: Column<ContentItem>[] = [
  { header: "Content", cell: (c) => <span className="font-medium">{c.title}</span> },
  { header: "Platform", cell: (c) => <Badge tone="neutral">{c.type}</Badge> },
  { header: "Status", cell: (c) => <Badge>{c.status}</Badge> },
  { header: "Campaign", cell: (c) => getCampaign(c.campaignId)?.name ?? "—" },
  { header: "Product", cell: (c) => getProduct(c.productId)?.name ?? "—" },
  { header: "Approval", cell: (c) => <Badge>{c.approvalStatus}</Badge> },
  { header: "Due / publish date", cell: (c) => formatDate(c.publishDate ?? c.dueDate) },
];

function ContentTable({ caption, rows }: { caption: string; rows: ContentItem[] }) {
  return <DataTable caption={caption} rows={rows} rowKey={(c) => c.id} columns={columns} />;
}

export default function ContentPage() {
  const drafts = contentItems.filter((c) => c.status !== "Published");
  const published = contentItems.filter((c) => c.status === "Published");
  const sorted = [...contentItems].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return (
    <>
      <PageHeader title="Content" subtitle="Content calendar, drafts and published items. Drafts are never published automatically." />

      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-7">
        {platforms.map((p) => (
          <Stat accent="sage" key={p} label={p} value={String(contentItems.filter((c) => c.type === p).length)} />
        ))}
      </div>

      <Card id="calendar" title="Content calendar" subtitle="Sorted by due date" className="mt-6">
        <ContentTable caption="Content calendar" rows={sorted} />
      </Card>

      <Card id="drafts" title="Draft content" subtitle="Not published" className="mt-6">
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

      <Card id="published" title="Published content" className="mt-6">
        <ContentTable caption="Published content" rows={published} />
      </Card>
    </>
  );
}
