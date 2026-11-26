import { expect, test } from "@playwright/test";

test("the header and page content share responsive alignment boundaries", async ({
  page,
}) => {
  for (const path of ["/", "/daily-puzzle"]) {
    await page.goto(path);
    const alignment = await page.evaluate(() => {
      const header = document
        .querySelector(".header-inner")!
        .getBoundingClientRect();
      const content = document
        .querySelector("main.main-content")!
        .getBoundingClientRect();
      return {
        leftDifference: Math.abs(header.left - content.left),
        rightDifference: Math.abs(header.right - content.right),
      };
    });
    expect(alignment.leftDifference).toBeLessThanOrEqual(1);
    expect(alignment.rightDifference).toBeLessThanOrEqual(1);
  }
});

test("the landing modes preserve setup, local play, and game instructions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  const modes = page.getByRole("region", { name: "Choose a game mode" });
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const rules = nav.getByRole("button", { name: "How to Play" });
  const accountLink = page
    .getByRole("banner")
    .getByRole("link", { name: "Login" });
  await expect(
    page.getByRole("heading", { name: "Orcas vs Sharks" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Master the hunt. Perfect the surround. Outsmart your opponent.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("A BAGHCHAL STRATEGY GAME").first(),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Play Now" })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Orcas vs Sharks board preview" }),
  ).toBeVisible();
  await expect(page.getByLabel("Site appearance")).toHaveCount(0);
  for (const heading of ["Play Online", "Play vs Computer", "Local Play"])
    await expect(modes.getByRole("heading", { name: heading })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Set up a computer game" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Play locally" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Solve today’s puzzle" }),
  ).toBeVisible();
  const onlineMode = modes.locator(".home-mode-card").filter({
    has: page.getByRole("heading", { name: "Play Online" }),
  });
  await expect(
    onlineMode.getByRole("button", { name: "Currently unavailable" }),
  ).toBeDisabled();
  await expect(onlineMode).toContainText(
    "Online matches are unavailable on this deployment.",
  );
  await expect(
    nav.getByRole("link", { name: "Play", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("button", { name: "Open settings" }),
  ).toBeVisible();
  await expect(accountLink).toBeVisible();
  await expect(page.locator("#online-account")).toHaveCount(0);
  await expect(rules).toBeVisible();
  const instructions = page.getByRole("dialog", { name: "How to Play" });
  await expect(instructions).toBeHidden();
  await rules.focus();
  await page.keyboard.press("Enter");
  await expect(instructions.getByText("Lesson 1 of 6")).toBeVisible();
  const replay = instructions.getByRole("button", {
    name: "Replay Animation",
  });
  await expect(replay).toBeEnabled();
  await replay.click();
  await expect(replay).toBeDisabled();
  await expect(replay).toBeEnabled();
  await instructions.getByRole("button", { name: "Next" }).click();
  await expect(
    instructions.getByRole("heading", {
      name: "Orcas move during placement",
    }),
  ).toBeVisible();
  await expect(instructions.locator(".tutorial-guide-arrow line")).toHaveCount(
    1,
  );
  await instructions.getByRole("button", { name: "Previous" }).click();
  await instructions.locator(".tutorial-quick-rules summary").click();
  await expect(
    instructions.getByRole("heading", { name: "Sharks surround" }),
  ).toBeVisible();
  await expect(
    instructions.getByRole("heading", { name: "Orcas capture" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.keyboard.press("Escape");
  await expect(instructions).toBeHidden();
  await expect(rules).toBeFocused();

  await modes.getByRole("link", { name: "Set up a computer game" }).click();
  const setup = page.getByRole("dialog", { name: "Choose your opponent" });
  await expect(setup).toBeVisible();
  await setup.getByLabel("Opponent").selectOption("friend");
  await setup.getByRole("button", { name: "Start game" }).click();
  await expect(setup).toBeHidden();
  await expect(nav).toHaveCount(1);
  await expect(nav.getByRole("button", { name: "How to Play" })).toHaveCount(1);
  await page.getByRole("button", { name: "c3, empty", exact: true }).click();
  await expect(page.getByRole("log", { name: "Move history" })).toContainText(
    "c3",
  );
  await page.getByRole("link", { name: "GridLox Games home" }).click();
  await page.getByRole("link", { name: "Play locally" }).click();
  await expect(
    page.getByRole("button", { name: "c3, shark", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("the tutorial allows board practice and can be skipped into play", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "How to Play" })
    .click();

  const tutorial = page.getByRole("dialog", { name: "How to Play" });
  const board = tutorial.getByRole("region", { name: "Tutorial board" });
  await expect(
    tutorial.getByRole("button", { name: "Replay Animation" }),
  ).toBeEnabled();
  const boardBounds = await board.boundingBox();
  const instructionBounds = await tutorial
    .locator(".tutorial-instructions")
    .boundingBox();
  expect(boardBounds).not.toBeNull();
  expect(instructionBounds).not.toBeNull();
  expect(boardBounds!.y).toBeLessThan(instructionBounds!.y);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);

  await board.getByRole("button", { name: "a1, orca" }).click();
  await expect(board.getByRole("status")).toContainText("occupied");
  await board.getByRole("button", { name: /marked for the exercise/ }).click();
  await expect(board.getByRole("status")).toContainText("Good placement");
  await expect(
    tutorial.getByRole("button", { name: "Start Playing" }),
  ).toBeHidden();
  await tutorial.getByRole("button", { name: "Skip Tutorial" }).click();
  await tutorial.getByRole("button", { name: "Start Playing" }).click();
  await expect(page).toHaveURL("/play");
});

test("finishing the tutorial replaces Next with Let’s Play and opens game setup", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/", "/play"]) {
    await page.goto(path);
    await page.getByRole("button", { name: "How to Play" }).click();

    const tutorial = page.getByRole("dialog", { name: "How to Play" });
    const next = tutorial.getByRole("button", { name: "Next", exact: true });
    const letsPlay = tutorial.getByRole("button", { name: "Let’s Play!" });
    for (let lesson = 1; lesson < 6; lesson++) await next.click();
    await expect(tutorial.getByText("Lesson 6 of 6")).toBeVisible();
    await expect(next).toBeDisabled();
    await expect(letsPlay).toHaveCount(0);

    const board = tutorial.getByRole("region", { name: "Tutorial board" });
    await expect(
      board.getByRole("button", { name: "Replay Animation" }),
    ).toBeEnabled();
    await board
      .getByRole("button", { name: /marked for the exercise/ })
      .click();
    await expect(
      tutorial.getByText("Tutorial complete. You are ready to play."),
    ).toBeVisible();
    await expect(next).toHaveCount(0);
    await expect(
      tutorial.getByRole("button", { name: "Previous" }),
    ).toBeEnabled();
    await letsPlay.click();

    const setup = page.getByRole("dialog", { name: "Choose your opponent" });
    await expect(setup).toBeVisible();
    await expect(tutorial).toBeHidden();
    await expect(setup.getByLabel("Opponent")).toBeFocused();
    await expect(
      setup.getByRole("button", { name: "Start game" }),
    ).toBeVisible();
  }
});

test("the landing gear changes the preferences used on the game board", async ({
  page,
}) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(page.getByLabel("Site appearance")).toHaveCount(0);

  await header.getByRole("button", { name: "Open settings" }).click();
  const settings = page.getByRole("dialog", { name: "Your ocean table" });
  await settings.getByLabel("Board theme").selectOption("tigers-goats");
  await settings.getByLabel("Move sounds").check();
  await settings.getByLabel("Animations").uncheck();
  await settings.getByLabel("Site appearance").selectOption("ivory");
  await settings.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator(".lobby-board-preview")).toHaveClass(
    /theme-tigers-goats/,
  );

  await header.getByRole("link", { name: "Play", exact: true }).click();
  await expect(page).toHaveURL("/play");
  await expect(
    page.getByRole("button", { name: "a1, tiger", exact: true }),
  ).toBeVisible();
  await header.getByRole("button", { name: "How to Play" }).click();
  const tutorial = page.getByRole("dialog", { name: "How to Play" });
  await expect(
    tutorial.getByRole("button", { name: "a1, tiger", exact: true }),
  ).toBeVisible();
  await tutorial.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-site-theme",
    "ivory",
  );
  await header.getByRole("button", { name: "Open settings" }).click();
  await expect(settings.getByLabel("Move sounds")).toBeChecked();
  await expect(settings.getByLabel("Animations")).not.toBeChecked();
});

test("the official logo loads at the right size and links home from the header", async ({
  page,
}) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  const homeLink = header.getByRole("link", { name: "GridLox Games home" });
  const headerLogo = homeLink.getByRole("img", { name: "GridLox Games" });
  const footerLogo = page
    .getByRole("contentinfo")
    .getByRole("img", { name: "GridLox Games" });
  const boardPreview = page.getByRole("img", {
    name: "Orcas vs Sharks board preview",
  });
  await expect(boardPreview).toBeVisible();
  await expect(
    page.locator(".lobby-board-preview .board-node[tabindex='0']"),
  ).toHaveCount(0);

  for (const logo of [headerLogo, footerLogo]) {
    await expect(logo).toBeVisible();
    await expect
      .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    const url = new URL(
      await logo.evaluate((img: HTMLImageElement) => img.currentSrc),
    );
    expect(url.pathname).toBe("/_next/image");
    expect(url.searchParams.get("url")).toBe("/logo/logo.png");
    const { width, height } = (await logo.boundingBox())!;
    expect(Math.abs(height - (width * 1008) / 1062)).toBeLessThan(1);
  }

  const viewportWidth = page.viewportSize()!.width;
  const nav = header.getByRole("navigation", { name: "Main navigation" });
  const play = nav.getByRole("link", { name: "Play", exact: true });
  const rules = nav.getByRole("button", { name: "How to Play" });
  const settings = nav.getByRole("button", { name: "Open settings" });
  const headerBounds = (await headerLogo.boundingBox())!;
  const navBounds = (await nav.boundingBox())!;
  expect(headerBounds.width).toBe(viewportWidth <= 700 ? 48 : 56);
  expect(
    Math.abs(
      headerBounds.y +
        headerBounds.height / 2 -
        (navBounds.y + navBounds.height / 2),
    ),
  ).toBeLessThan(1);

  await expect(header.locator(".header-inner")).toHaveCSS(
    "max-width",
    "1440px",
  );
  const { height } = (await header.boundingBox())!;
  expect(height).toBeGreaterThanOrEqual(72);
  expect(height).toBeLessThanOrEqual(80);
  await expect(play).toHaveCSS("background-color", "rgb(213, 165, 71)");
  for (const control of [play, rules, settings]) {
    await expect(control.locator("svg")).toBeVisible();
  }
  await homeLink.focus();
  await page.keyboard.press("Tab");
  await expect(play).toBeFocused();
  await expect(play).toHaveCSS("outline-style", "solid");

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/play");
  await expect(play).toHaveAttribute("aria-current", "page");
  if (viewportWidth <= 700) {
    await page.setViewportSize({ width: 320, height: 740 });
    const menu = nav.getByRole("button", { name: "More navigation" });
    await menu.click();
    await expect(
      nav.getByRole("link", { name: "Daily Puzzle" }),
    ).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
    for (const control of [
      homeLink,
      play,
      rules,
      settings,
      header.getByRole("link", { name: "Login" }),
    ]) {
      await expect(control).toBeInViewport({ ratio: 1 });
    }
  }
  await homeLink.click();
  await expect(page).toHaveURL("/");
});

test("the branded home links navigate to their features", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("GridLox Games");
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
    "content",
    "GridLox Games",
  );
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
    "content",
    "GridLox Games",
  );
  const image = new URL(
    (await page.locator('meta[property="og:image"]').getAttribute("content"))!,
  );
  expect((await page.request.get(image.pathname)).ok()).toBe(true);
  await expect(
    page.locator("footer").getByRole("img", { name: "GridLox Games" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Orcas vs Sharks" }),
  ).toBeVisible();

  for (const route of [
    { link: "Learn to Play", title: "Learn to Play", url: "/learn" },
    { link: "Daily Puzzle", title: "Daily Puzzle", url: "/daily-puzzle" },
  ]) {
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    const menu = nav.getByRole("button", { name: "More navigation" });
    const inHeader = route.url !== "/learn";
    if (inHeader && (await menu.isVisible())) await menu.click();
    await (inHeader ? nav : page.getByRole("main"))
      .getByRole("link", { name: route.link, exact: true })
      .click();
    await expect(page).toHaveURL(route.url);
    await expect(page).toHaveTitle(`${route.title} | GridLox Games`);
    await expect(
      page.getByRole("heading", { name: route.title, exact: true, level: 1 }),
    ).toBeVisible();
    if (inHeader) {
      if (await menu.isVisible()) await menu.click();
      await expect(nav.getByRole("link", { name: route.link })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
    await page.getByRole("link", { name: "GridLox Games home" }).click();
  }
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: "Daily Puzzle", exact: true }),
  ).toHaveCount(0);
});

test("the footer links to site information and Baghchal support", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(
    footer.getByRole("img", { name: "GridLox Games" }),
  ).toBeVisible();
  await expect(footer).toContainText(/© \d{4} GridLox Games/);

  const sections = [
    {
      link: "About",
      url: "/about",
      heading: "About GridLox Games",
    },
    {
      link: "The Project",
      url: "/about#project",
      heading: "About the Project",
    },
    {
      link: "Contact & Feedback",
      url: "/about#contact",
      heading: "Contact & Feedback",
    },
    {
      link: "Support Baghchal",
      url: "/support",
      heading: "Preserve a Tradition. Build Its Future.",
    },
  ];
  for (const { link, url, heading } of sections) {
    await footer.getByRole("link", { name: link, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeInViewport();
    await page
      .getByRole("banner")
      .getByRole("link", { name: "GridLox Games home" })
      .click();
    await expect(page).toHaveURL("/");
  }

  await page.goto("/about");
  await expect(page).toHaveTitle("About | GridLox Games");
  await expect(
    page.getByRole("heading", { name: "About GridLox Games" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Prajwal Niraula" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Project Vision" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Share feedback on GitHub" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/prajwal309/OrcasVsShark/issues",
  );
  await page.goto("/");
  const landingSupport = page
    .getByRole("main")
    .getByRole("link", { name: "Support Baghchal", exact: true });
  const supportGoal = page.locator("#lobby-support-goal");
  await expect(supportGoal).toHaveCSS("opacity", "0");
  await landingSupport.hover();
  await expect(supportGoal).toHaveCSS("opacity", "1");
  await expect(supportGoal).toContainText(
    "Our next goal is to help cover the server rental.",
  );
  await landingSupport.click();
  await expect(page).toHaveURL("/support");
  await expect(
    page.getByRole("heading", {
      name: "Preserve a Tradition. Build Its Future.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Buy Me a Coffee/ }),
  ).toHaveAttribute("href", "https://buymeacoffee.com/fznfire");
  const milestoneDetails = page.locator("details");
  await expect(milestoneDetails).toHaveCount(4);
  for (const title of [
    "Keep the Game Running",
    "Improve the Gaming Experience",
    "Grow the Community",
    "Bring Baghchal to Mobile",
  ]) {
    const milestone = milestoneDetails.filter({ hasText: title });
    await milestone.locator("summary").click();
    await expect(
      milestone.getByText("Planned use at this cumulative milestone"),
    ).toBeVisible();
  }
  await expect(
    page.getByText(/not actual spending or confirmed budgets/),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("the hero keeps play, learning, and support actions distinct", async ({
  page,
}) => {
  await page.goto("/");
  const actions = page.locator(".lobby-hero-actions");
  await expect(actions.getByRole("link")).toHaveCount(3);

  const playNow = actions.getByRole("link", { name: "Play Now" });
  const learn = actions.getByRole("link", { name: "Learn to Play" });
  const support = actions.getByRole("link", { name: "Support Baghchal" });
  await expect(playNow).toHaveCSS("background-color", "rgb(213, 165, 71)");
  await expect(support).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(support).toHaveCSS("border-top-color", "rgb(110, 76, 18)");
  if (page.viewportSize()!.width > 900) {
    const bounds = await Promise.all(
      [playNow, learn, support].map((link) => link.boundingBox()),
    );
    expect(bounds.every((box) => box?.height === bounds[0]?.height)).toBe(true);
    expect(
      Math.max(...bounds.map((box) => box!.y)) -
        Math.min(...bounds.map((box) => box!.y)),
    ).toBeLessThan(1);
  }

  const supportGoal = page.locator("#lobby-support-goal");
  await expect(supportGoal).toHaveCSS("opacity", "0");
  await support.hover();
  await expect(supportGoal).toHaveCSS("opacity", "1");
  await playNow.click();
  await expect(page).toHaveURL("/play");

  await page.goto("/");
  await learn.click();
  await expect(page).toHaveURL("/learn");

  await page.goto("/");
  await support.click();
  await expect(page).toHaveURL("/support");
});
