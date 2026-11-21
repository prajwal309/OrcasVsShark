import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const directory = mkdtempSync(join(tmpdir(), "orcas-e2e-"));
process.once("exit", () => rmSync(directory, { recursive: true, force: true }));
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
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${new URL(baseURL).port || "3000"}`,
    url: baseURL,
    env: {
      SQLITE_PATH: join(directory, "orcas.db"),
      APP_ORIGIN: new URL(baseURL).origin,
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
