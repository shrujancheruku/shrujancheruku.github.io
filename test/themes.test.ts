import { describe, expect, test } from "bun:test";
import {
  DEFAULT_THEME,
  loadCrt,
  loadTheme,
  nextTheme,
  saveCrt,
  saveTheme,
  THEMES,
} from "../src/lib/themes";

const memory = (): Pick<Storage, "getItem" | "setItem"> => {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
  };
};
const broken = {
  getItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("denied");
  },
};

describe("themes", () => {
  test("eight themes, paper the default", () => {
    expect(Object.keys(THEMES)).toEqual([
      "tokyo-night",
      "gruvbox",
      "paper",
      "issho-light",
      "issho-dark",
      "nord",
      "rose-pine",
      "starship",
    ]);
    expect(DEFAULT_THEME).toBe("paper");
    expect(THEMES["issho-dark"].ac).toBe("#DEA92C");
  });

  test("T cycles through the list and wraps", () => {
    expect(nextTheme("tokyo-night")).toBe("gruvbox");
    expect(nextTheme("starship")).toBe("tokyo-night");
  });

  test("nothing stored, junk stored or a throwing storage gives paper", () => {
    expect(loadTheme(memory())).toBe("paper");
    const junk = memory();
    junk.setItem("theme", "solarized");
    expect(loadTheme(junk)).toBe("paper");
    expect(loadTheme(broken)).toBe("paper");
    expect(loadTheme(undefined)).toBe("paper");
  });

  test("a saved theme loads back; saving to a broken storage is silent", () => {
    const s = memory();
    saveTheme(s, "nord");
    expect(loadTheme(s)).toBe("nord");
    expect(() => saveTheme(broken, "nord")).not.toThrow();
  });

  test("crt defaults on, remembers off, survives a broken storage", () => {
    const s = memory();
    expect(loadCrt(s)).toBe(true);
    saveCrt(s, false);
    expect(loadCrt(s)).toBe(false);
    expect(loadCrt(broken)).toBe(true);
    expect(() => saveCrt(broken, false)).not.toThrow();
  });
});
