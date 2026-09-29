import { test, expect, type Page } from "@playwright/test";
import victories from "../fixtures/victories.json" with { type: "json" };
import type { Move } from "../../lib/game/types";

const node = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name},`) });
async function ready(page: Page) {
  await page.goto("/play");
  await expect(page.getByText("Saved on this device")).toBeVisible();
}
async function play(page: Page, move: Move) {
  if (move.kind !== "place") await node(page, move.from).click();
  await node(page, move.to).click();
}

test("placement, Orca step, undo, refresh, rules and restart", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await node(page, "c3").click();
  await expect(
    page.getByRole("heading", { name: "Orcas to play" }),
  ).toBeVisible();
  await node(page, "a1").click();
  await node(page, "a2").click();
  await expect(node(page, "a2")).toHaveAttribute("aria-label", "a2, orca");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(node(page, "a1")).toHaveAttribute("aria-label", "a1, orca");
  await page.reload();
  await expect(node(page, "c3")).toHaveAttribute("aria-label", "c3, shark");
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await page.getByRole("button", { name: "Start new game" }).click();
  await expect(node(page, "c3")).toHaveAttribute("aria-label", "c3, empty");
  expect(errors).toEqual([]);
});

test("keyboard-only moves, flip, settings and no horizontal overflow", async ({
  page,
}) => {
  await ready(page);
  // Reach the first SVG intersection using only Tab, then navigate with arrows.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    if (await node(page, "a1").evaluate((el) => el === document.activeElement))
      break;
  }
  await expect(node(page, "a1")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(node(page, "b1")).toHaveAttribute("aria-label", "b1, shark");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");
  await expect(node(page, "a2")).toHaveAttribute("aria-label", "a2, orca");
  await page.getByRole("button", { name: "Flip board" }).click();
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByLabel("Board theme").selectOption("sand");
  await page.getByLabel("Animations").uncheck();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await expect(page.locator(".site-shell")).toHaveClass(
    /theme-sand.*no-motion/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const box = await node(page, "c3").boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

for (const side of ["orcas", "sharks"] as const)
  test(`complete ${side} victory, persistence and rematch`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await ready(page);
    for (const move of victories[side] as Move[]) await play(page, move);
    await expect(
      page.getByRole("heading", {
        name: side === "orcas" ? "Orcas win!" : "Sharks win!",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        side === "orcas"
          ? "Five Sharks captured"
          : "All four Orcas immobilized",
        { exact: true },
      ),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: side === "orcas" ? "Orcas win!" : "Sharks win!",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Play again" }).click();
    await expect(
      page.getByRole("heading", { name: "Sharks to play" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

test("agreement and resignation are separate application results", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Agree draw" }).click();
  await page.getByRole("button", { name: "Opponent: accept draw" }).click();
  await expect(
    page.getByRole("heading", { name: "A shared tide." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A shared tide." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play again" }).click();
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await page.getByRole("button", { name: "Confirm resignation" }).click();
  await expect(page.getByRole("heading", { name: "Orcas win!" })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByRole("heading", { name: "Sharks to play" }),
  ).toBeVisible();
});

test("invalid local save recovers safely and invalid action is announced", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "orcas-sharks.local.v1",
      '{"moves":[{"kind":"place","to":"a1"}]}',
    ),
  );
  await page.goto("/");
  await expect(
    page.getByText("Saved game unavailable · started a new game"),
  ).toBeVisible();
  await node(page, "a1").click();
  await expect(page.getByRole("status")).toContainText("Invalid action");
  await node(page, "c3").click();
  await expect(node(page, "c3")).toHaveAttribute("aria-label", "c3, shark");
});
