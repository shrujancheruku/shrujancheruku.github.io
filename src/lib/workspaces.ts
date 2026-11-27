// The desktop's workspaces and the steps inside them: a pure model, no DOM.
//
// A workspace is one part of the story; a step is one scroll stop. Every
// workspace is one step except projects, which holds one step per featured
// project, so nothing here may assume how many there are.
//
// A step is one tiling on a wide screen. On touch it is one or more screens,
// each a tiling of its own (a phone screen cannot hold a whole step, and
// nothing scrolls): `touch` lists them in order, and src/lib/screens.ts splits
// a window with more entries than fit into more. The step, and so the address,
// stays the same across a step's screens.

/** A window's tile: [left, top, width, height] in percent of the tiling area. */
export type Rect = readonly [number, number, number, number];

/** The windows on show and where they sit, by window id. */
export type Layout = Readonly<Record<string, Rect>>;

/** A step's tiling while its disclosure is open (Education & Internships). */
export interface Variant {
  /** Focus while open, if it differs from the step's. */
  focus?: string;
  desktop: Layout;
  touch: readonly Layout[];
}

/**
 * A window as tall as its rows on a wide screen: `px` tall at the foot of its
 * tile, and the window above it in the same column takes the rest. The tiling
 * holds percentages, so the area's live height resolves it (`tilingOf`).
 */
export interface Sized {
  window: string;
  px: number;
}

export interface Step {
  /** The window that has focus (the gradient border). */
  focus: string;
  /**
   * One tiling for a wide screen, and one or more screens for touch. With
   * `sized`, `desktop` is the tiling before the area's height is known.
   */
  desktop: Layout;
  /** A window sized to its rows on a wide screen while the disclosure is shut. */
  sized?: Sized;
  touch: readonly Layout[];
  /** The tiling while the step's disclosure is open; absent if it has none. */
  open?: Variant;
}

/**
 * The wide tiling to show: the open variant if the step has one and it is
 * open; else the step's own, its sized window resolved against `height`, the
 * tiling area's height in px, when that is given.
 */
export function tilingOf(step: Step, open: boolean, height?: number): Layout {
  if (open && step.open) return step.open.desktop;
  if (!step.sized || !height || height <= 0) return step.desktop;
  return resolveSized(step.desktop, step.sized, height);
}

/** `layout` with `sized.window` `sized.px` tall at the foot of its tile and the window above taking the rest. */
function resolveSized(layout: Layout, sized: Sized, height: number): Layout {
  const tile = layout[sized.window];
  if (!tile) return layout;
  const [x, y, w, h] = tile;
  const own = Math.min(h, (sized.px / height) * 100);
  const top = y + h - own;
  return Object.fromEntries(
    Object.entries(layout).map(([id, r]): [string, Rect] => {
      if (id === sized.window) return [id, [x, top, w, own]];
      const [rx, ry, rw, rh] = r;
      // the window above in the same column grows down to the sized one
      if (rx === x && rw === w && ry + rh === y)
        return [id, [rx, ry, rw, top - ry]];
      return [id, r];
    }),
  );
}

/** The touch screens to show: the open variant's if the step has one and it is open. */
export const screensOf = (step: Step, open: boolean): readonly Layout[] =>
  open && step.open ? step.open.touch : step.touch;

/** The focused window, given whether the step's disclosure is open. */
export const focusOf = (step: Step, open: boolean): string =>
  (open && step.open?.focus) || step.focus;

export interface Workspace {
  id: string;
  name: string;
  steps: readonly Step[];
}

export interface WorkspaceOptions {
  /** How many featured projects there are (one step each). */
  featured: number;
  /** The stack ends with the line that opens the archive (there is an archive). */
  archive: boolean;
}

const stepOf = (
  focus: string,
  desktop: Layout,
  touch: readonly Layout[],
  open?: Variant,
): Step => ({
  focus,
  desktop,
  touch,
  ...(open && { open }),
});

/** A 2 × 2 grid of rect ids in a region. */
const grid2 = (
  ids: readonly [string, string, string, string],
  [x, y, w, h]: Rect,
): Layout => ({
  [ids[0]]: [x, y, w / 2, h / 2],
  [ids[1]]: [x + w / 2, y, w / 2, h / 2],
  [ids[2]]: [x, y + h / 2, w / 2, h / 2],
  [ids[3]]: [x + w / 2, y + h / 2, w / 2, h / 2],
});

/** The share of the width the workspace keeps while the archive is open. */
const ARCHIVE_SHARE = 0.42;

/** A layout squeezed horizontally into the left `share` of the area. */
const squeeze = (layout: Layout, share: number): Layout =>
  Object.fromEntries(
    Object.entries(layout).map(([id, [x, y, w, h]]) => [
      id,
      [x * share, y, w * share, h] as Rect,
    ]),
  );

/**
 * One row of the stack on a wide screen, a featured project or the archive
 * line: the tallest a row grows. ProjectStack.astro reads it as `--stack-row`.
 */
export const STACK_ROW = 34;

// What the stack's pane spends besides its rows, top to bottom (#141, layout E):
/** The label's band (`.stack`'s top inset in ProjectStack.astro). */
const STACK_LABEL = 32;
/** The rule under the label (`.stack`'s top border). */
const STACK_RULE = 1;
/** The pane's padding, half of `--gap` (global.css, wide) on each side. */
const STACK_GAP = 14;
/** The window's border, 2px on each side (`.win` in Window.astro). */
const STACK_BORDER = 4;
/** Everything the pane spends besides its rows: 51px. */
export const STACK_CHROME = STACK_LABEL + STACK_RULE + STACK_GAP + STACK_BORDER;

/**
 * The chrome the stack's height allows for. The prototype the founder chose
 * (#141, layout E) allowed only the label's band and two rules, 34px, so the
 * stack is 204px with four featured and the archive line, and its rows share
 * what is left after STACK_CHROME: 153px, about 30.6px each. Set this to
 * STACK_CHROME for rows exactly STACK_ROW tall (221px for those five rows).
 */
const STACK_ALLOWANCE = STACK_LABEL + 2 * STACK_RULE;

/** The stack's height on a wide screen with `rows` lines (featured and the archive line). */
export const stackHeight = (rows: number): number =>
  STACK_ALLOWANCE + rows * STACK_ROW;

/** The share of a phone screen a project's copy takes; the composition has the rest. */
const PROJECT_COPY_SHARE = 56;

const WORKSPACE_NAMES = [
  ["opening", "opening"],
  ["timeline", "timeline"],
  ["projects", "projects"],
  ["about", "about"],
  ["sabbatical", "sabbatical"],
  ["contact", "contact"],
] as const;

export function createWorkspaces({
  featured,
  archive,
}: WorkspaceOptions): Workspace[] {
  // on a wide screen with the archive shut the stack is as tall as its rows
  // and the copy takes the rest of the column (#160)
  const stack: Sized = {
    window: "stack",
    px: stackHeight(featured + (archive ? 1 : 0)),
  };
  const projectSteps = Array.from({ length: featured }, (_, i) => {
    const copy = `copy-${i + 1}`;
    const comp = `comp-${i + 1}`;
    const desktop: Layout = {
      [copy]: [0, 0, 30, 62],
      stack: [0, 62, 30, 38],
      [comp]: [30, 0, 70, 100],
    };
    const step = stepOf(
      comp,
      desktop,
      // a phone drops the stack and holds the project on one screen: the copy
      // over the composition (the archive opens from the copy)
      [
        {
          [copy]: [0, 0, 100, PROJECT_COPY_SHARE],
          [comp]: [0, PROJECT_COPY_SHARE, 100, 100 - PROJECT_COPY_SHARE],
        },
      ],
      // the archive open: the workspace squeezes into the left 42%, the archive
      // takes the right 58% and focus; on touch it takes the whole workspace
      {
        focus: "archive",
        desktop: {
          ...squeeze(desktop, ARCHIVE_SHARE),
          archive: [ARCHIVE_SHARE * 100, 0, 100 - ARCHIVE_SHARE * 100, 100],
        },
        touch: [{ archive: [0, 0, 100, 100] }],
      },
    );
    return { ...step, sized: stack };
  });

  const steps: Record<string, readonly Step[]> = {
    opening: [
      stepOf(
        "name",
        { name: [0, 0, 60, 100], term: [60, 0, 40, 58], now: [60, 58, 40, 42] },
        [
          {
            name: [0, 0, 100, 40],
            term: [0, 40, 100, 36],
            now: [0, 76, 100, 24],
          },
        ],
      ),
    ],
    about: [
      stepOf("about", { about: [0, 0, 100, 100] }, [
        { about: [0, 0, 100, 100] },
      ]),
    ],
    projects: projectSteps,
    timeline: [
      stepOf(
        "timeline",
        {
          timeline: [0, 0, 62, 100],
          education: [62, 0, 38, 40],
          skills: [62, 40, 38, 60],
        },
        // two screens: the timeline alone (its entries collapsed to headings),
        // then education over skills
        [
          { timeline: [0, 0, 100, 100] },
          { education: [0, 0, 100, 31], skills: [0, 31, 100, 69] },
        ],
        {
          // Education & Internships open: it takes the right column and the
          // skills window leaves; on touch it takes the whole workspace.
          focus: "education",
          desktop: { timeline: [0, 0, 46, 100], education: [46, 0, 54, 100] },
          touch: [{ education: [0, 0, 100, 100] }],
        },
      ),
    ],
    sabbatical: [
      stepOf(
        "sabbatical",
        {
          sabbatical: [0, 0, 34, 100],
          ...grid2(
            ["photo-1", "photo-2", "photo-3", "photo-4"],
            [34, 0, 66, 100],
          ),
        },
        // the copy over the four photos, on one screen: the copy takes the
        // height its text needs at 375 × 667 (about 60%), the 2 × 2 grid the rest
        [
          {
            sabbatical: [0, 0, 100, 60],
            ...grid2(
              ["photo-1", "photo-2", "photo-3", "photo-4"],
              [0, 60, 100, 40],
            ),
          },
        ],
      ),
    ],
    contact: [
      stepOf(
        "contact",
        {
          contact: [0, 0, 58, 100],
          name: [58, 0, 42, 62],
          term: [58, 62, 42, 38],
        },
        // the contact terminal alone: contact is the last step, and the
        // opening's name and whoami windows add nothing a phone needs here
        [{ contact: [0, 0, 100, 100] }],
      ),
    ],
  };

  return WORKSPACE_NAMES.map(([id, name]) => ({
    id,
    name,
    steps: steps[id] ?? [],
  }));
}

/** How many steps a workspace holds. */
export const stepsIn = (workspace: Workspace): number => workspace.steps.length;

/** How many steps there are across every workspace. */
export const stepCount = (workspaces: readonly Workspace[]): number =>
  workspaces.reduce((n, w) => n + stepsIn(w), 0);

/** The global step a workspace begins on. */
export function firstStepOf(
  workspaces: readonly Workspace[],
  workspace: number,
): number {
  return workspaces.slice(0, workspace).reduce((n, w) => n + stepsIn(w), 0);
}

export interface Location {
  workspace: number;
  /** Position of the step inside its workspace. */
  index: number;
  /** Number of steps in that workspace. */
  count: number;
}

/** Which workspace a global step is in, and where inside it. */
export function locate(
  workspaces: readonly Workspace[],
  step: number,
): Location {
  let rest = step;
  for (const [workspace, w] of workspaces.entries()) {
    if (rest < stepsIn(w)) return { workspace, index: rest, count: stepsIn(w) };
    rest -= stepsIn(w);
  }
  throw new RangeError(`no step ${step}`);
}

/** The step one `direction` away, held at the first and last step. */
export function stepAfter(
  workspaces: readonly Workspace[],
  step: number,
  direction: 1 | -1,
): number {
  return Math.max(0, Math.min(stepCount(workspaces) - 1, step + direction));
}

/** The step at a global index. */
export function stepAt(workspaces: readonly Workspace[], step: number): Step {
  const { workspace, index } = locate(workspaces, step);
  const found = workspaces[workspace]?.steps[index];
  if (!found) throw new RangeError(`no step ${step}`);
  return found;
}
