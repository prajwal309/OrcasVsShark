import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });
if (process.env.VERCEL_ENV === "production") {
  execFileSync("npm", ["run", "db:deploy"], { stdio: "inherit" });
}
