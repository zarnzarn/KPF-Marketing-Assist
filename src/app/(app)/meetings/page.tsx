import { WhenReady } from "@/components/AppDataProvider";
import { PageHeader } from "@/components/ui";
import { MeetingsView } from "@/components/views/MeetingsView";

export const metadata = { title: "Meetings · Klong Phai Farm" };

export default function MeetingsPage() {
  return (
    <>
      <PageHeader title="Meetings" subtitle="Your meetings with agenda, notes and previous discussion. Saved in this browser only." />
      <WhenReady>
        <MeetingsView />
      </WhenReady>
    </>
  );
}
