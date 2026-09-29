export type File = "a" | "b" | "c" | "d" | "e";
export type Rank = 1 | 2 | 3 | 4 | 5;
export type NodeId = `${File}${Rank}`;
export type Side = "orcas" | "sharks";
export type Piece = "orca" | "shark";
export type Phase = "shark-placement" | "shark-movement";
export type PositionKey = string;
export type GameResult = {
  winner: Side;
  reason: "five-captures" | "immobilization";
};
export interface GameState {
  board: Partial<Record<NodeId, Piece>>;
  turn: Side;
  phase: Phase;
  sharksPlaced: number;
  sharksCaptured: number;
  ply: number;
  history: readonly PositionKey[];
  result: GameResult | null;
}
export type Move =
  | { kind: "place"; to: NodeId }
  | { kind: "step"; from: NodeId; to: NodeId }
  | { kind: "capture"; from: NodeId; over: NodeId; to: NodeId };
export class GameError extends Error {
  constructor(
    public readonly code: "ILLEGAL_MOVE" | "INVALID_STATE",
    message: string,
  ) {
    super(message);
    this.name = "GameError";
  }
}
