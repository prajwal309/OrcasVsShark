// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { beginGoogle, googleSubject } from "@/lib/auth/google";

const config = {
  clientId: "local-test-id",
  clientSecret: "local-test-secret",
  origin: "http://localhost:3000",
  redirectUri: "http://localhost:3000/api/account/google/callback",
};
afterEach(() => vi.unstubAllGlobals());

it("creates fresh state and binds the Google authorization code to its PKCE verifier", () => {
  const attempt = beginGoogle(config);
  const url = new URL(attempt.url);
  expect(url.origin).toBe("https://accounts.google.com");
  expect(url.searchParams.get("scope")).toBe("openid");
  expect(url.searchParams.get("state")).toBe(attempt.state);
  expect(url.searchParams.get("code_challenge")).toBe(
    createHash("sha256").update(attempt.verifier).digest("base64url"),
  );
  expect(beginGoogle(config).state).not.toBe(attempt.state);
  expect(attempt.url).not.toContain(config.clientSecret);
});

it("gets the stable Google subject through the server-side code exchange", async () => {
  const fetchGoogle = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ access_token: "provider-token" }))
    .mockResolvedValueOnce(Response.json({ sub: "stable-account-id" }));
  vi.stubGlobal("fetch", fetchGoogle);
  await expect(googleSubject(config, "code", "verifier")).resolves.toBe(
    "stable-account-id",
  );
  const [tokenUrl, tokenRequest] = fetchGoogle.mock.calls[0];
  expect(tokenUrl).toBe("https://oauth2.googleapis.com/token");
  expect(tokenRequest.body.get("code_verifier")).toBe("verifier");
  expect(tokenRequest.body.get("redirect_uri")).toBe(config.redirectUri);
  expect(fetchGoogle.mock.calls[1][1].headers.Authorization).toBe(
    "Bearer provider-token",
  );
});
