// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { requireSameOrigin } from "@/lib/auth/session";

afterEach(() => vi.unstubAllEnvs());

function request(origin: string, host: string, protocol = "http") {
  return new Request(`${protocol}://localhost/api/account`, {
    method: "POST",
    headers: { Origin: origin, Host: host },
  });
}

it("accepts same-origin loopback hosts and alternate Next.js ports in local mode", () => {
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  expect(
    requireSameOrigin(request("http://localhost:3000", "localhost:3000")),
  ).toBe(false);
  expect(() =>
    requireSameOrigin(request("http://localhost:3000", "localhost:3001")),
  ).toThrow();
  expect(
    requireSameOrigin(request("http://127.0.0.1:3001", "127.0.0.1:3001")),
  ).toBe(false);
  expect(requireSameOrigin(request("http://[::1]:3002", "[::1]:3002"))).toBe(
    false,
  );
  expect(() =>
    requireSameOrigin(request("http://localhost:3001", "localhost:3002")),
  ).toThrow();
  expect(() =>
    requireSameOrigin(request("http://outside.example", "outside.example")),
  ).toThrow();
});

it("requires the configured origin for HTTPS and Google callbacks", () => {
  vi.stubEnv("APP_ORIGIN", "https://orcas.example");
  expect(
    requireSameOrigin(request("https://orcas.example", "internal", "https")),
  ).toBe(true);
  expect(() =>
    requireSameOrigin(request("http://localhost:3001", "localhost:3001")),
  ).toThrow();
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  expect(() =>
    requireSameOrigin(request("http://localhost:3001", "localhost:3001"), {
      allowLocalAddress: false,
    }),
  ).toThrow("Open the game at http://localhost:3000 and try again.");
});
