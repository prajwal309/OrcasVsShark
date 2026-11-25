import { defineConfig, devices } from "@playwright/test";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "tablet",
      testMatch: "landing.spec.ts",
      use: { ...devices["iPad (gen 7)"], defaultBrowserType: "chromium" },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${new URL(baseURL).port || "3000"}`,
    url: baseURL,
    env: {
      PRISMA_DATABASE_URL: "",
      APP_ORIGIN: new URL(baseURL).origin,
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
