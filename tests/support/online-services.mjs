// Expose a fresh PostgreSQL-compatible test database over the wire protocol.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const database = await PGlite.create();
await database.exec("CREATE ROLE orcas_app");
await database.exec(
  readFileSync("database/migrations/001_multiplayer.sql", "utf8"),
);
await database.exec(
  readFileSync("database/migrations/002_matchmaking.sql", "utf8"),
);
await database.exec(
  readFileSync("database/migrations/003_google_accounts.sql", "utf8"),
);
const sql = new PGLiteSocketServer({
  db: database,
  host: "127.0.0.1",
  port: 55432,
  maxConnections: 8,
});
await sql.start();
const server = createServer((request, response) => {
  response.writeHead(request.url === "/health" ? 200 : 404).end();
});
server.listen(54321, "127.0.0.1");
async function stop() {
  server.close();
  await sql.stop();
  await database.close();
}
process.once("SIGTERM", () => void stop());
process.once("SIGINT", () => void stop());
