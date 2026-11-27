import { describe, expect, test } from "bun:test";
import {
  createStepScreens,
  type Reading,
  type StepScreensReader,
} from "../src/lib/step-screens";
import type { Layout } from "../src/lib/workspaces";

const tile = (n: number) => [0, n, 100, 10] as const;
const plain: Layout = { a: tile(0) };
const paged: Layout = { roles: tile(1), skills: tile(2) };
const timeline: Layout = { timeline: tile(3) };
const archive: Layout = { archive: tile(4) };

interface World {
  readings: Record<string, Reading>;
  /** entries that fit open together, per timeline tile reading */
  limit: number;
  touch: boolean;
  slugs: string[];
}

/** A reader over fixed numbers; records what the module asked of it. */
function setup(w: World) {
  const log: string[] = [];
  const reader: StepScreensReader = {
    window: (id) => {
      log.push(`window:${id}`);
      return w.readings[id];
    },
    timeline: (_tile, find) => {
      log.push("timeline");
      return find({ count: 5, fits: (n) => n <= w.limit });
    },
    limitTo: (limit) => log.push(`limitTo:${limit}`),
    entryIndex: (slug) => w.slugs.indexOf(slug.toLowerCase()),
  };
  const screens = createStepScreens({
    steps: 3,
    touch: () => w.touch,
    layouts: (n, opened) =>
      n === 0 ? [timeline] : n === 1 ? [paged] : opened ? [archive] : [plain],
    wide: (n) => (n === 0 ? timeline : plain),
    reader,
  });
  return { screens, log };
}

const fitting = (log: string[]) =>
  log.filter((l) => l === "timeline" || l.startsWith("limitTo"));

const world = (over: Partial<World> = {}): World => ({
  readings: {},
  limit: 5,
  touch: true,
  slugs: [],
  ...over,
});

describe("a window that pages", () => {
  test("its entries fall into as many screens as fit", () => {
    const w = world({
      readings: { roles: { heights: [100, 100, 100, 100, 100], room: 250 } },
    });
    const { screens } = setup(w);
    expect(screens.screens(1, false).map((s) => s.pages)).toEqual([
      { roles: 0 },
      { roles: 1 },
      { roles: 2 },
    ]);
  });

  test("a window with fewer pages holds its last", () => {
    const w = world({
      readings: {
        roles: { heights: [100, 100, 100, 100, 100], room: 250 },
        skills: { heights: [100, 100], room: 250 },
      },
    });
    const { screens } = setup(w);
    expect(screens.screens(1, false).map((s) => s.pages)).toEqual([
      { roles: 0, skills: 0 },
      { roles: 1, skills: 0 },
      { roles: 2, skills: 0 },
    ]);
  });

  test("a wide screen is the one tiling, whatever the windows hold", () => {
    const w = world({
      touch: false,
      readings: { roles: { heights: [100, 100, 100], room: 150 } },
    });
    const { screens, log } = setup(w);
    expect(screens.screens(1, false)).toEqual([{ layout: plain, pages: {} }]);
    expect(log).toEqual([]);
  });

  test("a reading is kept until what fits has changed", () => {
    const w = world({
      readings: { roles: { heights: [100, 100], room: 250 } },
    });
    const { screens, log } = setup(w);
    screens.screens(1, false);
    screens.screens(1, false);
    expect(log.filter((l) => l === "window:roles")).toHaveLength(1);
    w.readings.roles = { heights: [100, 100], room: 150 };
    screens.changed();
    expect(screens.screens(1, false)).toHaveLength(2);
  });
});

describe("the timeline's limit", () => {
  test("is fitted before the step's screens are counted", () => {
    const w = world({ limit: 3 });
    const { screens, log } = setup(w);
    expect(screens.screens(0, false)).toHaveLength(1);
    expect(fitting(log)).toEqual(["timeline", "limitTo:3"]);
  });

  test("is fitted once until what fits has changed, then again", () => {
    const w = world({ limit: 3 });
    const { screens, log } = setup(w);
    screens.screens(0, false);
    screens.screens(2, false);
    expect(log.filter((l) => l === "timeline")).toHaveLength(1);
    w.limit = 2;
    screens.changed();
    screens.screens(2, false);
    expect(fitting(log)).toEqual([
      "timeline",
      "limitTo:3",
      "timeline",
      "limitTo:2",
    ]);
  });

  test("is not read on a wide screen", () => {
    const { screens, log } = setup(world({ touch: false }));
    screens.screens(0, false);
    expect(log).toEqual([]);
  });
});

describe("an entry's screen in the archive", () => {
  const readings = {
    archive: { heights: [100, 100, 100, 100, 100], room: 250 },
  };

  test("is the screen of the page that holds it", () => {
    const { screens } = setup(
      world({ readings, slugs: ["a", "b", "c", "d", "e"] }),
    );
    expect(screens.screenOfEntry(2, "a")).toBe(0);
    expect(screens.screenOfEntry(2, "d")).toBe(1);
    expect(screens.screenOfEntry(2, "E")).toBe(2);
  });

  test("is the first screen for an unknown entry, no entry, or a wide screen", () => {
    const w = world({ readings, slugs: ["a"] });
    const { screens } = setup(w);
    expect(screens.screenOfEntry(2, "nope")).toBe(0);
    expect(screens.screenOfEntry(2, "")).toBe(0);
    w.touch = false;
    expect(screens.screenOfEntry(2, "a")).toBe(0);
  });
});

describe("staying on the same entry after what fits changes", () => {
  test("the screen on show holds the same first entry as before", () => {
    const w = world({
      readings: { roles: { heights: [100, 100, 100, 100, 100], room: 250 } },
    });
    const { screens } = setup(w);
    // on the third screen, whose page holds entry 4
    expect(screens.screens(1, false)).toHaveLength(3);
    // a taller room: pages are [0..2] and [3, 4]; entry 4 is on screen 1
    w.readings.roles = { heights: [100, 100, 100, 100, 100], room: 350 };
    expect(screens.changed({ step: 1, open: false, screen: 2 })).toBe(1);
  });

  test("when the screens grow, the visitor follows the entry to its new screen", () => {
    const w = world({
      readings: { roles: { heights: [100, 100, 100, 100], room: 450 } },
    });
    const { screens } = setup(w);
    expect(screens.screens(1, false)).toHaveLength(1);
    w.readings.roles = { heights: [100, 100, 100, 100], room: 150 };
    expect(screens.changed({ step: 1, open: false, screen: 0 })).toBe(0);
  });
});
