/**
 * Load budgets checked after the build (see scripts/check-photos.ts). Pure, so
 * `bun test` can check the rule without a build.
 */

/** A photo is at most 150 KB once built. */
export const PHOTO_BUDGET_BYTES = 150 * 1024;

export interface BuiltFile {
  /** The path inside the build output, e.g. `_astro/lisbon.Ab12.webp`. */
  name: string;
  bytes: number;
}

const PHOTO = /\.(avif|webp|jpe?g|png)$/i;

/** The built photos larger than the budget, in the order given. */
export function overPhotoBudget(files: readonly BuiltFile[]): BuiltFile[] {
  return files.filter(
    (file) => PHOTO.test(file.name) && file.bytes > PHOTO_BUDGET_BYTES,
  );
}

/** The opening workspace's first load: HTML, CSS, JS and fonts, compressed. */
export const FIRST_LOAD_BUDGET_BYTES = 250 * 1024;
/** The site's fonts in total. */
export const FONT_BUDGET_BYTES = 100 * 1024;

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;

export interface LoadSizes {
  /** Compressed bytes the opening workspace loads before `load`. */
  firstLoad: number;
  /** Bytes of every font file the site ships. */
  fonts: number;
}

/**
 * What the CI log says about both budgets: a line each with the measured size
 * and its limit, and a failure for each one that is over.
 */
export function loadBudgetReport(sizes: LoadSizes): {
  lines: string[];
  failures: string[];
} {
  const rows = [
    ["first load", sizes.firstLoad, FIRST_LOAD_BUDGET_BYTES],
    ["fonts", sizes.fonts, FONT_BUDGET_BYTES],
  ] as const;
  const lines: string[] = [];
  const failures: string[] = [];
  for (const [what, bytes, limit] of rows) {
    lines.push(`  ${what}: ${kb(bytes)} of ${limit / 1024} KB`);
    if (bytes > limit)
      failures.push(`the ${what} is ${kb(bytes)}; at most ${limit / 1024} KB`);
  }
  return { lines, failures };
}

const ASSET = /\/_astro\/([^/]+)$/;
const IMAGE = /\.(avif|webp|jpe?g|png)$/i;

/**
 * Of the requests the first load made, those that belong later: a composition's
 * chunk (named for its repository) or a photo from the image pipeline.
 */
export function lazyInFirstLoad(
  requests: readonly string[],
  compositions: readonly string[],
): string[] {
  return requests.filter((url) => {
    const file = ASSET.exec(url)?.[1];
    if (!file) return false;
    return (
      IMAGE.test(file) ||
      compositions.some((name) => file.startsWith(`${name}.`))
    );
  });
}
