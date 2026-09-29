import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import RootLayout from "@/app/layout";

it("hydrates when an extension adds body attributes before React loads", async () => {
  const tree = (
    <RootLayout>
      <main>Ocean table</main>
    </RootLayout>
  );
  const document = window.document.implementation.createHTMLDocument();
  document.open();
  document.write(renderToString(tree));
  document.close();
  document.body.setAttribute("data-new-gr-c-s-check-loaded", "14.1332.0");
  document.body.setAttribute("data-gr-ext-installed", "");
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(document, tree);
    });
    expect(document.body.textContent).toBe("Ocean table");
    expect(error).not.toHaveBeenCalled();
  } finally {
    await act(async () => root?.unmount());
    error.mockRestore();
  }
});
