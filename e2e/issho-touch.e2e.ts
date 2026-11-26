import { devices, expect, type Page, test } from "@playwright/test";
import { toComposition } from "./helpers";

test.use({ ...devices["Pixel 7"] });
test.describe.configure({ timeout: 90_000 });

const slot = (page: Page) => page.locator('[data-composition="issho"]');
const scene = (page: Page) => slot(page).locator(".scene");

test("on touch the site fills the window as text only, with the phone in front carrying the header and the card", async ({
  page,
}) => {
  await page.goto("/work/issho/");
  await toComposition(page);
  await expect(page.locator("main.area")).toHaveAttribute("data-ready", "true");
  await expect(slot(page)).toHaveAttribute("data-mounted", "true");
  const sc = scene(page);
  const box = await sc.boundingBox();
  const site = await sc.locator(".pn.site").boundingBox();
  const phone = await sc.locator(".pn.app").boundingBox();
  expect(box && site && phone).toBeTruthy();
  if (box && site && phone) {
    // the site fills the window
    expect(site.width).toBeGreaterThan(box.width - 4);
    expect(site.height).toBeGreaterThan(box.height - 4);
    // the phone is in front of it, bottom right, and well under the window's size
    expect(phone.x + phone.width / 2).toBeGreaterThan(box.x + box.width / 2);
    expect(phone.y + phone.height / 2).toBeGreaterThan(box.y + box.height / 2);
    expect(phone.width).toBeLessThan(box.width * 0.6);
    // the bezel may run off the bottom, as in the prototype, but the phone's
    // header and, once the run holds, its card stay in view
    await expect(slot(page)).toHaveAttribute("data-state", "held", {
      timeout: 50_000,
    });
    for (const part of [".app .apphd", ".app .scrn.on .c"]) {
      const b = await sc.locator(part).first().boundingBox();
      expect(b, part).toBeTruthy();
      if (!b) continue;
      expect(b.x + b.width, part).toBeLessThanOrEqual(box.x + box.width + 1);
      expect(b.y + b.height, part).toBeLessThanOrEqual(box.y + box.height + 1);
    }
    // the hero's paragraph does not run under the phone
    const hero = await sc.locator(".site .hero p").first().boundingBox();
    expect(hero).toBeTruthy();
    if (hero)
      expect(
        hero.x + hero.width <= phone.x || hero.y + hero.height <= phone.y,
      ).toBe(true);
  }
  // text only on the site: no card; the phone has the header and the card
  await expect(sc.locator(".site .c").first()).toBeHidden();
  await expect(sc.locator(".app .apphd svg.logo")).toBeVisible();
  await expect(sc.locator(".app .scrn.on .c")).toBeVisible();
  // the site still shows its logo
  await expect(sc.locator(".site svg.logo")).toBeVisible();
  // the launch cities are not shown
  await expect(sc.locator(".cities")).toBeHidden();
});

test("the scene unit sets text at about 11px on touch", async ({ page }) => {
  await page.goto("/work/issho/");
  await toComposition(page);
  await expect(slot(page)).toHaveAttribute("data-mounted", "true");
  const size = await scene(page).evaluate((el) =>
    Number.parseFloat(getComputedStyle(el).fontSize),
  );
  expect(size).toBeGreaterThan(10.2);
  expect(size).toBeLessThan(11.6);
});

test("on touch the site's text does not overflow sideways and the phone stays in view as the site steps", async ({
  page,
}) => {
  await page.goto("/work/issho/");
  await toComposition(page);
  await expect(slot(page)).toHaveAttribute("data-state", "held", {
    timeout: 50_000,
  });
  const over = await scene(page).evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>(".site .sec > div, .site h1")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent),
  );
  expect(over).toEqual([]);
});

for (const [name, viewport] of [
  ["375x667", { width: 375, height: 667 }],
  ["Pixel 7", devices["Pixel 7"].viewport],
] as const)
  test(`on a ${name} phone every card of the app fits its screen with room to spare`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/work/issho/");
    await toComposition(page);
    await expect(slot(page)).toHaveAttribute("data-mounted", "true");
    // each card in turn, measured against the screen's box inside its padding:
    // a card taller than that runs under the header and off the phone (#83)
    const over = await scene(page).evaluate((root) => {
      root.classList.add("still");
      return [...root.querySelectorAll<HTMLElement>(".app .scrn")].flatMap(
        (s) => {
          const was = s.classList.contains("on");
          s.classList.add("on");
          const pad = Number.parseFloat(getComputedStyle(s).paddingTop);
          const room = s.clientHeight - 2 * pad;
          const card = s.querySelector<HTMLElement>(".c")?.offsetHeight ?? 0;
          s.classList.toggle("on", was);
          // a margin, so another machine's font metrics still fit
          return card > room - 8
            ? [`screen ${s.dataset.step}: ${card}>${room - 8}`]
            : [];
        },
      );
    });
    expect(over).toEqual([]);
  });
