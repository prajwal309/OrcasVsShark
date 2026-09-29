import { test, expect, type Page } from "@playwright/test";
import type { RoomRequest, RoomView } from "../../lib/multiplayer/protocol";
import type { Move } from "../../lib/game/types";
import victories from "../fixtures/victories.json" with { type: "json" };

const node = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name},`) });
async function api(page: Page, code: string, body?: RoomRequest) {
  return page.evaluate(
    async ({ code, body }) => {
      const key = Object.keys(localStorage).find(
        (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
      );
      const session = JSON.parse(localStorage.getItem(key!)!);
      const response = await fetch(`/api/rooms/${code}`, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
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
async function openMatch(host: Page, guest: Page) {
  await host.goto("/online");
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
