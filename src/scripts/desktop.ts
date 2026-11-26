// The window manager: places the windows of the current step, re-tiles them
// with GSAP Flip when the step changes, and turns wheel, keys and clicks into
// steps. On touch nothing scrolls: a swipe is one gesture and moves one
// screen, like a wheel flick moves one step (src/lib/swipe.ts). A step is one
// or more screens on touch (src/lib/screens.ts), the same step and address.
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { Observer } from "gsap/Observer";
import {
  notFoundTitle as NOT_FOUND_TITLE,
  openAddresses,
} from "../lib/addresses";
import { interpretKey } from "../lib/keys";
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
  screensOf,
  stepAt,
  stepCount,
  tilingOf,
  type Workspace,
} from "../lib/workspaces";
import { measurePages, type Paged, pagedOf, showPage } from "./paged";

gsap.registerPlugin(Flip, Observer);

/** How long a re-tile takes, in seconds. */
const RETILE = 0.85;
/** One step per wheel gesture; held shut while a re-tile runs. */
const gate = createWheelGate({ tailMs: 500, steadyMs: 150, threshold: 40 });

const found = document.querySelector<HTMLElement>("main.area");
const modelEl = document.getElementById("desktop-model");
if (!found || !modelEl) throw new Error("the desktop is missing its markup");
const area: HTMLElement = found;

const addressEl = document.getElementById("desktop-addresses");
if (!addressEl) throw new Error("the desktop is missing its addresses");
const book = openAddresses(JSON.parse(addressEl.textContent ?? "{}"));

const workspaces: Workspace[] = JSON.parse(modelEl.textContent ?? "[]");
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

/** Put the windows of a step in place; animate from where they are if asked. */
function place(n: number, animate: boolean): void {
  const screens = screensAt(n, open);
  screen = Math.max(0, Math.min(screens.length - 1, screen));
  const { layout, pages } = screens[screen] ?? { layout: {}, pages: {} };
  const focus = focusAmong(layout, focusOf(stepAt(workspaces, n), open));
  const state = animate ? Flip.getState(panes) : null;

  let z = 1;
  for (const pane of panes) {
    const rect = layout[pane.dataset.window ?? ""];
    pane.classList.toggle("focus", pane.dataset.window === focus);
    if (!rect) {
      pane.style.display = "none";
      continue;
    }
    const [left, top, width, height] = rect;
    Object.assign(pane.style, {
      display: "block",
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
      zIndex: String(z++),
    });
  }

  // the entries of a paged window: its page on touch, all of them wide
  for (const pane of panes) {
    const id = pane.dataset.window ?? "";
    const paged = pagedWindow(id);
    const tile = layout[id];
    if (!paged || !tile) continue;
    showPage(
      paged,
      touch.matches ? pagesOf(id, tile)[pages[id] ?? 0] : undefined,
    );
  }

  showNotFound();
  signal(shown, layout);
  shown = layout;

  const { workspace, index } = locate(workspaces, n);
  markStack(workspaces[workspace]?.id === "projects" ? index : -1);
  area.dataset.step = String(n);
  area.dataset.screen = String(screen);
  area.dataset.screens = String(screens.length);
  area.dataset.workspace = String(workspace);
  for (const [i, b] of numbers.entries()) {
    if (i === workspace) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  }

  if (state) {
    // the wheel stays shut for the whole re-tile, which on a busy page starts
    // late and ends well after the wheel event that asked for it
    gate.hold();
    // for the page and its tests: a re-tile is running until `settled`
    area.dataset.retiling = "true";
    const retiling = Flip.from(state, {
      targets: panes,
      duration: RETILE,
      ease: "expo.out",
      // animate width and height, so text is re-set rather than stretched
      scale: false,
      overwrite: true,
      onComplete: () => settled(retiling),
      onInterrupt: () => settled(retiling),
      onEnter: (els) =>
        gsap.fromTo(
          els,
          { opacity: 0, scale: 0.94 },
          { opacity: 1, scale: 1, duration: RETILE, ease: "expo.out" },
        ),
      onLeave: (els) =>
        gsap.to(els, {
          opacity: 0,
          scale: 0.94,
          duration: RETILE * 0.45,
          ease: "expo.out",
        }),
    });
    latest = retiling;
  }
}

/**
 * The newest re-tile; one that a later one overwrote does not open the wheel.
 * When the newest ends, a wheel gesture that came during it steps now.
 */
let latest: gsap.core.Timeline | null = null;
function settled(retiling: gsap.core.Timeline): void {
  if (retiling !== latest) return;
  area.dataset.retiling = "false";
  const waiting = gate.release();
  if (waiting) moveOneScreen(waiting);
}

/** Whether the step's disclosure is the archive (the projects workspace's). */
const inProjects = (): boolean =>
  workspaces[locate(workspaces, step).workspace]?.id === "projects";

/** Tell the page the disclosure changed: Education's cue, or the archive's openers. */
function announce(): void {
  const kind = inProjects() ? "archive" : "open";
  if (kind === "archive") {
    for (const b of document.querySelectorAll(
      "[data-archive-open], [data-archive-phone]",
    ))
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
  if (archivePushed) {
    // Back to the address underneath; popstate re-tiles
    archivePushed = false;
    history.back();
    return;
  }
  const address = book.forStep(step);
  history.replaceState(null, "", address.path);
  document.title = address.title;
  setOpen(false);
}

const ARCHIVE_PATH = "/archive/";

document.addEventListener("click", (e) => {
  const target = e.target as Element | null;
  const cue = target?.closest("[data-disclosure]");
  if (cue) setOpen(!open);
  if (target?.closest("[data-archive-open], [data-archive-phone]")) {
    if (open) closeArchive();
    else openArchive();
  }
  if (target?.closest("[data-archive-close]")) closeArchive();
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
  if (notFound) return;
  const address = book.forStep(n);
  document.title = address.title;
  if (
    location.pathname !== address.path &&
    book.stepFor(location.pathname) !== n
  ) {
    history.replaceState(null, "", address.path);
  }
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
addEventListener("popstate", restore);

/**
 * A deliberate jump to a step: adds a history entry (unless it is where we
 * already are), so Back undoes it. Status bar items, workspace numbers and
 * keys, and links use this.
 */
export function jump(n: number): void {
  const next = Math.max(0, Math.min(steps - 1, n));
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
  if (n !== step) jump(n);
  openArchive(archive);
  return true;
}

/**
 * One screen up or down: on a wide screen a step is one screen, so this is one
 * step. Follows the address without a history entry.
 */
export function moveOneScreen(direction: 1 | -1): void {
  const next = moveBy(
    { step, screen },
    direction,
    (n) => screensAt(n, n === step && open).length,
    steps,
  );
  goTo(next.step, next.screen);
}

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

const fingerOf = (e: PointerEvent) => ({
  id: e.pointerId,
  x: e.clientX,
  y: e.clientY,
  time: e.timeStamp,
});

// Pointer events, not touch events: the browser can hand a gesture to its own
// handling and stop sending `touchmove`, but the pointer stream keeps coming.
document.addEventListener(
  "pointerdown",
  (e) => {
    if (fingerEvent(e)) swipe.down(fingerOf(e), e.isPrimary, zoom());
  },
  { passive: true },
);
document.addEventListener(
  "pointermove",
  (e) => {
    if (!fingerEvent(e)) return;
    const direction = swipe.move(fingerOf(e));
    if (direction) moveOneScreen(direction);
  },
  { passive: true },
);
document.addEventListener(
  "pointerup",
  (e) => {
    if (!fingerEvent(e)) return;
    const direction = swipe.up(fingerOf(e));
    if (direction) moveOneScreen(direction);
  },
  { passive: true },
);
document.addEventListener(
  "pointercancel",
  (e) => {
    if (fingerEvent(e)) swipe.cancel(e.pointerId);
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
    closeArchive();
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
  const before = screensAt(step, open)[screen];
  const anchor = before && anchorOf(before, entriesOf);
  pageCache.clear();
  if (anchor) screen = screenHolding(screensAt(step, open), anchor, entriesOf);
  place(step, false);
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
place(step, false);
area.dataset.retiling ??= "false";
area.dataset.ready = "true";
