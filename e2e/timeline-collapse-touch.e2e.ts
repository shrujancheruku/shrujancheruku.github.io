import { devices, expect, type Page, test } from "@playwright/test";
import { unseen } from "./fit";
import { area, ready, settle, warmUpTouch, whereOf } from "./helpers";

// On a phone the timeline step is two screens: the timeline alone, its entries
// collapsed to their headings (a tap opens or closes one), then education over
// skills. The entries start open, the top ones up to the most that fit, and
// past that limit opening one closes the one open longest (#130).

const PHONES = {
  "Pixel 7": devices["Pixel 7"],
  "iPhone 14": devices["iPhone 14"],
  "375x667": {
    viewport: { width: 375, height: 667 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  },
} as const;

// The screens the step has with Education & Internships open: as many as on
// master before #108 (measured there: 2, 4 and 4), never more. The roles page
// on the two smaller phones.
const EDUCATION_OPEN_SCREENS: Record<keyof typeof PHONES, number> = {
  "Pixel 7": 2,
  "iPhone 14": 4,
  "375x667": 4,
};

// The most entries that fit open together on the timeline's screen, measured
// from the layout (the page's data-limit says it; this pins what it measured).
const LIMIT: Record<keyof typeof PHONES, number> = {
  "Pixel 7": 3,
  "iPhone 14": 2,
  "375x667": 2,
};

const limitOf = (page: Page) =>
  page
    .locator("[data-entries]")
    .evaluate((e) => Number((e as HTMLElement).dataset.limit));

/** The indices of the open entries, top to bottom. */
const openOnes = async (page: Page) =>
  (await expanded(page)).flatMap((v, i) => (v === "true" ? [i] : []));

const shown = (page: Page, id: string) =>
  page
    .locator(`[data-window="${id}"]`)
    .evaluate((e) => getComputedStyle(e).display !== "none");

const toggles = (page: Page) =>
  page.locator('[data-window="timeline"] button[aria-expanded]');

const expanded = (page: Page) =>
  toggles(page).evaluateAll((els) =>
    els.map((e) => e.getAttribute("aria-expanded")),
  );

for (const [name, emulation] of Object.entries(PHONES)) {
  test.describe(name, () => {
    const { defaultBrowserType: _engine, ...phone } = emulation as {
      defaultBrowserType?: string;
    };
    test.use(phone);

    test("the timeline step is exactly two screens, neither paged: the timeline, then education over skills", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      await warmUpTouch(page);
      const screens = () =>
        area(page).evaluate((a) => Number(a.dataset.screens));
      expect(await screens()).toBe(2);
      expect((await whereOf(page)).screen).toBe(0);
      expect(await shown(page, "timeline")).toBe(true);
      expect(await shown(page, "education")).toBe(false);
      expect(await shown(page, "skills")).toBe(false);
      await expect(
        page.locator('[data-window="timeline"] article:not([hidden])'),
      ).toHaveCount(5);
      expect(await unseen(page)).toEqual([]);

      await page.keyboard.press("ArrowDown");
      await settle(page);
      expect((await whereOf(page)).screen).toBe(1);
      expect(await shown(page, "timeline")).toBe(false);
      expect(await shown(page, "education")).toBe(true);
      expect(await shown(page, "skills")).toBe(true);
      expect(await unseen(page)).toEqual([]);
      // no window pages: one more step moves on, never to a third screen
      expect(await screens()).toBe(2);
      // every skill, language and hobby is still there
      await expect(page.locator('[data-window="skills"] .fill')).toHaveCount(5);
      await expect(
        page.locator('[data-window="skills"] .langs li'),
      ).toHaveCount(5);
      await expect(
        page.locator('[data-window="skills"] [data-hobby]'),
      ).toHaveCount(9);
    });

    test("the skills window fits with 8px to spare, while the joke bar shoots in and once it rests", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      await warmUpTouch(page);
      // widths depend on the web fonts: read them once all have loaded
      await page.evaluate(() => document.fonts.ready);
      // sample every frame of the bars' entry (the joke bar overshoots its
      // track) with the window 8px narrower than it is, from before the step
      // until the bars rest: nothing may overflow. Nothing clips the bars, so
      // an overshoot that leaves the column widens the window and shows here.
      const sampled = page.evaluate(
        () =>
          new Promise<{ over: number; frames: number; peak: number }>(
            (done) => {
              const sk = document.querySelector<HTMLElement>(".sk");
              const pane = sk?.closest<HTMLElement>(".pane");
              const joke = sk?.querySelector<HTMLElement>(".fill.joke");
              if (!sk || !pane || !joke)
                return done({
                  over: Number.POSITIVE_INFINITY,
                  frames: 0,
                  peak: 0,
                });
              const SLACK = 8;
              let worst = 0;
              let frames = 0;
              let peak = 0;
              let started = false;
              const t0 = performance.now();
              const tick = () => {
                if (getComputedStyle(pane).display !== "none") {
                  if (!sk.style.width)
                    sk.style.width = `${sk.clientWidth - SLACK}px`;
                  worst = Math.max(worst, sk.scrollWidth - sk.clientWidth);
                  frames++;
                  peak = Math.max(
                    peak,
                    new DOMMatrix(getComputedStyle(joke).transform).a,
                  );
                  started ||= pane.dataset.bars === "growing";
                }
                const done_ = started && pane.dataset.bars === "rest";
                if (!done_ && performance.now() - t0 < 10_000)
                  requestAnimationFrame(tick);
                else {
                  sk.style.width = "";
                  done({ over: worst, frames, peak });
                }
              };
              tick();
            },
          ),
      );
      await page.keyboard.press("ArrowDown");
      const { over, frames, peak } = await sampled;
      // the sampling saw the joke bar overshoot, not just its rest
      expect(frames).toBeGreaterThan(10);
      expect(peak).toBeGreaterThan(1.05);
      expect(over).toBeLessThanOrEqual(1);
    });

    test("the step starts with the top entries open, as many as fit, on one screen", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      await warmUpTouch(page);
      const n = LIMIT[name as keyof typeof PHONES];
      expect(await limitOf(page)).toBe(n);
      expect(await openOnes(page)).toEqual(
        Array.from({ length: n }, (_, i) => i),
      );
      // data-open follows aria-expanded
      expect(
        await page
          .locator('[data-window="timeline"] article')
          .evaluateAll((els) =>
            els.map((e) => e.getAttribute("data-open") === "true"),
          ),
      ).toEqual((await expanded(page)).map((v) => v === "true"));
      expect(await unseen(page)).toEqual([]);
      await expect(area(page)).toHaveAttribute("data-screens", "2");
    });

    test("opening past the limit closes the longest-open entry, and closing one frees a slot", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      await warmUpTouch(page);
      const buttons = toggles(page);
      const n = LIMIT[name as keyof typeof PHONES];
      const before = await whereOf(page);
      // start: 0..n-1 open, 0 the longest-open. Open entry n: 0 closes.
      await buttons.nth(n).tap();
      await settle(page);
      expect(await openOnes(page)).toEqual(
        Array.from({ length: n }, (_, i) => i + 1),
      );
      expect(await unseen(page), "entry opened past the limit").toEqual([]);
      // the order follows opening: reopen 0, now 1 (the next oldest) closes
      await buttons.nth(0).tap();
      await settle(page);
      expect(await openOnes(page)).toEqual(
        [0, ...Array.from({ length: n }, (_, i) => i + 1)].filter(
          (i) => i !== 1,
        ),
      );
      expect(await unseen(page)).toEqual([]);
      // closing by hand frees a slot: the next open closes nothing
      await buttons.nth(0).tap();
      await settle(page);
      expect(await openOnes(page)).toHaveLength(n - 1);
      const free = (await expanded(page)).indexOf("false");
      await buttons.nth(free).tap();
      await settle(page);
      expect(await openOnes(page)).toHaveLength(n);
      // never more than the limit, whichever entries are opened
      for (let i = 0; i < 5; i++) {
        await buttons.nth(i).tap();
        await settle(page);
        expect((await openOnes(page)).length).toBeLessThanOrEqual(n);
        expect(await unseen(page), `entry ${i} tapped`).toEqual([]);
      }
      expect(await whereOf(page)).toEqual(before);
    });

    test("keyboard: Enter opens an entry, Space closes it", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      await warmUpTouch(page);
      const before = await whereOf(page);
      const last = toggles(page).nth(4);
      await last.focus();
      await page.keyboard.press("Enter");
      await settle(page);
      expect((await expanded(page))[4]).toBe("true");
      await page.keyboard.press("Space");
      await settle(page);
      expect((await expanded(page))[4]).toBe("false");
      expect(await whereOf(page)).toEqual(before);
    });

    test("each toggle is named by its entry: the organisation and title, or the title alone", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      const names = await toggles(page).evaluateAll((els) =>
        els.map((e) => e.getAttribute("aria-label")),
      );
      expect(names[0]).toBe("Sabbatical");
      expect(names.slice(1).every((n) => /^[^:]+: [^:]+$/.test(n ?? ""))).toBe(
        true,
      );
    });

    test("Space on an entry's toggle opens and closes it, and never moves a step", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      await warmUpTouch(page);
      const before = await whereOf(page);
      await toggles(page).nth(4).focus();
      await page.keyboard.press("Space");
      await settle(page);
      expect((await expanded(page))[4]).toBe("true");
      expect(await whereOf(page)).toEqual(before);
      await page.keyboard.press("Space");
      await settle(page);
      expect((await expanded(page))[4]).toBe("false");
      expect(await whereOf(page)).toEqual(before);
    });

    test("the resume download stays at the top, and Education & Internships still opens whole", async ({
      page,
    }) => {
      await ready(page, "/timeline/");
      await warmUpTouch(page);
      const dl = page.locator('[data-window="timeline"] a[download]');
      const first = await page
        .locator('[data-window="timeline"] article')
        .first()
        .boundingBox();
      const box = await dl.boundingBox();
      expect(box && first && box.y < first.y).toBe(true);

      // education is on the second screen; opening it takes the workspace
      await page.keyboard.press("ArrowDown");
      await settle(page);
      await page.locator("[data-disclosure=education]").tap();
      await settle(page);
      expect(await shown(page, "timeline")).toBe(false);
      expect(await shown(page, "skills")).toBe(false);
      expect(await shown(page, "education")).toBe(true);
      expect(await unseen(page)).toEqual([]);
      // open, Education's roles page no more than before #108 (#108)
      await expect(area(page)).toHaveAttribute(
        "data-screens",
        String(EDUCATION_OPEN_SCREENS[name as keyof typeof PHONES]),
      );
      await page.locator("[data-disclosure=education]").tap();
      await settle(page);
      expect(await shown(page, "education")).toBe(true);
      expect(await shown(page, "skills")).toBe(true);
      expect((await whereOf(page)).screen).toBe(1);
    });
  });
}
