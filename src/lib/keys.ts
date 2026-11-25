// What a key press means to the desktop's workspaces: a pure function.

export interface KeyInput {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

export type KeyCommand =
  | { type: "workspace"; index: number }
  | { type: "step"; direction: 1 | -1 };

/**
 * The command a key stands for, or null. Number keys jump to the workspace
 * with that number, and are ignored while any modifier is held. Scroll keys
 * move one step; shift only reverses the space bar.
 */
export function interpretKey(
  e: KeyInput,
  workspaceCount: number,
): KeyCommand | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;

  if (/^[1-9]$/.test(e.key)) {
    if (e.shiftKey) return null;
    const n = Number(e.key);
    return n <= workspaceCount ? { type: "workspace", index: n - 1 } : null;
  }

  switch (e.key) {
    case "ArrowDown":
    case "PageDown":
      return { type: "step", direction: 1 };
    case "ArrowUp":
    case "PageUp":
      return { type: "step", direction: -1 };
    case " ":
      return { type: "step", direction: e.shiftKey ? -1 : 1 };
    default:
      return null;
  }
}
