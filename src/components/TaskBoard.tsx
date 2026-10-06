"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, Pencil, Plus } from "lucide-react";
import { MOCK_TODAY, campaigns, customers, products } from "@/data/mock";
import { Badge, Card, DataTable } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { getCampaign, getCustomer, getProduct } from "@/lib/queries";
import { completeTask, createTask, hasErrors, updateTask, validateTask, type TaskErrors, type TaskInput } from "@/lib/tasks";
import type { Priority, Task, TaskStatus } from "@/lib/types";

const emptyInput: TaskInput = { title: "", priority: "Medium", status: "To do", dueDate: MOCK_TODAY, owner: "Marketing Director" };

export function TaskBoard({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [input, setInput] = useState<TaskInput>(emptyInput);
  const [errors, setErrors] = useState<TaskErrors>({});
  const [message, setMessage] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  useEffect(() => {
    if (editing) titleRef.current?.focus();
  }, [editing]);

  function open(task?: Task) {
    setErrors({});
    setInput(task ? { title: task.title, priority: task.priority, status: task.status, dueDate: task.dueDate, owner: task.owner, campaignId: task.campaignId, customerId: task.customerId, productId: task.productId } : emptyInput);
    setEditing(task ? task.id : "new");
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const found = validateTask(input);
    setErrors(found);
    if (hasErrors(found)) return;
    setTasks((list) => (editing === "new" ? createTask(list, input) : updateTask(list, editing as string, input)));
    setMessage(editing === "new" ? "Task created." : "Task updated.");
    setEditing(null);
  }

  function complete(id: string) {
    setTasks((list) => completeTask(list, id));
    setMessage("Task marked as done.");
  }

  const field = (name: keyof TaskInput) => `${uid}-${name}`;
  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => setInput((i) => ({ ...i, [key]: value }));
  const inputCls = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => open()} className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 font-semibold text-white hover:bg-sage">
          <Plus className="h-4 w-4" aria-hidden="true" /> Create task
        </button>
        <p role="status" className="text-sm font-medium text-sage">{message}</p>
      </div>

      {editing && (
        <Card id="task-form" title={editing === "new" ? "Create task" : "Edit task"}>
          <form onSubmit={save} noValidate className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor={field("title")} className="mb-1 block text-sm font-medium">Title</label>
              <input ref={titleRef} id={field("title")} className={inputCls} value={input.title} onChange={(e) => set("title", e.target.value)} aria-invalid={!!errors.title} aria-describedby={errors.title ? `${field("title")}-err` : undefined} />
              {errors.title && <p id={`${field("title")}-err`} className="mt-1 text-sm font-medium text-clay">{errors.title}</p>}
            </div>
            <div>
              <label htmlFor={field("priority")} className="mb-1 block text-sm font-medium">Priority</label>
              <select id={field("priority")} className={inputCls} value={input.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
                {["High", "Medium", "Low"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={field("status")} className="mb-1 block text-sm font-medium">Status</label>
              <select id={field("status")} className={inputCls} value={input.status} onChange={(e) => set("status", e.target.value as TaskStatus)}>
                {["To do", "In progress", "Done"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={field("dueDate")} className="mb-1 block text-sm font-medium">Due date</label>
              <input id={field("dueDate")} type="date" className={inputCls} value={input.dueDate} onChange={(e) => set("dueDate", e.target.value)} aria-invalid={!!errors.dueDate} aria-describedby={errors.dueDate ? `${field("dueDate")}-err` : undefined} />
              {errors.dueDate && <p id={`${field("dueDate")}-err`} className="mt-1 text-sm font-medium text-clay">{errors.dueDate}</p>}
            </div>
            <div>
              <label htmlFor={field("owner")} className="mb-1 block text-sm font-medium">Owner</label>
              <input id={field("owner")} className={inputCls} value={input.owner} onChange={(e) => set("owner", e.target.value)} aria-invalid={!!errors.owner} aria-describedby={errors.owner ? `${field("owner")}-err` : undefined} />
              {errors.owner && <p id={`${field("owner")}-err`} className="mt-1 text-sm font-medium text-clay">{errors.owner}</p>}
            </div>
            <div>
              <label htmlFor={field("campaignId")} className="mb-1 block text-sm font-medium">Related campaign</label>
              <select id={field("campaignId")} className={inputCls} value={input.campaignId ?? ""} onChange={(e) => set("campaignId", e.target.value)}>
                <option value="">None</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={field("customerId")} className="mb-1 block text-sm font-medium">Related customer</label>
              <select id={field("customerId")} className={inputCls} value={input.customerId ?? ""} onChange={(e) => set("customerId", e.target.value)}>
                <option value="">None</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={field("productId")} className="mb-1 block text-sm font-medium">Related product</label>
              <select id={field("productId")} className={inputCls} value={input.productId ?? ""} onChange={(e) => set("productId", e.target.value)}>
                <option value="">None</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-3 md:col-span-2">
              <button type="submit" className="rounded-xl bg-forest px-5 py-2.5 font-semibold text-white hover:bg-sage">Save task</button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-line bg-white px-5 py-2.5 font-semibold hover:border-yolk">Cancel</button>
            </div>
          </form>
        </Card>
      )}

      <Card id="task-list" title="Task list" subtitle={`${tasks.filter((t) => t.status !== "Done").length} open · ${tasks.filter((t) => t.status === "Done").length} done`}>
        <DataTable
          caption="Tasks"
          rows={tasks}
          rowKey={(t) => t.id}
          columns={[
            { header: "Task", cell: (t) => <span className={t.status === "Done" ? "text-muted line-through" : "font-medium"}>{t.title}</span> },
            { header: "Priority", cell: (t) => <Badge>{t.priority}</Badge> },
            { header: "Status", cell: (t) => <Badge>{t.status}</Badge> },
            { header: "Due", cell: (t) => <span className={t.status !== "Done" && t.dueDate < MOCK_TODAY ? "font-semibold text-clay" : ""}>{formatDate(t.dueDate)}{t.status !== "Done" && t.dueDate < MOCK_TODAY ? " (overdue)" : ""}</span> },
            { header: "Owner", cell: (t) => t.owner },
            { header: "Campaign", cell: (t) => getCampaign(t.campaignId)?.name ?? "—" },
            { header: "Customer", cell: (t) => getCustomer(t.customerId)?.name ?? "—" },
            { header: "Product", cell: (t) => getProduct(t.productId)?.name ?? "—" },
            {
              header: "Actions",
              cell: (t) => (
                <div className="flex gap-2">
                  <button type="button" onClick={() => open(t)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold hover:border-yolk">
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit<span className="sr-only"> {t.title}</span>
                  </button>
                  <button type="button" disabled={t.status === "Done"} onClick={() => complete(t.id)} className="inline-flex items-center gap-1 rounded-lg bg-forest px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sage disabled:bg-muted/60">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Complete<span className="sr-only"> {t.title}</span>
                  </button>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
