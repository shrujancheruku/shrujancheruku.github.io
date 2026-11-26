import { describe, expect, test } from "bun:test";
import { createWorkspaces, type Layout } from "../src/lib/workspaces";

const area = (layout: Layout) =>
  Object.values(layout).reduce((sum, [, , w, h]) => sum + (w * h) / 100, 0);

describe("the projects workspace holds for 3, 4, 5 and 6 featured projects", () => {
  for (const featured of [3, 4, 5, 6]) {
    test(`${featured}: one step each, copy over stack at 30%, composition at 70%`, () => {
      const projects = createWorkspaces({ featured }).find(
        (w) => w.id === "projects",
      );
      expect(projects?.steps).toHaveLength(featured);
      for (const [i, step] of (projects?.steps ?? []).entries()) {
        const copy = step.desktop[`copy-${i + 1}`];
        const comp = step.desktop[`comp-${i + 1}`];
        const stack = step.desktop.stack;
        expect(copy?.[2]).toBe(30);
        expect(stack?.[2]).toBe(30);
        expect(comp?.[2]).toBe(70);
        expect(copy?.[1] ?? 0).toBeLessThan(stack?.[1] ?? 0);
        expect(area(step.desktop)).toBeCloseTo(100);
        // touch: the copy, then the composition above the stack
        for (const screen of step.touch) expect(area(screen)).toBeCloseTo(100);
        const [first, second] = step.touch;
        expect(Object.keys(first ?? {})).toEqual([`copy-${i + 1}`]);
        expect(second?.[`comp-${i + 1}`]?.[1]).toBeLessThan(
          second?.stack?.[1] ?? 0,
        );
      }
    });
  }
});

test("a featured step's tilings are the prototype's, to the percent", () => {
  // prototype/compositions at f4e8d4a, index.html, the step table (S)
  const projects = createWorkspaces({ featured: 4 }).find(
    (w) => w.id === "projects",
  );
  const step = projects?.steps[1];
  expect(step?.desktop).toEqual({
    "copy-2": [0, 0, 30, 62],
    stack: [0, 62, 30, 38],
    "comp-2": [30, 0, 70, 100],
  });
  // touch is no longer the prototype's single tiling: a phone screen cannot
  // hold the three windows, so a project is two screens (#83)
  expect(step?.touch).toEqual([
    { "copy-2": [0, 0, 100, 100] },
    { "comp-2": [0, 0, 100, 60], stack: [0, 60, 100, 40] },
  ]);
});
