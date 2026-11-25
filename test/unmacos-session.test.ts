import { describe, expect, test } from "bun:test";
import {
  actionTimes,
  arrange,
  BEAT_MS,
  CYCLE,
  dwindle,
  HOLD_MS,
  jitter,
  keyLabel,
  nextSecond,
  START_WINDOWS,
  scroll,
  songClock,
  startingGraph,
  themeAfter,
} from "../src/compositions/unmacos-session";
import { THEME_NAMES } from "../src/lib/themes";

describe("the theme the demo switches to", () => {
  test("goes round the site's themes in their order and wraps", () => {
    expect(themeAfter("paper")).toBe("issho-light");
    expect(themeAfter("starship")).toBe("tokyo-night");
  });

  test("visits every theme before it repeats one", () => {
    const seen = new Set<string>();
    let t = "nord";
    for (let i = 0; i < THEME_NAMES.length; i++) {
      seen.add(t);
      t = themeAfter(t);
    }
    expect(seen.size).toBe(THEME_NAMES.length);
    expect(t).toBe("nord");
  });

  test("a name the site does not have starts the cycle at its first theme", () => {
    expect(themeAfter("")).toBe("tokyo-night");
  });
});

describe("the tiling", () => {
  test("one window fills the desktop", () => {
    expect(dwindle(1)).toEqual([{ x: 0, y: 0, w: 100, h: 100 }]);
  });

  test("three windows: the first takes the left, the rest split what is left", () => {
    expect(dwindle(3)).toEqual([
      { x: 0, y: 0, w: 56, h: 100 },
      { x: 56, y: 0, w: 44, h: 50 },
      { x: 56, y: 50, w: 44, h: 50 },
    ]);
  });

  test("a fourth splits the bottom right in two, side by side", () => {
    expect(dwindle(4)).toEqual([
      { x: 0, y: 0, w: 56, h: 100 },
      { x: 56, y: 0, w: 44, h: 50 },
      { x: 56, y: 50, w: 22, h: 50 },
      { x: 78, y: 50, w: 22, h: 50 },
    ]);
  });
});

describe("the beats", () => {
  test("the visitor's theme is held 2.5 s, then each 2.2 s beat switches theme as it moves a window", () => {
    expect(HOLD_MS).toBe(2500);
    expect(BEAT_MS).toBe(2200);
    const times = actionTimes(CYCLE.length * 2);
    expect(times[0]).toBe(2500);
    // one action per beat, and beats start 2.2 s apart
    const starts = times.map((t, i) => t - (CYCLE[i % CYCLE.length]?.at ?? 0));
    for (let i = 1; i < starts.length; i++)
      expect((starts[i] as number) - (starts[i - 1] as number)).toBe(BEAT_MS);
  });

  test("each step names its real key binding, and the theme key it switches with", () => {
    expect(CYCLE.map(keyLabel)).toEqual([
      "alt+shift+h move · alt+ctrl+shift+space theme",
      "alt+space launch an app · alt+ctrl+shift+space theme",
      "alt+shift+j move · alt+ctrl+shift+space theme",
      "alt+w close the window · alt+ctrl+shift+space theme",
      "alt+shift+l move · alt+ctrl+shift+space theme",
    ]);
  });

  test("a move brings the last of the first three to the front; the launcher opens lazygit, which a close ends", () => {
    let w = START_WINDOWS;
    expect(w).toEqual(["nvim", "btop", "spotify_player"]);
    w = arrange(w, "move");
    expect(w).toEqual(["spotify_player", "nvim", "btop"]);
    w = arrange(w, "launch");
    expect(w).toEqual(["spotify_player", "nvim", "btop", "lazygit"]);
    w = arrange(w, "close");
    expect(w).toEqual(["spotify_player", "nvim", "btop"]);
  });

  test("a cycle ends where it began, so the loop has no seam", () => {
    let w = START_WINDOWS;
    for (const beat of CYCLE) w = arrange(w, beat.kind);
    expect(w).toEqual(START_WINDOWS);
  });
});

describe("what moves inside the apps", () => {
  test("the song's clock runs a second at a time and starts over at the end of the track", () => {
    expect(songClock(79)).toEqual({
      label: "1:19/3:14",
      percent: (79 / 194) * 100,
    });
    expect(songClock(80).label).toBe("1:20/3:14");
    expect(songClock(194).label).toBe("3:14/3:14");
    expect(nextSecond(193)).toBe(194);
    expect(nextSecond(194)).toBe(0);
    expect(songClock(0).label).toBe("0:00/3:14");
  });

  test("a meter's percentage wanders but stays inside the meter", () => {
    expect(jitter(50, () => 0.5)).toBe(50);
    expect(jitter(50, () => 1)).toBe(58);
    expect(jitter(50, () => 0)).toBe(42);
    expect(jitter(97, () => 1)).toBe(97);
    expect(jitter(2, () => 0)).toBe(2);
  });

  test("the cpu graph scrolls: a new reading comes in, the oldest goes", () => {
    const first = Array.from({ length: 64 }, (_, i) => i + 10);
    const next = scroll(first, () => 0.5);
    expect(next).toHaveLength(64);
    expect(next.slice(0, 63)).toEqual(first.slice(1));
    expect(next[63]).toBe(first[63]);
    expect(scroll([90], () => 1)[0]).toBe(95);
    expect(scroll([10], () => 0)[0]).toBe(6);
  });

  test("the graph starts with 64 readings between the floor and the ceiling", () => {
    const h = startingGraph();
    expect(h).toHaveLength(64);
    for (const v of h) {
      expect(v).toBeGreaterThanOrEqual(6);
      expect(v).toBeLessThanOrEqual(95);
    }
  });
});
