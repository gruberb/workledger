import { useEffect, useState, type RefObject } from "react";

/** Height of a day's sticky page head (`.day-head` in app.css). */
const DAY_HEAD_PX = 56;

/**
 * The entry the reader is in: the one under the sticky app header and day head.
 * One observer watches a 1px band at that line, so the state changes only when
 * the reader crosses into another entry, never while typing or scrolling within one.
 *
 * Entries mark themselves with `data-entry-id`. `layoutKey` changes when the
 * rendered entries change, so new elements get observed.
 */
export function useActiveEntry(containerRef: RefObject<HTMLElement | null>, layoutKey: string, enabled: boolean): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!enabled || !root) return;
    let observer: IntersectionObserver | null = null;

    const observe = () => {
      observer?.disconnect();
      const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-header-h")) || 0;
      // Below the stuck day head and inside an entry scrolled to its scroll-margin (132px).
      const line = headerH + DAY_HEAD_PX + 24;
      observer = new IntersectionObserver(
        (records) => {
          for (const record of records) {
            if (record.isIntersecting) setActiveId(record.target.getAttribute("data-entry-id"));
          }
        },
        { rootMargin: `-${line}px 0px -${Math.max(0, window.innerHeight - line - 1)}px 0px` },
      );
      root.querySelectorAll("[data-entry-id]").forEach((el) => observer!.observe(el));
    };

    observe();
    window.addEventListener("resize", observe);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", observe);
    };
  }, [containerRef, layoutKey, enabled]);

  return enabled ? activeId : null;
}
