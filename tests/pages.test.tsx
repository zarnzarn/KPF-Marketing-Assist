import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppShell, navItems } from "@/components/AppShell";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import CalendarPage from "@/app/calendar/page";
import CampaignsPage from "@/app/campaigns/page";
import ContentPage from "@/app/content/page";
import CustomersPage from "@/app/customers/page";
import DocumentsPage from "@/app/documents/page";
import MarketingPage from "@/app/marketing/page";
import MeetingsPage from "@/app/meetings/page";
import ProductsPage from "@/app/products/page";
import ReportsPage from "@/app/reports/page";
import SalesPage from "@/app/sales/page";
import SecretaryPage from "@/app/secretary/page";
import TasksPage from "@/app/tasks/page";
import TodayPage from "@/app/page";

const pages: [string, string, () => ReactNode][] = [
  ["Today", "Today", TodayPage],
  ["AI Secretary", "AI Secretary", SecretaryPage],
  ["Marketing", "Marketing", MarketingPage],
  ["Sales", "Sales", SalesPage],
  ["Products", "Products", ProductsPage],
  ["Customers & B2B", "Customers & B2B", CustomersPage],
  ["Tasks", "Tasks", TasksPage],
  ["Calendar", "Calendar", CalendarPage],
  ["Meetings", "Meetings", MeetingsPage],
  ["Campaigns", "Campaigns", CampaignsPage],
  ["Content", "Content", ContentPage],
  ["Reports", "Reports", ReportsPage],
  ["Documents", "Documents", DocumentsPage],
];

describe("navigation", () => {
  it("links to all 13 pages", () => {
    expect(navItems.map((n) => n.label)).toEqual(pages.map(([label]) => label));
  });

  it("marks the current page and shows the prototype banner", () => {
    render(<AppShell><p>hi</p></AppShell>);
    const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(within(nav).getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText(/MOCK DATA ONLY/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to main content" })).toBeInTheDocument();
  });

  it("opens the mobile menu with the keyboard-accessible button", async () => {
    render(<AppShell><p>hi</p></AppShell>);
    const button = screen.getByRole("button", { name: "Open menu" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
  });
});

describe.each(pages)("%s page", (_label, heading, Page) => {
  it("renders one h1, has no accessibility violations and no missing data text errors", async () => {
    const { container } = render(<main>{Page()}</main>);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(heading);
    expect(container.textContent).not.toMatch(/undefined|NaN|\[object Object\]/);
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });
});

describe("Today page content", () => {
  it("answers the key questions", () => {
    render(<main>{TodayPage()}</main>);
    for (const name of ["Recommended priorities", "AI daily summary", "Today's schedule", "Pending approvals", "Priority tasks", "Overdue tasks", "Follow-ups", "Important customer issues", "Campaign alerts", "Product alerts", "Sales alerts", "Business alerts", "Upcoming meetings", "Important messages"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });
});

describe("Tasks page", () => {
  it("shows validation errors for invalid input and does not create the task", async () => {
    const user = userEvent.setup();
    render(<main>{TasksPage()}</main>);
    const before = screen.getAllByRole("row").length;
    await user.click(screen.getByRole("button", { name: /create task/i }));
    await user.clear(screen.getByLabelText("Title"));
    await user.click(screen.getByRole("button", { name: "Save task" }));
    expect(screen.getByText("Title is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByRole("row")).toHaveLength(before);
  });

  it("creates, edits and completes a task", async () => {
    const user = userEvent.setup();
    render(<main>{TasksPage()}</main>);
    await user.click(screen.getByRole("button", { name: /create task/i }));
    await user.type(screen.getByLabelText("Title"), "Test the new task");
    await user.click(screen.getByRole("button", { name: "Save task" }));
    expect(screen.getByRole("cell", { name: "Test the new task" })).toBeInTheDocument();
    expect(screen.getByText("Task created.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Edit\s*Test the new task/ }));
    const title = screen.getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Renamed task");
    await user.click(screen.getByRole("button", { name: "Save task" }));
    expect(screen.getByRole("cell", { name: "Renamed task" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Complete\s*Renamed task/ }));
    expect(screen.getByRole("button", { name: /Complete\s*Renamed task/ })).toBeDisabled();
    expect(screen.getByText("Task marked as done.")).toBeInTheDocument();
  });
});

describe("AI Secretary page", () => {
  it("answers a quick action with labelled statements and sources, and never sends anything", async () => {
    const user = userEvent.setup();
    render(<main>{SecretaryPage()}</main>);
    await user.click(screen.getByRole("button", { name: "What is overdue?" }));
    expect(screen.getAllByText("FACT").length).toBeGreaterThan(0);
    expect(screen.getAllByText("RECOMMENDATION").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Source records" })).toBeInTheDocument();
  });

  it("says Data not available for unknown questions", async () => {
    const user = userEvent.setup();
    render(<main>{SecretaryPage()}</main>);
    await user.type(screen.getByLabelText("Ask the AI Secretary"), "What is the weather?{Enter}");
    expect(screen.getAllByText("Data not available.").length).toBeGreaterThan(0);
    expect(screen.getByText("DATA GAP")).toBeInTheDocument();
  });

  it("ignores blank questions", async () => {
    const user = userEvent.setup();
    render(<main>{SecretaryPage()}</main>);
    const before = screen.getAllByRole("listitem").length;
    await user.type(screen.getByLabelText("Ask the AI Secretary"), "   {Enter}");
    expect(screen.getAllByRole("listitem")).toHaveLength(before);
  });

  it("shows an action preview that needs approval for drafts and creates only a mock request", async () => {
    const user = userEvent.setup();
    render(<main>{SecretaryPage()}</main>);
    await user.click(screen.getByRole("button", { name: "Draft a LINE message for the weekend promotion" }));
    expect(screen.getByText("Approval required")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create approval request (mock)" }));
    expect(screen.getByText(/Nothing was sent/)).toBeInTheDocument();
  });
});

describe("Calendar page", () => {
  it("switches between day, week and marketing views", async () => {
    const user = userEvent.setup();
    render(<main>{CalendarPage()}</main>);
    expect(screen.getByRole("button", { name: "Day" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByRole("heading", { name: /Week of/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Marketing calendar" }));
    expect(screen.getByRole("heading", { name: "Marketing calendar" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Day" }));
    await user.click(screen.getByRole("button", { name: /Next day/ }));
    expect(screen.getByRole("heading", { name: /Wednesday/ })).toBeInTheDocument();
  });
});

describe("Documents page", () => {
  it("adds an uploaded file to the list without storing it", async () => {
    const user = userEvent.setup();
    render(<main>{DocumentsPage()}</main>);
    const file = new File(["hello"], "notes.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/Choose a file/), file);
    expect(screen.getAllByText("notes.pdf").length).toBeGreaterThan(0);
    expect(screen.getByText(/was not uploaded or stored/)).toBeInTheDocument();
  });
});

describe("Customers page", () => {
  it("filters customers by type", async () => {
    const user = userEvent.setup();
    render(<main>{CustomersPage()}</main>);
    await user.selectOptions(screen.getByLabelText("Show"), "Hotel");
    expect(screen.getByText("2 shown")).toBeInTheDocument();
  });
});
