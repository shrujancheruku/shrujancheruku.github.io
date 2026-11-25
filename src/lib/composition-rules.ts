// The rules around compositions that need no DOM: the size budget, the build
// check that every featured project has one, when one is loaded and when it
// draws. Tested under `bun test`.

/** A composition is at most 60 KB of JS plus assets once built. */
export const COMPOSITION_BUDGET_BYTES = 60 * 1024;

export interface BuiltComposition {
  /** The composition's name (its repository). */
  name: string;
  /** Its chunk, the chunks it needs and its assets, in bytes. */
  bytes: number;
}

export function overCompositionBudget(
  built: readonly BuiltComposition[],
): BuiltComposition[] {
  return built.filter((c) => c.bytes > COMPOSITION_BUDGET_BYTES);
}

/**
 * The featured projects that have no composition. `pending` names projects whose
 * composition a later ticket writes; it is a way to land the kit first, and a
 * project must leave it when its composition arrives.
 */
export function missingCompositions(
  featured: readonly string[],
  written: readonly string[],
  pending: readonly string[],
): string[] {
  const both = pending.filter((p) => written.includes(p));
  if (both.length > 0) {
    throw new Error(
      `${both.join(", ")} ha${both.length > 1 ? "ve" : "s"} a composition and is still marked pending: remove it from PENDING`,
    );
  }
  return featured.filter((f) => !written.includes(f) && !pending.includes(f));
}

export interface LoadState {
  /** The workspace on show (0-based). */
  workspace: number;
  /** The projects workspace's index. */
  projects: number;
  /** The page's load event has fired. */
  loaded: boolean;
  /** The browser has gone idle since. */
  idle: boolean;
}

/**
 * Compositions are loaded when the projects workspace gets close: it is on
 * show, or next to the one on show. Never in the first load: from further
 * away, or from next to it, only once the page has loaded and gone idle.
 */
export function shouldLoad(state: LoadState): boolean {
  const distance = Math.abs(state.workspace - state.projects);
  if (distance === 0) return true;
  return distance <= 1 && state.loaded && state.idle;
}

export interface DrawState {
  /** Its window is on show (the desktop's `composition:enter`). */
  active: boolean;
  /** Its window is in view. */
  onscreen: boolean;
  /** The tab is visible. */
  visible: boolean;
}

export function drawing(state: DrawState): boolean {
  return state.active && state.onscreen && state.visible;
}

export interface Chunk {
  bytes: number;
  /** Chunks it imports statically (file names). */
  imports: string[];
}

/** The chunks a built chunk imports statically, not the ones it loads later. */
export function staticImports(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(
    /(?:\bfrom|\bimport)\s*["']\.\/([^"']+\.js)["']/g,
  ))
    if (m[1] && !out.includes(m[1])) out.push(m[1]);
  return out;
}

/**
 * The chunk and everything it needs, each counted once. `loaded` are chunks
 * the page has already loaded (the first load), which a composition does not add.
 */
export function closureBytes(
  entry: string,
  chunks: Record<string, Chunk>,
  loaded: ReadonlySet<string> = new Set(),
): number {
  const seen = new Set<string>(loaded);
  const visit = (name: string): number => {
    const chunk = chunks[name];
    if (!chunk || seen.has(name)) return 0;
    seen.add(name);
    return chunk.bytes + chunk.imports.reduce((n, i) => n + visit(i), 0);
  };
  return visit(entry);
}

/** The built file of a composition: `<name>.<hash>.js`. */
export function chunkOf(
  name: string,
  files: readonly string[],
): string | undefined {
  const own = new RegExp(`^${name.replace(/[^\w-]/g, "\\$&")}\\.[\\w-]+\\.js$`);
  return files.find((f) => own.test(f));
}
