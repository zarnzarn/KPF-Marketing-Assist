import { expect, test } from "@playwright/test";

const routes = ["/", "/secretary", "/marketing", "/sales", "/products", "/customers", "/tasks", "/calendar", "/meetings", "/campaigns", "/content", "/reports", "/documents", "/channels"];
const sizes = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "phone", width: 390, height: 844 },
];

for (const size of sizes) {
  for (const route of routes) {
    test(`${route} fits the ${size.name} screen without page-level horizontal scroll`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);
    });
  }
}

test("keyboard: skip link is the first tab stop and reaches main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("phone: menu opens and navigates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Sales" }).click();
  await expect(page).toHaveURL(/\/sales$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sales" })).toBeVisible();
});
