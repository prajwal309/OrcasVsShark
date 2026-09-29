import { accessToken } from "@/lib/auth/browser";
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
  const token = await accessToken();
  const response = await fetch(`/api/rooms${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data.code, data.error);
  data.state = deserializeState(
    JSON.stringify({ version: 1, state: data.state }),
  );
  return data;
}
