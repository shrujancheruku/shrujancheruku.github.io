import { describe, expect, test } from "bun:test";
import {
  COMPOSITION_BUDGET_BYTES,
  chunkOf,
  closureBytes,
  drawing,
  missingCompositions,
  overCompositionBudget,
  shouldLoad,
  staticImports,
} from "../src/lib/composition-rules";

const KB = 1024;

describe("composition budget", () => {
  test("the limit is 60 KB of JS plus assets", () => {
    expect(COMPOSITION_BUDGET_BYTES).toBe(60 * KB);
  });

  test("exactly 60 KB is within budget, one byte over is reported", () => {
    expect(overCompositionBudget([{ name: "a", bytes: 60 * KB }])).toEqual([]);
    const over = { name: "b", bytes: 60 * KB + 1 };
    expect(overCompositionBudget([{ name: "a", bytes: 1 }, over])).toEqual([
      over,
    ]);
  });
});

describe("a featured project needs a composition", () => {
  test("none missing when each has one", () => {
    expect(missingCompositions(["a", "b"], ["b", "a", "c"], [])).toEqual([]);
  });

  test("reports the featured projects with neither a composition nor a pending mark", () => {
    expect(missingCompositions(["a", "b", "c"], ["a"], ["c"])).toEqual(["b"]);
  });

  test("a project marked pending that has a composition is an error to fix", () => {
    expect(() => missingCompositions(["a"], ["a"], ["a"])).toThrow(/pending/);
  });
});

describe("when a composition is loaded", () => {
  const base = { workspace: 0, projects: 1, loaded: true, idle: true };

  test("not before the page has loaded and gone idle", () => {
    expect(shouldLoad({ ...base, loaded: false, idle: false })).toBe(false);
    expect(shouldLoad({ ...base, idle: false })).toBe(false);
  });

  test("when the projects workspace is the next one, or the one on show", () => {
    expect(shouldLoad({ ...base, workspace: 0 })).toBe(true);
    expect(shouldLoad({ ...base, workspace: 1 })).toBe(true);
    expect(shouldLoad({ ...base, workspace: 2 })).toBe(true);
  });

  test("not from further away", () => {
    expect(shouldLoad({ ...base, workspace: 3 })).toBe(false);
    expect(shouldLoad({ ...base, workspace: 4 })).toBe(false);
  });

  test("at once when the projects workspace is on show, idle or not", () => {
    expect(
      shouldLoad({ workspace: 1, projects: 1, loaded: false, idle: false }),
    ).toBe(true);
  });
});

describe("when a composition draws", () => {
  const on = { active: true, onscreen: true, visible: true };

  test("when its window is on show, in view, and the tab is visible", () => {
    expect(drawing(on)).toBe(true);
  });

  test("not when any of those is false", () => {
    expect(drawing({ ...on, active: false })).toBe(false);
    expect(drawing({ ...on, onscreen: false })).toBe(false);
    expect(drawing({ ...on, visible: false })).toBe(false);
  });
});

describe("what a built composition weighs", () => {
  test("finds the chunks a built chunk imports statically", () => {
    const code =
      'import{a as b}from"./kit.Ab12.js";import"./shared.Cd34.js";const x=()=>import("./later.Ef56.js");export default 1;';
    expect(staticImports(code)).toEqual(["kit.Ab12.js", "shared.Cd34.js"]);
  });

  test("adds up the chunk and everything it needs, each once", () => {
    const chunks = {
      "orca-flow.A.js": { bytes: 100, imports: ["kit.B.js", "util.C.js"] },
      "kit.B.js": { bytes: 40, imports: ["util.C.js"] },
      "util.C.js": { bytes: 10, imports: [] },
      "other.D.js": { bytes: 999, imports: [] },
    };
    expect(closureBytes("orca-flow.A.js", chunks)).toBe(150);
  });

  test("does not count chunks the first load already has", () => {
    const chunks = {
      "orca-flow.A.js": { bytes: 100, imports: ["desktop.B.js"] },
      "desktop.B.js": { bytes: 5000, imports: [] },
    };
    expect(
      closureBytes("orca-flow.A.js", chunks, new Set(["desktop.B.js"])),
    ).toBe(100);
  });

  test("finds a composition's chunk by its name", () => {
    expect(chunkOf("orca-flow", ["orca-flow.A1b2.js", "kit.B.js"])).toBe(
      "orca-flow.A1b2.js",
    );
    expect(chunkOf("orca-flow", ["orca-flow-session.A.js"])).toBeUndefined();
  });
});
