// The staged session of the `orca-flow` composition: this portfolio's own
// build, as /flow:build ran it. Pure data and the rules that turn it into
// state; the numbers (#42, #43–#51, #53, the 38 minutes) are staged, not the
// real run's, and are kept as written (ticket #27).

export type Size = "S" | "M" | "L";
export type Model = "haiku" | "sonnet" | "opus";
export type Status = "queued" | "build" | "check" | "merged" | "waiting";

export interface Ticket {
  id: number;
  size: Size;
  model: Model;
  title: string;
}

export const COMMAND = "/flow:build #42";
export const SPEC = "#42 Portfolio site";

// sized, then routed to the cheapest model that can do it
export const TICKETS: readonly Ticket[] = [
  { id: 43, size: "S", model: "haiku", title: "page titles" },
  { id: 44, size: "S", model: "haiku", title: "theme switch" },
  { id: 45, size: "M", model: "sonnet", title: "workspace scroll" },
  { id: 46, size: "S", model: "haiku", title: "contact terminal" },
  { id: 47, size: "M", model: "sonnet", title: "project windows" },
  { id: 48, size: "M", model: "sonnet", title: "timeline" },
  { id: 49, size: "S", model: "haiku", title: "skill bars" },
  { id: 50, size: "M", model: "sonnet", title: "archive window" },
  { id: 51, size: "L", model: "opus", title: "pages deploy" },
];

export const COORDINATOR = {
  name: "Coordinator",
  message:
    "Sized nine tickets: 4 small, 4 medium, 1 large.\n#51 touches the deploy workflow, so it goes to Opus.",
};

export const QUESTION = {
  title: "Question from the coordinator",
  ask: "1) #50 opens the archive from the status bar. The spec says only from the projects workspace. Which one?",
  answer: "1 projects workspace",
  answered: "Answered: the archive opens from the projects workspace.",
};

export const BRANCH = "integration/portfolio-site";
export const READY = "✓ PR #53 ready to merge";
export const READY_DETAIL = "closes 9 tickets · reviewed · checks green";
export const READY_DETAIL_WIDE = " · up to date with main";

export const STATUS_LABEL: Record<Status, string> = {
  queued: "queued",
  build: "build",
  check: "check",
  merged: "merged ✓",
  waiting: "waiting on you",
};

export interface Move {
  ticket: number;
  to: Status;
}

export interface Timed extends Move {
  /** Milliseconds to wait before the move. */
  wait: number;
}

// Tickets that do not depend on each other run at the same time.
export const BEFORE_QUESTION: readonly Timed[] = [
  { wait: 0, ticket: 43, to: "build" },
  { wait: 0, ticket: 44, to: "build" },
  { wait: 0, ticket: 45, to: "build" },
  { wait: 0, ticket: 51, to: "build" },
  { wait: 900, ticket: 43, to: "check" },
  { wait: 500, ticket: 44, to: "check" },
  { wait: 500, ticket: 43, to: "merged" },
  { wait: 200, ticket: 46, to: "build" },
  { wait: 500, ticket: 44, to: "merged" },
  { wait: 200, ticket: 47, to: "build" },
  { wait: 600, ticket: 45, to: "check" },
  { wait: 500, ticket: 46, to: "check" },
  { wait: 400, ticket: 45, to: "merged" },
  { wait: 200, ticket: 48, to: "build" },
  { wait: 400, ticket: 46, to: "merged" },
  { wait: 100, ticket: 49, to: "build" },
];

export const AFTER_QUESTION: readonly Timed[] = [
  { wait: 0, ticket: 50, to: "build" },
  { wait: 500, ticket: 47, to: "check" },
  { wait: 400, ticket: 49, to: "check" },
  { wait: 400, ticket: 47, to: "merged" },
  { wait: 300, ticket: 48, to: "check" },
  { wait: 300, ticket: 49, to: "merged" },
  { wait: 500, ticket: 51, to: "check" },
  { wait: 300, ticket: 48, to: "merged" },
  { wait: 700, ticket: 50, to: "check" },
  { wait: 400, ticket: 51, to: "merged" },
  { wait: 600, ticket: 50, to: "merged" },
];

export const RUN: readonly Timed[] = [...BEFORE_QUESTION, ...AFTER_QUESTION];

export interface State {
  status: Record<number, Status>;
  merged: number;
  /** Tickets being built or checked. */
  running: number;
  /** The ticket merged last, for the pull request pane's line. */
  lastMerged: number | null;
}

export function initialState(): State {
  return {
    status: Object.fromEntries(TICKETS.map((t) => [t.id, "queued"])),
    merged: 0,
    running: 0,
    lastMerged: null,
  };
}

export function step(state: State, move: Move): State {
  const status = { ...state.status, [move.ticket]: move.to };
  const values = Object.values(status);
  return {
    status,
    merged: values.filter((s) => s === "merged").length,
    running: values.filter((s) => s === "build" || s === "check").length,
    lastMerged: move.to === "merged" ? move.ticket : state.lastMerged,
  };
}

/** Where the session ends, and the frame of the share card. */
export function endState(): State {
  return RUN.reduce<State>(step, initialState());
}

/** The run's clock: a build takes most of an hour, so it runs fast. */
export const END_CLOCK_SECONDS = 38 * 60 + 12;
/** Seconds of run clock per second of the composition. */
export const CLOCK_RATE = 135;

export function clockLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/** The title of a ticket by number. */
export function titleOf(id: number): string {
  return TICKETS.find((t) => t.id === id)?.title ?? "";
}
