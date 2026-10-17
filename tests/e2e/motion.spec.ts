import { test, expect } from "@playwright/test";
import victories from "../fixtures/victories.json" with { type: "json" };
import type { Move } from "../../lib/game/types";

test("reduced-motion victory still names the winner and allows keyboard replay", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await page.getByRole("button", { name: "Confirm resignation" }).click();
  const banner = page.getByRole("region", { name: "Orcas win!" });
  await expect(banner).toBeVisible();
  expect(
    await banner.evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  expect(
    await banner
      .locator(".victory-sparks i")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity),
  ).toBe("0");
  await banner.getByRole("button", { name: "Play again", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(banner).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Sharks to play" }),
  ).toBeVisible();
});

test("shows move feedback while keeping the board playable, and clears captures", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/play");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.evaluate(() => {
    const events: string[] = [];
    Object.assign(window, { motionEvents: events });
    document.addEventListener("animationstart", (event) =>
      events.push((event as AnimationEvent).animationName),
    );
  });
  const node = (id: string) =>
    page.getByRole("button", { name: new RegExp(`^${id},`) });
  const replay = victories.orcas as Move[];
  const index = replay.findIndex((move) => move.kind === "capture");
  for (const move of replay.slice(0, index + 1)) {
    if (move.kind !== "place") await node(move.from).click();
    await node(move.to).click();
  }
  const capture = replay[index];
  if (capture.kind !== "capture") throw new Error("Missing capture fixture");
  await expect(node(capture.to)).toHaveAttribute(
    "aria-label",
    `${capture.to}, orca`,
  );
  await expect(node(capture.over)).toHaveAttribute(
    "aria-label",
    `${capture.over}, empty`,
  );
  await expect.poll(() => page.locator(".move-effects").count()).toBe(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { motionEvents: string[] }).motionEvents,
    ),
  ).toContain("piece-leap");
  await expect(node(capture.to)).toBeEnabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".move-effects")).toHaveCount(0);
  await expect(node(capture.over)).toHaveAttribute(
    "aria-label",
    `${capture.over}, shark`,
  );
});

test("both reduced motion and the saved animation setting disable all feedback movement", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "c3, empty", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "c3, shark", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator(".piece-place")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  expect(
    await page
      .locator(".arrival-ripple")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity),
  ).toBe("0");
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByLabel("Animations").uncheck();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await expect(page.locator(".site-shell")).toHaveClass(/no-motion/);
  await page.getByRole("button", { name: "a1, orca", exact: true }).click();
  await page
    .getByRole("button", { name: /a2, empty, legal destination/ })
    .click();
  await expect(
    page.getByRole("button", { name: "a2, orca", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".move-effects")).toHaveCount(0);
  expect(await page.locator(".selection-ring").count()).toBe(0);
});
