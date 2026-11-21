import type Database from "better-sqlite3";
import { openDatabase } from "./sqlite.mjs";

export interface SqlClient {
  query<T = unknown>(
    sql: string,
    values?: (string | number | null)[],
  ): { rows: T[]; rowCount: number };
}

const runtime = globalThis as typeof globalThis & {
  orcasDatabase?: Database.Database;
};

export function database() {
  return (runtime.orcasDatabase ??= openDatabase());
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

// Acquire the write lock before reading the state that determines a mutation.
export function transaction<T>(
  work: (client: SqlClient) => T extends PromiseLike<unknown> ? never : T,
): T {
  const db = database();
  return db.transaction(() => work(sqlClient(db))).immediate();
}
