# What crawlers see on the built portfolio

Research for #56. These are facts about the build output only. What to change is left to the on-site search setup grilling ticket.

## Source

- Built from `origin/integration/portfolio-site` at `12be39f1a627a2eb17c2315cb02022a3accf1952` ("chore(merge): #47 resume page and PDF"), on 2026-11-26, with `bun install` and then `bun run build`. The build had no network fetch that failed: it read the project list from `src/content/projects.yaml` and the project folders.
- Primary sources:
  - the HTML, CSS and JS in `dist/`;
  - the sources that produce them: `src/pages/[...path].astro`, `src/pages/404.astro`, `src/lib/addresses.ts`, `astro.config.mjs` and `.github/workflows/pages.yml`;
  - `dist/shrujan-cheruku-resume.pdf`.
- Methods:
  - Static HTML was parsed with a Python `html.parser` script. It records title, meta, links, headings, images, anchors, elements hidden with `hidden`, `aria-hidden`, `inert` or inline `display:none`, and visible versus hidden text.
  - Rendered pages were checked with Playwright Chromium against a local static server. The server answers unknown paths with `404.html` and status 404, as GitHub Pages does. Each page was loaded once with JavaScript off and once with it on, at 1280×800, waiting 2.5 s.
  - The PDF was read with `pdfjs-dist` (metadata, text layer, link annotations, mark info).

## Pages that exist

The build writes 11 HTML files. There are 10 desktop addresses: 9 from the address book (`src/lib/addresses.ts`) plus `404.html`. There is also `/resume/`.

| Address | `<title>` | meta description | `data-boot-step` |
|---|---|---|---|
| `/` | Shrujan Cheruku — Product Engineer | I design and build. Give me a problem, not a spec. | 0 |
| `/work/` | Projects — Shrujan Cheruku | (same default) | 1 |
| `/work/issho/` | issho — Shrujan Cheruku | Find your people through the things you already love. | 1 |
| `/work/unmacos/` | unmacos — Shrujan Cheruku | A keyboard-first desktop for macOS, installed with one command. | 2 |
| `/work/orca-flow/` | orca-flow — Shrujan Cheruku | Turn a backlog of issues into reviewed, merged pull requests. | 3 |
| `/work/rapid-radiology/` | rapid-radiology — Shrujan Cheruku | Turn a radiologist’s shorthand findings into a finished report, in their own words. | 4 |
| `/timeline/` | Timeline — Shrujan Cheruku | (same default) | 5 |
| `/now/` | Sabbatical — Shrujan Cheruku | (same default) | 6 |
| `/contact/` | Contact — Shrujan Cheruku | (same default) | 7 |
| `404.html` | Not found — Shrujan Cheruku | (same default) | 0, plus `data-not-found="true"` |
| `/resume/` | Shrujan Cheruku – Resume (en dash, unlike the em dash elsewhere) | Shrujan Cheruku, Product Engineer. | none (no desktop) |

- **`/archive/` does not exist.** It is not in the address book, and no page is built for it. `src/lib/addresses.ts` says later tickets add it through `extra`. It currently returns the 404 page. The archive projects in `projects.yaml` (claude-orchestrate, TrueCrypt-Steganography, aidan-landing-page) appear nowhere in `dist/`.
- `/work/` and `/work/issho/` both boot step 1. Their HTML differs only in title and description.

## Head tags (all pages)

- `lang="en"` on `<html>` on every page.
- On every page, the head has **none** of these:
  - `<link rel="canonical">`
  - `og:*` tags
  - `twitter:*` tags
  - `<meta name="robots">`
  - JSON-LD or other structured data
  - a favicon (`<link rel="icon">`)
- Desktop pages have `charset`, `viewport`, `description`, two font preloads and one stylesheet. `/resume/` also has `color-scheme: light`.
- `astro.config.mjs` sets `site: "https://shrujancheruku.github.io"`, `trailingSlash: "always"` and `build.format: "directory"`. The `site` value is not written into any page's head.

## The same body on every desktop address

After the title, the description and the `data-boot-step` / `data-not-found` attributes are removed, the HTML of the 9 address pages is byte-identical (same hash). `404.html` adds one not-found window. Every address therefore ships the full desktop: all workspaces' windows in one document, about 34 KB.

### What is in the static HTML

The parser counts about 463 words of text that is not hidden by attributes, plus 181 words inside `hidden`. It includes:

- the name, as an `h1` in the name window: `<span>Shrujan</span> <span>Cheruku</span>`;
- "product engineer" as text in the name window;
- the full work history: titles, companies, dates, descriptions and tags;
- education, skills, languages and hobbies;
- the sabbatical text;
- the contact text, email, LinkedIn and GitHub;
- the status-bar controls: workspace numbers, key hints and theme names.

### What is not in the static HTML as visible text

- **Project names and pitches.** All 9 project windows (`copy-1..4`, `comp-1..4`, `stack`) hold only placeholder text: "placeholder · built in #37" or "placeholder · built in #39". The names issho, unmacos, orca-flow and rapid-radiology appear only in three places:
  - `<title>` and meta description of their own pages;
  - the `<script type="application/json" id="desktop-addresses">` blob;
  - theme names (`issho-light`, `issho-dark`).
- **Terminal text.** "whoami → product engineer", "cat claim → I design and build." and "cat ask → Give me a problem, not a spec." are stored in a `data-terminal` JSON attribute. They are typed into the page by `src/scripts/terminal.ts`. The same goes for the contact terminal's `contact` command.
- **Other script-written text:**
  - the status-bar clock (`[data-clock]` is empty in HTML);
  - the CRT on/off label;
  - the 404 window's echo of `location.pathname`.

### How non-current content is hidden

- **Every window (`.pane`) is `display:none` in the stylesheet**, including the current workspace's windows. The Desktop script (`Desktop.astro` bundle) shows the current step's windows by setting inline `display:block` and a position. It sets `display:none` on the rest. The address only chooses which windows the script shows: the `data-boot-step` attribute is read by the script, not by CSS.
- No `inert` is used anywhere, and no window carries `aria-hidden`. `aria-hidden="true"` sits only on decoration: SVG icons, the skill-bar tracks, the hobbies tree glyphs, the photo placeholders, the CRT canvas and the `.snaps` element.
- The four earlier roles in the education window (Sandia, UIUC TA, Indian School of Business, EiQ Networks) are inside `<div id="education-roles" hidden>`. Script reveals them when the window is opened.
- The photo captions are "photo N · placeholder" inside `aria-hidden` elements. There are no `<img>` elements on any page, so there is no alt text to report.

### Rendered result (Playwright Chromium)

| Address | JS off: words in `innerText` | JS on: windows shown | JS on: words | Visible `h1` (JS on) |
|---|---|---|---|---|
| `/` | 25 (status bar only) | name, term, now | 64 | Shrujan Cheruku |
| `/work/`, `/work/issho/` | 25 | copy-1, comp-1, stack | 43 | none |
| `/work/unmacos/` | 25 | copy-2, comp-2, stack | 43 | none |
| `/work/orca-flow/` | 25 | copy-3, comp-3, stack | 43 | none |
| `/work/rapid-radiology/` | 25 | copy-4, comp-4, stack | 43 | none |
| `/timeline/` | 25 | timeline, education, skills | 324 | none |
| `/now/` | 25 | sabbatical, photo-1..4 | 78 | none |
| `/contact/` | 25 | name, term, contact | 91 | Shrujan Cheruku |
| any unknown path (404) | 25 | name, term, now, notfound | 100 | Shrujan Cheruku |
| `/resume/` | 475 | (no desktop) | 475 | SHRUJAN CHERUKU (CSS uppercase) |

With JavaScript off, a desktop address renders only the status bar: workspace numbers, key hints and theme names. It shows no name, no role and no content. There is no `<noscript>` fallback. With JavaScript on, each address shows only its own workspace. The `/work/*` addresses show placeholders, and their project names appear only in the tab title.

## Headings

The heading order is the same in the static HTML of all 9 addresses and `404.html`:

1. `h1` Shrujan Cheruku (exactly one `h1`)
2. `h3` Sabbatical, Lead Engineer, Senior Software Engineer, Full Stack Engineer, Platform Engineer, Software Engineer (timeline). These follow the `h1` with no `h2` between.
3. `h2` B.Sc Computer Science (education)
4. `h3` Software Engineering Intern, Teaching Assistant, Front-end Developer Intern, Web Design Intern (inside `hidden`)
5. `h3` languages, `h3` hobbies (skills window)
6. `h2` sabbatical

- The window titles ("timeline", "skills", "contact — zsh" and so on) are not headings. They appear as the sections' `aria-label`s.
- The contact and projects windows have no headings.
- The `h1` is the same on every address, including `/work/<slug>/` and `/timeline/`. After script runs, it is visible only on `/`, `/contact/` and the 404 page.

`/resume/` headings:

- `h1` holding `<span>Shrujan</span><span>Cheruku</span>`, with no space character between the spans.
- `h2` Experience, then six `h3` roles.
- `h2` Education & Internships, then five `h3`.
- `h2` Languages and `h2` Hobbies.

## Links

Anchors in the static HTML of every desktop address:

- `/now/` (the `~/now` window)
- `/shrujan-cheruku-resume.pdf` (twice)
- `mailto:shrujancheruku@gmail.com`
- `https://www.linkedin.com/in/shrujancheruku`
- `https://github.com/shrujancheruku`

The workspace switcher is made of `<button>`s, not links. No desktop page has an `<a>` to `/`, `/work/`, any `/work/<slug>/`, `/timeline/`, `/contact/` or `/resume/`. Navigation between those uses `history.pushState` and `replaceState` and sets `document.title` in script.

`404.html` adds anchors to `/`, `/work/`, `/timeline/`, `/now/` and `/contact/`.

`/resume/` links to:

- `/`
- `/shrujan-cheruku-resume.pdf`
- mailto, LinkedIn and GitHub
- `https://shrujancheruku.github.io/`

No page links to `/resume/`.

## robots.txt, sitemap, 404

- `dist/` contains no `robots.txt`, no `sitemap*.xml` and no favicon file. `public/` holds only `fonts/`.
- `404.html` is the desktop with a not-found window, titled "Not found — Shrujan Cheruku", with the default description. `src/pages/404.astro` notes that GitHub Pages serves this file for unknown paths. GitHub's documentation for custom 404 pages says Pages serves `404.html` with a 404 status. The local server mimicked that, so the 404 status for `/archive/` and `/nope/` above reflects that setup, not a live check. With JavaScript on, the 404 shows the opening's windows plus the not-found window. That window says "cd: no such place … There are five places:" and links the five addresses.
- Deploy: `.github/workflows/pages.yml` builds with `bun run build` and deploys `dist/` (after lint, `astro check`, unit and e2e tests).

## Resume PDF (`/shrujan-cheruku-resume.pdf`)

- Info dictionary:
  - Title "Shrujan Cheruku – Resume", with an en dash, taken from the `/resume/` page title
  - Author "Shrujan Cheruku"
  - Creator "Chromium"
  - Producer "Skia/PDF m159"
  - PDF 1.7
  - creation date set at build time
- 1 page, US Letter (612×792 pt). No XMP metadata, no document language (`Language: null`), no outline, and no mark info, so it is an untagged PDF.
- **The text is selectable.** The text layer has about 3,150 characters covering the name, role, contacts, skills, all experience, education, internships, languages and hobbies. In extraction order the name comes out as "SHRUJAN CHERUKU" and the section labels in capitals. **All the dates come out last**, after Hobbies, separate from their roles. The contact icons come out as the literal strings "@", "in", "gh" and "www".
- Link annotations: mailto, LinkedIn, GitHub and `https://shrujancheruku.github.io/`.

## Gaps in this research

- No live crawl of the deployed site, and no Google Search Console or URL Inspection data. How Googlebot actually renders and indexes these pages was not observed. Only a Chromium render was checked.
- The 404 status is inferred from GitHub's documented behaviour and a local mimic, not from a request to the live host.
- Project windows are placeholders at this SHA (tickets #37 and #39). The project-text findings will change when those tickets merge.
