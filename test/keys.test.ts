import { describe, expect, test } from "bun:test";
import { interpretKey } from "../src/lib/keys";

const key = (
  k: string,
  mods: Partial<
    Record<"shiftKey" | "ctrlKey" | "metaKey" | "altKey", boolean>
  > = {},
) =>
  interpretKey(
    {
      key: k,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      ...mods,
    },
    5,
  );

describe("number keys", () => {
  test("1 to 5 jump to that workspace", () => {
    expect([1, 2, 3, 4, 5].map((n) => key(String(n)))).toEqual([
      { type: "workspace", index: 0 },
      { type: "workspace", index: 1 },
      { type: "workspace", index: 2 },
      { type: "workspace", index: 3 },
      { type: "workspace", index: 4 },
    ]);
  });

  test("the count follows the number of workspaces", () => {
    expect(
      interpretKey(
        {
          key: "6",
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
        },
        6,
      ),
    ).toEqual({ type: "workspace", index: 5 });
    expect(key("6")).toBeNull();
    expect(key("0")).toBeNull();
  });

  test("are ignored while a modifier is held", () => {
    expect(key("1", { metaKey: true })).toBeNull();
    expect(key("2", { ctrlKey: true })).toBeNull();
    expect(key("3", { altKey: true })).toBeNull();
    expect(key("4", { shiftKey: true })).toBeNull();
  });
});

describe("scroll keys", () => {
  test("move one step", () => {
    expect(key("ArrowDown")).toEqual({ type: "step", direction: 1 });
    expect(key("PageDown")).toEqual({ type: "step", direction: 1 });
    expect(key(" ")).toEqual({ type: "step", direction: 1 });
    expect(key("ArrowUp")).toEqual({ type: "step", direction: -1 });
    expect(key("PageUp")).toEqual({ type: "step", direction: -1 });
    expect(key(" ", { shiftKey: true })).toEqual({
      type: "step",
      direction: -1,
    });
  });

  test("are ignored with ctrl, meta or alt held", () => {
    expect(key("ArrowDown", { metaKey: true })).toBeNull();
    expect(key("ArrowDown", { altKey: true })).toBeNull();
  });
});

test("other keys mean nothing here", () => {
  expect(key("a")).toBeNull();
  expect(key("Enter")).toBeNull();
});

describe("toggle keys", () => {
  test("h and c are deliberate jumps to opening and contact", () => {
    expect(key("h")).toEqual({ type: "workspace", index: 0 });
    expect(key("c")).toEqual({ type: "workspace", index: 4 });
  });

  test("e toggles the crt effect and t cycles the theme", () => {
    expect(key("e")).toEqual({ type: "crt" });
    expect(key("t")).toEqual({ type: "theme" });
  });

  test("with shift, ctrl, meta or alt held they are left to the browser", () => {
    for (const k of ["h", "c", "e", "t", "H", "C", "E", "T"]) {
      expect(key(k, { shiftKey: true })).toBeNull();
      expect(key(k, { ctrlKey: true })).toBeNull();
      expect(key(k, { metaKey: true })).toBeNull();
      expect(key(k, { altKey: true })).toBeNull();
    }
  });
});
