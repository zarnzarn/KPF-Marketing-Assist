import { describe, expect, it } from "vitest";
import { allowedEmail, isAllowedEmail, isOnline, onHost, setupProblem, supabaseSettings } from "@/lib/mode";
import { isPublicPath } from "@/proxy";

// Synthetic settings only.
const ONLINE = { NEXT_PUBLIC_SUPABASE_URL: "https://synthetic-project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic", ALLOWED_EMAIL: "Director@Example.com" };

describe("mode", () => {
  it("is local without Supabase settings, and online with both", () => {
    expect(isOnline({})).toBe(false);
    expect(isOnline({ NEXT_PUBLIC_SUPABASE_URL: ONLINE.NEXT_PUBLIC_SUPABASE_URL })).toBe(false);
    expect(supabaseSettings(ONLINE)).toEqual({ url: "https://synthetic-project.supabase.co", key: "sb_publishable_synthetic" });
  });

  it("accepts the older anon key name and tidies quotes and a trailing slash", () => {
    expect(supabaseSettings({ NEXT_PUBLIC_SUPABASE_URL: ' "https://x.supabase.co/" ', NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" })).toEqual({ url: "https://x.supabase.co", key: "anon" });
  });

  it("never goes online with a non-https or odd address", () => {
    for (const url of ["http://x.supabase.co", "x.supabase.co", "https://x.supabase.co/path", "https://"]) expect(isOnline({ ...ONLINE, NEXT_PUBLIC_SUPABASE_URL: url })).toBe(false);
  });

  it("lets in only the one allowed email, in any letter case, and nobody when it is not set", () => {
    expect(allowedEmail(ONLINE)).toBe("director@example.com");
    expect(isAllowedEmail(" DIRECTOR@example.com ", ONLINE)).toBe(true);
    expect(isAllowedEmail("someone@example.com", ONLINE)).toBe(false);
    expect(isAllowedEmail(undefined, ONLINE)).toBe(false);
    expect(isAllowedEmail("director@example.com", { ...ONLINE, ALLOWED_EMAIL: "" })).toBe(false);
  });

  it("asks for setup on a host without login settings, or online without ALLOWED_EMAIL", () => {
    expect(setupProblem({})).toBeNull();
    expect(setupProblem({ VERCEL: "1" })).toBe("supabase");
    expect(setupProblem({ ...ONLINE, ALLOWED_EMAIL: "" })).toBe("allowed-email");
    expect(setupProblem({ ...ONLINE, VERCEL: "1" })).toBeNull();
    expect(setupProblem({ NETLIFY: "true" })).toBe("supabase");
    expect(setupProblem({ SITE_ID: "synthetic-site-id", SITE_NAME: "synthetic-site" })).toBe("supabase");
    expect(setupProblem({ ...ONLINE, SITE_ID: "synthetic-site-id", SITE_NAME: "synthetic-site" })).toBeNull();
  });

  it("knows when it runs on Netlify or Vercel, and not on your own computer", () => {
    expect(onHost({})).toBe(false);
    expect(onHost({ VERCEL: "1" })).toBe(true);
    expect(onHost({ NETLIFY: "true" })).toBe(true);
    expect(onHost({ SITE_ID: "synthetic-site-id", SITE_NAME: "synthetic-site" })).toBe(true);
    expect(onHost({ SITE_ID: "synthetic-site-id" })).toBe(false);
    expect(onHost({ VERCEL: "0", NETLIFY: "false", SITE_ID: " ", SITE_NAME: "" })).toBe(false);
  });

  it("only the login, email-link and setup pages are public", () => {
    for (const p of ["/login", "/setup", "/auth/callback"]) expect(isPublicPath(p)).toBe(true);
    for (const p of ["/", "/reports", "/loginx", "/setup/x", "/authx", "/channels"]) expect(isPublicPath(p)).toBe(false);
  });
});
