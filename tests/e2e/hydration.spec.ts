import { expect, test } from "@playwright/test";

test("hydrates and plays with extension attributes on the body", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  // Reproduce Grammarly's DOM additions before React hydrates.
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (!document.body) return;
      document.body.setAttribute("data-new-gr-c-s-check-loaded", "14.1332.0");
      document.body.setAttribute("data-gr-ext-installed", "");
      observer.disconnect();
    });
    observer.observe(document, {
      childList: true,
      subtree: true,
    });
  });

  await page.goto("/");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute(
    "data-gr-ext-installed",
    "",
  );
  await page.getByRole("button", { name: "c3, empty", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Orcas to play" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "c3, shark", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
