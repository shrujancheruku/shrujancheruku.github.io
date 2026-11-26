import { describe, expect, test } from "bun:test";
import { createSwipe } from "./swipe";

const opts = { distance: 48, flick: 16, speed: 0.4 };

/** Finger `id` at (x, y) at `time`. */
const at = (x: number, y: number, time: number, id = 1) => ({
  id,
  x,
  y,
  time,
});

/**
 * One finger drags from (0, 0) along `path`, 16 ms per move, on a page zoomed
 * to `scale`; returns every step taken.
 */
function drag(
  path: [number, number][],
  liftAt = 16 * (path.length + 1),
  scale = 1,
) {
  const swipe = createSwipe(opts);
  swipe.down(at(0, 0, 0), true, scale);
  const taken: number[] = [];
  for (const [i, [x, y]] of path.entries())
    taken.push(swipe.move(at(x, y, 16 * (i + 1))));
  const [x, y] = path.at(-1) ?? [0, 0];
  taken.push(swipe.up(at(x, y, liftAt)));
  return taken.filter((s) => s !== 0);
}

describe("a swipe", () => {
  test("up goes down a step, down goes up a step", () => {
    expect(drag([[0, -60]])).toEqual([1]);
    expect(drag([[0, 60]])).toEqual([-1]);
  });

  test("however long, it is one step", () => {
    const long: [number, number][] = Array.from({ length: 40 }, (_, i) => [
      0,
      -(i + 1) * 20,
    ]);
    expect(drag(long)).toEqual([1]);
  });

  test("steps as soon as it has gone far enough, not at lift-off", () => {
    const swipe = createSwipe(opts);
    swipe.down(at(0, 0, 0), true, 1);
    expect(swipe.move(at(0, -30, 16))).toBe(0);
    expect(swipe.move(at(0, -50, 32))).toBe(1);
    expect(swipe.move(at(0, -200, 48))).toBe(0);
    expect(swipe.up(at(0, -200, 64))).toBe(0);
  });

  test("a short fast flick steps; a short slow drag does not", () => {
    expect(drag([[0, -20]], 30)).toEqual([1]);
    expect(drag([[0, -20]], 200)).toEqual([]);
  });

  test("a tap or a tiny drag steps nothing", () => {
    expect(drag([[0, -3]], 40)).toEqual([]);
    expect(drag([])).toEqual([]);
  });

  test("a sideways drag steps nothing, a mostly vertical one does", () => {
    expect(drag([[-120, -60]])).toEqual([]);
    expect(drag([[10, -60]])).toEqual([1]);
  });

  test("a drag that turns round goes the way it is going when it is far enough", () => {
    expect(
      drag([
        [0, -30],
        [0, 30],
        [0, 60],
      ]),
    ).toEqual([-1]);
  });

  test("a cancelled gesture steps nothing, and the next one is fresh", () => {
    const swipe = createSwipe(opts);
    swipe.down(at(0, 0, 0), true, 1);
    swipe.cancel(1);
    expect(swipe.move(at(0, -100, 16))).toBe(0);
    expect(swipe.up(at(0, -100, 32))).toBe(0);
    swipe.down(at(0, 0, 100, 2), true, 1);
    expect(swipe.move(at(0, -100, 116, 2))).toBe(1);
  });
});

describe("pinch-zoom stays the browser's", () => {
  test("a pinch steps nothing, whichever finger travels", () => {
    const swipe = createSwipe(opts);
    swipe.down(at(100, 300, 0, 1), true, 1);
    swipe.down(at(100, 400, 10, 2), false, 1);
    // the fingers part: one goes up, one goes down, far and fast
    expect(swipe.move(at(100, 150, 30, 1))).toBe(0);
    expect(swipe.move(at(100, 550, 30, 2))).toBe(0);
    expect(swipe.up(at(100, 100, 40, 1))).toBe(0);
    expect(swipe.up(at(100, 600, 40, 2))).toBe(0);
  });

  test("a pinch whose first finger moved but had not stepped steps nothing", () => {
    const swipe = createSwipe(opts);
    swipe.down(at(100, 300, 0, 1), true, 1);
    expect(swipe.move(at(100, 280, 16, 1))).toBe(0);
    swipe.down(at(100, 400, 20, 2), false, 1);
    expect(swipe.move(at(100, 100, 40, 1))).toBe(0);
    expect(swipe.up(at(100, 100, 50, 1))).toBe(0);
  });

  test("the finger left after a pinch steps nothing until it lifts", () => {
    const swipe = createSwipe(opts);
    swipe.down(at(100, 300, 0, 1), true, 1);
    swipe.down(at(100, 400, 10, 2), false, 1);
    expect(swipe.up(at(100, 450, 30, 2))).toBe(0);
    expect(swipe.move(at(100, 100, 60, 1))).toBe(0);
    expect(swipe.up(at(100, 50, 80, 1))).toBe(0);
    // all fingers up: the next swipe steps
    swipe.down(at(0, 0, 200, 3), true, 1);
    expect(swipe.move(at(0, -60, 216, 3))).toBe(1);
  });

  test("the browser taking a finger for its pinch spends the gesture", () => {
    const swipe = createSwipe(opts);
    swipe.down(at(100, 300, 0, 1), true, 1);
    swipe.down(at(100, 400, 10, 2), false, 1);
    swipe.cancel(1);
    swipe.cancel(2);
    swipe.down(at(0, 0, 100, 3), true, 1);
    expect(swipe.move(at(0, -60, 116, 3))).toBe(1);
  });

  test("on a zoomed-in page a drag pans it and steps nothing", () => {
    expect(drag([[0, -200]], 80, 2)).toEqual([]);
    expect(drag([[0, -20]], 30, 1.5)).toEqual([]);
  });

  test("zoomed back out, a swipe steps again", () => {
    expect(drag([[0, -60]], 32, 1)).toEqual([1]);
    // the default scale can read a hair off 1
    expect(drag([[0, -60]], 32, 1.0000001)).toEqual([1]);
  });

  test("a lost lift-off does not keep the next gesture from stepping", () => {
    const swipe = createSwipe(opts);
    swipe.down(at(0, 0, 0, 1), true, 1);
    // finger 1's pointerup never came; a new gesture's first finger goes down
    swipe.down(at(0, 0, 500, 2), true, 1);
    expect(swipe.move(at(0, -60, 516, 2))).toBe(1);
  });

  test("reset forgets every finger", () => {
    const swipe = createSwipe(opts);
    swipe.down(at(0, 0, 0, 1), true, 1);
    swipe.down(at(0, 10, 5, 2), false, 1);
    swipe.reset();
    swipe.down(at(0, 0, 100, 3), false, 1);
    expect(swipe.move(at(0, -60, 116, 3))).toBe(1);
  });
});
