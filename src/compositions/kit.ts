// The composition kit (#39): what every composition is built on, and `mount`,
// which ties it to the page. A composition module default-exports a
// `Composition`; the desktop script (src/scripts/compositions.ts) loads it when
// the projects workspace gets close and calls `mount` with the project's slot.
//
// The lifecycle (src/lib/composition-lifecycle.ts), for every composition:
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
import { createLifecycle, type Mode } from "../lib/composition-lifecycle";

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
  /**
   * Optional: once the end state is on screen, hold it this long (state
   * `held`), then play again from the beginning. Without it the end is held for good.
   */
  holdMs?: number;
  /** Named still frames: put the scene in that state at once. */
  frames: Record<string, (kit: Kit) => void>;
}

export type { Mode };

/**
 * True in the touch layout (max-width 760px), read live: for a composition's
 * helpers that run outside `build` and `play`, where `kit.touch` is not to hand.
 */
export const onPhone = (): boolean => matchMedia("(max-width: 760px)").matches;

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
      return onPhone();
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
  const lifecycle = createLifecycle({
    createClock,
    play: (next) => {
      clock = next;
      return composition.play(kit);
    },
    showFrame: (name) => composition.frames[name]?.(kit),
    onChange: ({ mode, frame }) => {
      slot.dataset.state = mode;
      if (frame === null) delete slot.dataset.shownFrame;
      else slot.dataset.shownFrame = frame;
    },
    holdMs: composition.holdMs,
    frames: Object.keys(composition.frames),
    card: composition.card,
    flashes: composition.flashes,
    active: slot.dataset.active === "true",
    visible: !document.hidden,
    reduced: reduced.matches,
    asked: slot.dataset.frame,
  });

  slot.addEventListener("composition:enter", () => lifecycle.enter());
  slot.addEventListener("composition:leave", () => lifecycle.leave());
  new IntersectionObserver((entries) => {
    for (const e of entries) lifecycle.setOnscreen(e.isIntersecting);
  }).observe(slot);
  document.addEventListener("visibilitychange", () =>
    lifecycle.setVisible(!document.hidden),
  );
  reduced.addEventListener("change", () =>
    lifecycle.setReduced(reduced.matches),
  );
  new MutationObserver(() => lifecycle.setAsked(slot.dataset.frame)).observe(
    slot,
    { attributes: true, attributeFilter: ["data-frame"] },
  );

  lifecycle.sync();
}
