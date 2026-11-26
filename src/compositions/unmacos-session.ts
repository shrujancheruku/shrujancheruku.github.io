// The `unmacos` composition's rules (#41), pure so `bun test` covers them:
// the theme cycle, the tiling, the beats and the numbers that move.
import { isThemeName, nextTheme, THEME_NAMES } from "../lib/themes";

/** The theme the composition switches to after `current`; a name the site lacks starts at the first. */
export function themeAfter(current: string): string {
  return isThemeName(current) ? nextTheme(current) : (THEME_NAMES[0] as string);
}

const round = (n: number): number => Math.round(n * 1e4) / 1e4;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where `count` windows sit, in percent of the desktop: each splits what is left, alternating direction. */
export function dwindle(count: number): Rect[] {
  const rects: Rect[] = [];
  let rest: Rect = { x: 0, y: 0, w: 100, h: 100 };
  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      rects.push(rest);
      break;
    }
    if (i % 2 === 0) {
      const w = round(rest.w * (i === 0 ? 0.56 : 0.5));
      rects.push({ ...rest, w });
      rest = { ...rest, x: round(rest.x + w), w: round(rest.w - w) };
    } else {
      const h = round(rest.h / 2);
      rects.push({ ...rest, h });
      rest = { ...rest, y: round(rest.y + h), h: round(rest.h - h) };
    }
  }
  return rects;
}

export type BeatKind = "move" | "launch" | "close";

export interface Beat {
  kind: BeatKind;
  /** The key binding, as the app's README gives it. */
  keys: readonly string[];
  /** What the binding does, in the key label. */
  does: string;
  /** Milliseconds into the beat when the window moves and the theme switches. */
  at: number;
}

/** The theme key: every beat switches theme as it moves a window. */
export const THEME_KEYS = ["alt", "ctrl", "shift", "space"] as const;

/** The visitor's theme is held this long before the first beat's action. */
export const HOLD_MS = 2500;
/** One beat: a window moves (or opens, or closes) and the theme switches. */
export const BEAT_MS = 2200;

/**
 * One cycle: move, open an app from the launcher, move, close it, move.
 * Three moves of the first three windows bring them back where they were, so
 * the loop has no seam.
 */
export const CYCLE: readonly Beat[] = [
  { kind: "move", keys: ["alt", "shift", "h"], does: "move", at: 350 },
  {
    kind: "launch",
    keys: ["alt", "space"],
    does: "launch an app",
    at: 1500,
  },
  { kind: "move", keys: ["alt", "shift", "j"], does: "move", at: 350 },
  { kind: "close", keys: ["alt", "w"], does: "close the window", at: 800 },
  { kind: "move", keys: ["alt", "shift", "l"], does: "move", at: 350 },
];

/** The key label of a beat: its binding, then the theme binding. */
export const keyLabel = (beat: Beat): string =>
  `${beat.keys.join("+")} ${beat.does} · ${THEME_KEYS.join("+")} theme`;

/** When the first `count` beats act, in milliseconds from the start. */
export function actionTimes(count: number): number[] {
  const first = (CYCLE[0] as Beat).at;
  return Array.from({ length: count }, (_, i) => {
    const beat = CYCLE[i % CYCLE.length] as Beat;
    return HOLD_MS - first + i * BEAT_MS + beat.at;
  });
}

/** The desktop the composition starts with, in tiling order. */
export const START_WINDOWS: readonly string[] = [
  "nvim",
  "btop",
  "spotify_player",
];

/** The tiling order after a beat. */
export function arrange(windows: readonly string[], kind: BeatKind): string[] {
  if (kind === "launch") return [...windows, "lazygit"];
  if (kind === "close") return windows.slice(0, -1);
  const [a, b, c, ...rest] = windows;
  return [c, a, b, ...rest].filter((w): w is string => w !== undefined);
}

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

/** The song playing in spotify_player is this long, in seconds. */
export const TRACK_SECONDS = 194;
/** Where the song's clock starts, in seconds. */
export const TRACK_START = 79;

const timeLabel = (t: number): string =>
  `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

/** The song's clock and how far along the bar is, in percent. */
export function songClock(seconds: number): { label: string; percent: number } {
  return {
    label: `${timeLabel(seconds)}/${timeLabel(TRACK_SECONDS)}`,
    percent: (seconds / TRACK_SECONDS) * 100,
  };
}

/** The song a second on; it starts over at the end of the track. */
export const nextSecond = (seconds: number): number =>
  seconds >= TRACK_SECONDS ? 0 : seconds + 1;

/** A meter's percentage, a little different: `rand` is Math.random's kind. */
export const jitter = (percent: number, rand: () => number): number =>
  clamp(percent + Math.round((rand() - 0.5) * 16), 2, 97);

const GRAPH_COLUMNS = 64;

/** The cpu graph's readings, in percent, oldest first. */
export const startingGraph = (): number[] =>
  Array.from({ length: GRAPH_COLUMNS }, (_, i) =>
    clamp(30 + 22 * Math.sin(i / 5) + 14 * Math.sin(i / 1.7), 6, 95),
  );

/** The graph a second on: a new reading comes in and the oldest goes. */
export function scroll(
  readings: readonly number[],
  rand: () => number,
): number[] {
  const last = readings.at(-1) ?? 30;
  return [...readings.slice(1), clamp(last + (rand() - 0.5) * 26, 6, 95)];
}
