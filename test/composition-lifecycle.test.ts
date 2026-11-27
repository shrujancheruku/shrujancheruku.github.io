import { describe, expect, test } from "bun:test";
import {
  type Clock,
  createClock,
  type Timers,
} from "../src/lib/composition-clock";
import {
  createLifecycle,
  drawing,
  frameToShow,
  type LifecycleOptions,
} from "../src/lib/composition-lifecycle";

/** A timer source the test winds by hand. */
function fakeTimers() {
  let now = 0;
  let next = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const timers: Timers = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = next++;
      pending.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (id) => void pending.delete(id as number),
  };
  const advance = async (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...pending.entries()]
        .filter(([, t]) => t.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      pending.delete(due[0]);
      now = due[1].at;
      due[1].fn();
      for (let i = 0; i < 6; i++) await Promise.resolve();
    }
    now = end;
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };
  return { timers, advance };
}

/** A lifecycle whose composition plays for `playMs`, on a hand-wound clock. */
function setup(extra: Partial<LifecycleOptions> & { playMs?: number } = {}) {
  const { timers, advance } = fakeTimers();
  const { playMs = 1000, ...rest } = extra;
  const runs: { clock: Clock; finished: boolean }[] = [];
  const shown: string[] = [];
  const life = createLifecycle({
    createClock: () => createClock(timers),
    play: async (clock) => {
      const run = { clock, finished: false };
      runs.push(run);
      await clock.sleep(playMs);
      run.finished = true;
    },
    showFrame: (name) => void shown.push(name),
    onChange: () => {},
    frames: ["end", "top"],
    card: "end",
    ...rest,
  });
  const drawn = () => {
    life.setOnscreen(true);
  };
  return { life, advance, runs, shown, drawn };
}

describe("a composition's lifecycle", () => {
  test("plays from the beginning when its window comes on show", () => {
    const { life, runs, drawn } = setup({ visible: true });
    life.sync();
    expect(life.report.mode).toBe("idle");
    life.enter();
    drawn();
    expect(life.report.mode).toBe("playing");
    expect(runs).toHaveLength(1);
  });

  test("pauses when drawing stops, and resumes from where it was", async () => {
    const { life, advance, runs, drawn } = setup();
    life.enter();
    drawn();
    await advance(600);
    life.setVisible(false);
    expect(life.report.mode).toBe("paused");
    await advance(5000);
    expect(runs[0]?.finished).toBe(false);
    life.setVisible(true);
    expect(life.report.mode).toBe("playing");
    await advance(399);
    expect(runs[0]?.finished).toBe(false);
    await advance(1);
    expect(runs[0]?.finished).toBe(true);
  });

  test("starts paused when entered while not in view", () => {
    const { life, runs } = setup();
    life.enter();
    expect(life.report.mode).toBe("paused");
    expect(runs[0]?.clock.paused).toBe(true);
  });

  test("holds the end state for good without holdMs", async () => {
    const { life, advance, runs, drawn } = setup();
    life.enter();
    drawn();
    await advance(1000);
    expect(life.report.mode).toBe("held");
    await advance(60_000);
    expect(life.report.mode).toBe("held");
    expect(runs).toHaveLength(1);
  });

  test("replays from the beginning once holdMs has passed", async () => {
    const { life, advance, runs, drawn } = setup({ holdMs: 2000 });
    life.enter();
    drawn();
    await advance(1000);
    expect(life.report.mode).toBe("held");
    await advance(1999);
    expect(runs).toHaveLength(1);
    await advance(1);
    expect(runs).toHaveLength(2);
    expect(life.report.mode).toBe("playing");
  });

  test("leaving stops it for good, and entering again restarts from the beginning", async () => {
    const { life, advance, runs, drawn } = setup({ holdMs: 2000 });
    life.enter();
    drawn();
    await advance(500);
    life.leave();
    expect(life.report.mode).toBe("idle");
    await advance(10_000);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.finished).toBe(false);
    life.enter();
    expect(runs).toHaveLength(2);
    expect(life.report.mode).toBe("playing");
    await advance(1000);
    expect(runs[1]?.finished).toBe(true);
  });

  test("a frame asked for stops the run and shows the frame", async () => {
    const { life, advance, runs, shown, drawn } = setup();
    life.enter();
    drawn();
    await advance(300);
    life.setAsked("top");
    expect(life.report).toEqual({ mode: "frame", frame: "top" });
    expect(shown).toEqual(["top"]);
    await advance(5000);
    expect(runs[0]?.finished).toBe(false);
    life.setAsked(undefined);
    expect(life.report.frame).toBeNull();
    expect(life.report.mode).toBe("playing");
    expect(runs).toHaveLength(2);
  });

  test("reduced motion freezes a flashing composition at its card", () => {
    const { life, shown, drawn } = setup({ flashes: true });
    life.enter();
    drawn();
    life.setReduced(true);
    expect(life.report).toEqual({ mode: "frame", frame: "end" });
    expect(shown).toEqual(["end"]);
  });

  test("a stale run finishing after a newer one began changes nothing", async () => {
    const { timers, advance } = fakeTimers();
    const finishers: (() => void)[] = [];
    const clocks: Clock[] = [];
    const life = createLifecycle({
      createClock: () => createClock(timers),
      // A composition that ignores its clock and ends when the test says so.
      play: (clock) => {
        clocks.push(clock);
        return new Promise<void>((resolve) => finishers.push(resolve));
      },
      showFrame: () => {},
      onChange: () => {},
      frames: [],
      card: "end",
      holdMs: 1000,
    });
    life.enter();
    life.setOnscreen(true);
    life.leave();
    life.enter();
    expect(finishers).toHaveLength(2);
    finishers[0]?.();
    await advance(5000);
    expect(life.report.mode).toBe("playing");
    expect(clocks).toHaveLength(2);
    finishers[1]?.();
    await advance(0);
    expect(life.report.mode).toBe("held");
  });
});

describe("when a composition draws", () => {
  const on = { active: true, onscreen: true, visible: true };

  test("when its window is on show, in view, and the tab is visible", () => {
    expect(drawing(on)).toBe(true);
  });

  test("not when any of those is false", () => {
    expect(drawing({ ...on, active: false })).toBe(false);
    expect(drawing({ ...on, onscreen: false })).toBe(false);
    expect(drawing({ ...on, visible: false })).toBe(false);
  });
});

describe("which still frame to show", () => {
  const frames = ["end", "top"];
  const base = { frames, card: "end", flashes: false, reduced: false };

  test("none by default", () => {
    expect(frameToShow({ ...base, asked: undefined })).toBeNull();
  });

  test("a named frame that exists", () => {
    expect(frameToShow({ ...base, asked: "top" })).toBe("top");
  });

  test("the word card asks for the composition's own card frame", () => {
    expect(frameToShow({ ...base, asked: "card" })).toBe("end");
  });

  test("an unknown name is ignored", () => {
    expect(frameToShow({ ...base, asked: "nope" })).toBeNull();
  });

  test("reduced motion freezes a flashing composition at its card", () => {
    expect(
      frameToShow({ ...base, asked: undefined, flashes: true, reduced: true }),
    ).toBe("end");
  });

  test("reduced motion leaves a composition that does not flash playing", () => {
    expect(
      frameToShow({ ...base, asked: undefined, reduced: true }),
    ).toBeNull();
  });
});
