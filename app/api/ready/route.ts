import { transaction } from "@/lib/database/connection";

export const runtime = "nodejs";

export function GET() {
  try {
    transaction((db) => db.query("SELECT id FROM accounts LIMIT 1"));
    return Response.json(
      { status: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
