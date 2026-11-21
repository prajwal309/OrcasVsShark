import { deserializeState } from "@/lib/game/serialization";
import type { RoomView } from "./protocol";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function roomApi(path: string, body?: unknown): Promise<RoomView> {
  const response = await fetch(`/api/rooms${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const data: { code?: string; error?: string } | null = await response
      .json()
      .catch(() => null);
    throw new ApiError(
      response.status,
      data?.code ?? "INVALID_OR_UNAVAILABLE",
      data?.error ?? "The game service is unavailable. Please reconnect.",
    );
  }
  const data = await response.json();
  data.state = deserializeState(
    JSON.stringify({ version: 1, state: data.state }),
  );
  return data;
}
