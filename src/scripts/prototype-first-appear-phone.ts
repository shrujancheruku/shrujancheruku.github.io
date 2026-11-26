// PROTOTYPE, throwaway (map #110, ticket #142): how the windows first appear
// on a phone. Five variants, switchable via `?appear=` and the floating bar
// ([ ], or the arrows on the bar). "replay" runs it again without reloading; a
// reload at any address shows it for real. "timing" flips between the wide
// screen's timing (0.32 s each, 50 ms apart, #126) and a tighter one. Dev
// only, phone only (max-width 760px), never with reduced motion.
//
// The thing to see: every phone tile spans the full width, so the wide
// screen's edge rule (right, else bottom, left, top) sends every window out of
// the right edge. Variant B is that rule applied literally.
import { gsap } from "gsap";
import type { Layout } from "../lib/workspaces";

type Rect = [number, number, number, number];
type Side = "left" | "top" | "right" | "bottom";

const css = ([l, t, w, h]: Rect) => ({
  left: `${l}%`,
  top: `${t}%`,
  width: `${w}%`,
  height: `${h}%`,
});

const DECEL = "power3.out";
const FADE = 0.12;
const GAP = 14;
const EPS = 0.01;

const TIMINGS = {
  wide: { each: 0.32, apart: 0.05, label: "wide (0.32 s, 50 ms apart)" },
  tight: { each: 0.26, apart: 0.04, label: "tighter (0.26 s, 40 ms apart)" },
} as const;
type TimingKey = keyof typeof TIMINGS;

interface Variant {
  key: string;
  name: string;
  about: string;
}

const VARIANTS: Variant[] = [
  {
    key: "today",
    name: "Simply there",
    about: "today: the screen is placed with no motion",
  },
  {
    key: "B",
    name: "The wide rule, literally",
    about:
      "each window slides out of the desktop edge its tile sits on (right, else bottom, left, top). Every phone tile spans the width, so every window comes from the right edge, one after another in tiling order (top to bottom).",
  },
  {
    key: "V",
    name: "Each from its top or bottom edge",
    about:
      "the phone tiles top to bottom, so the edge is read vertically: a tile on the top edge drops out of it, every other tile rises out of the bottom edge (a middle tile takes the nearer one). Staggered in tiling order.",
  },
  {
    key: "C",
    name: "Rise like a workspace change",
    about:
      "the phone's own motion, as a swipe from an empty workspace: the windows come up from below the screen one by one, top to bottom, 0.27 s each, 32 ms apart (timing toggle ignored).",
  },
  {
    key: "L",
    name: "Alternate sides",
    about:
      "each window slides out of the left or right edge, alternating in tiling order (first from the right), so stacked windows interleave rather than all sweep one way.",
  },
];

const STORE = "prototype-first-appear-phone";
const TIMING_STORE = "prototype-first-appear-phone-timing";
function initial(): Variant {
  const key =
    new URLSearchParams(location.search).get("appear") ??
    sessionStorage.getItem(STORE) ??
    "B";
  return VARIANTS.find((v) => v.key === key) ?? (VARIANTS[1] as Variant);
}
let current = initial();
let timingKey: TimingKey =
  sessionStorage.getItem(TIMING_STORE) === "tight" ? "tight" : "wide";

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
export const launchOn = (): boolean =>
  import.meta.env.DEV && current.key !== "today" && !reduced.matches;

/** The panes of a layout in its tiling order (its key order). */
const ordered = (panes: HTMLElement[], layout: Layout) =>
  Object.keys(layout)
    .map((id) => panes.find((p) => p.dataset.window === id))
    .filter(Boolean) as HTMLElement[];

/** A tile collapsed onto one of its edges. */
function collapsed([x, y, w, h]: Rect, edge: Side): Rect {
  if (edge === "left") return [x, y, 0, h];
  if (edge === "right") return [x + w, y, 0, h];
  if (edge === "top") return [x, y, w, 0];
  return [x, y + h, w, 0];
}
/** The wide screen's rule (#126): right, else bottom, left, top. */
function areaEdge([x, y, w, h]: Rect): Side {
  if (Math.abs(x + w - 100) < EPS) return "right";
  if (Math.abs(y + h - 100) < EPS) return "bottom";
  if (x < EPS) return "left";
  return "top";
}
/** Read vertically: the top edge if it sits there, else the nearer of top/bottom. */
function verticalEdge([, y, , h]: Rect): Side {
  if (y < EPS && y + h < 100 - EPS) return "top";
  if (Math.abs(y + h - 100) < EPS) return "bottom";
  return y + h / 2 < 50 ? "top" : "bottom";
}

let running: gsap.core.Timeline | null = null;

/** Stop a launch where it is (a swipe during it re-tiles from there). */
export function stopLaunch(panes: HTMLElement[]): void {
  if (!running) return;
  running.kill();
  gsap.set(panes, { opacity: 1, y: 0 });
  running = null;
}

/** Bring on the screen's windows. `place` has already put them in their tiles. */
export function runLaunch(
  area: HTMLElement,
  panes: HTMLElement[],
  layout: Layout,
  onDone: () => void,
): gsap.core.Timeline {
  stopLaunch(panes);
  const shown = ordered(panes, layout);
  const rectOf = (p: HTMLElement) =>
    [...(layout[p.dataset.window ?? ""] ?? [0, 0, 0, 0])] as Rect;
  const overflow = area.style.overflow;
  const tl = gsap.timeline({
    paused: true,
    onComplete: () => {
      area.style.overflow = overflow;
      running = null;
      onDone();
      timing.textContent = `last launch: ${tl.duration().toFixed(2)} s · ${shown.length} window(s)`;
    },
  });
  const { each, apart } = TIMINGS[timingKey];
  const v = current.key;

  if (v === "C") {
    area.style.overflow = "hidden";
    const off = area.clientHeight + GAP;
    shown.forEach((p, i) =>
      tl.fromTo(
        p,
        { y: off },
        { y: 0, duration: 0.27, ease: "power3.inOut" },
        i * 0.032,
      ),
    );
    tl.set(shown, { clearProps: "transform" });
  } else {
    shown.forEach((p, i) => {
      const r = rectOf(p);
      const edge: Side =
        v === "B"
          ? areaEdge(r)
          : v === "V"
            ? verticalEdge(r)
            : i % 2 === 0
              ? "right"
              : "left";
      const at = i * apart;
      gsap.set(p, { opacity: 0 });
      tl.fromTo(
        p,
        css(collapsed(r, edge)),
        { ...css(r), duration: each, ease: DECEL },
        at,
      );
      tl.to(p, { opacity: 1, duration: FADE }, at);
    });
  }

  running = tl;
  tl.play();
  return tl;
}

// ---- the floating bar
let replay: () => void = () => {};
export function onReplay(fn: () => void): void {
  replay = fn;
}
const bar = document.createElement("div");
Object.assign(bar.style, {
  position: "fixed",
  left: "8px",
  right: "8px",
  bottom: "8px",
  zIndex: "2147483647",
  background: "#ff0",
  color: "#000",
  font: "11px/1.3 ui-monospace, monospace",
  padding: "6px 8px",
  borderRadius: "10px",
  boxShadow: "0 4px 18px #000a",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
});
const btn = (text: string, on: () => void) => {
  const b = document.createElement("button");
  b.textContent = text;
  Object.assign(b.style, {
    font: "inherit",
    background: "#000",
    color: "#ff0",
    border: "0",
    borderRadius: "6px",
    padding: "6px 8px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });
  // keep the bar's taps away from the desktop's swipe handling
  for (const ev of ["pointerdown", "pointerup", "touchstart"])
    b.addEventListener(ev, (e) => e.stopPropagation());
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    on();
  });
  return b;
};
const label = document.createElement("div");
const timing = document.createElement("div");
timing.style.opacity = "0.7";
let slow = false;
const slowBtn = btn("slow ×4: off", () => {
  slow = !slow;
  gsap.globalTimeline.timeScale(slow ? 0.25 : 1);
  slowBtn.textContent = `slow ×4: ${slow ? "on" : "off"}`;
});
const timingBtn = btn("", () => {
  timingKey = timingKey === "wide" ? "tight" : "wide";
  sessionStorage.setItem(TIMING_STORE, timingKey);
  render();
  replay();
});
const row = document.createElement("div");
Object.assign(row.style, { display: "flex", gap: "6px", flexWrap: "wrap" });
row.append(
  btn("←", () => cycle(-1)),
  btn("→", () => cycle(1)),
  btn("replay", () => replay()),
  slowBtn,
  timingBtn,
);
bar.append(label, timing, row);
if (import.meta.env.DEV) document.body.append(bar);

function render(): void {
  const i = VARIANTS.indexOf(current);
  label.innerHTML = `<b>${current.key}</b> (${current.name}) ${i + 1}/${VARIANTS.length}<br>${current.about}`;
  timingBtn.textContent = `timing: ${TIMINGS[timingKey].label}`;
}
function cycle(d: number): void {
  const i = VARIANTS.indexOf(current);
  current = VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length] as Variant;
  sessionStorage.setItem(STORE, current.key);
  const url = new URL(location.href);
  url.searchParams.set("appear", current.key);
  history.replaceState(history.state, "", url);
  render();
  replay();
}
addEventListener("keydown", (e: KeyboardEvent) => {
  const t = e.target;
  if (
    t instanceof HTMLElement &&
    t.matches("input, textarea, select, [contenteditable]")
  )
    return;
  if (e.key === "[") cycle(-1);
  if (e.key === "]") cycle(1);
});
render();
