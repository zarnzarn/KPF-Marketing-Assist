import { TodayView } from "@/components/views/TodayView";
import { loadChannels } from "@/lib/channels/loadChannels";

export default async function TodayPage() {
  return <TodayView channels={await loadChannels()} />;
}
