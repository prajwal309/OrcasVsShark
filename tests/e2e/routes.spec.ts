import { expect, test } from "@playwright/test";

test("account and ranked pages give a usable fallback without a database", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Set up a computer game" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Keep playing" })
    .click();
  await page.getByRole("link", { name: "Login" }).click();
  await expect(page).toHaveTitle("Online Play and Accounts | GridLox Games");
  await expect(
    page.getByText("Sign-in and registration are currently unavailable."),
  ).toBeVisible();
  expect((await page.goto("/leaderboards"))?.ok()).toBe(true);
  await page.getByRole("link", { name: "Classic" }).click();
  await expect(page).toHaveURL("/leaderboards?mode=classic");
  await expect(
    page.getByRole("region", { name: "Classic leaderboard" }),
  ).toContainText("temporarily unavailable");
  await page.getByRole("link", { name: "Ranked lobby" }).click();
  await expect(
    page.getByRole("heading", { name: "Play online" }),
  ).toBeVisible();
});

test("invalid pages and room codes render the recovery route", async ({
  page,
}) => {
  for (const path of [
    "/missing-page",
    "/game/invalid-code",
    "/opening-explorer",
  ]) {
    expect((await page.goto(path))?.status()).toBe(404);
    await page.getByRole("link", { name: "Return to the game" }).click();
    await expect(
      page.getByRole("heading", { name: "Sharks to play" }),
    ).toBeVisible();
  }
});
