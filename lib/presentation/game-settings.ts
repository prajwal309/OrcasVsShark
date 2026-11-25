import { isBoardTheme, type BoardTheme } from "./board-themes";

export type GameSettings = {
  sound: boolean;
  motion: boolean;
  theme: BoardTheme;
};
export const defaultGameSettings: GameSettings = {
  sound: false,
  motion: true,
  theme: "ocean",
};

const settingsKey = "orcas-sharks.settings.v1";

export function readGameSettings(): GameSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) ?? "null");
    if (
      saved &&
      typeof saved.sound === "boolean" &&
      typeof saved.motion === "boolean" &&
      isBoardTheme(saved.theme)
    ) {
      return { sound: saved.sound, motion: saved.motion, theme: saved.theme };
    }
  } catch {
    // Defaults are available if browser storage is disabled.
  }
  return defaultGameSettings;
}

export function saveGameSettings(settings: GameSettings) {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}
