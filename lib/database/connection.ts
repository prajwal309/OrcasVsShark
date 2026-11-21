import type Database from "better-sqlite3";
import { isAbsolute } from "node:path";
import {
  appOrigin,
  onlineUnavailableMessage,
  sqliteDisabled,
} from "@/lib/deployment";
import { openDatabase } from "./sqlite.mjs";

export interface SqlClient {
  query<T = unknown>(
    sql: string,
    values?: (string | number | null)[],
  ): { rows: T[]; rowCount: number };
}

const runtime = globalThis as typeof globalThis & {
  orcasDatabase?: Database.Database;
  orcasDatabaseErrorReported?: boolean;
};

export class DatabaseUnavailableError extends Error {
  constructor(
    cause?: unknown,
    message = "Online services are temporarily unavailable.",
  ) {
    super(message, { cause });
    this.name = "DatabaseUnavailableError";
  }
}

export function requireDatabaseRuntime() {
  if (sqliteDisabled())
    throw new DatabaseUnavailableError(undefined, onlineUnavailableMessage);
}

export function database() {
  requireDatabaseRuntime();
  if (runtime.orcasDatabase) return runtime.orcasDatabase;
  try {
    const production =
      process.env.NODE_ENV === "production" &&
      appOrigin().protocol === "https:";
    const filename = process.env.SQLITE_PATH;
    if (production && (!filename || !isAbsolute(filename)))
      throw new Error(
        "An absolute SQLITE_PATH on a persistent volume is required for HTTPS production.",
      );
    const db = openDatabase(filename || undefined, { create: !production });
    runtime.orcasDatabase = db;
    runtime.orcasDatabaseErrorReported = false;
    return db;
  } catch (error) {
    if (!runtime.orcasDatabaseErrorReported) {
      console.error("SQLite unavailable", error);
      runtime.orcasDatabaseErrorReported = true;
    }
    throw new DatabaseUnavailableError(error);
  }
}

export function sqlClient(db: Database.Database): SqlClient {
  return {
    query<T>(sql: string, values: (string | number | null)[] = []) {
      const statement = db.prepare<Record<string, string | number | null>, T>(
        sql,
      );
      const bindings = Object.fromEntries(
        values.map((value, index) => [index + 1, value]),
      );
      if (statement.reader) {
        const rows = statement.all(bindings);
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: statement.run(bindings).changes };
    },
  };
}

// Read-only queries can use WAL snapshots without acquiring a writer lock.
export function read<T>(work: (client: SqlClient) => T): T {
  return work(sqlClient(database()));
}

export function readIfAvailable<T>(
  work: (client: SqlClient) => T,
): T | undefined {
  try {
    return read(work);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
  }
}

// Acquire the write lock before reading the state that determines a mutation.
export function transaction<T>(
  work: (client: SqlClient) => T extends PromiseLike<unknown> ? never : T,
): T {
  const db = database();
  return db.transaction(() => work(sqlClient(db))).immediate();
}
