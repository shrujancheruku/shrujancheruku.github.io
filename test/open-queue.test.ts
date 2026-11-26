import { describe, expect, test } from "bun:test";
import { initialQueue, limitOf, toggled, trimmed } from "../src/lib/open-queue";

describe("initialQueue", () => {
  test("opens every entry when they all fit", () =>
    expect(initialQueue(5, 5)).toEqual([0, 1, 2, 3, 4]));
  test("opens the top ones up to the limit", () =>
    expect(initialQueue(5, 3)).toEqual([0, 1, 2]));
  test("a limit above the count opens them all; zero opens none", () => {
    expect(initialQueue(3, 9)).toEqual([0, 1, 2]);
    expect(initialQueue(3, 0)).toEqual([]);
  });
});

describe("toggled", () => {
  test("opening below the limit closes nothing", () =>
    expect(toggled([0, 1], 3, 3)).toEqual([0, 1, 3]));
  test("opening at the limit closes the longest-open one", () =>
    expect(toggled([0, 1, 2], 4, 3)).toEqual([1, 2, 4]));
  test("the top entry, opened first at the start, goes first", () =>
    expect(toggled(initialQueue(5, 3), 3, 3)).toEqual([1, 2, 3]));
  test("the order follows when each was opened, not where it sits", () => {
    let q = toggled([0, 1, 2], 4, 3); // 0 out
    q = toggled(q, 0, 3); // 1 out
    expect(q).toEqual([2, 4, 0]);
  });
  test("closing an entry by hand frees a slot, so the next open closes nothing", () => {
    const closed = toggled([0, 1, 2], 1, 3);
    expect(closed).toEqual([0, 2]);
    expect(toggled(closed, 4, 3)).toEqual([0, 2, 4]);
  });
  test("never more than the limit open", () => {
    let q: number[] = [];
    for (const e of [0, 1, 2, 3, 4, 0, 3, 1, 2]) {
      q = toggled(q, e, 2);
      expect(q.length).toBeLessThanOrEqual(2);
    }
  });
  test("a limit of one is the old one-at-a-time", () =>
    expect(toggled([2], 3, 1)).toEqual([3]));
});

describe("trimmed", () => {
  test("a smaller limit closes the longest-open ones", () =>
    expect(trimmed([3, 1, 4], 2)).toEqual([1, 4]));
  test("a limit that holds keeps the queue", () =>
    expect(trimmed([3, 1], 4)).toEqual([3, 1]));
  test("limit zero empties it", () => expect(trimmed([1], 0)).toEqual([]));
});

describe("limitOf", () => {
  test("all of them when all fit", () =>
    expect(limitOf(5, () => true)).toBe(5));
  test("the most that fit", () => expect(limitOf(5, (n) => n <= 3)).toBe(3));
  test("none when not even one fits", () =>
    expect(limitOf(5, () => false)).toBe(0));
});
