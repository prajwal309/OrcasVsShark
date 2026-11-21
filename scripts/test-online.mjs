import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "orcas-online-"));
const env = {
  ...process.env,
  BUILD_OUTPUT_DIR: ".next-online",
  GOOGLE_CLIENT_ID: "test-client-id",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  APP_ORIGIN: "http://127.0.0.1:3100",
  REQUIRE_SIGNUP_CODE: "false",
  SQLITE_PATH: join(directory, "orcas.db"),
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
  rmSync(directory, { recursive: true, force: true });
}
