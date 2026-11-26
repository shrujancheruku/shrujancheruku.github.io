import { devices, expect, test } from "@playwright/test";
import {
  area,
  atEnd,
  isOneScreen,
  ready,
  SWIPES,
  settle,
  swipeScreen,
  warmUpTouch,
  whereOf,
} from "./helpers";

// One swipe on a phone moves exactly one screen (a step is one or more). Swipes are real touch events
// (CDP), so the browser's own scrolling gets its chance to take them.

// a walk over every screen both ways takes 1.5 to 2 minutes on the CI runner
test.setTimeout(240_000);

const PHONES = ["Pixel 7", "iPhone 14"] as const;
for (const phone of PHONES) {
  test.describe(phone, () => {
    // CDP touch needs Chromium: the phone's size, touch and agent, not WebKit
    const { defaultBrowserType: _engine, ...emulation } = devices[phone];
    test.use(emulation);

    for (const s of SWIPES) {
      test(`a ${s.name} swipe moves exactly one screen, from every screen, both ways`, async ({
        page,
      }) => {
        await ready(page, "/");
        await page.waitForLoadState("networkidle");
        await settle(page);
        await warmUpTouch(page);
        let screens = 0;
        for (let guard = 0; guard < 80; guard++) {
          const { before, after } = await swipeScreen(page, 1, s);
          expect(
            isOneScreen(before, after, 1),
            `${JSON.stringify([before, after])}`,
          ).toBe(true);
          screens++;
          await settle(page);
          if (await atEnd(page, after)) break;
        }
        // the end is the contact step; every screen was reached on the way
        expect(screens).toBeGreaterThan(7);
        for (let n = 0; n < screens; n++) {
          const { before, after } = await swipeScreen(page, -1, s);
          expect(
            isOneScreen(before, after, -1),
            `${JSON.stringify([before, after])}`,
          ).toBe(true);
          await settle(page);
        }
        expect(await whereOf(page)).toMatchObject({ step: 0, screen: 0 });
      });
    }

    test("the URL bar hiding (viewport height change) does not lose a step", async ({
      page,
    }) => {
      await ready(page, "/");
      await page.waitForLoadState("networkidle");
      await settle(page);
      await warmUpTouch(page);
      const size = page.viewportSize();
      if (!size) throw new Error("no viewport");
      await page.setViewportSize({
        width: size.width,
        height: size.height + 90,
      });
      const long = SWIPES[1] ?? { name: "long", distance: 380, ms: 400 };
      for (let guard = 0; guard < 80; guard++) {
        const { before, after } = await swipeScreen(page, 1, long);
        expect(isOneScreen(before, after, 1)).toBe(true);
        if (await atEnd(page, after)) break;
      }
      await page.setViewportSize(size);
      await expect
        .poll(async () => atEnd(page, await whereOf(page)))
        .toBe(true);
    });

    test("no window scrolls its own content on touch", async ({ page }) => {
      await ready(page, "/");
      const scrollers = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".pane *")]
          .filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowY))
          .map((e) => e.className.toString() || e.tagName),
      );
      expect(scrollers).toEqual([]);
    });

    // Each address and the step it must open, worked out from the workspace
    // model and the project windows rather than the address book the desktop
    // itself reads. A featured project's step is its window's position; an
    // archive project opens on the last featured step with the archive open.
    const OPENS = [
      ["/", "opening", 0],
      ["/work/", "projects", 0],
      ["/work/unmacos/", "projects", "unmacos"],
      ["/work/claude-orchestrate/", "projects", "last"],
      ["/timeline/", "timeline", 0],
      ["/now/", "sabbatical", 0],
      ["/contact/", "contact", 0],
      ["/archive/", "projects", "last"],
    ] as const;
    for (const [path, workspace, within] of OPENS) {
      test(`${path} opens on its step with the status bar intact`, async ({
        page,
      }) => {
        await ready(page, path);
        await page.waitForTimeout(400);
        const bar = await page.locator("header.bar").boundingBox();
        const vis = await page.evaluate(
          ([id, at]) => {
            const model: { id: string; steps: unknown[] }[] = JSON.parse(
              document.getElementById("desktop-model")?.textContent ?? "[]",
            );
            const index = model.findIndex((w) => w.id === id);
            const first = model
              .slice(0, index)
              .reduce((n, w) => n + w.steps.length, 0);
            const count = model[index]?.steps.length ?? 0;
            const position = [
              ...document.querySelectorAll<HTMLElement>(
                '[data-window^="comp-"] [data-slot]',
              ),
            ].find((s) => s.dataset.composition === at)?.dataset.position;
            const offset =
              at === "last"
                ? count - 1
                : typeof at === "number"
                  ? at
                  : Number(position) - 1;
            return {
              want: first + offset,
              step: Number(
                document.querySelector("main.area")?.getAttribute("data-step"),
              ),
            };
          },
          [workspace, within] as const,
        );
        expect(bar?.y ?? -1).toBeGreaterThanOrEqual(0);
        expect(bar?.height).toBe(40);
        expect(new URL(page.url()).pathname).toBe(path);
        expect(Number.isInteger(vis.want)).toBe(true);
        expect(vis.step).toBe(vis.want);
        if (within === "last")
          await expect(area(page)).toHaveAttribute("data-open", "true");
      });
    }
  });
}
