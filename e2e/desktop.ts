// The desktop under test: how an e2e test reads and drives the desktop, so a
// spec keeps only what it asserts. Gestures (flick, swipe, pinch, framesOf)
// live in helpers.ts, which builds on this.
//
// The desktop is read only through what the page already shows:
//   - `main.area`'s data-* attributes (step, screen, screens, workspace, open,
//     retiling, ready), which only this module selects;
//   - the windows' `display`;
//   - the #desktop-model and #desktop-addresses JSON.
// Nothing here needs a hook in production code.
import {
  type BrowserContextOptions,
  devices,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";

const AREA = "main.area";

const area = (page: Page): Locator => page.locator(AREA);

// ------------------------------------------------------------- in the page

/**
 * Where the desktop is, as read inside the page on one frame. For a recorder
 * that runs in the page (sampling every frame, or acting on the frame a motion
 * starts), which cannot call this module: it calls `desktopNow()` instead.
 */
export interface DesktopNow {
  /** The desktop has booted. */
  ready: boolean;
  /** A re-tile (a step's or a workspace's motion, or the first appearance) runs. */
  retiling: boolean;
  /** The global step on show. */
  step: number;
  /** The tiling area's box in the viewport. */
  box: DOMRect;
  /** The tiling area's inline `overflow` (its clip while windows move). */
  overflow: string;
}

/**
 * Give the page `desktopNow()`, on this document and on every one loaded
 * after. Call it before a recorder that uses it is sent to the page.
 */
export async function probe(page: Page): Promise<void> {
  const install = (areaSel: string) => {
    (window as unknown as { desktopNow: () => DesktopNow | null }).desktopNow =
      () => {
        const a = document.querySelector<HTMLElement>(areaSel);
        if (!a) return null;
        return {
          ready: a.dataset.ready === "true",
          retiling: a.dataset.retiling === "true",
          step: Number(a.dataset.step),
          box: a.getBoundingClientRect(),
          overflow: a.style.overflow,
        };
      };
  };
  await page.addInitScript(install, AREA);
  await page.evaluate(install, AREA);
}

/**
 * `desktopNow()` as a recorder sent to the page sees it (see `probe`):
 * `(window as unknown as InPage).desktopNow()`.
 */
export interface InPage {
  desktopNow: () => DesktopNow | null;
}

// ---------------------------------------------------------------- phones

/**
 * A Playwright device as a phone's options: its size, touch and agent, not its
 * engine. The CDP touch and pinch the specs drive need Chromium, so a WebKit
 * `defaultBrowserType` must not reach `test.use` or `newContext`.
 */
export function emulate(name: keyof typeof devices): BrowserContextOptions {
  const device = devices[name];
  if (!device) throw new Error(`no Playwright device "${name}"`);
  const { defaultBrowserType: _engine, ...options } = device;
  return options;
}

/** The phones the site is held to: two real devices, and the smallest screen it supports. */
export const PHONES = {
  "Pixel 7": emulate("Pixel 7"),
  "iPhone 14": emulate("iPhone 14"),
  "375x667": {
    viewport: { width: 375, height: 667 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  },
} as const satisfies Record<string, BrowserContextOptions>;

export type PhoneName = keyof typeof PHONES;

/** A phone's screen size. */
export function viewportOf(name: PhoneName) {
  const { viewport } = PHONES[name];
  if (!viewport) throw new Error(`phone "${name}" has no viewport`);
  return viewport;
}

/** Some of the phones, by name, as [name, options] pairs: `for (const [name, phone] of phones("Pixel 7"))`. */
export const phones = (...names: PhoneName[]) =>
  names.map((name) => [name, PHONES[name]] as const);

/** Every phone, as [name, options] pairs. */
export const allPhones = () => phones(...(Object.keys(PHONES) as PhoneName[]));

// ------------------------------------------------------------ the story

export type WorkspaceId =
  | "opening"
  | "timeline"
  | "projects"
  | "about"
  | "sabbatical"
  | "contact";

/** A step of the model: the window with focus, and the windows on show with their tiles. */
export interface ModelStep {
  focus: string;
  desktop: Record<string, unknown>;
}

export interface ModelWorkspace {
  id: WorkspaceId;
  name: string;
  steps: ModelStep[];
}

/** The workspaces in the story's order, from #desktop-model. */
export const modelOf = (page: Page): Promise<ModelWorkspace[]> =>
  page.evaluate(
    () =>
      JSON.parse(
        document.getElementById("desktop-model")?.textContent ?? "[]",
      ) as ModelWorkspace[],
  );

const indexOf = async (page: Page, id: WorkspaceId): Promise<number> => {
  const index = (await modelOf(page)).findIndex((w) => w.id === id);
  if (index < 0) throw new Error(`no workspace "${id}" in the desktop's model`);
  return index;
};

/**
 * The step a workspace opens on, or `within` steps into it ("last" is its
 * last step): the projects workspace has one step per featured project.
 */
export async function stepOf(
  page: Page,
  id: WorkspaceId,
  within: number | "last" = 0,
): Promise<number> {
  const model = await modelOf(page);
  const index = await indexOf(page, id);
  const first = model.slice(0, index).reduce((n, w) => n + w.steps.length, 0);
  const count = model[index]?.steps.length ?? 0;
  return first + (within === "last" ? count - 1 : within);
}

/** The step of the featured project whose composition is `slug`: its window's position. */
export async function stepOfProject(page: Page, slug: string): Promise<number> {
  const position = await page.evaluate(
    (s) =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '[data-window^="comp-"] [data-slot]',
        ),
      ].find((slot) => slot.dataset.composition === s)?.dataset.position,
    slug,
  );
  return stepOf(page, "projects", Number(position) - 1);
}

/** The workspace on show. */
export async function workspaceOf(page: Page): Promise<WorkspaceId> {
  const at = Number(await area(page).getAttribute("data-workspace"));
  const found = (await modelOf(page))[at];
  if (!found)
    throw new Error(`the desktop is on workspace ${at}, not in its model`);
  return found.id;
}

/** The key that goes to a workspace: its number, in the story's order. */
export async function keyOf(page: Page, id: WorkspaceId): Promise<string> {
  return String((await indexOf(page, id)) + 1);
}

/** Wait for the desktop to be on a workspace (it may still be moving there). */
export async function expectWorkspace(
  page: Page,
  id: WorkspaceId,
): Promise<void> {
  await expect(area(page)).toHaveAttribute(
    "data-workspace",
    String(await indexOf(page, id)),
  );
}

/** Wait for the desktop to be on step `step` (a global step, see `stepOf`). */
export const expectStep = (page: Page, step: number): Promise<void> =>
  expect(area(page)).toHaveAttribute("data-step", String(step));

/** Wait for the desktop to have left step `step`. */
export const expectStepLeft = (page: Page, step: number): Promise<void> =>
  expect(area(page)).not.toHaveAttribute("data-step", String(step));

/** Wait for the desktop to be at screen `screen` of its step. */
export const expectScreen = (page: Page, screen: number): Promise<void> =>
  expect(area(page)).toHaveAttribute("data-screen", String(screen));

/** Wait for the step to have `screens` screens (a phone splits a step into screens). */
export const expectScreens = (page: Page, screens: number): Promise<void> =>
  expect(area(page)).toHaveAttribute("data-screens", String(screens));

/** Wait for the step's disclosure (the archive, Education & Internships) to be open or shut. */
export const expectOpen = (page: Page, open = true): Promise<void> =>
  expect(area(page)).toHaveAttribute("data-open", String(open));

/** The area's inline `overflow`: "hidden" while a workspace change clips it, "" at rest. */
export const areaOverflow = (page: Page): Promise<string> =>
  area(page).evaluate((e) => e.style.overflow);

/** Whether the step's disclosure is open. */
export const isOpen = async (page: Page): Promise<boolean> =>
  (await area(page).getAttribute("data-open")) === "true";

/**
 * Go to a workspace by its id: with its number key, or by `click` or `tap` on
 * its status bar item. Waits for the desktop to be there, not for it to rest.
 */
export async function goTo(
  page: Page,
  id: WorkspaceId,
  how: "key" | "click" | "tap" = "key",
): Promise<void> {
  if (how === "key") await page.keyboard.press(await keyOf(page, id));
  else {
    const item = statusBarItem(page, await indexOf(page, id));
    if (how === "click") await item.click();
    else await item.tap();
  }
}

const statusBarItem = (page: Page, index: number): Locator =>
  page.locator(".ws button").nth(index);

/** A workspace's item in the status bar. */
export async function barItem(page: Page, id: WorkspaceId): Promise<Locator> {
  return statusBarItem(page, await indexOf(page, id));
}

// ---------------------------------------------------------- where it is

/** The step on show, the screen in it (a phone splits a step into screens), and how many it has. */
export interface Where {
  step: number;
  screen: number;
  screens: number;
}

export const whereOf = (page: Page): Promise<Where> =>
  area(page).evaluate((a) => ({
    step: Number(a.dataset.step),
    screen: Number(a.dataset.screen),
    screens: Number(a.dataset.screens),
  }));

/** The step the desktop is on. */
export const stepNow = async (page: Page): Promise<number> =>
  (await whereOf(page)).step;

/** The path of each step, by step, from #desktop-addresses. */
export const addressesOf = (page: Page): Promise<string[]> =>
  page.evaluate(
    () =>
      JSON.parse(
        document.getElementById("desktop-addresses")?.textContent ?? "{}",
      ).byStep as string[],
  );

/** The last step of the story. */
export const lastStep = async (page: Page): Promise<number> =>
  (await addressesOf(page)).length - 1;

/** Whether a position is the first screen of the first step. */
export const atStart = (w: Where): boolean => w.step === 0 && w.screen === 0;

/** Whether a position is the last screen of the last step. */
export const atEnd = async (page: Page, w: Where): Promise<boolean> =>
  w.step === (await lastStep(page)) && w.screen === w.screens - 1;

/** Whether `after` is exactly one screen from `before` in `direction`. */
export function isOneScreen(before: Where, after: Where, direction: 1 | -1) {
  if (direction === 1)
    return before.screen < before.screens - 1
      ? after.step === before.step && after.screen === before.screen + 1
      : after.step === before.step + 1 && after.screen === 0;
  return before.screen > 0
    ? after.step === before.step && after.screen === before.screen - 1
    : after.step === before.step - 1 && after.screen === after.screens - 1;
}

/** The desktop's tiling area on the screen, in px. */
export const areaBox = (page: Page) => area(page).boundingBox();

/** The text on the desktop's tiling area. */
export const areaText = async (page: Page): Promise<string> =>
  (await area(page).textContent()) ?? "";

/** Wait for the desktop's tiling area to hold `text`. */
export const expectAreaText = (page: Page, text: string): Promise<void> =>
  expect(area(page)).toContainText(text);

/** Whether the desktop's tiling area is still re-tiling: the windows are in motion. */
export const isRetiling = async (page: Page): Promise<boolean> =>
  (await area(page).getAttribute("data-retiling")) !== "false";

/** Wait for the desktop's re-tile to end (see `settle` for coming to rest after a step). */
export const expectNotRetiling = (page: Page): Promise<void> =>
  expect(area(page)).toHaveAttribute("data-retiling", "false");

// ---------------------------------------------------------- what is shown

/** The ids of the windows on show, sorted. */
export const shown = (page: Page): Promise<string[]> =>
  page.$$eval(".pane", (els) =>
    els
      .filter((e) => getComputedStyle(e).display !== "none")
      .map((e) => (e as HTMLElement).dataset.window ?? "")
      .sort(),
  );

/** Whether the window `id` is on show. */
export const isShown = async (page: Page, id: string): Promise<boolean> =>
  (await shown(page)).includes(id);

// ----------------------------------------------------------- coming to rest

/**
 * Load `path` and wait for the desktop to boot, and for its first appearance
 * to end: the windows slide in with `data-retiling` true, and the wheel and
 * the swipe wait for them.
 */
export async function ready(page: Page, path = "/"): Promise<void> {
  await page.goto(path);
  await booted(page);
  await expect(area(page)).toHaveAttribute("data-retiling", "false", {
    timeout: 15_000,
  });
}

/**
 * Send `count` mouse notches down over the status bar in one go, `every` ms
 * apart by their timestamps, and return where the desktop was (`step:retiling`)
 * after each. Sent together so that, whatever the machine, the later ones
 * surely come while the first one's re-tile runs.
 */
export const notchesInOneGo = (
  page: Page,
  count: number,
  every: number,
): Promise<string[]> =>
  page.evaluate(
    ([n, gap, areaSel]) => {
      const bar = document.querySelector("header.bar") ?? document.body;
      const area = document.querySelector<HTMLElement>(areaSel);
      const start = performance.now();
      const seen: string[] = [];
      for (let i = 0; i < n; i++) {
        const e = new WheelEvent("wheel", {
          deltaY: 120,
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(e, "timeStamp", { value: start + i * gap });
        bar.dispatchEvent(e);
        seen.push(`${area?.dataset.step}:${area?.dataset.retiling}`);
      }
      return seen;
    },
    [count, every, AREA] as const,
  );

/** Wait for a page that is not the desktop (the resume): no area, screen or status bar. */
export const expectNoDesktop = (page: Page): Promise<void> =>
  expect(page.locator(`${AREA}, .screen, nav.status`)).toHaveCount(0);

/** Wait for the desktop to have booted, whatever its windows are still doing. */
export const booted = (page: Page): Promise<void> =>
  expect(area(page)).toHaveAttribute("data-ready", "true");

/**
 * Wait for the desktop to come to rest: give a step two frames to begin its
 * re-tile, then wait for the re-tile to end, however long a busy machine
 * makes it. Replaces a fixed sleep that raced the 850 ms re-tile.
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      ),
  );
  await expect(area(page)).toHaveAttribute("data-retiling", "false", {
    timeout: 15_000,
  });
}

/**
 * Wait for the skills window's bars to stop growing: it says so itself with
 * `data-bars` ("growing" while they play, "rest" once they have). Starts
 * after the desktop is at rest, as the bars wait for the workspace.
 */
export async function settleBars(page: Page): Promise<void> {
  await settle(page);
  await expect(page.locator('[data-window="skills"]')).toHaveAttribute(
    "data-bars",
    "rest",
    { timeout: 15_000 },
  );
}

/**
 * How long each composition may take to play to its end on a busy machine: a
 * session takes about 17 s, issho's play-through about 24 s.
 */
const HELD_WITHIN: Record<string, number> = { issho: 50_000 };
const HELD_DEFAULT = 45_000;

/**
 * Wait for a composition to come to rest: its `data-state` is "held" once it
 * has played to its end.
 */
export async function settleComposition(
  page: Page,
  composition: string,
): Promise<void> {
  await expect(
    page.locator(`[data-composition="${composition}"]`),
  ).toHaveAttribute("data-state", "held", {
    timeout: HELD_WITHIN[composition] ?? HELD_DEFAULT,
  });
}

/**
 * On a phone a project is one screen, its copy over its composition (#90).
 * Wait for the page and for the desktop to come to rest.
 */
export async function toComposition(page: Page): Promise<void> {
  await booted(page);
  await settle(page);
}
