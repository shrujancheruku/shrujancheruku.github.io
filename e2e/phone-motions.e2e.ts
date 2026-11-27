// The phone's own motions, made from the wide-screen ones: the timeline's two
// screens travel like changing workspace, a paged window turning its page rolls
// its entries past inside the window, the archive opens out of the right edge
// while the copy and the composition close into the left, and a swipe moves
// nothing until the finger lifts. Shape only, never timing: every frame is
// sampled, on the page's clock in fixed frames, and checked for direction,
// order, which sides move and the final rectangles. Reduced motion places the
// windows with no frame between.
import { devices, expect, type Page, test } from "@playwright/test";
import { area, type Box, framesOf, ready, settle, whereOf } from "./helpers";

const { defaultBrowserType: _, ...pixel } = devices["Pixel 7"];
test.use({ ...pixel });

const ARCHIVE_PROJECT = "/work/truecrypt-steganography/";

/** One frame of the page's clock, in ms. */
const FRAME = 16;

test.beforeEach(async ({ page }) => {
  // the clock flows on its own, except while sample() records a motion
  await page.clock.install();
});

const pane = (id: string) => `.pane[data-window="${id}"]`;

/** A window's rectangle in px of the area on each frame; null while it is hidden. */
async function sample(
  page: Page,
  selector: string,
  action: () => Promise<unknown>,
): Promise<(Box | null)[][]> {
  const a = await area(page).boundingBox();
  if (!a) throw new Error("no area");
  const frames = await framesOf(page, selector, "rect", async () => {
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
  return frames.map((f) =>
    f.map((b) =>
      b.width === 0 || b.height === 0
        ? null
        : {
            left: b.left - a.x,
            top: b.top - a.y,
            width: b.width,
            height: b.height,
          },
    ),
  );
}

const near = (a: number, b: number, within = 1) => Math.abs(a - b) <= within;
const tops = (frames: (Box | null)[][], at: number) =>
  frames.map((f) => f[at]?.top ?? null);

/** The first frame on which a window has left its first position. */
const startedAt = (series: (number | null)[]): number => {
  const first = series.find((v) => v !== null);
  return series.findIndex(
    (v) => v !== null && first !== undefined && !near(v, first, 0.5),
  );
};

async function toTimeline(page: Page): Promise<void> {
  await ready(page, "/");
  await page.locator(".ws button").nth(3).tap();
  await settle(page);
}

test("the timeline's two screens travel like changing workspace, and back", async ({
  page,
}) => {
  await toTimeline(page);
  const a = await area(page).boundingBox();
  if (!a) throw new Error("no area");
  const ids = ["timeline", "education", "skills"];
  const selector = ids.map(pane).join(", ");
  const order = await page.$$eval(selector, (els) =>
    els.map((e) => (e as HTMLElement).dataset.window ?? ""),
  );
  const at = (id: string) => order.indexOf(id);

  const forwards = await sample(page, selector, () =>
    page.keyboard.press("ArrowDown"),
  );
  // the timeline slides up and off
  const timeline = tops(forwards, at("timeline"));
  expect(timeline[0]).toBeCloseTo(0, 0);
  const seen = timeline.filter((v): v is number => v !== null);
  for (let i = 1; i < seen.length; i++)
    expect(seen[i] as number).toBeLessThanOrEqual(
      (seen[i - 1] as number) + 0.5,
    );
  expect(Math.min(...seen)).toBeLessThan(-a.height / 2);
  // education then skills come up from below, in tiling order
  const education = tops(forwards, at("education"));
  const skills = tops(forwards, at("skills"));
  const eduStart = education.find((v) => v !== null) as number;
  expect(eduStart).toBeGreaterThanOrEqual(a.height - 1);
  expect(startedAt(education)).toBeLessThanOrEqual(startedAt(skills));
  for (const series of [education, skills]) {
    const s = series.filter((v): v is number => v !== null);
    for (let i = 1; i < s.length; i++)
      expect(s[i] as number).toBeLessThanOrEqual((s[i - 1] as number) + 0.5);
  }
  // no window is in two places at once: nothing jumps between frames
  for (const series of [timeline, education, skills]) {
    const s = series.filter((v): v is number => v !== null);
    for (let i = 1; i < s.length; i++)
      expect(Math.abs((s[i] as number) - (s[i - 1] as number))).toBeLessThan(
        a.height,
      );
  }
  // at rest: education over skills, the timeline gone
  const last = forwards.at(-1) ?? [];
  expect(last[at("timeline")]).toBeNull();
  expect(near(last[at("education")]?.top ?? -1, 0)).toBe(true);
  expect(
    near(last[at("skills")]?.top ?? -1, last[at("education")]?.height ?? 0),
  ).toBe(true);

  // going back is the reverse: the screens leave downwards and the timeline returns from above
  const back = await sample(page, selector, () =>
    page.keyboard.press("ArrowUp"),
  );
  const returning = tops(back, at("timeline")).filter(
    (v): v is number => v !== null,
  );
  expect(returning[0]).toBeLessThanOrEqual(-a.height / 2);
  expect(near(returning.at(-1) ?? -1, 0)).toBe(true);
  const leaving = tops(back, at("education")).filter(
    (v): v is number => v !== null,
  );
  expect(Math.max(...leaving)).toBeGreaterThan(a.height / 2);
});

test.describe("a paged window turning its page", () => {
  // short enough that the archive takes two pages
  test.use({ ...pixel, viewport: { width: 412, height: 450 } });

  test("rolls its entries past inside the window, which stays", async ({
    page,
  }) => {
    await ready(page, ARCHIVE_PROJECT);
    const here = await whereOf(page);
    expect(here.screens).toBeGreaterThan(1);
    // the booted page holds the project; go to the one before it
    const key = here.screen > 0 ? "ArrowUp" : "ArrowDown";
    const direction = here.screen > 0 ? -1 : 1;
    const frames = await sample(
      page,
      `${pane("archive")}, ${pane("archive")} .entries li`,
      () => page.keyboard.press(key),
    );
    // the window's frame never moves or resizes
    const frame = frames.map((f) => f[0]);
    const rest = frame.at(-1);
    for (const f of frame) {
      expect(f).not.toBeNull();
      expect(near(f?.top ?? -1, rest?.top ?? 0)).toBe(true);
      expect(near(f?.left ?? -1, rest?.left ?? 0)).toBe(true);
      expect(near(f?.width ?? -1, rest?.width ?? 0)).toBe(true);
      expect(near(f?.height ?? -1, rest?.height ?? 0)).toBe(true);
    }
    // old and new entries are on show together part way
    const most = Math.max(...frames.map((f) => f.length - 1));
    const entriesAtRest = (frames.at(-1)?.length ?? 1) - 1;
    expect(most).toBeGreaterThan(entriesAtRest);
    // forwards the entries go up (the old out, the next from below)
    const bottom = (rest?.top ?? 0) + (rest?.height ?? 0);
    const firstFrame = frames[0] ?? [];
    const early = frames.find((f) => f.length - 1 > entriesAtRest) ?? [];
    const lowest = Math.max(...early.slice(1).map((b) => b?.top ?? 0));
    if (direction === 1) expect(lowest).toBeGreaterThan(bottom - 1);
    else
      expect(Math.min(...early.slice(1).map((b) => b?.top ?? 0))).toBeLessThan(
        (rest?.top ?? 0) + 1,
      );
    expect(firstFrame.length).toBeGreaterThan(0);
    // settled: one copy of each entry, nothing left over
    await expect(page.locator(".entries[data-clone]")).toHaveCount(0);
    expect(
      await page.$$eval(`${pane("archive")} .entries`, (els) => els.length),
    ).toBe(1);
  });
});

test("the archive opens out of the right edge as the copy and composition close into the left, sharing one border", async ({
  page,
}) => {
  await ready(page, "/work/");
  const a = await area(page).boundingBox();
  if (!a) throw new Error("no area");
  const selector = `${pane("archive")}, ${pane("copy-1")}, ${pane("comp-1")}`;
  const order = await page.$$eval(selector, (els) =>
    els.map((e) => (e as HTMLElement).dataset.window ?? ""),
  );
  const at = (id: string) => order.indexOf(id);
  const frames = await sample(page, selector, () =>
    page.locator("[data-archive-phone]").first().tap(),
  );
  const right = (b: Box) => b.left + b.width;
  const archive = frames.map((f) => f[at("archive")]);
  // the archive grows out of the right edge: its right side stays on the edge, its left comes in
  const shown = archive.filter((b): b is Box => b !== null);
  expect(shown.length).toBeGreaterThan(2);
  for (const b of shown) expect(right(b)).toBeGreaterThanOrEqual(a.width - 1);
  for (let i = 1; i < shown.length; i++)
    expect((shown[i] as Box).left).toBeLessThanOrEqual(
      (shown[i - 1] as Box).left + 0.5,
    );
  expect(near((shown.at(-1) as Box).left, 0)).toBe(true);
  // the copy and the composition keep their left edge and shrink into it
  for (const id of ["copy-1", "comp-1"]) {
    const series = frames
      .map((f) => f[at(id)])
      .filter((b): b is Box => b !== null);
    expect(series.length).toBeGreaterThan(1);
    for (const b of series) expect(near(b.left, 0)).toBe(true);
    for (let i = 1; i < series.length; i++)
      expect((series[i] as Box).width).toBeLessThanOrEqual(
        (series[i - 1] as Box).width + 0.5,
      );
  }
  // one moving border: wherever the archive and the copy both show (a window
  // narrower than its own padding stops closing in), the archive's left side
  // is the copy's right side
  const shared = frames.filter(
    (f) => f[at("archive")] && (f[at("copy-1")]?.width ?? 0) > 12,
  );
  expect(shared.length).toBeGreaterThan(0);
  for (const f of shared)
    expect(
      near((f[at("archive")] as Box).left, right(f[at("copy-1")] as Box), 2),
    ).toBe(true);
  await expect(page).toHaveURL(/\/archive\/$/);
});

test("a swipe moves nothing while the finger is down, and moves on release", async ({
  page,
}) => {
  await ready(page, "/");
  const before = await whereOf(page);
  const panes = () =>
    page.$$eval(".pane[data-window]", (els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return [
          (e as HTMLElement).dataset.window,
          getComputedStyle(e).display,
          r.left,
          r.top,
          r.width,
          r.height,
        ];
      }),
    );
  const still = await panes();
  const cdp = await page.context().newCDPSession(page);
  const { w, h } = await page.evaluate(() => ({
    w: innerWidth,
    h: innerHeight,
  }));
  const x = Math.round(w / 2);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", y: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y }],
    });
  const y0 = Math.round(h * 0.7);
  await send("touchStart", y0);
  for (let i = 1; i <= 5; i++) {
    await page.waitForTimeout(30);
    await send("touchMove", y0 - 60 * i);
  }
  // well past the swipe's distance, finger still down: nothing has moved
  await page.waitForTimeout(500);
  expect(await panes()).toEqual(still);
  expect(await whereOf(page)).toEqual(before);
  await expect(area(page)).toHaveAttribute("data-retiling", "false");
  await send("touchEnd", 0);
  await cdp.detach();
  await expect
    .poll(async () => (await whereOf(page)).step)
    .toBeGreaterThan(before.step);
});

test.describe("reduced motion", () => {
  test.use({ ...pixel, reducedMotion: "reduce" });

  test("a phone step is placed with no frame between its old and new windows", async ({
    page,
  }) => {
    await toTimeline(page);
    const a = await area(page).boundingBox();
    if (!a) throw new Error("no area");
    const selector = ".pane[data-window]";
    const frames = await sample(page, selector, () =>
      page.keyboard.press("ArrowDown"),
    );
    const key = (b: Box | null) =>
      b
        ? [b.left, b.top, b.width, b.height].map((v) => Math.round(v)).join(",")
        : "-";
    const first = (frames[0] ?? []).map(key);
    const last = (frames.at(-1) ?? []).map(key);
    expect(last).not.toEqual(first);
    for (const f of frames) {
      const now = f.map(key);
      const old = now.every((k, i) => k === first[i]);
      const next = now.every((k, i) => k === last[i]);
      expect(old || next).toBe(true);
    }
  });
});
