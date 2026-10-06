"use client";

import { useId, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Badge, Card, DataTable, EmptyState } from "@/components/ui";
import { MOCK_TODAY } from "@/data/mock";
import { DATA_NOT_AVAILABLE } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { getCampaign, getCustomer, getProduct } from "@/lib/queries";
import type { DocumentRecord } from "@/lib/types";

export function DocumentsBoard({ initialDocuments }: { initialDocuments: DocumentRecord[] }) {
  const [docs, setDocs] = useState(initialDocuments);
  const [selectedId, setSelectedId] = useState(initialDocuments[0]?.id);
  const [message, setMessage] = useState("");
  const fileId = useId();
  const selected = docs.find((d) => d.id === selectedId);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Mock only: the file is NOT read, uploaded or stored. We keep just its name and size.
    const doc: DocumentRecord = {
      id: `doc-upload-${docs.length + 1}`,
      name: file.name,
      kind: "PDF",
      uploadedAt: MOCK_TODAY,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      summary: `Summary: ${DATA_NOT_AVAILABLE} (real document summaries are not built in Phase 1).`,
      tags: ["uploaded (mock)"],
    };
    setDocs((d) => [doc, ...d]);
    setSelectedId(doc.id);
    setMessage(`"${file.name}" added to the list (mock). The file was not uploaded or stored.`);
    e.target.value = "";
  }

  return (
    <div className="space-y-6">
      <Card id="upload" title="Upload" subtitle="Mock upload. Files stay on your computer.">
        <label htmlFor={fileId} className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-forest/30 bg-forest-soft/40 p-8 text-center hover:border-yolk">
          <UploadCloud className="h-8 w-8 text-sage" aria-hidden="true" />
          <span className="font-semibold text-forest">Choose a file to add to the list</span>
          <span className="text-sm text-muted">PDF, Word, Excel, slides or images. Nothing is sent anywhere.</span>
        </label>
        <input id={fileId} type="file" className="sr-only" onChange={onFile} />
        <p role="status" className="mt-3 text-sm font-medium text-sage">{message}</p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card id="list" title="Document list" className="xl:col-span-2">
          <DataTable
            caption="Documents"
            rows={docs}
            rowKey={(d) => d.id}
            columns={[
              { header: "Name", cell: (d) => <button type="button" onClick={() => setSelectedId(d.id)} aria-pressed={d.id === selectedId} className="text-left font-semibold text-forest underline-offset-4 hover:underline">{d.name}</button> },
              { header: "Type", cell: (d) => d.kind },
              { header: "Uploaded", cell: (d) => formatDate(d.uploadedAt) },
              { header: "Size", cell: (d) => `${d.sizeKb} KB` },
              { header: "Tags", cell: (d) => <span className="flex flex-wrap gap-1">{d.tags.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}</span> },
            ]}
          />
        </Card>

        <Card id="detail" title="Document detail">
          {selected ? (
            <dl className="space-y-3 text-sm">
              <div><dt className="text-muted">Name</dt><dd className="font-semibold">{selected.name}</dd></div>
              <div><dt className="text-muted">Summary (mock)</dt><dd>{selected.summary}</dd></div>
              <div><dt className="text-muted">Tags</dt><dd className="flex flex-wrap gap-1">{selected.tags.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}</dd></div>
              <div><dt className="text-muted">Related campaign</dt><dd>{getCampaign(selected.campaignId)?.name ?? "None linked"}</dd></div>
              <div><dt className="text-muted">Related product</dt><dd>{getProduct(selected.productId)?.name ?? "None linked"}</dd></div>
              <div><dt className="text-muted">Related customer</dt><dd>{getCustomer(selected.customerId)?.name ?? "None linked"}</dd></div>
            </dl>
          ) : (
            <EmptyState>Select a document to see its details.</EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}
