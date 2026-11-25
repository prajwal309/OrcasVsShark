import { SiteThemeSelect } from "@/components/navigation/site-theme-select";
import { isBoardTheme } from "@/lib/presentation/board-themes";
import type { GameSettings } from "@/lib/presentation/game-settings";

export function GameSettingsPanel({
  settings,
  onChange,
}: {
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
}) {
  return (
    <div className="settings-content">
      <SiteThemeSelect />
      <label>
        Board theme
        <select
          value={settings.theme}
          onChange={({ currentTarget }) => {
            if (isBoardTheme(currentTarget.value))
              onChange({ ...settings, theme: currentTarget.value });
          }}
        >
          <option value="ocean">Deep ocean</option>
          <option value="sand">Sand table</option>
          <option value="tigers-goats">Tigers &amp; Goats</option>
        </select>
      </label>
      <label>
        Move sounds
        <input
          type="checkbox"
          checked={settings.sound}
          onChange={({ currentTarget }) =>
            onChange({ ...settings, sound: currentTarget.checked })
          }
        />
      </label>
      <label>
        Animations
        <input
          type="checkbox"
          checked={settings.motion}
          onChange={({ currentTarget }) =>
            onChange({ ...settings, motion: currentTarget.checked })
          }
        />
      </label>
      <p>
        Your preferences are saved on this device. Reduced-motion system
        preferences are always respected.
      </p>
    </div>
  );
}
