// The window manager: places the windows of the current step, re-tiles them
// with GSAP Flip when the step changes, and turns wheel, keys and clicks into
// steps. On touch the document scrolls natively with scroll-snap and this
// script only follows the scroll position.
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { Observer } from "gsap/Observer";
import {
  notFoundTitle as NOT_FOUND_TITLE,
  openAddresses,
} from "../lib/addresses";
import { interpretKey } from "../lib/keys";
import { windowChanges } from "../lib/signals";
import { createWheelGate } from "../lib/wheel-gate";
import {
  firstStepOf,
  focusOf,
  type Layout,
  locate,
  stepAfter,
  stepAt,
  stepCount,
  tilingOf,
  type Workspace,
} from "../lib/workspaces";

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
/** The layout on show, to tell the windows that come and go. */
let shown: Layout | null = null;
/** The current step's disclosure (Education & Internships) is open. */
let open = false;
/** An unknown path booted the desktop: the not-found terminal is on show. */
let notFound = area.dataset.notFound === "true";
/** The archive entered the address bar as a history entry of its own (Back closes it). */
let archivePushed = false;
/** An archive open that waits for a scroll to its step (touch). */
let pendingArchive: string | null = null;
const archiveEl = area.querySelector<HTMLElement>(
  '.pane[data-window="archive"]',
);

const layoutOf = (n: number): Layout =>
  tilingOf(stepAt(workspaces, n), touch.matches ? "touch" : "desktop", open);

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
  const layout = layoutOf(n);
  const focus = focusOf(stepAt(workspaces, n), open);
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

  showNotFound();
  signal(shown, layout);
  shown = layout;

  const { workspace, index } = locate(workspaces, n);
  markStack(workspaces[workspace]?.id === "projects" ? index : -1);
  area.dataset.step = String(n);
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
  if (waiting) scrollStep(waiting);
}

/** Whether the step's disclosure is the archive (the projects workspace's). */
const inProjects = (): boolean =>
  workspaces[locate(workspaces, step).workspace]?.id === "projects";

/** Tell the page the disclosure changed: Education's cue, or the archive's openers. */
function announce(): void {
  const kind = inProjects() ? "archive" : "open";
  if (kind === "archive") {
    for (const b of document.querySelectorAll("[data-archive-open]"))
      b.setAttribute("aria-expanded", String(open));
  }
  document.dispatchEvent(
    new CustomEvent(`desktop:${kind}`, { detail: { open } }),
  );
}

/** Open or close the step's disclosure; the windows re-tile and listen for the event. */
function setOpen(next: boolean, animate = true): void {
  if (next === open) return;
  if (next && !stepAt(workspaces, step).open) return;
  open = next;
  if (!open) archivePushed = false;
  area.dataset.open = String(open);
  place(step, animate);
  announce();
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
  setOpen(true);
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
  if (target?.closest("[data-archive-open]")) {
    if (open) closeArchive();
    else openArchive();
  }
  if (target?.closest("[data-archive-close]")) closeArchive();
});

/** Move to a step: re-tile on a wide screen, scroll the page on touch. */
function goTo(n: number): void {
  const next = Math.max(0, Math.min(steps - 1, n));
  if (touch.matches) {
    // the scroll handler follows
    window.scrollTo({ top: next * innerHeight, behavior: "instant" });
    return;
  }
  if (next === step) return;
  leave();
  step = next;
  place(step, true);
  follow(step);
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
  leave();
  step = next;
  if (address?.archive !== undefined && archiveEl) {
    open = true;
    area.dataset.open = "true";
    announce();
    markEntry(address.archive);
    staggerEntries();
  }
  place(step, true);
  if (touch.matches)
    window.scrollTo({ top: step * innerHeight, behavior: "instant" });
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
  if (n !== step) {
    jump(n);
    if (touch.matches) pendingArchive = archive;
    else openArchive(archive);
  } else {
    openArchive(archive);
  }
  return true;
}

/** One scroll step up or down: follows the address without a history entry. */
export function scrollStep(direction: 1 | -1): void {
  goTo(stepAfter(workspaces, step, direction));
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

// ---- touch: follow native scroll-snap
addEventListener(
  "scroll",
  () => {
    if (!touch.matches) return;
    const n = Math.max(
      0,
      Math.min(steps - 1, Math.round(scrollY / innerHeight)),
    );
    if (n === step) return;
    leave();
    step = n;
    place(step, true);
    follow(step);
    if (pendingArchive !== null) {
      const slug = pendingArchive;
      pendingArchive = null;
      openArchive(slug);
    }
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

const wheel = Observer.create({
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
    if (direction) scrollStep(direction);
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
    scrollStep(command.direction);
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
function onLayoutChange(): void {
  if (touch.matches) {
    wheel.disable();
    window.scrollTo({ top: step * innerHeight, behavior: "instant" });
  } else {
    wheel.enable();
  }
  place(step, false);
}
touch.addEventListener("change", onLayoutChange);

let resizing: ReturnType<typeof setTimeout>;
addEventListener("resize", () => {
  clearTimeout(resizing);
  resizing = setTimeout(() => {
    if (touch.matches) {
      window.scrollTo({ top: step * innerHeight, behavior: "instant" });
    }
  }, 120);
});

// ---- boot
// the entry page says which step its address opens
history.scrollRestoration = "manual";
step = Math.max(0, Math.min(steps - 1, Number(area.dataset.bootStep ?? 0)));
if (touch.matches) {
  window.scrollTo({ top: step * innerHeight, behavior: "instant" });
  wheel.disable();
}
area.dataset.open = "false";
// /archive/ and an archive project's address boot with the archive open
const bootArchive = notFound
  ? undefined
  : book.forPath(location.pathname)?.archive;
if (bootArchive !== undefined && archiveEl && inProjects()) {
  open = true;
  area.dataset.open = "true";
  announce();
  markEntry(bootArchive);
  staggerEntries();
}
place(step, false);
area.dataset.retiling ??= "false";
area.dataset.ready = "true";
