// Which windows come on show and which go between two layouts: the enter and
// leave signals a composition mounted in a window listens for. Pure, no DOM.
import type { Layout } from "./workspaces";

export interface WindowChanges {
  entered: string[];
  left: string[];
}

/** `before` is null on boot, when nothing was on show yet. */
export function windowChanges(
  before: Layout | null,
  after: Layout,
): WindowChanges {
  const was = new Set(before ? Object.keys(before) : []);
  const is = new Set(Object.keys(after));
  return {
    entered: [...is].filter((id) => !was.has(id)).sort(),
    left: [...was].filter((id) => !is.has(id)).sort(),
  };
}
