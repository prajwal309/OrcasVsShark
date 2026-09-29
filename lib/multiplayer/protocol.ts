import { z } from "zod";
import type { GameState, Move, Side } from "@/lib/game/types";

const node = z.string().regex(/^[a-e][1-5]$/);
export const moveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("place"), to: node }).strict(),
  z.object({ kind: z.literal("step"), from: node, to: node }).strict(),
  z
    .object({ kind: z.literal("capture"), from: node, over: node, to: node })
    .strict(),
]);
export const roomCodeSchema = z.string().regex(/^[A-Z2-9]{8}$/);
export const requestSchema = z
  .object({
    requestId: z.uuid(),
    expectedPly: z.number().int().min(0).max(10000),
    expectedRevision: z.number().int().min(0),
    action: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("join") }).strict(),
      z.object({ kind: z.literal("move"), move: moveSchema }).strict(),
      z.object({ kind: z.literal("resign") }).strict(),
      z.object({ kind: z.literal("offer-draw") }).strict(),
      z.object({ kind: z.literal("accept-draw") }).strict(),
      z.object({ kind: z.literal("decline-draw") }).strict(),
      z.object({ kind: z.literal("rematch") }).strict(),
    ]),
  })
  .strict();
export type RoomRequest = z.infer<typeof requestSchema>;
export type RoomAction = RoomRequest["action"];
export type Ending = { winner: Side | "draw"; reason: string };
export interface Room {
  code: string;
  orcas: string;
  sharks: string | null;
  state: GameState;
  moves: Move[];
  ending: Ending | null;
  revision: number;
  round: number;
  drawOffer: Side | null;
  rematchOffer: Side | null;
}
export interface RoomView extends Omit<Room, "orcas" | "sharks"> {
  side: Side;
  waiting: boolean;
  opponentOnline: boolean;
}
export class RoomError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function sideOf(room: Room, actor: string): Side | null {
  return room.orcas === actor
    ? "orcas"
    : room.sharks === actor
      ? "sharks"
      : null;
}
