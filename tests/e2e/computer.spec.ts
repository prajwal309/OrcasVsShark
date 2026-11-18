import { test, expect, type Page } from "@playwright/test";

async function startComputer(
  page: Page,
  side: "sharks" | "orcas",
  difficulty = "easy",
) {
  await page.goto("/play");
  await page
    .getByRole("button", { name: "Play against computer", exact: true })
    .click();
  await page.getByLabel("Your side").selectOption(side);
  await page
    .getByRole("combobox", { name: "Difficulty", exact: true })
    .selectOption(difficulty);
  await page.getByRole("button", { name: "Start game", exact: true }).click();
}

test("plays as Sharks, gets a computer reply, undoes a full turn and restarts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await startComputer(page, "sharks");
  await expect(page.getByRole("button", { name: "Agree draw" })).toBeDisabled();
  await page.getByRole("button", { name: "c3, empty", exact: true }).click();
  await expect(page.getByText("2 PLIES", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sharks to play" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("0 PLIES", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "c3, empty", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "c3, empty", exact: true }).click();
  await expect(page.getByText("2 PLIES", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await page.getByRole("button", { name: "Start new game" }).click();
  await expect(page.getByText("0 PLIES", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Computer game setup" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("computer opens as Sharks, keeps the human seat on refresh, and resigns the human side", async ({
  page,
}) => {
  await startComputer(page, "orcas", "hard");
  await expect(page.getByText("1 PLIES", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Orcas to play" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await page.getByRole("button", { name: "a1, orca", exact: true }).click();
  await page
    .getByRole("button", { name: /legal destination/ })
    .first()
    .click();
  await expect(page.getByText("3 PLIES", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("1 PLIES", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("orcas-sharks.local.v1")!).moves
            .length,
      ),
    )
    .toBe(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Computer game setup" }),
  ).toBeVisible();
  await expect(page.getByText("1 PLIES", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await page.getByRole("button", { name: "Confirm resignation" }).click();
  await expect(
    page.getByRole("heading", { name: "Sharks win!" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Sharks win!" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play again", exact: true }).click();
  await expect(page.getByText("1 PLIES", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Orcas to play" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Computer game setup" }),
  ).toBeVisible();
});

test("refresh resumes a pending computer turn and game setup can return to two players", async ({
  page,
}) => {
  await startComputer(page, "sharks", "hard");
  await page.getByRole("button", { name: "c3, empty", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("orcas-sharks.local.v1")!).moves
            .length,
      ),
    )
    .toBeGreaterThanOrEqual(1);
  await page.reload();
  await expect(page.getByText("2 PLIES", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sharks to play" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Computer game setup" }).click();
  await page
    .getByRole("combobox", { name: "Opponent", exact: true })
    .selectOption("friend");
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await expect(page.getByText("0 PLIES", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play against computer" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Agree draw" })).toBeEnabled();
});

test("the online-first home also opens computer setup without signing in", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Play online", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Play against computer" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Set up a computer game" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Opponent")).toHaveValue("computer");
  await page.getByLabel("Difficulty").selectOption("hard");
  await page.getByRole("button", { name: "Start game" }).click();
  await page.getByRole("button", { name: "Computer game setup" }).click();
  await expect(page.getByLabel("Difficulty")).toHaveValue("hard");
});
