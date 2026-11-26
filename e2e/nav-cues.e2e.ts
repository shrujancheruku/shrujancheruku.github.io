import { devices, expect, type Page, test } from "@playwright/test";
import { unseen } from "./fit";
import { ready, settle, warmUpTouch } from "./helpers";

const cue = (page: Page) => page.locator("[data-cue]");
const text = (page: Page) => page.locator("[data-cue-text]");
const iconOpacity = (page: Page, dir: "back" | "forward") =>
  page
    .locator(`[data-cue-dir="${dir}"]`)
    .evaluate((e) => Number(getComputedStyle(e).opacity));

/** The cue covers no window: its box meets none of the windows on show. */
async function coversNothing(page: Page) {
  const overlaps = await page.evaluate(() => {
    const c = document.querySelector("[data-cue]")?.getBoundingClientRect();
    if (!c) return ["no cue"];
    const out: string[] = [];
    for (const p of document.querySelectorAll<HTMLElement>(".pane")) {
      if (getComputedStyle(p).display === "none") continue;
      const r = p.querySelector(".win")?.getBoundingClientRect();
      if (!r) continue;
      if (
        Math.min(c.right, r.right) - Math.max(c.left, r.left) > 1 &&
        Math.min(c.bottom, r.bottom) - Math.max(c.top, r.top) > 1
      )
        out.push(p.dataset.window ?? "?");
    }
    // and it stays inside the screen
    if (c.left < 0 || c.right > innerWidth) out.push("outside the screen");
    return out;
  });
  expect(overlaps).toEqual([]);
}

async function notFocusable(page: Page) {
  await expect(cue(page)).toHaveAttribute("aria-hidden", "true");
  const tabbable = await cue(page).evaluate(
    (c) => c.querySelectorAll("a, button, input, [tabindex]").length,
  );
  expect(tabbable).toBe(0);
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("text shows with the tooltips, then goes; the icon stays, quiet", async ({
    page,
  }) => {
    await ready(page);
    await expect(text(page)).toBeVisible();
    await expect(text(page)).toHaveText(/arrow keys/);
    await expect(page.locator(".ib .tip").first()).toBeVisible();
    const loud = await iconOpacity(page, "forward");
    await page.keyboard.press("x");
    await expect(text(page)).toBeHidden();
    await expect(page.locator(".ib .tip").first()).toHaveCSS("opacity", "0");
    await expect(cue(page)).toBeVisible();
    await expect(page.locator('[data-cue-dir="forward"]')).toBeVisible();
    await expect.poll(() => iconOpacity(page, "forward")).toBeLessThan(loud);
    await notFocusable(page);
  });

  test("the first and last step dim the back and forward cue", async ({
    page,
  }) => {
    await ready(page);
    await expect(cue(page)).toHaveAttribute("data-edge", "first");
    expect(await iconOpacity(page, "back")).toBeLessThan(
      await iconOpacity(page, "forward"),
    );
    await page.keyboard.press("ArrowDown");
    await expect(cue(page)).toHaveAttribute("data-edge", "");
    await page.keyboard.press("c");
    await settle(page);
    await expect(cue(page)).toHaveAttribute("data-edge", "last");
    expect(await iconOpacity(page, "forward")).toBeLessThan(
      await iconOpacity(page, "back"),
    );
  });

  test("covers no content", async ({ page }) => {
    await ready(page);
    await settle(page);
    await coversNothing(page);
    expect(await unseen(page)).toEqual([]);
    await page.keyboard.press("x");
    await coversNothing(page);
  });

  test("reduced motion: nothing animates and the text still goes", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ready(page);
    await expect(text(page)).toBeVisible();
    const running = await cue(page).evaluate(
      (c) => c.getAnimations({ subtree: true }).length,
    );
    expect(running).toBe(0);
    await page.keyboard.press("x");
    await expect(text(page)).toBeHidden();
  });

  for (const theme of ["paper", "issho-dark"]) {
    for (const crt of ["on", "off"]) {
      test(`shows in ${theme} with the crt effect ${crt}`, async ({ page }) => {
        await page.addInitScript(
          ([t, c]) => {
            localStorage.setItem("theme", t);
            localStorage.setItem("crt", c);
          },
          [theme, crt] as [string, string],
        );
        await ready(page);
        await expect(cue(page)).toBeVisible();
        const colors = await cue(page).evaluate((c) => ({
          fg: getComputedStyle(c).color,
          bg: getComputedStyle(document.body).backgroundColor,
        }));
        expect(colors.fg).not.toBe(colors.bg);
      });
    }
  }
});

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

    test("swipe text shows on load; a tap takes it away, the icon stays", async ({
      page,
    }) => {
      await ready(page);
      await expect(text(page)).toBeVisible();
      await expect(text(page)).toHaveText(/swipe/);
      await warmUpTouch(page);
      await expect(text(page)).toBeHidden();
      await expect(cue(page)).toBeVisible();
      await notFocusable(page);
    });

    test("covers no content", async ({ page }) => {
      await ready(page);
      await settle(page);
      await coversNothing(page);
      expect(await unseen(page)).toEqual([]);
      await warmUpTouch(page);
      await coversNothing(page);
    });

    test("reduced motion: no animation, the text still goes", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await ready(page);
      await expect(text(page)).toBeVisible();
      expect(
        await cue(page).evaluate(
          (c) => c.getAnimations({ subtree: true }).length,
        ),
      ).toBe(0);
      await warmUpTouch(page);
      await expect(text(page)).toBeHidden();
    });
  });
}

test("1280x800 desktop is not touch: the cue names keys, not swiping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page);
  await expect(text(page)).not.toHaveText(/swipe/);
});
