import { describe, expect, test } from "bun:test";
import {
  collapsed,
  edgeOf,
  rollOf,
  sortChanges,
  travelOf,
} from "../src/lib/motion";
import {
  createWorkspaces,
  firstStepOf,
  type Layout,
  screensOf,
  stepAt,
  tilingOf,
} from "../src/lib/workspaces";

const workspaces = createWorkspaces({ featured: 4 });
const ws = (id: string) => workspaces.findIndex((w) => w.id === id);
const wide = (id: string, open = false, index = 0): Layout =>
  tilingOf(stepAt(workspaces, firstStepOf(workspaces, ws(id)) + index), open);

/** Each window's motion, by id. */
const motions = (before: Layout, after: Layout, same = true) =>
  Object.fromEntries(
    sortChanges(before, after, same).map((c) => [c.id, c.motion]),
  );

describe("sorting each window between two layouts", () => {
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
    expect(motions(wide("opening"), wide("contact"), false)).toEqual({
      name: "changing workspace",
      term: "changing workspace",
      now: "changing workspace",
      contact: "changing workspace",
    });
  });

  test("each change carries the window's old and new tiles", () => {
    const changes = sortChanges(wide("timeline"), wide("timeline", true), true);
    expect(changes.find((c) => c.id === "education")).toEqual({
      id: "education",
      motion: "re-tiling",
      from: [62, 0, 38, 40],
      to: [46, 0, 54, 100],
    });
    expect(changes.find((c) => c.id === "skills")).toEqual({
      id: "skills",
      motion: "closing",
      from: [62, 40, 38, 60],
      to: null,
    });
  });

  test("the new step's windows come first, in tiling order, then those that leave", () => {
    const ids = sortChanges(
      wide("projects", false, 0),
      wide("projects", false, 1),
      true,
    ).map((c) => c.id);
    expect(ids).toEqual(["copy-2", "stack", "comp-2", "copy-1", "comp-1"]);
  });

  test("a window that leaves for a different tile closes rather than rolls past", () => {
    expect(
      motions(
        { a: [0, 0, 50, 100], b: [50, 0, 50, 100] },
        { a: [0, 0, 100, 100], c: [0, 0, 50, 50] },
      ),
    ).toEqual({
      a: "re-tiling",
      b: "closing",
      c: "opening",
    });
  });
});

describe("the edge a window opens out of and closes into", () => {
  test("skills goes into the bottom edge as Education grows down", () => {
    expect(edgeOf("skills", wide("timeline"), wide("timeline", true))).toBe(
      "bottom",
    );
    // and comes back out of it
    expect(edgeOf("skills", wide("timeline", true), wide("timeline"))).toBe(
      "bottom",
    );
  });

  test("the archive comes from the right, and goes back there", () => {
    expect(edgeOf("archive", wide("projects"), wide("projects", true))).toBe(
      "right",
    );
    expect(edgeOf("archive", wide("projects", true), wide("projects"))).toBe(
      "right",
    );
  });

  test("the far side from neighbours to its right is the left", () => {
    const before: Layout = { b: [40, 0, 60, 100] };
    const after: Layout = { a: [0, 0, 40, 100], b: [40, 0, 60, 100] };
    // b doesn't overlap a: no neighbour, so the fallback (a doesn't touch the right)
    expect(edgeOf("a", before, after)).toBe("bottom");
    expect(edgeOf("a", { b: [0, 0, 100, 100] }, after)).toBe("left");
  });

  test("the far side from a neighbour below is the top", () => {
    expect(
      edgeOf(
        "a",
        { b: [0, 0, 100, 100] },
        { a: [0, 0, 100, 30], b: [0, 30, 100, 70] },
      ),
    ).toBe("top");
  });

  test("with no neighbour overlapping it falls back to right, else bottom", () => {
    expect(edgeOf("a", {}, { a: [50, 0, 50, 100] })).toBe("right");
    expect(edgeOf("a", {}, { a: [0, 50, 50, 50] })).toBe("bottom");
    expect(edgeOf("a", {}, { a: [0, 0, 50, 50] })).toBe("bottom");
  });

  test("a step's real tiles: the about window has nothing beside it", () => {
    expect(edgeOf("about", {}, wide("about"))).toBe("right");
  });
});

describe("the edge a window takes on a phone", () => {
  const phone = (id: string, open = false, screen = 0): Layout =>
    screensOf(stepAt(workspaces, firstStepOf(workspaces, ws(id))), open)[
      screen
    ] ?? {};
  const edge = (id: string, before: Layout, after: Layout) =>
    edgeOf(id, before, after, true);

  test("the archive comes from the right and goes back into it", () => {
    const closed = phone("projects");
    const open = phone("projects", true);
    expect(edge("archive", closed, open)).toBe("right");
    expect(edge("archive", open, closed)).toBe("right");
  });

  test("the copy and the composition go into the left edge, and come out of it", () => {
    const closed = phone("projects");
    const open = phone("projects", true);
    for (const id of Object.keys(closed)) {
      expect(edge(id, closed, open)).toBe("left");
      expect(edge(id, open, closed)).toBe("left");
    }
  });

  test("Skills goes into the bottom edge as Education grows down", () => {
    const second = phone("timeline", false, 1);
    const open = phone("timeline", true);
    expect(edge("skills", second, open)).toBe("bottom");
    expect(edge("skills", open, second)).toBe("bottom");
  });

  test("a wide screen keeps its rule: no neighbour, the fallback", () => {
    expect(edgeOf("a", { b: [0, 0, 100, 50] }, { a: [0, 0, 100, 100] })).toBe(
      "right",
    );
    expect(edgeOf("b", { b: [0, 0, 100, 50] }, { a: [0, 0, 100, 100] })).toBe(
      "right",
    );
  });
});

describe("a tile collapsed onto an edge", () => {
  const tile = [62, 40, 38, 60] as const;
  test("keeps the edge's side and loses its extent across it", () => {
    expect(collapsed(tile, "bottom")).toEqual([62, 100, 38, 0]);
    expect(collapsed(tile, "top")).toEqual([62, 40, 38, 0]);
    expect(collapsed(tile, "right")).toEqual([100, 40, 0, 60]);
    expect(collapsed(tile, "left")).toEqual([62, 40, 0, 60]);
  });
});

describe("rolling past", () => {
  test("forwards the old goes up and out, the next comes from below", () => {
    const r = rollOf(1, 200);
    expect(r.out.to).toEqual({ y: -200, clip: "inset(200px 0px 0px 0px)" });
    expect(r.in.from).toEqual({ y: 200, clip: "inset(0px 0px 200px 0px)" });
  });
  test("backwards is the reverse", () => {
    const r = rollOf(-1, 200);
    expect(r.out.to).toEqual({ y: 200, clip: "inset(0px 0px 200px 0px)" });
    expect(r.in.from).toEqual({ y: -200, clip: "inset(200px 0px 0px 0px)" });
  });
  test("both rest unclipped", () => {
    expect(rollOf(1, 50).rest).toEqual({
      y: 0,
      clip: "inset(0px 0px 0px 0px)",
    });
  });
});

describe("changing workspace", () => {
  const ids = (list: { id: string }[]) => list.map((w) => w.id);

  test("the old windows leave in tiling order, the next arrive in theirs", () => {
    const { leaving, arriving } = travelOf(wide("sabbatical"), wide("about"));
    expect(ids(leaving)).toEqual(Object.keys(wide("sabbatical")));
    expect(ids(arriving)).toEqual(["about"]);
  });

  test("the written order decides, not the position", () => {
    const before: Layout = { b: [50, 0, 50, 100], a: [0, 0, 50, 100] };
    expect(ids(travelOf(before, {}).leaving)).toEqual(["b", "a"]);
  });

  test("a window on both workspaces leaves as a clone and arrives as itself", () => {
    const { leaving, arriving } = travelOf(wide("opening"), wide("contact"));
    const shared = (list: { id: string; shared: boolean }[]) =>
      list.filter((w) => w.shared).map((w) => w.id);
    expect(shared(leaving)).toEqual(["name", "term"]);
    expect(shared(arriving)).toEqual(["name", "term"]);
    expect(ids(leaving)).toEqual(["name", "term", "now"]);
    expect(ids(arriving)).toEqual(["contact", "name", "term"]);
  });

  test("each carries its tile in its own workspace", () => {
    const { leaving, arriving } = travelOf(wide("opening"), wide("contact"));
    expect(leaving.find((w) => w.id === "name")?.tile).toEqual(
      wide("opening").name as never,
    );
    expect(arriving.find((w) => w.id === "name")?.tile).toEqual(
      wide("contact").name as never,
    );
  });

  test("nothing is shared between workspaces that share no window", () => {
    const { leaving, arriving } = travelOf(wide("about"), wide("sabbatical"));
    expect([...leaving, ...arriving].some((w) => w.shared)).toBe(false);
  });
});
