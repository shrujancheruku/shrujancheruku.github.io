import { expect, type Page } from "@playwright/test";

/** The desktop's tiling area, which carries the step, workspace and re-tile state. */
export const area = (page: Page) => page.locator("main.area");

/** Load `path` and wait for the desktop to boot. */
export async function ready(page: Page, path = "/"): Promise<void> {
  await page.goto(path);
  await expect(area(page)).toHaveAttribute("data-ready", "true");
}

/**
 * Wait for the desktop to come to rest: give a step two frames to begin its
 * re-tile, then wait for the re-tile to end, however long a busy machine
 * makes it. Replaces a fixed sleep that raced the 850 ms re-tile.
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      ),
  );
  await expect(area(page)).toHaveAttribute("data-retiling", "false", {
    timeout: 15_000,
  });
}

/**
 * Run `action`, and record `measure`'s reading of the elements matching
 * `selector` on every frame until the re-tile it starts has ended. A reading
 * per frame catches an animation part way, however fast or slow the machine
 * runs it, where one sample after a fixed sleep may land before or after it.
 * The first reading is taken, and a frame recorded, before `action` runs: on a
 * busy machine the recorder's first frame can otherwise come after the re-tile
 * has started, so the "before" reading is already part way or at the end.
 */
export async function framesOf(
  page: Page,
  selector: string,
  measure: "opacity" | "left",
  action: () => Promise<unknown>,
): Promise<number[][]> {
  await page.evaluate(
    ([sel, what]) => {
      const w = window as unknown as { __frames: number[][]; __stop: boolean };
      w.__frames = [];
      w.__stop = false;
      const read = (e: Element) =>
        what === "left"
          ? e.getBoundingClientRect().left
          : Number(getComputedStyle(e).opacity);
      const record = () =>
        w.__frames.push([...document.querySelectorAll(sel)].map(read));
      record();
      return new Promise<void>((recording) => {
        const tick = () => {
          record();
          recording();
          if (!w.__stop) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },
    [selector, measure] as const,
  );
  await action();
  await settle(page);
  return page.evaluate(() => {
    const w = window as unknown as { __frames: number[][]; __stop: boolean };
    w.__stop = true;
    return w.__frames;
  });
}
