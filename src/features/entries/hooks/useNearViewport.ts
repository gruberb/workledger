import { useEffect, useState, type RefObject } from "react";

/**
 * Returns whether the element is within ~2000px of the visible area,
 * plus the last measured height so placeholders can preserve layout.
 * Starts near=true so editors mount with correct layout heights on first render.
 * IntersectionObserver then unmounts far-away editors after the initial frame.
 */
export function useNearViewport(ref: RefObject<HTMLElement | null>): { near: boolean; lastHeight: number | undefined } {
  const [near, setNear] = useState(true);
  const [lastHeight, setLastHeight] = useState<number | undefined>(undefined);

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
          setNear(true);
        } else {
          // Capture the element's height before collapsing to placeholder
          // so the placeholder can preserve the same height and avoid layout shift.
          if (rect.height > 0) {
            setLastHeight(rect.height);
          }
          setNear(false);
        }
      },
      { rootMargin: "2000px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return { near, lastHeight };
}
