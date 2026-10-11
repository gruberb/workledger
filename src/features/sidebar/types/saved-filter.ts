import type { EntrySignifier } from "../../entries/index.ts";

export interface SavedFilter {
  id: string;
  name: string;
  tags: string[];
  textQuery: string;
  signifiers: EntrySignifier[];
}

/** The filter state a saved filter is compared against and applied to. */
export interface FilterState {
  tags: string[];
  textQuery: string;
  signifiers: EntrySignifier[];
}
