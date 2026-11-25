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
