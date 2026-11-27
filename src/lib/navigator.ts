// The navigator: where the visitor is, and what the browser's history holds.
// Pure, no DOM: every input goes through `take`, which returns what to place
// and what to do to the history, and the desktop script (src/scripts/
// desktop.ts) carries that out, the history first, in order, then the
// placements, and plays the motion between them.
//
// Where the visitor is: a step, its screen (0 on a wide screen), and whether
// its disclosure (Education & Internships, or the archive) is open, with the
// screen it was opened from; the archive's entry; and whether an unknown path
// booted the desktop (not found). The navigator mirrors the address bar from
// its own effects and from `popstate`, and never reads it.
//
// Acting mid-motion. Every `animate` outcome is followed by exactly one
// `ended`, when no motion runs any more. Until then, an input whose final
// place is where the running motion began turns it back: the motion reverses
// from where the windows are, and anything waiting is dropped, except a Back
// or Forward (the address has already moved). Turned back, it runs to where it
// began, so a second reversal plays it forwards again. Any other input waits
// until the motion ends, then runs from rest; only the latest one is kept,
// after a Back or Forward that waited. The first appearance has no origin to
// turn back to, so everything during it waits.
import { type AddressBook, notFoundTitle } from "./addresses";
import { moveBy } from "./screens";
import { locate, stepAt, stepCount, type Workspace } from "./workspaces";

/** The archive's own address: the archive alone, on the last featured project. */
export const ARCHIVE_PATH = "/archive/";

/** Where the windows are: a step, its screen (0 on a wide screen), and whether its disclosure is open. */
export interface Where {
  step: number;
  screen: number;
  open: boolean;
}

export type Input =
  /** The desktop loads at `path`, on `step`; `notFound`: the path is no address. */
  | { kind: "boot"; path: string; step: number; notFound: boolean }
  /** One screen up or down (a wheel gesture, a key, a swipe). */
  | { kind: "move"; direction: 1 | -1 }
  /** A deliberate jump to a step: it adds a history entry. */
  | { kind: "jump"; step: number }
  /** A deliberate jump to an address, which may be the archive's. */
  | { kind: "path"; path: string }
  /** Open or close the step's disclosure (Education & Internships). */
  | { kind: "disclosure"; open: boolean }
  /** Open the archive (on `entry`'s screen), or close it. */
  | { kind: "archive"; open: boolean; entry?: string }
  /** The browser's Back or Forward moved the address to `path`. */
  | { kind: "popstate"; path: string }
  /** No motion is running any more. */
  | { kind: "ended" }
  /** What fits changed, or wide <-> touch: place again, on `screen` if given. */
  | { kind: "refit"; screen?: number | undefined };

/** One thing to do to the browser's history, or the tab's title. */
export type HistoryEffect =
  | { push: string }
  | { replace: string }
  | { back: true }
  | { title: string };

/**
 * What to do with the windows: nothing; place them at rest; move them from
 * where they are (followed by one `ended`); or turn the running motion back.
 */
export type Motion = "none" | "place" | "animate" | "turn back";

export interface Outcome {
  /** Carried out in order, before placing. */
  history: readonly HistoryEffect[];
  /** Where the windows were placed before; null for the first appearance. */
  from: Where | null;
  /**
   * Places the windows go to at rest on the way, in order, before moving to
   * `to` (a jump out of not-found, or to an archive address on another step).
   */
  rest: readonly Where[];
  to: Where;
  motion: Motion;
  /** The archive opened on this entry ("" for the archive alone). */
  entry?: string;
  /**
   * The not-found terminal is on show as the windows are placed (scrolling
   * out of not-found clears it after placing: the next placement hides it).
   */
  notFound: boolean;
  /** False: the path is not an address, and nothing changed. */
  handled: boolean;
}

export interface NavigatorOptions {
  workspaces: readonly Workspace[];
  book: AddressBook;
  /** How many screens step `step` has, its disclosure open or not. */
  screens(step: number, open: boolean): number;
  /** Which screen of step `step`'s archive holds `entry` (0 for ""). */
  screenOfEntry(step: number, entry: string): number;
  /** Whether the desktop has an archive window. */
  hasArchive: boolean;
}

export interface Navigator {
  take(input: Input): Outcome;
  /** Where the visitor is now. */
  readonly where: Where;
  /** Whether the not-found terminal is on show. */
  readonly notFound: boolean;
}

/** The navigator's own state: everything that says where. */
interface State {
  step: number;
  screen: number;
  open: boolean;
  /** The screen the disclosure was opened from, which closing returns to. */
  screenBeforeOpen: number;
  notFound: boolean;
  /** The archive entered the address bar as a history entry of its own (Back closes it). */
  archivePushed: boolean;
  /** The address bar, as mirrored. */
  address: string;
  /** Backs the page took itself, whose popstate only reconciles the title. */
  ownBacks: number;
  /** Where the windows were last placed. */
  placed: Where | null;
  /**
   * The running motion's two ends (`from` null for the first appearance);
   * `pushed`: the input that began it added a history entry.
   */
  running: { from: Where | null; to: Where; pushed: boolean } | null;
  /** The input that waits for the running motion to end: the latest only. */
  waiting: Exclude<Input, { kind: "popstate" }> | null;
  /** A Back or Forward waits: it runs before `waiting`, and nothing drops it. */
  waitingBack: boolean;
}

/** What one input does, as it is worked out. */
interface Plan {
  history: HistoryEffect[];
  /**
   * Each place the windows go to, in order, all but the last at rest; with
   * whether the not-found terminal is on show as it is placed.
   */
  placements: { where: Where; animate: boolean; notFound: boolean }[];
  entry?: string;
  /** The input added a history entry. */
  pushed: boolean;
}

const same = (a: Where, b: Where): boolean =>
  a.step === b.step && a.screen === b.screen && a.open === b.open;

export function createNavigator({
  workspaces,
  book,
  screens,
  screenOfEntry,
  hasArchive,
}: NavigatorOptions): Navigator {
  const steps = stepCount(workspaces);
  const clamp = (n: number) => Math.max(0, Math.min(steps - 1, n));
  const inProjects = (n: number): boolean =>
    workspaces[locate(workspaces, n).workspace]?.id === "projects";

  let s: State = {
    step: 0,
    screen: 0,
    open: false,
    screenBeforeOpen: 0,
    notFound: false,
    archivePushed: false,
    address: "/",
    ownBacks: 0,
    placed: null,
    running: null,
    waiting: null,
    waitingBack: false,
  };

  const here = (): Where => ({ step: s.step, screen: s.screen, open: s.open });
  const plan = (): Plan => ({ history: [], placements: [], pushed: false });
  const place = (p: Plan, animate = true) =>
    p.placements.push({ where: here(), animate, notFound: s.notFound });
  const title = (p: Plan, t: string) => p.history.push({ title: t });
  const push = (p: Plan, path: string) => {
    p.history.push({ push: path });
    s.address = path;
    p.pushed = true;
  };
  const replace = (p: Plan, path: string) => {
    p.history.push({ replace: path });
    s.address = path;
  };
  /** Go Back one entry for the visitor: the windows are already going there. */
  const goBackOver = (p: Plan) => {
    s.ownBacks++;
    p.history.push({ back: true });
  };

  /**
   * A screen on show may hold more than its step has once its disclosure is
   * measured (the desktop script clamps it as it places): bring it in.
   */
  const fit = (w: Where): Where => ({
    ...w,
    screen: Math.max(0, Math.min(screens(w.step, w.open) - 1, w.screen)),
  });
  function fitAll(): void {
    s.screen = fit(here()).screen;
    if (s.placed) s.placed = fit(s.placed);
    if (s.running)
      s.running = {
        ...s.running,
        from: s.running.from && fit(s.running.from),
        to: fit(s.running.to),
      };
  }

  // ---- transitions: each changes `s` and adds to the plan

  /** Show the address of a step without adding history (scrolling). */
  function follow(p: Plan, n: number): void {
    if (s.notFound && n !== 0) s.notFound = false;
    // a Back the page took is on its way: the address it lands on is the step's
    if (s.notFound || s.ownBacks > 0) return;
    const address = book.forStep(n);
    title(p, address.title);
    if (s.address !== address.path && book.stepFor(s.address) !== n)
      replace(p, address.path);
  }

  /** Leaving a step closes its disclosure. */
  function leave(): void {
    s.archivePushed = false;
    s.open = false;
  }

  /** Move to a step, and a screen of it. */
  function goTo(p: Plan, n: number, toScreen = 0): void {
    const next = clamp(n);
    if (next === s.step && toScreen === s.screen) return;
    const changed = next !== s.step;
    // a move between screens of the step keeps its disclosure open
    if (changed) leave();
    s.step = next;
    s.screen = toScreen;
    place(p);
    if (changed) follow(p, next);
  }

  /** Open or close the step's disclosure. */
  function setOpen(p: Plan, next: boolean): void {
    if (next === s.open) return;
    if (next && !stepAt(workspaces, s.step).open) return;
    if (next) s.screenBeforeOpen = s.screen;
    s.open = next;
    if (!next) s.archivePushed = false;
    // opened, its screens are the disclosure's; closed, back to where it began
    s.screen = next ? 0 : s.screenBeforeOpen;
    place(p);
  }

  /**
   * Open the archive on the step on show, on the screen that holds `entry`:
   * the one transition a click, an address, Back or Forward, and boot share.
   * `pushed`: the archive's address goes in as a history entry of its own.
   * The caller places. False if it does not open.
   */
  function openArchive(p: Plan, entry: string, pushed: boolean): boolean {
    if (!hasArchive || s.open || !inProjects(s.step)) return false;
    if (!stepAt(workspaces, s.step).open) return false;
    if (pushed) {
      push(p, ARCHIVE_PATH);
      s.archivePushed = true;
      const archive = book.forPath(ARCHIVE_PATH);
      if (archive) title(p, archive.title);
    }
    s.screenBeforeOpen = s.screen;
    s.open = true;
    // the desktop script clamps this once the archive's screens are measured
    s.screen = screenOfEntry(s.step, entry);
    p.entry = entry;
    return true;
  }

  function closeArchive(p: Plan): void {
    if (!s.open || !inProjects(s.step)) return;
    const address = book.forStep(s.step);
    // the archive's own entry: Back to the address underneath, whose popstate
    // only reconciles the title; the windows close (or turn back) here and now
    if (s.archivePushed) goBackOver(p);
    else replace(p, address.path);
    title(p, address.title);
    setOpen(p, false);
  }

  /** Jump to step `next`; `undo` goes Back over the running jump's entry instead of adding one. */
  function jumpNow(p: Plan, next: number, undo: boolean): void {
    const there = !s.notFound && book.stepFor(s.address) === next;
    if (undo) {
      s.archivePushed = false;
      goBackOver(p);
      title(p, book.forStep(next).title);
    } else if (!there) {
      const address = book.forStep(next);
      push(p, address.path);
      title(p, address.title);
    }
    // out of not-found: the terminal goes, the windows at rest where they are
    if (s.notFound) {
      s.notFound = false;
      place(p, false);
    }
    // a jump to the step the disclosure is open on closes it
    if (s.open && next === s.step) setOpen(p, false);
    goTo(p, next);
  }

  /** Back or Forward: show the address's step, with no new entry. */
  function restore(p: Plan): void {
    const n = book.stepFor(s.address);
    s.notFound = n === undefined;
    const next = n ?? 0;
    const address = book.forPath(s.address);
    title(p, address?.title ?? notFoundTitle);
    // closing the disclosure (Back) lands on the screen it was opened from
    const returning = s.open && next === s.step;
    const stays = next === s.step;
    leave();
    const entry = hasArchive ? address?.archive : undefined;
    s.step = next;
    if (entry === undefined) s.screen = returning ? s.screenBeforeOpen : 0;
    else {
      // the archive opens from the screen on show, if the step stays
      if (!stays) s.screen = 0;
      else if (returning) s.screen = s.screenBeforeOpen;
      openArchive(p, entry, false);
    }
    place(p);
  }

  /** The step and screen one screen on from those on show. */
  const oneScreenOn = (direction: 1 | -1) => {
    const from = here();
    return moveBy(
      from,
      direction,
      (n) => screens(n, n === from.step && from.open),
      steps,
    );
  };

  /** Work out what an input does, from the state as it is now. */
  function run(p: Plan, input: Input, undo: boolean): void {
    switch (input.kind) {
      case "move": {
        const next = oneScreenOn(input.direction);
        goTo(p, next.step, next.screen);
        return;
      }
      case "jump":
        jumpNow(p, clamp(input.step), undo);
        return;
      case "path": {
        const n = book.stepFor(input.path) ?? 0;
        const entry = book.forPath(input.path)?.archive;
        if (entry === undefined) {
          jumpNow(p, clamp(n), undo);
          return;
        }
        // an archive address: its step, then the archive open on its entry
        if (n !== s.step) jumpNow(p, n, false);
        if (openArchive(p, entry, true)) place(p);
        return;
      }
      case "disclosure":
        setOpen(p, input.open);
        return;
      case "archive":
        if (!input.open) closeArchive(p);
        else if (openArchive(p, input.entry ?? "", true)) place(p);
        return;
      case "popstate":
        restore(p);
        return;
    }
  }

  // ---- outcomes

  const outcome = (p: Plan, handled = true): Outcome => ({
    history: p.history,
    from: s.placed,
    rest: [],
    to: here(),
    motion: "none",
    ...(p.entry !== undefined && { entry: p.entry }),
    notFound: s.notFound,
    handled,
  });

  /** The plan's placements become what to place, and the last one's motion runs. */
  function commit(p: Plan, rests = true): Outcome {
    const last = p.placements.at(-1);
    if (!last) return outcome(p);
    const from = s.placed;
    const rest = rests ? p.placements.slice(0, -1).map((r) => r.where) : [];
    s.placed = last.where;
    if (last.animate)
      s.running = {
        from: rest.at(-1) ?? from,
        to: last.where,
        pushed: p.pushed,
      };
    return {
      ...outcome(p),
      from,
      rest,
      to: last.where,
      motion: last.animate ? "animate" : "place",
      notFound: last.notFound,
    };
  }

  /**
   * An input through the rule: at rest it runs at once. During a motion, one
   * whose final place is where the motion began turns it back; any other
   * waits for the motion to end.
   */
  function act(input: Exclude<Input, { kind: "popstate" }> | null): Outcome {
    const running = s.running;
    if (!running) {
      const p = plan();
      if (input) run(p, input, false);
      else restore(p);
      return commit(p);
    }
    // worked out on a copy: a waiting input changes nothing
    const before = s;
    s = { ...before };
    const p = plan();
    // a jump that turns back a jump goes Back over that jump's entry, so the
    // history holds only where the visitor settled
    if (input) run(p, input, running.pushed);
    else restore(p);
    const last = p.placements.at(-1);
    if (!running.from || !last || !same(last.where, running.from)) {
      s = before;
      if (input) s.waiting = input;
      else s.waitingBack = true;
      return outcome(plan());
    }
    s.waiting = null;
    s.running = { from: running.to, to: running.from, pushed: false };
    s.placed = running.from;
    return {
      ...outcome(p),
      from: running.to,
      to: running.from,
      motion: "turn back",
      notFound: last.notFound,
    };
  }

  function take(input: Input): Outcome {
    if (input.kind !== "boot" && s.placed) fitAll();
    switch (input.kind) {
      case "boot": {
        s.step = clamp(input.step);
        s.address = input.path;
        s.notFound = input.notFound;
        const p = plan();
        // /archive/ and an archive project's address boot with the archive open
        const entry = input.notFound
          ? undefined
          : book.forPath(input.path)?.archive;
        if (entry !== undefined) openArchive(p, entry, false);
        place(p, false);
        const o = commit(p);
        // the first appearance: every input waits for it
        s.running = { from: null, to: o.to, pushed: false };
        return { ...o, motion: "animate" };
      }
      case "ended": {
        s.running = null;
        if (s.waitingBack) {
          s.waitingBack = false;
          return act(null);
        }
        const waiting = s.waiting;
        s.waiting = null;
        return waiting ? act(waiting) : outcome(plan());
      }
      case "refit": {
        if (input.screen !== undefined) s.screen = input.screen;
        const p = plan();
        place(p, false);
        return commit(p);
      }
      case "popstate": {
        s.address = input.path;
        if (s.ownBacks > 0) {
          // a Back the page took itself: the windows are already on their way
          s.ownBacks--;
          const p = plan();
          const address = book.forPath(input.path);
          if (address) title(p, address.title);
          return outcome(p);
        }
        return act(null);
      }
      case "path":
        if (book.stepFor(input.path) === undefined)
          return outcome(plan(), false);
        return act(input);
      default:
        return act(input);
    }
  }

  return {
    take,
    get where() {
      return here();
    },
    get notFound() {
      return s.notFound;
    },
  };
}
