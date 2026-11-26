// Turns one touch gesture into at most one step: the touch twin of the wheel
// gate. A swipe moves exactly one step, up or down, whatever its length or
// speed, so the page never scrolls on touch and nothing depends on how tall
// the browser says the screen is.
//
// A finger moving up goes down a step (+1), as a page scrolls. The step is
// taken as soon as the finger has travelled `distance` and mostly vertically,
// or at lift-off if a short, fast flick covered `flick` px at `speed` px/ms.
// Either way the gesture is spent: the rest of it steps nothing.
//
// Pinch-zoom stays the browser's: a gesture with a second finger steps
// nothing, nor does one that begins on a zoomed-in page (scale > 1), which is
// the visitor panning round the zoomed page. A gesture runs from its first
// finger down to its last finger up.

export interface SwipeOptions {
  /** How far, in px, a slow drag must travel to step. */
  distance: number;
  /** The least travel, in px, of a fast flick. */
  flick: number;
  /** How fast, in px/ms, a flick must be. */
  speed: number;
}

/** One pointer's reading, as a PointerEvent gives it. */
export interface Finger {
  /** The pointer's id: each finger of a gesture has its own. */
  id: number;
  x: number;
  y: number;
  /** The event's time, in ms. */
  time: number;
}

export interface Swipe {
  /**
   * A finger went down. `primary` says it is the first of a new gesture (the
   * event's `isPrimary`); `scale` is the page's zoom (`visualViewport.scale`).
   * A second finger spends the gesture.
   */
  down(finger: Finger, primary: boolean, scale: number): void;
  /** A finger moved; returns the step to take now: 1, -1 or 0. */
  move(finger: Finger): 1 | -1 | 0;
  /** A finger lifted; returns the step to take now if none was taken. */
  up(finger: Finger): 1 | -1 | 0;
  /** The browser took a finger (for its own pinch, say): the gesture steps nothing. */
  cancel(id: number): void;
  /** Forget every finger: the next one down starts afresh. */
  reset(): void;
}

/** Zoom within this of 1 is not zoomed in: float noise at the default scale. */
export const UNZOOMED = 1.01;

export function createSwipe({ distance, flick, speed }: SwipeOptions): Swipe {
  /** The fingers on the screen in this gesture. */
  const fingers = new Set<number>();
  /** The finger whose travel can step: the gesture's first. */
  let lead: number | null = null;
  let spent = false;
  let x0 = 0;
  let y0 = 0;
  let t0 = 0;

  /** The step the lead finger's travel so far asks for. */
  const judge = ({ id, x, y, time }: Finger, lifted: boolean) => {
    if (id !== lead || spent) return 0;
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

  const release = (id: number) => {
    fingers.delete(id);
    if (id === lead) lead = null;
  };

  const reset = () => {
    fingers.clear();
    lead = null;
    spent = false;
  };

  return {
    down(finger, primary, scale) {
      // a new gesture: a lost lift-off of the last one does not linger
      if (primary || fingers.size === 0) reset();
      fingers.add(finger.id);
      if (fingers.size > 1) {
        // a pinch, or two fingers panning: the browser's, never a step
        spent = true;
        return;
      }
      lead = finger.id;
      spent = scale > UNZOOMED;
      x0 = finger.x;
      y0 = finger.y;
      t0 = finger.time;
    },
    move: (finger) => judge(finger, false),
    up(finger) {
      const direction = judge(finger, true);
      release(finger.id);
      return direction;
    },
    cancel(id) {
      spent = true;
      release(id);
    },
    reset,
  };
}
