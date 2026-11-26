// PROTOTYPE, throwaway (map #110, ticket #112): how a window opens and closes
// beside its neighbours. Four motions for a disclosure (the archive on the
// projects workspace, Education & Internships on the timeline), switchable via
// `?motion=` and the floating bar (← →, or the arrows on the bar). Dev only.
// Other re-tiles (step to step, workspace to workspace) keep today's Flip.
import { gsap } from "gsap";
import type { Layout } from "../lib/workspaces";

type Rect = readonly [number, number, number, number];

export interface Motion {
  key: string;
  name: string;
  /** Plain-words description for the bar. */
  about: string;
  /** null: today's Flip re-tile. */
  run:
    | ((tl: gsap.core.Timeline, change: Change, opening: boolean) => void)
    | null;
}

export interface Change {
  stay: { pane: HTMLElement; from: Rect; to: Rect }[];
  enter: { pane: HTMLElement; to: Rect }[];
  leave: { pane: HTMLElement; from: Rect }[];
}

const css = ([l, t, w, h]: Rect) => ({
  left: `${l}%`,
  top: `${t}%`,
  width: `${w}%`,
  height: `${h}%`,
});

/** The tile collapsed onto the edge of the area it touches (right, else bottom). */
const collapsed = ([l, t, w, h]: Rect): Rect =>
  l + w >= 99.9 && l > 0.1
    ? [100, t, 0, h]
    : t + h >= 99.9 && t > 0.1
      ? [l, 100, w, 0]
      : [l + w / 2, t + h / 2, 0, 0];

const MOVE = 0.32;
const DECEL = "power3.out";

const moveStay = (tl: gsap.core.Timeline, c: Change, at: number) => {
  for (const s of c.stay)
    tl.fromTo(
      s.pane,
      css(s.from),
      { ...css(s.to), duration: MOVE, ease: DECEL },
      at,
    );
};

const popIn = (tl: gsap.core.Timeline, c: Change, at: number) => {
  for (const e of c.enter)
    tl.fromTo(
      e.pane,
      { opacity: 0, scale: 0.87 },
      { opacity: 1, scale: 1, duration: 0.22, ease: "back.out(1.4)" },
      at,
    );
};

const popOut = (tl: gsap.core.Timeline, c: Change, at: number) => {
  for (const l of c.leave)
    tl.fromTo(
      l.pane,
      { opacity: 1, scale: 1 },
      { opacity: 0, scale: 0.87, duration: 0.15, ease: "none" },
      at,
    );
};

export const MOTIONS: Motion[] = [
  {
    key: "today",
    name: "Today",
    about: "Flip 0.85 s expo; new window fades from 0.94 in place",
    run: null,
  },
  {
    key: "A",
    name: "Pop, together",
    about:
      "window pops from 87% + fade (0.22 s, slight overshoot), neighbours re-tile at the same time (0.32 s); close shrinks out in 0.15 s while they fill",
    run: (tl, c) => {
      moveStay(tl, c, 0);
      popIn(tl, c, 0);
      popOut(tl, c, 0);
    },
  },
  {
    key: "B",
    name: "Slide from the edge",
    about:
      "window grows out of the screen edge it sits on, sharing one moving border with its neighbours (0.32 s); close collapses back into the edge",
    run: (tl, c) => {
      moveStay(tl, c, 0);
      for (const e of c.enter) {
        tl.fromTo(
          e.pane,
          css(collapsed(e.to)),
          { ...css(e.to), duration: MOVE, ease: DECEL },
          0,
        );
        tl.fromTo(e.pane, { opacity: 0 }, { opacity: 1, duration: 0.12 }, 0);
      }
      for (const l of c.leave) {
        tl.fromTo(
          l.pane,
          css(l.from),
          { ...css(collapsed(l.from)), duration: MOVE, ease: DECEL },
          0,
        );
        tl.to(l.pane, { opacity: 0, duration: 0.12 }, MOVE - 0.12);
      }
    },
  },
  {
    key: "C",
    name: "Make room, then pop",
    about:
      "open: neighbours give up the space first (0.32 s), the window pops into the hole; close: window pops out first, then neighbours fill (≈0.5 s total)",
    run: (tl, c, opening) => {
      if (opening) {
        moveStay(tl, c, 0);
        popOut(tl, c, 0); // a window that leaves on open (skills) goes at once
        popIn(tl, c, MOVE * 0.75);
      } else {
        popOut(tl, c, 0);
        moveStay(tl, c, 0.12);
        popIn(tl, c, 0.12 + MOVE * 0.75);
      }
    },
  },
];

const STORE = "prototype-disclosure-motion";

function initial(): Motion {
  const key =
    new URLSearchParams(location.search).get("motion") ??
    sessionStorage.getItem(STORE) ??
    "A";
  return MOTIONS.find((m) => m.key === key) ?? (MOTIONS[1] as Motion);
}

let current = initial();
export const currentMotion = (): Motion => current;

/** Build the change between two layouts for the panes on show. */
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

/** Run the current motion; leaving panes are kept on show until it ends. */
export function runDisclosure(
  change: Change,
  opening: boolean,
  onDone: () => void,
): gsap.core.Timeline {
  const tl = gsap.timeline({
    onComplete: () => {
      for (const l of change.leave) l.pane.style.display = "none";
      gsap.set(
        [...change.enter, ...change.leave].map((x) => x.pane),
        { clearProps: "opacity,transform,scale" },
      );
      onDone();
      report(tl);
    },
  });
  for (const l of change.leave)
    Object.assign(l.pane.style, { display: "block", ...css(l.from) });
  current.run?.(tl, change, opening);
  return tl;
}

// ---- the floating bar
const bar = document.createElement("div");
bar.setAttribute("data-prototype-bar", "");
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
const btn = (label: string, on: () => void) => {
  const b = document.createElement("button");
  b.textContent = label;
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
  timing.textContent = `last disclosure: ${tl.duration().toFixed(2)} s`;
}
function cycle(d: number): void {
  const i = MOTIONS.indexOf(current);
  current = MOTIONS[(i + d + MOTIONS.length) % MOTIONS.length] as Motion;
  sessionStorage.setItem(STORE, current.key);
  const url = new URL(location.href);
  url.searchParams.set("motion", current.key);
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
  if (e.key === "ArrowLeft") cycle(-1);
  if (e.key === "ArrowRight") cycle(1);
});
render();
