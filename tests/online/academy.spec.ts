import { randomBytes } from "node:crypto";
import { test, expect } from "@playwright/test";

const headers = { Origin: "http://127.0.0.1:3100" };

test("account progress synchronizes to a new browser without merging guest progress", async ({
  page,
  browser,
}) => {
  await page.goto("/learn?section=lessons&activity=meet-the-sides");
  await expect(page.getByRole("button", { name: "Show hint" })).toBeEnabled();
  await page.getByRole("button", { name: /^c3,/ }).click();
  await expect(page.getByText("Lesson complete!")).toBeVisible();

  const username = `academy_${randomBytes(5).toString("hex")}`;
  const password = "learning password";
  const registration = await page.request.post("/api/account", {
    headers,
    data: {
      action: "register",
      username,
      email: username + "@example.test",
      password,
      confirmPassword: password,
    },
  });
  expect(registration.ok()).toBe(true);
  await page.goto("/learn?section=progress");
  await expect(page.getByText("Saved to your account.")).toBeVisible();
  await expect(page.getByText("0 / 20")).toBeVisible();

  await page.goto("/learn?section=lessons&activity=meet-the-sides");
  await expect(page.getByRole("button", { name: "Show hint" })).toBeEnabled();
  const saved = page.waitForResponse(
    async (response) =>
      response.url().endsWith("/api/learn") &&
      response.ok() &&
      response.request().postDataJSON().action === "attempt",
  );
  await page.getByRole("button", { name: /^c3,/ }).click();
  await saved;
  await expect(page.getByText("Lesson complete!")).toBeVisible();

  const second = await browser.newContext();
  try {
    const login = await second.request.post("/api/account", {
      headers,
      data: { action: "login", username, password },
    });
    expect(login.ok()).toBe(true);
    const other = await second.newPage();
    await other.goto("http://127.0.0.1:3100/learn?section=progress");
    await expect(other.getByText("1 / 20")).toBeVisible();
    await expect(other.getByText("First Lesson (earned)")).toBeVisible();
  } finally {
    await second.close();
  }
});
