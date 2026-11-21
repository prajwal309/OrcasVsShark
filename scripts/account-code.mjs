import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

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

const url = process.env.PRISMA_MIGRATION_URL || process.env.PRISMA_DATABASE_URL;
if (!url || !/^postgres(?:ql)?:\/\//.test(url)) {
  console.error(
    "Set PRISMA_MIGRATION_URL or PRISMA_DATABASE_URL to a PostgreSQL connection URL.",
  );
  process.exit(1);
}

const token = randomBytes(32).toString("hex");
const hash = createHash("sha256").update(token).digest("hex");
const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const result =
    operation === "invite"
      ? await client.query(
          "INSERT INTO account_invites VALUES ($1, EXTRACT(EPOCH FROM clock_timestamp()) + 86400, NULL)",
          [hash],
        )
      : await client.query(
          `INSERT INTO account_invites (token_hash, expires_at, reset_account)
         SELECT $1, EXTRACT(EPOCH FROM clock_timestamp()) + 1800, id
         FROM accounts WHERE username = $2 AND password_hash IS NOT NULL`,
          [hash, username.trim().toLowerCase()],
        );
  if (!result.rowCount) {
    console.error("No password account has that username.");
    process.exitCode = 1;
  } else console.log(token);
} catch {
  console.error(
    "Could not issue a code. Check the PostgreSQL connection and migrations.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
