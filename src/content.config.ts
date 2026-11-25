import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { contentSchema, orderingSchema, photoSchema } from "./lib/schemas";

// The two hand-ordered lists, featured and archive.
const ordering = defineCollection({
  loader: file("src/content/projects.yaml"),
  schema: orderingSchema,
});

// One folder per project, named after its repository. The id is the folder
// name as written (the default id would lower-case it).
const projects = defineCollection({
  loader: glob({
    pattern: "*/index.md",
    base: "src/content/projects",
    generateId: ({ entry }) => entry.split("/")[0] ?? entry,
  }),
  schema: contentSchema,
});

// The four sabbatical photo windows: one line each, see the file.
const sabbatical = defineCollection({
  loader: file("src/content/sabbatical/photos.yaml"),
  schema: photoSchema,
});

export const collections = { ordering, projects, sabbatical };
