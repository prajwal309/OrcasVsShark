import { createHash, randomBytes } from "node:crypto";
import { openDatabase } from "../../lib/database/sqlite.mjs";
import { test, expect, type Page } from "@playwright/test";
import type { RoomRequest, RoomView } from "../../lib/multiplayer/protocol";
import type { Move } from "../../lib/game/types";
import victories from "../fixtures/victories.json" with { type: "json" };

const node = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name},`) });
async function api(page: Page, code: string, body?: RoomRequest) {
  return page.evaluate(
    async ({ code, body }) => {
      const response = await fetch(`/api/rooms/${code}`, {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, data: await response.json() };
    },
    { code, body },
  );
}
const action = (room: RoomView, move: Move): RoomRequest => ({
  requestId: crypto.randomUUID(),
  expectedPly: room.state.ply,
  expectedRevision: room.revision,
  action: { kind: "move", move },
});
const password = "a test-only long password";

const origin = "http://127.0.0.1:3100";

function withDatabase<T>(work: (db: ReturnType<typeof openDatabase>) => T): T {
  if (!process.env.SQLITE_PATH) throw new Error("Run npm run test:online.");
  const db = openDatabase(process.env.SQLITE_PATH);
  try {
    return work(db);
  } finally {
    db.close();
  }
}

function issueResetCode(username: string) {
  const token = randomBytes(32).toString("hex");
  withDatabase((db) =>
    db
      .prepare(
        `INSERT INTO account_invites
     SELECT ?, unixepoch('subsec') + 3600, id FROM accounts WHERE username = ?`,
      )
      .run(createHash("sha256").update(token).digest("hex"), username),
  );
  return token;
}

function issueSignupCode() {
  const token = randomBytes(32).toString("hex");
  withDatabase((db) =>
    db
      .prepare(
        "INSERT INTO account_invites VALUES (?, unixepoch('subsec') + 3600, NULL)",
      )
      .run(createHash("sha256").update(token).digest("hex")),
  );
  return token;
}

test.beforeEach(() => {
  withDatabase((db) => db.prepare("DELETE FROM account_rate_limits").run());
});

async function register(page: Page) {
  const username = `player_${randomBytes(6).toString("hex")}`;
  await page.goto("/online");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(
    page.getByRole("heading", { name: "Create a player account" }),
  ).toBeVisible();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(`Signed in as ${username}`)).toBeVisible();
  return username;
}

async function openMatch(host: Page, guest: Page) {
  await register(host);
  await register(guest);
  await host.getByRole("button", { name: "Create Game", exact: true }).click();
  await expect(
    host.getByText("Waiting for opponent", { exact: true }),
  ).toBeVisible();
  const code = host.url().split("/").at(-1)!;
  await guest.goto(`/game/${code}`);
  await guest.getByRole("button", { name: "Join Game", exact: true }).click();
  await expect(
    guest.getByRole("region", { name: "Online room" }),
  ).toContainText("You are Sharks");
  await expect(host.getByRole("region", { name: "Online room" })).toContainText(
    "You are Orcas",
  );
  await expect(
    host.getByRole("status").filter({ hasText: "Opponent’s turn" }),
  ).toBeVisible();
  return code;
}

test("two browsers synchronize, enforce seats, recover refresh/offline, draw and rematch", async ({
  page,
  browser,
}) => {
  const other = await browser.newContext();
  const guest = await other.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  guest.on("pageerror", (error) => errors.push(error.message));
  const code = await openMatch(page, guest);
  let room: RoomView = (await api(guest, code)).data;
  const move = action(room, { kind: "place", to: "c3" });
  expect((await api(page, code, move)).status).toBe(403);
  expect(
    (
      await api(
        guest,
        code,
        action(room, { kind: "step", from: "a1", to: "a2" }),
      )
    ).status,
  ).toBe(422);
  expect(
    (await api(guest, code, action(room, { kind: "place", to: "a1" }))).status,
  ).toBe(422);
  await node(page, "c3").click();
  await expect(node(page, "c3")).toHaveAttribute("aria-label", "c3, empty");
  // Keyboard-only placement by the Sharks player.
  await node(guest, "c3").focus();
  await guest.keyboard.press("Enter");
  await expect(node(page, "c3")).toHaveAttribute("aria-label", "c3, shark", {
    timeout: 3000,
  });
  expect(
    (
      await api(
        page,
        code,
        action(room, { kind: "step", from: "a1", to: "a2" }),
      )
    ).status,
  ).toBe(409);
  await node(page, "a1").click();
  await node(page, "a2").click();
  await expect(node(guest, "a2")).toHaveAttribute("aria-label", "a2, orca", {
    timeout: 3000,
  });
  room = (await api(guest, code)).data;
  const duplicate = action(room, { kind: "place", to: "b2" });
  expect((await api(guest, code, duplicate)).status).toBe(200);
  expect((await api(guest, code, duplicate)).data.state.ply).toBe(3);
  await page.reload();
  await expect(node(page, "b2")).toHaveAttribute("aria-label", "b2, shark");
  await other.setOffline(true);
  await expect(
    guest.getByRole("status").filter({ hasText: "Connection lost" }),
  ).toBeVisible();
  await other.setOffline(false);
  await guest.reload();
  await expect(node(guest, "a2")).toHaveAttribute("aria-label", "a2, orca");
  expect((await api(page, code)).data.state).toEqual(
    (await api(guest, code)).data.state,
  );
  await page.getByRole("button", { name: "Offer draw" }).click();
  await page.getByRole("button", { name: "Send draw offer" }).click();
  await guest.getByRole("button", { name: "Accept draw", exact: true }).click();
  for (const player of [page, guest])
    await expect(
      player.getByRole("heading", { name: "A shared tide." }),
    ).toBeVisible();
  await page.getByRole("button", { name: "Rematch", exact: true }).click();
  await guest
    .getByRole("button", { name: "Accept rematch", exact: true })
    .click();
  await expect(
    guest.getByRole("region", { name: "Online room" }),
  ).toContainText("You are Orcas");
  await expect(node(page, "c3")).toHaveAttribute("aria-label", "c3, empty");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await other.close();
});

test("concurrent moves commit once and replay protection survives refresh", async ({
  page,
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const guest = await context.newPage();
    const code = await openMatch(page, guest);
    const room = (await api(guest, code)).data as RoomView;
    const moves = [
      action(room, { kind: "place", to: "c3" }),
      action(room, { kind: "place", to: "b2" }),
    ];
    const results = await Promise.all(
      moves.map((move) => api(guest, code, move)),
    );
    expect(results.map(({ status }) => status).sort()).toEqual([200, 409]);
    const accepted = moves[results.findIndex(({ status }) => status === 200)];
    await guest.reload();
    const replay = await api(guest, code, accepted);
    expect(replay.status).toBe(200);
    expect(replay.data.state.ply).toBe(1);
    expect(replay.data.moves).toHaveLength(1);
    const reused = await api(guest, code, {
      ...accepted,
      action: { kind: "resign" },
    });
    expect(reused.status).toBe(409);
    expect(reused.data.code).toBe("REQUEST_REUSED");
    const outsider = await browser.newPage();
    try {
      await register(outsider);
      expect((await api(outsider, code)).status).toBe(403);
    } finally {
      await outsider.close();
    }
  } finally {
    await context.close();
  }
});

test("online players can use different visual themes for the same canonical game", async ({
  page,
  browser,
}) => {
  const other = await browser.newContext();
  const guest = await other.newPage();
  try {
    const code = await openMatch(page, guest);
    await page.getByRole("button", { name: "Open settings" }).click();
    await page.getByLabel("Board theme").selectOption("tigers-goats");
    await page.getByRole("button", { name: "Close dialog" }).click();
    await expect(node(page, "a1")).toHaveAttribute("aria-label", "a1, tiger");
    await expect(node(guest, "a1")).toHaveAttribute("aria-label", "a1, orca");
    await node(guest, "c3").click();
    await expect(node(page, "c3")).toHaveAttribute("aria-label", "c3, goat");
    await node(page, "a1").click();
    await node(page, "a2").click();
    await expect(node(guest, "a2")).toHaveAttribute("aria-label", "a2, orca");
    await page.reload();
    await expect(node(page, "a2")).toHaveAttribute("aria-label", "a2, tiger");
    await expect(
      page.getByRole("region", { name: "Online room" }),
    ).toContainText("You are Tigers");
    expect((await api(page, code)).data.state).toEqual(
      (await api(guest, code)).data.state,
    );
  } finally {
    await other.close();
  }
});

for (const winner of ["orcas", "sharks"] as const)
  test(`complete ${winner} victory is visible and durable for both browsers`, async ({
    page,
    browser,
  }) => {
    const other = await browser.newContext();
    const guest = await other.newPage();
    const code = await openMatch(page, guest);
    let room: RoomView = (await api(guest, code)).data;
    // Play the recorded legal game through the production HTTP handlers and database.
    for (const move of victories[winner] as Move[]) {
      const result = await api(
        room.state.turn === "sharks" ? guest : page,
        code,
        action(room, move),
      );
      expect(result.status).toBe(200);
      room = result.data;
    }
    for (const player of [page, guest]) {
      await expect(
        player.getByRole("heading", {
          name: winner === "orcas" ? "Orcas win!" : "Sharks win!",
        }),
      ).toBeVisible();
      await player.reload();
      await expect(
        player.getByRole("heading", {
          name: winner === "orcas" ? "Orcas win!" : "Sharks win!",
        }),
      ).toBeVisible();
    }
    expect((await api(page, code)).data.state).toEqual(
      (await api(guest, code)).data.state,
    );
    await page.getByRole("button", { name: "Rematch", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Rematch", exact: true }),
    ).toBeDisabled();
    await guest
      .getByRole("button", { name: "Accept rematch", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Sharks to play" }),
    ).toBeVisible();
    await expect(
      guest.getByRole("heading", { name: "Sharks to play" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Online room" }),
    ).toContainText("You are Sharks");
    await other.close();
  });

test("resignation uses the player's own side and survives refresh", async ({
  page,
  browser,
}) => {
  const other = await browser.newContext();
  const guest = await other.newPage();
  await openMatch(page, guest);
  // Orcas resign while it is Sharks' turn.
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await page.getByRole("button", { name: "Confirm resignation" }).click();
  for (const player of [page, guest]) {
    await expect(
      player.getByRole("heading", { name: "Sharks win!" }),
    ).toBeVisible();
    await player.reload();
    await expect(
      player.getByRole("heading", { name: "Sharks win!" }),
    ).toBeVisible();
  }
  await other.close();
});

test("unauthenticated and malformed HTTP requests fail", async ({
  request,
  page,
  browser,
}) => {
  expect((await request.get("/api/rooms/ABCDEFGH")).status()).toBe(401);
  const other = await browser.newContext();
  const guest = await other.newPage();
  const code = await openMatch(page, guest);
  const room = (await api(guest, code)).data;
  const malformed = action(room, { kind: "place", to: "c3" });
  Object.assign(malformed.action, { unauthorizedField: "ignored?" });
  expect((await api(guest, code, malformed)).status).toBe(400);
  await other.close();
});

test("a player can reclaim a seat and password reset revokes old sessions", async ({
  page,
  browser,
  request,
}) => {
  const username = await register(page);
  await page.getByRole("button", { name: "Create Game", exact: true }).click();
  await expect(
    page.getByText("Waiting for opponent", { exact: true }),
  ).toBeVisible();
  const roomPath = new URL(page.url()).pathname;
  const code = roomPath.split("/").at(-1)!;
  const other = await browser.newContext();
  try {
    const returning = await other.newPage();
    await returning.goto("/");
    const header = returning.getByRole("banner");
    await header.getByRole("link", { name: "Login", exact: true }).click();
    await returning.getByLabel("Username").fill(username);
    await returning.getByLabel("Password", { exact: true }).fill(password);
    await returning
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(
      header.getByRole("link", { name: username, exact: true }),
    ).toBeVisible();
    await returning.getByRole("link", { name: "Orcas vs Sharks home" }).click();
    await expect(
      header.getByRole("link", { name: username, exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        returning.evaluate(() => document.documentElement.scrollWidth),
      )
      .toBeLessThanOrEqual(await returning.evaluate(() => innerWidth));
    await returning.reload();
    await expect(
      header.getByRole("link", { name: username, exact: true }),
    ).toBeVisible();
    await header.getByRole("link", { name: username, exact: true }).click();
    await returning.getByRole("button", { name: "Sign out" }).click();
    await expect(
      header.getByRole("link", { name: "Login", exact: true }),
    ).toBeVisible();
    await returning.goto(roomPath);
    await expect(returning.getByRole("status")).toContainText(
      "Sign in to play.",
    );
    await returning
      .getByRole("link", { name: "Online lobby and sign-in" })
      .click();
    await returning.getByLabel("Username").fill(username);
    await returning.getByLabel("Password", { exact: true }).fill(password);
    await returning
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(
      returning.getByText("Waiting for opponent", { exact: true }),
    ).toBeVisible();

    const reset = issueResetCode(username);
    await returning.goto("/online");
    await returning.getByRole("button", { name: "Sign out" }).click();
    await returning.getByRole("button", { name: "Use a reset code" }).click();
    await returning
      .getByLabel("Password", { exact: true })
      .fill("new test-only long password");
    await returning.getByLabel("Reset code").fill(reset);
    await returning.getByRole("button", { name: "Reset password" }).click();
    await expect(returning.getByText(`Signed in as ${username}`)).toBeVisible();
    expect((await api(page, code)).status).toBe(401);
    expect((await api(returning, code)).status).toBe(200);

    expect(
      (
        await request.post("/api/account", {
          headers: { Origin: "http://untrusted.example" },
          data: { action: "logout" },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await other.close();
  }
});

test("matchmaking cancels, resumes after reload, and seats both players in one live game", async ({
  page,
  browser,
  request,
}) => {
  expect(
    (
      await request.post("/api/matchmaking", {
        headers: { Origin: "http://127.0.0.1:3100" },
        data: { action: "enter" },
      })
    ).status(),
  ).toBe(401);
  const other = await browser.newContext();
  try {
    const opponent = await other.newPage();
    await register(page);
    await register(opponent);
    await page.goto("/");
    await page.getByRole("button", { name: "Find opponent" }).click();
    await expect(
      page.getByRole("button", { name: "Cancel search" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel search" }).click();
    await expect(
      page.getByRole("button", { name: "Find opponent" }),
    ).toBeVisible();

    await opponent.getByRole("button", { name: "Find opponent" }).click();
    await expect(opponent.getByText("Looking for an opponent…")).toBeVisible();
    await opponent.reload();
    await expect(
      opponent.getByRole("button", { name: "Cancel search" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Find opponent" }).click();

    await expect(
      page.getByRole("region", { name: "Online room" }),
    ).toContainText("You are Sharks");
    await expect(
      opponent.getByRole("region", { name: "Online room" }),
    ).toContainText("You are Orcas");
    expect(page.url()).toBe(opponent.url());
    await node(page, "c3").click();
    await expect(node(opponent, "c3")).toHaveAttribute(
      "aria-label",
      "c3, shark",
    );
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Find opponent" }),
    ).toBeVisible();
    await page.waitForURL("/");
  } finally {
    await other.close();
  }
});

test("signup reports mismatched passwords and an existing username", async ({
  page,
  browser,
}) => {
  const username = await register(page);
  const other = await browser.newContext();
  try {
    const joining = await other.newPage();
    await joining.goto("/online");
    await joining.getByRole("link", { name: "Create an account" }).click();
    await expect(
      joining.getByRole("heading", { name: "Create a player account" }),
    ).toBeVisible();
    await joining.getByLabel("Username").fill(username.toUpperCase());
    await joining.getByLabel("Password", { exact: true }).fill(password);
    await joining.getByLabel("Confirm password").fill("a different password");
    await joining
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(joining.getByText("Passwords do not match.")).toBeVisible();
    await joining.getByLabel("Confirm password").fill(password);
    await joining
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      joining.getByText(
        "An account already uses that username. Sign in or choose a different username.",
      ),
    ).toBeVisible();
    const otherUsername = `new_${randomBytes(6).toString("hex")}`;
    await joining.getByLabel("Username").fill(otherUsername);
    await joining
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      joining.getByText(`Signed in as ${otherUsername}`),
    ).toBeVisible();
  } finally {
    await other.close();
  }
});

test("login keeps credentials server-side and rotates, expires, and revokes sessions", async ({
  page,
  request,
}) => {
  const context = page.context();
  const username = `player_${randomBytes(6).toString("hex")}`;
  const secret = "8charPwd";
  const headers = { Origin: origin };
  try {
    const form = { action: "register", username, password: secret };
    const response = await context.request.post("/api/account", {
      headers,
      data: { ...form, password: "short", confirmPassword: "short" },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).code).toBe("INVALID_PASSWORD");
    expect(
      (
        await context.request.post("/api/account", {
          headers,
          data: { ...form, confirmPassword: secret },
        })
      ).status(),
    ).toBe(200);

    const [registered] = await context.cookies();
    expect(registered).toMatchObject({
      name: "orcas_session",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    });
    const registeredHash = createHash("sha256")
      .update(registered.value)
      .digest("hex");
    const session = withDatabase((db) =>
      db
        .prepare(
          "SELECT s.token_hash, a.password_hash FROM account_sessions s JOIN accounts a ON a.id = s.account_id WHERE a.username = ?",
        )
        .get(username),
    );
    expect(session).toEqual({
      token_hash: registeredHash,
      password_hash: expect.stringMatching(/^[a-f0-9]{32}:[a-f0-9]{128}$/),
    });

    const login = { action: "login", username, password: secret };
    const wrongPassword = await request.post("/api/account", {
      headers,
      data: { ...login, password: "wrong" },
    });
    const unknownUser = await request.post("/api/account", {
      headers,
      data: { ...login, username: "missing_player" },
    });
    expect(wrongPassword.status()).toBe(401);
    expect(unknownUser.status()).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownUser.json());
    expect(
      (
        await request.post("/api/account", {
          headers,
          data: { ...login, username: "player'name" },
        })
      ).status(),
    ).toBe(400);

    const authenticated = await context.request.post("/api/account", {
      headers,
      data: login,
    });
    expect(await authenticated.json()).toEqual({ username });
    const [current] = await context.cookies();
    expect(current.value).not.toBe(registered.value);
    const accountFromToken = async (token: string) =>
      (
        await request.get("/api/account", {
          headers: { Cookie: `orcas_session=${token}` },
        })
      ).json();
    expect(await accountFromToken(registered.value)).toEqual({
      username: null,
    });

    await page.goto("/online");
    await page.reload();
    await expect(page.getByText(`Signed in as ${username}`)).toBeVisible();
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      "orcas_session",
    );

    const hash = createHash("sha256").update(current.value).digest("hex");
    withDatabase((db) =>
      db
        .prepare(
          "UPDATE account_sessions SET expires_at = 0 WHERE token_hash = ?",
        )
        .run(hash),
    );
    expect(await accountFromToken(current.value)).toEqual({ username: null });
    await page.reload();
    await expect(
      page.getByRole("link", { name: "Login", exact: true }),
    ).toBeVisible();

    await context.request.post("/api/account", { headers, data: login });
    const [beforeLogout] = await context.cookies();
    expect(
      (
        await context.request.post("/api/account", {
          data: { action: "logout" },
        })
      ).status(),
    ).toBe(403);
    expect(await accountFromToken(beforeLogout.value)).toEqual({ username });
    expect(
      (
        await context.request.post("/api/account", {
          headers,
          data: { action: "logout" },
        })
      ).status(),
    ).toBe(200);
    expect(await accountFromToken(beforeLogout.value)).toEqual({
      username: null,
    });
    expect(await context.cookies()).toHaveLength(0);
  } finally {
    await context.close();
  }
});

test("Google signup starts a protected authorization and rejects a forged callback", async ({
  page,
}) => {
  await page.route("https://accounts.google.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: "Google authorization test",
    }),
  );
  await page.goto("/online");
  await page
    .getByRole("button", { name: "Create account with Google" })
    .click();
  await page.getByLabel("Username").fill("google_test_player");
  await page.getByLabel("Signup code").fill(issueSignupCode());
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.waitForURL("https://accounts.google.com/**");
  const authorize = new URL(page.url());
  expect(authorize.searchParams.get("client_id")).toBe("test-client-id");
  expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
  expect(authorize.searchParams.get("state")).toMatch(/^[a-f0-9]{64}$/);
  await page.goto(
    `/api/account/google/callback?code=forged&state=${"0".repeat(64)}`,
  );
  await expect(
    page.getByText("Google sign-in did not finish. Please try again."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Login", exact: true }),
  ).toBeVisible();
});
