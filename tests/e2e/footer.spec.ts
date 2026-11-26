import { test, expect } from "@playwright/test";

test("the shared footer and its links appear across site pages", async ({
  page,
}) => {
  const routes = [
    "/",
    "/online",
    "/play",
    "/tigers-and-goats",
    "/daily-puzzle",
    "/learn",
    "/support",
    "/about",
    "/leaderboards",
    "/players/footertest",
    "/game/ABCDEFGH",
  ];

  for (const route of routes) {
    await page.goto(route);
    const footer = page.locator("footer.site-footer");
    const navigation = footer.getByRole("navigation", { name: "Footer" });

    await expect(footer, route).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "About", exact: true }),
    ).toHaveAttribute("href", "/about");
    await expect(
      navigation.getByRole("link", { name: "The Project", exact: true }),
    ).toHaveAttribute("href", "/about#project");
    await expect(
      navigation.getByRole("link", {
        name: "Support Baghchal",
        exact: true,
      }),
    ).toHaveAttribute("href", "/support");
    await expect(
      navigation.getByRole("link", {
        name: "Contact & Feedback",
        exact: true,
      }),
    ).toHaveAttribute("href", "/about#contact");
  }

  await page.goto("/play");
  await page
    .locator("footer.site-footer")
    .getByRole("link", { name: "Support Baghchal", exact: true })
    .click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(
    page.getByRole("heading", {
      name: "Preserve a Tradition. Build Its Future.",
    }),
  ).toBeVisible();

  await page
    .locator("footer.site-footer")
    .getByRole("link", { name: "About", exact: true })
    .click();
  await expect(page).toHaveURL(/\/about$/);
  await page
    .locator("footer.site-footer")
    .getByRole("link", { name: "The Project", exact: true })
    .click();
  await expect(page).toHaveURL(/\/about#project$/);
  await expect(
    page.getByRole("heading", { name: "About the Project" }),
  ).toBeVisible();
  await page
    .locator("footer.site-footer")
    .getByRole("link", { name: "Contact & Feedback", exact: true })
    .click();
  await expect(page).toHaveURL(/\/about#contact$/);
  await expect(
    page.getByRole("heading", { name: "Contact & Feedback" }),
  ).toBeVisible();
});
