import { PageHeader } from "@/components/ui";
import { DocumentsBoard } from "@/components/DocumentsBoard";
import { documents } from "@/data/mock";

export const metadata = { title: "Documents · Klong Phai Farm (Prototype)" };

export default function DocumentsPage() {
  return (
    <>
      <PageHeader title="Documents" subtitle="Upload UI and document list. In Phase 1 nothing is uploaded or stored: files are only listed in this browser tab." />
      <DocumentsBoard initialDocuments={documents} />
    </>
  );
}
