// Turns one touch gesture into at most one step: the touch twin of the wheel
// gate. A swipe moves exactly one step, up or down, whatever its length or
// speed, so the page never scrolls on touch and nothing depends on how tall
// the browser says the screen is.
//
// A finger moving up goes down a step (+1), as a page scrolls. The step is
// taken as soon as the finger has travelled `distance` and mostly vertically,
// or at lift-off if a short, fast flick covered `flick` px at `speed` px/ms.
// Either way the gesture is spent: the rest of it steps nothing.

export interface SwipeOptions {
  /** How far, in px, a slow drag must travel to step. */
  distance: number;
  /** The least travel, in px, of a fast flick. */
  flick: number;
  /** How fast, in px/ms, a flick must be. */
  speed: number;
}

export interface Swipe {
  /** A finger went down. A second finger spends the gesture. */
  start(x: number, y: number, time: number): void;
  /** The finger moved; returns the step to take now: 1, -1 or 0. */
  move(x: number, y: number, time: number): 1 | -1 | 0;
  /** The finger lifted; returns the step to take now if none was taken. */
  end(x: number, y: number, time: number): 1 | -1 | 0;
  /** The browser cancelled the gesture, or a second finger joined. */
  cancel(): void;
}

export function createSwipe({ distance, flick, speed }: SwipeOptions): Swipe {
  let active = false;
  let spent = false;
  let x0 = 0;
  let y0 = 0;
  let t0 = 0;

  /** The step the finger's travel so far asks for. */
  const judge = (x: number, y: number, time: number, lifted: boolean) => {
    if (!active || spent) return 0;
    const dx = x - x0;
    const dy = y - y0;
    // a sideways drag is not a swipe between steps
    if (Math.abs(dy) <= Math.abs(dx)) return 0;
    const fast =
      lifted &&
      Math.abs(dy) >= flick &&
      Math.abs(dy) / Math.max(1, time - t0) >= speed;
    if (Math.abs(dy) < distance && !fast) return 0;
    spent = true;
    return dy < 0 ? 1 : -1;
  };

  return {
    start(x, y, time) {
      active = true;
      spent = false;
      x0 = x;
      y0 = y;
      t0 = time;
    },
    move: (x, y, time) => judge(x, y, time, false),
    end(x, y, time) {
      const direction = judge(x, y, time, true);
      active = false;
      return direction;
    },
    cancel() {
      active = false;
    },
  };
}
