import { PageHeader } from "@/components/ui";
import { SecretaryChat } from "@/components/SecretaryChat";
import { loadReports } from "@/lib/reports/loadReports";

export const metadata = { title: "AI Secretary · Klong Phai Farm (Prototype)" };
export const dynamic = "force-dynamic"; // reads the report files on this computer

export default async function SecretaryPage() {
  const { source, reports } = await loadReports();
  return (
    <>
      <PageHeader
        title="AI Secretary"
        subtitle="Ask about your day. Answers come from mock data and your monthly reports, with every statement labelled. No real AI is connected yet."
      />
      <SecretaryChat reports={source === "local" ? reports : []} />
    </>
  );
}
