import { describe, expect, it } from "vitest";
import { tasks } from "./fixtures";
import { completeTask, createTask, deleteTask, updateTask, validateTask, type TaskInput } from "@/lib/tasks";

const valid: TaskInput = { title: "  Call chef  ", priority: "High", status: "To do", dueDate: "2026-10-10", owner: " Me ", campaignId: "" };

describe("validateTask", () => {
  it("accepts a valid task", () => {
    expect(validateTask(valid)).toEqual({});
  });
  it("rejects empty title, bad date and empty owner", () => {
    const errors = validateTask({ ...valid, title: "   ", dueDate: "10/10/2026", owner: "" });
    expect(Object.keys(errors).sort()).toEqual(["dueDate", "owner", "title"]);
  });
  it("rejects impossible dates", () => {
    expect(validateTask({ ...valid, dueDate: "2026-13-45" }).dueDate).toBeDefined();
  });
  it("rejects very long titles", () => {
    expect(validateTask({ ...valid, title: "x".repeat(141) }).title).toBeDefined();
  });
});

describe("createTask / updateTask / completeTask", () => {
  it("creates a trimmed task at the top without changing the original list", () => {
    const next = createTask(tasks, valid, "tsk-new-1");
    expect(next).toHaveLength(tasks.length + 1);
    expect(next[0].title).toBe("Call chef");
    expect(next[0].owner).toBe("Me");
    expect(next[0].campaignId).toBeUndefined();
    expect(tasks).toHaveLength(next.length - 1);
  });
  it("throws on invalid input", () => {
    expect(() => createTask(tasks, { ...valid, title: "" }, "tsk-x")).toThrow("Invalid task.");
  });
  it("refuses a duplicate id", () => {
    expect(() => createTask(tasks, valid, tasks[0].id)).toThrow("already exists");
  });
  it("deletes a task", () => {
    expect(deleteTask(tasks, tasks[0].id)).toHaveLength(tasks.length - 1);
  });
  it("updates only the chosen task", () => {
    const target = tasks[0];
    const next = updateTask(tasks, target.id, { ...valid, title: "Changed" });
    expect(next.find((t) => t.id === target.id)?.title).toBe("Changed");
    expect(next[1]).toBe(tasks[1]);
  });
  it("throws for unknown ids", () => {
    expect(() => updateTask(tasks, "nope", valid)).toThrow("not found");
    expect(() => completeTask(tasks, "nope")).toThrow("not found");
  });
  it("completes a task", () => {
    const target = tasks.find((t) => t.status !== "Done")!;
    expect(completeTask(tasks, target.id).find((t) => t.id === target.id)?.status).toBe("Done");
  });
});
