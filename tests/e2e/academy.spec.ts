import { expect, test, type Page } from "@playwright/test";

const point = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name},`) });

test("an anonymous learner finishes a lesson with the keyboard and resumes after reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Learn to Play" }).click();
  await expect(
    page.getByRole("heading", { name: "Learn to Play" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Start first lesson" }).click();
  await expect(
    page.getByRole("heading", { name: "Meet the two sides" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show hint" }).click();
  await point(page, "c2").focus();
  await page.keyboard.press("ArrowUp");
  await expect(point(page, "c3")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Lesson complete!")).toBeVisible();
  await page.getByRole("link", { name: "Next lesson" }).click();
  await expect(
    page.getByRole("heading", { name: "Follow the lines" }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation", { name: "Academy" })
    .getByRole("link", { name: "My Progress" })
    .click();
  await expect(page.getByText("1 / 20")).toBeVisible();
  await expect(page.getByText("First Lesson (earned)")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Follow the lines" }).first(),
  ).toBeVisible();
});

test("puzzle hints persist, retries clear them, and the same capture solves in another theme", async ({
  page,
}) => {
  await page.goto("/learn?section=puzzles&activity=opening-jump");
  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(page.getByText("Start with the hunter on b2.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Start with the hunter on b2.")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Start with the hunter on b2.")).toHaveCount(0);
  await point(page, "b2").click();
  await point(page, "e3").click();
  await expect(
    page.getByText("That move is illegal", { exact: false }),
  ).toBeVisible();
  await point(page, "b3").click();
  await expect(
    page.getByText("That move is legal, but", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Puzzle solved!")).toHaveCount(0);
  await page.getByRole("button", { name: "Review solution" }).click();
  await expect(page.getByText("b2×d4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hide solution" }).click();
  await page.getByLabel("Board theme").selectOption("tigers-goats");
  await expect(point(page, "b2")).toHaveAttribute("aria-label", /tiger/);
  await point(page, "d4").click();
  await expect(page.getByText("Puzzle solved!")).toBeVisible();
  await expect(page.getByText("+10 puzzle points")).toBeVisible();
  await expect(point(page, "d4")).toHaveAttribute("aria-label", /tiger/);
  await expect(point(page, "c3")).toHaveAttribute("aria-label", /empty/);
});

test("guided practice offers a search hint, evaluates a move, and reviews the decision", async ({
  page,
}) => {
  await page.goto("/learn?section=practice");
  await page.getByLabel("Difficulty").selectOption("easy");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Ask for a hint" }).click();
  await expect(
    page.getByText("The search suggests", { exact: false }),
  ).toBeVisible();
  await point(page, "a2").click();
  await expect(
    page.getByText("This position allows the capture", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "End practice" }).click();
  await page.getByRole("button", { name: "Ply 1 · +a2" }).click();
  await expect(page.getByText("Review · ply 1")).toBeVisible();
  await page.getByRole("button", { name: "Undo and retry" }).click();
  await expect(point(page, "a2")).toHaveAttribute("aria-label", /empty/);
});

test("a two-move puzzle resumes from the defender’s reply after a refresh", async ({
  page,
}) => {
  await page.goto("/learn?section=puzzles&activity=force-the-fifth");
  await expect(page.getByRole("button", { name: "Show hint" })).toBeEnabled();
  await point(page, "a4").click();
  await point(page, "a3").click();
  await expect(page.getByText("Defender’s reply")).toBeVisible();
  await expect(page.getByText("Puzzle solved!")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Defender’s reply")).toBeVisible();
  await expect(point(page, "a3")).toHaveAttribute("aria-label", /orca/);
  await point(page, "a3").click();
  await point(page, "c5").click();
  await expect(page.getByText("Puzzle solved!")).toBeVisible();
  await expect(page.getByText("+30 puzzle points")).toBeVisible();
});
