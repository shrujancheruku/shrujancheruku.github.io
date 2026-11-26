import { expect, type Page, test } from "@playwright/test";
import { ready } from "./helpers";

const frames = (page: Page) =>
  page
    .locator("#crt-canvas")
    .evaluate((c) => Number((c as HTMLElement).dataset.frames ?? 0));

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

/**
 * Mean luma (Rec. 709, 0-255) of a screenshot, decoded in the page: the PNG is
 * drawn to a canvas and every pixel read back. No image library is needed.
 */
async function meanLuma(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(
    async (dataUrl) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;
        sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      return sum / (data.length / 4);
    },
    `data:image/png;base64,${png.toString("base64")}`,
  );
}

/**
 * Dark themes stay within 5% of the effect-off screen. Light themes stay
 * below it, since the multiply overlay cannot brighten a near-white page
 * (founder decision on #79, option C), but must still beat master's 0.78.
 */
const expectation = {
  paper: { min: 0.82, max: 1 },
  "rose-pine": { min: 0.8, max: 1 },
  "issho-light": { min: 0.8, max: 1 },
  "tokyo-night": { min: 0.95, max: 1.05 },
} as const;

for (const theme of Object.keys(expectation) as (keyof typeof expectation)[]) {
  test(`with the crt effect on, the ${theme} opening screen is brighter than master or within 5% of the effect-off screen`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    // One init script, read per load: the crt choice is set by the test, then the page reloaded.
    await page.addInitScript((t) => {
      localStorage.setItem("theme", t);
    }, theme);
    const shoot = async (crt: "on" | "off") => {
      await page.goto("/");
      await page.evaluate((c) => localStorage.setItem("crt", c), crt);
      await ready(page);
      await expect(page.locator("html")).toHaveAttribute("data-crt", crt);
      // Let the boot and the key tips settle; freeze animations and the caret so the frame is stable.
      await page.waitForTimeout(2500);
      const png = await page
        .locator(".screen")
        .screenshot({ animations: "disabled", caret: "hide" });
      return meanLuma(page, png);
    };
    const off = await shoot("off");
    const on = await shoot("on");
    const ratio = on / off;
    console.log(
      `crt brightness ${theme}: off ${off.toFixed(2)} on ${on.toFixed(2)} ratio ${ratio.toFixed(4)}`,
    );
    expect(ratio).toBeGreaterThanOrEqual(expectation[theme].min);
    expect(ratio).toBeLessThanOrEqual(expectation[theme].max);
    await context.close();
  });
}
