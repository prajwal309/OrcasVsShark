import { spawn } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import { once } from "node:events";
import { expect, test } from "@playwright/test";
import { postgresQuery } from "../../scripts/test-postgres.mjs";

const origin = "https://orcas-vs-shark.vercel.app";

async function startServer(
  databaseUrl = process.env.PRISMA_DATABASE_URL,
  appOrigin = "",
) {
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
        APP_ORIGIN: appOrigin,
        PRISMA_DATABASE_URL: databaseUrl,
        VERCEL: "1",
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: new URL(origin).hostname,
        VERCEL_URL: "deployment-preview.vercel.app",
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
    const post = (route: string, data: object, cookie?: string) =>
      fetch(url + route, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
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

test("public pages and liveness remain available without a configured database", async () => {
  const server = await startServer("");
  try {
    for (const path of [
      "/",
      "/online?account=register",
      "/play",
      "/learn",
      "/api/health",
    ])
      expect((await fetch(server.url + path)).status, path).toBe(200);
    const signup = await fetch(server.url + "/online?account=register");
    expect(await signup.text()).toContain(
      "Online accounts and matches are unavailable on this deployment.",
    );
    expect((await fetch(server.url + "/api/ready")).status).toBe(503);
    expect(
      (
        await server.post("/api/account", {
          action: "login",
          username: "guest",
          password: "test password",
        })
      ).status,
    ).toBe(503);
  } finally {
    await server.stop();
  }
});

test("a Vercel-style restart preserves PostgreSQL accounts, sessions, progress and exactly one ranked result", async () => {
  let server = await startServer();
  try {
    expect((await fetch(server.url + "/api/ready")).status).toBe(200);
    const cookies = [];
    const suffix = randomBytes(4).toString("hex");
    const usernames = [`player_one_${suffix}`, `player_two_${suffix}`];
    for (const username of usernames) {
      const response = await server.post("/api/account", {
        action: "register",
        username,
        email: username + "@example.test",
        password: "restart fixture password",
        confirmPassword: "restart fixture password",
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toContain("Secure");
      cookies.push(response.headers.get("set-cookie")!.split(";")[0]);
    }
    const {
      rows: [player],
    } = await postgresQuery(
      "SELECT id, email, password_hash FROM accounts WHERE username = $1",
      [usernames[0]],
    );
    expect(player.email).toBe(usernames[0] + "@example.test");
    expect(player.password_hash).toMatch(/^\$argon2id\$/);
    const progress = await fetch(server.url + "/api/learn", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: cookies[0],
        "X-Learning-Player": player.id,
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

    const deadline = Date.now() - 1;
    await postgresQuery(
      "UPDATE ranked_matches SET deadline = $1 WHERE game_code = $2",
      [deadline, code],
    );
    server = await startServer(undefined, origin);
    const cronUrl = server.url + "/api/cron/ranked";
    expect((await fetch(cronUrl)).status).toBe(401);
    const settle = () =>
      fetch(cronUrl, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
    const attempts = await Promise.all([settle(), settle()]);
    expect(attempts.map(({ status }) => status)).toEqual([200, 200]);
    const { rows: results } = await postgresQuery(
      "SELECT winner, reason, ended_at FROM ranked_matches WHERE game_code = $1",
      [code],
    );
    expect(results).toEqual([
      { winner: "sharks", reason: "Time expired", ended_at: deadline },
    ]);

    const account = await fetch(server.url + "/api/account", {
      headers: { Cookie: cookies[0] },
    });
    expect(await account.json()).toEqual({ username: usernames[0] });
    const room = await fetch(server.url + route, {
      headers: { Cookie: sharks },
    }).then((response) => response.json());
    expect(room.state.ply).toBe(1);
    expect(room.state.board.c3).toBe("shark");
    expect(room.ending).toEqual({ winner: "sharks", reason: "Time expired" });
    const { rows: stats } = await postgresQuery(
      "SELECT lessons_completed FROM learning_stats WHERE player_id = $1",
      [player.id],
    );
    expect(stats).toEqual([{ lessons_completed: 1 }]);
    const { rows: ratings } = await postgresQuery(
      `SELECT rating, wins, losses, total_games FROM player_ratings
       WHERE mode = 'fast' AND player_id IN (SELECT id FROM accounts WHERE username IN ($1, $2))
       ORDER BY rating DESC`,
      usernames,
    );
    expect(ratings).toEqual([
      { rating: 1516, wins: 1, losses: 0, total_games: 1 },
      { rating: 1484, wins: 0, losses: 1, total_games: 1 },
    ]);
    const { rows: rounds } = await postgresQuery(
      "SELECT round FROM game_rounds WHERE game_code = $1",
      [code],
    );
    expect(rounds).toEqual([{ round: 1 }]);
  } finally {
    await server.stop();
  }
});
