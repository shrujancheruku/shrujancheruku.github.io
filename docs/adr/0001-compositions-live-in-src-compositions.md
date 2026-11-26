# Compositions live in src/compositions, not in the project's folder

Spec #29 says "A featured project's folder also holds its composition." We departed from that: a project's folder under `src/content/projects/<repository>/` holds only its `index.md`, and each composition is a module in `src/compositions/`, named after its repository (`src/compositions/<repository>.ts`, with any helper modules beside it, such as `issho-session.ts`).

## Why

The project folders are an Astro content collection: data loaded by schema from `*/index.md`. A composition is browser code, not content. All four are built on the shared kit (`src/compositions/kit.ts`), several split their logic into tested helper modules, and each must be its own chunk, loaded when the projects workspace gets close and never in the first load. Keeping them together in one folder beside the kit and the registry keeps that bundling in one place. Moving them into the content folders would touch about eleven files plus the registry and the size check, for no change a visitor sees.

## How a featured project is tied to its composition

By its repository name, in `src/compositions/registry.ts`, which maps each name to a dynamic import of its module. The build fails in two places when the tie is broken:

- during `astro build`, `src/components/Windows.astro` throws when a featured project has no entry in the registry (`missingCompositions` in `src/lib/composition-rules.ts`);
- afterwards, `scripts/check-compositions.ts` fails when a registered composition has no built chunk, or when one is over 60 KB of JS plus assets.

## Consequences

Featuring a new project still means writing its composition, but at `src/compositions/<repository>.ts`, plus one line in the registry. Without both, the build fails and the last good site stays live, as spec #29 requires.
