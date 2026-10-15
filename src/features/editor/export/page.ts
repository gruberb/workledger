export type PageSize = "A4" | "LETTER";

/** Sizes in points (1/72 inch). */
export const PAGE_SIZES: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  LETTER: { width: 612, height: 792 },
};

export const PAGE_MARGIN_PT = 72;

/** Letter where it is the paper standard, A4 everywhere else. */
export function localPageSize(locale: string): PageSize {
  return /-(US|CA|MX|PH)\b/i.test(locale) ? "LETTER" : "A4";
}
