// The motion between two placements, worked out from their layouts: a pure
// model, no DOM, and the whole of it as data (a plan) that one adapter plays
// (src/scripts/motion-player.ts). The tiling model doesn't change (no split
// tree, no derived rectangles); each window's motion is read off its old and
// new tiles.
//
// - Re-tiling: a window in both steps moves and resizes to its new tile.
// - Rolling past: a different window on an identical tile, in the same workspace.
// - Opening / closing: a window in only one of the steps, in the same workspace.
// - Changing workspace: the step is in another workspace (or, on a phone, a
//   screen of the same step whose windows all change).
// - First appearance: the desktop loads and the windows come on show.
//
// A window opens out of, and closes into, the desktop edge on the far side
// from its neighbours: the windows in both steps whose tile, in the step it
// is not in, overlaps its own (they give up or fill its space).
import type { Where } from "./navigator";
import type { Layout, Rect } from "./workspaces";

export type Motion =
  | "re-tiling"
  | "opening"
  | "closing"
  | "rolling past"
  | "changing workspace"
  | "first appearance";

interface Change {
  id: string;
  motion: Motion;
  /** Its tile in the old step, or null if it was not on show. */
  from: Rect | null;
  /** Its tile in the new step, or null if it leaves. */
  to: Rect | null;
}

export type Edge = "left" | "right" | "top" | "bottom";

const same = (a: Rect, b: Rect): boolean => a.every((v, i) => v === b[i]);

/**
 * Sort every window of two layouts by its motion: the new step's windows
 * first, in tiling order, then those that leave, in theirs. `sameWorkspace`
 * says the two steps are in one workspace.
 */
function sortChanges(
  before: Layout,
  after: Layout,
  sameWorkspace: boolean,
): Change[] {
  const leaving = Object.entries(before).filter(([id]) => !(id in after));
  const arriving = Object.entries(after).filter(([id]) => !(id in before));
  const rolls = (tile: Rect, others: [string, Rect][]) =>
    others.some(([, t]) => same(t, tile));
  const motionOf = (from: Rect | null, to: Rect | null): Motion => {
    if (!sameWorkspace) return "changing workspace";
    if (from && to) return "re-tiling";
    if (to) return rolls(to, leaving) ? "rolling past" : "opening";
    return from && rolls(from, arriving) ? "rolling past" : "closing";
  };
  return [
    ...Object.entries(after).map(([id, to]) => {
      const from = before[id] ?? null;
      return { id, motion: motionOf(from, to), from, to };
    }),
    ...leaving.map(([id, from]) => ({
      id,
      motion: motionOf(from, null),
      from,
      to: null,
    })),
  ];
}

/** Tiles overlap when they share some area, not only a border. */
const EPSILON = 0.01;
const overlaps = ([al, at, aw, ah]: Rect, [bl, bt, bw, bh]: Rect): boolean =>
  Math.min(al + aw, bl + bw) - Math.max(al, bl) > EPSILON &&
  Math.min(at + ah, bt + bh) - Math.max(at, bt) > EPSILON;

const centre = ([l, t, w, h]: Rect): [number, number] => [l + w / 2, t + h / 2];

const area = ([, , w, h]: Rect): number => w * h;

/** The edge a window with no neighbour overlapping it uses. */
const fallbackEdge = ([l, , w]: Rect): Edge =>
  l + w >= 100 - EPSILON ? "right" : "bottom";

const opposite: Record<Edge, Edge> = {
  left: "right",
  right: "left",
  top: "bottom",
  bottom: "top",
};

/**
 * The desktop edge a window opens out of (it is in `after` only) or closes
 * into (it is in `before` only): on the far side from its neighbours. With no
 * neighbour overlapping it, right if its tile reaches the right edge, else
 * bottom.
 *
 * On a phone, a window that has no neighbour but is swapped for a larger one
 * (the copy and the composition, for the archive that takes the whole screen)
 * takes the edge opposite the larger one's, so that the two share one moving
 * border: the archive comes out of the right, the copy and the composition go
 * into the left.
 */
function edgeOf(
  id: string,
  before: Layout,
  after: Layout,
  phone = false,
): Edge {
  const opening = id in after;
  const tile = (opening ? after : before)[id];
  if (!tile) throw new Error(`${id} is in neither layout`);
  const beside = opening ? after : before;
  const other = opening ? before : after;
  // the neighbours as they sit beside it
  const neighbours = Object.keys(beside)
    .filter((n) => n !== id && other[n] && overlaps(other[n], tile))
    .map((n) => beside[n] as Rect);
  if (neighbours.length > 0) {
    const [x, y] = centre(tile);
    const [nx, ny] = neighbours
      .map(centre)
      .reduce(([ax, ay], [bx, by]) => [ax + bx, ay + by], [0, 0])
      .map((v) => v / neighbours.length) as [number, number];
    const dx = x - nx;
    const dy = y - ny;
    if (Math.abs(dx) > EPSILON || Math.abs(dy) > EPSILON) {
      if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
      return dy > 0 ? "bottom" : "top";
    }
  }
  if (phone) {
    const swapped = Object.entries(other)
      .filter(([n, t]) => !(n in beside) && overlaps(t, tile))
      .map(([, t]) => t)
      .filter((t) => area(t) > area(tile));
    const larger = swapped.sort((a, b) => area(b) - area(a))[0];
    if (larger) return opposite[fallbackEdge(larger)];
  }
  return fallbackEdge(tile);
}

/**
 * The edge a window comes from when the desktop loads. Wide: the edge its tile
 * sits on, checked as right, else bottom, else left, else top. Phone, where
 * every tile spans the width: right and left by turns in tiling order (`index`
 * is the window's place in it), the first from the right.
 */
function appearEdgeOf(index: number, tile: Rect, phone: boolean): Edge {
  if (phone) return index % 2 === 0 ? "right" : "left";
  const [l, t, w, h] = tile;
  if (l + w >= 100 - EPSILON) return "right";
  if (t + h >= 100 - EPSILON) return "bottom";
  if (l <= EPSILON) return "left";
  return "top";
}

/** A tile collapsed onto one of its sides: no extent across that edge. */
function collapsed([l, t, w, h]: Rect, edge: Edge): Rect {
  switch (edge) {
    case "right":
      return [l + w, t, 0, h];
    case "left":
      return [l, t, 0, h];
    case "bottom":
      return [l, t + h, w, 0];
    case "top":
      return [l, t, w, 0];
  }
}

/**
 * Where a window rolls to and from inside its tile, in tile heights.
 * `direction` is +1 forwards: the old goes up and out, the next comes from
 * below; -1 reverses both.
 */
function rollOf(direction: 1 | -1): {
  rest: Position;
  out: { to: Position };
  in: { from: Position };
} {
  const top = { top: 1, bottom: 0 };
  const bottom = { top: 0, bottom: 1 };
  return {
    rest: { y: 0, clip: { top: 0, bottom: 0 } },
    out: { to: { y: -direction, clip: direction > 0 ? top : bottom } },
    in: { from: { y: direction, clip: direction > 0 ? bottom : top } },
  };
}

interface Traveller {
  id: string;
  /** Its tile in its own workspace. */
  tile: Rect;
  /** The window is on both workspaces: it leaves as a clone, arrives as itself. */
  shared: boolean;
}

/**
 * Who travels when the step is in another workspace: the old windows, then
 * the new, each in tiling order (the order a step's windows are written in,
 * not their position). The same window on both workspaces (the name and its
 * terminal) travels with each: the old workspace's copy leaves as a clone
 * while the real pane arrives.
 */
function travelOf(
  before: Layout,
  after: Layout,
): { leaving: Traveller[]; arriving: Traveller[] } {
  const side = (layout: Layout, other: Layout): Traveller[] =>
    Object.entries(layout).map(([id, tile]) => ({
      id,
      tile,
      shared: id in other,
    }));
  return { leaving: side(before, after), arriving: side(after, before) };
}

// ---- the plan

/** How long a step's motion takes, in seconds. */
const MOVE = 0.32;
const EASE = "power3.out";
/** Rolling past: one project gives way to the next inside its tile. */
const ROLL = 0.38;
const ROLL_EASE = "power3.inOut";
/**
 * Changing workspace: each window takes this long, starting this long after
 * the one before, and the whole workspace travels one screen plus this gap (px).
 */
const SLIDE = 0.27;
const SLIDE_GAP = 0.032;
const SLIDE_EASE = "power3.inOut";
const SCREEN_GAP = 14;
/** First appearance: each window starts this long after the one before. */
const APPEAR_GAP = 0.05;
/** A window opening fades in over its first this long; closing, its last. */
const FADE = 0.12;

/** When a part of the motion starts, how long it takes, and its ease. */
interface Timing {
  /** Seconds from the start of the motion. */
  at: number;
  duration: number;
  ease: string;
}

/** A window's frame going from one tile to another, in percent of the area. */
export interface Frame extends Timing {
  from: Rect;
  to: Rect;
}

/** A window's opacity, 0 to 1. */
export interface Fade extends Timing {
  from: 0 | 1;
  to: 0 | 1;
}

/** How much of a window's height is clipped from each end. */
export interface Clip {
  top: number;
  bottom: number;
}

interface Position {
  y: number;
  clip: Clip;
}

/**
 * A move up or down. `from` and `to` are multiples of an extent the DOM
 * knows: the window's own height, the height of the body of a paged window,
 * or the area's; the extent plus `gap` (px) is one unit. With `clip`, the
 * window is clipped as it moves.
 */
export interface Slide extends Timing {
  extent: "window" | "body" | "area";
  gap: number;
  from: number;
  to: number;
  clip?: { from: Clip; to: Clip };
}

/** What one window does in the motion. */
export interface WindowPlan {
  id: string;
  /** What it does: its part of the motion. */
  motion: Motion;
  /** The edge it opens out of, closes into or comes from. */
  edge?: Edge;
  /** It is on show at this tile before it moves (it is not on its new tile). */
  shownAt?: Rect;
  /** A copy of the window plays the motion; the window itself stays. */
  copy?: boolean;
  frame?: Frame;
  fade?: Fade;
  slide?: Slide;
  /** At rest it is gone: hidden, or the copy removed. */
  leaves: boolean;
}

/**
 * A paged window turning its page: its frame stays and its old entries (a
 * copy of them, taken before the window shows the next page) roll out as the
 * next page's entries roll in.
 */
export interface Turn {
  id: string;
  out: Slide;
  in: Slide;
}

/** The whole motion between two placements, as data. */
export interface Plan {
  motion: "re-tiling" | "changing workspace" | "first appearance";
  /** +1 towards a later step (then screen), -1 towards an earlier one. */
  direction: 1 | -1;
  /** Every window moving, in the order its motion is made: the new step's, then the old. */
  windows: WindowPlan[];
  /** The page turns, which copy the entries they leave from before the motion starts. */
  turns: Turn[];
  /** The area is clipped while it runs, so no window passes over the status bar. */
  clipsArea: boolean;
  /** How long the motion lasts, in seconds. */
  duration: number;
}

/** Where the windows are: the place, its workspace, its layout and the pages of its paged windows. */
export interface Placement {
  where: Where;
  workspace: number;
  layout: Layout;
  pages: Readonly<Record<string, number>>;
}

/** Whether place `a` comes before `b` in the order of steps, then screens. */
const isBefore = (a: Where, b: Where): boolean =>
  a.step < b.step || (a.step === b.step && a.screen < b.screen);

const sameLayout = (a: Layout, b: Layout): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** Two places on one step, its disclosure as open in each (the screens of a phone). */
const sameStep = (a: Placement, b: Placement): boolean =>
  a.where.step === b.where.step && a.where.open === b.where.open;

const frameOf = (from: Rect, to: Rect): Frame => ({
  from,
  to,
  at: 0,
  duration: MOVE,
  ease: EASE,
});

const fadeIn = (at: number): Fade => ({
  from: 0,
  to: 1,
  at,
  duration: FADE,
  ease: "none",
});

const fadeOut = (at: number): Fade => ({
  from: 1,
  to: 0,
  at,
  duration: FADE,
  ease: "none",
});

const rolling = (from: Position, to: Position): Slide => ({
  extent: "window",
  gap: 0,
  from: from.y,
  to: to.y,
  clip: { from: from.clip, to: to.clip },
  at: 0,
  duration: ROLL,
  ease: ROLL_EASE,
});

const turning = (from: number, to: number): Slide => ({
  extent: "body",
  gap: 0,
  from,
  to,
  at: 0,
  duration: ROLL,
  ease: ROLL_EASE,
});

const travelling = (from: number, to: number, at: number): Slide => ({
  extent: "area",
  gap: SCREEN_GAP,
  from,
  to,
  at,
  duration: SLIDE,
  ease: SLIDE_EASE,
});

/** When the last part of the motion ends. */
function lastingOf(windows: WindowPlan[], turns: Turn[]): number {
  const parts: (Timing | undefined)[] = [
    ...windows.flatMap((w) => [w.frame, w.fade, w.slide]),
    ...turns.flatMap((t) => [t.out, t.in]),
  ];
  return Math.max(0, ...parts.map((t) => (t ? t.at + t.duration : 0)));
}

/**
 * Changing workspace. The old workspace's windows slide up and off one after
 * another in tiling order as the next workspace's come up from below in the
 * same order (the reverse going to a lower one), `direction` giving which.
 * However many workspaces the jump crosses, it travels one screen. A window on
 * both workspaces leaves as a copy while the real window arrives.
 */
function travelPlan(before: Layout, after: Layout, direction: 1 | -1): Plan {
  const { leaving, arriving } = travelOf(before, after);
  const windows: WindowPlan[] = [
    ...leaving.map(
      (w, i): WindowPlan => ({
        id: w.id,
        motion: "changing workspace",
        shownAt: w.tile,
        ...(w.shared ? { copy: true } : {}),
        slide: travelling(0, -direction, i * SLIDE_GAP),
        leaves: true,
      }),
    ),
    ...arriving.map(
      (w, i): WindowPlan => ({
        id: w.id,
        motion: "changing workspace",
        slide: travelling(direction, 0, (i + 1) * SLIDE_GAP),
        leaves: false,
      }),
    ),
  ];
  return {
    motion: "changing workspace",
    direction,
    windows,
    turns: [],
    clipsArea: true,
    duration: lastingOf(windows, []),
  };
}

/**
 * Re-tiling: a window in both steps moves to its new tile; a window that
 * opens grows out of its edge along that edge's axis, and one that closes
 * shrinks back into it, sharing one moving border with the neighbours that
 * re-tile beside it. A window rolling past stays on its tile as the window
 * slides through it. A paged window that changes page turns it.
 */
function retilePlan(
  before: Placement,
  after: Placement,
  direction: 1 | -1,
  phone: boolean,
): Plan {
  const windows: WindowPlan[] = [];
  const roll = rollOf(direction);
  for (const c of sortChanges(before.layout, after.layout, true)) {
    if (c.from && c.to) {
      windows.push({
        id: c.id,
        motion: c.motion,
        frame: frameOf(c.from, c.to),
        leaves: false,
      });
    } else if (c.motion === "rolling past") {
      // the tile stays; the window slides through it, clipped to the tile
      windows.push({
        id: c.id,
        motion: c.motion,
        ...(c.from ? { shownAt: c.from } : {}),
        slide: c.to
          ? rolling(roll.in.from, roll.rest)
          : rolling(roll.rest, roll.out.to),
        leaves: !c.to,
      });
    } else if (c.motion === "opening" && c.to) {
      const edge = edgeOf(c.id, before.layout, after.layout, phone);
      windows.push({
        id: c.id,
        motion: c.motion,
        edge,
        frame: frameOf(collapsed(c.to, edge), c.to),
        fade: fadeIn(0),
        leaves: false,
      });
    } else if (c.motion === "closing" && c.from) {
      const edge = edgeOf(c.id, before.layout, after.layout, phone);
      // it stays on show until it is in its edge
      windows.push({
        id: c.id,
        motion: c.motion,
        edge,
        shownAt: c.from,
        frame: frameOf(c.from, collapsed(c.from, edge)),
        fade: fadeOut(MOVE - FADE),
        leaves: true,
      });
    }
  }
  // a paged window turning its page, with the layout unchanged around it
  const turns: Turn[] =
    phone && sameStep(before, after) && sameLayout(before.layout, after.layout)
      ? Object.keys(after.layout)
          .filter((id) => (before.pages[id] ?? 0) !== (after.pages[id] ?? 0))
          .map((id) => ({
            id,
            out: turning(0, -direction),
            in: turning(direction, 0),
          }))
      : [];
  const rolls = windows.some((w) => w.slide) || turns.length > 0;
  return {
    motion: "re-tiling",
    direction,
    windows,
    turns,
    clipsArea: false,
    // a step whose windows only appear and go still takes the step's time
    duration: Math.max(lastingOf(windows, turns), rolls ? ROLL : MOVE),
  };
}

/**
 * First appearance: the step's windows, already on their tiles, each slide
 * straight into their tile from an edge, one after another in tiling order.
 * Nothing re-tiles.
 */
function appearancePlan(after: Placement, phone: boolean): Plan {
  const windows = Object.entries(after.layout).map(
    ([id, tile], i): WindowPlan => {
      const edge = appearEdgeOf(i, tile, phone);
      const at = i * APPEAR_GAP;
      return {
        id,
        motion: "first appearance",
        edge,
        frame: { ...frameOf(collapsed(tile, edge), tile), at },
        fade: fadeIn(at),
        leaves: false,
      };
    },
  );
  return {
    motion: "first appearance",
    direction: 1,
    windows,
    turns: [],
    clipsArea: false,
    duration: lastingOf(windows, []),
  };
}

/**
 * The whole motion from one placement to another, as data: what each window
 * does and when, and which windows turn a page. With no `before` the desktop
 * is loading, and it is the first appearance.
 */
export function planMotion(
  before: Placement | null,
  after: Placement,
  phone: boolean,
): Plan {
  if (!before) return appearancePlan(after, phone);
  const direction = isBefore(after.where, before.where) ? -1 : 1;
  // a phone moving between screens of one step, whose windows all change,
  // travels like changing workspace
  const screenMove =
    phone &&
    sameStep(before, after) &&
    !sameLayout(before.layout, after.layout);
  if (before.workspace !== after.workspace || screenMove)
    return travelPlan(before.layout, after.layout, direction);
  return retilePlan(before, after, direction, phone);
}
