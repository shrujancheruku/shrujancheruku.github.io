// PROTOTYPE, throwaway (map #110, ticket #114): how the desktop changes
// workspace. Five motions, switchable via `?wschange=` and the floating bar
// ([ ], or the arrows on the bar). Dev only, wide screen only. Steps inside a
// workspace keep today's Flip. The name window is on both opening (1) and
// contact (5): press 1 and 5 (or click the numbers) to see how each variant
// treats it.
import { gsap } from "gsap";
import type { Layout } from "../lib/workspaces";

type Rect = readonly [number, number, number, number];

const css = ([l, t, w, h]: Rect) => ({
  left: `${l}%`,
  top: `${t}%`,
  width: `${w}%`,
  height: `${h}%`,
});

interface Motion {
  key: string;
  name: string;
  about: string;
  axis: "x" | "y";
  /** seconds between one window and the next; 0 travels as one */
  stagger: number;
  /** a window on both workspaces stays and re-tiles instead of travelling */
  sharedStays: boolean;
  /** null: today's Flip */
  on: boolean;
}

const D = 0.34;
const EASE = "power3.inOut";
const GAP = 14;

const MOTIONS: Motion[] = [
  {
    key: "today",
    name: "Today",
    about: "Flip 0.85 s: old windows fade out from 0.94, new fade in, shared ones move",
    axis: "y",
    stagger: 0,
    sharedStays: true,
    on: false,
  },
  {
    key: "A",
    name: "Slide sideways, as one",
    about:
      "the workspace slides off left and the next on from the right (a higher number comes from the right, like the number row), 0.34 s. The name window travels with its workspace.",
    axis: "x",
    stagger: 0,
    sharedStays: false,
    on: true,
  },
  {
    key: "B",
    name: "Slide up, as one",
    about:
      "the workspace slides up and off and the next comes up from below (as the wheel and rolling past go), 0.34 s. The name window travels with its workspace.",
    axis: "y",
    stagger: 0,
    sharedStays: false,
    on: true,
  },
  {
    key: "C",
    name: "Slide up, staggered",
    about:
      "as B, but each window leaves and arrives on its own, 40 ms apart in tiling order (about 0.5 s in all).",
    axis: "y",
    stagger: 0.04,
    sharedStays: false,
    on: true,
  },
  {
    key: "D",
    name: "Slide up, name stays",
    about:
      "as B, but a window on both workspaces (the name and its terminal, 1 ↔ 5) stays on screen and re-tiles to its new place while the rest slide past it.",
    axis: "y",
    stagger: 0,
    sharedStays: true,
    on: true,
  },
];

const STORE = "prototype-workspace-change";
function initial(): Motion {
  const key =
    new URLSearchParams(location.search).get("wschange") ??
    sessionStorage.getItem(STORE) ??
    "A";
  return MOTIONS.find((m) => m.key === key) ?? (MOTIONS[1] as Motion);
}
let current = initial();
export const workspaceMotionOn = (): boolean => current.on;

/** Order the panes by the layout's tiling order (its key order). */
const ordered = (panes: HTMLElement[], layout: Layout) =>
  Object.keys(layout)
    .map((id) => panes.find((p) => p.dataset.window === id))
    .filter(Boolean) as HTMLElement[];

/**
 * Run the workspace change. `place` has already put the new layout's panes in
 * place and hidden the rest; this puts the old ones back and slides.
 * `dir` is +1 to a higher workspace, -1 to a lower.
 */
export function runWorkspaceChange(
  area: HTMLElement,
  panes: HTMLElement[],
  before: Layout,
  after: Layout,
  dir: number,
  onDone: () => void,
): gsap.core.Timeline {
  const m = current;
  const span = m.axis === "x" ? area.clientWidth : area.clientHeight;
  const off = (span + GAP) * dir;
  const prop = m.axis;
  const clones: HTMLElement[] = [];
  const leaving: HTMLElement[] = [];
  const staying: { pane: HTMLElement; from: Rect; to: Rect }[] = [];

  for (const pane of ordered(panes, before)) {
    const id = pane.dataset.window ?? "";
    const from = before[id] as Rect;
    const to = after[id];
    if (!to) {
      Object.assign(pane.style, { display: "block", ...css(from) });
      leaving.push(pane);
    } else if (m.sharedStays) {
      staying.push({ pane, from, to });
    } else {
      // the same window is on both: a copy of it leaves with the old workspace
      const copy = pane.cloneNode(true) as HTMLElement;
      copy.removeAttribute("data-window");
      Object.assign(copy.style, css(from));
      area.append(copy);
      clones.push(copy);
      leaving.push(copy);
    }
  }
  const stayIds = new Set(staying.map((s) => s.pane));
  const entering = ordered(panes, after).filter((p) => !stayIds.has(p));

  const overflow = area.style.overflow;
  area.style.overflow = "hidden";
  const tl = gsap.timeline({
    onComplete: () => {
      for (const p of leaving) if (!clones.includes(p)) p.style.display = "none";
      for (const c of clones) c.remove();
      gsap.set([...leaving, ...entering], { clearProps: "transform" });
      area.style.overflow = overflow;
      onDone();
      timing.textContent = `last change: ${tl.duration().toFixed(2)} s`;
    },
  });
  leaving.forEach((p, i) =>
    tl.fromTo(
      p,
      { [prop]: 0 },
      { [prop]: -off, duration: D, ease: EASE },
      i * m.stagger,
    ),
  );
  entering.forEach((p, i) =>
    tl.fromTo(
      p,
      { [prop]: off },
      { [prop]: 0, duration: D, ease: EASE },
      (i + 1) * m.stagger,
    ),
  );
  for (const s of staying) {
    s.pane.style.zIndex = "60";
    tl.fromTo(
      s.pane,
      css(s.from),
      { ...css(s.to), duration: D, ease: EASE },
      0,
    );
  }
  return tl;
}

// ---- the floating bar
const bar = document.createElement("div");
Object.assign(bar.style, {
  position: "fixed",
  left: "50%",
  bottom: "44px",
  transform: "translateX(-50%)",
  zIndex: "2147483647",
  background: "#ff0",
  color: "#000",
  font: "13px/1.35 ui-monospace, monospace",
  padding: "6px 10px",
  borderRadius: "10px",
  boxShadow: "0 4px 18px #000a",
  display: "flex",
  gap: "8px",
  alignItems: "center",
  maxWidth: "min(92vw, 760px)",
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
    padding: "2px 8px",
    cursor: "pointer",
  });
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    on();
  });
  return b;
};
const label = document.createElement("div");
const timing = document.createElement("div");
timing.style.opacity = "0.7";
const text = document.createElement("div");
text.append(label, timing);
let slow = false;
const slowBtn = btn("slow ×4: off", () => {
  slow = !slow;
  gsap.globalTimeline.timeScale(slow ? 0.25 : 1);
  slowBtn.textContent = `slow ×4: ${slow ? "on" : "off"}`;
});
bar.append(
  btn("←", () => cycle(-1)),
  text,
  btn("→", () => cycle(1)),
  slowBtn,
);
if (import.meta.env.DEV) document.body.append(bar);

function render(): void {
  const i = MOTIONS.indexOf(current);
  label.innerHTML = `<b>${current.key}</b> (${current.name}) ${i + 1}/${MOTIONS.length}<br>${current.about}`;
}
function cycle(d: number): void {
  const i = MOTIONS.indexOf(current);
  current = MOTIONS[(i + d + MOTIONS.length) % MOTIONS.length] as Motion;
  sessionStorage.setItem(STORE, current.key);
  const url = new URL(location.href);
  url.searchParams.set("wschange", current.key);
  history.replaceState(history.state, "", url);
  render();
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
