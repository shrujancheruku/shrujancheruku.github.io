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

/**
 * A trackpad-like flick at `at`: wheel events from `from` decaying by 0.8 to
 * 5, stamped 16 ms apart as a trackpad sends them, and sent without waiting
 * for the page. `page.mouse.wheel` waits for the page to handle each event
 * and stamps the next when it is sent, so on a busy machine one flick became
 * events half a second apart: to the page, separate pushes, not one flick. A
 * busy machine now does to these what it does to a visitor's: delivers them
 * late, and merges those that queue up.
 */
export async function flick(
  page: Page,
  at: { x: number; y: number },
  from = 120,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const start = Date.now();
  const sent: Promise<unknown>[] = [];
  for (let d = from, i = 0; Math.abs(d) > 4; d = Math.trunc(d * 0.8), i++) {
    const time = start + i * 16;
    const wait = time - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    sent.push(
      cdp.send("Input.dispatchMouseEvent", {
        type: "mouseWheel",
        ...at,
        deltaX: 0,
        deltaY: d,
        timestamp: time / 1000,
      }),
    );
  }
  await Promise.all(sent);
  await cdp.detach();
}

/** Real touch swipes (CDP): the browser's own scrolling gets its chance to take them. */
export type Swipe = { name: string; distance: number; ms: number };
export const SWIPES: Swipe[] = [
  { name: "short", distance: 60, ms: 120 },
  { name: "long", distance: 380, ms: 400 },
  { name: "fast", distance: 220, ms: 40 },
];

export async function swipe(page: Page, dir: 1 | -1, s: Swipe): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const { w, h } = await page.evaluate(() => ({
    w: innerWidth,
    h: innerHeight,
  }));
  // finger moves up to go down a step
  const x = Math.round(w / 2);
  const y0 = Math.round(h / 2 + (dir * s.distance) / 2);
  const frames = 4;
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", y: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y }],
    });
  await touch("touchStart", y0);
  for (let i = 1; i <= frames; i++) {
    await page.waitForTimeout(s.ms / frames);
    await touch("touchMove", y0 - (dir * s.distance * i) / frames);
  }
  await touch("touchEnd", 0);
  await cdp.detach();
}

/**
 * The first touch in a fresh browser can be lost by the emulation, whatever
 * the page does: spend it on a tap that moves nothing.
 */
export async function warmUpTouch(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const touchPoints = [{ x: 4, y: 4 }];
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints,
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
}

/**
 * A two-finger pinch (CDP) about the middle of what is on screen: `scale` above 1
 * spreads the fingers (zoom in), below 1 brings them together (zoom out).
 * Resolves when the page's zoom has come to rest.
 */
export async function pinch(page: Page, scale: number): Promise<number> {
  // CDP places the pinch in the visible part of a zoomed page
  const { w, h } = await page.evaluate(() => ({
    w: window.visualViewport?.width ?? innerWidth,
    h: window.visualViewport?.height ?? innerHeight,
  }));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.synthesizePinchGesture", {
    x: Math.round(w / 2),
    y: Math.round(h / 2),
    scaleFactor: scale,
    relativeSpeed: 800,
    gestureSourceType: "touch",
  });
  await cdp.detach();
  let last = 0;
  // the zoom settles over a few frames after the fingers lift
  await expect
    .poll(async () => {
      const now = await page.evaluate(() => window.visualViewport?.scale ?? 1);
      const still = now === last;
      last = now;
      return still;
    })
    .toBe(true);
  return last;
}

/**
 * Whether this browser zooms on a synthesized pinch at all, tried on a bare
 * page with nothing of the site's in it. Chromium on Linux (the CI runner,
 * headless shell and full alike) leaves visualViewport.scale at 1 for every
 * Input.synthesizePinchGesture, while the same build on macOS zooms.
 */
export async function pinchZoomWorks(page: Page): Promise<boolean> {
  const bare = await page.context().newPage();
  await bare.setContent(
    '<meta name="viewport" content="width=device-width"><div style="height:200vh"></div>',
  );
  const scale = await pinch(bare, 2);
  await bare.close();
  return scale > 1.5;
}

/**
 * Two fingers down, spread apart, lifted (CDP touch events, so the page sees
 * them whether or not the browser zooms): a pinch as the page's own handlers
 * get it.
 */
export async function twoFingerSpread(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const { w, h } = await page.evaluate(() => ({
    w: innerWidth,
    h: innerHeight,
  }));
  const x = Math.round(w / 2);
  const y = Math.round(h / 2);
  const at = (d: number) => [
    { x, y: y - d, id: 0 },
    { x, y: y + d, id: 1 },
  ];
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: at(20),
  });
  for (let d = 40; d <= 140; d += 20) {
    await page.waitForTimeout(16);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: at(d),
    });
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
}
