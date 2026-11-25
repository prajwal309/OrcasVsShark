import { expect, test, type Page } from "@playwright/test";
import { dailyPuzzleForDate, utcDateString } from "../../lib/daily/puzzles";
import { getLegalMoves } from "../../lib/game/legal-moves";
import { NODES } from "../../lib/game/graph";
import { moveCode, prepareExercise } from "../../lib/learn/exercises";

const point = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name},`) });

async function playMove(
  page: Page,
  move: { kind: string; from?: string; to: string },
) {
  if (move.kind !== "place" && move.from) await point(page, move.from).click();
  await point(page, move.to).click();
}

async function solveDailyPuzzle(page: Page, navigate = true) {
  const puzzle = dailyPuzzleForDate(utcDateString());
  if (navigate) await page.goto("/daily-puzzle");
  if (puzzle.goal.kind === "choice") {
    await page
      .getByRole("button", {
        name: puzzle.goal.choices[puzzle.goal.answer],
        exact: true,
      })
      .click();
    return;
  }
  const solution = prepareExercise(puzzle).answers[0];
  if (!solution)
    throw new Error("The daily puzzle must have a board solution.");

  await playMove(page, solution.move);
  if (puzzle.goal.kind === "win-in-two") {
    const finish = solution.replies[0]?.answers[0];
    if (!finish) throw new Error("The daily puzzle must have a winning reply.");
    await playMove(page, finish);
  }
}

async function dailyLink(page: Page) {
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const menu = nav.getByRole("button", { name: "More navigation" });
  if (
    (await menu.isVisible()) &&
    (await menu.getAttribute("aria-expanded")) === "false"
  ) {
    await menu.click();
  }
  return nav.getByRole("link", { name: "Daily Puzzle", exact: true });
}

function dateForDailyPuzzle(id: string) {
  const date = new Date(`${utcDateString()}T00:00:00.000Z`);
  for (let offset = 0; offset < 30; offset++) {
    const candidate = new Date(date);
    candidate.setUTCDate(candidate.getUTCDate() - offset);
    const candidateDate = utcDateString(candidate);
    if (dailyPuzzleForDate(candidateDate).id.endsWith(`-${id}`))
      return candidateDate;
  }
  throw new Error(`No recent daily puzzle found for ${id}.`);
}

test("daily solution replay can be retried without counting as solved", async ({
  page,
}) => {
  await page.goto("/daily-puzzle");
  await page.getByRole("button", { name: "Show Solution" }).click();
  const puzzle = dailyPuzzleForDate(utcDateString());
  if (puzzle.goal.kind === "choice") {
    await expect(page.getByText("Answer:", { exact: true })).toBeVisible();
  } else {
    await expect(
      page.getByRole("button", { name: "Replay solution" }),
    ).toBeVisible();
    await expect(
      page.getByText("Solution revealed. Retry to solve it yourself."),
    ).toBeVisible();
  }
  await expect(page.getByText("Puzzle Solved!")).toHaveCount(0);
  await expect(await dailyLink(page)).toHaveAccessibleDescription(
    "Solution revealed",
  );

  await page.getByRole("button", { name: "Retry puzzle" }).click();
  await expect(
    page.getByRole("button", { name: "Show Solution" }),
  ).toBeVisible();
  await solveDailyPuzzle(page, false);
  await expect(page.getByText("Practice complete.")).toBeVisible();
  await expect(page.getByText("Puzzle Solved!")).toHaveCount(0);
  await page.reload();
  await expect(await dailyLink(page)).toHaveAccessibleDescription(
    "Solution revealed",
  );
});

test("daily non-move puzzle reveals its correct answer without a false board move", async ({
  page,
}) => {
  await page.goto(
    `/daily-puzzle?date=${dateForDailyPuzzle("occupied-landing")}`,
  );
  await page.getByRole("button", { name: "Show Solution" }).click();

  await expect(page.getByText("Answer: The capture is illegal")).toBeVisible();
  await expect(page.getByText("Puzzle Solved!")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Retry puzzle" }),
  ).toBeVisible();
});

test("solving the daily puzzle celebrates once above the visible board", async ({
  page,
}) => {
  await page.goto("/daily-puzzle");
  const board = page.getByRole("group", { name: /game board/i });
  await board.scrollIntoViewIfNeeded();
  const documentBoardBox = () =>
    board.evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return {
        x: x + window.scrollX,
        y: y + window.scrollY,
        width,
        height,
      };
    });
  const boardBefore = await documentBoardBox();
  await solveDailyPuzzle(page, false);
  const boardAfter = await documentBoardBox();
  await expect(await dailyLink(page)).toHaveAccessibleDescription(
    "Solved independently",
  );
  await expect(page.getByText("Puzzle Solved!", { exact: true })).toBeVisible();
  await expect(board).toBeVisible();
  expect(Math.abs(boardAfter.x - boardBefore.x)).toBeLessThan(1);
  expect(Math.abs(boardAfter.y - boardBefore.y)).toBeLessThan(1);
  expect(Math.abs(boardAfter.width - boardBefore.width)).toBeLessThan(1);
  expect(Math.abs(boardAfter.height - boardBefore.height)).toBeLessThan(1);
  await expect(
    page.getByText("Solution verified.", { exact: true }),
  ).toBeVisible();
  const description = page.locator(
    ".daily-puzzle-sidebar .academy-instructions",
  );
  const solution = page.locator(".daily-completion-panel");
  const actions = page.locator(".daily-completion-actions");
  const descriptionBox = await description.boundingBox();
  const solutionBox = await solution.boundingBox();
  const actionsBox = await actions.boundingBox();
  expect(solutionBox!.y).toBeGreaterThan(descriptionBox!.y);
  expect(actionsBox!.y).toBeGreaterThan(solutionBox!.y);
  const playAgain = page.getByRole("button", { name: "Play again" });
  const viewProgress = page.getByRole("link", { name: "View progress" });
  await expect(playAgain).toBeVisible();
  await expect(viewProgress).toBeVisible();
  const playAgainBox = await playAgain.boundingBox();
  const viewProgressBox = await viewProgress.boundingBox();
  expect(Math.abs(playAgainBox!.y - viewProgressBox!.y)).toBeLessThan(2);
  expect(playAgainBox!.x).toBeLessThan(viewProgressBox!.x);
  await expect(page.getByText("Puzzle Solved!", { exact: true })).toHaveCount(
    1,
  );
  await playAgain.click();
  await expect(
    page.getByRole("button", { name: "Show Solution" }),
  ).toBeVisible();
  await expect(solution).toHaveCount(0);
  await solveDailyPuzzle(page, false);
  await viewProgress.click();
  await expect(page).toHaveURL("/learn?section=progress");
});

test("daily completion animation respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await solveDailyPuzzle(page);

  const celebration = page.locator(".daily-celebration");
  await expect(celebration).toBeVisible();
  await expect(celebration).toHaveCSS("animation-name", "none");
  await expect(celebration.locator(".daily-confetti").first()).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("daily puzzles remain available without a database", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/daily-puzzle");
  await expect(
    page.getByRole("heading", { name: "Daily Puzzle", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: /game board/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show hint" })).toBeEnabled();
  await page.getByRole("button", { name: "Show hint" }).click();

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

test("today's badge clears on an attempt, records a hinted solve, and resets at UTC midnight", async ({
  page,
}) => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  await page.clock.setFixedTime(now);
  await page.goto("/");
  const link = await dailyLink(page);
  await expect(link).toHaveAccessibleDescription("New daily puzzle available");
  await link.click();
  await expect(page).toHaveURL("/daily-puzzle");

  const puzzle = dailyPuzzleForDate(utcDateString(now));
  if (puzzle.goal.kind === "choice") {
    const { answer, choices } = puzzle.goal;
    const wrong = choices.find((_, index) => index !== answer)!;
    await page.getByRole("button", { name: wrong, exact: true }).click();
  } else {
    const { start, answers } = prepareExercise(puzzle);
    const accepted = new Set(answers.map(({ move }) => moveCode(move)));
    const legal = getLegalMoves(start);
    const move = legal.find((candidate) => !accepted.has(moveCode(candidate)));
    if (move) await playMove(page, move);
    else {
      const first = answers[0].move;
      const ownPiece = start.turn === "orcas" ? "orca" : "shark";
      const illegal = NODES.find((to) =>
        first.kind === "place"
          ? !!start.board[to]
          : start.board[to] !== ownPiece &&
            !legal.some(
              (candidate) =>
                candidate.kind !== "place" &&
                candidate.from === first.from &&
                candidate.to === to,
            ),
      )!;
      if (first.kind !== "place") await point(page, first.from).click();
      await point(page, illegal).click();
    }
  }
  await expect(await dailyLink(page)).toHaveAccessibleDescription(
    "Attempted today",
  );
  await page.getByRole("button", { name: "Show hint" }).click();
  await solveDailyPuzzle(page, false);
  await expect(await dailyLink(page)).toHaveAccessibleDescription(
    "Solved with hints",
  );
  await page.getByRole("link", { name: "GridLox Games home" }).click();
  await expect(await dailyLink(page)).toHaveAccessibleDescription(
    "Solved with hints",
  );
  await page.clock.setFixedTime(tomorrow);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(await dailyLink(page)).toHaveAccessibleDescription(
    "New daily puzzle available",
  );
});
