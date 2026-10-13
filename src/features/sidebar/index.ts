// Public API for the sidebar feature
export { Sidebar } from "./components/Sidebar.tsx";
export { SIDEBAR_VIEWS } from "./utils/views.tsx";
export { SidebarProvider, useSidebarUI, useSidebarFilter, useSidebarData, type SidebarView } from "./context/SidebarContext.tsx";
export { SaveFilterButton } from "./components/SavedFilters.tsx";
export type { SavedFilter } from "./types/saved-filter.ts";

// Settings menu building blocks, for items the app composes into the sidebar settings slot
export { useSettingsMenu } from "./context/SettingsMenuContext.ts";
export {
  SettingsMenuItem,
  SettingsSubmenuItem,
  SettingsSubmenuHeader,
  SettingsOption,
  SettingsMenuDivider,
  settingsMutedClass,
  settingsDividerClass,
} from "./components/SettingsMenu.tsx";
