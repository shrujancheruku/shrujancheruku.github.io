import { describe, expect, test } from "bun:test";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardPathFor,
  RESUME_CARD,
  SITE_CARD,
  shareTags,
} from "../src/lib/share";

const featured = ["issho", "unmacos", "orca-flow", "rapid-radiology"];

describe("which card an address shares", () => {
  test("a featured project's own page shares that project's card", () => {
    expect(cardPathFor("/work/orca-flow/", featured)).toBe(
      "/cards/orca-flow.png",
    );
  });

  test("the card file is named for the lowercase slug, as the page is", () => {
    expect(cardPathFor("/work/Rapid-Radiology/", ["Rapid-Radiology"])).toBe(
      "/cards/rapid-radiology.png",
    );
  });

  test("/resume/ shares the resume's card", () => {
    expect(cardPathFor("/resume/", featured)).toBe(RESUME_CARD);
  });

  test("every other address shares the site's card, an archive project included", () => {
    for (const path of [
      "/",
      "/work/",
      "/now/",
      "/timeline/",
      "/contact/",
      "/archive/",
      "/work/claude-orchestrate/",
      "/nothing-here/",
    ])
      expect(cardPathFor(path, featured)).toBe(SITE_CARD);
  });

  test("a project that leaves the featured list falls back to the site's card", () => {
    expect(cardPathFor("/work/issho/", ["unmacos"])).toBe(SITE_CARD);
  });

  test("cards are 1200 × 630", () => {
    expect([CARD_WIDTH, CARD_HEIGHT]).toEqual([1200, 630]);
  });
});

describe("share tags", () => {
  const tags = shareTags({
    site: new URL("https://example.test/"),
    path: "/work/issho/",
    title: "issho — Shrujan Cheruku",
    description: "A pitch.",
    card: "/cards/issho.png",
  });
  const get = (key: string) =>
    tags.find((t) => t.property === key || t.name === key)?.content;

  test("carry the title, description and card, with the card an absolute URL", () => {
    expect(get("og:title")).toBe("issho — Shrujan Cheruku");
    expect(get("og:description")).toBe("A pitch.");
    expect(get("og:image")).toBe("https://example.test/cards/issho.png");
    expect(get("twitter:title")).toBe("issho — Shrujan Cheruku");
    expect(get("twitter:description")).toBe("A pitch.");
    expect(get("twitter:image")).toBe("https://example.test/cards/issho.png");
  });

  test("name the address itself and the card's size", () => {
    expect(get("og:url")).toBe("https://example.test/work/issho/");
    expect(get("og:image:width")).toBe("1200");
    expect(get("og:image:height")).toBe("630");
    expect(get("twitter:card")).toBe("summary_large_image");
  });

  test("follow the site value alone: another host moves every URL", () => {
    const moved = shareTags({
      site: new URL("https://shrujan.dev/"),
      path: "/resume/",
      title: "t",
      description: "d",
      card: "/cards/resume.png",
    });
    const urls = moved.filter((t) =>
      /url|image$/.test(t.property ?? t.name ?? ""),
    );
    expect(urls.length).toBeGreaterThan(0);
    for (const t of urls) expect(t.content).toStartWith("https://shrujan.dev/");
  });
});
