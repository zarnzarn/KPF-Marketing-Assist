import { PageHeader } from "@/components/ui";
import { SecretaryChat } from "@/components/SecretaryChat";
import { loadChannels } from "@/lib/channels/loadChannels";
import { loadReports } from "@/lib/reports/loadReports";

export const metadata = { title: "AI Secretary · Klong Phai Farm" };
export const dynamic = "force-dynamic"; // reads the report files on this computer

export default async function SecretaryPage() {
  const [{ reports }, channels] = await Promise.all([loadReports(), loadChannels()]);
  return (
    <>
      <PageHeader
        title="AI Secretary"
        subtitle="Ask about your day. Answers come only from your entries, your monthly reports and your connected channels, with every statement labelled. No AI model is connected yet."
      />
      <SecretaryChat reports={reports} channels={channels} />
    </>
  );
}
