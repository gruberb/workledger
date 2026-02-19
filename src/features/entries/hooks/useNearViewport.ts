import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Returns whether the element is within ~2000px of the visible area,
 * plus the last measured height so placeholders can preserve layout.
 * Starts near=true so editors mount with correct layout heights on first render.
 * IntersectionObserver then unmounts far-away editors after the initial frame.
 *
 * Mounting is one-way after the initial prune: once an entry is scrolled into
 * range and its editor mounts, it stays mounted. Re-unmounting causes layout
 * shifts that feed back into the observer (especially near the bottom of the
 * scroll container), creating an infinite jitter loop.
 */
export function useNearViewport(ref: RefObject<HTMLElement | null>): { near: boolean; lastHeight: number | undefined } {
  const [near, setNear] = useState(true);
  const [lastHeight, setLastHeight] = useState<number | undefined>(undefined);
  // Tracks whether the entry has ever been observed as intersecting.
  // After the first real mount, we never unmount again.
  const hasBeenNear = useRef(false);

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
          hasBeenNear.current = true;
          setNear(true);
        } else if (!hasBeenNear.current) {
          // Only allow unmount during the initial prune — before the entry
          // has ever been scrolled into range.
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
