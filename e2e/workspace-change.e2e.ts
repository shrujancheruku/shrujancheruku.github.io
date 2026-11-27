// Changing workspace: the old workspace's windows slide up and off one after
// another in tiling order as the next workspace's come up from below (the
// reverse going to a lower one). A jump of several workspaces travels one
// screen. A window on both workspaces (the name and its terminal) travels with
// each: a clone leaves with the old workspace while the real pane arrives.
// Shape only, never timing: every frame is sampled and checked for direction,
// the order windows start moving in, how far they travel, no frame jumping,
// and the final rectangles.
import { expect, type Page, test } from "@playwright/test";
import { area, type Box, framesOf, ready, settle } from "./helpers";

/** The desktop's opening and contact windows, by workspace. */
const OPENING = ["name", "term", "now"] as const;
const CONTACT = ["contact", "name", "term"] as const;
const ABOUT = ["about"] as const;

interface Run {
  /** Each window's top, in px from the area's top, on every frame; null if hidden. */
  tops: Record<string, (number | null)[]>;
  /** Each window's rectangle on the last frame, in % of the area. */
  last: Record<string, Box | null>;
  height: number;
  /** The most clones on show at once on any frame. */
  clones: number;
}

/** Sample `ids` on every frame of `action`, which changes workspace. */
/** One frame of the page's clock, in ms. */
const FRAME = 16;

test.beforeEach(async ({ page }) => {
  // the clock flows on its own, except while sample() records a motion
  await page.clock.install();
});

async function sample(
  page: Page,
  ids: readonly string[],
  action: () => Promise<unknown>,
): Promise<Run> {
  const a = await area(page).boundingBox();
  if (!a) throw new Error("no area");
  const selector = ids.map((id) => `.pane[data-window="${id}"]`).join(", ");
  const order = await page.$$eval(selector, (els) =>
    els.map((e) => (e as HTMLElement).dataset.window ?? ""),
  );
  const frames = await framesOf(page, selector, "rect", async () => {
    await page.evaluate(() => {
      const w = window as unknown as { __clones: number };
      w.__clones = 0;
      const watch = () => {
        w.__clones = Math.max(
          w.__clones,
          document.querySelectorAll(".pane[data-clone]").length,
        );
        requestAnimationFrame(watch);
      };
      watch();
    });
    // the motion runs on the page's clock in fixed frames, so a busy machine
    // cannot skip part of it between two sampled frames
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(new Date(now + 1000));
    await action();
    for (
      let f = 0;
      f < 400 && (await area(page).getAttribute("data-retiling")) !== "false";
      f++
    )
      await page.clock.runFor(FRAME);
    await page.clock.resume();
  });
  const clones = await page.evaluate(
    () => (window as unknown as { __clones: number }).__clones,
  );
  const tops: Run["tops"] = {};
  const last: Run["last"] = {};
  for (const id of ids) {
    const at = order.indexOf(id);
    tops[id] = frames.map((f) => {
      const b = f[at];
      return !b || b.width === 0 || b.height === 0 ? null : b.top - a.y;
    });
    const end = frames.at(-1)?.[at];
    last[id] =
      !end || end.width === 0 || end.height === 0
        ? null
        : {
            left: ((end.left - a.x) / a.width) * 100,
            top: ((end.top - a.y) / a.height) * 100,
            width: (end.width / a.width) * 100,
            height: (end.height / a.height) * 100,
          };
  }
  return { tops, last, height: a.height, clones };
}

/**
 * Press `key` from inside the page and read where each of `ids` starts, in px
 * from the area's top, as the key builds the timeline (GSAP draws a tween's
 * start at once), not on a sampled frame that may come after it moved.
 */
function pressReading(
  page: Page,
  key: string,
  ids: readonly string[],
): Promise<Record<string, number>> {
  return page.evaluate(
    ([key, ids]) => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true }),
      );
      const a = document.querySelector("main.area")?.getBoundingClientRect();
      return Object.fromEntries(
        ids.map((id) => {
          const p = document
            .querySelector(`.pane[data-window="${id}"]`)
            ?.getBoundingClientRect();
          return [id, a && p ? p.top - a.top : Number.NaN];
        }),
      );
    },
    [key, ids] as const,
  );
}

const near = (a: number, b: number, within = 1) => Math.abs(a - b) <= within;

const shown = (tops: (number | null)[]): number[] =>
  tops.filter((t): t is number => t !== null);

/** The first frame on which a window has moved more than a pixel from where it began. */
const startedAt = (tops: number[]): number => {
  const first = tops[0] ?? 0;
  return tops.findIndex((t) => Math.abs(t - first) > 1);
};

/** Each value is no smaller (`1`) or no larger (`-1`) than the one before. */
const monotone = (values: number[], way: 1 | -1): boolean =>
  values.every((v, i) => i === 0 || (v - (values[i - 1] ?? v)) * way >= -0.5);

async function expectNoClone(page: Page) {
  await expect(page.locator(".pane[data-clone]")).toHaveCount(0);
  await expect(page.locator(".pane[data-window='name']")).toHaveCount(1);
  await expect(page.locator(".pane[data-window='term']")).toHaveCount(1);
}

test("going to a higher workspace, the old windows slide up and off in tiling order as the next come up from below", async ({
  page,
}) => {
  await ready(page, "/");
  await settle(page);
  let start: Record<string, number> = {};
  const run = await sample(page, [...OPENING, ...ABOUT], async () => {
    start = await pressReading(page, "4", ABOUT);
  });

  // the old windows only go up, and end off the area
  for (const id of OPENING) {
    const tops = shown(run.tops[id] ?? []);
    expect(monotone(tops, -1)).toBe(true);
    expect(tops.at(-1) ?? 0).toBeLessThan(0);
  }
  // the next come up from below, and land on their tile
  const arriving = shown(run.tops.about ?? []);
  expect(start.about).toBeGreaterThanOrEqual(run.height);
  expect(Math.max(...arriving)).toBeLessThanOrEqual((start.about ?? 0) + 0.5);
  expect(monotone(arriving, -1)).toBe(true);
  expect(run.last.about).not.toBeNull();
  expect(near(run.last.about?.top ?? -1, 0)).toBe(true);
  expect(near(run.last.about?.left ?? -1, 0)).toBe(true);
  expect(near(run.last.about?.width ?? -1, 100)).toBe(true);
  expect(near(run.last.about?.height ?? -1, 100)).toBe(true);

  // they start moving one after another, in the written order
  const starts = OPENING.map((id) =>
    startedAt(run.tops[id]?.map((t) => t ?? 0) ?? []),
  );
  expect(starts.every((s) => s >= 0)).toBe(true);
  expect(starts[0] ?? 0).toBeLessThanOrEqual(starts[1] ?? 0);
  expect(starts[1] ?? 0).toBeLessThanOrEqual(starts[2] ?? 0);
  expect(starts[0] ?? 0).toBeLessThan(starts[2] ?? 0);

  // no frame jumps: a step between frames is never the whole screen
  for (const id of [...OPENING, ...ABOUT])
    shown(run.tops[id] ?? []).forEach((t, i, all) => {
      if (i > 0)
        expect(Math.abs(t - (all[i - 1] ?? t))).toBeLessThan(run.height);
    });
  await expectNoClone(page);
});

test("going to a lower workspace is the reverse: the old go down and the next come down from above", async ({
  page,
}) => {
  await ready(page, "/about/");
  await settle(page);
  let start: Record<string, number> = {};
  const run = await sample(page, [...OPENING, ...ABOUT], async () => {
    start = await pressReading(page, "1", OPENING);
  });

  const leaving = shown(run.tops.about ?? []);
  expect(monotone(leaving, 1)).toBe(true);
  expect(leaving.at(-1) ?? 0).toBeGreaterThanOrEqual(run.height);
  for (const id of OPENING) {
    const tops = shown(run.tops[id] ?? []);
    expect(start[id]).toBeLessThan(0);
    expect(Math.min(...tops)).toBeGreaterThanOrEqual((start[id] ?? 0) - 0.5);
    expect(monotone(tops, 1)).toBe(true);
  }
  expect(near(run.last.name?.left ?? -1, 0)).toBe(true);
  expect(near(run.last.name?.top ?? -1, 0)).toBe(true);
  expect(near(run.last.name?.width ?? -1, 60)).toBe(true);
  expect(near(run.last.name?.height ?? -1, 100)).toBe(true);
  expect(near(run.last.term?.left ?? -1, 60)).toBe(true);
  expect(near(run.last.term?.top ?? -1, 0)).toBe(true);
  expect(near(run.last.now?.top ?? -1, 58)).toBe(true);

  // the written order, reversed in direction only
  const starts = OPENING.map((id) =>
    startedAt(run.tops[id]?.map((t) => t ?? 0) ?? []),
  );
  expect(starts[0] ?? 0).toBeLessThanOrEqual(starts[1] ?? 0);
  expect(starts[1] ?? 0).toBeLessThanOrEqual(starts[2] ?? 0);
  await expectNoClone(page);
});

test("a jump of several workspaces travels one screen, like a jump of one", async ({
  page,
}) => {
  await ready(page, "/");
  await settle(page);
  let start = Number.NaN;
  const far = await sample(page, [...CONTACT], async () => {
    start = (await pressReading(page, "6", ["contact"])).contact ?? Number.NaN;
  });
  const arriving = shown(far.tops.contact ?? []);
  // it comes from one screen below, not five
  expect(start).toBeGreaterThanOrEqual(far.height);
  expect(start).toBeLessThan(far.height * 1.2);
  expect(Math.max(...arriving)).toBeLessThanOrEqual(start + 0.5);
  expect(monotone(arriving, -1)).toBe(true);
  expect(near(far.last.contact?.top ?? -1, 0)).toBe(true);
  expect(near(far.last.contact?.width ?? -1, 58)).toBe(true);

  // and back, down one screen
  const back = await sample(page, [...CONTACT], () => page.keyboard.press("1"));
  const leaving = shown(back.tops.contact ?? []);
  expect(monotone(leaving, 1)).toBe(true);
  expect(leaving.at(-1) ?? 0).toBeGreaterThanOrEqual(back.height);
  expect(leaving.at(-1) ?? 0).toBeLessThan(back.height * 1.2);
  await expectNoClone(page);
});

test("the name travels with each workspace: a clone leaves while the real pane arrives, and none is left", async ({
  page,
}) => {
  await ready(page, "/");
  await settle(page);
  const run = await sample(page, [...CONTACT], () => page.keyboard.press("6"));

  // the real name comes up from below onto the contact workspace's tile
  // (before it moves, the real pane stands on the old tile, hidden by its clone)
  const all = shown(run.tops.name ?? []);
  const name = all.slice(all.findIndex((t) => t >= run.height));
  expect(name.length).toBeGreaterThan(1);
  expect(name[0] ?? 0).toBeGreaterThanOrEqual(run.height);
  expect(monotone(name, -1)).toBe(true);
  expect(near(run.last.name?.left ?? -1, 58)).toBe(true);
  expect(near(run.last.name?.top ?? -1, 0)).toBe(true);
  expect(near(run.last.name?.width ?? -1, 42)).toBe(true);
  expect(near(run.last.name?.height ?? -1, 62)).toBe(true);
  expect(near(run.last.term?.top ?? -1, 62)).toBe(true);
  // the old name left as a clone, and the page is left with exactly one name
  expect(run.clones).toBeGreaterThanOrEqual(2);
  await expectNoClone(page);
});

test("the area is clipped during the change and the clip is gone afterwards", async ({
  page,
}) => {
  await ready(page, "/");
  await settle(page);
  const before = await area(page).evaluate((e) => e.style.overflow);
  const clip = await page.evaluate(
    () =>
      new Promise<string[]>((done) => {
        const el = document.querySelector<HTMLElement>("main.area");
        if (!el) throw new Error("no area");
        const seen: string[] = [];
        const read = () => {
          if (el.dataset.retiling === "true") seen.push(el.style.overflow);
          if (el.dataset.retiling === "false" && seen.length > 0)
            return done(seen);
          requestAnimationFrame(read);
        };
        requestAnimationFrame(read);
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "2", bubbles: true }),
        );
      }),
  );
  expect(clip.length).toBeGreaterThan(0);
  expect(new Set(clip)).toEqual(new Set(["hidden"]));
  expect(await area(page).evaluate((e) => e.style.overflow)).toBe(before);
});

test("Back after a workspace change settles on the workspace before with no clone left", async ({
  page,
}) => {
  await ready(page, "/");
  await settle(page);
  await page.keyboard.press("6");
  await settle(page);
  await page.goBack();
  await settle(page);
  await expect(area(page)).toHaveAttribute("data-workspace", "0");
  await expectNoClone(page);
});

test("a change turned back by another leaves no clone and every window at rest", async ({
  page,
}) => {
  await ready(page, "/");
  await settle(page);
  await page.keyboard.press("6");
  await page.waitForFunction(
    () => document.querySelectorAll(".pane[data-clone]").length > 0,
  );
  await page.keyboard.press("1");
  await settle(page);
  await expectNoClone(page);
  await expect(area(page)).toHaveAttribute("data-workspace", "0");
  expect(await area(page).evaluate((e) => e.style.overflow)).toBe("");
});
