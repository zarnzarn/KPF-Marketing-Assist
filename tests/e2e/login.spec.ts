import { expect, test } from "@playwright/test";

// These run against a server started in a special mode (see README "Check it"):
//   E2E_MODE=online: fake Supabase settings, nobody logged in. Every page must send you to /login.
//   E2E_MODE=setup:  NETLIFY=true (or VERCEL=1) without Supabase settings. Every page must show "Setup needed" and no data.
const mode = process.env.E2E_MODE ?? "local";

test.describe("online, not logged in", () => {
  test.skip(mode !== "online", "needs a server started with fake Supabase settings");

  for (const route of ["/", "/reports", "/secretary", "/channels"]) {
    test(`${route} goes to the login page and shows no data`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible();
      await expect(page.getByLabel("Email address")).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    });
  }

  test("the login page explains an expired link", async ({ page }) => {
    await page.goto("/login?error=link");
    await expect(page.getByRole("alert").filter({ hasText: "expired" })).toBeVisible();
  });

  test("the login page fits a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("on a host without login settings", () => {
  test.skip(mode !== "setup", "needs a server started with NETLIFY=true (or VERCEL=1) and no Supabase settings");

  for (const route of ["/", "/reports", "/login"]) {
    test(`${route} shows Setup needed and no data`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/setup$/);
      await expect(page.getByRole("heading", { level: 1, name: "Setup needed" })).toBeVisible();
      await expect(page.getByText("NEXT_PUBLIC_SUPABASE_URL")).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    });
  }
});

test("security headers are sent", async ({ request }) => {
  const res = await request.get(mode === "local" ? "/" : "/login");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
});
