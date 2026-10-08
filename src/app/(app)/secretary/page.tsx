import { PageHeader } from "@/components/ui";
import { SecretaryChat } from "@/components/SecretaryChat";
import { ollamaSettings } from "@/lib/ai/ollama";
import { viewerChannels, viewerReports } from "@/lib/data/server";

export const metadata = { title: "AI Secretary · Klong Phai Farm" };
export const dynamic = "force-dynamic"; // reads the reports on every visit
export const maxDuration = 60; // an AI answer can take up to about 25 seconds (the Ollama time limit)

export default async function SecretaryPage() {
  const [{ reports }, channels] = await Promise.all([viewerReports(), viewerChannels()]);
  return (
    <>
      <PageHeader
        title="AI Secretary"
        subtitle="Ask about your day. Answers come only from your entries, your monthly reports and your connected channels, with every statement labelled. Free-text questions are answered by the AI model when it is connected."
      />
      <SecretaryChat reports={reports} channels={channels} aiModel={ollamaSettings()?.model} />
    </>
  );
}
