// The eight themes and how the visitor's choices are remembered: pure, no DOM.
// A theme is a set of custom properties, switched by `data-theme` on the root.

export interface Palette {
  bg: string;
  fg: string;
  /** accent */
  ac: string;
  dim: string;
  line: string;
  /** the second colour */
  hot: string;
}

export const THEMES = {
  "tokyo-night": {
    bg: "#1a1b26",
    fg: "#c0caf5",
    ac: "#7aa2f7",
    dim: "#24283b",
    line: "#3b4261",
    hot: "#f7768e",
  },
  gruvbox: {
    bg: "#282828",
    fg: "#d4be98",
    ac: "#7daea3",
    dim: "#3c3836",
    line: "#665c54",
    hot: "#ea6962",
  },
  paper: {
    bg: "#f2eede",
    fg: "#222222",
    ac: "#cc3e28",
    dim: "#d8d3c0",
    line: "#b9b29b",
    hot: "#216609",
  },
  "issho-light": {
    bg: "#F3F5F9",
    fg: "#131B40",
    ac: "#885716",
    dim: "#D5DBE7",
    line: "#7A849C",
    hot: "#CC3719",
  },
  "issho-dark": {
    bg: "#0D1330",
    fg: "#F1F3F8",
    ac: "#DEA92C",
    dim: "#222B52",
    line: "#6C78AA",
    hot: "#EB603A",
  },
  nord: {
    bg: "#2e3440",
    fg: "#d8dee9",
    ac: "#81a1c1",
    dim: "#3b4252",
    line: "#4c566a",
    hot: "#bf616a",
  },
  "rose-pine": {
    bg: "#faf4ed",
    fg: "#575279",
    ac: "#56949f",
    dim: "#f2e9e1",
    line: "#cecacd",
    hot: "#b4637a",
  },
  starship: {
    bg: "#1c1c1e",
    fg: "#f5f5f7",
    ac: "#ff9f0a",
    dim: "#2c2c2e",
    line: "#8e8e93",
    hot: "#ff5f4a",
  },
} as const satisfies Record<string, Palette>;

export type ThemeName = keyof typeof THEMES;

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

/** The theme with nothing stored, whatever the system's light or dark mode. */
export const DEFAULT_THEME: ThemeName = "paper";

export const THEME_KEY = "theme";
export const CRT_KEY = "crt";

type Store = Pick<Storage, "getItem" | "setItem"> | undefined;

export const isThemeName = (s: unknown): s is ThemeName =>
  typeof s === "string" && Object.hasOwn(THEMES, s);

/** The theme after this one in the list, wrapping round. */
export function nextTheme(current: ThemeName): ThemeName {
  const i = THEME_NAMES.indexOf(current);
  return THEME_NAMES[(i + 1) % THEME_NAMES.length] ?? DEFAULT_THEME;
}

/** The remembered theme; paper when nothing valid is stored or storage throws. */
export function loadTheme(store: Store): ThemeName {
  try {
    const v = store?.getItem(THEME_KEY);
    return isThemeName(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(store: Store, theme: ThemeName): void {
  try {
    store?.setItem(THEME_KEY, theme);
  } catch {
    // remembering is a courtesy
  }
}

/** The remembered crt choice; on by default and when storage throws. */
export function loadCrt(store: Store): boolean {
  try {
    return store?.getItem(CRT_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveCrt(store: Store, on: boolean): void {
  try {
    store?.setItem(CRT_KEY, on ? "on" : "off");
  } catch {
    // remembering is a courtesy
  }
}
