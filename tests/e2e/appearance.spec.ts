import { expect, test, type Locator } from "@playwright/test";

function luminance(color: string) {
  const [red, green, blue] = (color.match(/\d+/g) ?? []).map((value) => {
    const fraction = Number(value) / 255;
    return fraction <= 0.04045
      ? fraction / 12.92
      : ((fraction + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

async function contrast(text: Locator, surface: Locator = text) {
  const foreground = luminance(
    await text.evaluate((element) => getComputedStyle(element).color),
  );
  const background = luminance(
    await surface.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  );
  return (
    (Math.max(foreground, background) + 0.05) /
    (Math.min(foreground, background) + 0.05)
  );
}

test("uses the Royal Navy palette by default and keeps controls legible on both palettes", async ({
  page,
}) => {
  await page.goto("/");
  const root = page.locator("html");
  const primary = page.getByRole("link", {
    name: "Set up a computer game",
    exact: true,
  });
  const account = page.locator("#online-account");
  await expect(root).toHaveAttribute("data-site-theme", "royal");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(24, 38, 61)",
  );
  await expect(page.locator("body")).toHaveCSS("color", "rgb(252, 250, 246)");
  await expect(primary).toHaveCSS("background-color", "rgb(213, 165, 71)");
  expect(await contrast(primary)).toBeGreaterThanOrEqual(4.5);
  expect(
    await contrast(
      account.getByText("Sign-in and registration are currently unavailable."),
      account,
    ),
  ).toBeGreaterThanOrEqual(4.5);

  await page.getByLabel("Site appearance").selectOption("ivory");
  await expect(root).toHaveAttribute("data-site-theme", "ivory");
  expect(await contrast(primary)).toBeGreaterThanOrEqual(4.5);
  expect(
    await contrast(
      account.getByText("Sign-in and registration are currently unavailable."),
      account,
    ),
  ).toBeGreaterThanOrEqual(4.5);
  await page.reload();
  await expect(root).toHaveAttribute("data-site-theme", "ivory");
  await expect(page.getByLabel("Site appearance")).toHaveValue("ivory");
});

test("site appearance follows navigation independently of Academy and game board artwork", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Site appearance").selectOption("ivory");
  await page.goto("/learn?section=puzzles&activity=opening-jump");
  await expect(page.getByLabel("Site appearance")).toHaveCount(0);
  await page.getByLabel("Board theme").selectOption("tigers-goats");
  const shark = page.getByRole("button", { name: /^c3, goat/ });
  const orca = page.getByRole("button", { name: /^b2, tiger/ });
  await expect(shark).toBeVisible();
  await expect(orca).toBeVisible();

  await page.goto("/play");
  await expect(page.locator("html")).toHaveAttribute(
    "data-site-theme",
    "ivory",
  );
  await expect(page.getByRole("button", { name: /^a1, orca/ })).toBeVisible();
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByLabel("Site appearance")).toHaveValue("ivory");
  await expect(page.getByLabel("Board theme")).toHaveValue("ocean");
  await page.getByLabel("Site appearance").selectOption("royal");
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.goto("/learn?section=puzzles&activity=opening-jump");
  await expect(page.locator("html")).toHaveAttribute(
    "data-site-theme",
    "royal",
  );
  await expect(page.getByLabel("Site appearance")).toHaveCount(0);
  await expect(page.getByLabel("Board theme")).toHaveValue("tigers-goats");
  await expect(shark).toBeVisible();
  await expect(orca).toBeVisible();

  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
