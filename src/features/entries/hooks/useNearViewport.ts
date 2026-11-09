import { useCallback, useLayoutEffect, useState, type RefObject } from "react";
import { MountQueue } from "../utils/mount-queue.ts";

/** How far outside the visible area a card's editor mounts. */
const MOUNT_MARGIN_PX = 2000;
/**
 * How far away a mounted editor must be before it unmounts. The gap to
 * MOUNT_MARGIN_PX is the hysteresis: a card near one boundary cannot flip back
 * and forth from small layout changes (mobile toolbar resizes, async content).
 */
const UNMOUNT_MARGIN_PX = 4000;

function viewportDistance(el: Element): number {
  const rect = el.getBoundingClientRect();
  // A display:none ancestor (the stream behind focus mode) collapses the rect.
  if (rect.width === 0 && rect.height === 0) return Infinity;
  if (rect.bottom < 0) return -rect.bottom;
  if (rect.top > window.innerHeight) return rect.top - window.innerHeight;
  return 0;
}

// Shared by every card, so editors mount one per frame across the whole app.
const mountQueue = new MountQueue<Element>({
  distance: viewportDistance,
  margin: MOUNT_MARGIN_PX,
  schedule: (pick) => requestAnimationFrame(pick),
});

interface NearState {
  near: boolean;
  /** Height of the unmounted editor, kept by its placeholder so the layout does not move. */
  height?: number;
}

/**
 * Whether the element's heavy content (the editor) is mounted, the height its
 * placeholder must keep, and the callback the content calls once it has
 * rendered so the next card can start.
 *
 * Cards start as placeholders and mount through a shared queue: nearest to the
 * viewport first, one at a time, re-measured after each mount grows the layout.
 * Editors farther than UNMOUNT_MARGIN_PX unmount again, so the DOM, and with it
 * the browser's work per keystroke, stays small after long scrolls. The
 * placeholder keeps the measured height of the same element, so unmounting
 * does not shift the layout; an earlier version measured the whole card, used
 * one boundary for both directions and looped.
 */
export function useNearViewport(ref: RefObject<HTMLElement | null>): {
  near: boolean;
  height: number | undefined;
  onRendered: () => void;
} {
  const [state, setState] = useState<NearState>({ near: false });
  const { near } = state;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (near) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          const rect = entry.boundingClientRect;
          // Hidden ancestors report a zero-size rect; that is not a visibility change.
          if (rect.width === 0 && rect.height === 0) return;
          // Unmounting the editor that has focus would drop the cursor and selection.
          if (entry.isIntersecting || el.contains(document.activeElement)) return;
          setState({ near: false, height: rect.height });
        },
        { rootMargin: `${UNMOUNT_MARGIN_PX}px 0px` },
      );
      observer.observe(el);
      return () => observer.disconnect();
    }

    const mount = () => setState({ near: true });
    // During layout, so a card already on screen skips its placeholder paint.
    if (mountQueue.mountIfVisible(el, mount)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const rect = entry.boundingClientRect;
        if (rect.width === 0 && rect.height === 0) return;
        if (entry.isIntersecting) mountQueue.request(el, mount);
        else mountQueue.withdraw(el);
      },
      { rootMargin: `${MOUNT_MARGIN_PX}px 0px` },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      mountQueue.withdraw(el);
    };
  }, [ref, near]);

  // A card removed mid-mount (view switch, filter) must not hold the queue.
  useLayoutEffect(() => {
    const el = ref.current;
    return () => {
      if (el) mountQueue.release(el);
    };
  }, [ref]);

  const onRendered = useCallback(() => {
    if (ref.current) mountQueue.release(ref.current);
  }, [ref]);

  return { near, height: state.height, onRendered };
}
