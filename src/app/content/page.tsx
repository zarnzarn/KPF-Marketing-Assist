import { PageHeader } from "@/components/ui";
import { ContentView } from "@/components/views/ContentView";
import { loadChannels } from "@/lib/channels/loadChannels";

export const metadata = { title: "Content · Klong Phai Farm" };

export default async function ContentPage() {
  const channels = await loadChannels();
  return (
    <>
      <PageHeader title="Content" subtitle="Plan posts, articles and messages. Drafts are saved in this browser only and are never published from this app." />
      <ContentView channels={channels} />
    </>
  );
}
