import { expect, type Page, test } from "@playwright/test";
import { ready as boot } from "./helpers";

// the play-through takes about 24 s and some tests play it twice
test.describe.configure({ timeout: 90_000 });

const slot = (page: Page) => page.locator('[data-composition="issho"]');
const scene = (page: Page) => slot(page).locator(".scene");
const ready = (page: Page, path = "/work/issho/") => boot(page, path);
/** The play-through takes about 24 s; allow for a busy machine. */
const HELD = { timeout: 50_000 };

test("three gapped panes carry the site's window border; the site has the accent", async ({
  page,
}) => {
  await ready(page);
  await expect(slot(page)).toHaveAttribute("data-mounted", "true");
  await expect(scene(page).locator(".pn")).toHaveCount(3);
  const border = await scene(page)
    .locator(".pn")
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.borderTopWidth, radius: s.borderTopLeftRadius };
    });
  expect(border).toEqual({ width: "2px", radius: "14px" });
  await expect(scene(page).locator(".pn.focus")).toHaveCount(1);
  await expect(scene(page).locator(".pn.focus")).toHaveClass(/site/);
  const boxes = await scene(page)
    .locator(".pn")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
  for (const [i, a] of boxes.entries())
    for (const b of boxes.slice(i + 1)) {
      const apartX = a.right <= b.left - 8 || b.right <= a.left - 8;
      const apartY = a.bottom <= b.top - 8 || b.bottom <= a.top - 8;
      expect(apartX || apartY).toBe(true);
    }
  // the site on the left, the app above the cities on the right
  const [site, app, cities] = boxes;
  expect(site && app && cities).toBeTruthy();
  if (site && app && cities) {
    expect(site.right).toBeLessThan(app.left);
    expect(app.bottom).toBeLessThan(cities.top);
    expect(app.left).toBeCloseTo(cities.left, 0);
  }
});

test("the site steps through its six parts while the app shows the step three ahead, and each card draws as it arrives", async ({
  page,
}) => {
  await ready(page);
  // record every (site step, app step) pair the page passes through, and
  // whether the app's screen was animating when it came on
  await page.evaluate(() => {
    const w = window as unknown as { __pairs: string[]; __anim: number[] };
    w.__pairs = [];
    w.__anim = [];
    const sc = document.querySelector('[data-composition="issho"] .scene');
    const read = () => {
      const site = sc?.querySelector(".sec.at");
      const on = sc?.querySelector<HTMLElement>(".scrn.on");
      const s = site
        ? [...(site.parentElement?.children ?? [])]
            .filter((c) => c.classList.contains("sec"))
            .indexOf(site)
        : -1;
      const a = on ? Number(on.dataset.step) : -1;
      const pair = `${s}:${a}`;
      if (w.__pairs[w.__pairs.length - 1] !== pair) {
        w.__pairs.push(pair);
        w.__anim.push(on ? on.getAnimations({ subtree: true }).length : 0);
      }
    };
    if (sc)
      new MutationObserver(read).observe(sc, {
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    read();
  });
  await expect(slot(page)).toHaveAttribute("data-state", "held", HELD);
  const { pairs, anim } = await page.evaluate(() => {
    const w = window as unknown as { __pairs: string[]; __anim: number[] };
    return { pairs: w.__pairs, anim: w.__anim };
  });
  // the top of the site shows the day screen; then step k beside k + 3
  expect(pairs).toEqual(["-1:3", "0:3", "1:4", "2:5", "3:0", "4:1", "5:2"]);
  // each screen starts animating as it arrives
  for (const n of anim.slice(1)) expect(n).toBeGreaterThan(0);
});

test("the launch cities pane lists the four cities with their dots on the left", async ({
  page,
}) => {
  await ready(page);
  const pane = scene(page).locator(".cities");
  const rows = pane.locator(".city");
  await expect(rows).toHaveCount(4);
  expect(await rows.allTextContents()).toEqual([
    "Tokyolaunched",
    "Da Nang / Hoi Anlaunched",
    "Londonup next",
    "Mumbaiplanned",
  ]);
  await expect(rows.nth(0)).toHaveClass(/launched/);
  await expect(rows.nth(1)).toHaveClass(/launched/);
  await expect(rows.nth(2)).toHaveClass(/next/);
  await expect(rows.nth(3)).toHaveClass(/planned/);
  for (const row of await rows.all()) {
    const dot = await row.locator("i").boundingBox();
    const name = await row.locator("b").boundingBox();
    const state = await row.locator("span").boundingBox();
    expect(dot && name && state).toBeTruthy();
    if (dot && name && state) {
      expect(dot.x + dot.width).toBeLessThanOrEqual(name.x);
      expect(name.x + name.width).toBeLessThanOrEqual(state.x);
    }
  }
  // launched: a filled dot; up next: a ring; planned: dimmed
  const bg = (n: number) =>
    rows
      .nth(n)
      .locator("i")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await bg(0)).toBe(await bg(1));
  expect(await bg(0)).not.toBe("rgba(0, 0, 0, 0)");
  expect(await bg(2)).toBe("rgba(0, 0, 0, 0)");
  const opacity = (n: number) =>
    rows.nth(n).evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(await opacity(3)).toBeLessThan(1);
  expect(await opacity(0)).toBe(1);
});

test("the logo is at the top of the drawn site and in the app header, in the theme's colours", async ({
  page,
}) => {
  await ready(page);
  const sc = scene(page);
  await expect(sc.locator("svg.logo")).toHaveCount(2);
  const inSite = sc.locator(".site svg.logo");
  const inHeader = sc.locator(".apphd svg.logo");
  await expect(inSite).toHaveCount(1);
  await expect(inHeader).toHaveCount(1);
  await expect(inSite).toBeVisible();
  await expect(inHeader).toBeVisible();
  // the logo is above the opening line
  const logo = await inSite.boundingBox();
  const hero = await sc.locator(".site h1").boundingBox();
  expect(logo && hero && logo.y < hero.y).toBe(true);
  // the header holds the logo at left and a profile dot at right
  const head = await sc.locator(".apphd").boundingBox();
  const dot = await sc.locator(".apphd i").boundingBox();
  expect(head && dot && logo).toBeTruthy();
  const inHeaderBox = await inHeader.boundingBox();
  if (head && dot && inHeaderBox) {
    expect(inHeaderBox.x).toBeLessThan(head.x + head.width / 2);
    expect(dot.x).toBeGreaterThan(head.x + head.width / 2);
  }
  // it takes the theme's colours: navy to the foreground, gold to the
  // accent, the sun to the second colour; outlines in the background colour
  for (const theme of ["paper", "tokyo-night", "issho-light", "issho-dark"]) {
    // the colours ease over .45 s: switch, then wait for every CSS transition
    // to finish (not the looping animations, which never do), however slowly
    // a busy machine draws its frames; a fixed 700 ms sleep, then a 5 s poll,
    // both read them part way
    await page.evaluate(async (t) => {
      document.documentElement.dataset.theme = t;
      await Promise.all(
        document
          .getAnimations()
          .filter((a) => a instanceof CSSTransition)
          .map((a) => a.finished.catch(() => {})),
      );
    }, theme);
    const colours = () =>
      page.evaluate(() => {
        const named = (v: string) => {
          const el = document.createElement("i");
          el.style.color = `var(--${v})`;
          document.body.append(el);
          const c = getComputedStyle(el).color;
          el.remove();
          return c;
        };
        const logoEl = document.querySelector(
          '[data-composition="issho"] .site svg.logo',
        );
        const fill = (hex: string) => {
          const p = logoEl?.querySelector(`[fill="${hex}"]`);
          return p ? getComputedStyle(p).fill : null;
        };
        const stroke = (hex: string) => {
          const p = logoEl?.querySelector(`[stroke="${hex}"]`);
          return p ? getComputedStyle(p).stroke : null;
        };
        const pairs = {
          navy: [fill("#131B40"), named("fg")],
          gold: [fill("#DEA92C"), named("ac")],
          sun: [fill("#DA4528"), named("hot")],
          outline: [stroke("#131B40"), named("bg")],
        };
        return Object.entries(pairs)
          .filter(([, [got, want]]) => got !== want)
          .map(([what, [got, want]]) => `${what}: ${got}, want ${want}`);
      });
    await expect
      .poll(colours, { message: `colours on ${theme}`, timeout: 15_000 })
      .toEqual([]);
  }
});

test("no capture, screenshot or image file is used", async ({ page }) => {
  const images: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "image") images.push(r.url());
  });
  await ready(page);
  await expect(slot(page)).toHaveAttribute("data-mounted", "true");
  const bad = await scene(page).evaluate((root) => {
    const tags = root.querySelectorAll("img, picture, canvas, video, image");
    const withUrl = [...root.querySelectorAll("*")].filter((el) =>
      getComputedStyle(el).backgroundImage.includes("url("),
    );
    return { tags: tags.length, withUrl: withUrl.length };
  });
  expect(bad).toEqual({ tags: 0, withUrl: 0 });
  expect(images.filter((u) => /issho/i.test(u))).toEqual([]);
});

test("it follows the site theme live", async ({ page }) => {
  await ready(page);
  const pane = scene(page).locator(".cities");
  const bg = () => pane.evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "paper";
  });
  // the background eases over .45 s: poll till it lands, not a fixed sleep
  await expect.poll(bg).toBe("rgb(242, 238, 222)");
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "tokyo-night";
  });
  await expect.poll(bg).toBe("rgb(26, 27, 38)");
});

test("the availability screen reads 'The stronger the colour, the more people are free.'", async ({
  page,
}) => {
  await ready(page);
  await expect(scene(page).locator('.scrn[data-step="1"]')).toContainText(
    "The stronger the colour, the more people are free.",
  );
  await expect(scene(page)).not.toContainText("darker");
});

test("it plays from its beginning on each visit, holds the last step, and stops when left", async ({
  page,
}) => {
  await ready(page);
  await expect(slot(page)).toHaveAttribute("data-state", "playing");
  await expect(slot(page)).toHaveAttribute("data-state", "held", HELD);
  await expect(scene(page).locator(".sec.at")).toHaveCount(1);
  // it holds: nothing changes afterwards
  const before = await scene(page).innerHTML();
  await page.waitForTimeout(1500);
  expect(await scene(page).innerHTML()).toBe(before);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(1100);
  await expect(slot(page)).toHaveAttribute("data-state", "idle");
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(1100);
  await expect(slot(page)).toHaveAttribute("data-state", "playing");
  // back at the top of the site with the day screen
  await expect(scene(page).locator(".sec.at")).toHaveCount(0);
  await expect(scene(page).locator(".scrn.on")).toHaveAttribute(
    "data-step",
    "3",
  );
});

test("its still frame is the top of the site with the day screen", async ({
  page,
}) => {
  await ready(page);
  await expect(slot(page)).toHaveAttribute("data-state", "playing");
  // move on a little first: the frame must set the whole scene
  await page.waitForTimeout(6500);
  await slot(page).evaluate((el) => {
    el.dataset.frame = "top";
  });
  await expect(slot(page)).toHaveAttribute("data-state", "frame");
  await expect(slot(page)).toHaveAttribute("data-shown-frame", "top");
  const sc = scene(page);
  await expect(sc.locator(".sec.at")).toHaveCount(0);
  await expect(sc.locator(".scrn.on")).toHaveCount(1);
  await expect(sc.locator(".scrn.on")).toHaveAttribute("data-step", "3");
  expect(
    await sc
      .locator(".site .pg")
      .evaluate((el) => getComputedStyle(el).transform),
  ).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  // nothing is mid-animation in the frame
  const animating = await sc.evaluate(
    (el) => el.getAnimations({ subtree: true }).length,
  );
  expect(animating).toBe(0);
  // taking the frame away plays it again from the start
  await slot(page).evaluate((el) => {
    delete el.dataset.frame;
  });
  await expect(slot(page)).toHaveAttribute("data-state", "playing");
});

test("issho does not flash large areas, so reduced motion still plays it", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await expect(slot(page)).toHaveAttribute("data-state", "playing");
});

test("the scene unit sets text at about 13px in a desktop window", async ({
  page,
}) => {
  await ready(page);
  const size = await scene(page).evaluate((el) =>
    Number.parseFloat(getComputedStyle(el).fontSize),
  );
  expect(size).toBeGreaterThan(12.4);
  expect(size).toBeLessThan(13.6);
});
