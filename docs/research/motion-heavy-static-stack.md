# Options for a motion-heavy static site

Research for issue #4. Facts only; the stack choice is made in a later ticket.

- **Checked on:** 2026-11-25.
- **Versions and licences:** read from the npm registry (`registry.npmjs.org/<package>`, `dist-tags.latest`) on that date.
- **Browser support:** read from `@mdn/browser-compat-data` 8.1.10 (built 2026-11-19) and the `web-features` Baseline data set, both fetched from unpkg on that date. Current stable browsers in that data: Chrome 158, Edge 157, Firefox 160, Safari 27.2.
- **Not done:** nothing was built or measured. Every size figure below is the vendor's own claim.
- Items I could not confirm from a primary source are collected under [Unverified](#unverified).

## 1. Static-capable frameworks

### Current versions

| Option | Package | Latest | Published | Licence |
|---|---|---|---|---|
| Astro | `astro` | 7.4.13 | 2026-11-18 | MIT |
| Next.js (static export) | `next` | 16.4.6 | 2026-11-09 | MIT |
| SvelteKit | `@sveltejs/kit` | 3.4.0 | 2026-11-18 | MIT |
| SvelteKit static adapter | `@sveltejs/adapter-static` | 4.0.1 | 2026-10-29 | MIT |
| Svelte | `svelte` | 5.59.1 | 2026-11-20 | MIT |
| Plain Vite | `vite` | 8.3.8 | 2026-11-11 | MIT |

Astro 7 and SvelteKit 3 both build on Vite 8 ([Astro v7 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v7/), [SvelteKit 3 migration guide](https://svelte.dev/docs/kit/migrating-to-sveltekit-3)).

### What separates them

| | Astro 7 | Next.js 16 static export | SvelteKit 3 + adapter-static | Plain Vite 8 |
|---|---|---|---|---|
| Static output | Default output is prerendered pages | `output: 'export'` writes HTML/CSS/JS to `out/` | `prerender = true` in the root layout; build fails if a page cannot be prerendered (`strict`, default on) | Builds whatever HTML entry points exist; no router or prerenderer |
| Build-time data fetching | `await fetch()` in a component's script runs once at build time | Server Components run during `next build`; `fetch` in them runs at build time | Docs cover prerendering, but the page I read does not describe fetching in `load` during prerender (see Unverified) | Nothing built in; a script before the build writes JSON the app imports |
| Image pipeline | `<Image>` and `<Picture>` transform at build time with Sharp; AVIF/WebP; `srcset` via `layout`; remote images processed only for hosts listed in `image.domains` / `image.remotePatterns` | Default image loader is **not supported** in a static export. Needs a custom loader pointing at an external image service, or `images.unoptimized: true` (served as-is) | `@sveltejs/enhanced-img` generates AVIF/WebP and several sizes at build time, but "can only optimize files located on your machine during the build process" | Hashes and inlines imported assets only; no formats or sizes |
| GitHub Pages | Official `withastro/action@v6` plus `actions/deploy-pages@v5`; no `base` needed for a `<username>.github.io` repo | Official template `nextjs/deploy-github-pages` (`output: 'export'`, `basePath` from env) | Documented workflow; `paths.base` only for project sites; generate a `404.html` fallback | Documented workflow; `base` stays default for a user site |
| View transitions | Native cross-document transitions with no JS, or `<ClientRouter />` (client-side routing with a fallback for browsers without the API) | Not checked | Not covered in the pages I read | Hand-written |

Sources: [Astro: deploy to GitHub Pages](https://docs.astro.build/en/guides/deploy/github/), [Astro: images](https://docs.astro.build/en/guides/images/), [Astro: data fetching](https://docs.astro.build/en/guides/data-fetching/), [Astro: view transitions](https://docs.astro.build/en/guides/view-transitions/), [Next.js: static exports](https://nextjs.org/docs/app/guides/static-exports), [Next.js: Image component](https://nextjs.org/docs/app/api-reference/components/image), [nextjs/deploy-github-pages](https://github.com/nextjs/deploy-github-pages), [SvelteKit: adapter-static](https://svelte.dev/docs/kit/adapter-static), [SvelteKit: images](https://svelte.dev/docs/kit/images), [SvelteKit: page options](https://svelte.dev/docs/kit/page-options), [Vite: static deploy](https://vite.dev/guide/static-deploy).

### Details that matter for this site

- **Next.js static export drops more than images.** Unsupported: dynamic routes without `generateStaticParams()`, redirects, rewrites, headers, Proxy, ISR, Server Actions, Draft Mode, intercepting routes. Route Handlers work for `GET` only and must set `dynamic = 'force-static'`.
- **Remote images.** Project imagery that comes from GitHub (social previews) is remote. Astro can process it once the host is authorised. `enhanced-img` cannot, so the images would have to be downloaded into the repo tree before the build. Next.js static export optimises nothing at build time either way.
- **Astro 7 is stricter than earlier versions.** A Rust compiler replaces the Go one: unclosed tags are build errors and invalid nesting is no longer corrected. `compressHTML` defaults to `'jsx'`, which can remove spaces between inline elements. Markdown renders with Sätteri by default; remark/rehype plugins need `@astrojs/markdown-remark`.
- **SvelteKit 3 moved its config.** `svelte.config.js` is no longer supported; options go to the `sveltekit` plugin in `vite.config.js`. Requires Node 22.17+, TypeScript 6, Svelte 5.57.1+, Vite 8.0.12+. `$app/stores` is removed in favour of `$app/state`.
- **Astro's client router.** Docs say it "works best in browsers that support View Transitions (i.e. Chromium browsers)" and that it "will increasingly become unnecessary". Scripts and state may need re-initialising after each navigation, which matters for long-lived WebGL canvases and smooth-scroll instances. `transition:persist` keeps elements across pages, but CSS animations restart and iframes reload.
- **GitHub Pages limits** ([docs](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)): published site at most 1 GB; soft bandwidth limit 100 GB a month; a deployment times out after 10 minutes; the 10-builds-an-hour soft limit does not apply to a custom Actions workflow.
- **Output size.** Not measured. No primary source gave comparable numbers.

## 2. Motion

### Libraries

| Library | Package | Latest | Licence | Notes |
|---|---|---|---|---|
| GSAP | `gsap` | 3.15.1 (2026-11-04) | "Standard 'no charge' license" (not an open-source licence) | All plugins included |
| Motion | `motion` | 14.14.0 (2026-11-13) | MIT | Paid Motion+ tier adds components |
| Lenis | `lenis` | 1.3.28 (2026-11-23) | MIT | Smooth scroll |
| Locomotive Scroll | `locomotive-scroll` | 5.1.1 (2026-11-13) | MIT | Built on Lenis |
| three.js | `three` | 0.187.0 (2026-10-30) | MIT | WebGL and WebGPU renderers |
| OGL | `ogl` | 1.0.11 (2025-01-27) | Unlicense | Minimal WebGL |
| React Three Fiber | `@react-three/fiber` | 9.8.2 (2026-10-14) | MIT | three.js for React |
| Threlte | `@threlte/core` | 8.7.0 (2026-11-02) | MIT | three.js for Svelte |
| Anime.js | `animejs` | 4.5.0 (2026-06-22) | MIT | Listed for completeness; not researched |

### GSAP licence

Source: [GSAP standard licence](https://gsap.com/community/standard-license/) and [GSAP pricing](https://gsap.com/pricing/).

- Free for everyone, including commercial use: "GSAP is now 100% free for all users, thanks to Webflow's support."
- **Every plugin is included**, among them the former members-only ones: ScrollTrigger, ScrollSmoother, ScrollTo, SplitText, ScrambleText, TextPlugin, MorphSVG, DrawSVG, MotionPath, MotionPathHelper, Flip, Draggable, Inertia, Observer, Physics2D, PhysicsProps, GSDevTools, CustomBounce, CustomWiggle.
- Permitted: use "on any website, web application, or digital interface by any person or entity".
- Prohibited: using GSAP in a visual, no-code animation tool that competes with Webflow's visual animation building; reverse engineering it to build a competing product; removing proprietary notices.
- Webflow may terminate the licence on breach, after which all use must stop and copies be destroyed. Webflow may also update the terms; continued use counts as acceptance, and versions already released stay under the terms they shipped with.
- Effective 2025-04-30, last modified 2025-05-30.
- A personal portfolio falls within the permitted use. The licence is proprietary, so GSAP's source cannot be relicensed as part of an MIT repository.

### Motion (formerly Framer Motion)

Sources: [Motion quick start](https://motion.dev/docs/quick-start), [scroll()](https://motion.dev/docs/scroll), [Motion+](https://motion.dev/plus).

- Core library is MIT (npm). Works in plain JavaScript; vendor-stated sizes are 3.2 kB for the mini `animate()` and 3.8 kB for `scroll()`.
- `scroll()` runs animations "with the `ScrollTimeline` API where possible", with hardware acceleration in browsers that support it.
- **Motion+ is paid:** a one-time USD 399 per developer. It gates Carousel, Ticker, Cursor, AnimateNumber, AnimateText, Typewriter, ScrambleText, AnimateView, `splitText`, Motion FX, 540+ example sources and more. Most Motion+ code is MIT once obtained; FX is under a separate Motion+ licence that forbids redistributing its source.
- Text splitting is the visible difference from GSAP: SplitText is free in GSAP, `splitText` is paid in Motion.

### Browser-native motion

| Feature | Chrome / Edge | Firefox | Safari | Baseline |
|---|---|---|---|---|
| Same-document view transitions (`document.startViewTransition`, `view-transition-name`) | 111 | 144 | 18 | Newly available since 2025-10-14 |
| `view-transition-class` | 125 | 144 | 18.2 | Newly available since 2025-10-14 |
| View transition types (`:active-view-transition-type`) | 125 | 147 | 18.2 | Newly available since 2026-01-13 |
| `view-transition-name: match-element` | 137 | 144 | 18.4 | (not tracked separately) |
| **Cross-document view transitions** (`@view-transition`, `pagereveal`) | 126 | **Not in release** (listed as "preview"; none on Android) | 18.2 | **Not Baseline** |
| Element-scoped view transitions | 147 | No | No | Not Baseline |
| Nested view transition groups (`view-transition-group`) | 140 | No | No | Experimental |
| **Scroll-driven animations** (`animation-timeline: scroll()` / `view()`, `animation-range`, `ScrollTimeline`, `ViewTimeline`) | 115 | **159** (released 2026-10-27) | 26 (released 2025-09-15) | **Newly available since 2026-10-27** |
| Scroll-triggered animations (`animation-trigger`, `timeline-trigger`) | 146 | No | No | Experimental |
| Container scroll-state queries | 144 | No | No | Not Baseline |
| `linear()` easing | 113 | 112 | 17.2 | Widely available since 2026-06-11 |
| `@starting-style` | 117 | 129 | 17.5 | Newly available since 2024-08-06 |
| Registered custom properties (`@property`) | 85 | 128 | 16.4 | Newly available since 2024-07-09 |
| `interpolate-size` | 129 | No | No | Not Baseline |
| Web Animations API | 84 | 75 | 14 | Widely available |
| Individual transform properties, motion path | 104 / 55 | 72 | 14.1 / 16 | Widely available |

Reading the table:

- Scroll-driven CSS animations reached every engine only a month before this note. Anyone on Firefox 158 or earlier, or Safari 18 or earlier, gets no scroll-driven animation unless a JavaScript fallback exists.
- Cross-document view transitions (the kind a multi-page static site gets for free) still do nothing in release Firefox. Pages simply navigate without the animation.
- The newest additions (scroll-triggered animations, element-scoped and nested view transitions, scroll-state queries) are Chromium-only.

### Smooth scroll

- **Lenis** ([repo](https://github.com/darkroomengineering/lenis)): MIT, by darkroom.engineering, last pushed 2026-11-24. Smooths the browser's native scroll, so `position: sticky` and anchor links keep working. Ships `lenis/react`, `lenis/vue`, `lenis/snap`. Stated limits: no CSS scroll-snap (use `lenis/snap`), no smoothing over iframes, Safari capped at 60 fps (30 in low power mode), `position: fixed` lag on pre-M1 macOS Safari. GSAP integration is documented: call `ScrollTrigger.update` on Lenis's `scroll` event and drive `lenis.raf` from `gsap.ticker`.
- **GSAP ScrollSmoother** ([docs](https://gsap.com/docs/v3/Plugins/ScrollSmoother/)): also based on native scroll; needs a `#smooth-wrapper` / `#smooth-content` pair with `position: fixed` elements outside it; requires ScrollTrigger; smoothing is off on touch-only devices unless `smoothTouch` is set. Free under the GSAP licence.
- **Locomotive Scroll** ([repo](https://github.com/locomotivemtl/locomotive-scroll)): MIT, "Built on top of Lenis", adds in-view detection and parallax; vendor-stated 9.9 kB gzipped.

### WebGL and WebGPU

Browser support:

| | Chrome / Edge | Firefox | Safari |
|---|---|---|---|
| WebGL 2 | 56 / 79 | 51 | 15 |
| WebGPU | Desktop 113 on ChromeOS, macOS, Windows; Linux added in 144 (Intel Gen12+ GPUs only). Android 121 | **Partial.** Windows since 141; macOS on Apple silicon since 145 (Tahoe) and 147 (older macOS). No Intel Macs, no Linux, no Android | 26 (macOS and iOS) |

- WebGL 2 is Baseline widely available. **WebGPU is not Baseline**, because of the Firefox gaps.
- **three.js** has two renderers. `WebGPURenderer` "tries to use a WebGPU backend if the browser supports WebGPU. If not, `WebGPURenderer` falls backs to a WebGL 2 backend"; `forceWebGL: true` forces the WebGL 2 backend. The docs call it "the new alternative of `WebGLRenderer`" ([WebGPURenderer docs](https://threejs.org/docs/pages/WebGPURenderer.html)). Shaders for it are written in TSL, which builders report compiles to both WGSL and GLSL (see section 3).
- **OGL** ([repo](https://github.com/oframe/ogl)): Unlicense; vendor-stated 29 kB minzipped in total (core 8, math 6, extras 15); WebGL only, no mention of WebGPU. Last npm release 2025-01-27, last push 2025-04-13, not archived.
- **Framework bindings:** React Three Fiber (React) and Threlte (Svelte) are current and MIT. Not researched beyond that.

## 3. What notable portfolio sites are built with

Each row is what the builder says, in their own write-up or repository.

| Site | Builder's stated stack | Recognition stated in the source | Source |
|---|---|---|---|
| Bruno Simon, 2025 portfolio (bruno-simon.com) | three.js with TSL, running "on WebGPU when available"; repository shows Vite 8, three 0.187, GSAP 3.15, Rapier physics, Howler audio. No UI framework. Front-end code is MIT | Awwwards Site of the Month, January 2026 (from an Awwwards listing, not re-checked on the award page) | [Awwwards case study by Bruno Simon](https://www.awwwards.com/brunos-portfolio-case-study.html), [brunosimon/folio-2025](https://github.com/brunosimon/folio-2025) |
| Martin Laxenaire, 2025 portfolio | "Sanity Studio as a headless CMS. Nuxt3 as a front-end framework. GSAP as the main animation engine, along with a few plugins. Lenis for an accessible smooth-scrolling. gpu-curtains, my own WebGPU rendering engine." 2D-canvas fallback for every WebGPU scene; WebGPU scenes loaded only when supported | None stated | [Codrops, 2025-10-06](https://tympanus.net/codrops/2025/10/06/self-doubt-and-the-quest-for-fun-how-i-ended-up-turning-my-portfolio-into-a-game/) |
| Joffrey Spitzer, portfolio | Astro for static generation with vanilla JavaScript; GSAP (SplitText, ScrollTrigger, Flip); Lenis; three.js for WebGL; Swup for page transitions; Tailwind; Prismic CMS; Netlify | None stated | [Codrops, 2026-02-18](https://tympanus.net/codrops/2026/02/18/joffrey-spitzer-portfolio-a-minimalist-astro-gsap-build-with-reveals-flip-transitions-and-subtle-motion/) |
| Arnaud Rocca, portfolio | Nuxt (static generation); GSAP with SplitText and ScrollTrigger; Lenis; OGL; Prismic | None stated | [Codrops, 2026-03-31](https://tympanus.net/codrops/2026/03/31/arnaud-roccas-portfolio-from-a-gsap-powered-motion-system-to-fluid-webgl/) |
| Giulio Collesei, "They Call Me Giulio" | three.js with TSL on WebGPU "with a WebGL fallback"; React and React Router for the DOM layer; plain three.js rather than React Three Fiber; GSAP for all scroll-based animation; Lenis plus custom snapping; Blender for assets | None stated | [Codrops, 2026-04-14](https://tympanus.net/codrops/2026/04/14/they-call-me-giulio-the-making-of-a-cinematic-cyberpunk-portfolio/) |
| Stas Bondar, 2025 portfolio (stabondar.com) | Astro; GSAP (SplitText, ScrollTrigger, Flip, Draggable); three.js; Barba.js for page transitions. Moved off Webflow because he was "using Webflow as a static HTML generator" | GSAP Site of the Week and Site of the Month | [Codrops, 2025-03-25](https://tympanus.net/codrops/2025/03/25/stas-bondar-25-the-code-techniques-behind-a-next-level-portfolio/) |
| Lando Norris site, by OFF+BRAND (agency work, not a personal portfolio) | Awwwards entry is tagged Webflow, GSAP, WebGL, 3D | Awwwards Site of the Day, 2025-11-17; OFF+BRAND describe their work as including an "Awwwards Site of the Year" | [Awwwards entry](https://www.awwwards.com/sites/lando-norris), [Codrops studio profile, 2026-08-17](https://tympanus.net/codrops/2026/08/17/creativity-at-enterprise-scale-without-compromise-the-offbrand-story/) |

Patterns across these seven:

- **GSAP is in all seven.** SplitText and ScrollTrigger are the plugins named most often.
- **Lenis is the smooth-scroll library in four of the six personal portfolios**; none names ScrollSmoother or Locomotive Scroll.
- **Page transitions are done with a library** (Swup, Barba.js) or the framework's router. None of the write-ups uses the View Transitions API.
- **None uses Motion, Next.js or SvelteKit.** Frameworks named: Astro (two), Nuxt (two), React with React Router (one), no framework with Vite (one), Webflow (one). Nuxt is not among the options listed in the ticket.
- **WebGL layer:** three.js in four, OGL in one, a custom WebGPU engine in one. The three WebGPU builds all ship a fallback (WebGL 2 through TSL, or 2D canvas).

This is a small sample drawn from Codrops and Awwwards write-ups, not a survey.

## 4. Build-time image tooling for GitHub Actions

| Tool | Package | Latest | Licence | What it does |
|---|---|---|---|---|
| Satori | `satori` | 0.63.2 (2026-10-20) | MPL-2.0 | JSX and CSS to an SVG string, no browser |
| resvg | `@resvg/resvg-js` | 2.6.2 (2024-03-26) | MPL-2.0 | SVG to PNG |
| `@vercel/og` | `@vercel/og` | 1.0.3 (2026-09-22) | MPL-2.0 | Satori wrapper that returns an image response |
| Takumi | `@takumi-rs/core` | 2.22.1 (2026-11-20) | MIT or Apache-2.0 | Rust engine: JSX/HTML/CSS to PNG, JPEG, WebP, animated WebP/APNG/GIF, PDF |
| astro-og-canvas | `astro-og-canvas` | 0.13.3 (2026-11-02) | MIT | Astro endpoint helper that renders title, description and logo cards |
| Sharp | `sharp` | 0.35.5 (2026-09-27) | Apache-2.0 | Resize and convert; also rasterises SVG |
| Playwright | `playwright` | 1.65.1 (2026-11-13) | Apache-2.0 | Drives a real browser; screenshots of live pages |
| Puppeteer | `puppeteer` | 25.18.1 (2026-11-17) | Apache-2.0 | Drives Chrome; screenshots of live pages |

### Social cards without a browser

- **Satori** ([repo](https://github.com/vercel/satori)): runs in Node 16+, browsers and Web Workers. Input is JSX or plain element objects; output is SVG only. Supports flexbox, grid and block layout; `table` and `ruby` throw; many properties are ignored; output is not guaranteed to match a browser. Fonts must be supplied as TTF, OTF, WOFF or WOFF2 buffers, and variable fonts render only their default instance. The README suggests Sharp for SVG-to-PNG.
- **Takumi** ([repo](https://github.com/kane50613/takumi)): no headless browser; native binding for Node and Bun, WebAssembly for browsers and Workers. Supports "a subset of browser CSS" including flexbox, grid, block, inline, table and float, plus Tailwind v4 utilities. Writes raster images directly and can write animated ones.
- **astro-og-canvas** ([repo](https://github.com/delucis/astro-og-canvas), README in `packages/astro-og-canvas`): an `OGImageRoute` helper exporting `getStaticPaths` and `GET`, so cards are generated as static files during the Astro build. Depends on `canvaskit-wasm`. Astro-only.
- These tools draw a card from data. They cannot render the site's own WebGL or animated pages.

### Screenshots of live pages

- **Playwright in GitHub Actions** ([CI docs](https://playwright.dev/docs/ci)): install with `npx playwright install --with-deps`; runs headless by default on Linux runners. A container image is offered (`mcr.microsoft.com/playwright:v<version>-noble`), which the docs say keeps screenshots consistent across operating systems. "Caching browser binaries is not recommended", so each run pays the browser download.
- **Puppeteer** is the equivalent for Chrome only. Not researched beyond its version and licence.
- A real browser is the only route that captures what a visitor sees, but GitHub-hosted runners have no GPU, so WebGL and WebGPU scenes render in software or not at all (see Unverified).
- The Pages 10-minute deployment timeout applies to the deploy step, not to the build job that takes the screenshots.

## Unverified

- **three.js manual on WebGPURenderer.** The manual page returned 404 to my fetches. Search snippets of it say `WebGLRenderer` is still maintained and recommended for pure WebGL 2 work; I could not read that sentence myself. The `three/webgpu` import path was not confirmed either.
- **TSL limits under the WebGL 2 fallback.** Forum and third-party pages say compute shaders are unavailable in the fallback. No official page confirmed it.
- **SvelteKit build-time fetching.** Widely understood to work through `load` functions during prerendering, but the two official pages I read do not say so in terms.
- **Astro shipping no JavaScript by default**, and any comparison of output size between frameworks. Not checked and not measured.
- **Astro 7's release date** and whether the image guide reflects 7.x exactly; the guide carries no version label.
- **Next.js view-transition support** and Next.js build-time behaviour beyond the static export and Image pages.
- **Lando Norris site as Awwwards Site of the Year.** The Awwwards entry I read shows Site of the Day (2025-11-17). The Site of the Year attribution comes from OFF+BRAND's own profile and an ambiguous Awwwards listing. Whether the site uses three.js is not stated anywhere I read.
- **Bruno Simon's Site of the Month** comes from an Awwwards listing in search results, not the award page.
- **Codrops articles** were read from Internet Archive snapshots, because the live site refused automated requests. Quotes are from those snapshots.
- **All bundle sizes** (Motion 3.2 kB / 3.8 kB, OGL 29 kB, Locomotive Scroll 9.9 kB) are vendor claims. No figure was found for GSAP core or Lenis.
- **Motion+ price** (USD 399) was read from the page's product data, not a visible price table.
- **Playwright screenshot options** (`fullPage`, `clip`, formats) and **GPU availability on GitHub-hosted runners** were not checked against documentation.
- **Firefox cross-document view transitions:** the compat data says "preview" without a version; I did not check which Nightly or flag.
- **React Three Fiber, Threlte, Anime.js, Puppeteer, `@vercel/og`:** version and licence only.
