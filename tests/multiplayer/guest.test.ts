import { describe, expect, it } from "vitest";
import { requireRegisteredAccount } from "@/lib/multiplayer/http";

describe("guest account boundaries", () => {
  it("allows ranked-only operations for registered accounts", () => {
    expect(() => requireRegisteredAccount(false)).not.toThrow();
  });

  it("rejects ranked-only operations for guest identities", () => {
    expect(() => requireRegisteredAccount(true)).toThrow(
      "Create an account to use this feature.",
    );
  });
});
