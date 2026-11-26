// PROTOTYPE, throwaway (map #110, ticket #138): what the windows do when the
// visitor acts mid-motion. Dev only, wide screen only, motion allowed only.
//
// Every step runs as one GSAP timeline with the motions the map settled:
// - changing workspace: windows slide up and off / in from below, in tiling
//   order, 0.27 s each, 32 ms apart; a window on both gets a clone (#114)
// - rolling past (project to project): contents roll through their tiles,
//   0.38 s power3.inOut (#113)
// - anything else, opening and closing a window included: a re-tile where a
//   window slides out of / into its desktop edge, 0.32 s power3.out (#112)
//
// What a wheel flick, key, click, Back/Forward or address does while one runs
// is switchable via `?midmotion=` and the floating bar ([ ] or its arrows):
//   A  Queue     it waits; the motion finishes at full speed, then the latest input runs
//   B  Hurry     the motion speeds up ×4 to its end, then the latest input runs
//   C  Snap      the motion jumps to its end and the input runs at once
//   D  Turn back an input that undoes the step reverses the motion from where
//                the windows are; any other hurries as B
//   E  Retarget  the input runs at once, every window gliding from where it
//                is to its new tile (the step's own motion is lost)
import { gsap } from "gsap";
import type { Layout } from "../lib/workspaces";

type Rect = readonly [number, number, number, number];
export type Kind = "workspace" | "roll" | "retile";
export interface Where {
  step: number;
  open: boolean;
}

const css = ([l, t, w, h]: Rect) => ({
  left: `${l}%`,
  top: `${t}%`,
  width: `${w}%`,
  height: `${h}%`,
});

// ---- policies

interface Policy {
  key: string;
  name: string;
  about: string;
  /** the wheel gate is held while a motion runs (it queues one gesture) */
  holdsWheel: boolean;
}
const POLICIES: Policy[] = [
  {
    key: "A",
    name: "Queue",
    about:
      "the input waits; the motion finishes at full speed, then the latest input runs (today's wheel gate, for every input)",
    holdsWheel: true,
  },
  {
    key: "B",
    name: "Hurry",
    about:
      "the motion speeds up ×4 to its end, then the latest input runs from rest",
    holdsWheel: true,
  },
  {
    key: "C",
    name: "Snap",
    about:
      "the motion jumps to its end and the input's own motion starts at once",
    holdsWheel: false,
  },
  {
    key: "D",
    name: "Turn back",
    about:
      "an input that undoes the step (the opposite flick, Back, closing what is opening) reverses the motion from where the windows are; any other hurries as B",
    holdsWheel: false,
  },
  {
    key: "E",
    name: "Retarget",
    about:
      "the input runs at once: every window glides from where it is now to its new tile (0.32 s); the step's own motion (roll, slide up) is lost",
    holdsWheel: false,
  },
  {
    key: "F",
    name: "Queue, turn back (chosen)",
    about:
      "an input that undoes the step reverses the motion from where the windows are, dropping anything queued; any other waits as in A",
    holdsWheel: false,
  },
];
const STORE = "prototype-mid-motion";
const initial = (): Policy => {
  const key =
    new URLSearchParams(location.search).get("midmotion") ??
    sessionStorage.getItem(STORE) ??
    "A";
  return POLICIES.find((p) => p.key === key) ?? (POLICIES[0] as Policy);
};
let policy = initial();
export const holdsWheel = (): boolean => policy.holdsWheel;

// ---- runs

interface Run {
  tl: gsap.core.Timeline;
  kind: Kind | "retarget";
  from: Where;
  to: Where;
  clones: HTMLElement[];
  /** the tile each rolling pane is clipped to, to measure what shows */
  clipTiles: Map<HTMLElement, Rect>;
  done: boolean;
  end: () => void;
}

let current: Run | null = null;
let pending: (() => void) | null = null;
let reversing = false;
let snapshot: Map<HTMLElement, { rect: Rect; opacity: number }> | null = null;
let ghosts: HTMLElement[] = [];

let ctx: {
  area: HTMLElement;
  panes: HTMLElement[];
  shown: () => Layout | null;
} | null = null;
export function mount(c: NonNullable<typeof ctx>): void {
  ctx = c;
}

export const running = (): boolean => current !== null && !current.done;
export function takePending(): (() => void) | null {
  const p = pending;
  pending = null;
  return p;
}

/** Put every pane back as the layout on show says, with no motion props left. */
function restyle(run: Run): void {
  if (!ctx) return;
  for (const c of run.clones) c.remove();
  ctx.area.style.overflow = "";
  const layout = ctx.shown() ?? {};
  for (const pane of ctx.panes) {
    gsap.set(pane, { clearProps: "transform,clipPath,opacity" });
    const r = layout[pane.dataset.window ?? ""];
    if (r) Object.assign(pane.style, { display: "block", ...css(r) });
    else pane.style.display = "none";
  }
}

/** The change between two layouts, in tiling order (the layouts' key order). */
function changeOf(panes: HTMLElement[], before: Layout, after: Layout) {
  const byId = new Map(panes.map((p) => [p.dataset.window ?? "", p]));
  const stay: { pane: HTMLElement; from: Rect; to: Rect }[] = [];
  const enter: { pane: HTMLElement; to: Rect }[] = [];
  const leave: { pane: HTMLElement; from: Rect }[] = [];
  for (const [id, a] of Object.entries(after)) {
    const pane = byId.get(id);
    if (!pane) continue;
    const b = before[id];
    if (b) stay.push({ pane, from: b, to: a });
    else enter.push({ pane, to: a });
  }
  for (const [id, b] of Object.entries(before)) {
    const pane = byId.get(id);
    if (pane && !after[id]) leave.push({ pane, from: b });
  }
  return { stay, enter, leave };
}

/** The tile pressed into the desktop edge it touches: right, else bottom, else left, else top. */
const edgeOf = ([l, t, w, h]: Rect): Rect =>
  l + w >= 99.9 && l > 0.1
    ? [100, t, 0, h]
    : t + h >= 99.9 && t > 0.1
      ? [l, 100, w, 0]
      : l <= 0.1 && w < 99.9
        ? [0, t, 0, h]
        : [l, 0, w, 0];

const MOVE = 0.32;
const DECEL = "power3.out";
const ROLL = 0.38;
const INOUT = "power3.inOut";
const WS = 0.34 * 0.8;
const WS_GAP = 0.04 * 0.8;

export interface StartArgs {
  kind: Kind;
  before: Layout;
  after: Layout;
  dir: number;
  from: Where;
  to: Where;
  onDone: (tl: gsap.core.Timeline) => void;
}

/**
 * Start the motion for a step `place` has just laid out, or, if an
 * interruption asked for it, reverse or retarget the one running.
 */
export function start(a: StartArgs): gsap.core.Timeline {
  if (!ctx) throw new Error("prototype not mounted");
  const { area, panes } = ctx;
  firstInput ??= performance.now();

  // D: the input undoes the step: turn the running timeline round
  if (reversing && current && !current.done) {
    const r = current;
    for (const p of panes)
      if (
        r.tl.getChildren(true, true, false).some((t) => t.targets().includes(p))
      )
        p.style.display = "block";
    [r.from, r.to] = [r.to, r.from];
    if (r.tl.reversed()) r.tl.play();
    else r.tl.reverse();
    lastAction = `turned back at ${(r.tl.progress() * 100).toFixed(0)}%`;
    return r.tl;
  }

  const run: Run = {
    tl: gsap.timeline({ paused: true }),
    kind: snapshot ? "retarget" : a.kind,
    from: a.from,
    to: a.to,
    clones: [],
    clipTiles: new Map(),
    done: false,
    end: () => {
      if (run.done) return;
      run.done = true;
      run.tl.kill();
      restyle(run);
      if (current === run) current = null;
      report(run);
      a.onDone(run.tl);
    },
  };
  const tl = run.tl;
  tl.eventCallback("onComplete", run.end);
  tl.eventCallback("onReverseComplete", run.end);

  const c = changeOf(panes, a.before, a.after);

  if (snapshot) {
    // E: everything glides from where it is now
    const snap = snapshot;
    snapshot = null;
    for (const s of c.stay.concat(c.enter.map((e) => ({ ...e, from: e.to })))) {
      const was = snap.get(s.pane);
      tl.fromTo(
        s.pane,
        { ...css(was?.rect ?? edgeOf(s.to)), opacity: was?.opacity ?? 0 },
        { ...css(s.to), opacity: 1, duration: MOVE, ease: DECEL },
        0,
      );
    }
    // what showed and is not in the new step fades out from where it is
    const gone = [...snap.entries()].filter(
      ([el]) =>
        !c.stay.some((s) => s.pane === el) &&
        !c.enter.some((e) => e.pane === el),
    );
    for (const [el, was] of gone) {
      Object.assign(el.style, { display: "block", ...css(was.rect) });
      if (!el.dataset.window) run.clones.push(el);
      tl.fromTo(
        el,
        { opacity: was.opacity },
        { opacity: 0, duration: 0.15 },
        0,
      );
    }
    ghosts = [];
  } else if (a.kind === "workspace") {
    const off = (area.clientHeight + 14) * a.dir;
    area.style.overflow = "hidden";
    const leaving: HTMLElement[] = [];
    for (const l of c.leave) {
      Object.assign(l.pane.style, { display: "block", ...css(l.from) });
      leaving.push(l.pane);
    }
    for (const s of c.stay) {
      const copy = s.pane.cloneNode(true) as HTMLElement;
      copy.removeAttribute("data-window");
      copy.dataset.clone = s.pane.dataset.window;
      Object.assign(copy.style, css(s.from));
      area.append(copy);
      run.clones.push(copy);
      leaving.push(copy);
    }
    // the old ones in the old tiling order
    const order = Object.keys(a.before);
    const key = (el: HTMLElement) =>
      order.indexOf(el.dataset.window ?? el.dataset.clone ?? "");
    leaving.sort((x, y) => key(x) - key(y));
    leaving.forEach((p, i) =>
      tl.fromTo(
        p,
        { y: 0 },
        { y: -off, duration: WS, ease: INOUT },
        i * WS_GAP,
      ),
    );
    const entering = Object.keys(a.after)
      .map((id) => panes.find((p) => p.dataset.window === id))
      .filter(Boolean) as HTMLElement[];
    entering.forEach((p, i) =>
      tl.fromTo(
        p,
        { y: off },
        { y: 0, duration: WS, ease: INOUT },
        (i + 1) * WS_GAP,
      ),
    );
  } else if (a.kind === "roll") {
    for (const s of c.stay)
      tl.fromTo(
        s.pane,
        css(s.from),
        { ...css(s.to), duration: MOVE, ease: DECEL },
        0,
      );
    for (const l of c.leave) {
      Object.assign(l.pane.style, { display: "block", ...css(l.from) });
      run.clipTiles.set(l.pane, l.from);
      const h = l.pane.offsetHeight;
      tl.fromTo(
        l.pane,
        { y: 0, clipPath: "inset(0px 0px 0px 0px)" },
        {
          y: -h * a.dir,
          clipPath:
            a.dir > 0
              ? `inset(${h}px 0px 0px 0px)`
              : `inset(0px 0px ${h}px 0px)`,
          duration: ROLL,
          ease: INOUT,
        },
        0,
      );
    }
    for (const e of c.enter) {
      run.clipTiles.set(e.pane, e.to);
      const h = e.pane.offsetHeight;
      tl.fromTo(
        e.pane,
        {
          y: h * a.dir,
          clipPath:
            a.dir > 0
              ? `inset(0px 0px ${h}px 0px)`
              : `inset(${h}px 0px 0px 0px)`,
        },
        {
          y: 0,
          clipPath: "inset(0px 0px 0px 0px)",
          duration: ROLL,
          ease: INOUT,
        },
        0,
      );
    }
  } else {
    for (const s of c.stay)
      tl.fromTo(
        s.pane,
        css(s.from),
        { ...css(s.to), duration: MOVE, ease: DECEL },
        0,
      );
    for (const e of c.enter) {
      tl.fromTo(
        e.pane,
        css(edgeOf(e.to)),
        { ...css(e.to), duration: MOVE, ease: DECEL },
        0,
      );
      tl.fromTo(e.pane, { opacity: 0 }, { opacity: 1, duration: 0.12 }, 0);
    }
    for (const l of c.leave) {
      Object.assign(l.pane.style, { display: "block", ...css(l.from) });
      tl.fromTo(
        l.pane,
        css(l.from),
        { ...css(edgeOf(l.from)), duration: MOVE, ease: DECEL },
        0,
      );
      tl.to(l.pane, { opacity: 0, duration: 0.12 }, MOVE - 0.12);
    }
  }

  current = run;
  tl.play(0);
  return tl;
}

/** Where every window (and clone) shows right now, in % of the area. */
function freeze(run: Run): Map<HTMLElement, { rect: Rect; opacity: number }> {
  const out = new Map<HTMLElement, { rect: Rect; opacity: number }>();
  if (!ctx) return out;
  const A = ctx.area.getBoundingClientRect();
  const els = [...ctx.panes, ...run.clones].filter(
    (el) => el.style.display !== "none",
  );
  for (const el of els) {
    const b = el.getBoundingClientRect();
    let [x0, y0, x1, y1] = [b.left, b.top, b.right, b.bottom];
    const tile = run.clipTiles.get(el);
    if (tile) {
      x0 = Math.max(x0, A.left + (tile[0] / 100) * A.width);
      y0 = Math.max(y0, A.top + (tile[1] / 100) * A.height);
      x1 = Math.min(x1, A.left + ((tile[0] + tile[2]) / 100) * A.width);
      y1 = Math.min(y1, A.top + ((tile[1] + tile[3]) / 100) * A.height);
    }
    x0 = Math.max(x0, A.left);
    y0 = Math.max(y0, A.top);
    x1 = Math.min(x1, A.right);
    y1 = Math.min(y1, A.bottom);
    if (x1 - x0 < 2 || y1 - y0 < 2) continue;
    const pct: Rect = [
      ((x0 - A.left) / A.width) * 100,
      ((y0 - A.top) / A.height) * 100,
      ((x1 - x0) / A.width) * 100,
      ((y1 - y0) / A.height) * 100,
    ];
    out.set(el, { rect: pct, opacity: Number(getComputedStyle(el).opacity) });
  }
  // clones that show are kept as ghosts for the retarget to fade out
  run.clones = run.clones.filter((c) => !out.has(c));
  ghosts = [...out.keys()].filter((el) => !el.dataset.window);
  return out;
}

/** Stop the running motion where it is, the windows at their tiles (a jump with no motion). */
export function abort(): void {
  if (current && !current.done) {
    pending = null;
    current.end();
  }
  for (const g of ghosts) g.remove();
  ghosts = [];
}

/**
 * Every input that moves the windows comes here first. `to` is where it
 * leads; `run` does it.
 */
export function act(to: Where, run: () => void): void {
  firstInput ??= performance.now();
  const r = current;
  if (!r || r.done) {
    run();
    return;
  }
  inputs++;
  switch (policy.key) {
    case "A":
      pending = run;
      lastAction = "queued";
      break;
    case "B":
      pending = run;
      r.tl.timeScale(4);
      lastAction = `hurried at ${(r.tl.progress() * 100).toFixed(0)}%`;
      break;
    case "C":
      lastAction = `snapped at ${(r.tl.progress() * 100).toFixed(0)}%`;
      r.end();
      run();
      break;
    case "D":
      if (to.step === r.from.step && to.open === r.from.open) {
        reversing = true;
        try {
          run();
        } finally {
          reversing = false;
        }
      } else {
        pending = run;
        r.tl.timeScale(4);
        lastAction = `hurried at ${(r.tl.progress() * 100).toFixed(0)}%`;
      }
      break;
    case "F":
      if (to.step === r.from.step && to.open === r.from.open) {
        pending = null;
        reversing = true;
        try {
          run();
        } finally {
          reversing = false;
        }
      } else {
        pending = run;
        lastAction = "queued";
      }
      break;
    case "E": {
      lastAction = `retargeted at ${(r.tl.progress() * 100).toFixed(0)}%`;
      const snap = freeze(r);
      r.end();
      snapshot = snap;
      try {
        run();
      } finally {
        snapshot = null;
      }
      break;
    }
  }
}

// ---- the floating bar

let firstInput: number | null = null;
let inputs = 0;
let lastAction = "—";
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
  flexWrap: "wrap",
  gap: "8px",
  alignItems: "center",
  maxWidth: "min(94vw, 820px)",
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
const state = document.createElement("div");
state.style.opacity = "0.75";
const text = document.createElement("div");
text.style.flex = "1 1 420px";
text.append(label, state);
let slow = false;
const slowBtn = btn("slow ×4: off", () => {
  slow = !slow;
  gsap.globalTimeline.timeScale(slow ? 0.25 : 1);
  slowBtn.textContent = `slow ×4: ${slow ? "on" : "off"}`;
});

/** Scripted bursts, so every variant gets the same mid-motion inputs. */
export function addBursts(b: {
  move: (d: 1 | -1) => void;
  workspace: (i: number) => void;
}): void {
  const at = (ms: number, f: () => void) => setTimeout(f, slow ? ms * 4 : ms);
  const row = document.createElement("div");
  Object.assign(row.style, { display: "flex", gap: "6px", flexWrap: "wrap" });
  row.append(
    btn("↓↓ (2nd at 120 ms)", () => {
      b.move(1);
      at(120, () => b.move(1));
    }),
    btn("↓↓↓ (every 100 ms)", () => {
      b.move(1);
      at(100, () => b.move(1));
      at(200, () => b.move(1));
    }),
    btn("↓ then ↑ at 150 ms", () => {
      b.move(1);
      at(150, () => b.move(-1));
    }),
    btn("ws 2 then 5 at 100 ms", () => {
      b.workspace(1);
      at(100, () => b.workspace(4));
    }),
    btn("ws 5 then Back at 150 ms", () => {
      b.workspace(4);
      at(150, () => history.back());
    }),
  );
  text.append(row);
}

bar.append(
  btn("←", () => cycle(-1)),
  text,
  btn("→", () => cycle(1)),
  slowBtn,
);
if (import.meta.env.DEV) document.body.append(bar);

function render(): void {
  const i = POLICIES.indexOf(policy);
  label.innerHTML = `<b>${policy.key}</b> (${policy.name}) ${i + 1}/${POLICIES.length}<br>${policy.about}`;
}
function report(run: Run): void {
  if (running() || pending) return;
  const took =
    firstInput === null ? 0 : (performance.now() - firstInput) / 1000;
  lastSettle = `settled ${took.toFixed(2)} s after the first input (${inputs} mid-motion)`;
  firstInput = null;
  inputs = 0;
  void run;
}
let lastSettle = "";
gsap.ticker.add(() => {
  const r = current;
  const now =
    r && !r.done
      ? `${r.kind} ${r.from.step}${r.from.open ? "+" : ""} → ${r.to.step}${r.to.open ? "+" : ""} ${(r.tl.progress() * 100).toFixed(0)}%${r.tl.reversed() ? " (reversed)" : ""}${r.tl.timeScale() !== 1 ? ` ×${r.tl.timeScale()}` : ""}`
      : "at rest";
  state.textContent = `${now} · pending: ${pending ? "yes" : "no"} · last: ${lastAction} · ${lastSettle}`;
});
function cycle(d: number): void {
  const i = POLICIES.indexOf(policy);
  policy = POLICIES[(i + d + POLICIES.length) % POLICIES.length] as Policy;
  sessionStorage.setItem(STORE, policy.key);
  const url = new URL(location.href);
  url.searchParams.set("midmotion", policy.key);
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
