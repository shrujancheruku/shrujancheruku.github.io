// Acting mid-motion. An input that undoes the step while it is still moving
// turns the motion back from where the windows are: no frame jumps, and it
// settles on the step and address it began from, with no clone left. Any
// other input waits until the motion ends, then runs from rest; only the
// latest is kept. Shape only, never timing: the second input is sent on the
// first frame the windows have visibly moved, and time is the test's while
// the inputs are sent (Playwright's clock, in fixed frames), so a busy machine
// cannot skip a motion to its end between two frames.
import { expect, type Page, test } from "@playwright/test";
import { area, type Box, framesOf, ready, settle } from "./helpers";

/** An input sent inside the page: a key press, Back, or `click:<selector>`. */
type Input = string;

/** One frame of the page's clock, in ms. */
const FRAME = 16;

/**
 * Send `first`, then, on the first frame a window (of those `watch` matches)
 * has moved `far` px from where it was, each of `then` in turn, each after the
 * windows have moved on again (`far` may give each input its own distance).
 * The page's clock runs in fixed frames meanwhile. Returns whether each of
 * `then` came while the motion still ran.
 */
async function midMotion(
  page: Page,
  first: Input,
  then: Input[],
  far: number | number[] = 4,
  watch = ".pane",
): Promise<boolean[]> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 1000));
  const fars = then.map((_, i) => (Array.isArray(far) ? (far[i] ?? 4) : far));
  let done = false;
  const sent = page
    .evaluate(
      ([first, then, fars, watch]) => {
        const area = document.querySelector<HTMLElement>("main.area");
        const send = (input: string) => {
          if (input === "Back") history.back();
          else if (input.startsWith("click:"))
            document.querySelector<HTMLElement>(input.slice(6))?.click();
          else
            document.body.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: input,
                bubbles: true,
                cancelable: true,
              }),
            );
        };
        const rects = () =>
          [...document.querySelectorAll(watch)].map((p) => {
            const { left, top, width, height } = p.getBoundingClientRect();
            return [left, top, width, height];
          });
        const movedFrom = (was: number[][], far: number) =>
          rects().some((r, i) =>
            r.some((v, j) => Math.abs(v - (was[i]?.[j] ?? v)) > far),
          );
        const during: boolean[] = [];
        send(first);
        return new Promise<boolean[]>((done) => {
          let was = rects();
          let left = [...then];
          const tick = () => {
            if (left.length === 0) return done(during);
            if (area?.dataset.retiling !== "true") {
              // the motion ended before the input: say so, and send the rest
              for (const input of left) {
                during.push(false);
                send(input);
              }
              left = [];
              return done(during);
            }
            if (movedFrom(was, fars[during.length] ?? 4)) {
              const input = left.shift() ?? "";
              during.push(area?.dataset.retiling === "true");
              send(input);
              was = rects();
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      },
      [first, then, fars, watch] as const,
    )
    .finally(() => {
      done = true;
    });
  for (let f = 0; !done && f < 300; f++) await page.clock.runFor(FRAME);
  const during = await sent;
  await page.clock.resume();
  return during;
}

const pathOf = (page: Page) => page.evaluate(() => location.pathname);
const stepOf = async (page: Page) =>
  Number(await area(page).getAttribute("data-step"));

/** Every window on show, at rest: its rectangle, by id. */
const restOf = (page: Page) =>
  page.$$eval(".pane[data-window]", (els) =>
    Object.fromEntries(
      els
        .filter((e) => getComputedStyle(e).display !== "none")
        .map((e) => {
          const { left, top, width, height } = e.getBoundingClientRect();
          return [
            (e as HTMLElement).dataset.window ?? "",
            [left, top, width, height].map(Math.round),
          ];
        }),
    ),
  );

async function expectNoClone(page: Page) {
  await expect(page.locator("[data-clone]")).toHaveCount(0);
  await expect(page.locator(".pane[data-window='name']")).toHaveCount(1);
  await expect(page.locator(".pane[data-window='term']")).toHaveCount(1);
}

test.beforeEach(async ({ page }) => {
  // the clock flows on its own, except while midMotion sends its inputs
  await page.clock.install();
  await ready(page, "/");
  await settle(page);
});

test("a jump back to the workspace a change began from turns it back from where the windows are, with no frame jumps and no clone left", async ({
  page,
}) => {
  const a = await area(page).boundingBox();
  if (!a) throw new Error("no area");
  const start = await restOf(page);
  const ids = ["now", "contact"];
  const selector = ids.map((id) => `.pane[data-window="${id}"]`).join(", ");
  const order = await page.$$eval(selector, (els) =>
    els.map((e) => (e as HTMLElement).dataset.window ?? ""),
  );
  let during: boolean[] = [];
  const frames = (await framesOf(page, selector, "rect", async () => {
    // well into the change: the opening's last window a fifth of the way off
    during = await midMotion(
      page,
      "6",
      ["1"],
      a.height / 5,
      '.pane[data-window="now"]',
    );
  })) as Box[][];
  expect(during).toEqual([true]);

  const tops = (id: string) =>
    frames
      .map((f) => f[order.indexOf(id)])
      .filter((b): b is Box => !!b && b.width > 0 && b.height > 0)
      .map((b) => b.top - a.y);
  // the opening's window goes up, turns, and comes back down to its tile: one
  // turn, never off the area, never a jump between frames
  const now = tops("now");
  const low = Math.min(...now);
  const turn = now.indexOf(low);
  expect(low).toBeLessThan((now[0] ?? 0) - 4);
  expect(low).toBeGreaterThan(-a.height);
  now.forEach((t, i) => {
    if (i === 0) return;
    const step = t - (now[i - 1] ?? t);
    expect(i <= turn ? step <= 0.5 : step >= -0.5).toBe(true);
    expect(Math.abs(step)).toBeLessThan(a.height);
  });
  // the contact window, coming up from below, goes back down without landing
  const contact = tops("contact");
  expect(Math.min(...contact, a.height)).toBeGreaterThan(0);

  await expect(area(page)).toHaveAttribute("data-workspace", "0");
  expect(await pathOf(page)).toBe("/");
  await expectNoClone(page);
  expect(await restOf(page)).toEqual(start);
});

test("Back after a jump turns it back, onto the step and address before", async ({
  page,
}) => {
  const start = await restOf(page);
  expect(await midMotion(page, "2", ["Back"])).toEqual([true]);
  await settle(page);
  expect(await stepOf(page)).toBe(0);
  expect(await pathOf(page)).toBe("/");
  await expectNoClone(page);
  expect(await restOf(page)).toEqual(start);
});

test("the opposite key turns a step back and drops what waited: down, down, up ends where it began", async ({
  page,
}) => {
  const start = await restOf(page);
  expect(await midMotion(page, "ArrowDown", ["ArrowDown", "ArrowUp"])).toEqual([
    true,
    true,
  ]);
  await settle(page);
  expect(await stepOf(page)).toBe(0);
  expect(await pathOf(page)).toBe("/");
  await expectNoClone(page);
  expect(await restOf(page)).toEqual(start);
});

test("a second reversal plays the step forwards again", async ({ page }) => {
  await page.keyboard.press("ArrowDown");
  await settle(page);
  const end = await restOf(page);
  const path = await pathOf(page);
  await page.keyboard.press("ArrowUp");
  await settle(page);
  // the first reversal well into the step, so the way back has room for the
  // second
  expect(
    await midMotion(page, "ArrowDown", ["ArrowUp", "ArrowDown"], [40, 4]),
  ).toEqual([true, true]);
  await settle(page);
  expect(await stepOf(page)).toBe(1);
  expect(await pathOf(page)).toBe(path);
  expect(await restOf(page)).toEqual(end);
});

test("any other input waits for the motion, and a jump that waited adds its history entry when it runs", async ({
  page,
}) => {
  // during the change to contact, a jump to the projects and then to about:
  // only the latest runs, once the windows are at rest on contact
  expect(await midMotion(page, "6", ["3", "2"])).toEqual([true, true]);
  await settle(page);
  await expect(area(page)).toHaveAttribute("data-workspace", "1");
  await expectNoClone(page);
  // Back goes to contact, whose entry came first, then home
  await page.goBack();
  await settle(page);
  await expect(area(page)).toHaveAttribute("data-workspace", "5");
  await page.goBack();
  await settle(page);
  await expect(area(page)).toHaveAttribute("data-workspace", "0");
});

for (const [how, input] of [
  ["Escape", "Escape"],
  ["the opener again", "click:#archive-stack"],
] as const) {
  test(`closing the archive while it opens (${how}) turns it back onto the projects and their address`, async ({
    page,
  }) => {
    await page.keyboard.press("3");
    await settle(page);
    const start = await restOf(page);
    const path = await pathOf(page);
    expect(await midMotion(page, "click:#archive-stack", [input])).toEqual([
      true,
    ]);
    await settle(page);
    await expect(area(page)).toHaveAttribute("data-open", "false");
    expect(await pathOf(page)).toBe(path);
    expect(await restOf(page)).toEqual(start);
  });
}
