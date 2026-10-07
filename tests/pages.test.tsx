import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppDataProvider } from "@/components/AppDataProvider";
import { AppShell, navItems } from "@/components/AppShell";
import { STORAGE_KEY, resetUserDataCache } from "@/lib/store/userData";
import type { UserData } from "@/lib/types";
import { FIXTURE_TODAY, fixtureUserData, products } from "./fixtures";
import { makeDocx, sampleReportParts } from "./helpers/makeDocx";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import CalendarPage from "@/app/calendar/page";
import ChannelsPage from "@/app/channels/page";
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

type PageProps = { searchParams: Promise<{ month?: string }> };
const noProps: PageProps = { searchParams: Promise.resolve({}) };
type Page = (props: PageProps) => ReactNode | Promise<ReactNode>;

const pages: [string, Page][] = [
  ["Today", TodayPage],
  ["AI Secretary", SecretaryPage],
  ["Marketing", MarketingPage],
  ["Sales", SalesPage],
  ["Products", ProductsPage],
  ["Customers & B2B", CustomersPage],
  ["Tasks", TasksPage],
  ["Calendar", CalendarPage],
  ["Meetings", MeetingsPage],
  ["Campaigns", CampaignsPage],
  ["Content", ContentPage],
  ["Reports", ReportsPage],
  ["Documents", DocumentsPage],
  ["Channels", ChannelsPage],
];

const noReports = path.join(tmpdir(), "kpf-no-reports-folder");

/** Renders a page inside the data provider, with the given entries saved in "this browser". */
async function renderPage(Page: Page, user: Partial<UserData> | null, props: PageProps = noProps, withProducts = false) {
  localStorage.clear();
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  resetUserDataCache();
  const ui = await Page(props);
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <AppDataProvider today={FIXTURE_TODAY} products={withProducts ? products : []}>
        <main>{ui}</main>
      </AppDataProvider>,
    );
  });
  return result;
}

beforeEach(() => {
  vi.stubEnv("REPORTS_DIR", noReports);
  // The app follows the computer's date when it is later than the server's, so pin it to the fixture day.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${FIXTURE_TODAY}T05:00:00Z`));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  localStorage.clear();
  resetUserDataCache();
});

describe("navigation", () => {
  it("links to every page", () => {
    expect(navItems.map((n) => n.label)).toEqual(expect.arrayContaining(pages.map(([label]) => label)));
  });

  it("marks the current page and shows the read-only banner", () => {
    render(<AppDataProvider today={FIXTURE_TODAY}><AppShell><p>hi</p></AppShell></AppDataProvider>);
    const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(within(nav).getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText(/nothing is sent, published, repriced or launched/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to main content" })).toBeInTheDocument();
  });

  it("opens the mobile menu with the keyboard-accessible button", async () => {
    render(<AppDataProvider today={FIXTURE_TODAY}><AppShell><p>hi</p></AppShell></AppDataProvider>);
    const button = screen.getByRole("button", { name: "Open menu" });
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
  });
});

describe.each(pages)("%s page", (heading, Page) => {
  it("works for a brand-new user: one h1, an empty state, no sample data, no a11y violations", async () => {
    const { container } = await renderPage(Page, null);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(heading);
    expect(container.textContent).not.toMatch(/undefined|NaN|\[object Object\]|mock/i);
    expect(container.textContent).not.toMatch(/\(Mock\)|Riverside|Lotus Terrace|Chef's Chicken Sausage/);
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });

  it("renders saved entries without errors or a11y violations", async () => {
    const { container } = await renderPage(Page, fixtureUserData, noProps, true);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(heading);
    expect(container.textContent).not.toMatch(/undefined|NaN|\[object Object\]/);
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });
});

describe("Today page", () => {
  it("shows a getting-started guide for a new user", async () => {
    await renderPage(TodayPage, null);
    expect(screen.getByRole("heading", { name: "Getting started" })).toBeInTheDocument();
    expect(screen.getAllByText("Data not available.").length).toBeGreaterThan(0);
  });

  it("answers the key questions when there is data", async () => {
    await renderPage(TodayPage, fixtureUserData, noProps, true);
    for (const name of ["Recommended priorities", "AI daily summary", "Today's schedule", "Pending approvals", "Priority tasks", "Overdue tasks", "Follow-ups", "Important customer issues", "Campaign alerts", "Product and stock alerts", "Channel alerts", "Upcoming meetings"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("heading", { name: "Getting started" })).not.toBeInTheDocument();
  });

  it("approving a request only changes its status", async () => {
    const user = userEvent.setup();
    await renderPage(TodayPage, fixtureUserData);
    const approve = screen.getAllByRole("button", { name: /^Approve\s*\S/ })[0];
    const before = screen.getAllByRole("button", { name: /^Approve\s*\S/ }).length;
    await user.click(approve);
    expect(screen.getAllByRole("button", { name: /^Approve\s*\S/ })).toHaveLength(before - 1);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.approvals.filter((a: { state: string }) => a.state === "Approved").length).toBeGreaterThan(0);
  });
});

describe("Tasks page", () => {
  it("shows validation errors for invalid input and does not create the task", async () => {
    const user = userEvent.setup();
    await renderPage(TasksPage, null);
    await user.click(screen.getByRole("button", { name: /create task/i }));
    await user.clear(screen.getByLabelText("Title"));
    await user.click(screen.getByRole("button", { name: "Save task" }));
    expect(screen.getByText("Title is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("creates, edits, completes and deletes a task, saved in this browser", async () => {
    const user = userEvent.setup();
    await renderPage(TasksPage, null);
    await user.click(screen.getByRole("button", { name: /create task/i }));
    await user.type(screen.getByLabelText("Title"), "Test the new task");
    await user.click(screen.getByRole("button", { name: "Save task" }));
    expect(screen.getByRole("cell", { name: "Test the new task" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).tasks[0].title).toBe("Test the new task");

    await user.click(screen.getByRole("button", { name: /Edit\s*Test the new task/ }));
    const title = screen.getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Renamed task");
    await user.click(screen.getByRole("button", { name: "Save task" }));
    expect(screen.getByRole("cell", { name: "Renamed task" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Complete\s*Renamed task/ }));
    expect(screen.getByRole("button", { name: /Complete\s*Renamed task/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Delete\s*Renamed task/ }));
    expect(screen.queryByRole("cell", { name: "Renamed task" })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).tasks).toEqual([]);
  });
});

describe("Add forms", () => {
  it("adds a meeting and rejects an end time before the start", async () => {
    const user = userEvent.setup();
    await renderPage(MeetingsPage, null);
    await user.click(screen.getByRole("button", { name: "Add meeting" }));
    await user.type(screen.getByLabelText(/^Title/), "Weekly stand-up");
    const end = screen.getByLabelText(/^End time/);
    await user.clear(end);
    await user.type(end, "08:00");
    await user.click(screen.getByRole("button", { name: "Save meeting" }));
    expect(screen.getByText("End time must be after the start time.")).toBeInTheDocument();
    await user.clear(end);
    await user.type(end, "10:30");
    await user.click(screen.getByRole("button", { name: "Save meeting" }));
    expect(screen.getByRole("heading", { name: "Weekly stand-up" })).toBeInTheDocument();
  });

  it("adds a customer and records an issue, then resolves it", async () => {
    const user = userEvent.setup();
    await renderPage(CustomersPage, null);
    await user.click(screen.getByRole("button", { name: "Add customer or B2B account" }));
    await user.type(screen.getByLabelText(/^Business or segment name/), "Test Hotel");
    await user.click(screen.getByRole("button", { name: "Save customer" }));
    expect(screen.getAllByText("Test Hotel").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Record a customer issue" }));
    await user.selectOptions(screen.getByLabelText("Customer (optional)"), "Test Hotel");
    await user.type(screen.getByLabelText(/^Issue/), "Late delivery");
    await user.click(screen.getByRole("button", { name: "Save issue" }));
    expect(screen.getAllByText("Late delivery").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Mark resolved/ }));
    expect(screen.queryAllByText("Late delivery")).toHaveLength(0);
  });

  it("adds a campaign with a milestone that appears on the calendar data", async () => {
    const user = userEvent.setup();
    await renderPage(CampaignsPage, null);
    await user.click(screen.getByRole("button", { name: "Add campaign" }));
    await user.type(screen.getByLabelText(/^Campaign name/), "Year-end gifting");
    await user.type(screen.getByLabelText(/^Objective/), "Corporate gift orders");
    await user.type(screen.getByLabelText(/^Milestones/), "2026-10-10 Brochure ready");
    await user.click(screen.getByRole("button", { name: "Save campaign" }));
    expect(screen.getAllByText("Year-end gifting").length).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).campaigns[0].milestones).toEqual([{ date: "2026-10-10", label: "Brochure ready" }]);
  });

  it("adds content", async () => {
    const user = userEvent.setup();
    await renderPage(ContentPage, null);
    await user.click(screen.getByRole("button", { name: "Add content" }));
    await user.type(screen.getByLabelText(/^Title/), "LINE weekend post");
    await user.selectOptions(screen.getByLabelText(/^Platform/), "LINE OA");
    await user.click(screen.getByRole("button", { name: "Save content" }));
    expect(screen.getByRole("cell", { name: "LINE weekend post" })).toBeInTheDocument();
  });
});

describe("AI Secretary page", () => {
  it("says Data not available for a new user and never invents facts", async () => {
    const user = userEvent.setup();
    await renderPage(SecretaryPage, null);
    await user.click(screen.getByRole("button", { name: "What is overdue?" }));
    expect(screen.getAllByText("DATA GAP").length).toBeGreaterThan(0);
    expect(screen.queryByText("FACT")).not.toBeInTheDocument();
  });

  it("answers from saved entries with labels and sources", async () => {
    const user = userEvent.setup();
    await renderPage(SecretaryPage, fixtureUserData);
    await user.click(screen.getByRole("button", { name: "What is overdue?" }));
    expect(screen.getAllByText("FACT").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Source records" })).toBeInTheDocument();
  });

  it("creating an approval request adds it to pending approvals and sends nothing", async () => {
    const user = userEvent.setup();
    await renderPage(SecretaryPage, null);
    await user.click(screen.getByRole("button", { name: "Draft a LINE message for the weekend promotion" }));
    expect(screen.getByText("Approval required")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create approval request" }));
    expect(screen.getByText(/Nothing was sent/)).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.approvals[0]).toMatchObject({ actionType: "Send external message", state: "Pending" });
  });

  it("ignores blank questions", async () => {
    const user = userEvent.setup();
    await renderPage(SecretaryPage, null);
    await user.type(screen.getByLabelText("Ask the AI Secretary"), "   {Enter}");
    expect(screen.queryByText("DATA GAP")).not.toBeInTheDocument();
  });
});

describe("Calendar page", () => {
  it("switches between day, week and marketing views", async () => {
    const user = userEvent.setup();
    await renderPage(CalendarPage, fixtureUserData);
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
  it("lists a chosen file without storing the file, and saves only its name", async () => {
    const user = userEvent.setup();
    await renderPage(DocumentsPage, null);
    await user.upload(screen.getByLabelText(/Choose a file/), new File(["hello"], "notes.xlsx"));
    expect(screen.getAllByText("notes.xlsx").length).toBeGreaterThan(0);
    expect(screen.getByText(/was not uploaded or stored/)).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.documents[0]).toMatchObject({ name: "notes.xlsx", kind: "Spreadsheet" });
    expect(JSON.stringify(saved)).not.toContain("hello");
  });
});

describe("Products page", () => {
  it("explains that the shop is not connected", async () => {
    await renderPage(ProductsPage, null);
    expect(screen.getByText(/Products, prices and stock come from your shop/)).toBeInTheDocument();
  });
});

describe("Reports and Sales with report files", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "kpf-page-"));
    await writeFile(path.join(dir, "Marketing_Report_Aug.docx"), await makeDocx(sampleReportParts("1-31 August 2026")));
    await writeFile(path.join(dir, "Marketing_Report_Sep.docx"), await makeDocx(sampleReportParts("1-30 September 2026")));
    vi.stubEnv("REPORTS_DIR", dir);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("shows the newest report and lets you choose a month", async () => {
    const { container } = await renderPage(ReportsPage, null);
    expect(screen.getByText("Read from your computer")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Marketing Report 1-30 September 2026" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Sales Highlights" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Choose a month" });
    expect(within(nav).getByRole("link", { name: "Sep 2026" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Aug 2026" })).toHaveAttribute("href", "/reports?month=2026-08");
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });

  it("shows the month that was asked for", async () => {
    await renderPage(ReportsPage, null, { searchParams: Promise.resolve({ month: "2026-08" }) });
    expect(screen.getByRole("heading", { name: "Marketing Report 1-31 August 2026" })).toBeInTheDocument();
  });

  it("shows a warning for a report file that cannot be read", async () => {
    await writeFile(path.join(dir, "Marketing_Report_broken.docx"), "not a word file");
    await renderPage(ReportsPage, null);
    expect(screen.getByRole("alert")).toHaveTextContent("Marketing_Report_broken.docx");
  });

  it("Sales page shows the latest report's figures", async () => {
    await renderPage(SalesPage, null);
    expect(screen.getByText("THB 111K")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Sales Highlights" })).toBeInTheDocument();
  });

  it("AI Secretary answers a report question from the files", async () => {
    const user = userEvent.setup();
    await renderPage(SecretaryPage, null);
    await user.click(screen.getByRole("button", { name: "Summarize the latest monthly report" }));
    expect(screen.getAllByText(/TOTAL SALES: THB 111K/).length).toBeGreaterThan(0);
  });
});

describe("Reports page without a report folder", () => {
  it("shows no sample data and explains how to set the folder", async () => {
    await renderPage(ReportsPage, null);
    expect(screen.getByText("No reports found")).toBeInTheDocument();
    expect(screen.getByText(/never committed to GitHub/)).toBeInTheDocument();
  });
});
