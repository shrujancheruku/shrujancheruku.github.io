import { describe, expect, test } from "bun:test";
import { windowChanges } from "../src/lib/signals";
import { createWorkspaces, stepAt } from "../src/lib/workspaces";

const ws = createWorkspaces({ featured: 4 });
const desktop = (n: number) => stepAt(ws, n).desktop;

describe("which windows come and go between two layouts", () => {
  test("stepping to the next project swaps its composition only", () => {
    // step 1 is the first project, step 2 the second
    expect(windowChanges(desktop(1), desktop(2))).toEqual({
      entered: ["comp-2", "copy-2"],
      left: ["comp-1", "copy-1"],
    });
  });

  test("leaving the projects workspace takes every project window away", () => {
    const { entered, left } = windowChanges(desktop(4), desktop(5));
    expect(left).toEqual(["comp-4", "copy-4", "stack"]);
    expect(entered).toContain("timeline");
  });

  test("the first layout has everything entering and nothing leaving", () => {
    expect(windowChanges(null, desktop(1))).toEqual({
      entered: ["comp-1", "copy-1", "stack"],
      left: [],
    });
  });

  test("the same layout changes nothing", () => {
    expect(windowChanges(desktop(1), desktop(1))).toEqual({
      entered: [],
      left: [],
    });
  });
});
