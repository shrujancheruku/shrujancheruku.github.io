import { expect, type Page, test } from "@playwright/test";
import {
  allPhones,
  expectScreens,
  expectWorkspace,
  ready,
  settle,
} from "./desktop";
import { unseen } from "./fit";
import { SWIPES, swipe, warmUpTouch } from "./helpers";

// The about workspace (#99): fourth, at /about/, one window with the founder's
// text and a closing line in the accent colour that leads to the sabbatical.

const pathname = (page: Page) => new URL(page.url()).pathname;
const closing = (page: Page) => page.locator('[data-window="about"] .closing');

test("about is the fourth workspace, at /about/, with its own title and share card", async ({
  page,
}) => {
  await ready(page, "/about/");
  await expectWorkspace(page, "about");
  await expect(page).toHaveTitle("About — Shrujan Cheruku");
  await expect(page.locator(".ws button").nth(3)).toHaveText(/4\s+about/);
  await expect(page.locator(".ws button").nth(3)).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/cards\/site\.png$/,
  );
  await expect(page.locator('[data-window="about"]')).toBeVisible();
});

test("the window holds the whole draft text and adds no facts", async ({
  page,
}) => {
  await ready(page, "/about/");
  const text =
    (await page.locator('[data-window="about"] .text').textContent()) ?? "";
  expect(text).toContain("I was born in the US and grew up in India");
  expect(text).toContain("made Colorado home for a while.");
  expect(text).toContain("so that we have a thing to disagree about.");
  expect(text).toContain("mostly by people in other time zones.");
  await expect(page.locator('[data-window="about"] .text p')).toHaveCount(3);
  await expect(closing(page)).toHaveText("and lately, a sabbatical →");
});

test("the closing line is in the accent colour", async ({ page }) => {
  await ready(page, "/about/");
  const [line, accent] = await page.evaluate(() => {
    const el = document.querySelector('[data-window="about"] .closing');
    const probe = document.createElement("i");
    probe.style.color = "var(--ac)";
    document.body.append(probe);
    const ac = getComputedStyle(probe).color;
    probe.remove();
    return [el ? getComputedStyle(el).color : "", ac];
  });
  expect(line).toBe(accent);
});

test("clicking the closing line moves to the sabbatical, and Back returns", async ({
  page,
}) => {
  await ready(page, "/about/");
  const before = await page.evaluate(() => history.length);
  await closing(page).click();
  await settle(page);
  await expectWorkspace(page, "sabbatical");
  expect(pathname(page)).toBe("/now/");
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
  await page.goBack();
  await settle(page);
  await expectWorkspace(page, "about");
  expect(pathname(page)).toBe("/about/");
  await page.goForward();
  await settle(page);
  expect(pathname(page)).toBe("/now/");
});

test("an arrow key from about reaches the sabbatical, and up returns to the last project", async ({
  page,
}) => {
  await ready(page, "/about/");
  await page.keyboard.press("ArrowDown");
  await settle(page);
  expect(pathname(page)).toBe("/now/");
  await page.keyboard.press("ArrowUp");
  await settle(page);
  expect(pathname(page)).toBe("/about/");
  await page.keyboard.press("ArrowUp");
  await settle(page);
  expect(pathname(page)).toBe("/work/unmacos/");
});

test("number keys: 2 is timeline, 3 the projects, 4 about, 5 sabbatical, 6 contact", async ({
  page,
}) => {
  await ready(page, "/");
  for (const [key, path] of [
    ["2", "/timeline/"],
    ["3", "/work/"],
    ["4", "/about/"],
    ["5", "/now/"],
    ["6", "/contact/"],
  ] as const) {
    await page.keyboard.press(key);
    await settle(page);
    expect(pathname(page), key).toBe(path);
  }
});

for (const [name, phone] of allPhones()) {
  test.describe(`on ${name}`, () => {
    test.use(phone);

    test("about is one page: the whole text and the closing line, nothing cut off or overlapping", async ({
      page,
    }) => {
      await ready(page, "/about/");
      await settle(page);
      expect(pathname(page)).toBe("/about/");
      await expectScreens(page, 1);
      expect(await unseen(page)).toEqual([]);
      // every paragraph and the closing line are inside the screen
      const view = page.viewportSize();
      const boxes = await page
        .locator('[data-window="about"] p, [data-window="about"] .closing')
        .evaluateAll((els) =>
          els.map((e) => {
            const r = e.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, right: r.right };
          }),
        );
      expect(boxes).toHaveLength(4);
      for (const b of boxes) {
        expect(b.bottom).toBeLessThanOrEqual(view?.height ?? 0);
        expect(b.right).toBeLessThanOrEqual(view?.width ?? 0);
      }
      // and nothing scrolls
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollHeight <=
            document.documentElement.clientHeight,
        ),
      ).toBe(true);
    });

    test("tapping the closing line, or swiping, reaches the sabbatical", async ({
      page,
    }) => {
      await ready(page, "/about/");
      await warmUpTouch(page);
      await closing(page).tap();
      await settle(page);
      expect(pathname(page)).toBe("/now/");

      await ready(page, "/about/");
      await warmUpTouch(page);
      await swipe(page, 1, SWIPES[0] as (typeof SWIPES)[number]);
      await expect.poll(() => pathname(page)).toBe("/now/");
    });
  });
}
