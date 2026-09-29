import { z } from "zod";
import { NODES } from "./graph";
import { createPositionKey } from "./position-key";
import { getGameResult } from "./result";
import { GameError, type GameState } from "./types";

const resultSchema = z
  .object({
    winner: z.enum(["orcas", "sharks"]),
    reason: z.enum(["five-captures", "immobilization"]),
  })
  .strict()
  .nullable();
const stateSchema = z
  .object({
    board: z.record(
      z.string().regex(/^[a-e][1-5]$/),
      z.enum(["orca", "shark"]),
    ),
    turn: z.enum(["orcas", "sharks"]),
    phase: z.enum(["shark-placement", "shark-movement"]),
    sharksPlaced: z.number().int().min(0).max(20),
    sharksCaptured: z.number().int().min(0).max(5),
    ply: z.number().int().min(0).max(10000),
    history: z.array(z.string().max(100)).min(1).max(10001),
    result: resultSchema,
  })
  .strict();
const envelopeSchema = z
  .object({ version: z.literal(1), state: stateSchema })
  .strict();
export function deserializeState(payload: string): GameState {
  try {
    if (payload.length > 1_500_000) throw new Error();
    const { state } = envelopeSchema.parse(JSON.parse(payload));
    const parsed: GameState = state;
    const pieces = Object.values(parsed.board);
    if (
      pieces.filter((p) => p === "orca").length !== 4 ||
      pieces.filter((p) => p === "shark").length !==
        parsed.sharksPlaced - parsed.sharksCaptured ||
      parsed.phase !==
        (parsed.sharksPlaced === 20 ? "shark-movement" : "shark-placement") ||
      parsed.ply < parsed.sharksPlaced ||
      parsed.history.length !== parsed.ply + 1 ||
      parsed.turn !== (parsed.ply % 2 === 0 ? "sharks" : "orcas") ||
      parsed.history.at(-1) !== createPositionKey(parsed) ||
      NODES.some(
        (n) => parsed.board[n] && !["orca", "shark"].includes(parsed.board[n]!),
      ) ||
      JSON.stringify(parsed.result) !== JSON.stringify(getGameResult(parsed))
    )
      throw new Error();
    return parsed;
  } catch {
    throw new GameError(
      "INVALID_STATE",
      "This saved position is invalid or uses an unsupported version.",
    );
  }
}
export function serializeState(state: GameState): string {
  const payload = JSON.stringify({ version: 1, state });
  deserializeState(payload);
  return payload;
}
