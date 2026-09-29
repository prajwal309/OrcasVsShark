import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/online",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 10000 },
  forbidOnly: !!process.env.CI,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "node tests/support/online-services.mjs",
      url: "http://127.0.0.1:54321/health",
      reuseExistingServer: false,
    },
    {
      command: "npm start -- --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
    },
  ],
});
