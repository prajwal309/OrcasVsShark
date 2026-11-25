import { expect, test } from "@playwright/test";

test("daily puzzles and opening exploration remain available without a database", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/daily-puzzle");
  await expect(
    page.getByRole("heading", { name: "Daily Puzzle", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: /game board/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show hint" })).toBeEnabled();
  await page.getByRole("button", { name: "Show hint" }).click();

  await page.goto("/opening-explorer");
  await expect(
    page.getByRole("heading", { name: "Opening Explorer", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Completed-game statistics are unavailable right now.",
  );
  expect(errors).toEqual([]);
});

test("anonymous computer play starts and keeps using the local game engine", async ({
  page,
}) => {
  await page.goto("/play");
  await page.getByRole("button", { name: "Play against computer" }).click();
  await page.getByLabel("Your side").selectOption("sharks");
  await page.getByLabel("Difficulty").selectOption("easy");
  await page.getByRole("button", { name: "Start game" }).click();
  await page.getByRole("button", { name: "c3, empty", exact: true }).click();
  await expect(page.getByText("2 PLIES", { exact: true })).toBeVisible();
});
