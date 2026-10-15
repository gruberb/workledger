// IBM Plex Sans for PDF downloads. The app's own fonts are subset variable WOFF2
// files, which the PDF renderer can't embed; these are static WOFF files, and
// Vite emits them as assets fetched only when a PDF is made.
import regular from "@ibm/plex-sans/fonts/complete/woff/IBMPlexSans-Regular.woff?url";
import bold from "@ibm/plex-sans/fonts/complete/woff/IBMPlexSans-Bold.woff?url";
import italic from "@ibm/plex-sans/fonts/complete/woff/IBMPlexSans-Italic.woff?url";
import boldItalic from "@ibm/plex-sans/fonts/complete/woff/IBMPlexSans-BoldItalic.woff?url";

export interface PdfFontFiles {
  regular: string;
  bold: string;
  italic: string;
  boldItalic: string;
}

export const PLEX_SANS_FILES: PdfFontFiles = { regular, bold, italic, boldItalic };
