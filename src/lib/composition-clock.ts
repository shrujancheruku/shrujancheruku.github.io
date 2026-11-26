// The clock a composition runs on: sleeps and repeats that stop counting while
// the composition is not being drawn (off-screen, tab hidden) and that all end
// at once when it is restarted. Pure: the timer source is passed in.

export interface Timers {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** What a sleep rejects with when its run is cancelled. */
export class Cancelled extends Error {
  constructor() {
    super("the composition was restarted or left");
  }
}

export interface Clock {
  /** Resolves after `ms` of running time; rejects with `Cancelled`. */
  sleep(ms: number): Promise<void>;
  /** Calls `fn` every `ms` of running time. Returns a function that stops it. */
  every(ms: number, fn: () => void): () => void;
  pause(): void;
  resume(): void;
  /** Ends every pending sleep with `Cancelled`; later sleeps end the same way. */
  cancel(): void;
  readonly paused: boolean;
}

interface Pending {
  remaining: number;
  startedAt: number;
  handle: unknown;
  fire: () => void;
  fail: () => void;
}

const real: Timers = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export function createClock(timers: Timers = real): Clock {
  const pending = new Set<Pending>();
  let paused = false;
  let cancelled = false;

  const arm = (p: Pending): void => {
    p.startedAt = timers.now();
    p.handle = timers.setTimeout(() => {
      pending.delete(p);
      p.fire();
    }, p.remaining);
  };

  const schedule = (
    ms: number,
    fire: () => void,
    fail: () => void,
  ): Pending => {
    const p: Pending = {
      remaining: Math.max(0, ms),
      startedAt: 0,
      handle: undefined,
      fire,
      fail,
    };
    pending.add(p);
    if (!paused) arm(p);
    return p;
  };

  return {
    sleep(ms) {
      if (cancelled) return Promise.reject(new Cancelled());
      return new Promise((resolve, reject) => {
        schedule(ms, resolve, () => reject(new Cancelled()));
      });
    },
    every(ms, fn) {
      let stopped = false;
      let current: Pending | undefined;
      const next = (): void => {
        current = schedule(
          ms,
          () => {
            if (stopped) return;
            fn();
            next();
          },
          () => {},
        );
      };
      if (!cancelled) next();
      return () => {
        stopped = true;
        if (current) {
          timers.clearTimeout(current.handle);
          pending.delete(current);
        }
      };
    },
    pause() {
      if (paused) return;
      paused = true;
      for (const p of pending) {
        timers.clearTimeout(p.handle);
        p.remaining = Math.max(0, p.remaining - (timers.now() - p.startedAt));
      }
    },
    resume() {
      if (!paused) return;
      paused = false;
      for (const p of pending) arm(p);
    },
    cancel() {
      cancelled = true;
      for (const p of [...pending]) {
        timers.clearTimeout(p.handle);
        pending.delete(p);
        p.fail();
      }
    },
    get paused() {
      return paused;
    },
  };
}
