// First appearance: when the desktop loads, each of the step's windows slides
// straight into its tile from an edge, one after another in tiling order;
// nothing re-tiles. Shape only, never timing: every frame from the first is
// sampled and checked for which edge each window comes from, the order they
// start moving in, no other side moving, and the final rectangles.
import { devices, expect, type Page, test } from "@playwright/test";
import { area, ready } from "./helpers";

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
interface Run {
  /** The windows in tiling order. */
  ids: string[];
  /** Each window's box on every frame, in tiling order; null while it is hidden. */
  frames: (Box | null)[][];
  /** The state of `data-retiling` on the frame the windows were first sampled. */
  waited: boolean;
}

const PANES = ".pane[data-window]";

/** Load `path`, sampling every window's box on every frame until the desktop is at rest. */
async function load(page: Page, path: string): Promise<Run> {
  await page.addInitScript((sel) => {
    const w = window as unknown as {
      __frames: (Box | null)[][];
      __ids: string[];
      __waited: boolean;
    };
    w.__frames = [];
    w.__ids = [];
    w.__waited = false;
    const tick = () => {
      const a = document.querySelector<HTMLElement>("main.area");
      if (a?.dataset.ready === "true") {
        const panes = [...document.querySelectorAll<HTMLElement>(sel)].filter(
          (p) => getComputedStyle(p).display !== "none",
        );
        if (w.__ids.length === 0) {
          w.__ids = panes.map((p) => p.dataset.window ?? "");
          w.__waited = a.dataset.retiling === "true";
        }
        const origin = a.getBoundingClientRect();
        w.__frames.push(
          w.__ids.map((id) => {
            const p = document.querySelector<HTMLElement>(
              `${sel}[data-window="${id}"]`,
            );
            const b = p?.getBoundingClientRect();
            return b
              ? {
                  left: b.left - origin.left,
                  top: b.top - origin.top,
                  width: b.width,
                  height: b.height,
                }
              : null;
          }),
        );
        if (a.dataset.retiling === "false") return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, PANES);
  await page.goto(path);
  await expect(area(page)).toHaveAttribute("data-retiling", "false");
  await page.waitForFunction(
    () => (window as unknown as { __ids: string[] }).__ids.length > 0,
  );
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => r(null))),
  );
  return page.evaluate(() => {
    const w = window as unknown as {
      __frames: (Box | null)[][];
      __ids: string[];
      __waited: boolean;
    };
    return { ids: w.__ids, frames: w.__frames, waited: w.__waited };
  });
}

/** Where the step's windows rest with no motion at all (reduced motion). */
async function restOf(
  page: Page,
  path: string,
  ids: string[],
): Promise<(Box | null)[]> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, path);
  const a = await area(page).boundingBox();
  return Promise.all(
    ids.map(async (id) => {
      const b = await page
        .locator(`${PANES}[data-window="${id}"]`)
        .boundingBox();
      return b && a
        ? { left: b.x - a.x, top: b.y - a.y, width: b.width, height: b.height }
        : null;
    }),
  );
}

const live = (frames: (Box | null)[][], i: number): Box[] =>
  frames
    .map((f) => f[i])
    .filter((b): b is Box => !!b && b.width > 20 && b.height > 20);

/** The first frame on which window `i` has moved or grown more than 2px from its first. */
const startedAt = (frames: (Box | null)[][], i: number): number => {
  const first = frames[0]?.[i];
  return frames.findIndex((f) => {
    const b = f[i];
    return (
      !!first &&
      !!b &&
      [
        b.left - first.left,
        b.top - first.top,
        b.width - first.width,
        b.height - first.height,
      ].some((d) => Math.abs(d) > 2)
    );
  });
};

// a window with no width still draws its border, so a little more than a pixel
const near = (a: number, b: number, within = 4) => Math.abs(a - b) <= within;

/** Where a window of this final box comes from, on a wide screen. */
function edgeOfBox(b: Box, a: { width: number; height: number }) {
  if (near(b.left + b.width, a.width)) return "right";
  if (near(b.top + b.height, a.height)) return "bottom";
  if (near(b.left, 0)) return "left";
  return "top";
}

/**
 * The window slid out of `edge` straight into its tile: the side on the edge
 * never moved, the opposite side only moved away from it, and the other two
 * dimensions never changed.
 */
function expectSlid(frames: Box[], end: Box, edge: string) {
  for (const b of frames) {
    if (edge === "right")
      expect(near(b.left + b.width, end.left + end.width)).toBe(true);
    if (edge === "left") expect(near(b.left, end.left)).toBe(true);
    if (edge === "bottom")
      expect(near(b.top + b.height, end.top + end.height)).toBe(true);
    if (edge === "top") expect(near(b.top, end.top)).toBe(true);
    if (edge === "right" || edge === "left") {
      expect(near(b.top, end.top)).toBe(true);
      expect(near(b.height, end.height)).toBe(true);
    } else {
      expect(near(b.left, end.left)).toBe(true);
      expect(near(b.width, end.width)).toBe(true);
    }
  }
  const grows = frames.map((b) =>
    edge === "right" || edge === "left" ? b.width : b.height,
  );
  expect(grows.every((g, i) => i === 0 || g >= (grows[i - 1] ?? 0) - 0.5)).toBe(
    true,
  );
}

test.describe("wide screen", () => {
  test("each window slides in from the edge its tile sits on, in tiling order, and nothing re-tiles", async ({
    page,
  }) => {
    const run = await load(page, "/");
    expect(run.waited).toBe(true);
    expect(run.ids.length).toBeGreaterThan(1);
    const a = await area(page).boundingBox();
    if (!a) throw new Error("no area");
    const end = run.frames.at(-1) as (Box | null)[];

    // each from its own edge, straight into its tile
    const edges = new Set<string>();
    for (const [i] of run.ids.entries()) {
      const final = end[i];
      expect(final).not.toBeNull();
      if (!final) continue;
      const edge = edgeOfBox(final, a);
      edges.add(edge);
      const moving = live(run.frames, i);
      expect(moving.length).toBeGreaterThan(1);
      expectSlid(moving, final, edge);
    }
    expect(edges.size).toBeGreaterThan(0);

    // they start moving one after another, in tiling order
    const starts = run.ids.map((_, i) => startedAt(run.frames, i));
    expect(starts.every((s) => s >= 0)).toBe(true);
    for (const [i, s] of starts.entries())
      if (i > 0) expect(s).toBeGreaterThanOrEqual(starts[i - 1] ?? 0);
    expect(starts.at(-1) ?? 0).toBeGreaterThan(starts[0] ?? 0);

    // the final rectangles are the step's at rest
    const rest = await restOf(await page.context().newPage(), "/", run.ids);
    for (const [i, r] of rest.entries()) {
      const f = end[i];
      expect(r && f && near(f.left, r.left) && near(f.top, r.top)).toBe(true);
      expect(r && f && near(f.width, r.width) && near(f.height, r.height)).toBe(
        true,
      );
    }
  });

  test("every address comes on show the same way", async ({ page }) => {
    for (const path of ["/archive/", "/work/"]) {
      const run = await load(page, path);
      expect(run.waited).toBe(true);
      const end = run.frames.at(-1) as (Box | null)[];
      const starts = run.ids.map((_, i) => startedAt(run.frames, i));
      expect(starts.every((s) => s >= 0)).toBe(true);
      expect(starts.at(-1) ?? 0).toBeGreaterThanOrEqual(starts[0] ?? 0);
      expect(end.every((b) => b && b.width > 1 && b.height > 1)).toBe(true);
    }
  });

  test("reduced motion: the step is simply there", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const run = await load(page, "/");
    expect(run.waited).toBe(false);
    const first = run.frames[0] as (Box | null)[];
    const last = run.frames.at(-1) as (Box | null)[];
    expect(JSON.stringify(first)).toBe(JSON.stringify(last));
  });
});

const { defaultBrowserType: _, ...pixel } = devices["Pixel 7"];

test.describe("phone", () => {
  test.use(pixel);

  test("windows slide in from the right and left by turns, the first from the right, and none changes its top or height", async ({
    page,
  }) => {
    const run = await load(page, "/");
    expect(run.waited).toBe(true);
    expect(run.ids.length).toBeGreaterThan(1);
    const end = run.frames.at(-1) as (Box | null)[];
    for (const [i] of run.ids.entries()) {
      const final = end[i];
      expect(final).not.toBeNull();
      if (!final) continue;
      const moving = live(run.frames, i);
      expect(moving.length).toBeGreaterThan(1);
      expectSlid(moving, final, i % 2 === 0 ? "right" : "left");
    }
    const starts = run.ids.map((_, i) => startedAt(run.frames, i));
    for (const [i, s] of starts.entries())
      if (i > 0) expect(s).toBeGreaterThanOrEqual(starts[i - 1] ?? 0);
  });
});
