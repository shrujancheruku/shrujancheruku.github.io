// The window manager: places the windows of the current step, re-tiles them
// with GSAP Flip when the step changes, and turns wheel, keys and clicks into
// steps. On touch the document scrolls natively with scroll-snap and this
// script only follows the scroll position.
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { Observer } from "gsap/Observer";
import { interpretKey } from "../lib/keys";
import { createWheelGate } from "../lib/wheel-gate";
import {
  firstStepOf,
  type Layout,
  locate,
  stepAfter,
  stepAt,
  stepCount,
  type Workspace,
} from "../lib/workspaces";

gsap.registerPlugin(Flip, Observer);

/** How long a re-tile takes, in seconds. */
const RETILE = 0.85;

const found = document.querySelector<HTMLElement>("main.area");
const modelEl = document.getElementById("desktop-model");
if (!found || !modelEl) throw new Error("the desktop is missing its markup");
const area: HTMLElement = found;

const workspaces: Workspace[] = JSON.parse(modelEl.textContent ?? "[]");
const steps = stepCount(workspaces);
const panes = [...area.querySelectorAll<HTMLElement>(".pane")];
const numbers = [
  ...document.querySelectorAll<HTMLButtonElement>(".ws button[data-workspace]"),
];
const touch = matchMedia("(max-width: 760px)");

let step = 0;

const layoutOf = (n: number): Layout => {
  const s = stepAt(workspaces, n);
  return touch.matches ? s.touch : s.desktop;
};

/** Put the windows of a step in place; animate from where they are if asked. */
function place(n: number, animate: boolean): void {
  const layout = layoutOf(n);
  const focus = stepAt(workspaces, n).focus;
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

  const { workspace } = locate(workspaces, n);
  area.dataset.step = String(n);
  area.dataset.workspace = String(workspace);
  for (const [i, b] of numbers.entries()) {
    if (i === workspace) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  }

  if (state) {
    Flip.from(state, {
      targets: panes,
      duration: RETILE,
      ease: "expo.out",
      // animate width and height, so text is re-set rather than stretched
      scale: false,
      overwrite: true,
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
  }
}

/** Move to a step: re-tile on a wide screen, scroll the page on touch. */
function goTo(n: number): void {
  const next = Math.max(0, Math.min(steps - 1, n));
  if (touch.matches) {
    // the scroll handler follows
    window.scrollTo({ top: next * innerHeight, behavior: "instant" });
    return;
  }
  if (next === step) return;
  step = next;
  place(step, true);
}

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
    step = n;
    place(step, true);
  },
  { passive: true },
);

// ---- wide: one step per wheel gesture, through Observer
const gate = createWheelGate({
  lockMs: RETILE * 1000,
  quietMs: 120,
  threshold: 40,
});

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

const wheel = Observer.create({
  target: window,
  type: "wheel",
  onWheel: (self) => {
    const e = self.event as WheelEvent;
    if (e.ctrlKey || scrollsInside(e.target, e.deltaY)) return;
    const direction = gate.feed(e.timeStamp, e.deltaY);
    if (direction) goTo(stepAfter(workspaces, step, direction));
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
  const command = interpretKey(e, workspaces.length);
  if (!command) return;
  if (command.type === "workspace") {
    e.preventDefault();
    goTo(firstStepOf(workspaces, command.index));
  } else if (!e.repeat) {
    e.preventDefault();
    goTo(stepAfter(workspaces, step, command.direction));
  }
});

for (const b of numbers) {
  b.addEventListener("click", () =>
    goTo(firstStepOf(workspaces, Number(b.dataset.workspace))),
  );
}

// a link inside a window jumps to its workspace: a deliberate jump, so it adds a history entry
for (const el of area.querySelectorAll<HTMLElement>("[data-jump]")) {
  el.addEventListener("click", () => {
    goTo(firstStepOf(workspaces, Number(el.dataset.jump)));
    if (el.dataset.address) history.pushState(null, "", el.dataset.address);
  });
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
step = touch.matches
  ? Math.max(0, Math.min(steps - 1, Math.round(scrollY / innerHeight)))
  : 0;
if (touch.matches) wheel.disable();
place(step, false);
area.dataset.ready = "true";
