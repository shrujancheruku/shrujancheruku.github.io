import { expect, type Page, test } from "@playwright/test";

const settle = (page: Page) => page.waitForTimeout(1300);
const fills = (page: Page) =>
  page.$$eval('[data-window="skills"] .fill', (els) =>
    els.map((e) => {
      const track = (e.parentElement as HTMLElement).getBoundingClientRect();
      const r = e.getBoundingClientRect();
      return { w: r.width / track.width, t: getComputedStyle(e).transform };
    }),
  );

async function enter(page: Page) {
  await page.goto("/");
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  await page.keyboard.press("3");
}

test("five bars on tracks, no number, Comedic Talent last at full length", async ({
  page,
}) => {
  await enter(page);
  await page.waitForTimeout(3500);
  const win = page.locator('[data-window="skills"]');
  await expect(win.locator(".name")).toHaveText([
    "Python",
    "React + TypeScript",
    "Kubernetes + Helm",
    "Go",
    "Comedic Talent",
  ]);
  const w = (await fills(page)).map((f) => Math.round(f.w * 100));
  expect(w).toEqual([90, 90, 80, 70, 100]);
  await expect(win).not.toContainText(/\d\s*\/\s*10/);
});

test("the bars grow in on entry, the joke bar last; replays on re-entry", async ({
  page,
}) => {
  await enter(page);
  await page.waitForTimeout(500);
  const early = await fills(page);
  expect(early.some((f) => f.w < 0.5)).toBe(true);
  await page.waitForTimeout(3500);
  expect((await fills(page)).every((f) => f.w > 0.69)).toBe(true);
  await page.keyboard.press("4");
  await settle(page);
  await page.keyboard.press("3");
  await page.waitForTimeout(500);
  expect((await fills(page)).some((f) => f.w < 0.5)).toBe(true);
});

test("languages are a status-dot list with levels at the right edge", async ({
  page,
}) => {
  await enter(page);
  await settle(page);
  const rows = page.locator('[data-window="skills"] .langs li');
  await expect(rows).toHaveClass([
    "native",
    "native",
    "proficient",
    "conversational",
    "rudimentary",
  ]);
  await expect(rows.nth(3).locator("em")).toHaveText("conversational");
});

test("hobbies are the tree with three folders and nine hobbies", async ({
  page,
}) => {
  await enter(page);
  await settle(page);
  const skills = page.locator('[data-window="skills"]');
  await expect(skills).toContainText("tree ~/hobbies");
  const tree = skills.getByRole("list", { name: "hobbies" });
  await expect(tree.locator("[data-hobby]")).toHaveCount(9);
  // every row the list owns is an item: three folders and nine hobbies, and
  // the prompt line sits outside it
  const roles = await tree.evaluate((el) =>
    [...el.children].map((c) => c.getAttribute("role")),
  );
  expect(roles).toEqual(Array(12).fill("listitem"));
  await expect(tree.locator(".hit")).toHaveText([
    "hiking",
    "photography",
    "watchmaking",
    "reading",
  ]);
});

test("the window scrolls when the content does not fit", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 520 });
  await enter(page);
  await settle(page);
  const s = await page.$eval('[data-window="skills"] .body', (e) => ({
    sh: e.scrollHeight,
    ch: e.clientHeight,
    o: getComputedStyle(e).overflowY,
  }));
  expect(s.sh).toBeGreaterThan(s.ch);
  expect(s.o).toBe("auto");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("all five bars are at length straight away", async ({ page }) => {
    await enter(page);
    await page.waitForTimeout(300);
    const w = (await fills(page)).map((f) => Math.round(f.w * 100));
    expect(w).toEqual([90, 90, 80, 70, 100]);
  });
});
