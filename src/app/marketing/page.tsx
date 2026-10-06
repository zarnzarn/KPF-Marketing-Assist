import { PageHeader } from "@/components/ui";
import { MarketingView } from "@/components/views/MarketingView";
import { loadChannels } from "@/lib/channels/loadChannels";

export const metadata = { title: "Marketing · Klong Phai Farm" };

export default async function MarketingPage() {
  const channels = await loadChannels();
  return (
    <>
      <PageHeader title="Marketing" subtitle="Campaigns, content, approvals and your social channels in one view." />
      <MarketingView channels={channels} />
    </>
  );
}
