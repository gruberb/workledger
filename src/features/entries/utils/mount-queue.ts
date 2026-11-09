export interface MountQueueOptions<T> {
  /** Pixels between the item and the visible area: 0 when visible, Infinity when not laid out. */
  distance: (item: T) => number;
  /** Items farther away than this wait until they come closer. */
  margin: number;
  /** Runs the next pick in a later frame, e.g. `requestAnimationFrame`. */
  schedule: (pick: () => void) => void;
}

/**
 * Mounts heavy content one item at a time, nearest to the viewport first.
 *
 * A mounted editor grows its card from a short placeholder to full height and
 * pushes later cards away. Deciding every card on placeholder geometry mounted
 * far more editors than fit near the viewport, so each pick re-measures the
 * waiting items, and the next mount waits until the active one has rendered
 * (`release`) and a frame has laid it out.
 */
export class MountQueue<T> {
  private readonly waiting = new Map<T, () => void>();
  private active: T | null = null;
  private scheduled = false;
  private readonly options: MountQueueOptions<T>;

  constructor(options: MountQueueOptions<T>) {
    this.options = options;
  }

  /**
   * Mounts `item` now when nothing else is mounting and it is on screen, so a
   * visible card never paints its placeholder first. Measures only when idle.
   */
  mountIfVisible(item: T, mount: () => void): boolean {
    if (this.active !== null || this.options.distance(item) !== 0) return false;
    this.waiting.delete(item);
    this.start(item, mount);
    return true;
  }

  /** Queues `item` for a later frame. */
  request(item: T, mount: () => void): void {
    if (item === this.active) return;
    this.waiting.set(item, mount);
    this.schedulePick();
  }

  /** The item moved out of range before its turn. */
  withdraw(item: T): void {
    this.waiting.delete(item);
  }

  /** The item rendered, failed or went away: the next one may start. */
  release(item: T): void {
    this.waiting.delete(item);
    if (this.active !== item) return;
    this.active = null;
    this.schedulePick();
  }

  private start(item: T, mount: () => void): void {
    this.active = item;
    mount();
  }

  private schedulePick(): void {
    if (this.active !== null || this.scheduled || this.waiting.size === 0) return;
    this.scheduled = true;
    this.options.schedule(() => {
      this.scheduled = false;
      this.pick();
    });
  }

  private pick(): void {
    if (this.active !== null) return;
    let next: T | undefined;
    let nearest = Infinity;
    for (const item of this.waiting.keys()) {
      const distance = this.options.distance(item);
      if (distance <= this.options.margin && distance < nearest) {
        next = item;
        nearest = distance;
      }
    }
    if (next === undefined) return;
    const mount = this.waiting.get(next)!;
    this.waiting.delete(next);
    this.start(next, mount);
  }
}
