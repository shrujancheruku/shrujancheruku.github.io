// The window manager: places the windows of the current step, moves them with
// one GSAP timeline when the step changes (src/lib/motion.ts says how), and
// turns wheel, keys and clicks into steps. On touch nothing scrolls: a swipe is
// one gesture and moves one screen, like a wheel flick moves one step
// (src/lib/swipe.ts). A step is one or more screens on touch
// (src/lib/screens.ts), the same step and address.
// Where the visitor is, and what to do with each input (wait, run, or turn the
// running motion back), is the navigator's (src/lib/navigator.ts): this script
// carries out what it says, and plays the motions.
import { gsap } from "gsap";
import { Observer } from "gsap/Observer";
import { interpretKey } from "../lib/keys";
import {
  appearEdgeOf,
  collapsed,
  edgeOf,
  rollOf,
  sortChanges,
  travelOf,
} from "../lib/motion";
import { createNavigator, type Outcome, type Where } from "../lib/navigator";
import { focusAmong, type Screen } from "../lib/screens";
import { windowChanges } from "../lib/signals";
import { createStepScreens } from "../lib/step-screens";
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
import { layoutReader } from "./layout-reader";
import { addresses, model } from "./page-data";
import { type Paged, pagedOf, showPage } from "./paged";

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

const archiveEl = area.querySelector<HTMLElement>(
  '.pane[data-window="archive"]',
);

/**
 * Where the visitor is, and what the history holds (src/lib/navigator.ts):
 * every input goes to it, and `carry` does what it says.
 */
const navigator = createNavigator({
  workspaces,
  book,
  screens: (n, opened) => screensAt(n, opened).length,
  screenOfEntry: (n, slug) => stepScreens.screenOfEntry(n, slug),
  hasArchive: archiveEl !== null,
});

const inProjects = (n: number): boolean =>
  workspaces[locate(workspaces, n).workspace]?.id === "projects";

// ---- screens
// A step's screens on touch are the step-screens module's (src/lib/
// step-screens.ts), which reads the windows through the layout reader. This
// stays for the timeline step's two phone screens (#108, see src/lib/
// screens.ts); the archive pages the same way.

const windowOf = new Map(panes.map((p) => [p.dataset.window ?? "", p]));
const pagedByWindow = new Map<string, Paged | undefined>();
/** The paged parts of a window, to show a page of its entries. */
const pagedWindow = (id: string): Paged | undefined => {
  if (!pagedByWindow.has(id)) {
    const pane = windowOf.get(id);
    pagedByWindow.set(id, pane && pagedOf(pane));
  }
  return pagedByWindow.get(id);
};

const stepScreens = createStepScreens({
  steps,
  touch: () => touch.matches,
  layouts: (n, opened) => screensOf(stepAt(workspaces, n), opened),
  // the stack's height is in px: the area's live height resolves it (#160)
  wide: (n, opened) =>
    tilingOf(stepAt(workspaces, n), opened, area.clientHeight),
  reader: layoutReader(panes),
});

/** The screens of step `n`; `opened` says whether its disclosure is open. */
const screensAt = (n: number, opened: boolean): Screen[] =>
  stepScreens.screens(n, opened);

/** Whether the not-found terminal is on show, as the navigator last placed it. */
let notFoundShown = false;

/** The not-found terminal floats over the opening until the first jump. */
function showNotFound(): void {
  if (!notFoundPane) return;
  if (!notFoundShown) {
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
interface Shown {
  /** Its screen as placed: brought in to the screens the step has. */
  where: Where;
  layout: Layout;
  pages: Readonly<Record<string, number>>;
  screens: number;
  focus: string | undefined;
}
/** The layout on show, as placed. */
let shown: Shown | null = null;

/** The screen a place shows, its screen brought in to the screens there are. */
function screenAt(where: Where): Shown {
  const screens = screensAt(where.step, where.open);
  const screen = Math.max(0, Math.min(screens.length - 1, where.screen));
  const { layout, pages } = screens[screen] ?? { layout: {}, pages: {} };
  return {
    where: { ...where, screen },
    layout,
    pages,
    screens: screens.length,
    focus: focusAmong(
      layout,
      focusOf(stepAt(workspaces, where.step), where.open),
    ),
  };
}

/** Whether place `a` comes before `b` in the order of steps, then screens. */
const isBefore = (a: Where, b: Where): boolean =>
  a.step < b.step || (a.step === b.step && a.screen < b.screen);

/** Tell the page which layout is on show: its windows' slots, the step, the status bar. */
function record(p: Shown): void {
  for (const pane of panes)
    pane.classList.toggle("focus", pane.dataset.window === p.focus);
  signal(shown?.layout ?? null, p.layout);
  shown = p;
  const { workspace, index } = locate(workspaces, p.where.step);
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
      touch.matches ? stepScreens.pagesOf(id, tile)[pages[id] ?? 0] : undefined,
    );
  }
  showNotFound();
}

/**
 * Turn the running motion back: it reverses from where the windows are, to
 * `to`, where it began. Turned back again, it plays forwards.
 */
function turnBack(to: Where): void {
  const timeline = latest;
  if (!timeline) {
    // nothing moves after all: the windows go there at rest
    place(to, false);
    ended();
    return;
  }
  record(screenAt(to));
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
  if (shown) writeRest(shown.layout, shown.pages);
  settled(timeline);
}

/**
 * Put the windows where `to` says; animate from where they are if asked. A
 * motion this stops, or one asked for that does not run (reduced motion),
 * ends here: the navigator hears `ended`.
 */
function place(to: Where, animate: boolean): void {
  const next = screenAt(to);
  const before = shown;
  // a re-measure that changes nothing lets the first appearance run on
  if (
    !animate &&
    appearing &&
    appearing === latest &&
    JSON.stringify(before?.layout) === JSON.stringify(next.layout)
  )
    return;
  const sameScreens =
    touch.matches &&
    before !== null &&
    before.where.step === to.step &&
    before.where.open === to.open;
  const sameLayout =
    sameScreens &&
    JSON.stringify(before.layout) === JSON.stringify(next.layout);
  const direction = !before || !isBefore(next.where, before.where) ? 1 : -1;
  const sameWorkspace =
    before !== null &&
    locate(workspaces, before.where.step).workspace ===
      locate(workspaces, to.step).workspace;
  // a motion still running ends here: its windows go to rest first
  const stopped = stopMotion();
  turning = [];

  const moving = animate && before !== null && !reduced.matches;
  writeRest(
    next.layout,
    next.pages,
    moving && sameLayout ? before.pages : undefined,
  );
  record(next);

  if (moving && before) {
    // the wheel stays open, so a gesture that turns the motion back reaches
    // the navigator; the gesture's own tail stays tail until the motion ends
    gate.moving();
    // for the page and its tests: a motion is running until `settled`
    area.dataset.retiling = "true";
    latest = motionBetween(
      before.layout,
      next.layout,
      sameWorkspace,
      direction,
      sameScreens && !sameLayout,
    );
  } else if (stopped || animate) {
    area.dataset.retiling = "false";
    gate.still();
    ended();
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
 * A copy of `el` that is only seen: marked as a clone, with no ids, hidden from
 * assistive technology and inert.
 */
function inertClone(el: HTMLElement): HTMLElement {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.removeAttribute("id");
  for (const e of copy.querySelectorAll("[id]")) e.removeAttribute("id");
  copy.dataset.clone = "true";
  copy.setAttribute("aria-hidden", "true");
  copy.inert = true;
  return copy;
}

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
  const old = inertClone(list);
  old.removeAttribute("data-paged");
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
 * re-tile beside it.
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
      mover = inertClone(pane);
      mover.removeAttribute("data-window");
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
 * re-tile. When the newest ends, the navigator hears `ended` (the input that
 * waited for it runs from rest), and `data-retiling` stays true until the last
 * motion of the chain ends.
 */
let latest: gsap.core.Timeline | null = null;
function settled(motion: gsap.core.Timeline): void {
  if (motion !== latest) return;
  latest = null;
  gate.still();
  ended();
  if (!latest) area.dataset.retiling = "false";
}

/** No motion runs any more: what waited for it runs. */
function ended(): void {
  carry(navigator.take({ kind: "ended" }));
}

/**
 * Do what the navigator says: the history first, in order (the only place
 * the page touches it), then each place at rest on the way, then the motion.
 */
function carry(outcome: Outcome): void {
  for (const effect of outcome.history) {
    if ("push" in effect) history.pushState(null, "", effect.push);
    else if ("replace" in effect)
      history.replaceState(null, "", effect.replace);
    else if ("back" in effect) history.back();
    else document.title = effect.title;
  }
  if (outcome.motion === "none") return;
  notFoundShown = outcome.notFound;
  let from = outcome.from;
  for (const at of outcome.rest) {
    disclose(from, at);
    place(at, false);
    from = at;
  }
  disclose(from, outcome.to);
  if (outcome.motion === "turn back") turnBack(outcome.to);
  else place(outcome.to, outcome.motion === "animate");
  if (outcome.entry !== undefined) {
    markEntry(outcome.entry);
    staggerEntries();
  }
}

/** What opens the archive: the projects' opener, and its phone screen's. */
const ARCHIVE_OPENERS = "[data-archive-open], [data-archive-phone]";

/**
 * A disclosure opens or closes between two places: tell the page, before the
 * windows are measured (the disclosure's window shows its entries first).
 */
function disclose(from: Where | null, to: Where): void {
  const sameStep = from !== null && from.step === to.step;
  const wasOpen = from?.open === true;
  const closes = wasOpen && !(to.open && sameStep);
  const opens = to.open && !(wasOpen && sameStep);
  if (closes && from) announce(from.step, false);
  if (opens) announce(to.step, true);
  if (!closes && !opens) return;
  area.dataset.open = String(to.open);
  stepScreens.changed();
}

/** Tell the page step `n`'s disclosure changed: Education's cue, or the archive's openers. */
function announce(n: number, opened: boolean): void {
  const kind = inProjects(n) ? "archive" : "open";
  if (kind === "archive") {
    for (const b of document.querySelectorAll(ARCHIVE_OPENERS))
      b.setAttribute("aria-expanded", String(opened));
  }
  document.dispatchEvent(
    new CustomEvent(`desktop:${kind}`, { detail: { open: opened } }),
  );
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

document.addEventListener("click", (e) => {
  const target = e.target as Element | null;
  const { open } = navigator.where;
  if (target?.closest("[data-disclosure]"))
    carry(navigator.take({ kind: "disclosure", open: !open }));
  if (target?.closest(ARCHIVE_OPENERS))
    carry(navigator.take({ kind: "archive", open: !open }));
  if (target?.closest("[data-archive-close]"))
    carry(navigator.take({ kind: "archive", open: false }));
});

// ---- the address bar
// Scrolling updates the address and the tab title and adds no history entry; a
// deliberate jump adds one (the navigator says which).

addEventListener("popstate", () =>
  carry(navigator.take({ kind: "popstate", path: location.pathname })),
);

/**
 * A deliberate jump to a step: adds a history entry (unless it is where we
 * already are), so Back undoes it. Status bar items, workspace numbers and
 * keys, and links use this.
 */
export function jump(n: number): void {
  carry(navigator.take({ kind: "jump", step: n }));
}

/** A deliberate jump to an address of the site; false if the path is not one. */
export function jumpToPath(path: string): boolean {
  const outcome = navigator.take({ kind: "path", path });
  carry(outcome);
  return outcome.handled;
}

/**
 * One screen up or down: on a wide screen a step is one screen, so this is one
 * step. Follows the address without a history entry.
 */
export function moveOneScreen(direction: 1 | -1): void {
  carry(navigator.take({ kind: "move", direction }));
}

/** The global step on show. */
export const currentStep = (): number => navigator.where.step;

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
  const { step, open } = navigator.where;
  if (e.key === "Escape" && open && inProjects(step)) {
    e.preventDefault();
    carry(navigator.take({ kind: "archive", open: false }));
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
for (const [cue, index] of [
  ["home", 0],
  ["contact", workspaces.length - 1],
] as const) {
  document
    .querySelector(`[data-act="${cue}"]`)
    ?.addEventListener("click", () => jump(firstStepOf(workspaces, index)));
}

function onLayoutChange(): void {
  swipe.reset();
  swiping = 0;
  stepScreens.changed();
  carry(navigator.take({ kind: "refit", screen: 0 }));
}
touch.addEventListener("change", onLayoutChange);

/**
 * What fits a page changed: measure again and stay on the same content. The
 * screen that held what was on show may have another index now (the timeline
 * over fewer screens, say), so the module finds it by its first entry.
 */
function remeasure(): void {
  const at = shown?.where ?? navigator.where;
  if (!touch.matches) {
    // a wide tiling in px (the stack's rows) follows the area's new height
    if (
      JSON.stringify(screensAt(at.step, at.open)[0]?.layout) !==
      JSON.stringify(shown?.layout)
    )
      carry(navigator.take({ kind: "refit" }));
    return;
  }
  const screen = stepScreens.changed(at);
  carry(navigator.take({ kind: "refit", screen }));
}
let measured = "";
addEventListener("resize", () => {
  const size = `${area.clientWidth}x${area.clientHeight}`;
  if (size === measured) return;
  measured = size;
  remeasure();
});
document.fonts?.ready.then(remeasure);

/** The first appearance: every window slides in, and any input waits for them. */
function appear(): void {
  if (!shown || reduced.matches) {
    ended();
    return;
  }
  gate.moving();
  area.dataset.retiling = "true";
  appearing = latest = appearBetween(shown.layout);
}

// ---- boot
// the entry page says which step its address opens
history.scrollRestoration = "manual";
area.dataset.open = "false";
area.dataset.retiling ??= "false";
// /archive/ and an archive project's address boot with the archive open
const boot = navigator.take({
  kind: "boot",
  path: location.pathname,
  step: Number(area.dataset.bootStep ?? 0),
  notFound: area.dataset.notFound === "true",
});
carry({ ...boot, motion: "place" });
appear();
area.dataset.ready = "true";
