// Opening and closing a window: it grows out of the desktop edge on the far
// side from its neighbours and shrinks back into it, sharing one moving border
// with the neighbours that re-tile beside it. Shape only, never timing: every
// frame is sampled and checked for its edge, direction, the shared border, no
// frame jumping back, and the right final rectangles.
import { expect, type Page, test } from "@playwright/test";
import { area, type Box, framesOf, ready, settle } from "./helpers";

/** A rectangle in percent of the tiling area. */
type Pct = Box;

/** Sample `ids`' rectangles, in % of the area, on every frame of `action`. */
async function sample(
  page: Page,
  ids: readonly string[],
  action: () => Promise<unknown>,
): Promise<Record<string, (Pct | null)[]>> {
  const a = await area(page).boundingBox();
  if (!a) throw new Error("no area");
  const selector = ids.map((id) => `.pane[data-window="${id}"]`).join(", ");
  const order = await page.$$eval(selector, (els) =>
    els.map((e) => (e as HTMLElement).dataset.window ?? ""),
  );
  const frames = await framesOf(page, selector, "rect", action);
  const out: Record<string, (Pct | null)[]> = {};
  for (const id of ids) {
    const at = order.indexOf(id);
    out[id] = frames.map((f) => {
      const b = f[at];
      // a window not on show has no box
      if (!b || b.width === 0 || b.height === 0) return null;
      return {
        left: ((b.left - a.x) / a.width) * 100,
        top: ((b.top - a.y) / a.height) * 100,
        width: (b.width / a.width) * 100,
        height: (b.height / a.height) * 100,
      };
    });
  }
  return out;
}

const shownFrames = (frames: (Pct | null)[]): Pct[] =>
  frames.filter((f): f is Pct => f !== null);

/** Each value is no smaller (`1`) or no larger (`-1`) than the one before. */
const monotone = (values: number[], way: 1 | -1): boolean =>
  values.every((v, i) => i === 0 || (v - (values[i - 1] ?? v)) * way >= -0.5);

const near = (a: number, b: number, within = 1) => Math.abs(a - b) <= within;

/**
 * A side held on the area's far edge. A pane can't shrink below its own
 * padding (the gap), so as it collapses that side overhangs the edge a little;
 * it never comes inside it.
 */
const atEdge = (side: number) => side >= 99 && side <= 103;

const expectRect = (r: Pct | null | undefined, [l, t, w, h]: number[]) => {
  expect(r).toBeTruthy();
  expect(near(r?.left ?? -1, l ?? 0)).toBe(true);
  expect(near(r?.top ?? -1, t ?? 0)).toBe(true);
  expect(near(r?.width ?? -1, w ?? 0)).toBe(true);
  expect(near(r?.height ?? -1, h ?? 0)).toBe(true);
};

test.describe("wide screen", () => {
  test("skills closes into the bottom edge as Education grows down, and opens back out of it", async ({
    page,
  }) => {
    await ready(page, "/timeline/");
    await settle(page);
    const cue = page.locator("[data-disclosure=education]");

    // closing: skills' top travels down to the bottom edge, its bottom stays
    const closing = await sample(page, ["education", "skills"], () =>
      cue.click(),
    );
    const skillsOut = shownFrames(closing.skills ?? []);
    expectRect(skillsOut[0], [62, 40, 38, 60]);
    for (const s of skillsOut) {
      expect(near(s.left, 62)).toBe(true);
      expect(near(s.width, 38)).toBe(true);
      expect(atEdge(s.top + s.height)).toBe(true);
    }
    const tops = skillsOut.map((s) => s.top);
    expect(monotone(tops, 1)).toBe(true);
    expect(tops.some((t) => t > 42 && t < 98)).toBe(true);
    // one shared border: Education's bottom is skills' top on every frame
    for (const [i, s] of (closing.skills ?? []).entries()) {
      const e = closing.education?.[i];
      if (!s || !e) continue;
      expect(near(e.top + e.height, s.top)).toBe(true);
    }
    expect(
      monotone(
        shownFrames(closing.education ?? []).map((e) => e.height),
        1,
      ),
    ).toBe(true);
    expectRect(closing.education?.at(-1), [46, 0, 54, 100]);
    expect(closing.skills?.at(-1)).toBeNull();

    // opening: skills comes back up out of the bottom edge
    const opening = await sample(page, ["education", "skills"], () =>
      cue.click(),
    );
    const skillsIn = shownFrames(opening.skills ?? []);
    for (const s of skillsIn) {
      expect(near(s.left, 62)).toBe(true);
      expect(near(s.width, 38)).toBe(true);
      expect(atEdge(s.top + s.height)).toBe(true);
    }
    const rising = skillsIn.map((s) => s.top);
    expect(monotone(rising, -1)).toBe(true);
    expect(rising.some((t) => t > 42 && t < 98)).toBe(true);
    for (const [i, s] of (opening.skills ?? []).entries()) {
      const e = opening.education?.[i];
      if (!s || !e) continue;
      expect(near(e.top + e.height, s.top)).toBe(true);
    }
    expectRect(opening.skills?.at(-1), [62, 40, 38, 60]);
    expectRect(opening.education?.at(-1), [62, 0, 38, 40]);
  });

  test("the archive opens out of the right edge beside the project, and closes back into it", async ({
    page,
  }) => {
    await ready(page, "/work/");
    await settle(page);
    const opener = page.locator("#archive-stack");

    const opening = await sample(page, ["comp-1", "archive"], () =>
      opener.click(),
    );
    const archiveIn = shownFrames(opening.archive ?? []);
    for (const r of archiveIn) {
      expect(near(r.top, 0)).toBe(true);
      expect(near(r.height, 100)).toBe(true);
      expect(atEdge(r.left + r.width)).toBe(true);
    }
    const lefts = archiveIn.map((r) => r.left);
    expect(monotone(lefts, -1)).toBe(true);
    expect(lefts.some((l) => l > 44 && l < 98)).toBe(true);
    // one shared border: the composition's right is the archive's left
    for (const [i, r] of (opening.archive ?? []).entries()) {
      const c = opening["comp-1"]?.[i];
      if (!r || !c) continue;
      expect(near(c.left + c.width, r.left)).toBe(true);
    }
    expectRect(opening.archive?.at(-1), [42, 0, 58, 100]);
    expectRect(opening["comp-1"]?.at(-1), [12.6, 0, 29.4, 100]);

    const closing = await sample(page, ["comp-1", "archive"], () =>
      opener.click(),
    );
    const archiveOut = shownFrames(closing.archive ?? []);
    expectRect(archiveOut[0], [42, 0, 58, 100]);
    for (const r of archiveOut) expect(atEdge(r.left + r.width)).toBe(true);
    const going = archiveOut.map((r) => r.left);
    expect(monotone(going, 1)).toBe(true);
    expect(going.some((l) => l > 44 && l < 98)).toBe(true);
    for (const [i, r] of (closing.archive ?? []).entries()) {
      const c = closing["comp-1"]?.[i];
      if (!r || !c) continue;
      expect(near(c.left + c.width, r.left)).toBe(true);
    }
    expect(closing.archive?.at(-1)).toBeNull();
    expectRect(closing["comp-1"]?.at(-1), [30, 0, 70, 100]);
  });
});

test.describe("wide screen, reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("a step has no frame with a window between its old and new rectangles", async ({
    page,
  }) => {
    await ready(page, "/timeline/");
    await settle(page);
    const cue = page.locator("[data-disclosure=education]");
    const frames = await sample(page, ["timeline", "education", "skills"], () =>
      cue.click(),
    );
    const either = (r: Pct | null, ...rects: (number[] | null)[]) =>
      rects.some((x) =>
        x === null
          ? r === null
          : r !== null &&
            near(r.left, x[0] ?? 0) &&
            near(r.top, x[1] ?? 0) &&
            near(r.width, x[2] ?? 0) &&
            near(r.height, x[3] ?? 0),
      );
    for (const r of frames.timeline ?? [])
      expect(either(r, [0, 0, 62, 100], [0, 0, 46, 100])).toBe(true);
    for (const r of frames.education ?? [])
      expect(either(r, [62, 0, 38, 40], [46, 0, 54, 100])).toBe(true);
    for (const r of frames.skills ?? [])
      expect(either(r, [62, 40, 38, 60], null)).toBe(true);
    expectRect(frames.education?.at(-1), [46, 0, 54, 100]);
    await expect(area(page)).toHaveAttribute("data-retiling", "false");
  });
});
