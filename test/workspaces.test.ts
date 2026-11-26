import { describe, expect, test } from "bun:test";
import {
  createWorkspaces,
  firstStepOf,
  focusOf,
  type Layout,
  locate,
  type Rect,
  screensOf,
  stepAfter,
  stepCount,
  stepsIn,
  tilingOf,
} from "../src/lib/workspaces";

/** A workspace by position; fails loudly rather than returning undefined. */
const at = <T>(list: readonly T[], i: number): T => {
  const item = list[i];
  if (item === undefined) throw new Error(`nothing at ${i}`);
  return item;
};
/** A window's tile in a layout; fails loudly if the window is not there. */
const tile = (layout: Layout, id: string): Rect => {
  const r = layout[id];
  if (!r) throw new Error(`no window ${id}`);
  return r;
};

describe("the six workspaces", () => {
  const ws = createWorkspaces({ featured: 4 });

  test("are fixed, in order", () => {
    expect(ws.map((w) => w.id)).toEqual([
      "opening",
      "about",
      "projects",
      "timeline",
      "sabbatical",
      "contact",
    ]);
  });

  test("every workspace but projects is one step", () => {
    expect(ws.filter((w) => w.id !== "projects").map(stepsIn)).toEqual([
      1, 1, 1, 1, 1,
    ]);
  });
});

describe("steps inside the projects workspace", () => {
  test("hold one step per featured project, whatever the count", () => {
    for (const n of [3, 4, 6, 9]) {
      const ws = createWorkspaces({ featured: n });
      expect(stepsIn(at(ws, 2))).toBe(n);
      expect(stepCount(ws)).toBe(n + 5);
    }
  });

  test("do not move the other workspaces' numbers when the count changes", () => {
    const three = createWorkspaces({ featured: 3 });
    const six = createWorkspaces({ featured: 6 });
    expect(three.map((w) => w.id)).toEqual(six.map((w) => w.id));
  });
});

describe("addressing steps", () => {
  const ws = createWorkspaces({ featured: 4 });

  test("firstStepOf gives the step a workspace begins on", () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => firstStepOf(ws, i))).toEqual([
      0, 1, 2, 6, 7, 8,
    ]);
  });

  test("locate says which workspace a step is in, and where inside it", () => {
    expect(locate(ws, 0)).toEqual({ workspace: 0, index: 0, count: 1 });
    expect(locate(ws, 1)).toEqual({ workspace: 1, index: 0, count: 1 });
    expect(locate(ws, 4)).toEqual({ workspace: 2, index: 2, count: 4 });
    expect(locate(ws, 8)).toEqual({ workspace: 5, index: 0, count: 1 });
  });

  test("stepAfter moves one step and stops at both ends", () => {
    expect(stepAfter(ws, 0, 1)).toBe(1);
    expect(stepAfter(ws, 5, 1)).toBe(6);
    expect(stepAfter(ws, 6, -1)).toBe(5);
    expect(stepAfter(ws, 0, -1)).toBe(0);
    expect(stepAfter(ws, 8, 1)).toBe(8);
  });
});

describe("every step's tiling", () => {
  const tilings = createWorkspaces({ featured: 5 }).flatMap((w, wi) =>
    w.steps.flatMap((step, si) =>
      [
        { kind: "desktop", layouts: [step.desktop] },
        { kind: "touch", layouts: step.touch },
      ].flatMap(({ kind, layouts }) =>
        layouts.map((layout, screen) => ({
          name: `${w.id} step ${si + 1} (${kind} ${screen + 1})`,
          step,
          layout,
          kind,
          wi,
        })),
      ),
    ),
  );

  test("fills the area exactly, with no overlap", () => {
    for (const { name, layout } of tilings) {
      const area = Object.values(layout).reduce(
        (a, [, , w, h]) => a + w * h,
        0,
      );
      expect({ name, area: Math.round(area) }).toEqual({ name, area: 10000 });
      const rects = Object.values(layout);
      for (const [i, a] of rects.entries())
        for (const b of rects.slice(i + 1)) {
          const apart =
            a[0] + a[2] <= b[0] + 1e-9 ||
            b[0] + b[2] <= a[0] + 1e-9 ||
            a[1] + a[3] <= b[1] + 1e-9 ||
            b[1] + b[3] <= a[1] + 1e-9;
          expect({ name, apart }).toEqual({ name, apart: true });
        }
    }
  });

  test("gives focus to a window that is on show on every wide tiling, and a touch screen that has it", () => {
    for (const { step, layout, kind } of tilings) {
      if (kind === "desktop") expect(Object.keys(layout)).toContain(step.focus);
    }
    // every step keeps its focused window on at least one touch screen
    for (const { step } of tilings) {
      expect(step.touch.some((l) => step.focus in l)).toBe(true);
    }
  });

  test("stacks in one column on touch", () => {
    for (const { name, layout, kind } of tilings) {
      if (kind !== "touch") continue;
      // Photos sit 2 x 2 under the sabbatical copy; every other window spans the width.
      const wide = Object.entries(layout).filter(([, r]) => r[2] === 100);
      const photos = Object.keys(layout).filter((k) => k.startsWith("photo-"));
      expect({
        name,
        ok: wide.length + photos.length === Object.keys(layout).length,
      }).toEqual({ name, ok: true });
    }
  });
});

describe("the decided proportions", () => {
  const ws = createWorkspaces({ featured: 4 });
  const desktop = (w: number, s = 0) => at(at(ws, w).steps, s).desktop;

  test("opening: name 60%, terminal above ~/now on the right", () => {
    expect(tile(desktop(0), "name")).toEqual([0, 0, 60, 100]);
    expect(tile(desktop(0), "term")[0]).toBe(60);
    expect(tile(desktop(0), "now")[1]).toBe(tile(desktop(0), "term")[3]);
  });

  test("about: one window across the whole workspace", () => {
    expect(desktop(1)).toEqual({ about: [0, 0, 100, 100] });
    expect(at(at(ws, 1).steps, 0).focus).toBe("about");
    expect(at(at(ws, 1).steps, 0).touch).toEqual([{ about: [0, 0, 100, 100] }]);
  });

  test("a project step: copy 30% above the stack, composition 70%", () => {
    const l = desktop(2);
    expect(tile(l, "copy-1")[2]).toBe(30);
    expect(tile(l, "stack")[2]).toBe(30);
    expect(tile(l, "comp-1")).toEqual([30, 0, 70, 100]);
  });

  test("the stack stays put from one project to the next", () => {
    expect(tile(desktop(2, 0), "stack")).toEqual(tile(desktop(2, 3), "stack"));
  });

  test("timeline: 62% window, 38% x 40% above 38% x 60%", () => {
    const l = desktop(3);
    expect(tile(l, "timeline")[2]).toBe(62);
    expect(tile(l, "education").slice(2)).toEqual([38, 40]);
    expect(tile(l, "skills").slice(2)).toEqual([38, 60]);
  });

  test("sabbatical: copy 34%, four photos in a 2 x 2 grid", () => {
    const l = desktop(4);
    expect(tile(l, "sabbatical")[2]).toBe(34);
    expect(tile(l, "photo-1").slice(2)).toEqual([33, 50]);
    expect(tile(l, "photo-4").slice(0, 2)).toEqual([67, 50]);
  });

  test("contact: terminal 58%, the opening's name (62%) above its terminal (38%)", () => {
    const l = desktop(5);
    expect(tile(l, "contact")[2]).toBe(58);
    expect(tile(l, "name")[3]).toBe(62);
    expect(tile(l, "term")[3]).toBe(38);
  });

  test("touch contact: the terminal whole, and nothing after it", () => {
    const screens = at(at(ws, 5).steps, 0).touch;
    expect(screens).toEqual([{ contact: [0, 0, 100, 100] }]);
  });
});

describe("the timeline's open variant (Education & Internships)", () => {
  const ws = createWorkspaces({ featured: 4 });
  const step = at(at(ws, 3).steps, 0);

  test("closed it is the decided tiling", () => {
    expect(tilingOf(step, false)).toBe(step.desktop);
  });

  test("open narrows the timeline to 46%, education takes the right 54%, skills leaves", () => {
    const l = tilingOf(step, true);
    expect(tile(l, "timeline")).toEqual([0, 0, 46, 100]);
    expect(tile(l, "education")).toEqual([46, 0, 54, 100]);
    expect(l.skills).toBeUndefined();
  });

  test("open on touch gives education the whole workspace", () => {
    expect(screensOf(step, true)).toEqual([{ education: [0, 0, 100, 100] }]);
  });

  test("a step with no variant keeps its tiling when asked to open", () => {
    const s = at(at(ws, 5).steps, 0);
    expect(tilingOf(s, true)).toBe(s.desktop);
    expect(screensOf(s, true)).toBe(s.touch);
    expect(focusOf(s, true)).toBe(s.focus);
  });

  test("the open tiling fills the area without overlap", () => {
    for (const l of [tilingOf(step, true), ...screensOf(step, true)]) {
      const area = Object.values(l).reduce((a, [, , w, h]) => a + w * h, 0);
      expect(Math.round(area)).toBe(10000);
    }
    expect(Object.keys(tilingOf(step, true))).toContain(focusOf(step, true));
  });
});

describe("the archive's open variant (projects)", () => {
  const ws = createWorkspaces({ featured: 4 });
  const projects = at(ws, 2);

  test("every project step squeezes into the left 42% and the archive takes the right 58%", () => {
    for (const step of projects.steps) {
      const closed = tilingOf(step, false);
      const l = tilingOf(step, true);
      expect(tile(l, "archive")).toEqual([42, 0, 58, 100]);
      expect(focusOf(step, true)).toBe("archive");
      for (const [id, [x, y, w, h]] of Object.entries(closed)) {
        const [ox, oy, ow, oh] = tile(l, id);
        expect([ox, oy, ow, oh].map((n) => Math.round(n * 100) / 100)).toEqual(
          [x * 0.42, y, w * 0.42, h].map((n) => Math.round(n * 100) / 100),
        );
      }
    }
  });

  test("on touch the archive takes the whole workspace", () => {
    for (const step of projects.steps) {
      expect(screensOf(step, true)).toEqual([{ archive: [0, 0, 100, 100] }]);
    }
  });

  test("the archive tiling fills the area", () => {
    const step = at(projects.steps, 0);
    for (const l of [tilingOf(step, true), ...screensOf(step, true)]) {
      const area = Object.values(l).reduce((a, [, , w, h]) => a + w * h, 0);
      expect(Math.round(area)).toBe(10000);
    }
  });
});

describe("the touch screens of a step (src/lib/screens.ts walks them)", () => {
  const ws = createWorkspaces({ featured: 4 });
  const touch = (w: number, s = 0) => at(at(ws, w).steps, s).touch;
  const ids = (layouts: readonly Layout[]) =>
    layouts.map((l) => Object.keys(l));

  test("the opening is one screen, as on a wide screen", () => {
    expect(touch(0)).toHaveLength(1);
  });

  test("about is one screen, its window whole", () => {
    expect(ids(touch(1))).toEqual([["about"]]);
  });

  test("contact is its terminal alone: one screen, the last step", () => {
    expect(ids(touch(5))).toEqual([["contact"]]);
  });

  test("a project is one screen: its copy over its composition, no stack", () => {
    for (const i of [0, 1, 2, 3]) {
      expect(ids(touch(2, i))).toEqual([[`copy-${i + 1}`, `comp-${i + 1}`]]);
    }
  });

  test("the timeline workspace is the timeline over education, then skills", () => {
    expect(ids(touch(3))).toEqual([["timeline", "education"], ["skills"]]);
  });

  test("the sabbatical is one touch screen: the copy over the four photos in a 2 x 2 grid", () => {
    const screens = touch(4);
    expect(screens.length).toBe(1);
    const [screen] = screens;
    expect(Object.keys(screen ?? {}).sort()).toEqual([
      "photo-1",
      "photo-2",
      "photo-3",
      "photo-4",
      "sabbatical",
    ]);
    // the copy above the grid, the grid filling what the copy leaves
    expect(tile(screen ?? {}, "sabbatical")[1]).toBe(0);
    expect(tile(screen ?? {}, "photo-1")[1]).toBeGreaterThanOrEqual(
      tile(screen ?? {}, "sabbatical")[3],
    );
  });

  test("wherever the projects count goes, every project has its one screen", () => {
    for (const n of [1, 3, 6, 9]) {
      const projects = at(createWorkspaces({ featured: n }), 2);
      expect(projects.steps.map((s) => s.touch.length)).toEqual(
        Array(n).fill(1),
      );
    }
  });
});
