// A composition's lifecycle, with no DOM: which mode it is in (idle, playing,
// paused, held, frame) and every transition between them. It is driven by the
// clock it is given; `mount` (src/compositions/kit.ts) forwards the page's
// events in and writes what is reported back out.
import { Cancelled, type Clock } from "./composition-clock";

export type Mode = "idle" | "playing" | "paused" | "held" | "frame";

export interface Report {
  mode: Mode;
  /** The still frame on show, or null. */
  frame: string | null;
}

export interface DrawState {
  /** Its window is on show (the desktop's `composition:enter`). */
  active: boolean;
  /** Its window is in view. */
  onscreen: boolean;
  /** The tab is visible. */
  visible: boolean;
}

export function drawing(state: DrawState): boolean {
  return state.active && state.onscreen && state.visible;
}

export interface FrameAsk {
  /** `data-frame` on the slot: a frame's name, or `card` for the share card's. */
  asked: string | undefined;
  /** The names of the composition's frames. */
  frames: readonly string[];
  /** The frame its share card shows. */
  card: string;
  flashes: boolean;
  reduced: boolean;
}

/** The still frame to show instead of playing, if any (null: play). */
export function frameToShow({
  asked,
  frames,
  card,
  flashes,
  reduced,
}: FrameAsk): string | null {
  const name = asked === "card" ? card : asked;
  if (name && frames.includes(name)) return name;
  if (flashes && reduced) return card;
  return null;
}

export interface LifecycleOptions {
  /** A new clock for each run. */
  createClock(): Clock;
  /** Starts a run on `clock`; resolves when its end state is on screen. */
  play(clock: Clock): Promise<void>;
  /** Puts the scene in a named still frame. */
  showFrame(name: string): void;
  /** Called after every change of what is reported. */
  onChange(report: Report): void;
  /** Hold the end this long, then play again. Without it the end is held for good. */
  holdMs?: number | undefined;
  /** The names of the composition's frames. */
  frames: readonly string[];
  card: string;
  flashes?: boolean | undefined;
  /** The window is on show to begin with. */
  active?: boolean;
  /** The tab is visible to begin with. */
  visible?: boolean;
  reduced?: boolean;
  asked?: string | undefined;
}

export interface Lifecycle {
  enter(): void;
  leave(): void;
  setOnscreen(onscreen: boolean): void;
  setVisible(visible: boolean): void;
  setReduced(reduced: boolean): void;
  /** `data-frame` on the slot changed. */
  setAsked(asked: string | undefined): void;
  /** Bring the scene in line with what is true now (at mount). */
  sync(): void;
  readonly report: Report;
}

export function createLifecycle(opts: LifecycleOptions): Lifecycle {
  let active = opts.active ?? false;
  let onscreen = false;
  let visible = opts.visible ?? true;
  let reduced = opts.reduced ?? false;
  let asked = opts.asked;
  /** The clock of the run on show, or null if none has begun. */
  let running: Clock | null = null;
  let finished = false;
  let mode: Mode = "idle";
  let frame: string | null = null;

  const notify = (): void => opts.onChange({ mode, frame });
  const setMode = (next: Mode): void => {
    mode = next;
    notify();
  };
  const swallowCancelled = (e: unknown): void => {
    if (!(e instanceof Cancelled)) throw e;
  };

  const stop = (): void => {
    running?.cancel();
    running = null;
    finished = false;
  };

  const begin = (): void => {
    stop();
    const mine = opts.createClock();
    running = mine;
    if (drawing({ active, onscreen, visible })) setMode("playing");
    else {
      mine.pause();
      setMode("paused");
    }
    opts
      .play(mine)
      .then(() => {
        if (running !== mine) return;
        finished = true;
        setMode("held");
        const again = opts.holdMs;
        if (again === undefined) return;
        mine
          .sleep(again)
          .then(() => {
            if (running === mine && active) begin();
          })
          .catch(swallowCancelled);
      })
      .catch(swallowCancelled);
  };

  const update = (): void => {
    const name = frameToShow({
      asked,
      frames: opts.frames,
      card: opts.card,
      flashes: opts.flashes ?? false,
      reduced,
    });
    if (name) {
      stop();
      opts.showFrame(name);
      frame = name;
      setMode("frame");
      return;
    }
    if (frame !== null) {
      frame = null;
      notify();
    }
    if (!active) {
      if (mode !== "idle") setMode("idle");
      return;
    }
    if (mode === "frame" || mode === "idle") {
      begin();
      return;
    }
    if (finished) return;
    const draws = drawing({ active, onscreen, visible });
    if (draws && running?.paused) {
      running.resume();
      setMode("playing");
    } else if (!draws && running && !running.paused) {
      running.pause();
      setMode("paused");
    }
  };

  return {
    enter() {
      active = true;
      stop();
      setMode("idle");
      update();
    },
    leave() {
      active = false;
      stop();
      setMode("idle");
      update();
    },
    setOnscreen(next) {
      onscreen = next;
      update();
    },
    setVisible(next) {
      visible = next;
      update();
    },
    setReduced(next) {
      reduced = next;
      update();
    },
    setAsked(next) {
      asked = next;
      update();
    },
    sync() {
      setMode("idle");
      update();
    },
    get report() {
      return { mode, frame };
    },
  };
}
