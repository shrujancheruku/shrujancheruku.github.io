# Moving the name site from github.io to shrujan.dev, for search

Research for issue #55. Gathered 2026-11-26. Nothing was configured: no Pages setting, DNS record, Search Console or Bing property was touched. Live observations are read-only HTTP requests and one `gh api` read.

**The goal:** `https://shrujan.dev` ranks first for "Shrujan Cheruku" and on page one for "Shrujan".

**Out of scope:** the DNS, custom-domain and HTTPS steps (a sibling ticket covers them) and an audit of the built HTML (another ticket covers that).

Each claim carries a tag:

- **[doc]** primary documentation (Google Search Central, Search Console Help, schema.org, Bing, GitHub, Astro), linked inline.
- **[http]** a response observed from the live site on 2026-11-25/26.
- **[repo]** this repository: `master` or `integration/portfolio-site`.
- **[inferred]** my reasoning from the documented facts. Not stated by any source.
- **[unverified]** secondary sources or anecdote only.

## Summary

1. **There is almost nothing to move for the name.** The live `shrujancheruku.github.io` home page has carried `<meta name="robots" content="noindex">` since 2017 (commit `2170f8f`) **[repo] [http]**. Google drops noindexed pages from results **[doc]**, so the user site most likely has no ranking for the name to carry over **[inferred]**. Ranking for "Shrujan Cheruku" will come from the new site's own signals, not from a migration. The project sites (`/unmacos/`, `/rapid-radiology/`, ...) are indexable today, and they are what a site move actually carries.
2. **GitHub's redirect is a site-move-grade redirect.** It is undocumented by GitHub, but on this account it is observed as a permanent `301` that keeps the path and the query string, from both http and https **[http]**. Google treats a 301 as a strong signal and recommends it for site moves **[doc]**.
3. **Search Console:** add `shrujancheruku.github.io` as a URL-prefix property (a Domain property is impossible, because the DNS for github.io isn't ours) and `shrujan.dev` as a Domain property (DNS TXT). The Change of Address tool should accept the github.io root as a "domain level" property **[inferred from doc examples]**. Verify the github.io property **before** the domain is switched on, and use the **HTML tag** method, so that verification survives the redirect.
4. **Bing:** import from Search Console. Bing's Site Move tool appears to have been removed **[unverified]**, so the 301s do the work there.
5. **The ranking work is on-page and off-page identity:**
   - A title and `<h1>` that lead with "Shrujan Cheruku".
   - A self-referencing canonical.
   - A sitemap and a robots.txt at the root.
   - `ProfilePage` plus `Person` (`sameAs` GitHub and LinkedIn) and `WebSite` JSON-LD on the home page.
   - Reciprocal links back from GitHub and LinkedIn. The GitHub profile's website field is empty today **[http, gh api]**.

## 1. Redirects: what GitHub does, and whether Google sees a site move

### What GitHub does

- GitHub documents the redirects between the apex and `www` ("GitHub Pages will automatically create redirects between the domains") and says a user site's custom domain "will be used for all project sites owned by the same account" **[doc]** ([About custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages), [Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)).
- **GitHub does not document** that `<user>.github.io` redirects to the custom domain, nor which status code it uses **[doc: absent]**.
- Observed on this account. `aidan-landing-page` is a project site that already has a custom domain **[http]**:

  | Request | Response |
  |---|---|
  | `https://shrujancheruku.github.io/aidan-landing-page/some/deep/path.html?q=1` | `HTTP/2 301`, `location: https://aidanbelizaire.com/some/deep/path.html?q=1` |
  | `http://shrujancheruku.github.io/aidan-landing-page/x/` | `301 Moved Permanently`, `Location: https://aidanbelizaire.com/x/` (one hop, straight to https) |
  | `https://shrujancheruku.github.io/aidan-landing-page/robots.txt` | `301` to `https://aidanbelizaire.com/robots.txt` |

  So the redirect is a permanent 301 that keeps the path and the query, and lands on https in one hop. A user site should behave the same way, with `/<path>` mapping to `https://shrujan.dev/<path>` **[inferred]**. Confirm this with `curl -I` right after the switch.
- GitHub sends every path, including verification files and `robots.txt`, through the redirect **[http]**. Nothing stays on the github.io host. This matters for Search Console verification (section 2).

### What Google does with it

- "We recommend that you use HTTP permanent redirects if possible, such as `301` and `308`." Keep the redirects "for as long as possible, generally at least 1 year." "If you're changing domain names or subdomains, submit a Change of Address in Search Console for the old site." **[doc]** ([Site moves with URL changes](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes))
- A 301 is "a strong signal that the redirect target should be processed". A 302 is weak; 308 is the same as 301 **[doc]** ([HTTP status codes](https://developers.google.com/search/docs/crawling-indexing/http-network-errors)).
- "Expect temporary fluctuation in site ranking during the move"; "it can take a few weeks or more" **[doc]** (site-move page).
- **Conclusion:** host-wide 301s that keep the path, plus Change of Address, is the textbook site move that Google describes **[inferred]**. The redirect never has to be removed, because it lasts as long as the custom domain is set. That beats "at least 1 year" **[inferred]**.

## 2. Search Console: property types and Change of Address

### Property types

| Site | Property type | How | Notes |
|---|---|---|---|
| `shrujancheruku.github.io` | **URL-prefix** `https://shrujancheruku.github.io/` | HTML file, HTML tag (GA and GTM are excluded: no analytics) | A Domain property needs a DNS record on a domain "you control". github.io's DNS is GitHub's **[doc]** |
| `shrujan.dev` | **Domain** `shrujan.dev` | DNS TXT at Porkbun, "the only way to verify a Domain property" | Covers every subdomain, both protocols and every path, including the project sites at `/<repo>/` **[doc]** |

Sources: [Add a website property](https://support.google.com/webmasters/answer/34592), [Verify your site ownership](https://support.google.com/webmasters/answer/9008080).

### Verification has to survive the redirect

From [Verify your site ownership](https://support.google.com/webmasters/answer/9008080) **[doc]**:

- **HTML file method:** Search Console "won't follow redirects to another domain for verification files." After the switch, `shrujancheruku.github.io/googleXXXX.html` 301s to shrujan.dev, so a file-verified github.io property would **fail its periodic recheck** and expire after the grace period **[inferred from doc + http]**.
- **HTML tag method:** Search Console checks "the page a non-logged-in visitor lands on after redirects." If the github.io property's `google-site-verification` meta tag stays in the shrujan.dev home page's `<head>`, the redirected check lands on a page that has the tag, so verification should keep passing **[inferred from doc]**. A page may carry several verification meta tags **[unverified, but common]**.
- "Search Console periodically checks that your verification token is still present", and permissions expire after a grace period **[doc]**.
- **Recommendation:** verify the github.io URL-prefix property with the HTML tag, before the domain switch, while the site is still served at github.io. Keep that tag in the site layout permanently.

### Change of Address

From [Change of Address tool](https://support.google.com/webmasters/answer/9370220) **[doc]**:

- "The Change of Address tool can be used only on properties at the domain level … you can move example.com, m.example.com, or http://example.com. You cannot move properties at the path level, such as http://example.com/petstore/."
- `https://shrujancheruku.github.io/` has no path segment, so it has the same shape as the `m.example.com` example. It should qualify, even though github.io isn't mentioned **[inferred]**. The page doesn't say whether URL-prefix properties are accepted. Its examples are URL-prefix forms (`http://example.com`), so the answer is very likely yes **[inferred]**.
- "You must be an owner of both the old and new properties." The tool checks for "301s on a few pages on your site." It doesn't move subdomains (not relevant here). Its effect lasts 180 days. "Maintain the redirects for at least 180 days" **[doc]**.
- "Don't chain site moves": you can't immediately move a site that was itself the target of a move **[doc]**. So pick `shrujan.dev` (no `www`) once and keep it.
- **How much it's worth:** small for the user-site home page, which is noindexed today. Real for the indexable project-site URLs under `shrujancheruku.github.io/<repo>/`, because the move is host-wide and covers them **[inferred]**. It costs nothing, so do it.

## 3. Bing Webmaster Tools

- **Import from Search Console:** in Bing Webmaster Tools, go to My Sites > Import, sign in with Google and Allow, then select the sites. "The imported sites will be automatically verified." Sitemaps come with them. Bing "will periodically validate your site ownership status by syncing with your Google Search Console account." If the Google access is revoked, verify again by meta tag or DNS **[doc]** ([Bing blog: Import sites from Search Console](https://blogs.bing.com/webmaster/2019/9/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools/)). Order: verify both properties in Search Console first, then import.
- Other verification methods: an XML file, a meta tag, or a CNAME record **[doc]** ([Add and verify site](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b); the page didn't render for my fetch, so the method list comes from search-result text).
- **Site Move:** Bing's 2020 migration guide still says to "use the Site Move Tool" and to keep the old domain's redirects "live for at least 1 to 2 years" **[doc]** ([Website Migration with Bing](https://blogs.bing.com/webmaster/december-2020/Website-Migration-with-Bing)). Microsoft Tech Community replies from 2021 and 2024–25 say the tool "is no longer available in new Bing Webmaster console" and to rely on 301s **[unverified]** ([forum thread](https://techcommunity.microsoft.com/t5/microsoft-bing/domain-move-tool/m-p/2144750)). Check in the console. Assume the 301s alone carry the move.
- Bing's guidelines: use 301 for permanent moves; 302 only for changes of under about two days **[doc]** ([Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)).
- **IndexNow** and URL submission can speed up discovery on Bing **[doc]** ([URL submission](https://www.bing.com/webmasters/help/url-submission-62f2860b)). Optional.

## 4. What a personal-name site needs

### State on `integration/portfolio-site` today [repo]

- `astro.config.mjs` has `site: "https://shrujancheruku.github.io"`, `trailingSlash: "always"` and `build: { format: "directory" }`. The `trailingSlash: "always"` setting is confirmed.
- The `<head>` in `src/layouts/Desktop.astro` has only `<title>` and `<meta name="description">`. There is no canonical, no JSON-LD, no `og:*` tags and no `noindex`.
- The title is "Shrujan Cheruku — Product Engineer". The description is "I design and build. Give me a problem, not a spec."
- There is no `src/pages/404.astro`, no `public/robots.txt`, and no sitemap integration (the dependencies are `astro` and `zod` only).

### Title and description

- Google builds title links from `<title>`, the main visual title, `<h1>`, `og:title`, anchor text and `WebSite` structured data. Make the title "descriptive and concise", unique per page, with the site name at the beginning or end, and no keyword stuffing **[doc]** ([Title links](https://developers.google.com/search/docs/appearance/title-link)).
- The current title leads with the exact name, which is right for the "Shrujan Cheruku" query **[inferred]**. Make the visible `<h1>` (NameWindow) the same string, "Shrujan Cheruku", so the main visual title, `<h1>` and `<title>` agree **[inferred from doc]**.
- The description has no name in it. Google may rewrite the snippet anyway. A description that contains "Shrujan Cheruku" and the role reads better as a name-query snippet **[inferred]**.

### Canonical URLs

- Redirects and `rel="canonical"` are strong signals; a sitemap is a weak one. Use absolute URLs. Don't use robots.txt or noindex to canonicalise **[doc]** ([Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)).
- Each page gets `<link rel="canonical" href="https://shrujan.dev/…/">`, self-referencing, absolute, with the trailing slash **[doc: "Each new URL should have a self-referencing rel=canonical", site-move page]**. Derive it from `Astro.site` and `Astro.url.pathname`, so changing `site` to `https://shrujan.dev` updates every page **[inferred]**.

### Sitemap and robots.txt

- Sitemap: "fully-qualified, absolute URLs", canonical URLs only. `<priority>` and `<changefreq>` are ignored. `lastmod` is used only if it is "consistently and verifiably" accurate. It can be submitted in Search Console or with a `Sitemap:` line in robots.txt **[doc]** ([Build a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)).
- `@astrojs/sitemap` needs `site` and writes `sitemap-index.xml` and `sitemap-0.xml`. It has a `filter` option, which can drop `/legacy/` and the 404 page **[doc]** ([Astro sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/)). For a one-page site, a hand-written `public/sitemap.xml` also works **[inferred]**.
- robots.txt "rules … apply only to the host" (and protocol and port). A 4xx on robots.txt means no crawl restrictions **[doc]** ([robots.txt spec](https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt)). Today it 404s on github.io **[http]**, which is harmless. On shrujan.dev, the user site's `robots.txt` is the **only** robots.txt for the whole host, project sites included, because project sites can't serve `/robots.txt` **[inferred from doc + GitHub path routing]**. Keep it minimal (`User-agent: *` / `Allow: /`) plus `Sitemap:` lines.

### Structured data: `ProfilePage`, `Person`, `WebSite`

- **`ProfilePage`** (schema.org: Thing > CreativeWork > WebPage > ProfilePage) **[doc]** ([schema.org/ProfilePage](https://schema.org/ProfilePage)).
  - Google's ProfilePage markup is "designed for any site where creators … share first-hand perspectives". It lists "An 'About Me' page on a blog site" as valid, provided "the primary focus of the page must be a single person … affiliated with the overall website." Required: `mainEntity` (a Person). Recommended Person fields include `name`, `alternateName`, `identifier`, `sameAs`, `image` and `description` **[doc]** ([Profile page structured data](https://developers.google.com/search/docs/appearance/structured-data/profile-page)).
  - A one-person home page fits **[inferred]**. Google doesn't promise a visible rich result for this case. The value is entity understanding **[inferred]**.
- **`Person`:** `name` (Text), `url` (URL), `jobTitle` (Text or DefinedTerm), `sameAs` ("URL of a reference Web page that unambiguously indicates the item's identity"), `givenName` and `familyName` **[doc]** ([schema.org/Person](https://schema.org/Person)). Google has no stand-alone Person rich result **[inferred: no such page in the Search Gallery]**.
- **`WebSite`:** with `name` and `url` on the home page, this is how a site states its preferred **site name**. It "must be on the home page", meaning the "domain or subdomain level root URI". "Google Search does not support site names at the subdirectory level." The site-name system also reads `og:site_name`, `<title>` and headings, so keep them consistent **[doc]** ([Site names](https://developers.google.com/search/docs/appearance/site-names)).
- Suggested shape. One name form only, so no `alternateName`:

  ```json
  {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": "https://shrujan.dev/#website",
        "name": "Shrujan Cheruku", "url": "https://shrujan.dev/" },
      { "@type": "ProfilePage", "@id": "https://shrujan.dev/#profile",
        "url": "https://shrujan.dev/", "isPartOf": { "@id": "https://shrujan.dev/#website" },
        "mainEntity": {
          "@type": "Person", "@id": "https://shrujan.dev/#person",
          "name": "Shrujan Cheruku", "givenName": "Shrujan", "familyName": "Cheruku",
          "url": "https://shrujan.dev/", "jobTitle": "Product Engineer",
          "sameAs": ["https://github.com/shrujancheruku", "https://www.linkedin.com/in/<handle>/"]
        } }
    ]
  }
  ```

  `givenName: "Shrujan"` is a structured way to tie the bare first name to the person without adding a second display-name form **[inferred]**. The LinkedIn handle is not in the repo.

### Knowledge panel signals

- The documented path only covers **claiming** an existing panel: search for yourself, click "Claim this knowledge panel", then sign in to an official site or profile, one of which can be Search Console. "Not all knowledge panels are claimable." The help page gives **no way to request a panel** and doesn't mention structured data **[doc]** ([Get verified on Google](https://support.google.com/knowledgepanel/answer/7534902)).
- So a panel can't be ordered. The levers are the ones that help Google resolve the entity, all **[inferred]**:
  - One consistent name string across the site, GitHub and LinkedIn.
  - `Person.sameAs` pointing to the profiles.
  - **Reciprocal links** from those profiles back to `https://shrujan.dev`. The GitHub profile's `blog` field is empty today **[http: `gh api users/shrujancheruku`]**.
  - The Search Console ownership, which later counts as a claim credential.
- If a panel appears, claim it with the same Google account that owns the shrujan.dev Search Console property **[doc + inferred]**.

### Ranking first for "Shrujan" alone

No source can promise page one for a bare first name. It depends on who else is called Shrujan and on what Google takes the query to mean **[inferred]**. The levers are the ones above, plus `givenName`, the first name standing alone in visible text (for example "Hi, I'm Shrujan"), and the profiles linking back. Set the target as "Shrujan Cheruku = #1" and treat "Shrujan" as best-effort. Measure both in Search Console > Performance > Queries.

## 5. The project sites at `shrujan.dev/<repo>/`

- When the user site gets `shrujan.dev`, every project site without its own domain moves to `https://shrujan.dev/<repo>/`. Their old github.io URLs 301 there, path kept **[doc: "used for all project sites"; http: same 301 pattern]**. `aidan-landing-page` keeps its own domain **[http]**.
- **Effect on the name query** **[inferred]**:
  - They share the host. One Domain property (shrujan.dev) and one site name ("Shrujan Cheruku", from the home page's `WebSite` markup) cover them, because Google has no subdirectory site names **[doc]**. In search results, each project page then shows the name as its site name, which reinforces the association.
  - More indexed pages on the host that link to `/` with the name as anchor text strengthen the home page's claim to the name query. Check whether each project site links to the root, and with what text.
  - Risk: a project page outranks the home page for the name, or the name query returns sitelinks. That is acceptable, because the home page should still win when its title, `<h1>` and structured data are the strongest name match.
  - Unrelated content (a radiology app, a macOS tool) on a personal-name host doesn't dilute a navigational name query in any documented way.
- **The real hazard is stale absolute URLs in the project sites.** The live `unmacos` page hard-codes `<link rel="canonical" href="https://shrujancheruku.github.io/unmacos/">` and a matching `og:url` **[http]**. After the switch, that canonical points to a URL that 301s back to the page itself: a redirect and a canonical that contradict each other. Google will probably resolve it to the redirect target, but it's a mixed signal **[inferred from doc: both are "strong" signals]**. Every project repo that sets an absolute `site`, base or canonical needs a rebuild with `https://shrujan.dev/<repo>/` (for example `unmacos`, and check `rapid-radiology`, `issho` and `Sineflex-Website`).
- **Sitemaps for project sites:** a sitemap "affects only descendants of the parent directory" unless it is submitted in Search Console **[doc]**. So each project's `/<repo>/sitemap.xml` covers only that project. It can be submitted in the shrujan.dev Domain property, or listed with a `Sitemap:` line in the root robots.txt, which is the only robots.txt on the host **[inferred]**.
- Change of Address on the github.io root covers the `/<repo>/` paths too. That is the main reason it's worth filing at all, given section 1 **[inferred]**.

## 6. Pitfalls

- **`noindex` carried forward.** The legacy page has `noindex` **[repo]**, and the build serves it at `/legacy/` **[repo: `legacy/index.html`; prior research `research/pages-deploy-coexistence`]**. That suits an archived page with an old title ("Shrujan Cheruku Portfolio"), which would otherwise compete with the home page. Keep it noindexed, and leave it out of the sitemap. Make sure no `noindex` gets into `Desktop.astro`. A noindexed page can't be helped by Change of Address. Google needs a recrawl to see a change, and "it may take months" without URL Inspection **[doc]** ([Block indexing](https://developers.google.com/search/docs/crawling-indexing/block-indexing)).
- **Blocking noindex with robots.txt:** a noindexed page "must not be blocked by a robots.txt file", or the rule is never seen **[doc]**. Don't `Disallow: /legacy/`; the noindex alone does the job.
- **Duplicate content during the move:** GitHub serves one host at a time. Once the domain is set, github.io 301s, so there is no window in which both hosts serve 200 **[http pattern; inferred for the user site]**. The duplicates that remain:
  - **(a)** The site goes live on github.io with `site` still set to github.io, and the domain is added later. That is two moves, and the canonicals point at the old host. Avoid it: set `site: "https://shrujan.dev"` in the same change that switches the domain on.
  - **(b)** `www.shrujan.dev`, only if a `www` DNS record exists. GitHub then 301s it to the apex **[doc]**.
  - **(c)** http against https. Google prefers https and HSTS helps **[doc]**; the HTTPS mechanics belong to the sibling ticket.
- **`trailingSlash: "always"`:** Google treats `/x` and `/x/` as separate URLs. Root `/` and no-slash root are equivalent. Pick one, use it consistently in links and the sitemap, and 301 the other **[doc]** ([To slash or not to slash](https://developers.google.com/search/blog/2010/04/to-slash-or-not-to-slash)).
  - GitHub Pages already 301s `/unmacos` to `/unmacos/` **[http, prior research]**, and `build.format: "directory"` writes `x/index.html`, so `/x/` is the served form. The config, GitHub's behaviour and Google's advice all agree **[inferred]**.
  - The work is consistency: canonicals, the sitemap, `sameAs`/`url` values and internal links all end in `/`. `Person.url` is `https://shrujan.dev/`, and the bare root is equivalent anyway.
- **The 404 page:** GitHub Pages serves a root `404.html` **[doc]** ([Custom 404](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site)), and missing paths return a real `404` status, not 200 **[http]**. No soft-404 risk from the host. Google drops 4xx URLs and doesn't process newly found ones **[doc]**.
  - Add `src/pages/404.astro`, so that Astro emits `404.html`.
  - Keep it out of the sitemap, and give it no canonical. It shouldn't point a canonical at `/`.
  - Don't redirect missing pages to the home page with a 200, because Google flags that as a soft 404 **[doc]**.
- **Verification loss:** see section 2. HTML-file verification of the github.io property breaks at the switch. Use the HTML tag, kept forever.
- **Project-site canonicals:** see section 5.
- **Re-moving:** "Don't chain site moves" **[doc]**. Don't move to `www.shrujan.dev` or another domain later.

## Open questions for the decision ticket

1. **Order of launch versus domain switch:** go live at github.io first and switch later, or switch the domain at launch? Search argues for setting `site` to `https://shrujan.dev` and switching at, or before, the first indexable deploy.
2. **Verification method for the github.io property:** keep a permanent `google-site-verification` meta tag in the layout (recommended), or accept losing the old property after Change of Address is filed?
3. **Is Change of Address worth filing,** given that the user-site home page was never indexed? Yes for the project-site URLs. Confirm that the tool accepts a `*.github.io` URL-prefix property: this is **[inferred]**, so test it in the console.
4. **`/legacy/`:** keep it noindexed (recommended), or drop it from the build altogether?
5. **The LinkedIn URL for `sameAs`,** and setting the GitHub profile website field (and LinkedIn's) to `https://shrujan.dev`.
6. **Project-site repos:** who updates `site`/canonical in `unmacos`, `rapid-radiology`, `issho` and `Sineflex-Website`, and when, relative to the switch?
7. **Bing Site Move:** confirm in the console whether it still exists.
