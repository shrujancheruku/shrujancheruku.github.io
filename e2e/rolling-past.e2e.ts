// Rolling past: one project gives way to the next inside its tiles. The old
// window goes up and out while the next comes in from below (the reverse going
// back), the stack doesn't move, and the tiles end exactly where they were.
// Shape only, never timing: every frame is sampled.
import { expect, type Page, test } from "@playwright/test";
import { areaBox, expectNotRetiling, ready, settle } from "./desktop";
import { type Box, framesOf } from "./helpers";

const IDS = ["copy-1", "comp-1", "copy-2", "comp-2", "stack"] as const;
type Id = (typeof IDS)[number];

/** Each window's rectangle, in px, on every frame of `action`; null if hidden. */
async function sample(
  page: Page,
  action: () => Promise<unknown>,
): Promise<Record<Id, (Box | null)[]>> {
  const selector = IDS.map((id) => `.pane[data-window="${id}"]`).join(", ");
  const order = await page.$$eval(selector, (els) =>
    els.map((e) => (e as HTMLElement).dataset.window ?? ""),
  );
  const frames = await framesOf(page, selector, "rect", action);
  const out = {} as Record<Id, (Box | null)[]>;
  for (const id of IDS) {
    const at = order.indexOf(id);
    out[id] = frames.map((f) => {
      const b = f[at];
      return !b || b.width === 0 || b.height === 0 ? null : b;
    });
  }
  return out;
}

const present = (frames: (Box | null)[]): Box[] =>
  frames.filter((f): f is Box => f !== null);

/** Each value is no smaller (`1`) or no larger (`-1`) than the one before. */
const monotone = (values: number[], way: 1 | -1): boolean =>
  values.every((v, i) => i === 0 || (v - (values[i - 1] ?? v)) * way >= -0.5);

const near = (a: number, b: number) => Math.abs(a - b) <= 1;

async function rollsOnWide(page: Page, forwards: boolean) {
  await ready(page, forwards ? "/work/" : "/work/rapid-radiology/");
  await settle(page);
  const [old, next] = forwards ? (["1", "2"] as const) : (["2", "1"] as const);
  const key = forwards ? "ArrowDown" : "ArrowUp";
  const was = await areaBox(page);
  if (!was) throw new Error("no area");
  const frames = await sample(page, () => page.keyboard.press(key));

  for (const part of ["copy", "comp"] as const) {
    const leaving = present(frames[`${part}-${old}` as Id]);
    const arriving = present(frames[`${part}-${next}` as Id]);
    const tile = arriving.at(-1);
    const start = leaving[0];
    if (!tile || !start) throw new Error(`${part} never showed`);
    // the next lands exactly where the old stood: the tile didn't move
    expect(near(tile.left, start.left)).toBe(true);
    expect(near(tile.top, start.top)).toBe(true);
    expect(near(tile.width, start.width)).toBe(true);
    expect(near(tile.height, start.height)).toBe(true);
    // never any size or sideways change on the way
    for (const f of [...leaving, ...arriving]) {
      expect(near(f.left, tile.left)).toBe(true);
      expect(near(f.height, tile.height)).toBe(true);
    }
    // forwards the old goes up and the next comes from below; back is reverse
    const up = forwards ? -1 : 1;
    const out = leaving.map((f) => f.top);
    const into = arriving.map((f) => f.top);
    expect(monotone(out, up)).toBe(true);
    expect(monotone(into, up)).toBe(true);
    expect(((out.at(-1) ?? 0) - tile.top) * up).toBeGreaterThan(20);
    expect(((into[0] ?? 0) - tile.top) * -up).toBeGreaterThan(20);
    // no frame jumps: a step between frames is never most of the tile
    for (const run of [out, into])
      for (const [i, v] of run.entries())
        if (i > 0)
          expect(Math.abs(v - (run[i - 1] ?? v))).toBeLessThan(tile.height);
    // both start together: the old begins on its tile
    expect(near(out[0] ?? -1, tile.top)).toBe(true);
    expect(near(into.at(-1) ?? -1, tile.top)).toBe(true);
    // the old is gone at the end
    expect(frames[`${part}-${old}` as Id].at(-1)).toBeNull();
  }

  // the stack doesn't move
  const stack = present(frames.stack);
  const first = stack[0];
  if (!first) throw new Error("no stack");
  for (const s of stack) {
    expect(near(s.left, first.left)).toBe(true);
    expect(near(s.top, first.top)).toBe(true);
    expect(near(s.width, first.width)).toBe(true);
    expect(near(s.height, first.height)).toBe(true);
  }

  // settled: rest styles cleared, one project on show
  await expectNotRetiling(page);
  for (const id of [`copy-${next}`, `comp-${next}`]) {
    const style = await page
      .locator(`.pane[data-window="${id}"]`)
      .evaluate((e) => ({
        transform: (e as HTMLElement).style.transform,
        clip: (e as HTMLElement).style.clipPath,
      }));
    expect(style).toEqual({ transform: "", clip: "" });
  }
}

test.describe("wide screen", () => {
  test("scrolling forwards rolls the old project up and out as the next rolls in from below, the stack still", async ({
    page,
  }) => {
    await rollsOnWide(page, true);
  });

  test("scrolling back rolls the old project down and out as the previous rolls in from above", async ({
    page,
  }) => {
    await rollsOnWide(page, false);
  });
});
