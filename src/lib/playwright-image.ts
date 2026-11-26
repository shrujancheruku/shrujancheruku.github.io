/** The Playwright container images a workflow names, checked against @playwright/test. */

const IMAGE = /mcr\.microsoft\.com\/playwright:[^\s"']*/g;

/** The image tag that matches a given @playwright/test version. */
export function expectedImage(version: string): string {
  return `mcr.microsoft.com/playwright:v${version}-noble`;
}

/**
 * Every Playwright image in `workflow` that is not the one `version` needs. A
 * workflow that names no Playwright image at all is reported too, since then
 * nothing is checked.
 */
export function mismatchedImages(workflow: string, version: string): string[] {
  const found = workflow.match(IMAGE) ?? [];
  if (found.length === 0) return ["(no mcr.microsoft.com/playwright: image)"];
  const want = expectedImage(version);
  return found.filter((image) => image !== want);
}
