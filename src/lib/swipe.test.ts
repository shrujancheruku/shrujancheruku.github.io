import { describe, expect, test } from "bun:test";
import { createSwipe } from "./swipe";

const opts = { distance: 48, flick: 16, speed: 0.4 };

/** Drag from (0, 0) along `path`, 16 ms per move; returns every step taken. */
function drag(path: [number, number][], liftAt = 16 * (path.length + 1)) {
  const swipe = createSwipe(opts);
  swipe.start(0, 0, 0);
  const taken: number[] = [];
  for (const [i, [x, y]] of path.entries())
    taken.push(swipe.move(x, y, 16 * (i + 1)));
  const [x, y] = path.at(-1) ?? [0, 0];
  taken.push(swipe.end(x, y, liftAt));
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
    swipe.start(0, 0, 0);
    expect(swipe.move(0, -30, 16)).toBe(0);
    expect(swipe.move(0, -50, 32)).toBe(1);
    expect(swipe.move(0, -200, 48)).toBe(0);
    expect(swipe.end(0, -200, 64)).toBe(0);
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
    swipe.start(0, 0, 0);
    swipe.cancel();
    expect(swipe.move(0, -100, 16)).toBe(0);
    expect(swipe.end(0, -100, 32)).toBe(0);
    swipe.start(0, 0, 100);
    expect(swipe.move(0, -100, 116)).toBe(1);
  });
});
