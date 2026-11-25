import { expect, type Page, test } from "@playwright/test";

const frames = (page: Page) =>
  page
    .locator("#crt-canvas")
    .evaluate((c) => Number((c as HTMLElement).dataset.frames ?? 0));
const ready = async (page: Page) => {
  await page.goto("/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
};

test("the overlay draws by default and never takes clicks", async ({
  page,
}) => {
  await ready(page);
  await expect.poll(() => frames(page)).toBeGreaterThan(2);
  await expect(page.locator("#crt-canvas")).toHaveCSS("pointer-events", "none");
  const hit = await page.evaluate(() => {
    const el = document.elementFromPoint(300, 300);
    return el?.id;
  });
  expect(hit).not.toBe("crt-canvas");
});

test("toggling the effect never moves the screen, and off stops the canvas", async ({
  page,
}) => {
  await ready(page);
  const box = () => page.locator(".screen").boundingBox();
  const before = await box();
  await page.keyboard.press("e");
  await expect(page.locator("html")).toHaveAttribute("data-crt", "off");
  await expect(page.locator("#crt-canvas")).toBeHidden();
  expect(await box()).toEqual(before);
  const stopped = await frames(page);
  await page.waitForTimeout(300);
  expect(await frames(page)).toBe(stopped);
  await page.keyboard.press("e");
  await expect.poll(() => frames(page)).toBeGreaterThan(stopped);
  expect(await box()).toEqual(before);
});

test("the canvas stops while the tab is hidden and resumes after", async ({
  page,
}) => {
  await ready(page);
  await expect.poll(() => frames(page)).toBeGreaterThan(2);
  const hide = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => h,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
  await hide(true);
  await page.waitForTimeout(100);
  const stopped = await frames(page);
  await page.waitForTimeout(300);
  expect(await frames(page)).toBe(stopped);
  await hide(false);
  await expect.poll(() => frames(page)).toBeGreaterThan(stopped);
});

test("with reduced motion the overlay still draws", async ({ browser }) => {
  const page = await (
    await browser.newContext({ reducedMotion: "reduce" })
  ).newPage();
  await ready(page);
  await expect.poll(() => frames(page)).toBeGreaterThan(2);
  await expect(page.locator("#crt-canvas")).toBeVisible();
});

test("no curvature or fringing: text stays real and untransformed", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator(".screen")).toHaveCSS("filter", "none");
  await expect(page.locator(".screen")).toHaveCSS("transform", "none");
  await expect(page.locator("main.area")).toContainText("product engineer");
});
