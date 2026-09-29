// Test-only Supabase Auth/Realtime protocol fixture. Never imported by the app.
// The real Next API and pg transaction code run against a fresh PostgreSQL WASM DB.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { Pool } from "pg";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const database = await PGlite.create();
await database.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE PUBLICATION supabase_realtime;`);
await database.exec(
  readFileSync("supabase/migrations/202609280001_online_rooms.sql", "utf8"),
);
const sql = new PGLiteSocketServer({
  db: database,
  host: "127.0.0.1",
  port: 55432,
  maxConnections: 8,
});
await sql.start();
const pool = new Pool({
  connectionString: "postgresql://postgres:postgres@127.0.0.1:55432/postgres",
  max: 2,
});
// PGlite multiplexes one engine connection. Hold a transaction for each fixture
// query so extended-query Parse/Bind messages cannot cross another connection.
async function query(text, values) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(text, values);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
const sessions = new Map();
const server = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3100");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  );
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Content-Type", "application/json");
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }
  if (request.url === "/health") {
    response.end("{}");
    return;
  }
  if (request.url?.startsWith("/auth/v1/signup") && request.method === "POST") {
    const id = randomUUID();
    await query("INSERT INTO auth.users VALUES ($1)", [id]);
    const user = {
      id,
      aud: "authenticated",
      role: "authenticated",
      is_anonymous: true,
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    };
    const part = (value) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })}.test-signature`;
    const session = {
      access_token: token,
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: randomUUID(),
      user,
    };
    sessions.set(token, session);
    response.end(JSON.stringify(session));
    return;
  }
  if (request.url === "/auth/v1/user") {
    const session = sessions.get(
      request.headers.authorization?.replace(/^Bearer /, ""),
    );
    if (session) response.end(JSON.stringify(session.user));
    else
      response.writeHead(401).end(JSON.stringify({ message: "Invalid token" }));
    return;
  }
  response.writeHead(404).end("{}");
});
const sockets = new WebSocketServer({ server });
sockets.on("connection", (socket) => {
  const subscriptions = new Map();
  const emit = (message) =>
    socket.send(
      JSON.stringify([
        message.join_ref ?? null,
        message.ref ?? null,
        message.topic,
        message.event,
        message.payload,
      ]),
    );
  socket.on("message", (raw) => {
    const packet = JSON.parse(raw.toString());
    const message = Array.isArray(packet)
      ? {
          join_ref: packet[0],
          ref: packet[1],
          topic: packet[2],
          event: packet[3],
          payload: packet[4],
        }
      : packet;
    if (message.event === "phx_join") {
      const config = message.payload.config?.postgres_changes ?? [];
      subscriptions.set(message.topic, {
        config,
        token: message.payload.access_token,
        revision: -1,
      });
      emit({
        topic: message.topic,
        event: "phx_reply",
        ref: message.ref,
        payload: {
          status: "ok",
          response: {
            postgres_changes: config.map((filter, id) => ({
              ...filter,
              id: id + 1,
            })),
          },
        },
      });
    } else if (message.event === "heartbeat" || message.event === "phx_leave") {
      if (message.event === "phx_leave") subscriptions.delete(message.topic);
      emit({
        topic: message.topic,
        event: "phx_reply",
        ref: message.ref,
        payload: { status: "ok", response: {} },
      });
    } else if (message.event === "access_token") {
      const entry = subscriptions.get(message.topic);
      if (entry) entry.token = message.payload.access_token;
    }
  });
  let checking = false;
  const interval = setInterval(async () => {
    if (checking) return;
    checking = true;
    try {
      for (const [topic, subscription] of subscriptions) {
        const actor = sessions.get(subscription.token)?.user.id;
        const code = subscription.config[0]?.filter?.replace("code=eq.", "");
        if (!actor || !code) continue;
        const { rows } = await query(
          "SELECT code, revision FROM games WHERE code=$1 AND $2 IN (orcas_id, sharks_id)",
          [code, actor],
        );
        const row = rows[0];
        if (!row || row.revision <= subscription.revision) continue;
        subscription.revision = row.revision;
        if (socket.readyState === socket.OPEN)
          emit({
            topic,
            event: "postgres_changes",
            payload: {
              ids: [1],
              data: {
                schema: "public",
                table: "games",
                type: "UPDATE",
                commit_timestamp: new Date().toISOString(),
                columns: [],
                record: row,
                old_record: {},
                errors: null,
              },
            },
          });
      }
    } finally {
      checking = false;
    }
  }, 100);
  socket.on("close", () => clearInterval(interval));
});
server.listen(54321, "127.0.0.1");
async function stop() {
  for (const socket of sockets.clients) socket.terminate();
  server.close();
  await pool.end();
  await sql.stop();
  await database.close();
  process.exit(0);
}
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
