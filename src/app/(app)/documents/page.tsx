import { WhenReady } from "@/components/AppDataProvider";
import { PageHeader } from "@/components/ui";
import { DocumentsBoard } from "@/components/DocumentsBoard";

export const metadata = { title: "Documents · Klong Phai Farm" };

export default function DocumentsPage() {
  return (
    <>
      <PageHeader title="Documents" subtitle="A list of your documents. Files are never uploaded or stored; only their names are kept in this browser." />
      <WhenReady>
        <DocumentsBoard />
      </WhenReady>
    </>
  );
}
