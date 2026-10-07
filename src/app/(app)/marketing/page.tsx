import { WhenReady } from "@/components/AppDataProvider";
import { PageHeader } from "@/components/ui";
import { MarketingView } from "@/components/views/MarketingView";
import { viewerChannels } from "@/lib/data/server";

export const metadata = { title: "Marketing · Klong Phai Farm" };

export default async function MarketingPage() {
  const channels = await viewerChannels();
  return (
    <>
      <PageHeader title="Marketing" subtitle="Campaigns, content, approvals and your social channels in one view." />
      <WhenReady>
        <MarketingView channels={channels} />
      </WhenReady>
    </>
  );
}
