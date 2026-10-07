// Screen-level checks for the review fixes: no invented values, honest empty states,
// keyboard focus, and safe behaviour when saving fails. Synthetic data only.
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppDataProvider, WhenReady } from "@/components/AppDataProvider";
import { AppShell } from "@/components/AppShell";
import { ApprovalList } from "@/components/ApprovalList";
import { kindFromName } from "@/components/DocumentsBoard";
import { TaskBoard } from "@/components/TaskBoard";
import { CampaignsView } from "@/components/views/CampaignsView";
import { ContentView } from "@/components/views/ContentView";
import { CustomersView } from "@/components/views/CustomersView";
import { MarketingView } from "@/components/views/MarketingView";
import { MeetingsView } from "@/components/views/MeetingsView";
import { ProductsView } from "@/components/views/ProductsView";
import { TodayView } from "@/components/views/TodayView";
import type { ChannelSnapshot } from "@/lib/channels/types";
import { DATA_NOT_AVAILABLE } from "@/lib/constants";
import { STORAGE_KEY, resetUserDataCache } from "@/lib/store/userData";
import type { Product, ShopState, UserData } from "@/lib/types";
import { FIXTURE_TODAY, fixtureUserData, products, tasks } from "./fixtures";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

function renderWith(ui: ReactNode, { user = null, items = [], shop }: { user?: Partial<UserData> | null; items?: Product[]; shop?: ShopState } = {}) {
  localStorage.clear();
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  resetUserDataCache();
  return render(
    <AppDataProvider today={FIXTURE_TODAY} products={items} shop={shop}>
      {ui}
    </AppDataProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetUserDataCache();
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  resetUserDataCache();
});

describe("before this browser's entries are read (server HTML)", () => {
  it("shows a neutral loading line instead of conclusions", () => {
    const html = renderToString(
      <AppDataProvider today={FIXTURE_TODAY}>
        <WhenReady>
          <p>No tasks yet.</p>
        </WhenReady>
      </AppDataProvider>,
    );
    expect(html).toContain("Loading your saved entries…");
    expect(html).not.toContain("No tasks yet.");
  });

  it("the Today page never says 'All clear' or 'Nothing urgent' before the entries are read", () => {
    const html = renderToString(
      <AppDataProvider today={FIXTURE_TODAY}>
        <TodayView channels={[]} />
      </AppDataProvider>,
    );
    expect(html).toContain("Today");
    expect(html).toContain("Loading your saved entries…");
    expect(html).not.toMatch(/All clear|Nothing urgent|No overdue tasks/);
  });
});

describe("saving can fail", () => {
  it("warns on every page when this browser refuses to save, instead of pretending it worked", async () => {
    const user = userEvent.setup();
    renderWith(
      <AppShell>
        <TaskBoard />
      </AppShell>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    await user.click(screen.getByRole("button", { name: /create task/i }));
    await user.type(screen.getByLabelText("Title"), "Synthetic task");
    await user.click(screen.getByRole("button", { name: "Save task" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Your entries could not be saved in this browser");
  });
});

describe("Tasks: editing a task that changes underneath the form", () => {
  const task = { ...tasks.find((t) => t.status !== "Done")!, id: "tsk-synthetic", title: "Synthetic edit task" };

  it("closes the edit form when that task is deleted from its row", async () => {
    const user = userEvent.setup();
    renderWith(<TaskBoard />, { user: { tasks: [task] } });
    await user.click(screen.getByRole("button", { name: new RegExp(`Edit\\s*${task.title}`) }));
    expect(screen.getByRole("button", { name: "Save task" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: new RegExp(`Delete\\s*${task.title}`) }));
    expect(screen.queryByRole("button", { name: "Save task" })).not.toBeInTheDocument();
    expect(screen.getByText("Task deleted. The edit form was closed.")).toBeInTheDocument();
  });

  it("closes the edit form when that task is completed, so Save cannot undo it", async () => {
    const user = userEvent.setup();
    renderWith(<TaskBoard />, { user: { tasks: [task] } });
    await user.click(screen.getByRole("button", { name: new RegExp(`Edit\\s*${task.title}`) }));
    await user.click(screen.getByRole("button", { name: new RegExp(`Complete\\s*${task.title}`) }));
    expect(screen.queryByRole("button", { name: "Save task" })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).tasks[0].status).toBe("Done");
  });

  it("does not crash when another tab deleted the task, and says the change was not saved", async () => {
    const user = userEvent.setup();
    renderWith(<TaskBoard />, { user: { tasks: [task] } });
    await user.click(screen.getByRole("button", { name: new RegExp(`Edit\\s*${task.title}`) }));
    act(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: [] }));
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    });
    await user.click(screen.getByRole("button", { name: "Save task" }));
    expect(screen.getByText("This task was deleted, so the changes were not saved.")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).tasks).toEqual([]);
  });

  it("re-reads storage when another tab clears everything, so old entries do not come back", async () => {
    renderWith(<TaskBoard />, { user: { tasks: [task] } });
    expect(screen.getByRole("cell", { name: task.title })).toBeInTheDocument();
    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(screen.queryByRole("cell", { name: task.title })).not.toBeInTheDocument();
  });

  it("returns focus to the Edit button after Cancel", async () => {
    const user = userEvent.setup();
    renderWith(<TaskBoard />, { user: { tasks: [task] } });
    const edit = screen.getByRole("button", { name: new RegExp(`Edit\\s*${task.title}`) });
    await user.click(edit);
    expect(screen.getByLabelText("Title")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(edit).toHaveFocus();
  });
});

describe("forms and keyboard focus", () => {
  it("moves focus to the first field with an error, and back to the opening button on Cancel", async () => {
    const user = userEvent.setup();
    renderWith(<MeetingsView />);
    const add = screen.getByRole("button", { name: "Add meeting" });
    await user.click(add);
    await user.click(screen.getByRole("button", { name: "Save meeting" }));
    expect(screen.getByLabelText(/^Title/)).toHaveFocus();
    expect(screen.getByLabelText(/^Title/)).toHaveAccessibleDescription("Title is required.");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(add).toHaveFocus();
  });

  it("refuses a meeting that ends when it starts", async () => {
    const user = userEvent.setup();
    renderWith(<MeetingsView />);
    await user.click(screen.getByRole("button", { name: "Add meeting" }));
    await user.type(screen.getByLabelText(/^Title/), "Synthetic meeting");
    const end = screen.getByLabelText(/^End time/);
    await user.clear(end);
    await user.type(end, "09:00");
    await user.click(screen.getByRole("button", { name: "Save meeting" }));
    expect(screen.getByText("End time must be after the start time.")).toBeInTheDocument();
    expect(end).toHaveFocus();
  });

  it("confirms deleting a past meeting", async () => {
    const user = userEvent.setup();
    const past = { ...fixtureUserData.meetings[0], id: "mtg-past", title: "Synthetic past meeting", date: "2026-09-01" };
    renderWith(<MeetingsView />, { user: { meetings: [past] } });
    await user.click(screen.getByRole("button", { name: /Delete\s*Synthetic past meeting/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Meeting deleted.");
  });

  it("starts a new customer issue with no customer chosen, even after a cancelled one", async () => {
    const user = userEvent.setup();
    const customer = fixtureUserData.customers[0];
    renderWith(<CustomersView />, { user: { customers: [customer] } });
    await user.click(screen.getByRole("button", { name: "Record a customer issue" }));
    await user.selectOptions(screen.getByLabelText("Customer (optional)"), customer.name);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Record a customer issue" }));
    expect(screen.getByLabelText("Customer (optional)")).toHaveValue("");
  });
});

describe("approvals", () => {
  it("confirms each decision in a status message that stays after the list empties", async () => {
    const user = userEvent.setup();
    const pending = fixtureUserData.approvals.find((a) => a.state === "Pending")!;
    renderWith(<ApprovalList />, { user: { approvals: [pending] } });
    await user.click(screen.getByRole("button", { name: new RegExp(`Approve\\s*${pending.title}`) }));
    expect(screen.getByRole("status")).toHaveTextContent(`Approved: ${pending.title}. Only the status changed; nothing was sent, published or launched.`);
    expect(screen.getByText("Nothing is waiting for approval.")).toBeInTheDocument();
  });
});

describe("campaigns", () => {
  const base = fixtureUserData.campaigns[0];

  it("shows a missing budget as Data not available, with no 0% progress bar", () => {
    renderWith(<CampaignsView />, { user: { campaigns: [{ ...base, budgetThb: null, spentThb: 5000 }] } });
    const table = screen.getByRole("table", { name: "Campaigns" });
    expect(within(table).getByText(`Budget: ${DATA_NOT_AVAILABLE}`)).toBeInTheDocument();
    expect(within(table).queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows the year in date ranges", () => {
    renderWith(<CampaignsView />, { user: { campaigns: [{ ...base, startDate: "2026-12-15", endDate: "2027-01-10" }] } });
    expect(screen.getByText("15 Dec 2026 - 10 Jan 2027")).toBeInTheDocument();
  });

  it("lists every status in the timeline legend, not only by colour", () => {
    renderWith(<CampaignsView />, { user: { campaigns: [base] } });
    const legend = screen.getByRole("list", { name: "Legend" });
    for (const status of ["Today", "Active", "Planned", "Draft", "Completed", "Paused"]) expect(within(legend).getByText(status)).toBeInTheDocument();
  });

  it("refuses a milestone line it cannot read instead of dropping it", async () => {
    const user = userEvent.setup();
    renderWith(<CampaignsView />);
    await user.click(screen.getByRole("button", { name: "Add campaign" }));
    await user.type(screen.getByLabelText(/^Campaign name/), "Synthetic campaign");
    await user.type(screen.getByLabelText(/^Objective/), "Synthetic objective");
    await user.type(screen.getByLabelText(/^Milestones/), "next week brochure");
    await user.click(screen.getByRole("button", { name: "Save campaign" }));
    expect(screen.getByLabelText(/^Milestones/)).toHaveFocus();
    expect(screen.getByText(/Not readable: "next week brochure"/)).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("honest empty states", () => {
  it("Marketing never tells a new user that nothing needs attention", () => {
    renderWith(<MarketingView channels={[]} />);
    const card = screen.getByRole("region", { name: "Marketing priorities" });
    expect(card).not.toHaveTextContent("Nothing needs attention");
    expect(card).toHaveTextContent(`Stock levels: ${DATA_NOT_AVAILABLE} Shop not connected.`);
  });

  it("Content shows an empty state when connected Facebook and Instagram have no posts", () => {
    const channels: ChannelSnapshot[] = [{ channel: "facebook", label: "Facebook", status: "connected", metrics: [], items: [] }];
    renderWith(<ContentView channels={channels} />);
    expect(screen.getByText("No recent posts were found on the connected channels. Data not available.")).toBeInTheDocument();
  });

  it("Products says the shop could not be read when the connection failed", () => {
    renderWith(<ProductsView />, { shop: { status: "error", message: "The service answered 500." } });
    expect(screen.getByText(/Shop could not be read\. The service answered 500\./)).toBeInTheDocument();
    expect(screen.queryByText(/Shop not connected/)).not.toBeInTheDocument();
  });

  it("Products shows unknown stock units as Data not available and leaves drafts out of the stock counts", () => {
    const items: Product[] = [
      { ...products[0], id: "p1", name: "Synthetic untracked", stockStatus: "Not tracked", stockUnits: null },
      { ...products[0], id: "p2", name: "Synthetic draft", status: "Draft", stockStatus: "Out of stock", stockUnits: 0 },
    ];
    renderWith(<ProductsView />, { items });
    expect(screen.getByText(`Units: ${DATA_NOT_AVAILABLE}`)).toBeInTheDocument();
    expect(screen.getByText("From your shop, 1 draft")).toBeInTheDocument();
    const out = screen.getByText("Out of stock", { selector: "p" }).parentElement!;
    expect(out).toHaveTextContent("0");
    expect(screen.queryByRole("region", { name: "Products requiring marketing attention" })).not.toBeInTheDocument();
  });

  it("Today names the reason in the stock alerts card", () => {
    renderWith(<TodayView channels={[]} />, { user: fixtureUserData, shop: { status: "connected" } });
    const card = screen.getByRole("heading", { name: "Product and stock alerts" }).closest("section")!;
    expect(card).toHaveTextContent(`Shop connected but returned no products. ${DATA_NOT_AVAILABLE}`);
  });
});

describe("documents", () => {
  it.each([
    ["report.pdf", "PDF"],
    ["sheet.XLSX", "Spreadsheet"],
    ["archive.zip", "Other"],
    ["video.mp4", "Other"],
    ["notes.txt", "Other"],
    ["README", "Other"],
  ])("labels %s as %s, never guessing PDF", (name, kind) => {
    expect(kindFromName(name)).toBe(kind);
  });
});
