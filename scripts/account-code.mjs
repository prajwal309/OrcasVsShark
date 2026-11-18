import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

const [operation, username, extra] = process.argv.slice(2);
if (
  extra ||
  (operation !== "invite" && operation !== "reset") ||
  (operation === "reset" ? !username : username) ||
  !process.env.DATABASE_URL
) {
  console.error(
    "Set DATABASE_URL and run npm run account:code -- invite or npm run account:code -- reset USERNAME.",
  );
  process.exit(1);
}

const token = randomBytes(32).toString("hex");
const hash = createHash("sha256").update(token).digest("hex");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await db.connect();
  const result =
    operation === "invite"
      ? await db.query(
          "INSERT INTO account_invites VALUES ($1, now() + interval '24 hours', NULL)",
          [hash],
        )
      : await db.query(
          `INSERT INTO account_invites SELECT $1, now() + interval '30 minutes', id
         FROM accounts WHERE username = $2 AND password_hash IS NOT NULL`,
          [hash, username.trim().toLowerCase()],
        );
  if (!result.rowCount) {
    console.error("No password account has that username.");
    process.exitCode = 1;
  } else console.log(token);
} catch {
  console.error(
    "Could not issue a code. Check DATABASE_URL and the database migration.",
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
