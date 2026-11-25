import { expect, type Page, test } from "@playwright/test";

const settle = (page: Page) => page.waitForTimeout(1300);
const rect = (page: Page, id: string) =>
  page.$eval(`[data-window="${id}"]`, (e) => {
    const area = document.querySelector("main.area")?.getBoundingClientRect();
    const r = e.getBoundingClientRect();
    return {
      left: r.left - (area?.left ?? 0),
      width: r.width,
      top: r.top - (area?.top ?? 0),
      height: r.height,
      area: area?.width ?? 0,
      areaHeight: area?.height ?? 0,
    };
  });
const visible = (page: Page, id: string) =>
  page.$eval(
    `[data-window="${id}"]`,
    (e) => getComputedStyle(e).display !== "none",
  );

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  await page.keyboard.press("3");
  await settle(page);
});

test("the timeline lists the five entries newest first with Unsupervised stacked", async ({
  page,
}) => {
  const entries = page.locator('[data-window="timeline"] article');
  await expect(entries).toHaveCount(5);
  const titles = await entries.evaluateAll((els) =>
    els.map((e) => [...e.querySelectorAll(".title")].map((t) => t.textContent)),
  );
  expect(titles).toEqual([
    ["Sabbatical"],
    ["Lead Engineer"],
    ["Senior Software Engineer", "Full Stack Engineer"],
    ["Platform Engineer"],
    ["Software Engineer"],
  ]);
  const unsupervised = entries.nth(2);
  await expect(unsupervised.locator(".when")).toHaveText([
    "May – Oct 2022",
    "Nov 2020 – Apr 2022",
  ]);
  await expect(unsupervised.locator(".org")).toHaveText("Unsupervised");
  await expect(unsupervised.locator(".tag").first()).toHaveText("AWS");
});

test("the timeline scrolls inside its window on a short screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 420 });
  await page.waitForTimeout(300);
  const scroll = await page.$eval(
    '[data-window="timeline"] .body',
    (e) => e.scrollHeight > e.clientHeight,
  );
  expect(scroll).toBe(true);
});

test("Education & Internships shows the degree and the cue, roles hidden", async ({
  page,
}) => {
  const edu = page.locator('[data-window="education"]');
  await expect(edu.locator(".deg")).toHaveText("B.Sc Computer Science");
  await expect(edu.locator(".cue")).toHaveText(
    "▸ 4 earlier roles · teaching, internships",
  );
  await expect(edu.locator("#education-roles")).toBeHidden();
  const r = await rect(page, "education");
  expect(Math.round((r.width / r.area) * 100)).toBe(38);
  expect(await visible(page, "skills")).toBe(true);
  const t = await rect(page, "timeline");
  expect(Math.round((t.width / t.area) * 100)).toBe(62);
});

test("opening re-tiles to 46 / 54, drops skills, staggers the roles in; closing reverses", async ({
  page,
}) => {
  const cue = page.locator("[data-disclosure=education]");
  await cue.click();
  await page.waitForTimeout(900);
  // mid stagger: some roles are only part-way in
  const opacities = await page.$$eval("#education-roles > article", (els) =>
    els.map((e) => Number(getComputedStyle(e).opacity)),
  );
  expect(opacities).toHaveLength(4);
  expect(opacities.some((o) => o < 1)).toBe(true);
  await settle(page);

  const t = await rect(page, "timeline");
  const e = await rect(page, "education");
  expect(Math.round((t.width / t.area) * 100)).toBe(46);
  expect(Math.round((e.width / e.area) * 100)).toBe(54);
  expect(Math.round((e.height / e.areaHeight) * 100)).toBe(100);
  expect(await visible(page, "skills")).toBe(false);
  await expect(cue).toHaveText("▸ hide", { useInnerText: true });
  await expect(cue).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#education-roles > article")).toHaveCount(4);
  await expect
    .poll(() =>
      page.$$eval("#education-roles > article", (els) =>
        els.every((e) => getComputedStyle(e).opacity === "1"),
      ),
    )
    .toBe(true);

  await cue.click();
  await settle(page);
  const back = await rect(page, "timeline");
  expect(Math.round((back.width / back.area) * 100)).toBe(62);
  expect(await visible(page, "skills")).toBe(true);
  await expect(cue).toHaveText("▸ 4 earlier roles · teaching, internships");
  await expect(page.locator("#education-roles")).toBeHidden();
});

test("leaving the workspace closes it", async ({ page }) => {
  await page.locator("[data-disclosure=education]").click();
  await settle(page);
  await page.keyboard.press("4");
  await settle(page);
  await page.keyboard.press("3");
  await settle(page);
  expect(await visible(page, "skills")).toBe(true);
  await expect(page.locator("[data-disclosure=education]")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("the lower right is the skills window, 38% x 60%", async ({ page }) => {
  const r = await rect(page, "skills");
  expect(Math.round((r.width / r.area) * 100)).toBe(38);
  expect(Math.round((r.height / r.areaHeight) * 100)).toBe(60);
  await expect(page.locator('[data-window="skills"] .ph')).toHaveCount(0);
});
