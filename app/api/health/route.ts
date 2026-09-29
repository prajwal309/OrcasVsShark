export function GET() {
  return Response.json({
    status: "ok",
    engine: "1.0.0",
    ruleset: "bagh-chal-ocean-v1",
  });
}
