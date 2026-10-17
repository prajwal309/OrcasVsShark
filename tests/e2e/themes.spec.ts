import { test, expect, type Page } from "@playwright/test";
import victories from "../fixtures/victories.json" with { type: "json" };
import type { Move } from "../../lib/game/types";

async function theme(page: Page, value: string) {
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByLabel("Board theme").selectOption(value);
  await page.getByRole("button", { name: "Close dialog" }).click();
}
const node = (page: Page, id: string) =>
  page.getByRole("button", { name: new RegExp(`^${id},`) });

test("switches themes during a game, persists the choice, and plays by keyboard", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/play");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await node(page, "c3").click();
  await theme(page, "tigers-goats");
  await expect(
    page.getByRole("heading", { name: "Tigers to play" }),
  ).toBeVisible();
  await expect(node(page, "c3")).toHaveAttribute("aria-label", "c3, goat");
  await expect(node(page, "a1")).toHaveAttribute("aria-label", "a1, tiger");
  await expect(page.getByText("1 PLIES", { exact: true })).toBeVisible();
  await node(page, "a1").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(node(page, "a2")).toHaveAttribute("aria-label", "a2, tiger");
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(
    page.getByRole("heading", { name: "Goats surround" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tigers capture" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await expect(page.locator(".site-shell")).toHaveClass(/theme-tigers-goats/);
  await expect(node(page, "a2")).toHaveAttribute("aria-label", "a2, tiger");
  await theme(page, "sand");
  await expect(node(page, "a2")).toHaveAttribute("aria-label", "a2, orca");
  await expect(page.getByText("2 PLIES", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("computer side selection and responses follow the Tiger and Goat theme", async ({
  page,
}) => {
  await page.goto("/play");
  await theme(page, "tigers-goats");
  await page
    .getByRole("button", { name: "Play against computer", exact: true })
    .click();
  await expect(
    page.getByRole("option", { name: "Goats · Place first" }),
  ).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Difficulty", exact: true })
    .selectOption("easy");
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await node(page, "c3").click();
  await expect(page.getByText("2 PLIES", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Goats to play" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Computer: Tigers" }),
  ).toContainText("Goats to play");
});

for (const side of ["orcas", "sharks"] as const) {
  test(`shows the themed ${side} victory and retains it on refresh`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/play");
    await theme(page, "tigers-goats");
    for (const move of victories[side] as Move[]) {
      if (move.kind !== "place") await node(page, move.from).click();
      await node(page, move.to).click();
    }
    const name = side === "orcas" ? "Tigers win!" : "Goats win!";
    const reason =
      side === "orcas" ? "Five Goats captured" : "All four Tigers immobilized";
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText(reason, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await theme(page, "ocean");
    await expect(
      page.getByRole("heading", {
        name: side === "orcas" ? "Orcas win!" : "Sharks win!",
      }),
    ).toBeVisible();
  });
}
