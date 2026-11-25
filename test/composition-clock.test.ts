import { describe, expect, test } from "bun:test";
import {
  Cancelled,
  createClock,
  type Timers,
} from "../src/lib/composition-clock";

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
      await Promise.resolve();
      await Promise.resolve();
    }
    now = end;
  };
  return { timers, advance };
}

describe("a composition's clock", () => {
  test("a sleep ends when its time has passed", async () => {
    const { timers, advance } = fakeTimers();
    const clock = createClock(timers);
    let done = false;
    clock.sleep(500).then(() => {
      done = true;
    });
    await advance(499);
    expect(done).toBe(false);
    await advance(1);
    expect(done).toBe(true);
  });

  test("time does not pass while paused, and the rest of a sleep is kept", async () => {
    const { timers, advance } = fakeTimers();
    const clock = createClock(timers);
    let done = false;
    clock.sleep(1000).then(() => {
      done = true;
    });
    await advance(600);
    clock.pause();
    await advance(60_000);
    expect(done).toBe(false);
    clock.resume();
    await advance(399);
    expect(done).toBe(false);
    await advance(1);
    expect(done).toBe(true);
  });

  test("a sleep begun while paused starts counting when it resumes", async () => {
    const { timers, advance } = fakeTimers();
    const clock = createClock(timers);
    clock.pause();
    let done = false;
    clock.sleep(100).then(() => {
      done = true;
    });
    await advance(5000);
    expect(done).toBe(false);
    clock.resume();
    await advance(100);
    expect(done).toBe(true);
  });

  test("cancelling ends every sleep with Cancelled, and later sleeps too", async () => {
    const { timers, advance } = fakeTimers();
    const clock = createClock(timers);
    const first = clock.sleep(1000).catch((e) => e);
    clock.cancel();
    expect(await first).toBeInstanceOf(Cancelled);
    expect(await clock.sleep(10).catch((e) => e)).toBeInstanceOf(Cancelled);
    await advance(5000);
  });

  test("every repeats until stopped, and only while running", async () => {
    const { timers, advance } = fakeTimers();
    const clock = createClock(timers);
    let ticks = 0;
    const stop = clock.every(100, () => ticks++);
    await advance(350);
    expect(ticks).toBe(3);
    clock.pause();
    await advance(1000);
    expect(ticks).toBe(3);
    clock.resume();
    await advance(100);
    expect(ticks).toBe(4);
    stop();
    await advance(1000);
    expect(ticks).toBe(4);
  });

  test("cancelling stops every", async () => {
    const { timers, advance } = fakeTimers();
    const clock = createClock(timers);
    let ticks = 0;
    clock.every(100, () => ticks++);
    await advance(100);
    clock.cancel();
    await advance(1000);
    expect(ticks).toBe(1);
  });
});
