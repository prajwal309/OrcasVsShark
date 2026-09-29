import { spawnSync } from "node:child_process";
// No production bypasses: configure the normal app to use local test services.
const env = {
  ...process.env,
  BUILD_OUTPUT_DIR: ".next-online",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-public-key",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:55432/postgres",
};
for (const args of [
  ["run", "build"],
  [
    "exec",
    "playwright",
    "test",
    "--",
    "--config",
    "playwright.online.config.ts",
  ],
]) {
  const result = spawnSync("npm", args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
