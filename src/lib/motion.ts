// The motion between two steps, worked out from their layouts: a pure model,
// no DOM. The tiling model doesn't change (no split tree, no derived
// rectangles); each window's motion is read off its old and new tiles.
//
// - Re-tiling: a window in both steps moves and resizes to its new tile.
// - Rolling past: a different window on an identical tile, in the same workspace.
// - Opening / closing: a window in only one of the steps, in the same workspace.
// - Changing workspace: the step is in another workspace.
//
// A window opens out of, and closes into, the desktop edge on the far side
// from its neighbours: the windows in both steps whose tile, in the step it
// is not in, overlaps its own (they give up or fill its space).
import type { Layout, Rect } from "./workspaces";

export type Motion =
  | "re-tiling"
  | "opening"
  | "closing"
  | "rolling past"
  | "changing workspace";

export interface Change {
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
export function sortChanges(
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

/**
 * The desktop edge a window opens out of (it is in `after` only) or closes
 * into (it is in `before` only): on the far side from its neighbours. With no
 * neighbour overlapping it, right if its tile reaches the right edge, else
 * bottom.
 */
export function edgeOf(id: string, before: Layout, after: Layout): Edge {
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
  const [l, , w] = tile;
  return l + w >= 100 - EPSILON ? "right" : "bottom";
}

/** A tile collapsed onto one of its sides: no extent across that edge. */
export function collapsed([l, t, w, h]: Rect, edge: Edge): Rect {
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

export interface Roll {
  y: number;
  clip: string;
}

/**
 * Where a window rolls to and from inside its tile (`height` px tall).
 * `direction` is +1 forwards: the old goes up and out, the next comes from
 * below; -1 reverses both.
 */
export function rollOf(
  direction: 1 | -1,
  height: number,
): { rest: Roll; out: { to: Roll }; in: { from: Roll } } {
  const none = "inset(0px 0px 0px 0px)";
  const top = `inset(${height}px 0px 0px 0px)`;
  const bottom = `inset(0px 0px ${height}px 0px)`;
  return {
    rest: { y: 0, clip: none },
    out: {
      to: { y: -height * direction, clip: direction > 0 ? top : bottom },
    },
    in: {
      from: { y: height * direction, clip: direction > 0 ? bottom : top },
    },
  };
}

export interface Traveller {
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
export function travelOf(
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
