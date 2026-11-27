// First appearance: when the desktop loads, each of the step's windows slides
// straight into its tile from an edge, one after another in tiling order;
// nothing re-tiles. Shape only, never timing: every frame from the first is
// sampled and checked for which edge each window comes from, the order they
// start moving in, no other side moving, and the final rectangles.
import { expect, type Page, test } from "@playwright/test";
import {
  screensOf,
  stepAt,
  tilingOf,
  type Workspace,
} from "../src/lib/workspaces";
import {
  areaBox,
  booted,
  expectNotRetiling,
  expectStep,
  type InPage,
  isOpen,
  isRetiling,
  modelOf,
  PHONES,
  probe,
  ready,
  whereOf,
} from "./desktop";

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
  /** The state of `data-retiling` on the frame the windows were first sampled, if read. */
  waited?: boolean;
}

const PANES = ".pane[data-window]";

/** Load `path`, sampling every window's box on every frame until the desktop is at rest. */
async function load(page: Page, path: string): Promise<Run> {
  await probe(page);
  await page.addInitScript(
    ({ sel }) => {
      const w = window as unknown as {
        __frames: (Box | null)[][];
        __ids: string[];
        __waited: boolean;
      };
      w.__frames = [];
      w.__ids = [];
      w.__waited = false;
      const tick = () => {
        const a = (window as unknown as InPage).desktopNow();
        if (a?.ready) {
          const panes = [...document.querySelectorAll<HTMLElement>(sel)].filter(
            (p) => getComputedStyle(p).display !== "none",
          );
          if (w.__ids.length === 0) {
            w.__ids = panes.map((p) => p.dataset.window ?? "");
            w.__waited = a.retiling;
          }
          const origin = a.box;
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
          if (!a.retiling) return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    { sel: PANES },
  );
  // the appearance runs on the page's clock in fixed frames, so a busy machine
  // cannot skip part of it between two sampled frames
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto(path);
  await booted(page);
  for (let f = 0; f < 400 && (await isRetiling(page)); f++)
    await page.clock.runFor(16);
  await page.clock.resume();
  await expectNotRetiling(page);
  await page.waitForFunction(
    () => (window as unknown as { __ids: string[] }).__ids.length > 0,
  );
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => r(null))),
  );
  const sampled = await page.evaluate(() => {
    const w = window as unknown as {
      __frames: (Box | null)[][];
      __ids: string[];
      __waited: boolean;
    };
    return { ids: w.__ids, frames: w.__frames, waited: w.__waited };
  });
  // in tiling order: the order the step's layout writes its windows in
  const order = await tilingOrder(page, sampled.ids);
  const at = order.map((id) => sampled.ids.indexOf(id));
  return {
    ids: order,
    frames: sampled.frames.map((f) => at.map((i) => f[i] ?? null)),
    waited: sampled.waited,
  };
}

/** The windows on show, in the order the layout on show writes them. */
async function tilingOrder(page: Page, ids: string[]): Promise<string[]> {
  const model = (await modelOf(page)) as unknown as Workspace[];
  const { step } = await whereOf(page);
  const open = await isOpen(page);
  const at = stepAt(model, step);
  const onShow = [...ids].sort().join();
  const layout = [tilingOf(at, open), ...screensOf(at, open)].find(
    (l) => Object.keys(l).sort().join() === onShow,
  );
  if (!layout) throw new Error(`no layout of step ${step} shows ${onShow}`);
  return Object.keys(layout);
}

/** Where the step's windows rest with no motion at all (reduced motion). */
async function restOf(
  page: Page,
  path: string,
  ids: string[],
): Promise<(Box | null)[]> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, path);
  const a = await areaBox(page);
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

/** An archive project's address: it boots with the archive open on its entry. */
const ARCHIVE_PROJECT = "/work/truecrypt-steganography/";

/**
 * Every window slid in from the edge `edgeOf` gives its final box, and they
 * started moving in tiling order.
 */
function expectAppeared(run: Run, edgeOf: (final: Box, i: number) => string) {
  expect(run.ids.length).toBeGreaterThan(0);
  const end = run.frames.at(-1) as (Box | null)[];
  for (const [i] of run.ids.entries()) {
    const final = end[i];
    expect(final).not.toBeNull();
    if (!final) continue;
    const moving = live(run.frames, i);
    expect(moving.length).toBeGreaterThan(1);
    expectSlid(moving, final, edgeOf(final, i));
  }
  const starts = run.ids.map((_, i) => startedAt(run.frames, i));
  expect(starts.every((s) => s >= 0)).toBe(true);
  for (const [i, s] of starts.entries())
    if (i > 0) expect(s).toBeGreaterThanOrEqual(starts[i - 1] ?? 0);
}

test.describe("wide screen", () => {
  test("each window slides in from the edge its tile sits on, in tiling order, and nothing re-tiles", async ({
    page,
  }) => {
    const run = await load(page, "/");
    expect(run.waited).toBe(true);
    expect(run.ids.length).toBeGreaterThan(1);
    const a = await areaBox(page);
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

  test("every address comes on show the same way: the archive, an archive project's and the work's", async ({
    page,
  }) => {
    for (const path of ["/archive/", ARCHIVE_PROJECT, "/work/"]) {
      const run = await load(page, path);
      const a = await areaBox(page);
      if (!a) throw new Error("no area");
      expect(run.waited).toBe(true);
      expectAppeared(run, (final) => edgeOfBox(final, a));
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

const pixel = PHONES["Pixel 7"];

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

  test("a swipe during the first appearance does not cut it short", async ({
    page,
  }) => {
    // on the first frame the windows are coming in, a finger swipes up the
    // screen (a step down), as the page's pointer handlers see one: sent from
    // the page, so it can't arrive after the windows are in
    await probe(page);
    await page.addInitScript(() => {
      const w = window as unknown as { __swiped: boolean };
      w.__swiped = false;
      const finger = (type: string, y: number) =>
        document.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 7,
            pointerType: "touch",
            isPrimary: true,
            clientX: 200,
            clientY: y,
            bubbles: true,
          }),
        );
      const tick = () => {
        const a = (window as unknown as InPage).desktopNow();
        if (a?.ready && a.retiling) {
          finger("pointerdown", 600);
          for (const y of [560, 500, 420, 360]) finger("pointermove", y);
          finger("pointerup", 360);
          w.__swiped = true;
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    // the appearance is sampled on every frame until the swipe, queued,
    // runs: the step changes once every window is in
    await page.addInitScript(
      ({ sel }) => {
        const w = window as unknown as {
          __in: (Box | null)[][];
          __inIds: string[];
        };
        w.__in = [];
        w.__inIds = [];
        const tick = () => {
          const a = (window as unknown as InPage).desktopNow();
          if (a?.ready) {
            if (a.step !== 0) return;
            if (w.__inIds.length === 0)
              w.__inIds = [...document.querySelectorAll<HTMLElement>(sel)]
                .filter((p) => getComputedStyle(p).display !== "none")
                .map((p) => p.dataset.window ?? "");
            const origin = a.box;
            w.__in.push(
              w.__inIds.map((id) => {
                const b = document
                  .querySelector<HTMLElement>(`${sel}[data-window="${id}"]`)
                  ?.getBoundingClientRect();
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
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { sel: PANES },
    );
    // Time is the test's: Playwright's clock fakes requestAnimationFrame and
    // Date, so GSAP's ticker moves only in the fixed frames run here. A busy
    // machine can no longer skip the appearance ahead between two frames.
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.goto("/");
    await booted(page);
    for (let f = 0; f < 200; f++) {
      await page.clock.runFor(16);
      if ((await whereOf(page)).step === 1 && !(await isRetiling(page))) break;
    }
    await page.clock.resume();
    // once the windows are in, the queued swipe runs: one step down
    await expectStep(page, 1);
    await expectNotRetiling(page);
    expect(
      await page.evaluate(
        () => (window as unknown as { __swiped: boolean }).__swiped,
      ),
    ).toBe(true);
    expect(await whereOf(page)).toMatchObject({ step: 1, screen: 0 });

    // every window still slid all the way into its tile on step 0, in tiling order
    const { ids, frames } = await page.evaluate(() => {
      const w = window as unknown as {
        __in: (Box | null)[][];
        __inIds: string[];
      };
      return {
        ids: w.__inIds,
        frames: w.__in,
      };
    });
    const model = (await modelOf(page)) as unknown as Workspace[];
    const at = stepAt(model, 0);
    const onShow = [...ids].sort().join();
    const layout = [tilingOf(at, false), ...screensOf(at, false)].find(
      (l) => Object.keys(l).sort().join() === onShow,
    );
    if (!layout) throw new Error(`no layout of step 0 shows ${onShow}`);
    const order = Object.keys(layout).map((id) => ids.indexOf(id));
    const run: Run = {
      ids: Object.keys(layout),
      frames: frames.map((f) => order.map((i) => f[i] ?? null)),
    };
    expectAppeared(run, (_, i) => (i % 2 === 0 ? "right" : "left"));
    const rest = await restOf(await page.context().newPage(), "/", run.ids);
    const end = run.frames.at(-1) as (Box | null)[];
    for (const [i, r] of rest.entries()) {
      const f = end[i];
      expect(r && f && near(f.left, r.left) && near(f.top, r.top)).toBe(true);
      expect(r && f && near(f.width, r.width) && near(f.height, r.height)).toBe(
        true,
      );
    }
  });
});

test.describe("short phone", () => {
  // short enough that the archive takes two pages
  test.use({ ...pixel, viewport: { width: 412, height: 450 } });

  test("a paged window at its booted page comes on show the same way", async ({
    page,
  }) => {
    const run = await load(page, ARCHIVE_PROJECT);
    expect(run.waited).toBe(true);
    // the archive boots on the page holding the project, not its first
    expect((await whereOf(page)).screen).toBeGreaterThan(0);
    expectAppeared(run, (_, i) => (i % 2 === 0 ? "right" : "left"));
  });
});
