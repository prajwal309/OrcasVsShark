import { readFileSync } from "node:fs";
import { openDatabase } from "../lib/database/sqlite.mjs";

const tables = new Map([
  ["accounts", "id username password_hash google_subject"],
  ["account_invites", "token_hash expires_at reset_account"],
  ["account_sessions", "token_hash account_id expires_at"],
  ["account_rate_limits", "bucket starts_at hits"],
  [
    "games",
    "code created_by orcas_id sharks_id create_request_id ruleset_version engine_version rated time_control current_ply revision data result orcas_seen sharks_seen created_at updated_at",
  ],
  ["moves", "game_code round ply actor move request_id created_at"],
  ["game_rounds", "game_code round data completed_at"],
  ["room_requests", "game_code actor request_id payload created_at"],
  ["room_rate_limits", "actor bucket starts_at hits"],
  ["matchmaking_queue", "account_id joined_at expires_at room_code"],
]);
const jsonColumns = new Set(["data", "result", "move", "payload"]);

function binding(column, value) {
  if (value === undefined)
    throw new Error("Export is missing a required column.");
  if (value === null) return null;
  if (column.endsWith("_at") || column.endsWith("_seen")) {
    const timestamp = Date.parse(value) / 1000;
    if (!Number.isFinite(timestamp))
      throw new Error("Export contains an invalid timestamp.");
    return timestamp;
  }
  if (jsonColumns.has(column)) return JSON.stringify(value);
  return typeof value === "boolean" ? Number(value) : value;
}

function importExport(source) {
  const lines = readFileSync(source, "utf8").trimEnd().split(/\r?\n/);
  if (lines.shift() !== '"orcas-postgres-v1"' || lines.pop() !== '"end"')
    throw new Error(
      "Expected a complete export from database/export-postgres.sql.",
    );
  const db = openDatabase();
  try {
    db.transaction(() => {
      const inserts = new Map();
      for (const [table, fields] of tables) {
        if (db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get())
          throw new Error("The SQLite destination must be empty.");
        const columns = fields.split(" ");
        const parameters = columns.map(() => "?").join(", ");
        inserts.set(table, {
          columns,
          statement: db.prepare(
            `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${parameters})`,
          ),
        });
      }
      for (const line of lines) {
        const [table, row] = JSON.parse(line);
        const insert = inserts.get(table);
        if (!insert || !row)
          throw new Error("Export contains an invalid record.");
        insert.statement.run(
          ...insert.columns.map((column) => binding(column, row[column])),
        );
      }
    }).immediate();
    return lines.length;
  } finally {
    db.close();
  }
}

if (process.argv.length !== 3) {
  console.error(
    "Run node --env-file-if-exists=.env.local scripts/import-postgres.mjs EXPORT_FILE.",
  );
  process.exitCode = 1;
} else {
  try {
    console.log(
      `Imported ${importExport(process.argv[2])} records into SQLite.`,
    );
  } catch (error) {
    console.error(
      "Import failed. Check the export, destination, and SQLite file permissions.",
    );
    // Only report controlled messages because SQLite errors can contain row data.
    if (!error.code && error.constructor === Error)
      console.error(error.message);
    process.exitCode = 1;
  }
}
