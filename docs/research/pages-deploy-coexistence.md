# GitHub Actions Pages deploy: coexistence with the legacy site and sibling project sites

Research for issue #3. Gathered 2026-11-25. Nothing was deployed and no Pages setting was changed; every live observation below is a read-only API call or HTTP GET/HEAD.

Each claim is tagged with where it comes from:

- **[doc]** GitHub's official documentation or an official `actions/*` repository.
- **[api]** the live GitHub REST API for this account.
- **[http]** a response observed from `https://shrujancheruku.github.io`.
- **[repo]** the legacy site's files at commit `a809fc9`.
- **[unverified]** not confirmed by any of the above.

## Summary

1. Moving to an Actions deploy is one setting (`build_type: workflow`) plus one workflow. Jekyll stops running; `_config.yml` becomes inert. The legacy site does not depend on Jekyll, so nothing is lost.
2. GitHub does not document what happens when a user-site path and a project site share a first path segment. Do not rely on either outcome. Put per-project pages under a single reserved prefix (`/work/<slug>/`) and have the build fail if any top-level name in the output equals the name of a Pages-enabled repository.
3. The legacy site can be served from `/legacy/` byte-for-byte. Every asset reference is relative. Nothing new breaks from the move; the things that are broken (contact form, favicons, one cursor image) are already broken at the root today.
4. Limits: 1 GB published site, 10 GB hard artifact ceiling, 10-minute deploy timeout, 100 GB/month soft bandwidth. No per-file limit for Pages itself; 100 MiB per file applies only to files committed to git.

## 1. What changes when the user site moves to an Actions deploy

### Current state

- This repo: `build_type: legacy`, source `master` at `/`, `https_enforced: true`, no custom domain. **[api]** `GET repos/shrujancheruku/shrujancheruku.github.io/pages`
- Last Pages build: 2017-02-08. **[api]** `GET .../pages/builds`
- A `github-pages` environment already exists, with no protection rules and no deployment branch policy. **[api]** `GET .../environments`
- The default branch is `master`, not `main`. **[api]**

### Settings

- In Settings > Pages > Build and deployment > Source, select "GitHub Actions". **[doc]** [Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- The API equivalent is `PUT /repos/{owner}/{repo}/pages` with `build_type: "workflow"`. Allowed values are `legacy` and `workflow`: "workflow means that the site is built by a custom GitHub Actions workflow." **[doc]** [REST: Pages](https://docs.github.com/en/rest/pages/pages)
- The docs recommend a protection rule on the `github-pages` environment "so that only the default branch can deploy to this environment." This repo's environment has none today. **[doc]** [api]
- What visitors see between flipping the setting and the first successful workflow deploy is **[unverified]**. The safe order is: land the workflow on `master`, flip the setting, run the workflow at once.

### Workflow shape

From [Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) **[doc]**:

- A build job produces a directory of static files and uploads it with `actions/upload-pages-artifact`.
- A deploy job runs `actions/deploy-pages`. It "must have a minimum of `pages: write` and `id-token: write` permissions", must set `needs:` to the build job, and must name an environment (default `github-pages`).
- `actions/configure-pages` is optional; it exposes the site's base URL to the build.

Current major versions **[api]** (`GET repos/actions/<name>/releases/latest`): `actions/checkout` v7.0.1, `actions/configure-pages` v6.0.0, `actions/upload-pages-artifact` v5.0.0, `actions/deploy-pages` v5.0.1.

Minimal shape for this repo (triggers match "rebuilds daily and on every push" from the map):

```yaml
on:
  push:
    branches: [master]
  schedule:
    - cron: "17 5 * * *"
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      # build the new site into _site/, then copy the legacy files to _site/legacy/
      - uses: actions/upload-pages-artifact@v5
        with:
          path: _site
  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

The owner's `unmacos` repository already deploys this way (`build` then `deploy` with `upload-pages-artifact@v5` and `deploy-pages@v5`), so the pattern is proven on this account. **[api]** `unmacos/.github/workflows/pages.yml`

Two things about the scheduled rebuild **[doc]** [Events that trigger workflows: schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows):

- "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days." A portfolio repo that is left alone for two months stops rebuilding, and the archive goes stale silently.
- "The `schedule` event can be delayed during periods of high loads of GitHub Actions workflow runs."

### Jekyll and `_config.yml`

- Today the branch build runs Jekyll with `theme: jekyll-theme-slate` (the whole of `_config.yml`). **[repo]**
- The theme has no visible effect: no file in the repo has YAML front matter and there are no Markdown files, so Jekyll copies everything through untouched. **[repo]**
- Jekyll skips files that "start with `_`, `.`, or `#`", which is why `/_config.yml` returns 404 today. **[doc]** [About GitHub Pages and Jekyll](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll) **[http]**
- With an Actions deploy, GitHub does not run Jekyll. The artifact is published as uploaded; a custom workflow is the documented route for "a build process other than Jekyll". `_config.yml` has no effect and can be deleted. `.nojekyll` is not needed. **[doc]**
- Consequence: files and directories starting with `_` are published (useful for framework output such as `_astro/` or `_next/`). Files and directories starting with `.` are dropped by `upload-pages-artifact` unless `include-hidden-files: true` is set; `.git` and `.github` are always dropped. **[doc]** [`upload-pages-artifact/action.yml`](https://github.com/actions/upload-pages-artifact/blob/main/action.yml)
- Symlinks are dereferenced into copies by the action's `tar --dereference --hard-dereference`. **[doc]** same file

## 2. Path collisions between the user site and project sites

### What is documented

- A user site is served at `https://<owner>.github.io`; a project site at `https://<owner>.github.io/<repositoryname>`. One user site per account, one project site per repository. **[doc]** [What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- Nothing in that page, the publishing-source page, the limits page or the custom-workflows page says which wins when the user site contains a path whose first segment is the name of a repository with its own Pages site. **This precedence is undocumented.**

### What evidence exists

- Secondary and anecdotal only: a Stack Overflow thread, ["Does a folder in my user site conflict with a project site?"](https://stackoverflow.com/questions/25396383/does-a-folder-in-my-user-site-conflict-with-a-project-site), in which a commenter reports the project repository took precedence over the same-named folder in the user site. I could not open the thread itself (the fetch was refused); this is from a search-result summary. **[unverified]**
- No direct observation is possible on this account without deploying: the user-site repo has no directory named after a sibling repo. **[repo]**
- Observed routing on this account **[http]**:
  - `/unmacos/` and `/rapid-radiology/` return 200 from their project sites; the slashless forms 301 to the slashed forms.
  - `/aidan-landing-page/` returns 301 to its custom domain. A project with a custom domain still occupies its path on `github.io`.
  - `/UNMACOS/` and `/sineflex-website/` return 404 while `/unmacos/` and `/Sineflex-Website/` return 200. The first segment is matched case-sensitively in these two cases. Whether a user-site directory at the other-case path would be served is **[unverified]**.

### Names already taken

Repositories on this account with Pages enabled **[api]** (`GET users/shrujancheruku/repos`, `has_pages`):

| Repository | Build type | Observed at `/<name>/` |
|---|---|---|
| `unmacos` | workflow | 200 |
| `rapid-radiology` | workflow | 200 |
| `aidan-landing-page` | workflow | 301 to custom domain |
| `issho` | workflow | 404 |
| `Sineflex-Website` | legacy | 200 |
| `Portfolio` | legacy | 404 |
| `GameResume` | legacy | 404 |
| `Interactive-Graphics` | legacy | 404 |
| `ISB_TEP-LMS_Portal` | legacy | 404 |

Why four `legacy` sites report `status: built` yet return 404 is **[unverified]**. They should still be treated as owning their names.

### Recommended URL scheme

Because precedence is undocumented, design so the question never arises:

1. **One reserved prefix for all per-project pages: `/work/<slug>/`.** A project page for `unmacos` lives at `/work/unmacos/`, never at `/unmacos/`. The only name that can ever collide is the prefix itself.
2. **Keep the set of top-level names small and fixed.** For example `work`, `legacy`, `assets`, plus root files (`index.html`, `404.html`, `robots.txt`, `sitemap.xml`, the resume PDF). Avoid `portfolio` in any casing, since a `Portfolio` repo with Pages enabled exists.
3. **Never create a Pages-enabled repository named after a reserved top-level name** (`work`, `legacy`, `assets`). No such repository exists today. **[api]**
4. **Enforce it in the build.** The build already reads the owner's repositories from GitHub. Have it fail if any first-level entry of the output directory equals, case-insensitively, the name of a repository with `has_pages: true`. This catches future project sites on the next daily build, before anyone notices a shadowed page.
5. Slugs under `/work/` can be the repository names; nothing under the prefix can collide with a project site.

## 3. Serving the legacy site from `/legacy/`

Yes. Copy the legacy files into the artifact's `legacy/` directory unchanged.

### Why the move is safe

- Every `src`, `href` and `action` in `index.html` is relative (`css/style.css`, `images/logo-new.png`, `js/custom-scripts.js`, `bootstrap/...`, `icons/...`) or an in-page `#fragment`. There is no root-absolute path and no `<base>` tag. **[repo]** `index.html`
- Every `url()` in the stylesheets is relative to the stylesheet: `../images/background-1.jpg` (`css/style.css:1338`), `../fonts/glyphicons-*` (Bootstrap), `fonts/rik.*` (`icons/rik-icons/styles.css`). **[repo]**
- `js/custom-scripts.js` builds no asset URLs. Its one request reads the form's own `action` attribute, which is relative. **[repo]** `js/custom-scripts.js:564-608`
- The footer logo links to `index.html` (relative), which resolves to `/legacy/index.html`. **[repo]** `index.html:1234`
- No symlinks, no dotfiles, no file over 500 KB; about 3.4 MB in total. **[repo]**
- Google Fonts are loaded over `https`. **[repo]** `index.html:25-27`
- The page carries `<meta name="robots" content="noindex">`, so it will not compete with the new site in search. **[repo]** `index.html:16`

### What breaks because of the move

Nothing in the page itself. Two side effects of replacing the root:

- Old deep URLs such as `/css/style.css` or `/images/logo-new.png` stop resolving unless the new site happens to use the same names. Only matters to anything hot-linking them.
- `_config.yml` should not be copied into `legacy/`. Without Jekyll it would be published as a plain file. Harmless, but pointless.

### What is already broken today and stays broken at `/legacy/`

1. **Contact form.** `<form id="contact-form" action="php/sendmail.php">` posts by AJAX to a PHP script that calls `mail()`. **[repo]** `index.html:1148`, `php/sendmail.php`. Pages serves the file as a static download (`200`, `content-type: application/x-httpd-php`) and answers `POST` with `405`. **[http]** The script's error handler then shows "Something went wrong!". It has never worked on Pages.
2. **PHP source is public.** Anyone can download `php/sendmail.php`; it contains the owner's old email address as the recipient. **[http]** **[repo]**
3. **Favicon and touch icons.** `images/favicon.ico` and three `images/apple-touch-icon*.png` are referenced but not in the repo; 404. **[repo]** `index.html:19-22` **[http]**
4. **Carousel cursor.** `css/plagin-css/owl.carousel.css:60` references `grabbing.png`, which does not exist; 404. **[repo]** **[http]**
5. **Dead links.** The four social icons and the "See the project" / "Project details" buttons point at `#`. **[repo]**
6. **Phone link.** The footer phone link uses the non-standard `callto:` scheme, and its target number differs from the number displayed. **[repo]** `index.html:1264`

### Things to decide rather than things that break

- **The legacy page publishes a phone number and a university email address** in its footer (`index.html:1264`, `index.html:1282`). The map says the phone number must not be published on the new site; keeping the legacy site "unchanged" keeps a phone number public at `/legacy/`. Removing those two lines is the only edit needed.
- **Source clutter.** `less/`, `prepros.cfg`, `php/` and `icons/rik-icons/icons-reference.html` are served today and are not needed at runtime (the page loads compiled CSS only). They can be left out of `legacy/` with no visible change; leaving out `php/` changes the form's failure from 405 to 404, with the same on-screen message.
- **Where the files live in the repo.** With `build_type: workflow`, only what the workflow puts in the artifact is served; the repo root is no longer the web root. The legacy files can move into a `legacy/` directory in the repo and be copied verbatim.

## 4. Limits for an image- and motion-heavy site

From [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) **[doc]** unless noted:

| Limit | Value | Notes |
|---|---|---|
| Published site size | "may be no larger than 1 GB" | The whole artifact, including `legacy/` (about 3.4 MB). |
| Artifact hard ceiling | tar "must be under 10GB" | Pages will not attempt a deploy above this; 1 GB is the supported limit. **[doc]** [upload-pages-artifact README](https://github.com/actions/upload-pages-artifact) |
| Deploy timeout | "will timeout if they take longer than 10 minutes" | Large artifacts hit this before they hit 10 GB. |
| Bandwidth | "*soft* bandwidth limit of 100 GB per month" | Soft: GitHub may get in touch rather than cut off. |
| Builds | "*soft* limit of 10 builds per hour" | "does not apply if you build and publish your site with a custom GitHub Actions workflow." |
| Per-file size on Pages | none stated | |
| Per-file size in git | warning above 50 MiB, blocked above 100 MiB | Applies only to committed files, not to files generated during the build. **[doc]** [About large files on GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) |
| Source repository size | "recommended limit of 1 GB" | |
| Artifact contents | no symbolic or hard links; files and directories only | The upload action dereferences links for you. |
| Rate limiting | HTTP 429 possible | "not intended to interfere with legitimate uses". |

Observed serving behaviour **[http]**:

- `cache-control: max-age=600` on HTML and assets. There is no documented way to set response headers on Pages, so long-lived caching of fingerprinted assets is not available. The absence of such a feature is **[unverified]** beyond not appearing in the docs read.
- `accept-ranges: bytes` is sent, so video seeking should work. Not tested with a real video. **[unverified]**
- Responses come through Fastly (`via: 1.1 varnish`).

Practical reading: 1 GB is generous for optimised images and short encoded video loops. The constraint most likely to bite is the 10-minute cache lifetime (repeat visits re-validate heavy assets), then the 100 GB/month soft bandwidth if large videos are served to many visitors.

## Not verified

- Which site wins a user-site/project-site path collision. Undocumented; one anecdotal report says the project site.
- Whether project-site path matching is case-sensitive in general (observed for two repositories only), and whether the user site can serve a path differing only in case from a project site.
- What is served between switching `build_type` to `workflow` and the first successful workflow deploy.
- Why four legacy-build project sites report `built` but return 404.
- Whether Pages supports custom response headers or range requests for large media in practice.
- Actions minutes and cost for a daily scheduled build were not researched.
