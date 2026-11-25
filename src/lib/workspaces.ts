// The desktop's workspaces and the steps inside them: a pure model, no DOM.
//
// A workspace is one part of the story; a step is one scroll stop. Every
// workspace is one step except projects, which holds one step per featured
// project, so nothing here may assume how many there are.

/** A window's tile: [left, top, width, height] in percent of the tiling area. */
export type Rect = readonly [number, number, number, number];

/** The windows on show and where they sit, by window id. */
export type Layout = Readonly<Record<string, Rect>>;

/** A step's tiling while its disclosure is open (Education & Internships). */
export interface Variant {
  /** Focus while open, if it differs from the step's. */
  focus?: string;
  desktop: Layout;
  touch: Layout;
}

export interface Step {
  /** The window that has focus (the gradient border). */
  focus: string;
  /** One tiling for a wide screen and one column for touch. */
  desktop: Layout;
  touch: Layout;
  /** The tiling while the step's disclosure is open; absent if it has none. */
  open?: Variant;
}

/** The tiling to show: the open variant if the step has one and it is open. */
export const tilingOf = (
  step: Step,
  kind: "desktop" | "touch",
  open: boolean,
): Layout => (open && step.open ? step.open[kind] : step[kind]);

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
}

const stepOf = (
  focus: string,
  desktop: Layout,
  touch: Layout,
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

const WORKSPACE_NAMES = [
  ["opening", "opening"],
  ["projects", "projects"],
  ["timeline", "timeline"],
  ["sabbatical", "sabbatical"],
  ["contact", "contact"],
] as const;

export function createWorkspaces({ featured }: WorkspaceOptions): Workspace[] {
  const projectSteps = Array.from({ length: featured }, (_, i) => {
    const copy = `copy-${i + 1}`;
    const comp = `comp-${i + 1}`;
    return stepOf(
      comp,
      {
        [copy]: [0, 0, 30, 62],
        stack: [0, 62, 30, 38],
        [comp]: [30, 0, 70, 100],
      },
      {
        [copy]: [0, 0, 100, 32],
        [comp]: [0, 32, 100, 44],
        stack: [0, 76, 100, 24],
      },
    );
  });

  const steps: Record<string, readonly Step[]> = {
    opening: [
      stepOf(
        "name",
        { name: [0, 0, 60, 100], term: [60, 0, 40, 58], now: [60, 58, 40, 42] },
        {
          name: [0, 0, 100, 40],
          term: [0, 40, 100, 36],
          now: [0, 76, 100, 24],
        },
      ),
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
        {
          timeline: [0, 0, 100, 60],
          education: [0, 60, 100, 20],
          skills: [0, 80, 100, 20],
        },
        {
          // Education & Internships open: it takes the right column and the
          // skills window leaves; on touch it takes the whole workspace.
          focus: "education",
          desktop: { timeline: [0, 0, 46, 100], education: [46, 0, 54, 100] },
          touch: { education: [0, 0, 100, 100] },
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
        {
          sabbatical: [0, 0, 100, 36],
          ...grid2(
            ["photo-1", "photo-2", "photo-3", "photo-4"],
            [0, 36, 100, 64],
          ),
        },
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
        { contact: [0, 0, 100, 74], term: [0, 74, 100, 26] },
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
