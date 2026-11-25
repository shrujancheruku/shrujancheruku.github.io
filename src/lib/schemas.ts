/**
 * The schemas of the two project collections (#9, #10), in a pure module so
 * `bun test` can check them and `src/content.config.ts` can declare them.
 */
import { z } from "zod";

/** One list of `projects.yaml`: an id (`featured` or `archive`) and repository names in order. */
export const orderingSchema = z
  .object({
    id: z.enum(["featured", "archive"]),
    projects: z.array(z.string().min(1)),
  })
  .strict();

/**
 * The frontmatter of a project's `index.md`. Strict, so a `version` key (which
 * the content file can never set) is a build error, like any typo.
 */
export const contentSchema = z
  .object({
    pitch: z.string().trim().min(1, "a project needs a pitch"),
    /** Featured projects only: two to five, checked with the lists. */
    proof: z.array(z.string().trim().min(1)).optional(),
    live: z.url().optional(),
    /** Replaces the repository name as the display name. */
    name: z.string().trim().min(1).optional(),
    /** Replaces GitHub's main language. */
    language: z.string().trim().min(1).optional(),
    /** Switches the release version off. */
    hideVersion: z.boolean().optional(),
  })
  .strict();

export type OrderingEntry = z.infer<typeof orderingSchema>;
export type ContentFrontmatter = z.infer<typeof contentSchema>;
