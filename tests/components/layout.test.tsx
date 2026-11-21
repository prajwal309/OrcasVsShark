import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import RootLayout from "@/app/layout";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-nonce": "test-nonce" }),
  cookies: async () => ({ get: () => undefined }),
}));

it("hydrates with a restored site theme and extension attributes", async () => {
  const tree = await RootLayout({ children: <main>Ocean table</main> });
  const document = window.document.implementation.createHTMLDocument();
  document.open();
  document.write(renderToString(tree));
  document.close();
  expect(document.head.querySelector("script")?.nonce).toBe("test-nonce");
  document.documentElement.dataset.siteTheme = "ivory";
  document.body.setAttribute("data-new-gr-c-s-check-loaded", "14.1332.0");
  document.body.setAttribute("data-gr-ext-installed", "");
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(document, tree);
    });
    expect(document.body.textContent).toBe("Ocean table");
    expect(document.documentElement.dataset.siteTheme).toBe("ivory");
    expect(error).not.toHaveBeenCalled();
  } finally {
    await act(async () => root?.unmount());
    error.mockRestore();
  }
});
