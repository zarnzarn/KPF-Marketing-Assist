"use client";

import { useId, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useAppData } from "@/components/AppDataProvider";
import { DeleteButton } from "@/components/EntityForm";
import { Badge, Card, DataTable, EmptyState } from "@/components/ui";
import { DATA_NOT_AVAILABLE } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { getCampaign, getCustomer, getProduct } from "@/lib/queries";
import { addItem, newId, removeItem } from "@/lib/store/userData";
import type { DocumentRecord } from "@/lib/types";

export function kindFromName(name: string): DocumentRecord["kind"] {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["xls", "xlsx", "csv"].includes(ext)) return "Spreadsheet";
  if (["ppt", "pptx", "key"].includes(ext)) return "Slides";
  if (["doc", "docx", "txt", "rtf"].includes(ext)) return "Word";
  if (["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext)) return "Image";
  return "PDF";
}

export function DocumentsBoard() {
  const { data, update } = useAppData();
  const docs = data.documents;
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [message, setMessage] = useState("");
  const fileId = useId();
  const selected = docs.find((d) => d.id === selectedId) ?? docs[0];

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // The file itself is NOT read, uploaded or stored. Only its name and size are listed.
    const doc: DocumentRecord = {
      id: newId("doc"),
      name: file.name,
      kind: kindFromName(file.name),
      uploadedAt: data.today,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      summary: `Summary: ${DATA_NOT_AVAILABLE} (document summaries are not built yet).`,
      tags: [],
    };
    update((u) => addItem(u, "documents", doc));
    setSelectedId(doc.id);
    setMessage(`"${file.name}" added to the list. The file was not uploaded or stored.`);
    e.target.value = "";
  }

  return (
    <div className="space-y-6">
      <Card id="upload" title="Add a document" subtitle="Only the name and size are listed. Files stay on your computer.">
        <label htmlFor={fileId} className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-forest/30 bg-forest-soft/40 p-8 text-center hover:border-yolk">
          <UploadCloud className="h-8 w-8 text-sage" aria-hidden="true" />
          <span className="font-semibold text-forest">Choose a file to add to the list</span>
          <span className="text-sm text-muted">PDF, Word, Excel, slides or images. Nothing is sent anywhere.</span>
        </label>
        <input id={fileId} type="file" className="sr-only" onChange={onFile} />
        <p role="status" className="mt-3 text-sm font-medium text-sage">{message}</p>
      </Card>

      {docs.length === 0 ? (
        <EmptyState>No documents listed yet. Monthly reports are read separately on the Reports page.</EmptyState>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card id="list" title="Document list" className="xl:col-span-2">
            <DataTable
              caption="Documents"
              rows={docs}
              rowKey={(d) => d.id}
              columns={[
                { header: "Name", cell: (d) => <button type="button" onClick={() => setSelectedId(d.id)} aria-pressed={d.id === selected?.id} className="text-left font-semibold text-forest underline-offset-4 hover:underline">{d.name}</button> },
                { header: "Type", cell: (d) => d.kind },
                { header: "Added", cell: (d) => formatDate(d.uploadedAt) },
                { header: "Size", cell: (d) => `${d.sizeKb} KB` },
                {
                  header: "Actions",
                  cell: (d) => (
                    <DeleteButton
                      label={d.name}
                      onClick={() => {
                        update((u) => removeItem(u, "documents", d.id));
                        setMessage(`"${d.name}" removed from the list.`);
                      }}
                    />
                  ),
                },
              ]}
            />
          </Card>

          <Card id="detail" title="Document detail">
            {selected ? (
              <dl className="space-y-3 text-sm">
                <div><dt className="text-muted">Name</dt><dd className="font-semibold">{selected.name}</dd></div>
                <div><dt className="text-muted">Summary</dt><dd>{selected.summary}</dd></div>
                <div><dt className="text-muted">Tags</dt><dd className="flex flex-wrap gap-1">{selected.tags.length ? selected.tags.map((t) => <Badge key={t} tone="neutral">{t}</Badge>) : "None"}</dd></div>
                <div><dt className="text-muted">Related campaign</dt><dd>{getCampaign(data, selected.campaignId)?.name ?? "None linked"}</dd></div>
                <div><dt className="text-muted">Related product</dt><dd>{getProduct(data, selected.productId)?.name ?? "None linked"}</dd></div>
                <div><dt className="text-muted">Related customer</dt><dd>{getCustomer(data, selected.customerId)?.name ?? "None linked"}</dd></div>
              </dl>
            ) : (
              <EmptyState>Select a document to see its details.</EmptyState>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
