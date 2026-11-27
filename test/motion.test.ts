import { describe, expect, test } from "bun:test";
import { type Placement, planMotion, type WindowPlan } from "../src/lib/motion";
import {
  createWorkspaces,
  firstStepOf,
  type Layout,
  locate,
  screensOf,
  stepAt,
  tilingOf,
} from "../src/lib/workspaces";

const workspaces = createWorkspaces({ featured: 4, archive: false });
const ws = (id: string) => workspaces.findIndex((w) => w.id === id);

/** A wide step of a workspace, as placed. */
const wide = (id: string, open = false, index = 0): Placement => {
  const step = firstStepOf(workspaces, ws(id)) + index;
  return {
    where: { step, screen: 0, open },
    workspace: ws(id),
    layout: tilingOf(stepAt(workspaces, step), open),
    pages: {},
  };
};

/** A screen of a step on a phone, as placed. */
const phone = (
  id: string,
  open = false,
  screen = 0,
  pages: Record<string, number> = {},
): Placement => {
  const step = firstStepOf(workspaces, ws(id));
  return {
    where: { step, screen, open },
    workspace: ws(id),
    layout: screensOf(stepAt(workspaces, step), open)[screen] ?? {},
    pages,
  };
};

/** Any layout as a placement, to make windows of our own. */
const placed = (layout: Layout, step = 0): Placement => ({
  where: { step, screen: 0, open: false },
  workspace: locate(workspaces, step).workspace,
  layout,
  pages: {},
});

/** A plan's windows by id. */
const windows = (
  before: Placement | null,
  after: Placement,
  onPhone = false,
): Record<string, WindowPlan> =>
  Object.fromEntries(
    planMotion(before, after, onPhone).windows.map((w) => [w.id, w]),
  );

/** Each window's motion, by id. */
const motions = (before: Placement, after: Placement) =>
  Object.fromEntries(
    Object.entries(windows(before, after)).map(([id, w]) => [id, w.motion]),
  );

describe("naming the motion of each window", () => {
  test("opening Education & Internships: skills closes, the others re-tile", () => {
    expect(motions(wide("timeline"), wide("timeline", true))).toEqual({
      timeline: "re-tiling",
      education: "re-tiling",
      skills: "closing",
    });
  });

  test("closing it again: skills opens", () => {
    expect(motions(wide("timeline", true), wide("timeline"))).toEqual({
      timeline: "re-tiling",
      education: "re-tiling",
      skills: "opening",
    });
  });

  test("opening the archive: it opens, the project re-tiles", () => {
    expect(motions(wide("projects"), wide("projects", true))).toEqual({
      "copy-1": "re-tiling",
      stack: "re-tiling",
      "comp-1": "re-tiling",
      archive: "opening",
    });
  });

  test("one project to the next rolls past on the same tiles; the stack re-tiles in place", () => {
    expect(
      motions(wide("projects", false, 0), wide("projects", false, 1)),
    ).toEqual({
      "copy-1": "rolling past",
      "comp-1": "rolling past",
      "copy-2": "rolling past",
      "comp-2": "rolling past",
      stack: "re-tiling",
    });
  });

  test("another workspace: every window changes workspace, the name too", () => {
    expect(motions(wide("opening"), wide("contact"))).toEqual({
      name: "changing workspace",
      term: "changing workspace",
      now: "changing workspace",
      contact: "changing workspace",
    });
  });

  test("a window that leaves for a different tile closes rather than rolls past", () => {
    expect(
      motions(
        placed({ a: [0, 0, 50, 100], b: [50, 0, 50, 100] }),
        placed({ a: [0, 0, 100, 100], c: [0, 0, 50, 50] }),
      ),
    ).toEqual({ a: "re-tiling", b: "closing", c: "opening" });
  });

  test("the new step's windows come first, in tiling order, then those that leave", () => {
    const ids = planMotion(
      wide("projects", false, 0),
      wide("projects", false, 1),
      false,
    ).windows.map((w) => w.id);
    expect(ids).toEqual(["copy-2", "stack", "comp-2", "copy-1", "comp-1"]);
  });

  test("the whole is a re-tiling within a workspace, a change of workspace across one", () => {
    expect(
      planMotion(wide("timeline"), wide("timeline", true), false).motion,
    ).toBe("re-tiling");
    expect(planMotion(wide("opening"), wide("contact"), false).motion).toBe(
      "changing workspace",
    );
    expect(planMotion(null, wide("about"), false).motion).toBe(
      "first appearance",
    );
  });
});

describe("re-tiling", () => {
  test("a window in both steps moves and resizes straight to its new tile, all at once", () => {
    const w = windows(wide("timeline"), wide("timeline", true));
    expect(w.education?.frame).toEqual({
      from: [62, 0, 38, 40],
      to: [46, 0, 54, 100],
      at: 0,
      duration: 0.32,
      ease: "power3.out",
    });
    expect(w.timeline?.frame?.at).toBe(0);
    expect(w.education?.fade).toBeUndefined();
    expect(w.education?.slide).toBeUndefined();
    expect(w.education?.leaves).toBe(false);
  });

  test("the step takes 0.32s", () => {
    expect(
      planMotion(wide("timeline"), wide("timeline", true), false).duration,
    ).toBe(0.32);
  });
});

describe("opening and closing a window", () => {
  test("skills closes into the bottom edge as Education grows down, fading out over the last 0.12s", () => {
    const skills = windows(wide("timeline"), wide("timeline", true)).skills;
    expect(skills).toEqual({
      id: "skills",
      motion: "closing",
      edge: "bottom",
      shownAt: [62, 40, 38, 60],
      frame: {
        from: [62, 40, 38, 60],
        to: [62, 100, 38, 0],
        at: 0,
        duration: 0.32,
        ease: "power3.out",
      },
      fade: { from: 1, to: 0, at: 0.32 - 0.12, duration: 0.12, ease: "none" },
      leaves: true,
    });
  });

  test("and comes back out of it, fading in over the first 0.12s", () => {
    const skills = windows(wide("timeline", true), wide("timeline")).skills;
    expect(skills?.edge).toBe("bottom");
    expect(skills?.shownAt).toBeUndefined();
    expect(skills?.leaves).toBe(false);
    expect(skills?.frame).toEqual({
      from: [62, 100, 38, 0],
      to: [62, 40, 38, 60],
      at: 0,
      duration: 0.32,
      ease: "power3.out",
    });
    expect(skills?.fade).toEqual({
      from: 0,
      to: 1,
      at: 0,
      duration: 0.12,
      ease: "none",
    });
  });

  test("the archive opens out of the right, on one moving border with its neighbours", () => {
    const w = windows(wide("projects"), wide("projects", true));
    expect(w.archive?.edge).toBe("right");
    expect(w.archive?.frame?.from).toEqual([100, 0, 0, 100]);
    expect(w.archive?.frame?.to).toEqual([42, 0, 58, 100]);
    const border = (rect: readonly number[] | undefined) =>
      rect ? (rect[0] ?? 0) + (rect[2] ?? 0) : Number.NaN;
    // the project beside it gives up its right edge to the archive's left,
    // from where the archive starts to where it ends, in the same time
    expect(border(w["comp-1"]?.frame?.from)).toBe(100);
    expect(border(w["comp-1"]?.frame?.to)).toBe(42);
    expect(w["comp-1"]?.frame?.at).toBe(w.archive?.frame?.at ?? -1);
    expect(w["comp-1"]?.frame?.duration).toBe(w.archive?.frame?.duration ?? -1);
    expect(w["comp-1"]?.frame?.ease).toBe(w.archive?.frame?.ease ?? "");
  });

  test("and closes into the right again", () => {
    const w = windows(wide("projects", true), wide("projects"));
    expect(w.archive?.edge).toBe("right");
    expect(w.archive?.frame?.to).toEqual([100, 0, 0, 100]);
    expect(w.archive?.leaves).toBe(true);
  });

  test("the far side from neighbours to its right is the left", () => {
    const w = windows(
      placed({ b: [0, 0, 100, 100] }),
      placed({ a: [0, 0, 40, 100], b: [40, 0, 60, 100] }),
    );
    expect(w.a?.edge).toBe("left");
    expect(w.a?.frame?.from).toEqual([0, 0, 0, 100]);
  });

  test("a neighbour that only touches it is none: the fallback holds", () => {
    const w = windows(
      placed({ b: [40, 0, 60, 100] }),
      placed({ a: [0, 0, 40, 100], b: [40, 0, 60, 100] }),
    );
    // b doesn't overlap a, and a doesn't touch the right: bottom
    expect(w.a?.edge).toBe("bottom");
  });

  test("the far side from a neighbour below is the top", () => {
    const w = windows(
      placed({ b: [0, 0, 100, 100] }),
      placed({ a: [0, 0, 100, 30], b: [0, 30, 100, 70] }),
    );
    expect(w.a?.edge).toBe("top");
    expect(w.a?.frame?.from).toEqual([0, 0, 100, 0]);
  });

  test("with no neighbour overlapping it falls back to right, else bottom", () => {
    const edge = (tile: [number, number, number, number]) =>
      windows(placed({}), placed({ a: tile })).a?.edge;
    expect(edge([50, 0, 50, 100])).toBe("right");
    expect(edge([0, 50, 50, 50])).toBe("bottom");
    expect(edge([0, 0, 50, 50])).toBe("bottom");
  });

  test("a step's real tiles: the about window has nothing beside it", () => {
    expect(
      windows({ ...wide("about"), layout: {} }, wide("about")).about?.edge,
    ).toBe("right");
  });
});

describe("a tile collapsed onto an edge", () => {
  // the window closes into the edge; its neighbour b, where it sits beside
  // it, says which
  const tile: [number, number, number, number] = [62, 40, 38, 60];
  const closing = (beside: Layout) =>
    windows(
      placed({ a: tile, ...beside }),
      placed({ ...(beside.b ? { b: tile } : {}) }),
    ).a;

  test("keeps the edge's side and loses its extent across it", () => {
    // no neighbour, and it reaches the right edge: right
    expect(closing({})?.edge).toBe("right");
    expect(closing({})?.frame?.to).toEqual([100, 40, 0, 60]);
    // a neighbour on its right: left
    const left = closing({ b: [95, 40, 5, 60] });
    expect(left?.edge).toBe("left");
    expect(left?.frame?.to).toEqual([62, 40, 0, 60]);
    // a neighbour below it: top
    const top = closing({ b: [62, 95, 38, 5] });
    expect(top?.edge).toBe("top");
    expect(top?.frame?.to).toEqual([62, 40, 38, 0]);
    // a neighbour above it: bottom
    const bottom = closing({ b: [62, 0, 38, 5] });
    expect(bottom?.edge).toBe("bottom");
    expect(bottom?.frame?.to).toEqual([62, 100, 38, 0]);
  });
});

describe("opening and closing a window on a phone", () => {
  const edges = (before: Placement, after: Placement) =>
    Object.fromEntries(
      Object.entries(windows(before, after, true))
        .filter(([, w]) => w.edge)
        .map(([id, w]) => [id, w.edge]),
    );

  test("the archive comes from the right and goes back into it", () => {
    const closed = phone("projects");
    const open = phone("projects", true);
    expect(edges(closed, open).archive).toBe("right");
    expect(edges(open, closed).archive).toBe("right");
  });

  test("the copy and the composition go into the left edge, and come out of it", () => {
    const closed = phone("projects");
    const open = phone("projects", true);
    expect(edges(open, closed)).toEqual({
      archive: "right",
      "copy-1": "left",
      "comp-1": "left",
    });
    expect(edges(closed, open)).toEqual({
      archive: "right",
      "copy-1": "left",
      "comp-1": "left",
    });
  });

  test("Skills goes into the bottom edge as Education grows down", () => {
    const second = phone("timeline", false, 1);
    const open = phone("timeline", true);
    expect(edges(second, open).skills).toBe("bottom");
    expect(edges(open, second).skills).toBe("bottom");
  });

  test("a wide screen keeps its rule: no neighbour, the fallback", () => {
    const w = (b: Layout, a: Layout) => windows(placed(b), placed(a));
    expect(w({ b: [0, 0, 100, 50] }, { a: [0, 0, 100, 100] }).b?.edge).toBe(
      "right",
    );
    expect(w({ b: [0, 0, 100, 50] }, { a: [0, 0, 100, 100] }).a?.edge).toBe(
      "right",
    );
  });
});

describe("rolling past", () => {
  const forwards = windows(
    wide("projects", false, 0),
    wide("projects", false, 1),
  );
  const backwards = windows(
    wide("projects", false, 1),
    wide("projects", false, 0),
  );
  const unclipped = { top: 0, bottom: 0 };

  test("forwards the old goes up and out, clipped from the top, and stays shown until it is out", () => {
    expect(forwards["copy-1"]).toEqual({
      id: "copy-1",
      motion: "rolling past",
      shownAt: [0, 0, 30, 62],
      slide: {
        extent: "window",
        gap: 0,
        from: 0,
        to: -1,
        clip: { from: unclipped, to: { top: 1, bottom: 0 } },
        at: 0,
        duration: 0.38,
        ease: "power3.inOut",
      },
      leaves: true,
    });
  });

  test("forwards the next comes from below, clipped at the bottom", () => {
    expect(forwards["copy-2"]).toEqual({
      id: "copy-2",
      motion: "rolling past",
      slide: {
        extent: "window",
        gap: 0,
        from: 1,
        to: 0,
        clip: { from: { top: 0, bottom: 1 }, to: unclipped },
        at: 0,
        duration: 0.38,
        ease: "power3.inOut",
      },
      leaves: false,
    });
  });

  test("backwards is the reverse", () => {
    // 2 → 1: the old goes down and out, the next comes from above
    expect(backwards["copy-2"]?.slide).toMatchObject({
      from: 0,
      to: 1,
      clip: { from: unclipped, to: { top: 0, bottom: 1 } },
    });
    expect(backwards["copy-1"]?.slide).toMatchObject({
      from: -1,
      to: 0,
      clip: { from: { top: 1, bottom: 0 }, to: unclipped },
    });
  });

  test("the stack, which both projects share, does not roll", () => {
    expect(forwards.stack?.slide).toBeUndefined();
    expect(forwards.stack?.frame?.from).toEqual(forwards.stack?.frame?.to);
  });

  test("the step takes as long as the roll", () => {
    expect(
      planMotion(wide("projects", false, 0), wide("projects", false, 1), false)
        .duration,
    ).toBe(0.38);
  });

  test("nothing is a page turn", () => {
    expect(
      planMotion(wide("projects", false, 0), wide("projects", false, 1), false)
        .turns,
    ).toEqual([]);
  });
});

describe("changing workspace", () => {
  const forwards = planMotion(wide("opening"), wide("contact"), false);
  const backwards = planMotion(wide("contact"), wide("opening"), false);
  const slide = (
    from: number,
    to: number,
    at: number,
  ): WindowPlan["slide"] => ({
    extent: "area",
    gap: 14,
    from,
    to,
    at,
    duration: 0.27,
    ease: "power3.inOut",
  });

  test("the old windows leave in tiling order, 0.032s apart, as the next arrive in theirs, one place later", () => {
    const leaving = forwards.windows.filter((w) => w.leaves);
    expect(leaving.map((w) => w.id)).toEqual(
      Object.keys(wide("opening").layout),
    );
    expect(leaving.map((w) => w.slide)).toEqual([
      slide(0, -1, 0),
      slide(0, -1, 0.032),
      slide(0, -1, 2 * 0.032),
    ]);
    const arriving = forwards.windows.filter((w) => !w.leaves);
    expect(arriving.map((w) => w.id)).toEqual(["contact", "name", "term"]);
    expect(arriving.map((w) => w.slide)).toEqual([
      slide(1, 0, 0.032),
      slide(1, 0, 2 * 0.032),
      slide(1, 0, 3 * 0.032),
    ]);
  });

  test("a lower workspace is the reverse", () => {
    const leaving = backwards.windows.filter((w) => w.leaves);
    expect(leaving.map((w) => w.slide?.to)).toEqual([1, 1, 1]);
    const arriving = backwards.windows.filter((w) => !w.leaves);
    expect(arriving.map((w) => w.slide?.from)).toEqual([-1, -1, -1]);
    expect(arriving.map((w) => w.id)).toEqual(["name", "term", "now"]);
  });

  test("a window on both workspaces leaves as a copy, and arrives as itself", () => {
    const copies = forwards.windows.filter((w) => w.copy);
    expect(copies.map((w) => w.id)).toEqual(["name", "term"]);
    expect(copies.every((w) => w.leaves)).toBe(true);
    const arrivals = forwards.windows.filter((w) => !w.leaves);
    expect(arrivals.some((w) => w.copy)).toBe(false);
    expect(arrivals.map((w) => w.id)).toContain("name");
  });

  test("each leaves from its tile in its own workspace", () => {
    expect(
      forwards.windows.find((w) => w.id === "name" && w.leaves)?.shownAt,
    ).toEqual(wide("opening").layout.name as never);
    expect(forwards.windows.find((w) => w.id === "now")?.shownAt).toEqual(
      wide("opening").layout.now as never,
    );
    expect(
      forwards.windows.find((w) => w.id === "name" && !w.leaves)?.shownAt,
    ).toBeUndefined();
  });

  test("nothing is a copy between workspaces that share no window", () => {
    const plan = planMotion(wide("about"), wide("sabbatical"), false);
    expect(plan.windows.some((w) => w.copy)).toBe(false);
  });

  test("the area is clipped while it travels", () => {
    expect(forwards.clipsArea).toBe(true);
    expect(
      planMotion(wide("timeline"), wide("timeline", true), false).clipsArea,
    ).toBe(false);
  });

  test("the written order decides, not the position", () => {
    const plan = planMotion(
      placed({ b: [50, 0, 50, 100], a: [0, 0, 50, 100] }),
      placed({}, firstStepOf(workspaces, ws("contact"))),
      false,
    );
    expect(plan.windows.filter((w) => w.leaves).map((w) => w.id)).toEqual([
      "b",
      "a",
    ]);
    expect(plan.windows.map((w) => w.slide?.at)).toEqual([0, 0.032]);
  });

  test("a jump across several workspaces travels one screen, like a step to the next", () => {
    const far = planMotion(wide("opening"), wide("sabbatical"), false);
    expect(far.windows.find((w) => w.leaves)?.slide?.to).toBe(-1);
  });

  test("it lasts until the last window is in", () => {
    // the last of four arrivals starts 0.032 * 3 after the first leaves
    expect(forwards.duration).toBeCloseTo(3 * 0.032 + 0.27, 10);
  });

  test("on a phone, a swipe to a screen whose windows all change travels the same way", () => {
    const plan = planMotion(
      phone("timeline", false, 0),
      phone("timeline", false, 1),
      true,
    );
    expect(plan.motion).toBe("changing workspace");
    expect(plan.windows.map((w) => [w.id, w.leaves])).toEqual([
      ["timeline", true],
      ["education", false],
      ["skills", false],
    ]);
    // and back, the other way
    const back = planMotion(
      phone("timeline", false, 1),
      phone("timeline", false, 0),
      true,
    );
    expect(back.windows[0]?.slide?.to).toBe(1);
  });
});

describe("first appearance", () => {
  test("wide: each window comes from the edge its tile sits on, one after another, nothing re-tiling", () => {
    const plan = planMotion(null, wide("sabbatical"), false);
    expect(plan.windows.map((w) => [w.id, w.edge])).toEqual([
      ["sabbatical", "bottom"],
      ["photo-1", "top"],
      ["photo-2", "right"],
      ["photo-3", "bottom"],
      ["photo-4", "right"],
    ]);
    expect(plan.windows.map((w) => w.frame?.at)).toEqual([
      0,
      0.05,
      2 * 0.05,
      3 * 0.05,
      4 * 0.05,
    ]);
    const [first, , third] = plan.windows;
    expect(first?.frame).toEqual({
      from: [0, 100, 34, 0],
      to: [0, 0, 34, 100],
      at: 0,
      duration: 0.32,
      ease: "power3.out",
    });
    expect(third?.frame?.from).toEqual([100, 0, 0, 50]);
    expect(third?.fade).toEqual({
      from: 0,
      to: 1,
      at: 2 * 0.05,
      duration: 0.12,
      ease: "none",
    });
    expect(plan.windows.every((w) => !w.leaves && !w.copy)).toBe(true);
  });

  test("wide: a tile reaching the right comes from the right, else the bottom, left, top", () => {
    const edge = (tile: [number, number, number, number]) =>
      planMotion(null, placed({ a: tile }), false).windows[0]?.edge;
    expect(edge([50, 0, 50, 100])).toBe("right");
    expect(edge([60, 0, 40, 40])).toBe("right");
    expect(edge([0, 60, 50, 40])).toBe("bottom");
    expect(edge([0, 0, 50, 50])).toBe("left");
    expect(edge([20, 0, 50, 40])).toBe("top");
  });

  test("wide: its place in tiling order makes no difference to its edge", () => {
    const plan = planMotion(
      null,
      placed({
        a: [0, 0, 60, 100],
        b: [0, 0, 60, 100],
        c: [0, 0, 60, 100],
      }),
      false,
    );
    expect(plan.windows.map((w) => w.edge)).toEqual([
      "bottom",
      "bottom",
      "bottom",
    ]);
  });

  test("phone: right and left by turns, the first from the right, whatever the tile", () => {
    const plan = planMotion(
      null,
      placed({
        a: [0, 0, 100, 30],
        b: [0, 30, 100, 30],
        c: [0, 60, 100, 40],
        d: [0, 0, 100, 30],
        e: [0, 70, 100, 30],
      }),
      true,
    );
    expect(plan.windows.map((w) => w.edge)).toEqual([
      "right",
      "left",
      "right",
      "left",
      "right",
    ]);
  });

  test("it lasts until the last window is in", () => {
    expect(planMotion(null, wide("sabbatical"), false).duration).toBeCloseTo(
      4 * 0.05 + 0.32,
      10,
    );
  });
});

describe("a paged window turning its page", () => {
  // the archive on a phone: a screen for each page of its entries, the same layout
  const archive = (page: number): Placement => {
    const first = phone("projects", true);
    return {
      ...first,
      where: { ...first.where, screen: page },
      pages: { archive: page },
    };
  };

  test("the page turns inside its window: the old entries leave, the next come in", () => {
    const plan = planMotion(archive(0), archive(1), true);
    expect(plan.motion).toBe("re-tiling");
    expect(plan.turns).toEqual([
      {
        id: "archive",
        out: {
          extent: "body",
          gap: 0,
          from: 0,
          to: -1,
          at: 0,
          duration: 0.38,
          ease: "power3.inOut",
        },
        in: {
          extent: "body",
          gap: 0,
          from: 1,
          to: 0,
          at: 0,
          duration: 0.38,
          ease: "power3.inOut",
        },
      },
    ]);
    // its frame does not move
    expect(plan.windows.map((w) => [w.id, w.motion])).toEqual([
      ["archive", "re-tiling"],
    ]);
    expect(plan.windows[0]?.frame?.from).toEqual(plan.windows[0]?.frame?.to);
    expect(plan.duration).toBe(0.38);
  });

  test("turning back a page reverses it", () => {
    const plan = planMotion(archive(1), archive(0), true);
    expect(plan.turns[0]?.out.to).toBe(1);
    expect(plan.turns[0]?.in.from).toBe(-1);
  });

  test("a window left on its page turns nothing", () => {
    expect(planMotion(archive(1), archive(1), true).turns).toEqual([]);
    // a page counted from 0 when none is said
    expect(planMotion(archive(0), phone("projects", true), true).turns).toEqual(
      [],
    );
  });

  test("a step in another layout does not turn a page: it travels", () => {
    const plan = planMotion(
      phone("timeline", false, 0),
      phone("timeline", false, 1),
      true,
    );
    expect(plan.turns).toEqual([]);
  });

  test("only on a phone", () => {
    const wideArchive = (page: number): Placement => ({
      ...wide("projects", true),
      pages: { archive: page },
    });
    expect(planMotion(wideArchive(0), wideArchive(1), false).turns).toEqual([]);
  });
});

describe("which way a motion goes", () => {
  test("by step, then by screen", () => {
    const at = (step: number, screen: number): Placement => ({
      ...placed({ a: [0, 0, 100, 100] }, step),
      where: { step, screen, open: false },
    });
    // the same workspace: a later step goes up, an earlier one goes down
    expect(planMotion(at(1, 0), at(2, 0), false).direction).toBe(1);
    expect(planMotion(at(2, 0), at(1, 0), false).direction).toBe(-1);
    // the same step: by screen
    expect(planMotion(at(1, 0), at(1, 1), true).direction).toBe(1);
    expect(planMotion(at(1, 1), at(1, 0), true).direction).toBe(-1);
    // an earlier step on a later screen is still earlier
    expect(planMotion(at(2, 0), at(1, 3), true).direction).toBe(-1);
    // the same place goes forwards
    expect(planMotion(at(1, 0), at(1, 0), false).direction).toBe(1);
  });
});
