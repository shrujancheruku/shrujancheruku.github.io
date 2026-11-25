import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { photoSchema } from "../src/lib/schemas";

const root = new URL("../src/", import.meta.url).pathname;
const photosFile = `${root}content/sabbatical/photos.yaml`;
const assetsDir = `${root}assets/sabbatical/`;

/** The four photo windows, in grid order: 1 top left, 4 bottom right. */
const SLOTS = ["1", "2", "3", "4"];

function readPhotos() {
  const items = Bun.YAML.parse(readFileSync(photosFile, "utf8")) as unknown[];
  return items.map((item) => photoSchema.parse(item));
}

describe("sabbatical photos content", () => {
  test("one entry per photo window, ids 1 to 4 in grid order", () => {
    const ids: string[] = readPhotos().map((p) => p.id);
    expect(ids).toEqual(SLOTS);
  });

  test("every named image file exists in the sabbatical asset folder", () => {
    const present = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
    for (const photo of readPhotos()) {
      if (photo.file === undefined) continue;
      expect(present).toContain(photo.file);
    }
  });

  test("a placeholder entry has a place and a date but no file", () => {
    const placeholder = photoSchema.parse({
      id: "2",
      place: "somewhere",
      date: "2026",
    });
    expect(placeholder.file).toBeUndefined();
  });

  test("the schema rejects an entry with an unknown key", () => {
    expect(() =>
      photoSchema.parse({ id: "1", place: "x", date: "y", width: 3 }),
    ).toThrow();
  });
});
