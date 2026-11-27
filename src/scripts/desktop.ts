// The window manager: places the windows of the current step, moves them with
// one GSAP timeline when the step changes (src/lib/motion.ts says how), and
// turns wheel, keys and clicks into steps. On touch nothing scrolls: a swipe is
// one gesture and moves one screen, like a wheel flick moves one step
// (src/lib/swipe.ts). A step is one or more screens on touch
// (src/lib/screens.ts), the same step and address.
// An input during a motion waits for it to end, the latest only, unless it
// undoes the step: then the motion turns back from where the windows are
// (src/lib/mid-motion.ts).
import { gsap } from "gsap";
import { Observer } from "gsap/Observer";
import { notFoundTitle as NOT_FOUND_TITLE } from "../lib/addresses";
import { interpretKey } from "../lib/keys";
import { actDuring, type Ends, type Where } from "../lib/mid-motion";
import {
  appearEdgeOf,
  collapsed,
  edgeOf,
  rollOf,
  sortChanges,
  travelOf,
} from "../lib/motion";
import {
  anchorOf,
  type EntriesOf,
  expandScreens,
  focusAmong,
  moveBy,
  type Screen,
  screenHolding,
} from "../lib/screens";
import { windowChanges } from "../lib/signals";
import { createSwipe, UNZOOMED } from "../lib/swipe";
import { createWheelGate } from "../lib/wheel-gate";
import {
  firstStepOf,
  focusOf,
  type Layout,
  locate,
  type Rect,
  screensOf,
  stepAt,
  stepCount,
  tilingOf,
  type Workspace,
} from "../lib/workspaces";
import { addresses, model } from "./page-data";
import { measurePages, type Paged, pagedOf, showPage } from "./paged";
import { fitTimeline } from "./timeline-entries";

gsap.registerPlugin(Observer);

/** How long a step's motion takes, in seconds. */
const MOVE = 0.32;
const EASE = "power3.out";
/** Rolling past: one project gives way to the next inside its tile. */
const ROLL = 0.38;
const ROLL_EASE = "power3.inOut";
/**
 * Changing workspace: each window takes this long, starting this long after
 * the one before, and the whole workspace travels one screen plus this gap.
 */
const SLIDE = 0.27;
const SLIDE_GAP = 0.032;
const SLIDE_EASE = "power3.inOut";
const SCREEN_GAP = 14;
/** First appearance: each window starts this long after the one before. */
const APPEAR_GAP = 0.05;
/** A window opening fades in over its first this long; closing, its last. */
const FADE = 0.12;
/** Reduced motion: no timeline, the windows are simply there. */
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
/** One step per wheel gesture, its tail absorbed (longer while a motion runs). */
const gate = createWheelGate({ tailMs: 500, steadyMs: 150, threshold: 40 });

const found = document.querySelector<HTMLElement>("main.area");
if (!found || !model) throw new Error("the desktop is missing its markup");
const area: HTMLElement = found;

if (!addresses) throw new Error("the desktop is missing its addresses");
const book = addresses;

const workspaces: Workspace[] = model;
const steps = stepCount(workspaces);
const notFoundPane = area.querySelector<HTMLElement>(
  '.pane[data-window="notfound"]',
);
const panes = [...area.querySelectorAll<HTMLElement>(".pane")].filter(
  (p) => p !== notFoundPane,
);
const numbers = [
  ...document.querySelectorAll<HTMLButtonElement>(".ws button[data-workspace]"),
];
const touch = matchMedia("(max-width: 760px)");

let step = 0;
/** The screen of the step on show (always 0 on a wide screen). */
let screen = 0;
/** The screen the disclosure was opened from, which closing returns to. */
let screenBeforeOpen = 0;
/** The layout on show, to tell the windows that come and go. */
let shown: Layout | null = null;
/** The workspace of the layout on show. */
let shownWorkspace = -1;
/** The step, disclosure and pages of the layout on show (a phone's screens). */
let shownStep = -1;
let shownOpen = false;
let shownPages: Readonly<Record<string, number>> = {};
/** Where the layout on show sits in the order of steps and screens. */
let shownOrder = -1;
/** The current step's disclosure (Education & Internships) is open. */
let open = false;
/** An unknown path booted the desktop: the not-found terminal is on show. */
let notFound = area.dataset.notFound === "true";
/** The archive entered the address bar as a history entry of its own (Back closes it). */
let archivePushed = false;
const archiveEl = area.querySelector<HTMLElement>(
  '.pane[data-window="archive"]',
);

// ---- screens
// On touch a step is its layouts in order, and a window with more entries than
// fit (which ones: src/lib/screens.ts) is as many screens as its entries need. The pages are measured in the window as it will be tiled, and kept until
// the screen changes size or the fonts arrive. This stays for the timeline step's
// two phone screens (#108, see src/lib/screens.ts); the archive pages the same way.

const windowOf = new Map(panes.map((p) => [p.dataset.window ?? "", p]));
const pagedByWindow = new Map<string, Paged | undefined>();
const pagedWindow = (id: string): Paged | undefined => {
  if (!pagedByWindow.has(id)) {
    const pane = windowOf.get(id);
    pagedByWindow.set(id, pane && pagedOf(pane));
  }
  return pagedByWindow.get(id);
};
const pageCache = new Map<string, number[][]>();

/** The pages a paged window falls into at a tile of the area. */
function pagesOf(id: string, tile: Layout[string]): number[][] {
  const paged = pagedWindow(id);
  if (!paged) return [[]];
  const key = `${id}:${tile.join(",")}`;
  let pages = pageCache.get(key);
  if (!pages) {
    pages = measurePages(paged, tile);
    pageCache.set(key, pages);
  }
  return pages;
}

/** The screens of step `n`; `opened` says whether its disclosure is open. */
function screensAt(n: number, opened: boolean): Screen[] {
  const found = stepAt(workspaces, n);
  if (!touch.matches) return [{ layout: tilingOf(found, opened), pages: {} }];
  const layouts = screensOf(found, opened);
  const counts: Record<string, number> = {};
  for (const layout of layouts)
    for (const [id, tile] of Object.entries(layout))
      if (pagedWindow(id)) counts[id] = pagesOf(id, tile).length;
  return expandScreens(layouts, counts);
}

/** The screen of the archive that holds an entry (0 on a wide screen). */
function screenOfEntry(slug: string): number {
  const paged = pagedWindow("archive");
  if (!touch.matches || !slug || !paged) return 0;
  const at = paged.items.findIndex(
    (li) => li.dataset.entry?.toLowerCase() === slug.toLowerCase(),
  );
  const tile = screensOf(stepAt(workspaces, step), true)[0]?.archive;
  if (at < 0 || !tile) return 0;
  const page = pagesOf("archive", tile).findIndex((ix) => ix.includes(at));
  return Math.max(0, page);
}

/** The not-found terminal floats over the opening until the first jump. */
function showNotFound(): void {
  if (!notFoundPane) return;
  if (!notFound) {
    notFoundPane.style.display = "none";
    return;
  }
  Object.assign(notFoundPane.style, {
    display: "block",
    left: "10%",
    top: "10%",
    width: "80%",
    height: "80%",
    zIndex: "100",
  });
  notFoundPane.classList.add("focus");
  const missing = notFoundPane.querySelector("[data-missing]");
  if (missing) missing.textContent = location.pathname;
}

/**
 * Tell the compositions: a window's slot (`[data-slot]`) gets
 * `composition:enter` when its window comes on show and `composition:leave`
 * when it goes, and `data-active` says which. Fired at once, as the re-tile
 * begins.
 */
function signal(before: Layout | null, after: Layout): void {
  const { entered, left } = windowChanges(before, after);
  for (const [ids, type] of [
    [left, "leave"],
    [entered, "enter"],
  ] as const) {
    for (const id of ids) {
      const slot = area.querySelector<HTMLElement>(
        `.pane[data-window="${id}"] [data-slot]`,
      );
      if (!slot) continue;
      slot.dataset.active = String(type === "enter");
      slot.dispatchEvent(
        new CustomEvent(`composition:${type}`, {
          detail: {
            repository: slot.dataset.composition,
            position: Number(slot.dataset.position),
          },
        }),
      );
    }
  }
}

/** Mark the stack's current project (`index` is 0-based; -1 for none). */
function markStack(index: number): void {
  for (const a of area.querySelectorAll<HTMLElement>("[data-stack] a")) {
    if (Number(a.dataset.position) - 1 === index)
      a.setAttribute("aria-current", "true");
    else a.removeAttribute("aria-current");
  }
}

/** A layout on show: where it is, and what the page says about it. */
interface Placed {
  where: Where;
  layout: Layout;
  pages: Readonly<Record<string, number>>;
  screens: number;
  focus: string | undefined;
  /** Where it sits in the order of steps and screens. */
  order: number;
}
/** The layout on show, as placed. */
let placed: Placed | null = null;
/** The running motion's two ends, as placed; `from` is null for the first appearance. */
let placedEnds: { from: Placed | null; to: Placed } | null = null;
/** Back steps the page took itself, whose popstate only reconciles the address. */
let ownBacks = 0;
/** The input that waits for the running motion to end: the latest only. */
let waiting: (() => void) | null = null;
/**
 * A Back or Forward waits for the running motion: the browser has already
 * moved the address, so no later input drops it; it runs before `waiting`.
 */
let waitingRestore = false;
/** An input that leads back to where the running motion began is running. */
let turningBack = false;
/** One of its steps on the way back was not the origin, and was let pass. */
let passedBy = false;
/** Whether it turned the motion back. */
let turnedBack = false;

/** The running motion's ends, for the rule (src/lib/mid-motion.ts). */
const runningEnds = (): Ends | null =>
  latest && placedEnds
    ? { from: placedEnds.from?.where ?? null, to: placedEnds.to.where }
    : null;

/**
 * Every input goes through here with where it leads. At rest it runs at once.
 * During a motion, one that leads back to where the motion began runs and
 * turns the motion back (its own `place` does, from where the windows are);
 * any other waits for the motion to end, the latest only.
 */
function act(target: Where, run: () => void): void {
  const what = actDuring(runningEnds(), target);
  if (what === "wait") {
    if (run === restore) waitingRestore = true;
    else waiting = run;
    return;
  }
  if (what === "run") {
    run();
    return;
  }
  turningBack = true;
  passedBy = false;
  turnedBack = false;
  try {
    run();
  } finally {
    turningBack = false;
  }
  // it led somewhere else after all: go there from where the windows are
  if (passedBy && !turnedBack) place(step, true);
}

/** Tell the page which layout is on show: its windows' slots, the step, the status bar. */
function record(p: Placed): void {
  for (const pane of panes)
    pane.classList.toggle("focus", pane.dataset.window === p.focus);
  signal(shown, p.layout);
  shown = p.layout;
  placed = p;
  shownStep = p.where.step;
  shownOpen = p.where.open;
  shownPages = p.pages;
  shownOrder = p.order;
  const { workspace, index } = locate(workspaces, p.where.step);
  shownWorkspace = workspace;
  markStack(workspaces[workspace]?.id === "projects" ? index : -1);
  area.dataset.step = String(p.where.step);
  area.dataset.screen = String(p.where.screen);
  area.dataset.screens = String(p.screens);
  area.dataset.workspace = String(workspace);
  for (const [i, b] of numbers.entries()) {
    if (i === workspace) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  }
}

/**
 * Write a layout's windows at rest: on their tiles, in tiling order, each
 * paged window on its page. With `turnsFrom`, the pages on show before, a
 * paged window that changes page first leaves a copy of its old page to turn.
 */
function writeRest(
  layout: Layout,
  pages: Readonly<Record<string, number>>,
  turnsFrom?: Readonly<Record<string, number>>,
): void {
  let z = 1;
  for (const pane of panes) {
    const rect = layout[pane.dataset.window ?? ""];
    if (!rect) {
      pane.style.display = "none";
      continue;
    }
    Object.assign(pane.style, {
      display: "block",
      ...css(rect),
      zIndex: String(z++),
    });
  }
  // the entries of a paged window: its page on touch, all of them wide
  for (const pane of panes) {
    const id = pane.dataset.window ?? "";
    const paged = pagedWindow(id);
    const tile = layout[id];
    if (!paged || !tile) continue;
    if (turnsFrom && (turnsFrom[id] ?? 0) !== (pages[id] ?? 0))
      turning.push(turnFrom(paged));
    showPage(
      paged,
      touch.matches ? pagesOf(id, tile)[pages[id] ?? 0] : undefined,
    );
  }
  showNotFound();
}

/**
 * Turn the running motion back: it reverses from where the windows are, to
 * where it began, and anything waiting is dropped (but a Back or Forward,
 * whose address has already moved). Turned back again, it
 * plays forwards.
 */
function turnBack(): void {
  const timeline = latest;
  const ends = placedEnds;
  if (!timeline || !ends?.from) return;
  turnedBack = true;
  waiting = null;
  placedEnds = { from: ends.to, to: ends.from };
  record(ends.from);
  if (timeline.reversed()) timeline.play();
  else timeline.reverse();
  // turned back before it moved: it is already where it began
  if (timeline.reversed() && timeline.time() === 0) backAtStart(timeline);
}

/** A motion turned back reached where it began: its windows go to rest there. */
function backAtStart(timeline: gsap.core.Timeline): void {
  if (timeline !== latest) return;
  timeline.kill();
  rest?.();
  rest = null;
  if (placed) writeRest(placed.layout, placed.pages);
  settled(timeline);
}

/** Put the windows of a step in place; animate from where they are if asked. */
function place(n: number, animate: boolean): void {
  const screens = screensAt(n, open);
  screen = Math.max(0, Math.min(screens.length - 1, screen));
  const { layout, pages } = screens[screen] ?? { layout: {}, pages: {} };
  const focus = focusAmong(layout, focusOf(stepAt(workspaces, n), open));
  // a re-measure that changes nothing lets the first appearance run on
  if (
    !animate &&
    appearing &&
    appearing === latest &&
    JSON.stringify(shown) === JSON.stringify(layout)
  )
    return;
  const where: Where = { step: n, screen, open };
  if (animate && latest) {
    // the input undoes the running motion: it turns back from where the windows are
    if (actDuring(runningEnds(), where) === "turn back") {
      turnBack();
      return;
    }
    // an input on its way back (an archive address: its step, then the archive)
    if (turningBack) {
      passedBy = true;
      return;
    }
  }
  const before = shown;
  const from = placed;
  const beforePages = shownPages;
  const sameScreens =
    touch.matches && shownStep === n && shownOpen === open && before !== null;
  const sameLayout =
    sameScreens && JSON.stringify(before) === JSON.stringify(layout);
  const order = n * 1000 + screen;
  const direction = order >= shownOrder ? 1 : -1;
  const beforeWorkspace = shownWorkspace;
  // a motion still running ends here: its windows go to rest first
  const interrupted = stopMotion();
  turning = [];

  const moving = animate && before !== null && !reduced.matches;
  writeRest(layout, pages, moving && sameLayout ? beforePages : undefined);
  const next: Placed = {
    where,
    layout,
    pages,
    screens: screens.length,
    focus,
    order,
  };
  record(next);

  if (moving && before) {
    // the wheel stays open, so a gesture that turns the motion back reaches
    // the rule; the gesture's own tail stays tail until the motion ends
    gate.moving();
    // for the page and its tests: a motion is running until `settled`
    area.dataset.retiling = "true";
    placedEnds = { from, to: next };
    latest = motionBetween(
      before,
      layout,
      shownWorkspace === beforeWorkspace,
      direction,
      sameScreens && !sameLayout,
    );
  } else if (interrupted) {
    area.dataset.retiling = "false";
    gate.still();
    runWaiting();
  }
}

const css = ([left, top, width, height]: Rect) => ({
  left: `${left}%`,
  top: `${top}%`,
  width: `${width}%`,
  height: `${height}%`,
});

/** The running motion's clean-up: what leaves goes, and fades are cleared. */
let rest: (() => void) | null = null;

/** A paged window turning its page: its old entries, as a copy that leaves. */
interface Turn {
  paged: Paged;
  old: HTMLElement;
  /** What the window's own list was positioned against, to put back. */
  parent: HTMLElement;
  position: string;
}
/** The page turns of the step being placed, taken before its pages change. */
let turning: Turn[] = [];

/**
 * Copy the entries a paged window shows now and lay the copy over them, so
 * that the old page can leave while the next comes in. Taken before the window
 * shows its next page.
 */
function turnFrom(paged: Paged): Turn {
  const { list } = paged;
  const parent = list.parentElement ?? paged.root;
  const position = parent.style.position;
  if (getComputedStyle(parent).position === "static")
    parent.style.position = "relative";
  const old = list.cloneNode(true) as HTMLElement;
  old.removeAttribute("id");
  old.removeAttribute("data-paged");
  old.dataset.clone = "true";
  old.setAttribute("aria-hidden", "true");
  old.inert = true;
  for (const e of old.querySelectorAll("[id]")) e.removeAttribute("id");
  for (const e of old.querySelectorAll("[data-entry]"))
    e.removeAttribute("data-entry");
  for (const e of old.querySelectorAll("[aria-current]"))
    e.removeAttribute("aria-current");
  Object.assign(old.style, {
    position: "absolute",
    top: `${list.offsetTop}px`,
    left: `${list.offsetLeft}px`,
    width: `${list.offsetWidth}px`,
    margin: "0",
  });
  parent.append(old);
  return { paged, old, parent, position };
}

/** End the running motion, if any, with its windows at rest. */
function stopMotion(): boolean {
  if (!latest) return false;
  const running = latest;
  latest = null;
  placedEnds = null;
  running.kill();
  rest?.();
  rest = null;
  return true;
}

/**
 * The step's one timeline, from the old to the new written rectangles
 * (`left/top/width/height`, never scale, so text re-sets rather than
 * stretches). A window in both steps re-tiles. On a wide screen, a window that
 * opens grows out of its edge along that edge's axis, and one that closes
 * shrinks back into it, sharing one moving border with the neighbours that
 * re-tile beside it. Rolling past, changing workspace and the phone's own
 * motions are their own tickets: until then their windows simply appear or
 * go, and only those in both steps move.
 */
function motionBetween(
  before: Layout,
  after: Layout,
  sameWorkspace: boolean,
  direction: 1 | -1,
  screenMove = false,
): gsap.core.Timeline {
  // a phone moving between screens of one step, whose windows all change,
  // travels like changing workspace
  if (!sameWorkspace || screenMove)
    return travelBetween(before, after, direction);
  const leaving: HTMLElement[] = [];
  const faded: HTMLElement[] = [];
  const rolled: HTMLElement[] = [];
  const timeline = gsap.timeline({
    onComplete: () => {
      if (timeline !== latest) return;
      rest?.();
      rest = null;
      settled(timeline);
    },
    onReverseComplete: () => backAtStart(timeline),
  });
  const tween = (pane: HTMLElement, from: Rect, to: Rect) =>
    timeline.fromTo(
      pane,
      css(from),
      { ...css(to), duration: MOVE, ease: EASE },
      0,
    );
  for (const c of sortChanges(before, after, sameWorkspace)) {
    const pane = windowOf.get(c.id);
    if (!pane) continue;
    if (c.from && c.to) {
      tween(pane, c.from, c.to);
    } else if (c.motion === "rolling past") {
      // the tile stays; the window slides through it, clipped to the tile
      if (c.from) {
        pane.style.display = "block";
        Object.assign(pane.style, css(c.from));
        leaving.push(pane);
      }
      const roll = rollOf(direction, pane.offsetHeight);
      const [start, end] = c.to
        ? [roll.in.from, roll.rest]
        : [roll.rest, roll.out.to];
      timeline.fromTo(
        pane,
        { y: start.y, clipPath: start.clip },
        { y: end.y, clipPath: end.clip, duration: ROLL, ease: ROLL_EASE },
        0,
      );
      rolled.push(pane);
    } else if (c.motion === "opening" && c.to) {
      tween(
        pane,
        collapsed(c.to, edgeOf(c.id, before, after, touch.matches)),
        c.to,
      );
      timeline.fromTo(
        pane,
        { opacity: 0 },
        { opacity: 1, duration: FADE, ease: "none" },
        0,
      );
      faded.push(pane);
    } else if (c.motion === "closing" && c.from) {
      // it stays on show until it is in its edge
      pane.style.display = "block";
      tween(
        pane,
        c.from,
        collapsed(c.from, edgeOf(c.id, before, after, touch.matches)),
      );
      timeline.fromTo(
        pane,
        { opacity: 1 },
        { opacity: 0, duration: FADE, ease: "none" },
        MOVE - FADE,
      );
      leaving.push(pane);
      faded.push(pane);
    }
  }
  // a paged window turning its page: its entries roll past inside the window
  // (the window's body clips them); its frame and title bar stay
  const turned = turning;
  turning = [];
  const entries: HTMLElement[] = [];
  for (const { paged, old } of turned) {
    const roll = rollOf(direction, paged.root.clientHeight);
    timeline.fromTo(
      old,
      { y: roll.rest.y },
      { y: roll.out.to.y, duration: ROLL, ease: ROLL_EASE },
      0,
    );
    timeline.fromTo(
      paged.list,
      { y: roll.in.from.y },
      { y: roll.rest.y, duration: ROLL, ease: ROLL_EASE },
      0,
    );
    entries.push(paged.list);
  }
  // a step whose windows only appear and go still takes the step's time
  timeline.set({}, {}, rolled.length > 0 || turned.length > 0 ? ROLL : MOVE);
  rest = () => {
    for (const pane of leaving) pane.style.display = "none";
    gsap.set(faded, { clearProps: "opacity" });
    gsap.set(rolled, { clearProps: "transform,clipPath" });
    gsap.set(entries, { clearProps: "transform" });
    for (const { old, parent, position } of turned) {
      old.remove();
      parent.style.position = position;
    }
  };
  return timeline;
}

/** The first appearance's timeline while it runs. */
let appearing: gsap.core.Timeline | null = null;

/**
 * First appearance, as one timeline: the step's windows, already on their
 * tiles, each slide straight into their tile from an edge, one after another
 * in tiling order. Nothing re-tiles.
 */
function appearBetween(layout: Layout): gsap.core.Timeline {
  const faded: HTMLElement[] = [];
  const timeline = gsap.timeline({
    onComplete: () => {
      if (timeline !== latest) return;
      rest?.();
      rest = null;
      appearing = null;
      settled(timeline);
    },
  });
  for (const [i, [id, tile]] of Object.entries(layout).entries()) {
    const pane = windowOf.get(id);
    if (!pane) continue;
    const at = i * APPEAR_GAP;
    timeline.fromTo(
      pane,
      css(collapsed(tile, appearEdgeOf(i, tile, touch.matches))),
      { ...css(tile), duration: MOVE, ease: EASE },
      at,
    );
    timeline.fromTo(
      pane,
      { opacity: 0 },
      { opacity: 1, duration: FADE, ease: "none" },
      at,
    );
    faded.push(pane);
  }
  rest = () => {
    appearing = null;
    gsap.set(faded, { clearProps: "opacity" });
  };
  return timeline;
}

/**
 * Changing workspace, as one timeline. The old workspace's windows slide up
 * and off one after another in tiling order as the next workspace's come up
 * from below in the same order (the reverse going to a lower one), `direction`
 * giving which. However many workspaces the jump crosses, it travels one
 * screen. The area is clipped while it runs, so no window passes over the
 * status bar. A window on both workspaces leaves as a clone of its pane while
 * the real pane arrives; the clone goes when the motion ends or is stopped.
 */
function travelBetween(
  before: Layout,
  after: Layout,
  direction: 1 | -1,
): gsap.core.Timeline {
  const { leaving, arriving } = travelOf(before, after);
  const away = (area.clientHeight + SCREEN_GAP) * direction;
  const goes: HTMLElement[] = [];
  const clones: HTMLElement[] = [];
  const comes: HTMLElement[] = [];
  const clipped = area.style.overflow;
  area.style.overflow = "hidden";
  const timeline = gsap.timeline({
    onComplete: () => {
      if (timeline !== latest) return;
      rest?.();
      rest = null;
      settled(timeline);
    },
    onReverseComplete: () => backAtStart(timeline),
  });
  const slide = (pane: HTMLElement, from: number, to: number, at: number) =>
    timeline.fromTo(
      pane,
      { y: from },
      { y: to, duration: SLIDE, ease: SLIDE_EASE },
      at,
    );
  for (const [i, w] of leaving.entries()) {
    const pane = windowOf.get(w.id);
    if (!pane) continue;
    let mover = pane;
    if (w.shared) {
      // the pane is already on its new tile: a copy leaves from the old one
      mover = pane.cloneNode(true) as HTMLElement;
      mover.removeAttribute("data-window");
      mover.dataset.clone = "true";
      mover.setAttribute("aria-hidden", "true");
      mover.inert = true;
      for (const e of mover.querySelectorAll("[id]")) e.removeAttribute("id");
      mover.removeAttribute("id");
      area.append(mover);
      clones.push(mover);
    } else goes.push(pane);
    mover.style.display = "block";
    Object.assign(mover.style, css(w.tile));
    slide(mover, 0, -away, i * SLIDE_GAP);
  }
  for (const [i, w] of arriving.entries()) {
    const pane = windowOf.get(w.id);
    if (!pane) continue;
    comes.push(pane);
    slide(pane, away, 0, (i + 1) * SLIDE_GAP);
  }
  rest = () => {
    for (const pane of goes) pane.style.display = "none";
    for (const clone of clones) clone.remove();
    gsap.set([...goes, ...comes], { clearProps: "transform" });
    area.style.overflow = clipped;
  };
  return timeline;
}

/**
 * The newest step's motion; one that a later one stopped does not end the
 * re-tile. When the newest ends, the input that waited for it runs from rest,
 * and `data-retiling` stays true until the last motion of the chain ends.
 */
let latest: gsap.core.Timeline | null = null;
function settled(motion: gsap.core.Timeline): void {
  if (motion !== latest) return;
  latest = null;
  placedEnds = null;
  gate.still();
  runWaiting();
  if (!latest) area.dataset.retiling = "false";
}

/** Run what waited for the motion: a Back or Forward first, then the latest other input from where it leaves the windows. */
function runWaiting(): void {
  if (waitingRestore) {
    waitingRestore = false;
    restore();
    if (latest) return;
  }
  const next = waiting;
  waiting = null;
  next?.();
}

/** Whether the step's disclosure is the archive (the projects workspace's). */
/** What opens the archive: the projects' opener, and its phone screen's. */
const ARCHIVE_OPENERS = "[data-archive-open], [data-archive-phone]";

const inProjects = (): boolean =>
  workspaces[locate(workspaces, step).workspace]?.id === "projects";

/** Tell the page the disclosure changed: Education's cue, or the archive's openers. */
function announce(): void {
  const kind = inProjects() ? "archive" : "open";
  if (kind === "archive") {
    for (const b of document.querySelectorAll(ARCHIVE_OPENERS))
      b.setAttribute("aria-expanded", String(open));
  }
  document.dispatchEvent(
    new CustomEvent(`desktop:${kind}`, { detail: { open } }),
  );
}

/** Open or close the step's disclosure; the windows re-tile and listen for the event. */
function setOpen(next: boolean, animate = true, toScreen = 0): void {
  if (next === open) return;
  if (next && !stepAt(workspaces, step).open) return;
  if (next) screenBeforeOpen = screen;
  open = next;
  if (!open) archivePushed = false;
  area.dataset.open = String(open);
  // opened, its screens are the disclosure's; closed, back to where it began
  screen = open ? toScreen : screenBeforeOpen;
  // the disclosure's window shows its entries before they are measured
  announce();
  pageCache.clear();
  place(step, animate);
}

/** Leaving a step closes its disclosure. */
function leave(): void {
  archivePushed = false;
  if (!open) return;
  closeDisclosure();
}

function closeDisclosure(): void {
  open = false;
  area.dataset.open = "false";
  announce();
  pageCache.clear();
}

// ---- the archive window
// It is the projects workspace's `open` variant: opening re-tiles the workspace
// to the left 42% and the archive takes the right 58% (the whole workspace on
// touch). Its address is `/archive/`, pushed as a history entry; closing goes
// Back to the address underneath.

/** Mark the entry an address opened on, and bring it into view. */
function markEntry(slug: string): void {
  for (const li of area.querySelectorAll<HTMLElement>("[data-entry]")) {
    if (slug && li.dataset.entry?.toLowerCase() === slug.toLowerCase()) {
      li.setAttribute("aria-current", "true");
      // on touch the entry's own screen shows it
      if (!touch.matches)
        li.scrollIntoView({ block: "nearest", behavior: "instant" });
    } else li.removeAttribute("aria-current");
  }
}

/** Entries stagger in as the window opens. */
function staggerEntries(): void {
  gsap.fromTo(
    area.querySelectorAll("[data-entry]"),
    { y: 12, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: 0.5,
      stagger: 0.05,
      delay: 0.35,
      ease: "expo.out",
      overwrite: true,
      clearProps: "transform,opacity",
    },
  );
}

function openArchive(slug = "", push = true): void {
  if (!archiveEl || open || !inProjects()) return;
  if (push) {
    history.pushState(null, "", ARCHIVE_PATH);
    archivePushed = true;
  }
  document.title = book.forPath(ARCHIVE_PATH)?.title ?? document.title;
  setOpen(true, true, screenOfEntry(slug));
  markEntry(slug);
  staggerEntries();
}

function closeArchive(): void {
  if (!open || !inProjects()) return;
  const address = book.forStep(step);
  // the archive's own entry: Back to the address underneath, whose popstate
  // only reconciles the title; the windows close (or turn back) here and now
  if (archivePushed) goBackOver();
  else history.replaceState(null, "", address.path);
  document.title = address.title;
  setOpen(false);
}

const ARCHIVE_PATH = "/archive/";

/** Where closing the step's disclosure leads: the screen it was opened from. */
const closed = (): Where => ({ step, screen: screenBeforeOpen, open: false });
/** Where opening the step's disclosure leads: its first screen. */
const opened = (): Where => ({ step, screen: 0, open: true });

document.addEventListener("click", (e) => {
  const target = e.target as Element | null;
  const cue = target?.closest("[data-disclosure]");
  if (cue) {
    const next = !open;
    act(next ? opened() : closed(), () => setOpen(next));
  }
  if (target?.closest(ARCHIVE_OPENERS)) {
    if (open) act(closed(), closeArchive);
    else act(opened(), () => openArchive());
  }
  if (target?.closest("[data-archive-close]")) act(closed(), closeArchive);
});

/** Move to a step, and a screen of it, and re-tile (wide screen and touch alike). */
function goTo(n: number, toScreen = 0): void {
  const next = Math.max(0, Math.min(steps - 1, n));
  if (next === step && toScreen === screen) return;
  const changed = next !== step;
  // a move between screens of the step keeps its disclosure open
  if (changed) leave();
  step = next;
  screen = toScreen;
  place(step, true);
  if (changed) follow(step);
}

// ---- the address bar
// Scrolling updates the address and the tab title and adds no history entry; a
// deliberate jump adds one. Both are exported below for other scripts.

/** Show the address of a step without adding history (scrolling). */
function follow(n: number): void {
  if (notFound && n !== 0) notFound = false;
  // a Back the page took is on its way: the address it lands on is the step's
  if (notFound || ownBacks > 0) return;
  const address = book.forStep(n);
  document.title = address.title;
  if (
    location.pathname !== address.path &&
    book.stepFor(location.pathname) !== n
  ) {
    history.replaceState(null, "", address.path);
  }
}

/** Where Back or Forward leads: the step of the address, its archive open if it is one. */
function whereOfAddress(): Where {
  const next = book.stepFor(location.pathname) ?? 0;
  const archive = book.forPath(location.pathname)?.archive;
  if (archive !== undefined && archiveEl)
    return { step: next, screen: screenOfEntry(archive), open: true };
  const returning = open && next === step;
  return { step: next, screen: returning ? screenBeforeOpen : 0, open: false };
}

/** Back or Forward: show the step of the address, with no new entry. */
function restore(): void {
  const n = book.stepFor(location.pathname);
  notFound = n === undefined;
  const next = n ?? 0;
  const address = book.forPath(location.pathname);
  document.title = address?.title ?? NOT_FOUND_TITLE;
  // closing the archive (Back) lands on the screen it was opened from
  const returning = open && next === step;
  leave();
  step = next;
  screen = returning ? screenBeforeOpen : 0;
  if (address?.archive !== undefined && archiveEl) {
    open = true;
    area.dataset.open = "true";
    screen = screenOfEntry(address.archive);
    announce();
    markEntry(address.archive);
    staggerEntries();
  }
  place(step, true);
}
addEventListener("popstate", () => {
  if (ownBacks > 0) {
    // a Back the page took itself: the windows are already on their way
    ownBacks--;
    document.title = book.forPath(location.pathname)?.title ?? document.title;
    return;
  }
  act(whereOfAddress(), restore);
});

/** Go Back one entry for the visitor: the windows are already going there. */
function goBackOver(): void {
  ownBacks++;
  history.back();
}

/**
 * A deliberate jump to a step: adds a history entry (unless it is where we
 * already are), so Back undoes it. Status bar items, workspace numbers and
 * keys, and links use this.
 */
export function jump(n: number): void {
  const next = Math.max(0, Math.min(steps - 1, n));
  act({ step: next, screen: 0, open: false }, () => jumpNow(next));
}

function jumpNow(next: number): void {
  const here = !notFound && book.stepFor(location.pathname) === next;
  if (!here) {
    const address = book.forStep(next);
    history.pushState(null, "", address.path);
    document.title = address.title;
  }
  if (notFound) {
    notFound = false;
    place(step, false);
  }
  // a jump to the step the archive is open on closes it, with no re-tile of its own
  if (open && next === step) setOpen(false);
  goTo(next);
}

/** A deliberate jump to an address of the site; false if the path is not one. */
export function jumpToPath(path: string): boolean {
  const n = book.stepFor(path);
  if (n === undefined) return false;
  const archive = book.forPath(path)?.archive;
  if (archive === undefined) {
    jump(n);
    return true;
  }
  // an archive address: go to its step, then open the archive on its entry
  act({ step: n, screen: screenOfEntry(archive), open: true }, () => {
    if (n !== step) jumpNow(n);
    openArchive(archive);
  });
  return true;
}

/**
 * One screen up or down: on a wide screen a step is one screen, so this is one
 * step. Follows the address without a history entry.
 */
export function moveOneScreen(direction: 1 | -1): void {
  const next = oneScreenOn(direction);
  act({ ...next, open: next.step === step && open }, () => {
    const now = oneScreenOn(direction);
    goTo(now.step, now.screen);
  });
}

/** The step and screen one screen on from those on show. */
const oneScreenOn = (direction: 1 | -1) =>
  moveBy(
    { step, screen },
    direction,
    (n) => screensAt(n, n === step && open).length,
    steps,
  );

/** The global step on show. */
export const currentStep = (): number => step;

// links to addresses of the site are jumps
document.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
  if (
    !(a instanceof HTMLAnchorElement) ||
    a.target ||
    a.hasAttribute("download")
  )
    return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  if (book.stepFor(url.pathname) === undefined) return;
  e.preventDefault();
  jumpToPath(url.pathname);
});

// ---- touch: one step per swipe, through the pure gesture rule
// The page never scrolls on touch (`touch-action: pinch-zoom`, see
// Desktop.astro), so the browser has no scroll position to lose when its URL
// bar shows or hides. Pinch-zoom stays the browser's: the rule ignores a
// gesture with a second finger, and one on a zoomed-in page.
const swipe = createSwipe({ distance: 48, flick: 16, speed: 0.4 });

/** The page's pinch-zoom: 1 unless the visitor zoomed in. */
const zoom = (): number => window.visualViewport?.scale ?? 1;

// Zoomed in, one finger pans the zoomed page (Desktop.astro's `data-zoomed`).
const markZoom = () => {
  document.documentElement.dataset.zoomed = String(zoom() > UNZOOMED);
};
window.visualViewport?.addEventListener("resize", markZoom);
markZoom();

/** Touch input only: a mouse on a narrow window has the wheel. */
const fingerEvent = (e: PointerEvent): boolean =>
  touch.matches && e.pointerType === "touch";

/** A swipe the finger has made, which moves once the finger lifts. */
let swiping: 1 | -1 | 0 = 0;

const fingerOf = (e: PointerEvent) => ({
  id: e.pointerId,
  x: e.clientX,
  y: e.clientY,
  time: e.timeStamp,
});

/**
 * A swipe moves one screen, starting when the finger lifts (the windows don't
 * track the finger). During a motion it waits, or turns the motion back, like
 * any other input.
 */
function swiped(direction: 1 | -1): void {
  moveOneScreen(direction);
}

// Pointer events, not touch events: the browser can hand a gesture to its own
// handling and stop sending `touchmove`, but the pointer stream keeps coming.
document.addEventListener(
  "pointerdown",
  (e) => {
    if (!fingerEvent(e)) return;
    // a second finger is a pinch, never a step
    swiping = 0;
    swipe.down(fingerOf(e), e.isPrimary, zoom());
  },
  { passive: true },
);
document.addEventListener(
  "pointermove",
  (e) => {
    if (!fingerEvent(e)) return;
    // the rule says the swipe is made; it moves when the finger lifts
    swiping = swipe.move(fingerOf(e)) || swiping;
  },
  { passive: true },
);
document.addEventListener(
  "pointerup",
  (e) => {
    if (!fingerEvent(e)) return;
    const direction = swipe.up(fingerOf(e)) || swiping;
    if (!direction) return;
    swiping = 0;
    swiped(direction);
  },
  { passive: true },
);
document.addEventListener(
  "pointercancel",
  (e) => {
    if (!fingerEvent(e)) return;
    swiping = 0;
    swipe.cancel(e.pointerId);
  },
  { passive: true },
);

// ---- wide: one step per wheel gesture, through Observer (the gate is above)

/** True if the wheel is over a window whose own content can still scroll that way. */
function scrollsInside(target: EventTarget | null, dy: number): boolean {
  for (
    let el = target instanceof Element ? target : null;
    el && el !== area;
    el = el.parentElement
  ) {
    const canScroll =
      el.scrollHeight > el.clientHeight &&
      /auto|scroll/.test(getComputedStyle(el).overflowY);
    if (!canScroll) continue;
    if (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1)
      return true;
    if (dy < 0 && el.scrollTop > 0) return true;
  }
  return false;
}

/**
 * How long the page was busy: the longest stretch without a frame since the
 * last wheel event. Frames are counted from each wheel event until a second
 * of quiet, so the wheel gate can tell events Chromium merged while the page
 * was busy from a silence while it was idle.
 */
const stalls = (() => {
  let lastBeat = 0;
  let longest = 0;
  let lastWheel = Number.NEGATIVE_INFINITY;
  let counting = false;
  const beat = () => {
    const now = performance.now();
    longest = Math.max(longest, now - lastBeat);
    lastBeat = now;
    counting = now - lastWheel < 1000;
    if (counting) requestAnimationFrame(beat);
  };
  return (): number => {
    const now = performance.now();
    const stall = counting ? Math.max(longest, now - lastBeat) : 0;
    longest = 0;
    lastBeat = now;
    lastWheel = now;
    if (!counting) {
      counting = true;
      requestAnimationFrame(beat);
    }
    return stall;
  };
})();

Observer.create({
  target: window,
  type: "wheel",
  // every event, as it comes: debounced, Observer calls onWheel once a frame
  // with that frame's last event, so on a busy page a whole flick could reach
  // the gate as its last tiny delta (no step), and an event that came while a
  // re-tile held the gate was judged after its release
  debounce: false,
  onWheel: (self) => {
    const e = self.event as WheelEvent;
    const stall = stalls();
    if (e.ctrlKey) return;
    // a window scrolling its own content takes the event, and the rest of
    // that gesture stays its tail once the window reaches its end
    if (scrollsInside(e.target, e.deltaY)) {
      gate.absorb(e.timeStamp, e.deltaY);
      return;
    }
    const direction = gate.feed(e.timeStamp, e.deltaY, stall);
    if (direction) moveOneScreen(direction);
  },
});

// ---- keys and the status bar
addEventListener("keydown", (e: KeyboardEvent) => {
  const t = e.target;
  if (
    t instanceof HTMLElement &&
    t.matches("input, textarea, select, [contenteditable]")
  )
    return;
  // Space on a timeline entry's toggle opens or closes the entry, it does not
  // move on; anywhere else (a status bar number just clicked) it moves a step
  if (e.key === " " && t instanceof HTMLElement && t.closest(".tgl")) return;
  if (e.key === "Escape" && open && inProjects()) {
    e.preventDefault();
    act(closed(), closeArchive);
    return;
  }
  const command = interpretKey(e, workspaces.length);
  if (!command) return;
  if (command.type === "workspace") {
    e.preventDefault();
    jump(firstStepOf(workspaces, command.index));
  } else if (command.type === "step" && !e.repeat) {
    e.preventDefault();
    moveOneScreen(command.direction);
  }
});

for (const b of numbers) {
  b.addEventListener("click", () =>
    jump(firstStepOf(workspaces, Number(b.dataset.workspace))),
  );
}

// home and contact: deliberate jumps to the opening and the last workspace.
for (const [act, index] of [
  ["home", 0],
  ["contact", workspaces.length - 1],
] as const) {
  document
    .querySelector(`[data-act="${act}"]`)
    ?.addEventListener("click", () => jump(firstStepOf(workspaces, index)));
}

// ---- layout changes between wide and touch
// and when the screen's size or the fonts change what fits a page
function onLayoutChange(): void {
  swipe.reset();
  swiping = 0;
  if (touch.matches) fitEntries();
  pageCache.clear();
  screen = 0;
  place(step, false);
}
touch.addEventListener("change", onLayoutChange);

/** The entries a paged window shows on a screen, as the cache has them now. */
const entriesOf: EntriesOf = (s, id) => {
  const tile = s.layout[id];
  return tile ? (pagesOf(id, tile)[s.pages[id] ?? 0] ?? []) : [];
};

/**
 * What fits a page changed: measure again and stay on the same content. The
 * screen that held what was on show may have another index now (the timeline
 * over fewer screens, say), so it is found by its first entry, not its index.
 */
function remeasure(): void {
  if (!touch.matches) return;
  fitEntries();
  const before = screensAt(step, open)[screen];
  const anchor = before && anchorOf(before, entriesOf);
  pageCache.clear();
  if (anchor) screen = screenHolding(screensAt(step, open), anchor, entriesOf);
  place(step, false);
}
/**
 * Open the timeline's entries to what the screen holds. Always before the
 * step's screens are counted, so the timeline is never more than one screen.
 */
function fitEntries(): void {
  for (let n = 0; n < steps; n++) {
    const tile = screensOf(stepAt(workspaces, n), false)[0]?.timeline;
    if (!tile) continue;
    fitTimeline(tile);
    return;
  }
}
let measured = "";
addEventListener("resize", () => {
  const size = `${area.clientWidth}x${area.clientHeight}`;
  if (size === measured) return;
  measured = size;
  remeasure();
});
document.fonts?.ready.then(remeasure);

// ---- boot
// the entry page says which step its address opens
history.scrollRestoration = "manual";
step = Math.max(0, Math.min(steps - 1, Number(area.dataset.bootStep ?? 0)));
area.dataset.open = "false";
// /archive/ and an archive project's address boot with the archive open
const bootArchive = notFound
  ? undefined
  : book.forPath(location.pathname)?.archive;
if (bootArchive !== undefined && archiveEl && inProjects()) {
  open = true;
  area.dataset.open = "true";
  screen = screenOfEntry(bootArchive);
  announce();
  markEntry(bootArchive);
  staggerEntries();
}
if (touch.matches) fitEntries();
place(step, false);
area.dataset.retiling ??= "false";
// the first appearance: every window slides in, and any input waits for them
if (shown && placed && !reduced.matches) {
  gate.moving();
  area.dataset.retiling = "true";
  placedEnds = { from: null, to: placed };
  appearing = latest = appearBetween(shown);
}
area.dataset.ready = "true";
