import type { Piece, Side } from "@/lib/game/types";

export const BOARD_THEMES = ["ocean", "sand", "tigers-goats"] as const;
export type BoardTheme = (typeof BOARD_THEMES)[number];
export const isBoardTheme = (value: unknown): value is BoardTheme =>
  BOARD_THEMES.some((theme) => theme === value);

export function themeLabels(theme: BoardTheme = "ocean") {
  const forest = theme === "tigers-goats";
  return {
    sides: {
      orcas: forest ? "Tigers" : "Orcas",
      sharks: forest ? "Goats" : "Sharks",
    } satisfies Record<Side, string>,
    pieces: {
      orca: forest ? "tiger" : "orca",
      shark: forest ? "goat" : "shark",
    } satisfies Record<Piece, string>,
    hunter: forest ? "Tiger" : "Orca",
    defender: forest ? "Goat" : "Shark",
    caption: forest
      ? "FOREST TABLE · TIGERS & GOATS"
      : "CAPE COD · MASSACHUSETTS",
    landscape: forest ? "forest" : "ocean",
  };
}

export function themeResultReason(reason: string, theme: BoardTheme) {
  const labels = themeLabels(theme);
  if (reason === "Five Sharks captured")
    return `Five ${labels.sides.sharks} captured`;
  if (reason === "All four Orcas immobilized")
    return `All four ${labels.sides.orcas} immobilized`;
  return reason;
}
