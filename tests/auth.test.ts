// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Synthetic settings and users only.
const auth = {
  getUser: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({ serverSupabase: async () => ({ auth }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

const ONLINE = { NEXT_PUBLIC_SUPABASE_URL: "https://synthetic-project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic", ALLOWED_EMAIL: "director@example.com" };
const stubEnv = (env: Record<string, string>) => Object.entries(env).forEach(([k, v]) => vi.stubEnv(k, v));

beforeEach(() => {
  vi.resetModules();
  Object.values(auth).forEach((f) => f.mockReset());
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "ALLOWED_EMAIL", "VERCEL", "NETLIFY", "SITE_ID", "SITE_NAME"]) vi.stubEnv(k, "");
});
afterEach(() => vi.unstubAllEnvs());

describe("who is using the app (server check)", () => {
  it("runs locally without a login when Supabase is not set up", async () => {
    const { getViewer } = await import("@/lib/auth/session");
    await expect(getViewer()).resolves.toEqual({ mode: "local" });
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("lets nobody in on a host without login settings", async () => {
    vi.stubEnv("VERCEL", "1");
    const { getViewer, requireViewer } = await import("@/lib/auth/session");
    await expect(getViewer()).resolves.toBeNull();
    await expect(requireViewer()).rejects.toThrow("REDIRECT /setup");
  });

  it("lets nobody in on Netlify without login settings", async () => {
    stubEnv({ SITE_ID: "synthetic-site-id", SITE_NAME: "synthetic-site" });
    const { requireViewer } = await import("@/lib/auth/session");
    await expect(requireViewer()).rejects.toThrow("REDIRECT /setup");
  });

  it("lets in the allowed email only", async () => {
    stubEnv(ONLINE);
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "Director@Example.com" } }, error: null });
    const { getViewer } = await import("@/lib/auth/session");
    await expect(getViewer()).resolves.toEqual({ mode: "online", userId: "u1", email: "Director@Example.com" });
  });

  it.each([
    ["a different email", { data: { user: { id: "u2", email: "someone@example.com" } }, error: null }],
    ["no session", { data: { user: null }, error: null }],
    ["an auth error", { data: { user: null }, error: { message: "expired" } }],
  ])("sends %s to the login page", async (_name, answer) => {
    stubEnv(ONLINE);
    auth.getUser.mockResolvedValue(answer);
    const { requireViewer } = await import("@/lib/auth/session");
    await expect(requireViewer()).rejects.toThrow("REDIRECT /login");
  });

  it("asks for setup when ALLOWED_EMAIL is missing online, even for a valid session", async () => {
    stubEnv({ ...ONLINE, ALLOWED_EMAIL: "" });
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "director@example.com" } }, error: null });
    const { requireViewer } = await import("@/lib/auth/session");
    await expect(requireViewer()).rejects.toThrow("REDIRECT /setup");
  });
});

describe("the email-link handler", () => {
  const call = async (query: string) => {
    const { GET } = await import("@/app/auth/callback/route");
    const { NextRequest } = await import("next/server");
    const res = await GET(new NextRequest(`https://app.example.com/auth/callback${query}`));
    return res.headers.get("location");
  };

  it("logs in the allowed user from a ?code= link", async () => {
    stubEnv(ONLINE);
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    auth.getUser.mockResolvedValue({ data: { user: { email: "director@example.com" } } });
    await expect(call("?code=abc")).resolves.toBe("https://app.example.com/");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("logs in from a token_hash link (works on any device)", async () => {
    stubEnv(ONLINE);
    auth.verifyOtp.mockResolvedValue({ error: null });
    auth.getUser.mockResolvedValue({ data: { user: { email: "director@example.com" } } });
    await expect(call("?token_hash=th&type=email")).resolves.toBe("https://app.example.com/");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "th", type: "email" });
  });

  it("signs out anyone else straight away", async () => {
    stubEnv(ONLINE);
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    auth.getUser.mockResolvedValue({ data: { user: { email: "intruder@example.com" } } });
    await expect(call("?code=abc")).resolves.toBe("https://app.example.com/login?error=not-allowed");
    expect(auth.signOut).toHaveBeenCalled();
  });

  it.each([["?code=bad"], ["?token_hash=th&type=signup"], [""]])("refuses an expired, odd or missing link (%s)", async (query) => {
    stubEnv(ONLINE);
    auth.exchangeCodeForSession.mockResolvedValue({ error: { message: "expired" } });
    await expect(call(query)).resolves.toBe("https://app.example.com/login?error=link");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});
