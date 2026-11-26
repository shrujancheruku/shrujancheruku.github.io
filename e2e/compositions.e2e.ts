import { expect, type Page, test } from "@playwright/test";
import { ready, settle } from "./helpers";

// the session takes about 17 s and some tests play it twice
test.describe.configure({ timeout: 90_000 });

const slot = (page: Page) => page.locator('[data-composition="orca-flow"]');
/** The session takes about 17 s; allow for a busy machine. */
const HELD = { timeout: 45_000 };

test("a composition is not part of the first load: it is asked for after the page has loaded", async ({
  page,
}) => {
  const asked: { url: string; afterLoad: boolean }[] = [];
  let loaded = false;
  page.on("load", () => {
    loaded = true;
  });
  page.on("request", (r) => {
    if (/\/_astro\/(orca-flow|kit)\./.test(r.url()))
      asked.push({ url: r.url(), afterLoad: loaded });
  });
  // /about/ is next to the projects workspace, so it is the first to preload
  await ready(page, "/about/");
  // the test is about order, not speed: a busy machine may take a while
  await expect(slot(page)).toHaveAttribute("data-mounted", "true", {
    timeout: 20_000,
  });
  expect(asked.length).toBeGreaterThanOrEqual(2);
  for (const r of asked) expect(r.afterLoad).toBe(true);
});

test("a composition next to the current workspace still preloads when the page never goes idle", async ({
  page,
}) => {
  // a main thread too busy to go idle: idle callbacks fire only at their timeout
  await page.addInitScript(() => {
    window.requestIdleCallback = ((
      cb: IdleRequestCallback,
      o?: IdleRequestOptions,
    ) =>
      o?.timeout
        ? window.setTimeout(
            () => cb({ didTimeout: true, timeRemaining: () => 0 }),
            o.timeout,
          )
        : 0) as typeof window.requestIdleCallback;
  });
  await ready(page, "/about/");
  await expect(slot(page)).toHaveAttribute("data-mounted", "true", {
    timeout: 10_000,
  });
});

test("compositions are not loaded while the projects workspace is far off, and are when it gets close", async ({
  page,
}) => {
  const asked: string[] = [];
  page.on("request", (r) => {
    if (/\/_astro\/orca-flow\./.test(r.url())) asked.push(r.url());
  });
  await ready(page, "/contact/");
  await page.waitForTimeout(1500);
  expect(asked).toEqual([]);
  await page.keyboard.press("5"); // sabbatical: still two away
  await settle(page);
  await page.waitForTimeout(500);
  expect(asked).toEqual([]);
  await page.keyboard.press("4"); // timeline: next to projects
  await expect(slot(page)).toHaveAttribute("data-mounted", "true");
  expect(asked).toHaveLength(1);
});

test("orca-flow plays the session and holds its end state", async ({
  page,
}) => {
  await ready(page, "/work/orca-flow/");
  const scene = slot(page).locator(".scene");
  await expect(slot(page)).toHaveAttribute("data-state", "playing");
  // the command is typed first
  await expect(
    scene.locator("b", { hasText: "/flow:build #42" }),
  ).toBeVisible();
  await expect(slot(page)).toHaveAttribute("data-state", "held", HELD);

  await expect(scene.locator(".row")).toHaveCount(9);
  const statuses = await scene.locator(".row .st").allTextContents();
  expect(statuses).toEqual(Array(9).fill("merged ✓"));
  await expect(scene.locator(".pr")).toContainText("9/9 merged");
  await expect(scene.locator(".pr")).toContainText("✓ PR #53 ready to merge");
  await expect(scene.locator(".pr")).toContainText(
    "closes 9 tickets · reviewed · checks green · up to date with main",
  );
  await expect(scene.locator(".clock")).toHaveText("38m 12s");
  await expect(scene).toContainText(
    "Sized nine tickets: 4 small, 4 medium, 1 large.",
  );
  await expect(scene).toContainText(
    "#51 touches the deploy workflow, so it goes to Opus.",
  );
  await expect(scene).toContainText(
    "Answered: the archive opens from the projects workspace.",
  );
  // the answered line replaces the question and its typed answer
  await expect(scene).not.toContainText("Question from the coordinator");
  await expect(scene).not.toContainText("1 projects workspace");
  // it holds: nothing changes afterwards
  const before = await scene.textContent();
  await page.waitForTimeout(1500);
  expect(await scene.textContent()).toBe(before);
});

test("the coordinator's message arrives a word at a time, the question is asked once, and a ticket waits on you", async ({
  page,
}) => {
  await ready(page, "/work/orca-flow/");
  const scene = slot(page).locator(".scene");
  const message = scene.locator(".stream").first();
  const lengths = new Set<number>();
  for (let i = 0; i < 40 && lengths.size < 4; i++) {
    lengths.add((await message.textContent())?.length ?? 0);
    await page.waitForTimeout(100);
  }
  expect(lengths.size).toBeGreaterThanOrEqual(3);
  await expect(scene.locator('.row[data-ticket="50"]')).toContainText(
    "waiting on you",
    { timeout: 30_000 },
  );
  await expect(scene).toContainText("Question from the coordinator");
  await expect(scene.getByText("Question from the coordinator")).toHaveCount(1);
});

test("a ticket's row flashes as it merges", async ({ page }) => {
  await ready(page, "/work/orca-flow/");
  const flashed = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const rows = document.querySelector(".scene .tickets");
        const done = (v: boolean) => {
          obs.disconnect();
          resolve(v);
        };
        const obs = new MutationObserver(() => {
          if (rows?.querySelector(".row.merged.flash")) done(true);
        });
        if (rows)
          obs.observe(rows, {
            subtree: true,
            attributes: true,
            attributeFilter: ["class"],
          });
        setTimeout(() => done(false), 30_000);
      }),
  );
  expect(flashed).toBe(true);
});

test("it restarts from its beginning each time its project is scrolled to, and stops when left", async ({
  page,
}) => {
  await ready(page, "/work/orca-flow/");
  await expect(slot(page)).toHaveAttribute("data-state", "held", HELD);
  await page.keyboard.press("ArrowDown");
  await settle(page);
  await expect(slot(page)).toHaveAttribute("data-state", "idle");
  await page.keyboard.press("ArrowUp");
  await settle(page);
  const scene = slot(page).locator(".scene");
  await expect(slot(page)).toHaveAttribute("data-state", "playing");
  await expect(scene.locator(".pr")).toContainText("0/9 merged");
  await expect(scene.locator(".row.queued")).toHaveCount(9);
  await expect(slot(page)).toHaveAttribute("data-state", "held", HELD);
  await expect(scene.locator(".pr")).toContainText("9/9 merged");
});

test("it stops drawing while the tab is hidden and carries on afterwards", async ({
  page,
}) => {
  await ready(page, "/work/orca-flow/");
  const hide = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, "hidden", {
        value: h,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
  await page.waitForTimeout(800);
  await hide(true);
  await expect(slot(page)).toHaveAttribute("data-state", "paused");
  const frozen = await slot(page).textContent();
  await page.waitForTimeout(2500);
  expect(await slot(page).textContent()).toBe(frozen);
  await hide(false);
  await expect(slot(page)).toHaveAttribute("data-state", "playing");
  await expect(slot(page)).toHaveAttribute("data-state", "held", HELD);
});

test("it follows the site theme live", async ({ page }) => {
  await ready(page, "/work/orca-flow/");
  const pane = slot(page).locator(".scene .tickets");
  const bg = () => pane.evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "paper";
  });
  await expect.poll(bg).toBe("rgb(242, 238, 222)");
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "tokyo-night";
  });
  await expect.poll(bg).toBe("rgb(26, 27, 38)");
});

test("a named still frame can be shown instead: the end state, for share cards", async ({
  page,
}) => {
  await ready(page, "/work/orca-flow/");
  await slot(page).evaluate((el) => {
    el.dataset.frame = "end";
  });
  await expect(slot(page)).toHaveAttribute("data-state", "frame");
  const scene = slot(page).locator(".scene");
  expect(await scene.locator(".row .st").allTextContents()).toEqual(
    Array(9).fill("merged ✓"),
  );
  await expect(scene.locator(".pr")).toContainText("9/9 merged");
  await expect(scene.locator(".pr")).toContainText("✓ PR #53 ready to merge");
  await expect(scene.locator(".clock")).toHaveText("38m 12s");
  await expect(scene).toContainText(
    "Answered: the archive opens from the projects workspace.",
  );
  // the answered line replaces the question and its typed answer
  await expect(scene).not.toContainText("Question from the coordinator");
  await expect(scene).not.toContainText("1 projects workspace");
  await expect(scene.locator(".pr")).toHaveClass(/focus/);
  // taking the frame away plays it again from the start
  await slot(page).evaluate((el) => {
    delete el.dataset.frame;
  });
  await expect(slot(page)).toHaveAttribute("data-state", "playing");
});

test("orca-flow does not flash large areas, so reduced motion still plays it", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, "/work/orca-flow/");
  await expect(slot(page)).toHaveAttribute("data-state", "playing");
});

test("the scene unit sets text at about 13px in a desktop window", async ({
  page,
}) => {
  await ready(page, "/work/orca-flow/");
  const size = await slot(page)
    .locator(".scene")
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThan(12.4);
  expect(size).toBeLessThan(13.6);
});

test("the panes are gapped and carry the site's window border; the active one has the accent", async ({
  page,
}) => {
  await ready(page, "/work/orca-flow/");
  const scene = slot(page).locator(".scene");
  await expect(scene.locator(".pn")).toHaveCount(3);
  const border = await scene
    .locator(".pn")
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.borderTopWidth, radius: s.borderTopLeftRadius };
    });
  expect(border).toEqual({ width: "2px", radius: "14px" });
  await expect(scene.locator(".pn.focus")).toHaveCount(1);
  const boxes = await scene
    .locator(".pn")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
  // no two panes touch
  for (const [i, a] of boxes.entries())
    for (const b of boxes.slice(i + 1)) {
      const apartX = a.right <= b.left - 8 || b.right <= a.left - 8;
      const apartY = a.bottom <= b.top - 8 || b.bottom <= a.top - 8;
      expect(apartX || apartY).toBe(true);
    }
});
