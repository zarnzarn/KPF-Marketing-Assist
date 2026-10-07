import { TodayView } from "@/components/views/TodayView";
import { viewerChannels } from "@/lib/data/server";

export default async function TodayPage() {
  return <TodayView channels={await viewerChannels()} />;
}
