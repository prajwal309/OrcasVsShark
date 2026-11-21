import Database from "better-sqlite3";
import {
  closeSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";

function keepDatabasePrivate(filename) {
  const publicDirectory = resolve("public");
  if (
    filename === publicDirectory ||
    filename.startsWith(publicDirectory + sep)
  )
    throw new Error("SQLITE_PATH must be outside the public directory.");
}

export function openDatabase(
  filename = process.env.SQLITE_PATH || "data/orcas.db",
  { create = true } = {},
) {
  if (filename !== ":memory:") {
    filename = resolve(filename);
    keepDatabasePrivate(filename);
    if (create) {
      mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
      keepDatabasePrivate(
        resolve(realpathSync(dirname(filename)), basename(filename)),
      );
      closeSync(openSync(filename, "a", 0o600));
    }
    filename = realpathSync(filename);
    keepDatabasePrivate(filename);
  }
  const db = new Database(filename, { timeout: 5000, fileMustExist: !create });
  try {
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");
    db.pragma("recursive_triggers = ON");

    const directory = resolve("database/sqlite");
    const migrations = readdirSync(directory)
      .filter((name) => /^\d{3}_.*\.sql$/.test(name))
      .sort();
    function schemaVersion() {
      return db.pragma("user_version", { simple: true });
    }
    if (!migrations.length) throw new Error("SQLite migrations are missing.");
    const latest = migrations.length;
    const installed = schemaVersion();
    if (installed > latest)
      throw new Error("SQLite schema is newer than this app.");
    if (installed < latest) {
      db.transaction(() => {
        const version = schemaVersion();
        for (const [index, file] of migrations.entries()) {
          const next = index + 1;
          if (Number(file.slice(0, 3)) !== next)
            throw new Error("SQLite migration numbers must be consecutive.");
          if (next <= version) continue;
          db.exec(readFileSync(resolve(directory, file), "utf8"));
          db.pragma(`user_version = ${next}`);
        }
      }).immediate();
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
