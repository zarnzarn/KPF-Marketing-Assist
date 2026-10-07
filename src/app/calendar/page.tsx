import { WhenReady } from "@/components/AppDataProvider";
import { PageHeader } from "@/components/ui";
import { CalendarView } from "@/components/CalendarView";

export const metadata = { title: "Calendar · Klong Phai Farm" };

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Calendar" subtitle="Your meetings, tasks, campaign milestones, content deadlines and follow-ups in one place." />
      <WhenReady>
        <CalendarView />
      </WhenReady>
    </>
  );
}
