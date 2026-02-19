import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Returns whether the element is within ~2000px of the visible area,
 * plus the last measured height so placeholders can preserve layout.
 * Starts near=true so editors mount with correct layout heights on first render.
 * IntersectionObserver then unmounts far-away editors after the initial frame.
 *
 * Unmounting is delayed by 500ms to prevent boundary oscillation — when an entry
 * is right at the edge, viewport chrome resizing (mobile toolbar show/hide) or
 * layout shifts from mounting nearby editors can cause rapid toggling. The delay
 * absorbs these transient exits so editors don't flicker.
 */
export function useNearViewport(ref: RefObject<HTMLElement | null>): { near: boolean; lastHeight: number | undefined } {
  const [near, setNear] = useState(true);
  const [lastHeight, setLastHeight] = useState<number | undefined>(undefined);
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When a parent has display:none, the observer fires with zero-size
        // boundingClientRect. Ignore these — they're not real visibility changes.
        const rect = entry.boundingClientRect;
        if (rect.width === 0 && rect.height === 0) return;

        if (entry.isIntersecting) {
          // Cancel any pending unmount — the entry is back in range.
          if (unmountTimer.current) {
            clearTimeout(unmountTimer.current);
            unmountTimer.current = null;
          }
          setNear(true);
        } else {
          // Capture the element's height before collapsing to placeholder
          // so the placeholder can preserve the same height and avoid layout shift.
          if (rect.height > 0) {
            setLastHeight(rect.height);
          }
          // Delay unmount to absorb transient boundary oscillation.
          if (!unmountTimer.current) {
            unmountTimer.current = setTimeout(() => {
              unmountTimer.current = null;
              setNear(false);
            }, 500);
          }
        }
      },
      { rootMargin: "2000px 0px" },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (unmountTimer.current) {
        clearTimeout(unmountTimer.current);
      }
    };
  }, [ref]);

  return { near, lastHeight };
}
