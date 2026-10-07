// Task rules (create / edit / complete). Pure functions, in memory only.
import { isIsoDate } from "./dates";
import type { Priority, Task, TaskStatus } from "./types";

export interface TaskInput {
  title: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
  owner: string;
  campaignId?: string;
  customerId?: string;
  productId?: string;
}

export type TaskErrors = Partial<Record<"title" | "dueDate" | "owner", string>>;

export function validateTask(input: TaskInput): TaskErrors {
  const errors: TaskErrors = {};
  if (!input.title.trim()) errors.title = "Title is required.";
  else if (input.title.trim().length > 140) errors.title = "Title must be 140 characters or fewer.";
  if (!isIsoDate(input.dueDate)) {
    errors.dueDate = "Enter a valid due date.";
  }
  if (!input.owner.trim()) errors.owner = "Owner is required.";
  return errors;
}

export const hasErrors = (errors: TaskErrors) => Object.keys(errors).length > 0;

const clean = (input: TaskInput): TaskInput => ({
  ...input,
  title: input.title.trim(),
  owner: input.owner.trim(),
  campaignId: input.campaignId || undefined,
  customerId: input.customerId || undefined,
  productId: input.productId || undefined,
});

export function createTask(list: Task[], input: TaskInput, id: string): Task[] {
  if (hasErrors(validateTask(input))) throw new Error("Invalid task.");
  if (list.some((t) => t.id === id)) throw new Error(`Task ${id} already exists.`);
  return [{ id, ...clean(input) }, ...list];
}

export function deleteTask(list: Task[], id: string): Task[] {
  return list.filter((t) => t.id !== id);
}

export function updateTask(list: Task[], id: string, input: TaskInput): Task[] {
  if (!list.some((t) => t.id === id)) throw new Error(`Task ${id} not found.`);
  if (hasErrors(validateTask(input))) throw new Error("Invalid task.");
  return list.map((t) => (t.id === id ? { id, ...clean(input) } : t));
}

export function completeTask(list: Task[], id: string): Task[] {
  if (!list.some((t) => t.id === id)) throw new Error(`Task ${id} not found.`);
  return list.map((t) => (t.id === id ? { ...t, status: "Done" } : t));
}
