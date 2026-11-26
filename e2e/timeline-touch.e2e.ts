import { devices, expect, test } from "@playwright/test";
import { area, ready, settle } from "./helpers";

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

test("the timeline, then education, then skills, each the whole workspace; opening gives education the workspace", async ({
  page,
}) => {
  await ready(page, "/");
  await page.locator(".ws button").nth(3).tap();
  await settle(page);
  // the timeline screens come first, alone
  expect((await box(page, "timeline")).shown).toBe(true);
  expect((await box(page, "education")).shown).toBe(false);
  expect((await box(page, "skills")).shown).toBe(false);
  const whole = await box(page, "timeline");
  expect(Math.round(whole.h * 100)).toBe(100);
  expect(Math.round(whole.w * 100)).toBe(100);

  // then education, then skills
  const order: string[] = [];
  for (let guard = 0; guard < 12; guard++) {
    for (const id of ["timeline", "education", "skills"])
      if ((await box(page, id)).shown && !order.includes(id)) order.push(id);
    await page.keyboard.press("ArrowDown");
    await settle(page);
    if ((await area(page).getAttribute("data-step")) !== "6") break;
  }
  expect(order).toEqual(["timeline", "education", "skills"]);

  await page.locator(".ws button").nth(3).tap();
  await settle(page);
  while (!(await box(page, "education")).shown) {
    await page.keyboard.press("ArrowDown");
    await settle(page);
  }
  await page.locator("[data-disclosure=education]").click();
  await settle(page);
  expect((await box(page, "timeline")).shown).toBe(false);
  expect((await box(page, "skills")).shown).toBe(false);
  const open = await box(page, "education");
  expect(Math.round(open.h * 100)).toBe(100);
  expect(Math.round(open.w * 100)).toBe(100);
});
