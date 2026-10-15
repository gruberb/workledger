// Shared look of PDF and Word downloads: Google Docs' defaults in IBM Plex Sans,
// so a download reads like a document written there.
export const DOCUMENT_FONT = "IBM Plex Sans";
export const BODY_PT = 11;
export const LINE_HEIGHT = 1.15;
export const PARAGRAPH_AFTER_PT = 6;
export const LIST_ITEM_AFTER_PT = 3;
export const LINK_COLOR = "#1155CC";

/** Google Docs' heading sizes and spacing in points, H1 to H6, regular weight in black. */
export const HEADINGS: { size: number; before: number; after: number }[] = [
  { size: 20, before: 20, after: 6 },
  { size: 16, before: 18, after: 6 },
  { size: 14, before: 16, after: 4 },
  { size: 12, before: 14, after: 4 },
  { size: 11, before: 12, after: 4 },
  { size: 11, before: 12, after: 4 },
];
