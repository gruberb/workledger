/**
 * Resolves with the element once React has rendered it, or null after the timeout.
 * Fixed delays break when progressive rendering or a view switch needs more than one frame.
 */
export function waitForElement(id: string, timeoutMs = 1000): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const deadline = performance.now() + timeoutMs;
    const check = () => {
      const el = document.getElementById(id);
      if (el) return resolve(el);
      if (performance.now() > deadline) return resolve(null);
      requestAnimationFrame(check);
    };
    check();
  });
}

export async function scrollToEntry(entryId: string): Promise<void> {
  const el = await waitForElement(`entry-${entryId}`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
}

const SETTLE_MS = 1200;

/**
 * Scrolls the element `find` returns to the top (below the sticky headers, via
 * its scroll-margin) and keeps it there while editors around it mount and change
 * height. A smooth scroll aimed at placeholder geometry ended thousands of pixels
 * off once the entries above it opened. `find` runs every frame because opening
 * a folded entry replaces its element. Stops at the first scroll input.
 */
export function scrollIntoViewSettled(find: () => HTMLElement | null): void {
  const first = find();
  if (!first) return;
  first.scrollIntoView({ behavior: "instant", block: "start" });
  const target = first.getBoundingClientRect().top;
  let stopped = false;
  const stop = () => { stopped = true; };
  const inputs = ["wheel", "touchstart", "keydown", "mousedown"] as const;
  for (const type of inputs) window.addEventListener(type, stop, { passive: true, once: true });
  const deadline = performance.now() + SETTLE_MS;
  const tick = () => {
    const el = stopped ? null : find();
    if (el) {
      const drift = el.getBoundingClientRect().top - target;
      if (Math.abs(drift) > 1) window.scrollBy({ top: drift, behavior: "instant" });
      if (performance.now() < deadline) {
        requestAnimationFrame(tick);
        return;
      }
    }
    for (const type of inputs) window.removeEventListener(type, stop);
  };
  requestAnimationFrame(tick);
}
