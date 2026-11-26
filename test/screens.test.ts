import { describe, expect, test } from "bun:test";
import {
  expandScreens,
  focusAmong,
  moveBy,
  paginate,
} from "../src/lib/screens";

describe("paginate: entries split into screens that fit", () => {
  test("packs entries in order while they fit", () => {
    expect(paginate([100, 100, 100, 100, 100], 250)).toEqual([
      [0, 1],
      [2, 3],
      [4],
    ]);
  });

  test("one page when everything fits, exactly filling counts as fitting", () => {
    expect(paginate([100, 150], 250)).toEqual([[0, 1]]);
  });

  test("never reorders, never drops or repeats an entry", () => {
    const heights = [90, 180, 40, 220, 60, 60, 300, 10];
    const pages = paginate(heights, 280);
    expect(pages.flat()).toEqual(heights.map((_, i) => i));
  });

  test("an entry taller than a screen gets a screen of its own", () => {
    expect(paginate([50, 500, 50], 200)).toEqual([[0], [1], [2]]);
  });

  test("a bigger screen needs fewer pages", () => {
    const heights = [170, 170, 170, 170, 170];
    expect(paginate(heights, 340).length).toBe(3);
    expect(paginate(heights, 520).length).toBe(2);
    expect(paginate(heights, 900).length).toBe(1);
  });

  test("no entries is one empty page, so a window still has a screen", () => {
    expect(paginate([], 300)).toEqual([[]]);
  });

  test("no room at all puts each entry on its own page", () => {
    expect(paginate([10, 10], 0)).toEqual([[0], [1]]);
  });
});

describe("expandScreens: a step's layouts and their pages become screens", () => {
  const timeline = { timeline: [0, 0, 100, 100] } as const;
  const education = { education: [0, 0, 100, 100] } as const;
  const skills = { skills: [0, 0, 100, 100] } as const;

  test("a layout with no paged window is one screen", () => {
    expect(expandScreens([education], {})).toEqual([
      { layout: education, pages: {} },
    ]);
  });

  test("a layout whose window has three pages is three screens, one page each", () => {
    expect(expandScreens([timeline], { timeline: 3 })).toEqual([
      { layout: timeline, pages: { timeline: 0 } },
      { layout: timeline, pages: { timeline: 1 } },
      { layout: timeline, pages: { timeline: 2 } },
    ]);
  });

  test("layouts keep their order, each repeated for its own pages", () => {
    const screens = expandScreens([timeline, education, skills], {
      timeline: 2,
      skills: 2,
    });
    expect(screens.map((s) => Object.keys(s.layout)[0])).toEqual([
      "timeline",
      "timeline",
      "education",
      "skills",
      "skills",
    ]);
    expect(screens.map((s) => Object.values(s.pages)[0])).toEqual([
      0,
      1,
      undefined,
      0,
      1,
    ]);
  });

  test("two paged windows on one layout run side by side; the shorter one holds its last page", () => {
    const both = { a: [0, 0, 50, 100], b: [50, 0, 50, 100] } as const;
    expect(expandScreens([both], { a: 1, b: 3 }).map((s) => s.pages)).toEqual([
      { a: 0, b: 0 },
      { a: 0, b: 1 },
      { a: 0, b: 2 },
    ]);
  });

  test("a count below one still leaves the window a screen", () => {
    expect(expandScreens([timeline], { timeline: 0 })).toHaveLength(1);
  });
});

describe("moveBy: one swipe moves one screen, across steps", () => {
  // step 0 has 1 screen, step 1 has 3, step 2 has 2
  const counts = [1, 3, 2];
  const count = (step: number) => counts[step] ?? 1;

  test("moves to the next screen of the same step", () => {
    expect(moveBy({ step: 1, screen: 0 }, 1, count, 3)).toEqual({
      step: 1,
      screen: 1,
    });
  });

  test("the last screen of a step moves to the first screen of the next", () => {
    expect(moveBy({ step: 1, screen: 2 }, 1, count, 3)).toEqual({
      step: 2,
      screen: 0,
    });
  });

  test("moving back from the first screen lands on the previous step's last", () => {
    expect(moveBy({ step: 2, screen: 0 }, -1, count, 3)).toEqual({
      step: 1,
      screen: 2,
    });
  });

  test("holds at the first and last screen", () => {
    expect(moveBy({ step: 0, screen: 0 }, -1, count, 3)).toEqual({
      step: 0,
      screen: 0,
    });
    expect(moveBy({ step: 2, screen: 1 }, 1, count, 3)).toEqual({
      step: 2,
      screen: 1,
    });
  });

  test("with one screen per step it is a plain step move", () => {
    const one = () => 1;
    expect(moveBy({ step: 3, screen: 0 }, 1, one, 8)).toEqual({
      step: 4,
      screen: 0,
    });
    expect(moveBy({ step: 3, screen: 0 }, -1, one, 8)).toEqual({
      step: 2,
      screen: 0,
    });
  });

  test("walking down visits every screen once, and walking back retraces it", () => {
    let at = { step: 0, screen: 0 };
    const down = [at];
    for (let i = 0; i < 20; i++) {
      const next = moveBy(at, 1, count, 3);
      if (next.step === at.step && next.screen === at.screen) break;
      at = next;
      down.push(at);
    }
    expect(down).toHaveLength(6);
    const up = [at];
    for (let i = 0; i < 20; i++) {
      const next = moveBy(at, -1, count, 3);
      if (next.step === at.step && next.screen === at.screen) break;
      at = next;
      up.push(at);
    }
    expect(up.reverse()).toEqual(down);
  });
});

describe("focusAmong: the focused window must be on the screen", () => {
  const layout = {
    stack: [0, 0, 50, 100],
    "comp-1": [50, 0, 50, 100],
  } as const;

  test("keeps the step's focus when it is on the screen", () => {
    expect(focusAmong(layout, "comp-1")).toBe("comp-1");
  });

  test("otherwise takes the screen's first window", () => {
    expect(focusAmong({ "copy-1": [0, 0, 100, 100] }, "comp-1")).toBe("copy-1");
  });
});
