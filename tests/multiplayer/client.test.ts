import { afterEach, expect, it, vi } from "vitest";
import { roomApi } from "@/lib/multiplayer/client";

afterEach(() => vi.unstubAllGlobals());

it("preserves the HTTP status when a hosting error returns HTML", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("<h1>Service Unavailable</h1>", { status: 503 }),
      ),
  );
  await expect(roomApi("/ABCDEFGH")).rejects.toMatchObject({
    status: 503,
    code: "INVALID_OR_UNAVAILABLE",
    message: "The game service is unavailable. Please reconnect.",
  });
});

it("preserves a structured room error for client recovery", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { code: "NOT_SEATED", error: "Join this room to play." },
          { status: 403 },
        ),
      ),
  );
  await expect(roomApi("/ABCDEFGH")).rejects.toMatchObject({
    status: 403,
    code: "NOT_SEATED",
    message: "Join this room to play.",
  });
});
