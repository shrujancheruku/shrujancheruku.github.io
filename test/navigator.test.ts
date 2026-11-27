import { describe, expect, test } from "bun:test";
import { archiveAddresses, createAddressBook } from "../src/lib/addresses";
import {
  createNavigator,
  type HistoryEffect,
  type Input,
  type Outcome,
  type Where,
} from "../src/lib/navigator";
import { createWorkspaces, firstStepOf } from "../src/lib/workspaces";

const workspaces = createWorkspaces({ featured: 3, archive: true });
const book = createAddressBook(
  workspaces,
  [
    { repository: "issho", pitch: "Find your people." },
    { repository: "unmacos", pitch: "A Mac in a tab." },
    { repository: "TrueCrypt-Steganography", pitch: "Hide things." },
  ],
  archiveAddresses(workspaces, [
    { repository: "Old-Thing", pitch: "An old thing." },
    { repository: "older", pitch: "Older still." },
  ]),
);

/** The first step of each workspace, by id. */
const first = (id: string) =>
  firstStepOf(
    workspaces,
    workspaces.findIndex((w) => w.id === id),
  );
const OPENING = first("opening");
const TIMELINE = first("timeline");
const PROJECTS = first("projects");
/** The last featured project's step, where the archive's addresses open. */
const LAST_PROJECT = PROJECTS + 2;
const ABOUT = first("about");
const SABBATICAL = first("sabbatical");
const CONTACT = first("contact");

const at = (step: number, open = false, screen = 0): Where => ({
  step,
  screen,
  open,
});

/**
 * A browser's history held in memory: it carries out an outcome's effects as
 * the desktop script does, and a Back or Forward (the visitor's, or one the
 * page took) moves the address at once and queues its `popstate`, which
 * `deliver` feeds back to the navigator, as the browser does a moment later.
 */
function memoryHistory(path: string) {
  const entries = [path];
  let index = 0;
  let title = "";
  const queued: string[] = [];
  const go = (by: number) => {
    const next = index + by;
    if (next < 0 || next >= entries.length) return;
    index = next;
    queued.push(entries[index] ?? "");
  };
  return {
    carry(effects: readonly HistoryEffect[]) {
      for (const e of effects) {
        if ("push" in e) {
          entries.splice(index + 1, entries.length, e.push);
          index++;
        } else if ("replace" in e) entries[index] = e.replace;
        else if ("back" in e) go(-1);
        else title = e.title;
      }
    },
    back: () => go(-1),
    forward: () => go(1),
    queued,
    get path() {
      return entries[index] ?? "";
    },
    get title() {
      return title;
    },
    /** The entries up to the one on show: what Back walks through. */
    get trail() {
      return entries.slice(0, index + 1);
    },
  };
}

interface DeskOptions {
  path?: string;
  /** How many screens a step has (1 on a wide screen). */
  screens?: (step: number, open: boolean) => number;
  screenOfEntry?: (step: number, entry: string) => number;
  hasArchive?: boolean;
}

/**
 * A desktop under test: a navigator and a history in memory. `take` sends an
 * input and carries out its history; `back` / `forward` are the visitor's;
 * `deliver` feeds the queued popstates back; `settle` sends `ended` until no
 * motion runs, as the desktop script does when each motion ends.
 */
function desk({
  path = "/",
  screens = () => 1,
  screenOfEntry = () => 0,
  hasArchive = true,
}: DeskOptions = {}) {
  const navigator = createNavigator({
    workspaces,
    book,
    screens,
    screenOfEntry,
    hasArchive,
  });
  const browser = memoryHistory(path);
  let moving = false;
  const take = (input: Input): Outcome => {
    const outcome = navigator.take(input);
    browser.carry(outcome.history);
    if (input.kind === "ended") moving = false;
    if (outcome.motion === "animate") moving = true;
    return outcome;
  };
  const deliver = (): Outcome[] =>
    browser.queued.splice(0).map((p) => take({ kind: "popstate", path: p }));
  const boot = () =>
    take({
      kind: "boot",
      path,
      step: book.stepFor(path) ?? 0,
      notFound: book.stepFor(path) === undefined,
    });
  return {
    navigator,
    browser,
    take,
    deliver,
    boot,
    /** The visitor's Back, its popstate delivered. */
    back: () => {
      browser.back();
      return deliver();
    },
    forward: () => {
      browser.forward();
      return deliver();
    },
    /** Every motion runs to its end, and what waited runs after it. */
    settle: () => {
      deliver();
      for (let n = 0; moving && n < 10; n++) {
        take({ kind: "ended" });
        deliver();
      }
    },
    jump: (step: number) => take({ kind: "jump", step }),
    move: (direction: 1 | -1) => take({ kind: "move", direction }),
  };
}

/** A desktop booted at `path` whose first appearance has ended. */
function booted(options: DeskOptions = {}) {
  const d = desk(options);
  d.boot();
  d.settle();
  return d;
}

describe("the first appearance", () => {
  test("boot places the address's step and begins the first appearance", () => {
    const d = desk({ path: "/about/" });
    const o = d.boot();
    expect(o).toMatchObject({
      from: null,
      to: at(ABOUT),
      motion: "animate",
      notFound: false,
      handled: true,
    });
    expect(o.history).toEqual([]);
  });
});

describe("turning back (e2e/turning-back.e2e.ts, as inputs)", () => {
  test("a jump back to the workspace a change began from turns it back, and Back takes its entry away", () => {
    const d = booted();
    expect(d.jump(CONTACT)).toMatchObject({
      history: expect.arrayContaining([{ push: "/contact/" }]),
      from: at(OPENING),
      to: at(CONTACT),
      motion: "animate",
    });
    const back = d.jump(OPENING);
    expect(back).toMatchObject({
      from: at(CONTACT),
      to: at(OPENING),
      motion: "turn back",
    });
    expect(back.history[0]).toEqual({ back: true });
    // the page's own Back comes back with only its title
    const [own] = d.deliver();
    expect(own?.motion).toBe("none");
    expect(own?.history).toEqual([{ title: book.forStep(OPENING).title }]);
    d.settle();
    expect(d.navigator.where).toEqual(at(OPENING));
    expect(d.browser.path).toBe("/");
  });

  test("Back after a jump turned back by a jump lands where the visitor settled before it", () => {
    const d = booted();
    d.jump(ABOUT);
    d.settle();
    d.jump(CONTACT);
    expect(d.jump(ABOUT).motion).toBe("turn back");
    d.settle();
    expect(d.navigator.where).toEqual(at(ABOUT));
    expect(d.browser.path).toBe("/about/");
    // the turned-back jump left no entry of its own
    expect(d.browser.trail).toEqual(["/", "/about/"]);
    const [o] = d.back();
    expect(o).toMatchObject({ to: at(OPENING), motion: "animate" });
    d.settle();
    expect(d.browser.path).toBe("/");
  });

  test("Back after a jump turns it back, onto the step and address before", () => {
    const d = booted();
    d.jump(TIMELINE);
    const [o] = d.back();
    expect(o).toMatchObject({
      from: at(TIMELINE),
      to: at(OPENING),
      motion: "turn back",
    });
    d.settle();
    expect(d.navigator.where).toEqual(at(OPENING));
    expect(d.browser.path).toBe("/");
  });

  test("the opposite key turns a step back and drops what waited: down, down, up ends where it began", () => {
    const d = booted();
    expect(d.move(1)).toMatchObject({ to: at(TIMELINE), motion: "animate" });
    expect(d.move(1)).toMatchObject({ motion: "none", history: [] });
    expect(d.move(-1)).toMatchObject({ to: at(OPENING), motion: "turn back" });
    expect(d.take({ kind: "ended" }).motion).toBe("none");
    expect(d.navigator.where).toEqual(at(OPENING));
    expect(d.browser.path).toBe("/");
  });

  test("a second reversal plays the step forwards again", () => {
    const d = booted();
    d.move(1);
    d.settle();
    d.move(-1);
    d.settle();
    d.move(1);
    expect(d.move(-1)).toMatchObject({
      from: at(TIMELINE),
      to: at(OPENING),
      motion: "turn back",
    });
    expect(d.move(1)).toMatchObject({
      from: at(OPENING),
      to: at(TIMELINE),
      motion: "turn back",
    });
    d.settle();
    expect(d.navigator.where).toEqual(at(TIMELINE));
    expect(d.browser.path).toBe("/timeline/");
  });

  test("any other input waits, only the latest runs, and a jump that waited adds its entry when it runs", () => {
    const d = booted();
    d.jump(CONTACT);
    expect(d.jump(PROJECTS)).toMatchObject({ motion: "none", history: [] });
    expect(d.jump(ABOUT)).toMatchObject({ motion: "none", history: [] });
    expect(d.take({ kind: "ended" })).toMatchObject({
      history: expect.arrayContaining([{ push: "/about/" }]),
      from: at(CONTACT),
      to: at(ABOUT),
      motion: "animate",
    });
    d.settle();
    expect(d.browser.trail).toEqual(["/", "/contact/", "/about/"]);
    d.back();
    d.settle();
    expect(d.navigator.where).toEqual(at(CONTACT));
    d.back();
    d.settle();
    expect(d.navigator.where).toEqual(at(OPENING));
  });

  test("a Back that waits for the motion is never dropped by a later input: the windows end on its address", () => {
    const d = booted();
    d.jump(CONTACT);
    d.settle();
    d.move(-1);
    expect(d.back()[0]?.motion).toBe("none");
    expect(d.move(-1).motion).toBe("none");
    // the Back runs first, and the step up runs from home, the top already
    expect(d.take({ kind: "ended" })).toMatchObject({
      to: at(OPENING),
      motion: "animate",
    });
    expect(d.take({ kind: "ended" }).motion).toBe("none");
    expect(d.navigator.where).toEqual(at(OPENING));
    expect(d.browser.path).toBe("/");
    // the entry ahead is the one the first step up scrolled to
    d.forward();
    d.settle();
    expect(d.navigator.where).toEqual(at(SABBATICAL));
    expect(d.browser.path).toBe("/now/");
  });

  for (const [how, input] of [
    ["Escape", { kind: "archive", open: false }],
    ["the opener again", { kind: "archive", open: false }],
  ] as const) {
    test(`closing the archive while it opens (${how}) turns it back onto the projects and their address`, () => {
      const d = booted();
      d.jump(PROJECTS);
      d.settle();
      expect(d.take({ kind: "archive", open: true })).toMatchObject({
        history: expect.arrayContaining([{ push: "/archive/" }]),
        to: at(PROJECTS, true),
        motion: "animate",
        entry: "",
      });
      const o = d.take(input);
      expect(o).toMatchObject({
        from: at(PROJECTS, true),
        to: at(PROJECTS),
        motion: "turn back",
      });
      expect(o.history[0]).toEqual({ back: true });
      d.settle();
      expect(d.navigator.where).toEqual(at(PROJECTS));
      expect(d.browser.path).toBe("/work/");
    });
  }
});

/** On a phone, step `step` has `count` screens; every other step has one. */
const phone =
  (counts: Record<number, number>) =>
  (step: number, open: boolean): number =>
    open ? 1 : (counts[step] ?? 1);

describe("an input during a motion", () => {
  test("runs at once when no motion is running", () => {
    expect(booted().jump(PROJECTS)).toMatchObject({
      to: at(PROJECTS),
      motion: "animate",
    });
  });

  test("that leads back to where the motion began turns it back", () => {
    const d = booted();
    d.move(1);
    expect(d.move(-1).motion).toBe("turn back");
  });

  test("that leads anywhere else waits", () => {
    const d = booted();
    d.move(1);
    expect(d.jump(PROJECTS).motion).toBe("none");
    // where the motion is going already
    expect(d.jump(TIMELINE).motion).toBe("none");
    expect(d.navigator.where).toEqual(at(TIMELINE));
  });

  test("closing a window that is still opening turns back", () => {
    const d = booted({ path: "/timeline/" });
    expect(d.take({ kind: "disclosure", open: true })).toMatchObject({
      to: at(TIMELINE, true),
      motion: "animate",
    });
    expect(d.take({ kind: "disclosure", open: false })).toMatchObject({
      from: at(TIMELINE, true),
      to: at(TIMELINE),
      motion: "turn back",
    });
  });

  test("an origin is the step and whether its disclosure was open", () => {
    const d = booted({ path: "/timeline/" });
    d.take({ kind: "disclosure", open: true });
    d.settle();
    d.take({ kind: "disclosure", open: false });
    // the step closed again: not where the closing began
    expect(d.jump(TIMELINE).motion).toBe("none");
    expect(d.take({ kind: "disclosure", open: true }).motion).toBe("turn back");
  });

  test("on a phone, the next screen of the same step is not the origin", () => {
    const d = booted({ path: "/about/", screens: phone({ [ABOUT]: 3 }) });
    expect(d.move(1)).toMatchObject({ to: at(ABOUT, false, 1) });
    expect(d.move(1).motion).toBe("none");
    expect(d.move(-1)).toMatchObject({
      to: at(ABOUT, false, 0),
      motion: "turn back",
    });
  });

  test("during the first appearance there is no origin: everything waits", () => {
    const d = desk();
    d.boot();
    expect(d.jump(OPENING).motion).toBe("none");
    expect(d.move(1).motion).toBe("none");
  });

  test("the first appearance cannot be turned back: the input that would turn a motion back waits, and runs after `ended`", () => {
    // at rest after a step down, a step up turns that step back
    const after = booted();
    after.move(1);
    expect(after.move(-1).motion).toBe("turn back");
    // during the first appearance the same step up has no origin to turn
    // back to: it waits, its history with it
    const d = desk({ path: "/timeline/" });
    expect(d.boot()).toMatchObject({ from: null, motion: "animate" });
    expect(d.move(-1)).toMatchObject({
      motion: "none",
      history: [],
      to: at(TIMELINE),
    });
    expect(d.navigator.where).toEqual(at(TIMELINE));
    // the appearance ends: the step up runs, as a motion of its own
    expect(d.take({ kind: "ended" })).toMatchObject({
      from: at(TIMELINE),
      to: at(OPENING),
      motion: "animate",
      history: expect.arrayContaining([{ replace: "/" }]),
    });
    // and that one can be turned back
    expect(d.move(1)).toMatchObject({ to: at(TIMELINE), motion: "turn back" });
  });

  test("a motion turned back runs to where it began, and a second reversal plays it forwards again", () => {
    const d = booted();
    d.move(1);
    expect(d.move(-1)).toMatchObject({ from: at(TIMELINE), to: at(OPENING) });
    expect(d.move(1)).toMatchObject({
      from: at(OPENING),
      to: at(TIMELINE),
      motion: "turn back",
    });
  });
});

describe("waiting", () => {
  test("only the latest waiting input runs, worked out from where the motion ended", () => {
    const d = booted({ path: "/about/", screens: phone({ [ABOUT]: 2 }) });
    d.jump(CONTACT);
    d.move(-1);
    d.jump(TIMELINE);
    d.move(-1);
    // one screen up from contact, not from about
    expect(d.take({ kind: "ended" })).toMatchObject({
      from: at(CONTACT),
      to: at(SABBATICAL),
      motion: "animate",
    });
    expect(d.take({ kind: "ended" }).motion).toBe("none");
  });

  test("a waiting Back or Forward runs first, then the latest other input", () => {
    const d = booted();
    d.jump(ABOUT);
    d.settle();
    d.jump(CONTACT);
    d.settle();
    d.move(-1);
    d.back();
    d.jump(PROJECTS);
    expect(d.take({ kind: "ended" })).toMatchObject({
      to: at(ABOUT),
      motion: "animate",
    });
    expect(d.take({ kind: "ended" })).toMatchObject({
      to: at(PROJECTS),
      motion: "animate",
    });
  });

  test("a jump turned back by the opposite jump leaves no history entry", () => {
    const d = booted();
    d.jump(ABOUT);
    d.settle();
    d.jump(CONTACT);
    d.jump(ABOUT);
    d.settle();
    expect(d.browser.trail).toEqual(["/", "/about/"]);
    expect(d.browser.path).toBe("/about/");
  });

  test("an input that waited and was dropped leaves no history entry", () => {
    const d = booted();
    d.jump(CONTACT);
    d.jump(ABOUT);
    d.jump(OPENING);
    d.settle();
    expect(d.browser.trail).toEqual(["/"]);
  });
});

describe("the archive", () => {
  const touch = { screens: phone({ [LAST_PROJECT]: 2 }) };

  test("closing the archive returns to the screen it was opened from", () => {
    const d = booted({ ...touch, path: "/work/truecrypt-steganography/" });
    d.move(1);
    d.settle();
    expect(d.navigator.where).toEqual(at(LAST_PROJECT, false, 1));
    d.take({ kind: "archive", open: true });
    d.settle();
    expect(d.navigator.where).toEqual(at(LAST_PROJECT, true, 0));
    expect(d.take({ kind: "archive", open: false })).toMatchObject({
      to: at(LAST_PROJECT, false, 1),
      motion: "animate",
    });
  });

  test("Back after opening closes it, onto the screen it was opened from", () => {
    const d = booted({ ...touch, path: "/work/truecrypt-steganography/" });
    d.move(1);
    d.settle();
    d.take({ kind: "archive", open: true });
    d.settle();
    expect(d.back()[0]).toMatchObject({
      to: at(LAST_PROJECT, false, 1),
      motion: "animate",
    });
    d.settle();
    expect(d.browser.path).toBe("/work/truecrypt-steganography/");
  });

  test("Forward onto the archive's address on the step on show records the screen on show as where closing returns", () => {
    const d = booted({ ...touch, path: "/work/truecrypt-steganography/" });
    // opened from screen 0 and closed again: /archive/ is the entry ahead
    d.take({ kind: "archive", open: true });
    d.settle();
    d.take({ kind: "archive", open: false });
    d.settle();
    expect(d.browser.path).toBe("/work/truecrypt-steganography/");
    // scrolled on to screen 1 (no entry), then Forward opens the archive here
    d.move(1);
    d.settle();
    expect(d.navigator.where).toEqual(at(LAST_PROJECT, false, 1));
    expect(d.forward()[0]).toMatchObject({ to: at(LAST_PROJECT, true, 0) });
    d.settle();
    // Back closes it onto screen 1, the screen on show when it opened, not 0
    expect(d.back()[0]).toMatchObject({
      to: at(LAST_PROJECT, false, 1),
      motion: "animate",
    });
  });

  test("closed with ✕ after an address opened it, the address returns with no Back", () => {
    const d = booted({ path: "/archive/" });
    expect(d.navigator.where).toEqual(at(LAST_PROJECT, true));
    expect(d.take({ kind: "archive", open: false })).toMatchObject({
      history: [
        { replace: "/work/truecrypt-steganography/" },
        { title: book.forStep(LAST_PROJECT).title },
      ],
      to: at(LAST_PROJECT),
    });
  });

  test("boot at an archive project's address opens the archive on its entry", () => {
    const d = desk({
      path: "/work/old-thing/",
      screenOfEntry: (step, entry) =>
        step === LAST_PROJECT && entry === "Old-Thing" ? 1 : 0,
      screens: (_, open) => (open ? 2 : 1),
    });
    expect(d.boot()).toMatchObject({
      to: at(LAST_PROJECT, true, 1),
      entry: "Old-Thing",
      history: [],
    });
  });

  test("an archive address from another step is one target: its step at rest, then the archive open", () => {
    const d = booted();
    expect(d.take({ kind: "path", path: "/work/older/" })).toMatchObject({
      history: expect.arrayContaining([
        { push: "/work/truecrypt-steganography/" },
        { push: "/archive/" },
      ]),
      from: at(OPENING),
      rest: [at(LAST_PROJECT)],
      to: at(LAST_PROJECT, true),
      motion: "animate",
      entry: "older",
      handled: true,
    });
  });

  test("an archive address on its own step opens the archive with one entry", () => {
    const d = booted({ path: "/work/truecrypt-steganography/" });
    const o = d.take({ kind: "path", path: "/archive/" });
    expect(o).toMatchObject({ rest: [], to: at(LAST_PROJECT, true) });
    expect(o.history.filter((e) => "push" in e)).toEqual([
      { push: "/archive/" },
    ]);
  });

  test("without an archive window, the archive does not open", () => {
    const d = booted({ path: "/work/", hasArchive: false });
    expect(d.take({ kind: "archive", open: true })).toMatchObject({
      motion: "none",
      history: [],
    });
  });
});

describe("addresses", () => {
  test("an unknown path returns handled: false and changes nothing", () => {
    const d = booted({ path: "/about/" });
    expect(d.take({ kind: "path", path: "/no/such/place/" })).toMatchObject({
      handled: false,
      motion: "none",
      history: [],
      to: at(ABOUT),
    });
    // nor does it wait for a motion
    d.jump(CONTACT);
    expect(d.take({ kind: "path", path: "/nope/" }).handled).toBe(false);
    expect(d.take({ kind: "ended" }).motion).toBe("none");
    expect(d.navigator.where).toEqual(at(CONTACT));
  });

  test("scrolling follows the address with no entry; a jump adds one", () => {
    const d = booted();
    expect(d.move(1).history).toEqual([
      { title: book.forStep(TIMELINE).title },
      { replace: "/timeline/" },
    ]);
    d.settle();
    d.jump(ABOUT);
    d.settle();
    expect(d.browser.trail).toEqual(["/timeline/", "/about/"]);
  });

  test("a jump to where the visitor is changes nothing", () => {
    const d = booted({ path: "/about/" });
    expect(d.jump(ABOUT)).toMatchObject({ motion: "none", history: [] });
  });

  test("Back to an unknown path brings the not-found terminal back", () => {
    const d = booted({ path: "/no/such/place/" });
    expect(d.navigator.notFound).toBe(true);
    d.take({ kind: "path", path: "/timeline/" });
    d.settle();
    expect(d.navigator.notFound).toBe(false);
    expect(d.back()[0]).toMatchObject({
      history: [{ title: "Not found — Shrujan Cheruku" }],
      to: at(OPENING),
      notFound: true,
    });
  });
});

describe("behaviour that fits this shape badly", () => {
  test("a jump out of not-found places twice: at rest where it is, then animated", () => {
    const d = booted({ path: "/no/such/place/" });
    expect(d.jump(TIMELINE)).toMatchObject({
      from: at(OPENING),
      rest: [at(OPENING)],
      to: at(TIMELINE),
      motion: "animate",
      notFound: false,
    });
    // to the step it is on: the placement at rest alone
    const e = booted({ path: "/no/such/place/" });
    expect(e.jump(OPENING)).toMatchObject({
      history: expect.arrayContaining([{ push: "/" }]),
      rest: [],
      to: at(OPENING),
      motion: "place",
      notFound: false,
    });
  });

  test("a re-measure during the first appearance places at rest and lets it run on", () => {
    const d = desk();
    d.boot();
    expect(d.take({ kind: "refit" })).toMatchObject({
      to: at(OPENING),
      motion: "place",
    });
    // the first appearance still runs: inputs wait for its `ended`
    expect(d.move(1).motion).toBe("none");
    expect(d.take({ kind: "ended" })).toMatchObject({
      to: at(TIMELINE),
      motion: "animate",
    });
  });

  test("a disclosure's screen is not clamped on open; the next input moves from the clamped one", () => {
    const d = booted({
      path: "/work/truecrypt-steganography/",
      screens: (_, open) => (open ? 2 : 1),
      screenOfEntry: () => 3,
    });
    expect(
      d.take({ kind: "archive", open: true, entry: "older" }),
    ).toMatchObject({ to: at(LAST_PROJECT, true, 3), entry: "older" });
    d.settle();
    // the desktop placed it on screen 1, the last there is
    expect(d.move(-1)).toMatchObject({
      from: at(LAST_PROJECT, true, 1),
      to: at(LAST_PROJECT, true, 0),
    });
  });

  test("a placement at rest that stops a running motion: its `ended` runs the waiting input", () => {
    const d = booted();
    d.move(1);
    d.jump(ABOUT);
    expect(d.take({ kind: "refit", screen: 0 })).toMatchObject({
      to: at(TIMELINE),
      motion: "place",
    });
    expect(d.take({ kind: "ended" })).toMatchObject({
      from: at(TIMELINE),
      to: at(ABOUT),
      motion: "animate",
    });
  });

  test("a motion turned back before it moved: the desktop's `ended` comes at once, and a waiting Back still runs", () => {
    const d = booted({ screens: phone({ [ABOUT]: 2 }) });
    d.jump(TIMELINE);
    d.settle();
    d.jump(ABOUT);
    d.settle();
    d.move(1);
    expect(d.back()[0]?.motion).toBe("none");
    expect(d.move(-1)).toMatchObject({
      to: at(ABOUT),
      motion: "turn back",
    });
    expect(d.take({ kind: "ended" })).toMatchObject({
      to: at(TIMELINE),
      motion: "animate",
    });
    // and nothing else waited
    expect(d.take({ kind: "ended" }).motion).toBe("none");
  });
});

describe("not found", () => {
  test("scrolling out of not-found places with the terminal still on show; the next placement hides it", () => {
    const d = booted({ path: "/no/such/place/" });
    expect(d.move(1)).toMatchObject({
      to: at(TIMELINE),
      notFound: true,
      history: expect.arrayContaining([{ replace: "/timeline/" }]),
    });
    expect(d.navigator.notFound).toBe(false);
    d.settle();
    expect(d.take({ kind: "refit" })).toMatchObject({ notFound: false });
  });
});
