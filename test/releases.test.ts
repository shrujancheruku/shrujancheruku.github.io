import { describe, expect, test } from "bun:test";
import { pickVersion } from "../src/lib/releases";

const repo = "https://github.com/shrujancheruku/orca-flow";
const release = (tag: string, isPrerelease = false) => ({
  tagName: tag,
  url: `${repo}/releases/tag/${tag}`,
  isPrerelease,
});

describe("release version", () => {
  test("the newest non-pre-release release wins, and links to the release", () => {
    const releases = [
      release("v2.0.0-rc.1", true),
      release("v1.5.0"),
      release("v1.4.0"),
    ];
    expect(pickVersion(repo, releases, ["v9.9.9"])).toEqual({
      label: "v1.5.0",
      url: `${repo}/releases/tag/v1.5.0`,
      source: "release",
    });
  });

  test("with only pre-releases, tags are used", () => {
    expect(
      pickVersion(repo, [release("v1.0.0-beta", true)], ["v0.2.0"]),
    ).toEqual({
      label: "v0.2.0",
      url: `${repo}/releases/tag/v0.2.0`,
      source: "tag",
    });
  });

  test("tags arrive unsorted and are sorted by version, not as text", () => {
    const tags = ["v0.10.0", "v0.9.1", "v0.2.0", "v0.9.10", "v0.9.2"];
    expect(pickVersion(repo, [], tags)?.label).toBe("v0.10.0");
    expect(pickVersion(repo, [], ["v0.9.2", "v0.9.10"])?.label).toBe("v0.9.10");
  });

  test("tags that are not version-shaped are ignored", () => {
    expect(
      pickVersion(repo, [], ["v1-final", "latest", "v1.0.0-rc1"]),
    ).toBeNull();
    expect(pickVersion(repo, [], ["v1-final", "v1.0.0"])?.label).toBe("v1.0.0");
  });

  test("tags without a leading v count", () => {
    expect(pickVersion(repo, [], ["0.3.0", "0.1.0"])?.label).toBe("0.3.0");
  });

  test("no release and no tag means no version", () => {
    expect(pickVersion(repo, [], [])).toBeNull();
  });
});
