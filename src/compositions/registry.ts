// Every featured project's composition, by repository name as written. A
// composition is its own chunk, loaded when the projects workspace gets close
// (src/scripts/compositions.ts), never in the first load.
//
// The build fails when a featured project is in neither list below
// (src/lib/composition-rules.ts `missingCompositions`).
import type { Composition } from "./kit";

type Loader = () => Promise<{ default: Composition }>;

export const compositions: Record<string, Loader> = {
  issho: () => import("./issho"),
  "orca-flow": () => import("./orca-flow"),
  "rapid-radiology": () => import("./rapid-radiology"),
  unmacos: () => import("./unmacos"),
};

/**
 * Featured projects whose composition a later ticket writes. Each ticket
 * removes its own line when it adds its composition above; a project in both
 * fails the build. Until then the project's window shows its placeholder.
 */
export const PENDING: readonly string[] = [];
