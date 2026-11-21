import { isAbsolute } from "node:path";
import { openDatabase } from "../lib/database/sqlite.mjs";

const filename = process.env.SQLITE_PATH;
if (!filename || !isAbsolute(filename)) {
  console.error(
    "Set SQLITE_PATH to an absolute path on the persistent volume.",
  );
  process.exitCode = 1;
} else {
  try {
    const db = openDatabase(filename);
    db.close();
    console.log("SQLite is initialized at the configured path.");
  } catch (error) {
    console.error("SQLite preparation failed:", error.message);
    process.exitCode = 1;
  }
}
