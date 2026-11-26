import { devices, expect, test } from "@playwright/test";
import { ready, settle } from "./helpers";

test.use({ ...devices["Pixel 7"] });

const box = (page: import("@playwright/test").Page, id: string) =>
  page.$eval(`[data-window="${id}"]`, (e) => {
    const area = document.querySelector("main.area")?.getBoundingClientRect();
    const r = e.getBoundingClientRect();
    return {
      shown: getComputedStyle(e).display !== "none",
      w: r.width / (area?.width ?? 1),
      h: r.height / (area?.height ?? 1),
    };
  });

test("the timeline and education share a screen, then skills; opening gives education the workspace", async ({
  page,
}) => {
  await ready(page, "/");
  await page.locator(".ws button").nth(2).tap();
  await settle(page);
  // the first screen: the timeline over education, nothing else
  expect((await box(page, "timeline")).shown).toBe(true);
  expect((await box(page, "education")).shown).toBe(true);
  expect((await box(page, "skills")).shown).toBe(false);
  const top = await box(page, "timeline");
  const edu = await box(page, "education");
  expect(Math.round(top.w * 100)).toBe(100);
  expect(Math.round(edu.w * 100)).toBe(100);
  expect(Math.round((top.h + edu.h) * 100)).toBe(100);

  // then skills, whole
  await page.keyboard.press("ArrowDown");
  await settle(page);
  expect((await box(page, "timeline")).shown).toBe(false);
  expect((await box(page, "education")).shown).toBe(false);
  const skills = await box(page, "skills");
  expect(skills.shown).toBe(true);
  expect(Math.round(skills.h * 100)).toBe(100);

  await page.locator(".ws button").nth(2).tap();
  await settle(page);
  await page.locator("[data-disclosure=education]").click();
  await settle(page);
  expect((await box(page, "timeline")).shown).toBe(false);
  expect((await box(page, "skills")).shown).toBe(false);
  const open = await box(page, "education");
  expect(Math.round(open.h * 100)).toBe(100);
  expect(Math.round(open.w * 100)).toBe(100);
});
