import type { ReactNode } from "react";
import { ArchiveIcon, CalendarIcon, JournalIcon } from "../../../components/ui/Icons.tsx";
import type { SidebarView } from "../context/SidebarContext.tsx";

/** The app's views in display order; the sidebar and the header view menu list the same ones. */
export const SIDEBAR_VIEWS: { view: SidebarView; label: string; icon: ReactNode }[] = [
  { view: "journal", label: "Journal", icon: <span className="notebook-nav-icon" data-view="journal"><JournalIcon size={20} /></span> },
  { view: "review", label: "Weekly review", icon: <span className="notebook-nav-icon" data-view="review"><CalendarIcon size={20} /></span> },
  { view: "archive", label: "Archive", icon: <span className="notebook-nav-icon" data-view="archive"><ArchiveIcon size={20} /></span> },
];
