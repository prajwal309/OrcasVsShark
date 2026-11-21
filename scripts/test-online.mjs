import { spawnSync } from "node:child_process";
import { isolatedDatabase } from "./test-postgres.mjs";

const database = await isolatedDatabase();
const env = {
  ...process.env,
  BUILD_OUTPUT_DIR: ".next-online",
  GOOGLE_CLIENT_ID: "test-client-id",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  APP_ORIGIN: "http://127.0.0.1:3100",
  REQUIRE_SIGNUP_CODE: "false",
  PRISMA_DATABASE_URL: database.url,
  CRON_SECRET: "test-secret-for-ranked-clock-settlement",
};
try {
  for (const args of [
    ["run", "build"],
    [
      "exec",
      "playwright",
      "test",
      "--",
      "--config",
      "playwright.online.config.ts",
      ...process.argv.slice(2),
    ],
  ]) {
    const result = spawnSync("npm", args, { env, stdio: "inherit" });
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }
} finally {
  await database.drop();
}
