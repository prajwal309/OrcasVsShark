import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { openDatabase } from "../../lib/database/sqlite.mjs";
import type { RoomView } from "../../lib/multiplayer/protocol";

const origin = "http://127.0.0.1:3100";
const point = (page: Page) => page.getByRole("button", { name: /^c3,/ });

async function enroll(page: Page) {
  const username = `ranked_${randomBytes(4).toString("hex")}`;
  const password = "ranked test password";
  const response = await page.request.post(`${origin}/api/account`, {
    headers: { Origin: origin },
    data: { action: "register", username, password, confirmPassword: password },
  });
  expect(response.ok()).toBe(true);
  await page.goto(origin);
  return username;
}

test("ranked pairing, clock recovery and unattended timeout update profiles and the selected leaderboard", async ({
  page,
  browser,
}) => {
  const second = await browser.newContext();
  const guest = await second.newPage();
  const username = await enroll(page);
  const guestName = await enroll(guest);
  try {
    await page.getByRole("button", { name: "Fast 3 + 5" }).click();
    await expect(page.getByText("Looking for a Fast opponent…")).toBeVisible();
    await guest.getByRole("button", { name: "Medium 5 + 5" }).click();
    await expect(
      guest.getByText("Looking for a Medium opponent…"),
    ).toBeVisible();
    await expect(page.getByText("Looking for a Fast opponent…")).toBeVisible();
    await guest.getByRole("button", { name: "Cancel search" }).click();
    await guest.getByRole("button", { name: "Fast 3 + 5" }).click();
    await Promise.all([
      page.waitForURL("**/game/*"),
      guest.waitForURL("**/game/*"),
    ]);
    expect(guest.url()).toBe(page.url());
    const code = new URL(page.url()).pathname.split("/").pop()!;
    const response = await page.request.get(`/api/rooms/${code}`);
    const room: RoomView = await response.json();
    expect(room.ranked?.mode).toBe("fast");
    expect(room.ranked?.remaining.sharks).toBeLessThanOrEqual(180_000);

    const sharks = room.side === "sharks" ? page : guest;
    const orcas = sharks === page ? guest : page;
    const winner = sharks === page ? username : guestName;
    const opponent = sharks === page ? guestName : username;
    await expect(
      sharks.getByRole("timer", { name: "Sharks time" }),
    ).toBeVisible();
    await expect(orcas.getByRole("timer", { name: "Orcas time" })).toHaveText(
      "3:00",
    );
    await point(sharks).click();
    await expect(point(orcas)).toHaveAttribute("aria-label", "c3, shark");
    await orcas.reload();
    await expect(point(orcas)).toHaveAttribute("aria-label", "c3, shark");
    expect(
      await orcas.getByRole("timer", { name: "Orcas time" }).textContent(),
    ).toMatch(/^[0-3]:[0-5]\d$/);

    await page.context().setOffline(true);
    await second.setOffline(true);
    const filename = process.env.SQLITE_PATH;
    if (!filename) throw new Error("Run via npm run test:online");
    const db = openDatabase(filename);
    try {
      db.prepare(
        "UPDATE ranked_matches SET deadline = ? WHERE game_code = ?",
      ).run(Date.now() - 1, code);
      await expect
        .poll(() =>
          db
            .prepare("SELECT winner FROM ranked_matches WHERE game_code = ?")
            .pluck()
            .get(code),
        )
        .toBe("sharks");
    } finally {
      db.close();
      await page.context().setOffline(false);
      await second.setOffline(false);
    }

    for (const player of [page, guest]) {
      await expect(
        player.getByRole("heading", { name: "Sharks win!" }),
      ).toBeVisible();
      await expect(
        player.getByRole("timer", { name: "Orcas time" }),
      ).toHaveText("0:00");
    }
    await page.getByRole("link", { name: winner }).click();
    await expect(page.getByRole("heading", { name: winner })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Fast rating" }),
    ).toContainText("1516 Elo");
    await expect(
      page.getByRole("region", { name: "Medium rating" }),
    ).toContainText("1500 Elo");
    await expect(
      page.getByRole("row", { name: new RegExp(opponent) }),
    ).toContainText("Time expired");
    await page.getByRole("link", { name: "Leaderboards" }).click();
    await expect(
      page.getByRole("row", { name: new RegExp(winner) }),
    ).toContainText("1516");
    await expect(
      page.getByRole("row", { name: new RegExp(opponent) }),
    ).toContainText("1484");
    await page.getByRole("link", { name: "Medium" }).click();
    await expect(
      page.getByText(
        "Players appear here after finishing a ranked Medium game.",
      ),
    ).toBeVisible();
  } finally {
    await second.close();
  }
});
