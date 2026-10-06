import { PageHeader } from "@/components/ui";
import { CalendarView } from "@/components/CalendarView";
import { calendarItems } from "@/lib/queries";

export const metadata = { title: "Calendar · Klong Phai Farm (Prototype)" };

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Calendar" subtitle="Meetings, events, campaign milestones, content deadlines and follow-ups in one place." />
      <CalendarView items={calendarItems()} />
    </>
  );
}
