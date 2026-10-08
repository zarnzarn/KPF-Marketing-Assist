import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SecretaryAnswer } from "@/lib/ai/secretary";
import { EMPTY_USER_DATA } from "@/lib/types";
import { FIXTURE_TODAY, tasks } from "./fixtures";

// Synthetic settings only; no network.
const signInWithOtp = vi.fn();
const remoteRow = { data: { ...EMPTY_USER_DATA, tasks: [tasks[0]] } as unknown, failSave: false };
vi.mock("@/lib/supabase/browser", () => ({ browserSupabase: () => ({ auth: { signInWithOtp } }) }));
vi.mock("@/lib/store/remote", () => ({
  supabaseRemote: () => ({
    load: async () => ({ data: remoteRow.data, version: "v1" }),
    save: async () => {
      if (remoteRow.failSave) throw new Error("offline");
      return { ok: true, version: "v2" };
    },
  }),
}));
const askSecretary = vi.fn();
vi.mock("@/app/(app)/secretary/actions", () => ({ askSecretary: (...a: unknown[]) => askSecretary(...a), testOllama: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ refresh: vi.fn() }) }));

const { AppDataProvider } = await import("@/components/AppDataProvider");
const { AppShell } = await import("@/components/AppShell");
const { LoginForm } = await import("@/components/LoginForm");
const { SecretaryChat } = await import("@/components/SecretaryChat");
const { TaskBoard } = await import("@/components/TaskBoard");
const { resetUserDataCache } = await import("@/lib/store/userData");

const settings = { url: "https://synthetic-project.supabase.co", key: "sb_publishable_synthetic" };
const remote = { ...settings, userId: "u1" };

beforeEach(() => {
  // The app follows the computer's date when it is later than the server's, so pin it to the fixture day.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${FIXTURE_TODAY}T05:00:00Z`));
  localStorage.clear();
  resetUserDataCache();
  signInWithOtp.mockReset();
  askSecretary.mockReset();
  remoteRow.failSave = false;
});
afterEach(() => {
  vi.useRealTimers();
  resetUserDataCache();
});

describe("login form", () => {
  it("is accessible and refuses an address that is not an email", async () => {
    const user = userEvent.setup();
    const { container } = render(<LoginForm settings={settings} />);
    expect(await axe(container)).toHaveNoViolations();
    await user.type(screen.getByLabelText("Email address"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Send login link" }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("asks for a link without creating a user, and never says whether the email is allowed", async () => {
    const user = userEvent.setup();
    signInWithOtp.mockResolvedValue({ error: { status: 422, message: "Signups not allowed" } });
    render(<LoginForm settings={settings} />);
    await user.type(screen.getByLabelText("Email address"), "someone@example.com");
    await user.click(screen.getByRole("button", { name: "Send login link" }));
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "someone@example.com", options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` } });
    expect(screen.getByRole("status")).toHaveTextContent("If this email is allowed, a login link is on its way.");
  });

  it("explains when too many links were asked for", async () => {
    const user = userEvent.setup();
    signInWithOtp.mockResolvedValue({ error: { status: 429 } });
    render(<LoginForm settings={settings} />);
    await user.type(screen.getByLabelText("Email address"), "director@example.com");
    await user.click(screen.getByRole("button", { name: "Send login link" }));
    expect(screen.getByText(/Too many login links/)).toBeInTheDocument();
  });
});

describe("online app frame", () => {
  it("loads the account's entries, shows who is logged in, and offers Log out", async () => {
    await act(async () => {
      render(
        <AppDataProvider today={FIXTURE_TODAY} remote={remote}>
          <AppShell signedInAs="director@example.com">
            <TaskBoard />
          </AppShell>
        </AppDataProvider>,
      );
    });
    expect(screen.getByRole("cell", { name: (n) => n === tasks[0].title })).toBeInTheDocument();
    expect(screen.getAllByText("Logged in as director@example.com").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Log out" }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/PROTOTYPE/)).not.toBeInTheDocument();
  });

  it("says when a change could not be saved online", async () => {
    const user = userEvent.setup();
    remoteRow.failSave = true;
    await act(async () => {
      render(
        <AppDataProvider today={FIXTURE_TODAY} remote={remote}>
          <AppShell signedInAs="director@example.com">
            <TaskBoard />
          </AppShell>
        </AppDataProvider>,
      );
    });
    await user.click(screen.getByRole("button", { name: new RegExp(`Delete\\s*${tasks[0].title.replace(/[()]/g, ".")}`) }));
    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent("Your last change is not saved yet");
  });
});

describe("AI Secretary chat", () => {
  const aiAnswer: SecretaryAnswer = { tool: "ai", title: "AI Secretary (Ollama)", blocks: [{ label: "ANALYSIS", text: "Synthetic AI answer." }], sources: [] };

  it("sends free-text questions to the AI model and shows the checked answer", async () => {
    const user = userEvent.setup();
    askSecretary.mockResolvedValue(aiAnswer);
    render(
      <AppDataProvider today={FIXTURE_TODAY}>
        <SecretaryChat aiModel="gemma4:cloud" />
      </AppDataProvider>,
    );
    expect(screen.getByText(/sent to Ollama to write the answer/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Ask the AI Secretary"), "What should I focus on this quarter?");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("Synthetic AI answer.")).toBeInTheDocument();
    expect(askSecretary).toHaveBeenCalledWith("What should I focus on this quarter?", expect.objectContaining({ tasks: expect.any(Array) }), FIXTURE_TODAY);
    // Only the user's entries are sent from the browser; products and channels are read on the server.
    expect(Object.keys(askSecretary.mock.calls[0][1]).sort()).toEqual(["approvals", "campaigns", "content", "customers", "documents", "issues", "meetings", "tasks"]);
  });

  it("answers known questions from the rules, instantly, without the AI model", async () => {
    const user = userEvent.setup();
    render(
      <AppDataProvider today={FIXTURE_TODAY}>
        <SecretaryChat aiModel="gemma4:cloud" />
      </AppDataProvider>,
    );
    await user.click(screen.getByRole("button", { name: "What is overdue?" }));
    expect(askSecretary).not.toHaveBeenCalled();
  });

  it("uses the rules for everything when no AI model is connected", async () => {
    const user = userEvent.setup();
    render(
      <AppDataProvider today={FIXTURE_TODAY}>
        <SecretaryChat />
      </AppDataProvider>,
    );
    expect(screen.getByText(/The AI model is not connected/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Ask the AI Secretary"), "Anything else?");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(askSecretary).not.toHaveBeenCalled();
  });
});
