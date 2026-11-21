import { createHash, randomBytes } from "node:crypto";
import { openDatabase } from "../lib/database/sqlite.mjs";

const [operation, username, extra] = process.argv.slice(2);
if (
  extra ||
  (operation !== "invite" && operation !== "reset") ||
  (operation === "reset" ? !username : username)
) {
  console.error(
    "Run npm run account:code -- invite or npm run account:code -- reset USERNAME.",
  );
  process.exit(1);
}

const token = randomBytes(32).toString("hex");
const hash = createHash("sha256").update(token).digest("hex");
let db;
try {
  db = openDatabase();
  const result =
    operation === "invite"
      ? db
          .prepare(
            "INSERT INTO account_invites VALUES (?, unixepoch('subsec') + 86400, NULL)",
          )
          .run(hash)
      : db
          .prepare(
            `INSERT INTO account_invites (token_hash, expires_at, reset_account)
           SELECT ?, unixepoch('subsec') + 1800, id
           FROM accounts WHERE username = ? AND password_hash IS NOT NULL`,
          )
          .run(hash, username.trim().toLowerCase());
  if (!result.changes) {
    console.error("No password account has that username.");
    process.exitCode = 1;
  } else console.log(token);
} catch {
  console.error(
    "Could not issue a code. Check the SQLite path and file permissions.",
  );
  process.exitCode = 1;
} finally {
  db?.close();
}
