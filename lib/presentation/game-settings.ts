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

export function readGameSettings(initialTheme?: BoardTheme): GameSettings {
  let settings = defaultGameSettings;
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) ?? "null");
    if (
      saved &&
      typeof saved.sound === "boolean" &&
      typeof saved.motion === "boolean" &&
      isBoardTheme(saved.theme)
    ) {
      settings = {
        sound: saved.sound,
        motion: saved.motion,
        theme: saved.theme,
      };
    }
  } catch {
    // Defaults are available if browser storage is disabled.
  }
  if (!initialTheme) return settings;

  let theme = initialTheme;
  try {
    const saved = localStorage.getItem(`${settingsKey}.theme.${initialTheme}`);
    if (isBoardTheme(saved)) theme = saved;
  } catch {
    // Use the page's starting theme if storage is disabled.
  }
  return { ...settings, theme };
}

export function saveGameSettings(
  settings: GameSettings,
  initialTheme?: BoardTheme,
) {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
  if (initialTheme)
    localStorage.setItem(
      `${settingsKey}.theme.${initialTheme}`,
      settings.theme,
    );
}
