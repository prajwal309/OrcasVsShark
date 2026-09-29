import { applyMove } from "@/lib/game/apply-move";
import { createInitialState } from "@/lib/game/initial-state";
import type { Move } from "@/lib/game/types";
import { RoomError, sideOf, type Room, type RoomRequest } from "./protocol";

// Application actions wrap the canonical engine; there is no second rules engine.
export function transition(
  room: Room,
  actor: string,
  request: RoomRequest,
): Room {
  const side = sideOf(room, actor);
  const action = request.action;
  if (action.kind === "join") {
    if (side) return room;
    if (room.sharks)
      throw new RoomError(409, "ROOM_FULL", "Both seats are taken.");
    return { ...room, sharks: actor, revision: room.revision + 1 };
  }
  if (!side)
    throw new RoomError(
      403,
      "NOT_SEATED",
      "You do not have a seat in this game.",
    );
  if (
    request.expectedRevision !== room.revision ||
    request.expectedPly !== room.state.ply
  )
    throw new RoomError(
      409,
      "STALE_STATE",
      "The game has changed. Reconnecting to the latest position.",
    );
  if (!room.sharks)
    throw new RoomError(409, "WAITING", "Wait for your opponent to join.");
  if (action.kind === "rematch") {
    if (!room.ending)
      throw new RoomError(
        409,
        "GAME_ACTIVE",
        "Finish this game before a rematch.",
      );
    if (room.rematchOffer === side) return room;
    if (!room.rematchOffer)
      return { ...room, rematchOffer: side, revision: room.revision + 1 };
    return {
      ...room,
      orcas: room.sharks,
      sharks: room.orcas,
      state: createInitialState(),
      moves: [],
      ending: null,
      drawOffer: null,
      rematchOffer: null,
      round: room.round + 1,
      revision: room.revision + 1,
    };
  }
  if (room.ending) throw new RoomError(409, "GAME_OVER", "This game is over.");
  const next = { ...room, revision: room.revision + 1 };
  switch (action.kind) {
    case "move": {
      if (room.state.turn !== side)
        throw new RoomError(403, "OUT_OF_TURN", "It is your opponent’s turn.");
      if (room.state.ply >= 10000)
        throw new RoomError(
          409,
          "MOVE_LIMIT",
          "Move storage limit reached. Agree a draw or resign.",
        );
      const move = action.move as Move;
      try {
        next.state = applyMove(room.state, move);
      } catch {
        throw new RoomError(
          422,
          "ILLEGAL_MOVE",
          "That move is not legal in this position.",
        );
      }
      next.moves = [...room.moves, move];
      next.drawOffer = null;
      if (next.state.result)
        next.ending = {
          winner: next.state.result.winner,
          reason:
            next.state.result.reason === "five-captures"
              ? "Five Sharks captured"
              : "All four Orcas immobilized",
        };
      break;
    }
    case "resign":
      next.ending = {
        winner: side === "orcas" ? "sharks" : "orcas",
        reason: "Resignation",
      };
      next.drawOffer = null;
      break;
    case "offer-draw":
      if (room.drawOffer)
        throw new RoomError(
          409,
          "DRAW_PENDING",
          "There is already a draw offer.",
        );
      next.drawOffer = side;
      break;
    case "accept-draw":
      if (!room.drawOffer || room.drawOffer === side)
        throw new RoomError(
          409,
          "NO_OFFER",
          "Only your opponent can accept your draw offer.",
        );
      next.ending = { winner: "draw", reason: "Draw by agreement" };
      next.drawOffer = null;
      break;
    case "decline-draw":
      if (!room.drawOffer)
        throw new RoomError(409, "NO_OFFER", "There is no draw offer.");
      next.drawOffer = null;
      break;
  }
  return next;
}
