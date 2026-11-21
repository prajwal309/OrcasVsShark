// These tests launch production Node processes against dedicated SQLite files.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test } from "@playwright/test";
import { openDatabase } from "../../lib/database/sqlite.mjs";

const httpsOrigin = "https://play.example.test";

async function startServer(
  filename: string,
  options: { vercel?: boolean; https?: boolean } = {},
) {
  const origin = options.https ? httpsOrigin : "http://localhost:3000";
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "0",
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        APP_ORIGIN: origin,
        SQLITE_PATH: filename,
        VERCEL: options.vercel ? "1" : "",
        VERCEL_ENV: "",
        ORCAS_DISABLE_SQLITE: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    output += String(chunk);
  });
  async function stop() {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
  }
  try {
    const address = () =>
      output.match(/Local:\s*(http:\/\/127\.0\.0\.1:\d+)/)?.[1];
    await expect.poll(address).toBeTruthy();
    const url = address()!;
    await expect
      .poll(() =>
        fetch(url + "/api/health")
          .then((response) => response.status)
          .catch(() => 0),
      )
      .toBe(200);
    const post = (route: string, data: object, cookie?: string) =>
      fetch(url + route, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: options.https ? origin : url,
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify(data),
      });
    return { url, post, stop };
  } catch (error) {
    await stop();
    throw new Error(`Production server failed to start:\n${output}`, {
      cause: error,
    });
  }
}

test("Vercel keeps public pages and liveness available without creating SQLite", async () => {
  const dir = mkdtempSync(join(tmpdir(), "orcas-vercel-"));
  const filename = join(dir, "data", "orcas.db");
  const server = await startServer(filename, { vercel: true });
  try {
    for (const path of ["/", "/online", "/play", "/learn", "/api/health"])
      expect((await fetch(server.url + path)).status, path).toBe(200);
    // A cookie from another deployment must not turn the guest Academy into a 500.
    expect(
      (
        await fetch(server.url + "/learn", {
          headers: { Cookie: `orcas_session=${"a".repeat(64)}` },
        })
      ).status,
    ).toBe(200);
    const leaders = await fetch(server.url + "/leaderboards");
    expect(leaders.status).toBe(200);
    expect(await leaders.text()).toContain(
      "Ranked leaderboards are temporarily unavailable.",
    );
    const readiness = await fetch(server.url + "/api/ready");
    expect(readiness.status).toBe(503);
    const login = await server.post("/api/account", {
      action: "login",
      username: "existing_player",
      password: "test password",
    });
    expect(login.status).toBe(503);
    expect(await login.json()).toMatchObject({ code: "DATABASE_UNAVAILABLE" });
    expect(existsSync(join(dir, "data"))).toBe(false);
  } finally {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an unusable production SQLite path leaves liveness and local play available", async () => {
  const dir = mkdtempSync(join(tmpdir(), "orcas-unavailable-"));
  const blocker = join(dir, "not-a-directory");
  writeFileSync(blocker, "sentinel");
  const server = await startServer(join(blocker, "orcas.db"), { https: true });
  try {
    expect((await fetch(server.url + "/api/ready")).status).toBe(503);
    expect((await fetch(server.url + "/api/health")).status).toBe(200);
    expect((await fetch(server.url + "/play")).status).toBe(200);
    expect((await fetch(server.url + "/players/existing_player")).status).toBe(
      200,
    );
  } finally {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("HTTPS production does not create an empty database when the mounted file is missing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "orcas-unprepared-"));
  const filename = join(dir, "missing.db");
  const server = await startServer(filename, { https: true });
  try {
    expect((await fetch(server.url + "/api/ready")).status).toBe(503);
    expect(existsSync(filename)).toBe(false);
  } finally {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a restart preserves sessions, progress, a live room and exactly one ranked timeout", async () => {
  const dir = mkdtempSync(join(tmpdir(), "orcas-restart-"));
  const filename = join(dir, "orcas.db");
  const db = openDatabase(filename);
  let server: Awaited<ReturnType<typeof startServer>> | undefined;
  try {
    server = await startServer(filename, { https: true });
    expect((await fetch(server.url + "/api/ready")).status).toBe(200);
    const cookies = [];
    for (const username of ["player_one", "player_two"]) {
      const response = await server.post("/api/account", {
        action: "register",
        username,
        password: "restart fixture password",
        confirmPassword: "restart fixture password",
      });
      expect(response.status).toBe(200);
      cookies.push(response.headers.get("set-cookie")!.split(";")[0]);
    }
    const firstPlayer = db
      .prepare("SELECT id FROM accounts WHERE username = 'player_one'")
      .pluck()
      .get() as string;
    const progress = await fetch(server.url + "/api/learn", {
      method: "POST",
      headers: {
        Origin: httpsOrigin,
        "Content-Type": "application/json",
        Cookie: cookies[0],
        "X-Learning-Player": firstPlayer,
      },
      body: JSON.stringify({
        id: randomUUID(),
        action: "attempt",
        kind: "lesson",
        activityId: "meet-the-sides",
        answer: "+c3",
        opening: null,
        seconds: 1,
      }),
    });
    expect(progress.status).toBe(200);
    expect(
      (
        await server.post(
          "/api/matchmaking",
          { action: "enter", mode: "fast" },
          cookies[0],
        )
      ).status,
    ).toBe(200);
    const paired = await server.post(
      "/api/matchmaking",
      { action: "enter", mode: "fast" },
      cookies[1],
    );
    expect(paired.status).toBe(200);
    const { code } = await paired.json();
    const route = "/api/rooms/" + code;
    const initial = await fetch(server.url + route, {
      headers: { Cookie: cookies[0] },
    }).then((response) => response.json());
    const sharks = initial.side === "sharks" ? cookies[0] : cookies[1];
    const move = await server.post(
      route,
      {
        action: { kind: "move", move: { kind: "place", to: "c3" } },
        requestId: randomUUID(),
        expectedPly: initial.state.ply,
        expectedRevision: initial.revision,
      },
      sharks,
    );
    expect(move.status).toBe(200);
    await server.stop();

    // Move the fixture deadline forward a few milliseconds while the service
    // is down, so the restart test does not need to wait three minutes.
    const deadline = Date.now() + 50;
    db.prepare(
      "UPDATE ranked_matches SET deadline = ? WHERE game_code = ?",
    ).run(deadline, code);
    await delay(75);
    server = await startServer(filename, { https: true });
    expect((await fetch(server.url + "/api/ready")).status).toBe(200);
    const result = db.prepare(
      "SELECT winner, reason, ended_at FROM ranked_matches WHERE game_code = ?",
    );
    // Poll SQLite rather than the room API to prove the worker settles it.
    await expect
      .poll(() => result.get(code))
      .toEqual({
        winner: "sharks",
        reason: "Time expired",
        ended_at: deadline,
      });
    const account = await fetch(server.url + "/api/account", {
      headers: { Cookie: cookies[0] },
    });
    expect(await account.json()).toEqual({ username: "player_one" });
    const room = await fetch(server.url + route, {
      headers: { Cookie: sharks },
    }).then((response) => response.json());
    expect(room.state.ply).toBe(1);
    expect(room.state.board.c3).toBe("shark");
    expect(room.ending).toEqual({ winner: "sharks", reason: "Time expired" });
    expect(
      db
        .prepare(
          "SELECT lessons_completed FROM learning_stats WHERE player_id = ?",
        )
        .pluck()
        .get(firstPlayer),
    ).toBe(1);

    await server.stop();
    server = await startServer(filename, { https: true });
    expect((await fetch(server.url + "/api/ready")).status).toBe(200);
    expect(
      db
        .prepare(
          "SELECT rating, wins, losses FROM player_ratings WHERE mode = 'fast' ORDER BY rating DESC",
        )
        .all(),
    ).toEqual([
      { rating: 1516, wins: 1, losses: 0 },
      { rating: 1484, wins: 0, losses: 1 },
    ]);
    expect(
      db
        .prepare("SELECT COUNT(*) FROM game_rounds WHERE game_code = ?")
        .pluck()
        .get(code),
    ).toBe(1);
  } finally {
    await server?.stop();
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
