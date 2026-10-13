import type { ReactNode } from "react";
import { ArchiveIcon, CalendarIcon, JournalIcon } from "../../../components/ui/Icons.tsx";
import type { SidebarView } from "../context/SidebarContext.tsx";

/** The app's views in display order; the sidebar and the header view menu list the same ones. */
export const SIDEBAR_VIEWS: { view: SidebarView; label: string; icon: ReactNode }[] = [
  { view: "journal", label: "Journal", icon: <JournalIcon size={16} /> },
  { view: "review", label: "Weekly review", icon: <CalendarIcon size={16} /> },
  { view: "archive", label: "Archive", icon: <ArchiveIcon size={16} /> },
];
