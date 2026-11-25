import { expect, type Page, test } from "@playwright/test";

const root = (page: Page) => page.locator("html");
const ready = async (page: Page) => {
  await page.goto("/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
};

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

test("on load the tooltips are written out and vanish on the first key, with the halo", async ({
  page,
}) => {
  await ready(page);
  await page.waitForTimeout(1500);
  const tips = page.locator(".tip");
  await expect(tips).toHaveCount(5);
  for (const tip of await tips.all())
    await expect(tip).toHaveCSS("opacity", "1");
  await expect(page.locator(".tip[data-tip]")).toContainText(
    "workspaces 1 – 5",
  );
  const animation = () =>
    page.locator(".halo").evaluate((el) => getComputedStyle(el).animationName);
  expect(await animation()).toBe("halo");
  await page.mouse.move(5, 5);
  await page.mouse.down();
  await page.mouse.up();
  for (const tip of await tips.all())
    await expect(tip).toHaveCSS("opacity", "0");
  expect(await animation()).toBe("none");
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
