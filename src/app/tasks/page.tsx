import { PageHeader } from "@/components/ui";
import { TaskBoard } from "@/components/TaskBoard";
import { tasks } from "@/data/mock";

export const metadata = { title: "Tasks · Klong Phai Farm (Prototype)" };

export default function TasksPage() {
  return (
    <>
      <PageHeader title="Tasks" subtitle="Create, edit and complete tasks. Changes live in this browser tab only (mock, no database)." />
      <TaskBoard initialTasks={tasks} />
    </>
  );
}
