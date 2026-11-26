import { expect, test } from "@playwright/test";
import { tutorialSteps } from "../../lib/game/tutorial-scenarios";

for (const { path, theme } of [
  { path: "/play", theme: "ocean" },
  { path: "/tigers-and-goats", theme: "tigers-goats" },
] as const) {
  test(`tutorial lessons reset cleanly with the ${theme} pieces`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    await page.getByRole("button", { name: "How to play" }).click();
    const dialog = page.getByRole("dialog", { name: "How to Play" });
    const board = dialog.getByRole("region", { name: "Tutorial board" });
    const svg = board.locator(".game-board");
    const replay = board.getByRole("button", { name: "Replay Animation" });
    const node = (id: string) =>
      board.getByRole("button", { name: new RegExp(`^${id},`) });

    for (const [index, step] of tutorialSteps.entries()) {
      await expect(replay).toBeEnabled();
      await expect(svg).toHaveAttribute("data-board-theme", theme);
      const rings = svg.locator(".academy-focus-ring");
      await expect(rings).toHaveCount(step.focusNodes.length);
      await expect(rings.first()).toHaveCSS("fill", "none");

      const move = step.demoMoves[0];
      if (move.kind !== "place") await node(move.from).click();
      await node(move.to).click();
      await expect(dialog.locator(".tutorial-complete")).toBeVisible();
      await expect(svg.locator(".academy-focus-ring")).toHaveCount(0);
      await expect(svg.locator(".selection-ring")).toHaveCount(0);
      await expect(svg.locator(".tutorial-guide-arrow")).toHaveCount(0);
      await expect(svg.locator(".last-move")).toHaveCount(0);
      await expect(svg.locator(".move-effects")).toHaveCount(0);

      const expectedPieces = Object.values(step.demoStates[1].board).filter(
        Boolean,
      ).length;
      await expect(svg.locator(".board-pieces > g")).toHaveCount(
        expectedPieces,
      );
      if (theme === "tigers-goats") {
        await expect(
          svg.locator('.board-pieces image[href="/icons/tiger.webp"]'),
        ).toHaveCount(
          Object.values(step.demoStates[1].board).filter(
            (piece) => piece === "orca",
          ).length,
        );
      } else {
        await expect(svg.locator(".board-pieces image")).toHaveCount(0);
        await expect(svg.locator(".board-pieces path").first()).toBeAttached();
      }

      await replay.click();
      await expect(replay).toBeEnabled();
      await expect(svg.locator(".move-effects")).toHaveCount(0);
      await expect(svg.locator(".selection-ring")).toHaveCount(0);
      await expect(svg.locator(".last-move")).toHaveCount(0);
      await expect(svg.locator(".board-pieces > g")).toHaveCount(
        Object.values(step.start.board).filter(Boolean).length,
      );

      if (index < tutorialSteps.length - 1)
        await dialog.getByRole("button", { name: "Next", exact: true }).click();
    }

    await dialog.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("button", { name: "How to play" }).click();
    await expect(dialog.getByText("Lesson 1 of 6")).toBeVisible();
    await expect(replay).toBeEnabled();
    await expect(svg.locator(".move-effects")).toHaveCount(0);
    await expect(svg.locator(".academy-focus-ring").first()).toHaveCSS(
      "fill",
      "none",
    );
  });

  test(`tutorial replay clears active ${theme} animations`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.getByRole("button", { name: "How to play" }).click();
    const dialog = page.getByRole("dialog", { name: "How to Play" });
    const board = dialog.getByRole("region", { name: "Tutorial board" });
    const replay = board.getByRole("button", { name: "Replay Animation" });
    const effect = board.locator(".move-effects");
    const move = tutorialSteps[0].demoMoves[0];
    const destination = board.getByRole("button", {
      name: new RegExp(`^${move.to},`),
    });

    await expect(replay).toBeEnabled();
    await destination.click();
    await expect(effect).toHaveCount(1);
    await replay.click();
    await expect(effect).toHaveCount(0);
    await expect(replay).toBeEnabled();
    await destination.click();
    await expect(effect).toHaveCount(1);
    await expect(effect).toHaveCount(0);
  });
}
