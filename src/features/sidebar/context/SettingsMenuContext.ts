import { createContext, useContext, type ReactNode } from "react";

export interface SettingsMenuControls {
  /** Replace the menu content with a submenu. */
  openSubmenu: (content: ReactNode) => void;
  /** Return from a submenu to the root menu. */
  back: () => void;
  /** Close the whole menu. */
  close: () => void;
}

export const SettingsMenuContext = createContext<SettingsMenuControls | null>(null);

/** For items slotted into the sidebar settings menu from outside the sidebar feature. */
export function useSettingsMenu(): SettingsMenuControls {
  const ctx = useContext(SettingsMenuContext);
  if (!ctx) throw new Error("useSettingsMenu must be used inside the sidebar settings menu");
  return ctx;
}
