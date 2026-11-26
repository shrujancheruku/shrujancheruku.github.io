// PROTOTYPE, throwaway (map #110, ticket #113): how one project gives way to
// the next. Project n → n+1 swaps copy-n/comp-n for copy-(n+1)/comp-(n+1) on
// the same tiles while the stack stays. Four motions, switchable via
// `?handoff=` and the floating bar ([ ], or the arrows on the bar). Dev only.
// Other re-tiles keep today's Flip.
import { gsap } from "gsap";
import type { Layout } from "../lib/workspaces";

type Rect = readonly [number, number, number, number];

export interface Change {
  stay: { pane: HTMLElement; from: Rect; to: Rect }[];
  enter: { pane: HTMLElement; to: Rect }[];
  leave: { pane: HTMLElement; from: Rect }[];
}

export interface Motion {
  key: string;
  name: string;
  about: string;
  /** null: today's Flip re-tile. `dir` is +1 forwards, -1 backwards. */
  run: ((tl: gsap.core.Timeline, c: Change, dir: number) => void) | null;
}

const css = ([l, t, w, h]: Rect) => ({
  left: `${l}%`,
  top: `${t}%`,
  width: `${w}%`,
  height: `${h}%`,
});

const MOVE = 0.32;
const DECEL = "power3.out";
const kind = (p: HTMLElement) => (p.dataset.window ?? "").split("-")[0];
const body = (p: HTMLElement) => p.querySelector<HTMLElement>(".body");

/** Where a project window closes to (and opens from): the copy into the top
 * edge, the composition into the right edge. */
const edge = (p: HTMLElement, [l, t, w, h]: Rect): Rect =>
  kind(p) === "copy" ? [l, t, w, 0] : [l + w, t, 0, h];

export const MOTIONS: Motion[] = [
  {
    key: "today",
    name: "Today",
    about: "Flip 0.85 s; old pair fades out, new fades in from 0.94 in place",
    run: null,
  },
  {
    key: "A",
    name: "Close, then open",
    about:
      "the old copy closes into the top edge and the old composition into the right edge while the stack fills the desktop (0.32 s); then the new pair opens out of the same edges (0.32 s). Same both ways.",
    run: (tl, c) => {
      const stack = c.stay.find((s) => kind(s.pane) === "stack");
      const full: Rect = [0, 0, 100, 100];
      for (const l of c.leave) {
        tl.fromTo(
          l.pane,
          css(l.from),
          { ...css(edge(l.pane, l.from)), duration: MOVE, ease: DECEL },
          0,
        );
        tl.to(l.pane, { opacity: 0, duration: 0.12 }, MOVE - 0.12);
      }
      for (const e of c.enter) {
        tl.set(e.pane, { ...css(edge(e.pane, e.to)), opacity: 0 }, 0);
        tl.to(e.pane, { ...css(e.to), duration: MOVE, ease: DECEL }, MOVE);
        tl.to(e.pane, { opacity: 1, duration: 0.12 }, MOVE);
      }
      if (stack) {
        tl.fromTo(
          stack.pane,
          css(stack.from),
          { ...css(full), duration: MOVE, ease: DECEL },
          0,
        );
        tl.to(
          stack.pane,
          { ...css(stack.to), duration: MOVE, ease: DECEL },
          MOVE,
        );
      }
    },
  },
  {
    key: "B",
    name: "Same windows, new contents",
    about:
      "the frames never move; inside them the old project's contents fade out (0.16 s) and the new one's fade in, nudged 12 px in the direction of travel (0.24 s). Mirrors going back.",
    run: (tl, c, dir) => {
      for (const l of c.leave) {
        l.pane.style.zIndex = "50";
        tl.to(
          body(l.pane),
          { opacity: 0, y: -12 * dir, duration: 0.16, ease: "power2.in" },
          0,
        );
      }
      for (const e of c.enter)
        tl.fromTo(
          body(e.pane),
          { opacity: 0, y: 12 * dir },
          { opacity: 1, y: 0, duration: 0.24, ease: DECEL },
          0.14,
        );
    },
  },
  {
    key: "C",
    name: "Roll past",
    about:
      "each window's contents slide through its own tile: the old project rolls up and out while the next rolls in from below (0.38 s, like scrolling). Going back rolls down.",
    run: (tl, c, dir) => {
      const D = 0.38;
      const E = "power3.inOut";
      for (const l of c.leave) {
        const h = l.pane.offsetHeight;
        tl.fromTo(
          l.pane,
          { y: 0, clipPath: "inset(0px 0px 0px 0px)" },
          {
            y: -h * dir,
            clipPath:
              dir > 0 ? `inset(${h}px 0px 0px 0px)` : `inset(0px 0px ${h}px 0px)`,
            duration: D,
            ease: E,
          },
          0,
        );
      }
      for (const e of c.enter) {
        const h = e.pane.offsetHeight;
        tl.fromTo(
          e.pane,
          {
            y: h * dir,
            clipPath:
              dir > 0 ? `inset(0px 0px ${h}px 0px)` : `inset(${h}px 0px 0px 0px)`,
          },
          { y: 0, clipPath: "inset(0px 0px 0px 0px)", duration: D, ease: E },
          0,
        );
      }
    },
  },
];

const STORE = "prototype-project-handoff";

function initial(): Motion {
  const key =
    new URLSearchParams(location.search).get("handoff") ??
    sessionStorage.getItem(STORE) ??
    "A";
  return MOTIONS.find((m) => m.key === key) ?? (MOTIONS[1] as Motion);
}

let current = initial();
export const currentMotion = (): Motion => current;

/** The change between two layouts for the panes on show. */
export function changeOf(
  panes: HTMLElement[],
  before: Layout,
  after: Layout,
): Change {
  const c: Change = { stay: [], enter: [], leave: [] };
  for (const pane of panes) {
    const id = pane.dataset.window ?? "";
    const b = before[id];
    const a = after[id];
    if (b && a) c.stay.push({ pane, from: b, to: a });
    else if (a) c.enter.push({ pane, to: a });
    else if (b) c.leave.push({ pane, from: b });
  }
  return c;
}

/** Run the current motion; leaving panes stay on show until it ends. */
export function runHandoff(
  change: Change,
  dir: number,
  onDone: () => void,
): gsap.core.Timeline {
  const all = [...change.enter, ...change.leave, ...change.stay].map(
    (x) => x.pane,
  );
  const bodies = all.map(body).filter(Boolean) as HTMLElement[];
  const tl = gsap.timeline({
    onComplete: () => {
      for (const l of change.leave) {
        l.pane.style.display = "none";
        l.pane.style.zIndex = "";
      }
      gsap.set(all, { clearProps: "opacity,transform,clipPath" });
      gsap.set(bodies, { clearProps: "opacity,transform" });
      onDone();
      report(tl);
    },
  });
  for (const l of change.leave)
    Object.assign(l.pane.style, { display: "block", ...css(l.from) });
  current.run?.(tl, change, dir);
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
function report(tl: gsap.core.Timeline): void {
  timing.textContent = `last hand-off: ${tl.duration().toFixed(2)} s`;
}
function cycle(d: number): void {
  const i = MOTIONS.indexOf(current);
  current = MOTIONS[(i + d + MOTIONS.length) % MOTIONS.length] as Motion;
  sessionStorage.setItem(STORE, current.key);
  const url = new URL(location.href);
  url.searchParams.set("handoff", current.key);
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
