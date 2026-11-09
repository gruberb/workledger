import { describe, expect, it } from "vitest";
import { MountQueue } from "../mount-queue.ts";

function setup(margin = 100) {
  const distances = new Map<string, number>();
  const frames: (() => void)[] = [];
  const mounted: string[] = [];
  const queue = new MountQueue<string>({
    distance: (item) => distances.get(item) ?? Infinity,
    margin,
    schedule: (pick) => frames.push(pick),
  });
  const nextFrame = () => frames.splice(0).forEach((pick) => pick());
  const mount = (item: string) => () => mounted.push(item);
  return { queue, distances, mounted, nextFrame, mount };
}

describe("MountQueue", () => {
  it("mounts a visible item immediately when idle", () => {
    const { queue, distances, mounted, mount } = setup();
    distances.set("a", 0);
    expect(queue.mountIfVisible("a", mount("a"))).toBe(true);
    expect(mounted).toEqual(["a"]);
  });

  it("does not mount immediately while another item is mounting, or when off screen", () => {
    const { queue, distances, mounted, mount } = setup();
    distances.set("a", 0).set("b", 0).set("c", 50);
    queue.mountIfVisible("a", mount("a"));
    expect(queue.mountIfVisible("b", mount("b"))).toBe(false);
    queue.release("a");
    expect(queue.mountIfVisible("c", mount("c"))).toBe(false);
    expect(mounted).toEqual(["a"]);
  });

  it("mounts one item per frame, waiting for release", () => {
    const { queue, distances, mounted, nextFrame, mount } = setup();
    distances.set("a", 10).set("b", 20);
    queue.request("a", mount("a"));
    queue.request("b", mount("b"));
    expect(mounted).toEqual([]);
    nextFrame();
    expect(mounted).toEqual(["a"]);
    nextFrame();
    expect(mounted).toEqual(["a"]);
    queue.release("a");
    nextFrame();
    expect(mounted).toEqual(["a", "b"]);
  });

  it("picks the nearest item, measured at pick time", () => {
    const { queue, distances, mounted, nextFrame, mount } = setup();
    distances.set("a", 10).set("b", 50);
    queue.request("a", mount("a"));
    queue.request("b", mount("b"));
    // A mount above moved the cards before the frame ran.
    distances.set("a", 80).set("b", 0);
    nextFrame();
    expect(mounted).toEqual(["b"]);
  });

  it("leaves items beyond the margin waiting until they come closer", () => {
    const { queue, distances, mounted, nextFrame, mount } = setup();
    distances.set("a", 0).set("b", 30);
    queue.mountIfVisible("a", mount("a"));
    queue.request("b", mount("b"));
    // Mounting "a" pushed "b" out of range.
    distances.set("b", 500);
    queue.release("a");
    nextFrame();
    expect(mounted).toEqual(["a"]);
    distances.set("b", 60);
    queue.request("b", mount("b"));
    nextFrame();
    expect(mounted).toEqual(["a", "b"]);
  });

  it("skips withdrawn and released items", () => {
    const { queue, distances, mounted, nextFrame, mount } = setup();
    distances.set("a", 10).set("b", 20).set("c", 30);
    queue.request("a", mount("a"));
    queue.request("b", mount("b"));
    queue.request("c", mount("c"));
    queue.withdraw("a");
    queue.release("b");
    nextFrame();
    expect(mounted).toEqual(["c"]);
  });

  it("frees the slot when the active item goes away before rendering", () => {
    const { queue, distances, mounted, nextFrame, mount } = setup();
    distances.set("a", 0).set("b", 10);
    queue.mountIfVisible("a", mount("a"));
    queue.request("b", mount("b"));
    nextFrame();
    expect(mounted).toEqual(["a"]);
    // Unmount cleanup calls release; releasing an item that is not active changes nothing.
    queue.release("x");
    nextFrame();
    expect(mounted).toEqual(["a"]);
    queue.release("a");
    nextFrame();
    expect(mounted).toEqual(["a", "b"]);
  });
});
