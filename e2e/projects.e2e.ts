import { devices, expect, type Page, test } from "@playwright/test";

const SLUGS = ["issho", "unmacos", "orca-flow", "rapid-radiology"];
const area = (page: Page) => page.locator("main.area");
const ready = async (page: Page, path = "/") => {
  await page.goto(path);
  await expect(area(page)).toHaveAttribute("data-ready", "true");
};
const settle = (page: Page) => page.waitForTimeout(1100);
const shown = (page: Page) =>
  page.$$eval(".pane", (els) =>
    els
      .filter((e) => getComputedStyle(e).display !== "none")
      .map((e) => (e as HTMLElement).dataset.window)
      .sort(),
  );

test("scrolling steps through the featured projects in order, one at a time", async ({
  page,
}) => {
  await ready(page, "/work/");
  for (const [i, slug] of SLUGS.entries()) {
    expect(await shown(page)).toEqual([
      `comp-${i + 1}`,
      `copy-${i + 1}`,
      "stack",
    ]);
    await expect(page).toHaveURL(
      i === 0 ? /\/work\/$/ : new RegExp(`/work/${slug}/$`),
    );
    if (i < SLUGS.length - 1) {
      await page.keyboard.press("ArrowDown");
      await settle(page);
    }
  }
  await page.keyboard.press("ArrowDown");
  await settle(page);
  expect(await shown(page)).toContain("timeline");
});

test("the copy window shows the counter, name, pitch, proof, links and facts", async ({
  page,
}) => {
  await ready(page, "/work/unmacos/");
  const copy = page.locator('[data-window="copy-2"]');
  await expect(copy.locator(".kick")).toHaveText("featured 2 / 4");
  await expect(copy.locator("h2")).toHaveText("unmacos");
  expect(
    await copy.locator("h2").evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("iA Writer Duo");
  await expect(copy.locator(".pitch")).toHaveText(
    "A keyboard-first desktop for macOS, installed with one command.",
  );
  const proof = await copy.locator(".proof li").allTextContents();
  expect(proof).toHaveLength(5);
  for (const line of proof) expect(line.endsWith(".")).toBe(false);
  const links = await copy.locator(".links a").allTextContents();
  expect(links).toEqual(["repository ↗", "live site ↗"]);
  await expect(copy.locator(".facts .version")).toHaveAttribute(
    "href",
    /github\.com\/shrujancheruku\/unmacos\//,
  );
});

test("live site appears only when the project has one", async ({ page }) => {
  await ready(page, "/work/orca-flow/");
  const links = await page
    .locator('[data-window="copy-3"] .links a')
    .allTextContents();
  expect(links).toEqual(["repository ↗"]);
});

test("the stack lists every project, marks the current, jumps on click, ends with the archive", async ({
  page,
}) => {
  await ready(page, "/work/");
  const stack = page.locator("[data-stack]");
  const items = stack.locator("a");
  await expect(items).toHaveText(SLUGS);
  await expect(stack.locator("[aria-current]")).toHaveText("issho");

  await items.nth(2).click();
  await settle(page);
  await expect(area(page)).toHaveAttribute("data-step", "3");
  await expect(stack.locator("[aria-current]")).toHaveText("orca-flow");
  await expect(page).toHaveURL(/\/work\/orca-flow\/$/);

  await expect(stack.locator("button#archive-stack")).toHaveText("+3 archive");
  // the last child is the archive line
  expect(await stack.evaluate((el) => el.lastElementChild?.id)).toBe(
    "archive-stack",
  );
});

test("only the last featured project has the archive line, inert for now", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator("#archive-more")).toHaveCount(1);
  await expect(page.locator('[data-window="copy-4"] #archive-more')).toHaveText(
    "+3 more in the archive →",
  );
  await expect(page.locator("[data-archive-open]")).toHaveCount(2);
  await ready(page, "/work/rapid-radiology/");
  await page.locator("#archive-more").click();
  await expect(area(page)).toHaveAttribute("data-step", "4");
});

test("each address is titled by the repository and described by the pitch", async ({
  page,
}) => {
  await ready(page, "/work/rapid-radiology/");
  await expect(page).toHaveTitle("rapid-radiology — Shrujan Cheruku");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /shorthand findings into a finished report/,
  );
  await expect(area(page)).toHaveAttribute("data-step", "4");
});

test("a composition slot is told when its step comes on show and goes", async ({
  page,
}) => {
  await ready(page, "/work/");
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { log: string[] }).log = log;
    for (const slot of document.querySelectorAll<HTMLElement>("[data-slot]")) {
      for (const type of ["enter", "leave"])
        slot.addEventListener(`composition:${type}`, (e) =>
          log.push(`${type} ${(e as CustomEvent).detail.repository}`),
        );
    }
  });
  await expect(page.locator('[data-composition="issho"]')).toHaveAttribute(
    "data-active",
    "true",
  );
  await page.keyboard.press("ArrowDown");
  await settle(page);
  expect(
    await page.evaluate(() => (window as unknown as { log: string[] }).log),
  ).toEqual(["leave issho", "enter unmacos"]);
  await expect(page.locator('[data-composition="issho"]')).toHaveAttribute(
    "data-active",
    "false",
  );
});

test("the composition window is the right 70%, the copy and stack the left 30%", async ({
  page,
}) => {
  await ready(page, "/work/");
  const box = async (id: string) =>
    page.locator(`[data-window="${id}"]`).boundingBox();
  const [copy, comp, stack, main] = await Promise.all([
    box("copy-1"),
    box("comp-1"),
    box("stack"),
    area(page).boundingBox(),
  ]);
  if (!copy || !comp || !stack || !main) throw new Error("missing window");
  expect(copy.width / main.width).toBeCloseTo(0.3, 1);
  expect(comp.width / main.width).toBeCloseTo(0.7, 1);
  expect(copy.y).toBeLessThan(stack.y);
});
