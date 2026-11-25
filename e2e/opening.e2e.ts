import { expect, type Page, test } from "@playwright/test";

const area = (page: Page) => page.locator("main.area");
const box = (page: Page, id: string) =>
  page.locator(`[data-window="${id}"]`).boundingBox();

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(area(page)).toHaveAttribute("data-ready", "true");
});

test("the terminal types whoami, cat claim and cat ask, with the replies in the accent", async ({
  page,
}) => {
  const term = page.locator('[data-window="term"] .term');
  // the three replies arrive after the three commands are typed
  for (const reply of [
    "product engineer",
    "I design and build.",
    "Give me a problem, not a spec.",
  ]) {
    await expect(term.locator(".reply", { hasText: reply })).toBeVisible({
      timeout: 6000,
    });
  }
  await expect(term.locator(".row")).toHaveText([
    "❯ whoami",
    "❯ cat claim",
    "❯ cat ask",
  ]);

  // compare the rendered colours with the theme tokens, resolved to rgb
  const colours = await page.evaluate(() => {
    const token = (name: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${name})`;
      document.body.append(probe);
      const rgb = getComputedStyle(probe).color;
      probe.remove();
      return rgb;
    };
    const colorOf = (sel: string) =>
      getComputedStyle(document.querySelector(`${sel}`) as Element).color;
    return {
      reply: colorOf('[data-window="term"] .reply'),
      prompt: colorOf('[data-window="term"] .row .p'),
      accent: token("--ac"),
      second: token("--hot"),
    };
  });
  expect(colours.reply).toBe(colours.accent);
  expect(colours.prompt).toBe(colours.second);
});

test("~/now is a one-line teaser; clicking it jumps to sabbatical and adds a history entry", async ({
  page,
}) => {
  const teaser = page.locator('[data-window="now"] a.teaser');
  await expect(teaser).toHaveText(/sabbatical/);
  const height = await teaser.evaluate(
    (el) => el.getBoundingClientRect().height,
  );
  expect(height).toBeLessThan(30);

  const before = await page.evaluate(() => history.length);
  await teaser.click();
  await expect(area(page)).toHaveAttribute("data-workspace", "3");
  await expect(page).toHaveURL(/\/now\/$/);
  expect(await page.evaluate(() => history.length)).toBe(before + 1);

  // Back undoes the jump: the opening is on show again at the root address
  await page.goBack();
  await expect(area(page)).toHaveAttribute("data-workspace", "0");
  await expect(page).toHaveURL(/\/$/);
});

test("the name is Duo Bold at -0.02em on two lines inside its window, and scales with it", async ({
  page,
}) => {
  const name = page.locator('[data-window="name"] h1');
  const spans = name.locator("span");
  await expect(spans).toHaveCount(2);
  const [first, second] = await spans.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect()),
  );
  // two lines: the second starts below the first
  expect(second?.top ?? 0).toBeGreaterThan(first?.top ?? 0);

  const style = await name.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      family: s.fontFamily,
      weight: s.fontWeight,
      size: Number.parseFloat(s.fontSize),
      spacing: Number.parseFloat(s.letterSpacing),
    };
  });
  expect(style.family).toContain("iA Writer Duo");
  expect(style.weight).toBe("700");
  expect(style.spacing / style.size).toBeCloseTo(-0.02, 2);

  // the name fits its window at each size, and the type grows with the window
  const sizes: number[] = [];
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(area(page)).toHaveAttribute("data-ready", "true");
    const win = await box(page, "name");
    const text = await name.boundingBox();
    expect(text && win).toBeTruthy();
    if (!text || !win) continue;
    expect(text.x + text.width).toBeLessThanOrEqual(win.x + win.width);
    expect(text.y + text.height).toBeLessThanOrEqual(win.y + win.height);
    sizes.push(
      await name.evaluate((el) =>
        Number.parseFloat(getComputedStyle(el).fontSize),
      ),
    );
  }
  expect(sizes[1]).toBeGreaterThan(sizes[0] ?? Infinity);
});

test.describe("at touch width", () => {
  test.use({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
  });

  test("the three windows stack in reading order: name, terminal, now", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(area(page)).toHaveAttribute("data-ready", "true");
    const [name, term, now] = [
      await box(page, "name"),
      await box(page, "term"),
      await box(page, "now"),
    ];
    expect(name && term && now).toBeTruthy();
    if (!name || !term || !now) return;
    expect(name.y).toBeLessThan(term.y);
    expect(term.y).toBeLessThan(now.y);
    // one column
    expect(Math.round(name.x)).toBe(Math.round(term.x));
    expect(Math.round(term.x)).toBe(Math.round(now.x));
  });
});
