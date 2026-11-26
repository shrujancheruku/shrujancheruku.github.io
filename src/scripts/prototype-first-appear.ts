// PROTOTYPE, throwaway (map #110, ticket #126): how the windows first appear
// when the desktop loads. Five variants, switchable via `?appear=` and the
// floating bar ([ ], or the arrows on the bar). "replay" runs it again without
// reloading; a reload at any address shows it for real. Dev only, wide screen
// only, never with reduced motion. "wheel waits" holds the wheel shut until
// the windows are in (on), or lets a flick re-tile from wherever they are (off).
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

const OPEN = 0.32; // opening a window (#112)
const DECEL = "power3.out";
const FADE = 0.12;
const BUDGET = 0.9; // the whole launch, at most
const GAP = 14;
const EPS = 0.01;

interface Variant {
  key: string;
  name: string;
  about: string;
}

const VARIANTS: Variant[] = [
  {
    key: "today",
    name: "Simply there",
    about: "today: the step is placed with no motion",
  },
  {
    key: "A",
    name: "Launched in tiling order",
    about:
      "the first window slides out of the left edge and fills the desktop; each next one opens as #112 settled, sliding out of its edge while the windows already open give up the space. Overlapped so the whole launch fits about 0.9 s.",
  },
  {
    key: "B",
    name: "Each from its edge, together",
    about:
      "every window slides out of the desktop edge its tile sits on (right, else bottom, left, top) straight into its tile; nothing re-tiles. 0.32 s each, 50 ms apart in tiling order.",
  },
  {
    key: "C",
    name: "Rise like a workspace change",
    about:
      "as if changing to it from an empty workspace: the windows come up from below one by one in tiling order, 0.27 s each, 32 ms apart.",
  },
  {
    key: "D",
    name: "Fade in together",
    about: "every window fades in on its tile at once, 0.25 s; nothing moves.",
  },
];

const STORE = "prototype-first-appear";
const WAIT_STORE = "prototype-first-appear-wait";
function initial(): Variant {
  const key =
    new URLSearchParams(location.search).get("appear") ??
    sessionStorage.getItem(STORE) ??
    "A";
  return VARIANTS.find((v) => v.key === key) ?? (VARIANTS[1] as Variant);
}
let current = initial();
let wheelWaits = sessionStorage.getItem(WAIT_STORE) !== "off";
export const wheelWaitsForLaunch = (): boolean => wheelWaits;

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
export const launchOn = (): boolean =>
  import.meta.env.DEV && current.key !== "today" && !reduced.matches;

/** The panes of a layout in its tiling order (its key order). */
const ordered = (panes: HTMLElement[], layout: Layout) =>
  Object.keys(layout)
    .map((id) => panes.find((p) => p.dataset.window === id))
    .filter(Boolean) as HTMLElement[];

/**
 * Close `id` out of `rects`: the open windows along one of its sides that span
 * that side exactly take its space. Returns the side they sit on, or null.
 */
function closeOut(rects: Map<string, Rect>, id: string): Side | null {
  const [x, y, w, h] = rects.get(id) as Rect;
  const others = [...rects].filter(([k]) => k !== id);
  const within = (a: number, b: number, lo: number, hi: number) =>
    a >= lo - EPS && b <= hi + EPS;
  const tries: [Side, (r: Rect) => boolean, number, (r: Rect) => Rect][] = [
    [
      "left",
      (r) =>
        Math.abs(r[0] + r[2] - x) < EPS && within(r[1], r[1] + r[3], y, y + h),
      h,
      (r) => [r[0], r[1], r[2] + w, r[3]],
    ],
    [
      "top",
      (r) =>
        Math.abs(r[1] + r[3] - y) < EPS && within(r[0], r[0] + r[2], x, x + w),
      w,
      (r) => [r[0], r[1], r[2], r[3] + h],
    ],
    [
      "right",
      (r) =>
        Math.abs(r[0] - (x + w)) < EPS && within(r[1], r[1] + r[3], y, y + h),
      h,
      (r) => [r[0] - w, r[1], r[2] + w, r[3]],
    ],
    [
      "bottom",
      (r) =>
        Math.abs(r[1] - (y + h)) < EPS && within(r[0], r[0] + r[2], x, x + w),
      w,
      (r) => [r[0], r[1] - h, r[2], r[3] + h],
    ],
  ];
  for (const [side, touches, span, grow] of tries) {
    const hit = others.filter(([, r]) => touches(r));
    const sum = hit.reduce(
      (s, [, r]) => s + (side === "left" || side === "right" ? r[3] : r[2]),
      0,
    );
    if (hit.length && Math.abs(sum - span) < EPS) {
      for (const [k, r] of hit) rects.set(k, grow(r));
      rects.delete(id);
      return side;
    }
  }
  return null;
}

/** A tile collapsed onto one of its edges. */
function collapsed([x, y, w, h]: Rect, edge: Side): Rect {
  if (edge === "left") return [x, y, 0, h];
  if (edge === "right") return [x + w, y, 0, h];
  if (edge === "top") return [x, y, w, 0];
  return [x, y + h, w, 0];
}
const opposite: Record<Side, Side> = {
  left: "right",
  right: "left",
  top: "bottom",
  bottom: "top",
};
/** The desktop edge a tile sits on: right, else bottom, left, top. */
function areaEdge([x, y, w, h]: Rect): Side {
  if (Math.abs(x + w - 100) < EPS) return "right";
  if (Math.abs(y + h - 100) < EPS) return "bottom";
  if (x < EPS) return "left";
  return "top";
}

let running: { tl: gsap.core.Timeline; undo: () => void } | null = null;

/** Stop a launch where it is (a flick that doesn't wait re-tiles from there). */
export function stopLaunch(panes: HTMLElement[]): void {
  if (!running) return;
  running.tl.kill();
  running.undo();
  gsap.set(panes, { opacity: 1, y: 0 });
  running = null;
}

/** Bring on the step's windows. `place` has already put them in their tiles. */
export function runLaunch(
  area: HTMLElement,
  panes: HTMLElement[],
  layout: Layout,
  onDone: () => void,
): gsap.core.Timeline {
  stopLaunch(panes);
  const shown = ordered(panes, layout);
  const final = new Map(
    shown.map((p) => [
      p.dataset.window ?? "",
      [...(layout[p.dataset.window ?? ""] ?? [0, 0, 0, 0])] as Rect,
    ]),
  );
  const overflow = area.style.overflow;
  const undo = () => {
    area.style.overflow = overflow;
  };
  const tl = gsap.timeline({
    paused: true,
    onComplete: () => {
      undo();
      running = null;
      onDone();
      timing.textContent = `last launch: ${tl.duration().toFixed(2)} s`;
    },
  });
  const v = current.key;

  if (v === "A") {
    // the stages, from the full step back to the first window alone
    const stages: Map<string, Rect>[] = [new Map(final)];
    const sides: (Side | null)[] = [];
    for (let i = shown.length - 1; i > 0; i--) {
      const next = new Map(stages[0]);
      sides.unshift(closeOut(next, shown[i]?.dataset.window ?? ""));
      stages.unshift(next);
    }
    const n = shown.length;
    const gap = n > 1 ? Math.min(0.2, (BUDGET - OPEN) / (n - 1)) : 0;
    // the first window: out of the left edge, filling what stage 0 gives it
    const first = shown[0] as HTMLElement;
    const firstRect = stages[0]?.get(first.dataset.window ?? "") as Rect;
    for (const p of shown) gsap.set(p, { opacity: 0 });
    tl.fromTo(
      first,
      css(collapsed(firstRect, "left")),
      { ...css(firstRect), duration: OPEN, ease: DECEL },
      0,
    );
    tl.to(first, { opacity: 1, duration: FADE }, 0);
    for (let i = 1; i < n; i++) {
      const pane = shown[i] as HTMLElement;
      const id = pane.dataset.window ?? "";
      const before = stages[i - 1] as Map<string, Rect>;
      const after = stages[i] as Map<string, Rect>;
      const side = sides[i - 1];
      const at = i * gap;
      const to = after.get(id) as Rect;
      const from = side ? collapsed(to, opposite[side]) : to;
      tl.fromTo(
        pane,
        css(from),
        { ...css(to), duration: OPEN, ease: DECEL, immediateRender: false },
        at,
      );
      tl.to(pane, { opacity: 1, duration: FADE }, at);
      for (const [k, r] of before) {
        const other = shown.find((p) => p.dataset.window === k);
        const r2 = after.get(k) as Rect;
        if (!other || r.every((x, j) => Math.abs(x - (r2[j] as number)) < EPS))
          continue;
        // `to`, so a neighbour still giving way to the last window carries on
        // from where it is
        tl.to(
          other,
          { ...css(r2), duration: OPEN, ease: DECEL, overwrite: "auto" },
          at,
        );
      }
    }
  } else if (v === "B") {
    shown.forEach((p, i) => {
      const r = final.get(p.dataset.window ?? "") as Rect;
      const at = i * 0.05;
      gsap.set(p, { opacity: 0 });
      tl.fromTo(
        p,
        css(collapsed(r, areaEdge(r))),
        { ...css(r), duration: OPEN, ease: DECEL },
        at,
      );
      tl.to(p, { opacity: 1, duration: FADE }, at);
    });
  } else if (v === "C") {
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
  } else if (v === "D") {
    tl.fromTo(
      shown,
      { opacity: 0 },
      { opacity: 1, duration: 0.25, ease: "power1.out" },
      0,
    );
  }

  running = { tl, undo };
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
  maxWidth: "min(92vw, 820px)",
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
    whiteSpace: "nowrap",
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
const waitBtn = btn("", () => {
  wheelWaits = !wheelWaits;
  sessionStorage.setItem(WAIT_STORE, wheelWaits ? "on" : "off");
  renderWait();
});
const renderWait = () => {
  waitBtn.textContent = `wheel waits: ${wheelWaits ? "on" : "off"}`;
};
const side = document.createElement("div");
Object.assign(side.style, {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
});
side.append(
  btn("replay", () => replay()),
  waitBtn,
  slowBtn,
);
bar.append(
  btn("←", () => cycle(-1)),
  text,
  btn("→", () => cycle(1)),
  side,
);
if (import.meta.env.DEV) document.body.append(bar);

function render(): void {
  const i = VARIANTS.indexOf(current);
  label.innerHTML = `<b>${current.key}</b> (${current.name}) ${i + 1}/${VARIANTS.length}<br>${current.about}`;
  renderWait();
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
