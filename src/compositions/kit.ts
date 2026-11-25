// The composition kit (#39): what every composition is built on, and the
// lifecycle that runs it. A composition module default-exports a `Composition`;
// the desktop script (src/scripts/compositions.ts) loads it when the projects
// workspace gets close and calls `mount` with the project's slot.
//
// The lifecycle, for every composition:
// - it plays from its beginning each time its window comes on show
//   (`composition:enter`), and stops for good when it goes (`composition:leave`);
// - it stops drawing while its window is out of view or the tab is hidden, and
//   carries on from where it was;
// - it follows the site theme live, because it is drawn in the theme's custom
//   properties (--bg --fg --ac --dim --line --hot);
// - a named still frame can be shown instead of playing: `data-frame="<name>"`
//   on the slot (share cards), and the composition's `card` frame under
//   reduced motion when the composition `flashes`.
import { Cancelled, type Clock, createClock } from "../lib/composition-clock";
import { drawing } from "../lib/composition-rules";

export { Cancelled };

export interface Kit {
  /** The scene: a size container's whole body; text is sized in `--u`. */
  readonly root: HTMLElement;
  /** True in the touch layout (max-width 760px), read live. */
  readonly touch: boolean;
  /** Waits `ms` of drawing time (not while paused). Ends the run if it restarts. */
  sleep(ms: number): Promise<void>;
  /** Calls `fn` every `ms` of drawing time; returns a function that stops it. */
  every(ms: number, fn: () => void): () => void;
  /** Types `text` into `el` a character at a time, with a block cursor. */
  type(el: HTMLElement, text: string, cps?: number): Promise<void>;
  /** A gapped pane with the site's window border, appended to the scene. */
  pane(label: string, className?: string): HTMLElement;
  /** Gives the accent border to one pane (or none). */
  focus(pane: HTMLElement | null): void;
  /** An element with a class and optional text. */
  el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
    parent?: HTMLElement,
  ): HTMLElementTagNameMap[K];
  /** The theme's colours as the page has them now. */
  palette(): Record<"bg" | "fg" | "ac" | "dim" | "line" | "hot", string>;
  /** Calls `fn` with the theme's name when the visitor switches theme. */
  onTheme(fn: (name: string) => void): void;
}

export interface Composition {
  /** CSS for this composition's own classes, added to the scene when it is built. */
  css?: string;
  /** The named still frame that share cards show, and reduced motion shows if `flashes`. */
  card: string;
  /** Large areas flash: under reduced motion it is frozen at `card`. Others play. */
  flashes?: boolean;
  /** Draw the panes into `kit.root`. Called once, when mounted. */
  build(kit: Kit): void;
  /**
   * Play from the beginning (reset your own state first), and return when the
   * end state is on screen: the end state is then held. Await only `kit`'s
   * `sleep`, `type`, `every`, so pausing and restarting work.
   */
  play(kit: Kit): Promise<void>;
  /** Named still frames: put the scene in that state at once. */
  frames: Record<string, (kit: Kit) => void>;
}

export type Mode = "idle" | "playing" | "paused" | "held" | "frame";

const touchQuery = () => matchMedia("(max-width: 760px)");

/** Mount a composition into a project's slot (`[data-slot]` in a `comp-N` window). */
export function mount(slot: HTMLElement, composition: Composition): void {
  slot.replaceChildren();
  const root = document.createElement("div");
  root.className = "scene";
  slot.append(root);
  slot.dataset.mounted = "true";
  if (composition.css) {
    const style = document.createElement("style");
    style.textContent = composition.css;
    root.append(style);
  }

  let clock: Clock = createClock();
  const themeListeners: ((name: string) => void)[] = [];
  new MutationObserver(() => {
    for (const fn of themeListeners)
      fn(document.documentElement.dataset.theme ?? "");
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  const kit: Kit = {
    root,
    get touch() {
      return touchQuery().matches;
    },
    sleep: (ms) => clock.sleep(ms),
    every: (ms, fn) => clock.every(ms, fn),
    async type(el, text, cps = 28) {
      const cursor = document.createElement("span");
      cursor.className = "cur";
      for (let i = 1; i <= text.length; i++) {
        el.textContent = text.slice(0, i);
        el.append(cursor);
        await clock.sleep(text[i - 1] === "\n" ? 240 : 1000 / cps);
      }
      cursor.remove();
      el.textContent = text;
    },
    pane(label, className = "") {
      const pane = document.createElement("section");
      pane.className = `pn ${className}`.trim();
      const lbl = document.createElement("span");
      lbl.className = "lbl";
      lbl.textContent = label;
      pane.append(lbl);
      root.append(pane);
      return pane;
    },
    focus(pane) {
      for (const p of root.querySelectorAll(".pn"))
        p.classList.toggle("focus", p === pane);
    },
    el(tag, className, text, parent) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      parent?.append(node);
      return node;
    },
    palette() {
      const style = getComputedStyle(document.documentElement);
      const get = (k: string) => style.getPropertyValue(`--${k}`).trim();
      return {
        bg: get("bg"),
        fg: get("fg"),
        ac: get("ac"),
        dim: get("dim"),
        line: get("line"),
        hot: get("hot"),
      };
    },
    onTheme(fn) {
      themeListeners.push(fn);
    },
  };

  composition.build(kit);

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let active = slot.dataset.active === "true";
  let onscreen = false;
  let visible = !document.hidden;
  /** The clock of the run on show, or null if none has begun. */
  let running: Clock | null = null;
  let finished = false;
  let mode: Mode = "idle";
  const setMode = (next: Mode): void => {
    mode = next;
    slot.dataset.state = mode;
  };

  const frameName = (): string | null => {
    const asked = slot.dataset.frame;
    if (asked && composition.frames[asked]) return asked;
    if (composition.flashes && reduced.matches) return composition.card;
    return null;
  };

  const stop = (): void => {
    running?.cancel();
    running = null;
    finished = false;
  };

  const begin = (): void => {
    stop();
    clock = createClock();
    running = clock;
    const mine = clock;
    if (drawing({ active, onscreen, visible })) setMode("playing");
    else {
      mine.pause();
      setMode("paused");
    }
    composition
      .play(kit)
      .then(() => {
        if (running !== mine) return;
        finished = true;
        setMode("held");
      })
      .catch((e: unknown) => {
        if (!(e instanceof Cancelled)) throw e;
      });
  };

  /** Bring the scene in line with what is true now. */
  const update = (): void => {
    const frame = frameName();
    if (frame) {
      stop();
      composition.frames[frame]?.(kit);
      slot.dataset.shownFrame = frame;
      setMode("frame");
      return;
    }
    delete slot.dataset.shownFrame;
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

  slot.addEventListener("composition:enter", () => {
    active = true;
    stop();
    setMode("idle");
    update();
  });
  slot.addEventListener("composition:leave", () => {
    active = false;
    stop();
    setMode("idle");
    update();
  });
  new IntersectionObserver((entries) => {
    for (const e of entries) onscreen = e.isIntersecting;
    update();
  }).observe(slot);
  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    update();
  });
  reduced.addEventListener("change", update);
  new MutationObserver(update).observe(slot, {
    attributes: true,
    attributeFilter: ["data-frame"],
  });

  setMode("idle");
  update();
}
