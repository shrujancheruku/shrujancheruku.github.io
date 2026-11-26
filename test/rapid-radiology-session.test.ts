import { describe, expect, test } from "bun:test";
import {
  FINDINGS,
  FINDINGS_CPS,
  GEMINI,
  HOLD_MS,
  KEY_LINE,
  OPENAI,
  REPORT_TYPES,
  segments,
} from "../src/compositions/rapid-radiology-session";

describe("segments", () => {
  test("splits a line into plain and from-your-findings runs", () => {
    expect(segments("[[Small effusion.]] No pneumothorax.")).toEqual([
      { text: "Small effusion.", found: true },
      { text: " No pneumothorax.", found: false },
    ]);
  });

  test("a line with no mark is all template", () => {
    expect(segments("The central airways are patent.")).toEqual([
      { text: "The central airways are patent.", found: false },
    ]);
  });

  test("a mark in the middle keeps both sides", () => {
    expect(segments("a [[b]] c")).toEqual([
      { text: "a ", found: false },
      { text: "b", found: true },
      { text: " c", found: false },
    ]);
  });
});

describe("the repository's CT Chest demo data", () => {
  test("is the first of five report types, and four lines of shorthand", () => {
    expect(REPORT_TYPES).toHaveLength(5);
    expect(REPORT_TYPES[0]).toBe("CT Chest");
    expect(FINDINGS.split("\n")).toHaveLength(4);
  });

  test("the key line is the approved wording", () => {
    expect(KEY_LINE).toBe(
      "■ from your findings · the rest is your template, word for word",
    );
  });

  test("both reports are complete, with the findings' parts marked", () => {
    for (const report of [OPENAI, GEMINI]) {
      expect(report.length).toBeGreaterThanOrEqual(9);
      expect(report.some((l) => segments(l).some((s) => s.found))).toBe(true);
      expect(report.some((l) => segments(l).every((s) => !s.found))).toBe(true);
    }
    const text = (r: string[]) => r.map((l) => l.replace(/\[\[|\]\]/g, ""));
    expect(text(GEMINI)).toContain(
      "4mm right upper lobe nodule, stable from prior. No new suspicious lung nodules.",
    );
  });

  test("typing the findings takes about 3 s and the hold about 7.5 s", () => {
    const typing = (FINDINGS.length / FINDINGS_CPS) * 1000;
    expect(typing).toBeGreaterThan(2500);
    expect(typing).toBeLessThan(5500);
    expect(HOLD_MS).toBe(7500);
  });
});
