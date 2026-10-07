import { WhenReady } from "@/components/AppDataProvider";
import { PageHeader } from "@/components/ui";
import { TaskBoard } from "@/components/TaskBoard";

export const metadata = { title: "Tasks · Klong Phai Farm" };

export default function TasksPage() {
  return (
    <>
      <PageHeader title="Tasks" subtitle="Create, edit, complete and delete your tasks. They are saved in this browser only." />
      <WhenReady>
        <TaskBoard />
      </WhenReady>
    </>
  );
}
