// The window manager: places the windows of the current step, moves them when
// the step changes (src/lib/motion.ts plans the motion, src/scripts/
// motion-player.ts plays it), and turns wheel, keys and clicks into steps. On
// touch nothing scrolls: a swipe is one gesture and moves one screen, like a
// wheel flick moves one step (src/lib/swipe.ts). A step is one or more screens on touch
// (src/lib/screens.ts), the same step and address.
// Where the visitor is, and what to do with each input (wait, run, or turn the
// running motion back), is the navigator's (src/lib/navigator.ts): this script
// carries out what it says, and hands each motion's plan to the player.
import { gsap } from "gsap";
import { Observer } from "gsap/Observer";
import { interpretKey } from "../lib/keys";
import { type Plan, planMotion } from "../lib/motion";
import { createNavigator, type Outcome, type Where } from "../lib/navigator";
import { focusAmong, type Screen } from "../lib/screens";
import { windowChanges } from "../lib/signals";
import { createStepScreens } from "../lib/step-screens";
import { createSwipe, UNZOOMED } from "../lib/swipe";
import { createWheelGate } from "../lib/wheel-gate";
import {
  firstStepOf,
  focusOf,
  inProjects,
  type Layout,
  locate,
  screensOf,
  stepAt,
  stepCount,
  tilingOf,
  type Workspace,
} from "../lib/workspaces";
import { layoutReader, pagedWindows } from "./layout-reader";
import { createMotionPlayer, css } from "./motion-player";
import { addresses, model } from "./page-data";
import { showPage } from "./paged";

gsap.registerPlugin(Observer);

/** Reduced motion: no motion is played, the windows are simply there. */
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

// ---- screens
// A step's screens on touch are the step-screens module's (src/lib/
// step-screens.ts), which reads the windows through the layout reader. This
// stays for the timeline step's two phone screens (#108, see src/lib/
// screens.ts); the archive pages the same way.

const windowOf = new Map(panes.map((p) => [p.dataset.window ?? "", p]));
/** The paged parts of a window, to show a page of its entries. */
const pagedWindow = pagedWindows(windowOf);

/** Plays the motions (src/lib/motion.ts plans them). */
const player = createMotionPlayer({
  area,
  windows: windowOf,
  paged: pagedWindow,
  atStart: () => {
    if (shown) writeRest(shown.layout, shown.pages);
  },
  settled: () => settled(),
});

const stepScreens = createStepScreens({
  steps,
  touch: () => touch.matches,
  layouts: (n, opened) => screensOf(stepAt(workspaces, n), opened),
  // the stack's height is in px: the area's live height resolves it (#160)
  wide: (n, opened) =>
    tilingOf(stepAt(workspaces, n), opened, area.clientHeight),
  reader: layoutReader(pagedWindow),
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
  /** The workspace the step is in. */
  workspace: number;
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
    workspace: locate(workspaces, where.step).workspace,
    layout,
    pages,
    screens: screens.length,
    focus: focusAmong(
      layout,
      focusOf(stepAt(workspaces, where.step), where.open),
    ),
  };
}

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
 * paged window on its page. With a `plan`, a paged window that turns its page
 * first leaves a copy of its old page to turn.
 */
function writeRest(
  layout: Layout,
  pages: Readonly<Record<string, number>>,
  plan?: Plan,
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
  if (plan) player.prepare(plan);
  // the entries of a paged window: its page on touch, all of them wide
  for (const pane of panes) {
    const id = pane.dataset.window ?? "";
    const paged = pagedWindow(id);
    const tile = layout[id];
    if (!paged || !tile) continue;
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
  if (!player.motion) {
    // nothing moves after all: the windows go there at rest
    place(to, false);
    ended();
    return;
  }
  record(screenAt(to));
  player.reverse();
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
    player.motion === "first appearance" &&
    JSON.stringify(before?.layout) === JSON.stringify(next.layout)
  )
    return;
  // a motion still running ends here: its windows go to rest first
  const stopped = player.stop();

  const plan =
    animate && before !== null && !reduced.matches
      ? planMotion(before, next, touch.matches)
      : null;
  writeRest(next.layout, next.pages, plan ?? undefined);
  record(next);

  if (plan) {
    // the wheel stays open, so a gesture that turns the motion back reaches
    // the navigator; the gesture's own tail stays tail until the motion ends
    gate.moving();
    // for the page and its tests: a motion is running until `settled`
    area.dataset.retiling = "true";
    player.play(plan);
  } else if (stopped || animate) {
    area.dataset.retiling = "false";
    gate.still();
    ended();
  }
}

/** The motion's end: the wheel settles, and what waited for it runs. */
function settled(): void {
  gate.still();
  ended();
  if (!player.motion) area.dataset.retiling = "false";
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
  const kind = inProjects(workspaces, n) ? "archive" : "open";
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
  if (e.key === "Escape" && open && inProjects(workspaces, step)) {
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
  player.play(planMotion(null, shown, touch.matches));
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
