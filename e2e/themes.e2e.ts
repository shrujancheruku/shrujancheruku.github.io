import { expect, type Page, test } from "@playwright/test";
import { ready } from "./helpers";

const root = (page: Page) => page.locator("html");

for (const scheme of ["light", "dark"] as const) {
  test(`with nothing stored the theme is paper in ${scheme} system mode`, async ({
    browser,
  }) => {
    const page = await (
      await browser.newContext({ colorScheme: scheme })
    ).newPage();
    await ready(page);
    await expect(root(page)).toHaveAttribute("data-theme", "paper");
    await expect(page.locator("body")).toHaveCSS("color", "rgb(34, 34, 34)");
  });
}

test("the menu switches themes live, and the choice persists across visits", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "theme" }).click();
  await page.getByRole("menuitemradio", { name: "nord" }).click();
  await expect(root(page)).toHaveAttribute("data-theme", "nord");
  await expect(page.locator(".screen")).toHaveCSS(
    "background-color",
    "rgb(46, 52, 64)",
  );
  await page.reload();
  await expect(root(page)).toHaveAttribute("data-theme", "nord");
});

test("T cycles through all eight themes and wraps back to paper", async ({
  page,
}) => {
  await ready(page);
  const seen: (string | null)[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("t");
    seen.push(await root(page).getAttribute("data-theme"));
  }
  expect(seen).toEqual([
    "issho-light",
    "issho-dark",
    "nord",
    "rose-pine",
    "starship",
    "tokyo-night",
    "gruvbox",
    "paper",
  ]);
});

test("the two issho themes stack in the right column of the menu", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "theme" }).click();
  const light = await page
    .getByRole("menuitemradio", { name: "issho-light" })
    .boundingBox();
  const dark = await page
    .getByRole("menuitemradio", { name: "issho-dark" })
    .boundingBox();
  const others = await page
    .getByRole("menuitemradio", { name: "nord" })
    .boundingBox();
  expect(light?.x).toBe(dark?.x);
  expect(dark?.y).toBeGreaterThan(light?.y ?? 0);
  expect(light?.x).toBeGreaterThan(others?.x ?? 0);
  await expect(page.getByRole("menuitemradio")).toHaveCount(8);
});

test("a storage failure falls back to paper without an error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("denied");
      },
    });
  });
  await ready(page);
  await expect(root(page)).toHaveAttribute("data-theme", "paper");
  await page.keyboard.press("t");
  await expect(root(page)).toHaveAttribute("data-theme", "issho-light");
  expect(errors).toEqual([]);
});

test("home and contact jump to their workspaces", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "contact", exact: true }).click();
  await expect(page.locator("main.area")).toHaveAttribute(
    "data-workspace",
    "4",
  );
  await page.keyboard.press("h");
  await expect(page.locator("main.area")).toHaveAttribute(
    "data-workspace",
    "0",
  );
  await page.keyboard.press("c");
  await expect(page.locator("main.area")).toHaveAttribute(
    "data-workspace",
    "4",
  );
});

test("the crt toggle shows on or off, is remembered and sets the root attribute", async ({
  page,
}) => {
  await ready(page);
  const crt = page.getByRole("button", { name: "crt effect" });
  await expect(crt).toHaveAttribute("aria-pressed", "true");
  await expect(root(page)).toHaveAttribute("data-crt", "on");
  await page.keyboard.press("e");
  await expect(crt).toHaveAttribute("aria-pressed", "false");
  await expect(root(page)).toHaveAttribute("data-crt", "off");
  await page.reload();
  await expect(root(page)).toHaveAttribute("data-crt", "off");
});

test("the clock shows on desktop", async ({ page }) => {
  await ready(page);
  await expect(page.locator("[data-clock]")).toHaveText(/\d{1,2}:\d{2}/);
});

/** The first interaction of each kind, and nothing else. */
const FIRST: [string, (page: Page) => Promise<void>][] = [
  [
    "pointer press",
    async (page) => {
      await page.mouse.move(5, 5);
      await page.mouse.down();
      await page.mouse.up();
    },
  ],
  ["key", (page) => page.keyboard.press("Shift")],
  [
    "wheel",
    async (page) => {
      // over the status bar, and too small to step
      await page.mouse.move(640, 10);
      await page.mouse.wheel(0, 5);
    },
  ],
];

for (const [kind, interact] of FIRST) {
  test(`on load the tooltips are written out and vanish on the first ${kind}, with the halo`, async ({
    page,
  }) => {
    await ready(page);
    const tips = page.locator(".tip");
    await expect(tips).toHaveCount(5);
    for (const tip of await tips.all())
      await expect(tip).toHaveCSS("opacity", "1");
    await expect(page.locator(".tip[data-tip]")).toContainText(
      "workspaces 1 – 5",
    );
    const animation = () =>
      page
        .locator(".halo")
        .evaluate((el) => getComputedStyle(el).animationName);
    await expect.poll(animation).toBe("halo");
    await interact(page);
    for (const tip of await tips.all())
      await expect(tip).toHaveCSS("opacity", "0");
    expect(await animation()).toBe("none");
  });
}

test("on touch no tooltip is written out, before or after the first touch", async ({
  browser,
}) => {
  const page = await (
    await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 412, height: 915 },
    })
  ).newPage();
  await ready(page);
  const shown = page.locator(".tip:visible");
  // a phone has no keys to name, so none of the tooltips shows while idle
  await expect(shown).toHaveCount(0);
  // a touch alone, with no pointer or key event alongside it
  await page.evaluate(() =>
    document.body.dispatchEvent(
      new TouchEvent("touchstart", { bubbles: true, cancelable: true }),
    ),
  );
  await expect(shown).toHaveCount(0);
});

test("after the first interaction each toggle's tooltip shows on keyboard focus", async ({
  page,
}) => {
  await ready(page);
  await page.mouse.click(5, 790);
  for (const act of ["home", "contact", "crt", "theme"]) {
    const button = page.locator(`[data-act="${act}"]`);
    const tip = button.locator(".tip");
    await expect(tip).toHaveCSS("opacity", "0");
    // reach it by keyboard, so the focus is visible
    await button.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(button).toBeFocused();
    await expect(tip).toHaveCSS("opacity", "1");
    await page.keyboard.press("Tab");
  }
});

test("with reduced motion the halo does not pulse", async ({ browser }) => {
  const page = await (
    await browser.newContext({ reducedMotion: "reduce" })
  ).newPage();
  await ready(page);
  expect(
    await page
      .locator(".halo")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});

test("the theme switch's ring is the halo: without the class, no ring", async ({
  page,
}) => {
  await ready(page);
  const theme = page.locator('[data-act="theme"]');
  const ring = () => theme.evaluate((el) => getComputedStyle(el).boxShadow);
  // past the first interaction the pulse stops, but the ring stays
  await page.mouse.move(5, 5);
  await page.mouse.down();
  await page.mouse.up();
  expect(await ring()).not.toBe("none");
  // the share card removes the class: ring and pulse go together
  await theme.evaluate((el) => el.classList.remove("halo"));
  expect(await ring()).toBe("none");
});

test("a tooltip shows its name and key on hover after 250ms", async ({
  page,
}) => {
  await ready(page);
  await page.keyboard.press("Shift");
  const tip = page.locator('[data-act="contact"] .tip');
  await expect(tip).toHaveCSS("opacity", "0");
  await page.locator('[data-act="contact"]').hover();
  await expect(tip).toHaveCSS("opacity", "0");
  await page.waitForTimeout(600);
  await expect(tip).toHaveCSS("opacity", "1");
  await expect(tip).toHaveText("contact C");
});

test("Back after H returns to the previous place, and C is a jump too", async ({
  page,
}) => {
  await ready(page);
  await page.keyboard.press("3");
  await expect(page.locator("main.area")).toHaveAttribute(
    "data-workspace",
    "2",
  );
  const where = new URL(page.url()).pathname;
  await page.keyboard.press("h");
  await expect(page.locator("main.area")).toHaveAttribute(
    "data-workspace",
    "0",
  );
  expect(new URL(page.url()).pathname).not.toBe(where);
  await page.goBack();
  await expect(page.locator("main.area")).toHaveAttribute(
    "data-workspace",
    "2",
  );
  expect(new URL(page.url()).pathname).toBe(where);
  await page.getByRole("button", { name: "contact", exact: true }).click();
  await expect(page.locator("main.area")).toHaveAttribute(
    "data-workspace",
    "4",
  );
  await page.goBack();
  await expect(page.locator("main.area")).toHaveAttribute(
    "data-workspace",
    "2",
  );
});

test("after the first interaction the workspaces tooltip shows on hover and on keyboard focus", async ({
  page,
}) => {
  await ready(page);
  await page.mouse.click(5, 790);
  const tip = page.locator(".ws .tip");
  await expect(tip).toHaveCSS("opacity", "0");
  await page.locator(".ws button").first().hover();
  await expect(tip).toHaveCSS("opacity", "1");
  await page.mouse.move(640, 500);
  await expect(tip).toHaveCSS("opacity", "0");
  await page.locator(".ws button").nth(1).focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(tip).toHaveCSS("opacity", "1");
});

test("shortcuts with shift held are ignored", async ({ page }) => {
  await ready(page);
  for (const k of ["Shift+T", "Shift+E", "Shift+C"])
    await page.keyboard.press(k);
  await expect(root(page)).toHaveAttribute("data-theme", "paper");
  await expect(root(page)).toHaveAttribute("data-crt", "on");
  await expect(page.locator("main.area")).toHaveAttribute(
    "data-workspace",
    "0",
  );
});
