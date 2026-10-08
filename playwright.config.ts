import { defineConfig } from "@playwright/test";

// Runs against a production build. Start it first:  pnpm build && pnpm start -p 3100
export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3100",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" },
  },
});
