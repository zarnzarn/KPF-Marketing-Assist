import { WhenReady } from "@/components/AppDataProvider";
import { PageHeader } from "@/components/ui";
import { ContentView } from "@/components/views/ContentView";
import { viewerChannels } from "@/lib/data/server";

export const metadata = { title: "Content · Klong Phai Farm" };

export default async function ContentPage() {
  const channels = await viewerChannels();
  return (
    <>
      <PageHeader title="Content" subtitle="Plan posts, articles and messages. Drafts are saved in this browser only and are never published from this app." />
      <WhenReady>
        <ContentView channels={channels} />
      </WhenReady>
    </>
  );
}
