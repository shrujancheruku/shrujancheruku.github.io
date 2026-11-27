// Plays a plan (src/lib/motion.ts) with one GSAP timeline. It is the one place
// that builds a timeline, guards its completion, reverses it when the visitor
// turns back, and cleans up when it rests; the plan says what moves and when.
// Sizes only the page knows (a window's height, the area's) are resolved here.
//
// With reduced motion it is not called: the windows are simply there.
import { gsap } from "gsap";
import type { Clip, PageTurn, Plan, Slide } from "../lib/motion";
import type { Rect } from "../lib/workspaces";
import type { Paged } from "./paged";

/** A tile as the style of a window, written `left/top/width/height`, never scale. */
export const css = ([left, top, width, height]: Rect) => ({
  left: `${left}%`,
  top: `${top}%`,
  width: `${width}%`,
  height: `${height}%`,
});

/**
 * A copy of `el` that is only seen: marked as a clone, with no ids, hidden from
 * assistive technology and inert.
 */
function inertClone(el: HTMLElement): HTMLElement {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.removeAttribute("id");
  for (const e of copy.querySelectorAll("[id]")) e.removeAttribute("id");
  copy.dataset.clone = "true";
  copy.setAttribute("aria-hidden", "true");
  copy.inert = true;
  return copy;
}

/** A paged window turning its page: its old entries, as a copy that leaves. */
interface Turn {
  paged: Paged;
  old: HTMLElement;
  /** What the window's own list was positioned against, to put back. */
  parent: HTMLElement;
  position: string;
}

/** The clip a window has at a point of a roll, `height` px tall. */
const inset = ({ top, bottom }: Clip, height: number): string =>
  `inset(${top * height}px 0px ${bottom * height}px 0px)`;

export interface MotionPlayerConfig {
  area: HTMLElement;
  /** The window panes by id. */
  windows: ReadonlyMap<string, HTMLElement>;
  /** The paged parts of a window, if it has any. */
  paged: (id: string) => Paged | undefined;
  /** A motion turned back reached where it began: write the windows at rest there. */
  atStart: () => void;
  /** No motion runs any more (it ended, or was turned back to its start). */
  settled: () => void;
}

export interface MotionPlayer {
  /**
   * Copy the entries of the paged windows the plan turns, before they show
   * their next page.
   */
  prepare: (plan: Plan) => void;
  /** Play the plan, from the windows as they are written. */
  play: (plan: Plan) => void;
  /** What is playing, if anything. */
  readonly motion: Plan["motion"] | null;
  /** Turn the running motion back; turned back again, it plays forwards. */
  reverse: () => void;
  /** End the running motion, if any, with its windows at rest. */
  stop: () => boolean;
}

export function createMotionPlayer(config: MotionPlayerConfig): MotionPlayer {
  const { area, windows, paged } = config;
  /** The newest motion's timeline; one that a later one stopped does not end it. */
  let latest: gsap.core.Timeline | null = null;
  let playing: Plan | null = null;
  /** The running motion's clean-up: what leaves goes, and fades are cleared. */
  let rest: (() => void) | null = null;
  /** The page turns of the step being placed, taken before its pages change. */
  let turns = new Map<string, Turn>();

  function copyEntries(id: string): Turn | undefined {
    const parts = paged(id);
    if (!parts) return undefined;
    const { list } = parts;
    const parent = list.parentElement ?? parts.root;
    const position = parent.style.position;
    if (getComputedStyle(parent).position === "static")
      parent.style.position = "relative";
    const old = inertClone(list);
    old.removeAttribute("data-paged");
    for (const e of old.querySelectorAll("[data-entry]"))
      e.removeAttribute("data-entry");
    for (const e of old.querySelectorAll("[aria-current]"))
      e.removeAttribute("aria-current");
    Object.assign(old.style, {
      position: "absolute",
      top: `${list.offsetTop}px`,
      left: `${list.offsetLeft}px`,
      width: `${list.offsetWidth}px`,
      margin: "0",
    });
    parent.append(old);
    return { paged: parts, old, parent, position };
  }

  function prepare(plan: Plan): void {
    turns = new Map();
    for (const { id } of plan.turns) {
      const turn = copyEntries(id);
      if (turn) turns.set(id, turn);
    }
  }

  /** A motion that ends, or is stopped or turned back: what leaves goes. */
  function atRest(): void {
    rest?.();
    rest = null;
  }

  /**
   * The completion guard: `then`, run for `timeline` only while it is the
   * newest motion. One that a later motion stopped does nothing when it ends.
   */
  const whileLatest =
    (timeline: gsap.core.Timeline, then: () => void) => (): void => {
      if (timeline === latest) then();
    };

  /** The newest motion ended: no motion runs any more. */
  function settle(): void {
    latest = null;
    playing = null;
    config.settled();
  }

  /** The newest motion, turned back, reached where it began: its windows go to rest there. */
  function backAtStart(timeline: gsap.core.Timeline): void {
    timeline.kill();
    atRest();
    config.atStart();
    settle();
  }

  function play(plan: Plan): void {
    const leaving: HTMLElement[] = [];
    const copies: HTMLElement[] = [];
    const faded: HTMLElement[] = [];
    const moved: HTMLElement[] = [];
    const clipped: HTMLElement[] = [];
    const entries: HTMLElement[] = [];
    // the area's height, before it is clipped
    const areaHeight = area.clientHeight;
    const overflow = area.style.overflow;
    if (plan.clipsArea) area.style.overflow = "hidden";
    const timeline = gsap.timeline();
    timeline.eventCallback(
      "onComplete",
      whileLatest(timeline, () => {
        atRest();
        settle();
      }),
    );
    // the first appearance is not turned back
    if (plan.motion !== "first appearance")
      timeline.eventCallback(
        "onReverseComplete",
        whileLatest(timeline, () => backAtStart(timeline)),
      );
    const px = (slide: Slide, extent: number): [number, number] => [
      slide.from * (extent + slide.gap),
      slide.to * (extent + slide.gap),
    ];

    for (const w of plan.windows) {
      const pane = windows.get(w.id);
      if (!pane) continue;
      let target = pane;
      if (w.shownAt) {
        if (w.copy) {
          // the pane is already on its new tile: a copy leaves from the old one
          target = inertClone(pane);
          target.removeAttribute("data-window");
          area.append(target);
          copies.push(target);
        }
        target.style.display = "block";
        Object.assign(target.style, css(w.shownAt));
      }
      if (w.leaves && !w.copy) leaving.push(pane);
      if (w.frame) {
        const { from, to, at, duration, ease } = w.frame;
        timeline.fromTo(target, css(from), { ...css(to), duration, ease }, at);
      }
      if (w.fade) {
        const { from, to, at, duration, ease } = w.fade;
        timeline.fromTo(
          target,
          { opacity: from },
          { opacity: to, duration, ease },
          at,
        );
        faded.push(target);
      }
      if (w.slide) {
        const { clip, at, duration, ease } = w.slide;
        const extent =
          w.slide.extent === "area" ? areaHeight : target.offsetHeight;
        const [from, to] = px(w.slide, extent);
        timeline.fromTo(
          target,
          { y: from, ...(clip ? { clipPath: inset(clip.from, extent) } : {}) },
          {
            y: to,
            ...(clip ? { clipPath: inset(clip.to, extent) } : {}),
            duration,
            ease,
          },
          at,
        );
        if (!w.copy) {
          moved.push(target);
          if (clip) clipped.push(target);
        }
      }
    }

    // a paged window turning its page: its entries roll past inside the window
    // (the window's body clips them); its frame and title bar stay
    const turned: Turn[] = [];
    for (const t of plan.turns) {
      const turn = turns.get(t.id);
      if (!turn) continue;
      turned.push(turn);
      const extent = turn.paged.root.clientHeight;
      const roll = (target: HTMLElement, slide: PageTurn["out"]) => {
        const [from, to] = px(slide, extent);
        timeline.fromTo(
          target,
          { y: from },
          { y: to, duration: slide.duration, ease: slide.ease },
          slide.at,
        );
      };
      roll(turn.old, t.out);
      roll(turn.paged.list, t.in);
      entries.push(turn.paged.list);
    }
    turns = new Map();

    // a step whose windows only appear and go still takes the step's time
    timeline.set({}, {}, plan.duration);
    rest = () => {
      for (const pane of leaving) pane.style.display = "none";
      for (const copy of copies) copy.remove();
      gsap.set(faded, { clearProps: "opacity" });
      gsap.set(moved, { clearProps: "transform" });
      gsap.set(clipped, { clearProps: "clipPath" });
      gsap.set(entries, { clearProps: "transform" });
      for (const { old, parent, position } of turned) {
        old.remove();
        parent.style.position = position;
      }
      if (plan.clipsArea) area.style.overflow = overflow;
    };
    latest = timeline;
    playing = plan;
  }

  return {
    prepare,
    play,
    get motion() {
      return playing?.motion ?? null;
    },
    reverse() {
      const timeline = latest;
      if (!timeline) return;
      if (timeline.reversed()) timeline.play();
      else timeline.reverse();
      // turned back before it moved: it is already where it began
      // (it is the newest motion, so no guard)
      if (timeline.reversed() && timeline.time() === 0) backAtStart(timeline);
    },
    stop() {
      if (!latest) return false;
      const running = latest;
      latest = null;
      playing = null;
      running.kill();
      atRest();
      return true;
    },
  };
}
