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
