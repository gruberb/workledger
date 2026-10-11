import {
  SettingsMenuItem,
  SettingsSubmenuItem,
  SettingsSubmenuHeader,
  SettingsOption,
  SettingsMenuDivider,
  settingsMutedClass,
  settingsDividerClass,
  useSettingsMenu,
} from "../features/sidebar/index.ts";
import { THEME_PRESETS, FONT_OPTIONS, useThemeContext } from "../features/theme/index.ts";
import { StorageSubmenu, useSyncContext } from "../features/sync/index.ts";
import { useAIContext } from "../features/ai/index.ts";

/** Cross-feature items for the sidebar settings menu, slotted in by App. */
export function SettingsMenuItems() {
  const { themeId, fontFamily } = useThemeContext();
  const { config: syncConfig } = useSyncContext();
  const { settings: aiSettings, handleToggleAI } = useAIContext();

  const activeTheme = THEME_PRESETS.find((p) => p.id === themeId);
  const activeFont = FONT_OPTIONS.find((f) => f.id === fontFamily);

  return (
    <>
      <SettingsMenuItem onClick={handleToggleAI}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a8 8 0 0 0-8 8c0 3.36 2.07 6.24 5 7.42V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.58c2.93-1.18 5-4.06 5-7.42a8 8 0 0 0-8-8z" />
          <line x1="9" y1="22" x2="15" y2="22" />
        </svg>
        {aiSettings.enabled ? "Disable AI" : "Enable AI"}
        {aiSettings.enabled && <span className="ml-auto w-2 h-2 rounded-full bg-green-500" />}
      </SettingsMenuItem>

      <SettingsMenuDivider />

      <SettingsSubmenuItem
        icon={<span className="w-3 h-3 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: activeTheme?.accentColor }} />}
        label="Theme"
        detail={activeTheme?.label}
        submenu={<ThemeSubmenu />}
      />

      <SettingsSubmenuItem
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
          </svg>
        }
        label="Note font"
        detail={activeFont?.label}
        submenu={<FontSubmenu />}
      />

      <SettingsSubmenuItem
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          </svg>
        }
        label="Storage"
        detail={syncConfig.mode === "remote" ? "Remote" : "Local"}
        submenu={<StorageMenu />}
      />
    </>
  );
}

function ThemeSubmenu() {
  const { themeId, setTheme } = useThemeContext();
  return (
    <>
      <SettingsSubmenuHeader title="Theme" />
      {THEME_PRESETS.map((preset) => (
        <SettingsOption key={preset.id} selected={themeId === preset.id} onSelect={() => setTheme(preset.id)}>
          <span className="w-3 h-3 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: preset.accentColor }} />
          <span className="flex-1">{preset.label}</span>
        </SettingsOption>
      ))}
    </>
  );
}

function FontSubmenu() {
  const { fontFamily, setFont } = useThemeContext();
  return (
    <>
      <SettingsSubmenuHeader title="Note Font" />
      {FONT_OPTIONS.map((font) => (
        <SettingsOption key={font.id} selected={fontFamily === font.id} onSelect={() => setFont(font.id)}>
          <span className="flex-1" style={{ fontFamily: font.cssValue }}>{font.label}</span>
        </SettingsOption>
      ))}
    </>
  );
}

function StorageMenu() {
  const { back } = useSettingsMenu();
  return <StorageSubmenu mutedClass={settingsMutedClass} dividerClass={settingsDividerClass} onBack={back} />;
}
