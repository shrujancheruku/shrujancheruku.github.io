import { devices, expect, type Page, test } from "@playwright/test";
import { ready, settle, warmUpTouch } from "./helpers";

// On a phone the status bar's shortcut tooltips name keys a phone does not
// have, so none of them shows: not while the page is idle, not after a tap.
// Desktop keeps them (nav-cues.e2e.ts and the status bar's own checks).

/** The tooltips that would show, as their computed display: "shown" if any is on screen. */
const shownTips = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".tip")]
      .filter((t) => getComputedStyle(t).display !== "none")
      .map((t) => t.textContent?.replace(/\s+/g, " ").trim() ?? "?"),
  );

for (const [name, opts] of [
  [
    "Pixel 7",
    (() => {
      const { defaultBrowserType: _e, ...d } = devices["Pixel 7"];
      return d;
    })(),
  ],
  [
    "iPhone 14",
    (() => {
      const { defaultBrowserType: _e, ...d } = devices["iPhone 14"];
      return d;
    })(),
  ],
  [
    "375x667",
    {
      viewport: { width: 375, height: 667 },
      hasTouch: true,
      isMobile: true,
    },
  ],
] as const) {
  test.describe(name, () => {
    test.use(opts);

    test("no shortcut tooltip shows on first load while idle", async ({
      page,
    }) => {
      await ready(page);
      await settle(page);
      await expect(page.locator("body")).toHaveClass(/idle/);
      expect(await shownTips(page)).toEqual([]);
    });

    test("no shortcut tooltip shows after a tap on the status bar", async ({
      page,
    }) => {
      await ready(page);
      await warmUpTouch(page);
      await page.locator('[data-act="theme"]').tap();
      await page.locator('[data-act="theme"]').tap();
      await settle(page);
      expect(await shownTips(page)).toEqual([]);
    });
  });
}

test("1280x800 desktop still shows its tooltips while idle", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page);
  await expect(page.locator(".ib .tip").first()).toBeVisible();
});
