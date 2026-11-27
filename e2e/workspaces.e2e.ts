import { expect, test } from "@playwright/test";
import {
  goTo,
  modelOf,
  notchesInOneGo,
  ready,
  settle,
  shown,
  stepNow,
  workspaceOf,
} from "./desktop";
import { flick, framesOf } from "./helpers";

const NAMES = [
  "opening",
  "timeline",
  "projects",
  "about",
  "sabbatical",
  "contact",
];

test.beforeEach(async ({ page }) => {
  await ready(page, "/");
});

test("boots on the opening workspace with its three windows", async ({
  page,
}) => {
  expect(await stepNow(page)).toBe(0);
  expect(await workspaceOf(page)).toBe("opening");
  expect(await shown(page)).toEqual(["name", "now", "term"]);
});

test("wheel scrolling moves one step at a time through all six workspaces", async ({
  page,
}) => {
  // sixteen settles alone are 17.6 s
  test.setTimeout(60_000);
  // over the status bar, not the timeline window, which scrolls its own
  // content first: how far a flick's tail scrolled it would decide the next
  const bar = await page.locator("header.bar").boundingBox();
  const over = { x: 640, y: (bar?.y ?? 0) + (bar?.height ?? 0) / 2 };
  const seen: string[] = [];
  for (let i = 0; i < 4 + 5; i++) {
    await flick(page, over);
    await settle(page);
    seen.push(await workspaceOf(page));
  }
  // 4 featured projects + 5 other workspaces = 9 steps; the last flick has nowhere to go
  expect(seen).toEqual([
    "timeline",
    "projects",
    "projects",
    "projects",
    "projects",
    "about",
    "sabbatical",
    "contact",
    "contact",
  ]);

  await page.mouse.move(over.x, over.y);
  for (let i = 0; i < 9; i++) {
    await page.mouse.wheel(0, -120);
    await settle(page);
  }
  expect(await stepNow(page)).toBe(0);
  expect(await workspaceOf(page)).toBe("opening");
});

test("mouse notches that come during a re-tile end as one step, the latest", async ({
  page,
}) => {
  // three notches down, each its own gesture (equal, 200 ms apart), sent in
  // one go so that the second and third surely come while the first one's
  // motion runs, whatever the machine: they are stamped as a mouse would
  const during = await notchesInOneGo(page, 3, 200);
  // the first steps; the others wait, and the wheel steps no more until it settles
  expect(during).toEqual(["1:true", "1:true", "1:true"]);
  await settle(page);
  // the waiting notch ran from rest: one step, not two
  expect(await stepNow(page)).toBe(2);
});

test("keyboard scrolling moves one step at a time", async ({ page }) => {
  const steps: number[] = [];
  for (const key of ["ArrowDown", "PageDown", "Space", "ArrowUp", "PageUp"]) {
    await page.keyboard.press(key);
    await settle(page);
    steps.push(await stepNow(page));
  }
  expect(steps).toEqual([1, 2, 3, 2, 1]);
});

test("Space after clicking a status bar number moves one step", async ({
  page,
}) => {
  await goTo(page, "projects", "click");
  await settle(page);
  const before = await stepNow(page);
  await page.keyboard.press("Space");
  await settle(page);
  expect(await stepNow(page)).toBe(before + 1);
});

test("number keys jump to a workspace, and are ignored with a modifier held", async ({
  page,
}) => {
  for (const [key, ws] of [
    ["3", "projects"],
    ["6", "contact"],
    ["1", "opening"],
    ["5", "sabbatical"],
    ["2", "timeline"],
    ["4", "about"],
  ] as const) {
    await page.keyboard.press(key);
    await settle(page);
    expect(await workspaceOf(page)).toBe(ws);
  }
  await page.keyboard.press("Meta+5");
  await page.keyboard.press("Control+6");
  await page.keyboard.press("Alt+3");
  await settle(page);
  expect(await workspaceOf(page)).toBe("about");
});

test("each workspace shows exactly its windows", async ({ page }) => {
  const model = await modelOf(page);
  let step = 0;
  for (const w of model) {
    for (const s of w.steps) {
      // the projects' steps are one scroll apart; the others are a jump
      if (w.id === "projects") await page.keyboard.press("ArrowDown");
      else await goTo(page, w.id);
      await settle(page);
      expect(await shown(page)).toEqual(Object.keys(s.desktop).sort());
      await expect(page.locator(`[data-window="${s.focus}"]`)).toHaveClass(
        /focus/,
      );
      step++;
    }
  }
  expect(step).toBe(9);
});

test("the status bar lists the numbers with names and marks the current workspace", async ({
  page,
}) => {
  const buttons = page.locator(".ws button");
  await expect(buttons).toHaveCount(6);
  for (const [i, name] of NAMES.entries()) {
    await expect(buttons.nth(i)).toContainText(`${i + 1} ${name}`);
  }
  await expect(buttons.nth(0)).toHaveAttribute("aria-current", "true");
  await buttons.nth(4).click();
  await settle(page);
  expect(await workspaceOf(page)).toBe("sabbatical");
  await expect(buttons.nth(4)).toHaveAttribute("aria-current", "true");
  await expect(buttons.nth(0)).not.toHaveAttribute("aria-current", "true");
});

test("windows animate between tilings, not cut", async ({ page }) => {
  // the name travels with its workspace: it comes up from below onto its tile
  const frames = await framesOf(page, '[data-window="name"]', "top", () =>
    goTo(page, "contact"),
  );
  const tops = frames.map(([t]) => t ?? 0);
  const after = tops[tops.length - 1] ?? 0;
  const start = Math.max(...tops);
  expect(start).toBeGreaterThan(after + 1);
  // it passes through the places between, frame by frame
  expect(tops.some((t) => t > after + 1 && t < start - 1)).toBe(true);
});

test("windows have the decided gap, border, radius and focus gradient", async ({
  page,
}) => {
  const win = page.locator('[data-window="name"] .win');
  const pane = page.locator('[data-window="name"]');
  expect(await win.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe(
    "2px",
  );
  expect(
    await win.evaluate((e) => getComputedStyle(e).borderTopLeftRadius),
  ).toBe("14px");
  // 14px gaps: 7px of padding on each pane, 7px of margin on the area
  expect(await pane.evaluate((e) => getComputedStyle(e).paddingLeft)).toBe(
    "7px",
  );
  // the focused window's border is a gradient; the unfocused one is flat
  expect(
    await win.evaluate((e) => getComputedStyle(e).backgroundImage),
  ).toContain("linear-gradient");
  const other = page.locator('[data-window="term"] .win');
  expect(await other.evaluate((e) => getComputedStyle(e).backgroundImage)).toBe(
    "none",
  );
});

test("a scrolling window's label sits on an opaque band", async ({ page }) => {
  await goTo(page, "timeline");
  await settle(page);
  const band = page.locator('[data-window="timeline"] .label');
  expect(
    await band.evaluate((e) => getComputedStyle(e).backgroundColor),
  ).not.toBe("rgba(0, 0, 0, 0)");
  expect(await band.evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
  // and the label stays hidden where nothing scrolls under it (project copy)
  await expect(page.locator('[data-window="copy-1"] .label')).toHaveCount(0);
});

test("the production build ships all six workspaces from one model with steps inside", async ({
  page,
}) => {
  const model = await modelOf(page);
  expect(model.map((w) => w.id)).toEqual([
    "opening",
    "timeline",
    "projects",
    "about",
    "sabbatical",
    "contact",
  ]);
  expect(model[2]?.steps.length).toBe(4);
});
