import { describe, expect, test } from "bun:test";
import { appearEdgeOf } from "./motion";
import type { Rect } from "./workspaces";

describe("first appearance's edge, wide", () => {
  test("a tile on the right edge comes from the right", () => {
    expect(appearEdgeOf(0, [50, 0, 50, 100], false)).toBe("right");
    expect(appearEdgeOf(1, [60, 0, 40, 40], false)).toBe("right");
  });
  test("else one on the bottom edge comes from the bottom", () => {
    expect(appearEdgeOf(0, [0, 60, 50, 40], false)).toBe("bottom");
  });
  test("else one on the left edge comes from the left", () => {
    expect(appearEdgeOf(0, [0, 0, 50, 50], false)).toBe("left");
  });
  test("else one on the top edge comes from the top", () => {
    expect(appearEdgeOf(0, [20, 0, 50, 40], false)).toBe("top");
  });
  test("its place in tiling order makes no difference", () => {
    const tile: Rect = [0, 0, 60, 100];
    for (const i of [0, 1, 2, 3]) {
      expect(appearEdgeOf(i, tile, false)).toBe("bottom");
    }
  });
});

describe("first appearance's edge, phone", () => {
  const tile: Rect = [0, 0, 100, 30];
  test("right and left by turns, the first from the right", () => {
    expect([0, 1, 2, 3, 4].map((i) => appearEdgeOf(i, tile, true))).toEqual([
      "right",
      "left",
      "right",
      "left",
      "right",
    ]);
  });
  test("whatever the tile", () => {
    expect(appearEdgeOf(0, [0, 70, 100, 30], true)).toBe("right");
    expect(appearEdgeOf(1, [0, 70, 100, 30], true)).toBe("left");
  });
});
