import { describe, expect, test } from "bun:test";
import {
  progressAt,
  SETTLE_MS,
  TYPE_INTERVAL_MS,
  typedAt,
  typingEnds,
} from "../src/lib/terminal";

describe("typing a command", () => {
  test("one character every 42ms, the first at 42ms", () => {
    expect(TYPE_INTERVAL_MS).toBe(42);
    expect(typedAt("whoami", 0)).toBe("");
    expect(typedAt("whoami", 41)).toBe("");
    expect(typedAt("whoami", 42)).toBe("w");
    expect(typedAt("whoami", 84)).toBe("wh");
  });

  test("stops at the full command and never overshoots", () => {
    expect(typedAt("whoami", 6 * 42)).toBe("whoami");
    expect(typedAt("whoami", 10_000)).toBe("whoami");
  });

  test("the replies come after the command is typed and a 240ms pause", () => {
    expect(SETTLE_MS).toBe(240);
    // "cat ask" is 7 characters: typed by 294ms, replies at 294 + 240
    expect(typingEnds("cat ask")).toBe(7 * 42 + 240);
  });
});

describe("progress of a terminal", () => {
  const exchanges = [
    { command: "whoami", replies: ["product engineer"] },
    { command: "cat ask", replies: ["Give me a problem, not a spec."] },
  ];
  const first = typingEnds("whoami");

  test("types the first command before anything is printed", () => {
    expect(progressAt(exchanges, 0)).toEqual({
      done: 0,
      typing: { index: 0, text: "" },
    });
    expect(progressAt(exchanges, 84)).toEqual({
      done: 0,
      typing: { index: 0, text: "wh" },
    });
  });

  test("holds the full command through the pause, then prints its replies", () => {
    expect(progressAt(exchanges, first - 1)).toEqual({
      done: 0,
      typing: { index: 0, text: "whoami" },
    });
    expect(progressAt(exchanges, first)).toEqual({
      done: 1,
      typing: { index: 1, text: "" },
    });
  });

  test("is finished, with nothing typing, after the last replies", () => {
    const end = first + typingEnds("cat ask");
    expect(progressAt(exchanges, end)).toEqual({ done: 2, typing: null });
    expect(progressAt(exchanges, 1_000_000)).toEqual({ done: 2, typing: null });
  });
});
