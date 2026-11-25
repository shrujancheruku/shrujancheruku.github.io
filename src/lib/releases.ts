/**
 * The release version of a project (#36): the latest non-pre-release release,
 * else the highest version-shaped tag. GitHub lists tags alphabetically, so
 * this module does the sorting.
 */

export interface Release {
  tagName: string;
  url: string;
  isPrerelease: boolean;
}

export interface Version {
  /** The tag as written, e.g. `v1.5.0`. */
  label: string;
  /** The release page, or the tag page when the version came from a tag. */
  url: string;
  source: "release" | "tag";
}

const versionShaped = /^v?(\d+)\.(\d+)\.(\d+)$/;

function parts(tag: string): [number, number, number] | null {
  const match = versionShaped.exec(tag);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compare(a: [number, number, number], b: [number, number, number]) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * @param repositoryUrl the repository's web address, without a trailing slash
 * @param releases published releases, newest first
 * @param tags every tag name, in any order
 */
export function pickVersion(
  repositoryUrl: string,
  releases: readonly Release[],
  tags: readonly string[],
): Version | null {
  const latest = releases.find((release) => !release.isPrerelease);
  if (latest) {
    return { label: latest.tagName, url: latest.url, source: "release" };
  }

  let best: { tag: string; parts: [number, number, number] } | null = null;
  for (const tag of tags) {
    const p = parts(tag);
    if (p && (!best || compare(p, best.parts) > 0)) best = { tag, parts: p };
  }
  if (!best) return null;
  return {
    label: best.tag,
    url: `${repositoryUrl}/releases/tag/${best.tag}`,
    source: "tag",
  };
}
