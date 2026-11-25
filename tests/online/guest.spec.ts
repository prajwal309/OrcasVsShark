import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { postgresQuery } from "../../scripts/test-postgres.mjs";
import type { RoomView } from "../../lib/multiplayer/protocol";
import { dailyPuzzleForDate, utcDateString } from "../../lib/daily/puzzles";
import { moveCode, prepareExercise } from "../../lib/learn/exercises";

const origin = "http://127.0.0.1:3100";

async function startGuest(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Play as guest" }).click();
  const identity = page.getByText(/^Playing as guest guest_[a-f0-9]+$/);
  await expect(identity).toBeVisible();
  return (await identity.textContent())!.replace("Playing as guest ", "");
}

test("guest sessions persist, play casual rooms, cannot rank, and can upgrade in place", async ({
  page,
  browser,
}) => {
  const guestName = await startGuest(page);
  await page.reload();
  await expect(page.getByText(`Playing as guest ${guestName}`)).toBeVisible();
  await page.getByRole("button", { name: "How to Play" }).click();
  await expect(
    page.getByRole("heading", { name: "Sharks surround" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Setup" }).click();
  await expect(
    page.getByRole("dialog", { name: "Choose your opponent" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep playing" }).click();
  await page.getByRole("link", { name: "GridLox Games home" }).click();
  await page.getByRole("button", { name: "Create Game", exact: true }).click();
  await expect(
    page.getByText("Waiting for opponent", { exact: true }),
  ).toBeVisible();
  const code = new URL(page.url()).pathname.split("/").at(-1)!;

  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  try {
    const secondName = await startGuest(second);
    expect(secondName).not.toBe(guestName);
    await second.goto(`/game/${code}`);
    await second
      .getByRole("button", { name: "Join Game", exact: true })
      .click();
    await expect(
      second.getByRole("region", { name: "Online room" }),
    ).toContainText("You are Sharks");
    await expect(
      page.getByRole("region", { name: "Online room" }),
    ).toContainText("You are Orcas");
    await second
      .getByRole("button", { name: "c3, empty", exact: true })
      .click();
    await expect(page.getByRole("log", { name: "Move history" })).toContainText(
      "c3",
    );

    const roomResponse = await page.request.get(`${origin}/api/rooms/${code}`);
    const room = (await roomResponse.json()) as RoomView;
    const resigned = await page.request.post(`${origin}/api/rooms/${code}`, {
      headers: { Origin: origin },
      data: {
        requestId: crypto.randomUUID(),
        expectedPly: room.state.ply,
        expectedRevision: room.revision,
        action: { kind: "resign" },
      },
    });
    expect(resigned.ok()).toBe(true);
    const ranked = await page.request.post(`${origin}/api/matchmaking`, {
      headers: { Origin: origin },
      data: { action: "enter", mode: "fast" },
    });
    expect(ranked.status()).toBe(403);

    await page.goto("/learn");
    const savedProgress = {
      lesson: {},
      puzzle: {
        "opening-jump": {
          attempts: 1,
          successes: 1,
          hints: 0,
          seconds: 12,
          completedAt: Date.now(),
          opening: null,
          hintIndex: 0,
        },
      },
      quiz: {},
      streak: 1,
      current: {
        kind: "puzzle",
        activityId: "opening-jump",
        at: Date.now(),
      },
    };
    await page.evaluate((progress) => {
      localStorage.setItem("orcas-academy-guest-v1", JSON.stringify(progress));
    }, savedProgress);
    await page.reload();

    await page.goto("/online");
    await page
      .getByRole("button", { name: "Create account and keep progress" })
      .click();
    await page.getByRole("button", { name: "Cancel account creation" }).click();
    await expect(page.getByText(`Playing as guest ${guestName}`)).toBeVisible();
    await page
      .getByRole("button", { name: "Create account and keep progress" })
      .click();
    const username = `guestup_${randomBytes(4).toString("hex")}`;
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Email address").fill(`${username}@example.test`);
    await page
      .getByLabel("Password", { exact: true })
      .fill("guest upgrade password");
    await page.getByLabel("Confirm password").fill("guest upgrade password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(`Signed in as ${username}`)).toBeVisible();
    await page.getByRole("link", { name: "GridLox Games home" }).click();
    await expect(page.getByText(`Signed in as ${username}`)).toBeVisible();
    await page.getByRole("button", { name: "How to Play" }).click();
    await expect(
      page.getByRole("heading", { name: "Orcas capture" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("link", { name: "Setup" }).click();
    await expect(
      page.getByRole("dialog", { name: "Choose your opponent" }),
    ).toBeVisible();
    await page.getByLabel("Difficulty").selectOption("easy");
    await page.getByRole("button", { name: "Start game" }).click();
    await page.getByRole("button", { name: "c3, empty", exact: true }).click();
    await expect(page.getByText("2 PLIES", { exact: true })).toBeVisible();
    await page.goto(`/game/${code}`);
    await expect(
      page.getByRole("region", { name: "Online room" }),
    ).toContainText("You are Orcas");
    await page.goto("/learn");
    await expect
      .poll(async () => {
        const { rows } = await postgresQuery<{ attempts: number }>(
          `SELECT p.attempts FROM puzzle_attempts p
           JOIN accounts a ON a.id = p.player_id
           WHERE a.username = $1 AND p.puzzle_id = 'opening-jump'`,
          [username],
        );
        return rows[0]?.attempts ?? 0;
      })
      .toBe(1);

    const date = utcDateString();
    const puzzle = dailyPuzzleForDate(date);
    const prepared = prepareExercise(puzzle);
    const branch = prepared.answers[0];
    const answer =
      puzzle.goal.kind === "choice"
        ? puzzle.goal.answer
        : puzzle.goal.kind === "win-in-two"
          ? moveCode(branch.replies[0].answers[0])
          : moveCode(branch.move);
    const dailyAttempt = await page.request.post(`${origin}/api/daily-puzzle`, {
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
      },
      data: {
        date,
        puzzleId: puzzle.id,
        action: "attempt",
        answer,
        ...(puzzle.goal.kind === "win-in-two" && {
          opening: moveCode(branch.move),
        }),
        hintsUsed: 0,
        seconds: 1,
      },
    });
    expect(await dailyAttempt.json()).toMatchObject({
      recorded: true,
      solved: true,
    });
    const dailyStats = await page.request.get(`${origin}/api/daily-puzzle`);
    expect(await dailyStats.json()).toMatchObject({
      attempted: 1,
      solved: 1,
      streak: 1,
    });
    await page.goto("/daily-puzzle");
    const stats = page.getByRole("region", { name: "Puzzle statistics" });
    await expect(stats).toContainText("1 of 1 days solved");
    await expect(
      page.getByRole("link", { name: "Daily Puzzle", exact: true }),
    ).toHaveAccessibleDescription("Solved independently");

    const yesterday = new Date(`${date}T00:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const previousDate = utcDateString(yesterday);
    const previousPuzzle = dailyPuzzleForDate(previousDate);
    const previousBranch = prepareExercise(previousPuzzle).answers[0];
    const previousAnswer =
      previousPuzzle.goal.kind === "choice"
        ? previousPuzzle.goal.answer
        : previousPuzzle.goal.kind === "win-in-two"
          ? moveCode(previousBranch.replies[0].answers[0])
          : moveCode(previousBranch.move);
    const revealedRetry = await page.request.post(
      `${origin}/api/daily-puzzle`,
      {
        headers: { Origin: origin },
        data: {
          date: previousDate,
          puzzleId: previousPuzzle.id,
          action: "attempt",
          answer: previousAnswer,
          ...(previousPuzzle.goal.kind === "win-in-two" && {
            opening: moveCode(previousBranch.move),
          }),
          hintsUsed: 0,
          seconds: 1,
          solutionRevealed: true,
        },
      },
    );
    expect(await revealedRetry.json()).toMatchObject({
      recorded: true,
      solved: false,
      progress: { status: "revealed" },
    });
    const savedReveal = await page.request.get(
      `${origin}/api/daily-puzzle?status=${previousDate}`,
    );
    expect(await savedReveal.json()).toMatchObject({ status: "revealed" });
    await page.route("**/api/daily-puzzle", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "Temporarily unavailable" },
      }),
    );
    await page.reload();
    await expect(stats).toContainText(
      "Your account puzzle statistics are unavailable.",
    );
    await expect(stats).not.toContainText("Loading");
    await page.getByRole("button", { name: "Show hint" }).click();
    await expect(
      page.getByText(/account statistics could not sync/),
    ).toBeVisible();
  } finally {
    await secondContext.close();
  }
});
