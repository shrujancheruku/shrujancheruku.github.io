# Search wording for a name site and its project addresses

Research for #120, part of the positioning map #118. Gathered 2026-11-26. It builds on two earlier findings files and does not repeat them:

- `docs/research/name-site-domain-move-search.md` on `research/name-site-domain-move-search` (#55): redirects, Search Console, canonicals, sitemap, the `WebSite` / `ProfilePage` / `Person` shape, site names, knowledge panels.
- `docs/research/built-portfolio-crawler-view.md` on `research/built-portfolio-crawler-view` (#56): what the build emits today (titles, descriptions, headings, links).

The decisions already taken in the search spec (#63) are the baseline: canonicals, sitemap, one JSON-LD block on `/`, `jobTitle` "Product Engineer", `h1` "Shrujan Cheruku" on every address, and a first set of meta descriptions.

**The question:** how should titles, meta descriptions, headings and structured data be worded so that `shrujan.dev` ranks first for "Shrujan Cheruku" and each project address ranks for its project's name (unmacos, orca-flow, issho, rapid-radiology)?

Each claim carries a tag:

- **[doc]** primary documentation (Google Search Central, Google Search Central blog, schema.org, Bing Webmaster blog), linked inline.
- **[repo]** this repository, or a `gh repo view` read of the project repositories on 2026-11-26.
- **[inferred]** my reasoning from the documented facts. No source states it.
- **[secondary]** third-party write-ups only. Weak evidence.

## Summary

1. **Titles:** Google sets no length limit and truncates to the device width **[doc]**. The working figure of about 60 characters is folklore **[secondary]**. The home page title is the one place Google says extra description belongs. Every other page should be "<page> — <site name>" **[doc]**. "Shrujan Cheruku — Product Engineer" and "unmacos — Shrujan Cheruku" both fit that pattern.
2. **Role and skill terms do not help the name query.** Google says to use "the words that a user might search for" and warns against keyword stuffing. Its own bad example, "Band Name - See videos, lyrics, posters, albums, reviews and concerts", is the same shape as a title that lists skills after a name **[doc]**. A role term does three jobs **[inferred]**: it tells a namesake apart, it gives the reader a reason to click, and it matches "Shrujan Cheruku engineer"-style queries. One role phrase in the home title is enough. Skills belong in visible text and in the description as a sentence.
3. **Meta descriptions do not affect ranking. They are a snippet candidate** that Google uses only when it describes the page better than the page's own text does **[doc]**. Each one should be unique, a sentence rather than a list of keywords, and may name the author **[doc]**. The snippet is built for each query, so the visible text that names Shrujan matters as much as the description **[doc + inferred]**.
4. **Avoiding title rewrites:** Google uses the HTML `<title>` about 87% of the time **[doc]**. It rewrites titles that are half-empty, out of date, inaccurate, boilerplate, missing a clear main title, or that duplicate the site name **[doc]**. The risk on this site is that every address has the same `h1` (the name), while on `/work/<slug>/` the `h1` is not the visible main title **[inferred]**. Google says to put "the title text in the first visible `<h1>`" **[doc]**.
5. **`Person` properties:** Google's Profile page documentation lists only `name` (required), `alternateName`, `description`, `identifier`, `image`, `sameAs`, `interactionStatistic` and `agentInteractionStatistic` **[doc]**. `jobTitle`, `knowsAbout` and `alumniOf` are valid schema.org, but no Google feature documents them for profiles **[doc: absent]**. Google names `jobTitle` only as the place a job title goes instead of the author's `name` **[doc]**. Add `description`, which is recommended and missing from #63. Consider `image`. Keep `jobTitle`. Add `knowsAbout` only knowing it has no documented effect.
6. **Project pages:** no Google rich result fits. The Software app result requires `aggregateRating` or `review` **[doc]**, which a personal project can't honestly provide. `SoftwareSourceCode` with `codeRepository` is the accurate schema.org type, but no Google feature reads it **[doc]**. What can actually win the project name is wording **[inferred]**: the name as the first visible heading and at the start of the title, text that doesn't copy the README, and links in both directions between the page, the repository and the project site.
7. **Two pages compete on shrujan.dev** for unmacos and rapid-radiology: `/work/<slug>/` and the project site at `/<repo>/` **[repo + inferred]**. issho already has its own domain (`joinissho.com`) **[repo]**. Decide which address each project name should win.

## 1. Titles

### What Google says

From [Influencing title links](https://developers.google.com/search/docs/appearance/title-link) **[doc]**:

- Write titles that are "descriptive and concise". There is no fixed limit, but title links are truncated "to fit the device width".
- "Avoid keyword stuffing." "Avoid repeated or boilerplate text in `<title>` elements." The bad example is a long title in which only one item varies: "Band Name - See videos, lyrics, posters, albums, reviews and concerts".
- "Brand your titles concisely." The home page title "is a reasonable place to include some additional information about your site", for example "ExampleSocialSite, a place for people to meet and mingle". Elsewhere, put just the site name at the beginning or end, set apart with "a hyphen, colon, or pipe".
- Google builds title links from: the `<title>`, the "main visual title shown on the page", heading elements such as `<h1>`, `og:title`, other large and prominent text, other text on the page, anchor text on the page, the text of links that point to the page, and `WebSite` structured data.
- Make the main title "distinctive" and the most prominent text on the page, for example by putting "the title text in the first visible `<h1>` element on the page".

From the [August 2021 title-generation update](https://developers.google.com/search/blog/2021/08/update-to-generating-page-titles) **[doc]**:

- Title links no longer change with the query.
- The new system leans more on visible text, especially "the main visual title or headline shown on a page".
- The examples of bad titles are very long ones, keyword-stuffed ones, and boilerplate ones such as "Home".

From Bing, [How does Bing choose the title for my web page?](https://blogs.bing.com/webmaster/June-2014/How-Does-Bing-Choose-The-Title-For-My-Web-Page/) (June 2014) **[doc, old]**:

- Bing also builds titles from several sources: OpenGraph, prominent text and anchor text.
- It truncates long titles, and it may move the site name to the front.
- Its advice: match the words people search with, don't be long or repetitive, avoid generic titles such as "Home", and keep OpenGraph consistent with the title.
- Bing's current [Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a) page renders only with JavaScript and could not be read for this ticket **[gap]**. Third-party rule-checkers cite a 65-character title limit, which Bing apparently stopped documenting in 2023 **[secondary]** ([PowerMapper](https://www.powermapper.com/products/sortsite/rules/seobingtitlelength)).

### Length

- Neither Google nor Bing (as far as could be read) gives a character limit **[doc]**. The common figure of 50–60 characters, or about 600 px on desktop, comes from SEO tools, not search engines **[secondary]**.
- **Working rule [inferred]:** put the part that must survive truncation first, and keep each title under about 60 characters. Then the truncation question never comes up.

### Patterns for this site

Today the pattern is `<Place> — Shrujan Cheruku`, and the home page is "Shrujan Cheruku — Product Engineer" (`src/lib/addresses.ts`) **[repo]**.

| Address | Pattern that fits the docs | Why |
|---|---|---|
| `/` | `Shrujan Cheruku — <one role phrase>` | Name first for the name query. The home page is where extra description belongs **[doc]**. One phrase, not a list **[doc: stuffing]**. |
| `/work/<slug>/` | `<project> — Shrujan Cheruku`, or `<project>: <what it is> — Shrujan Cheruku` | Project name first for the project query. The descriptor helps a short or ambiguous name (issho, orca-flow) **[inferred]**. |
| `/work/`, `/timeline/`, `/now/`, `/contact/` | `<page> — Shrujan Cheruku` | The site name at the end with a delimiter **[doc]**. |
| `/resume/` | `Resume — Shrujan Cheruku` | Brings the en-dash title (prior research) into the same pattern **[inferred]**. |

- **Site-name duplication:** for a domain-level site name, Google "may omit the site name from the title link" when it repeats the site name shown above the result **[doc]**. Once Google adopts "Shrujan Cheruku" as the site name (from `WebSite`), a sub-page's title link may read just "unmacos" or "Timeline". That is harmless and expected **[inferred]**.
- **Place names must match visible content.** Google rewrites "inaccurate" titles **[doc]**. `/now/` is titled "Sabbatical", so its title should say what the page shows. If the copy rewrite renames that window, the title changes with it **[inferred]**.
- **`og:title`** is a title-link source **[doc]**. Keep it identical to `<title>`, or leave it out **[inferred]**.

## 2. Role and skill terms

- Google: "Think about the words that a user might search for to find a piece of your content", and "don't worry if you don't anticipate every variation". Also: "Excessively repeating the same words … is tiring for users", and "keyword stuffing is against Google's spam policies" **[doc]** ([SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)).
- The meta keywords tag is not used **[doc]** ([SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide); [2009 blog](https://developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag)).
- **What role terms do for a name site [inferred]:**
  - They don't make the page rank higher for "Shrujan Cheruku". The name already matches exactly.
  - They tell him apart from a namesake in the result, and they help the reader pick the right result.
  - They let the page match longer queries such as "Shrujan Cheruku product engineer" or "Shrujan Cheruku AI".
  - They make the title link and snippet say what the hiring reader needs.
- **Where each term goes [inferred from the docs above]:**
  - The home `<title>`: one role phrase.
  - The home meta description: the role plus two or three skill or domain terms, written as a sentence.
  - Visible text: the skills window and the about text, which the snippet system can quote.
  - `Person.jobTitle`.
  - Optionally `knowsAbout`, with no documented Google effect (section 5).
- **A list of skills in any title is the "Band Name - See videos, lyrics…" anti-pattern** **[doc]**.

## 3. Meta descriptions and snippets

From [Control your snippets](https://developers.google.com/search/docs/appearance/snippet) **[doc]**:

- "Snippets are primarily created from the page content itself." Google "sometimes uses the meta description … if it might give users a more accurate description of the page". Snippets emphasise the part of the page "that best relates to a user's specific search".
- Make every description unique. A site-level description is fine for the home page and for aggregation pages.
- "Avoid" long strings of keywords, which are "less likely to be displayed as a snippet".
- Include "information like the author" where relevant.
- "There's no limit on how long a meta description can be", but snippets are truncated to the device width. Third-party tools put the practical display at about 150–160 characters **[secondary]**.
- `data-nosnippet` on an element keeps its text out of snippets.

Descriptions are not a ranking signal: "we still don't use the description meta tag in our ranking" **[doc]** ([2009 blog](https://developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag)).

**For this site:**

- Every description in #63 names Shrujan Cheruku and is unique. That matches the "author" advice **[doc]**. Only the wording is open, and the map's positioning work owns it.
- **Keep the description accurate to the visible page.** Google uses it only when it is the better summary **[doc]**. A home description that claims seniority or availability that the visible page doesn't show is more likely to be replaced by page text **[inferred]**.
- **Put `data-nosnippet` on the status bar.** Without JavaScript, the status bar was once the only visible text (workspace numbers, key hints, theme names) **[prior research]**. The site now renders each place without JavaScript, but the status bar is still the first text in the document. With `data-nosnippet`, Google can never quote "1 2 3 … hjkl … issho-light" as a snippet **[doc for the attribute; inferred for the risk]**.
- **Project descriptions:** today each one is just the project's pitch (`addresses.ts`) **[repo]**. #63 adds "— a project by Shrujan Cheruku". Starting with the project name makes the snippet bold the match for a project-name query, because Google highlights the query's words **[inferred]**. For example: "unmacos: a keyboard-first desktop for macOS … Built by Shrujan Cheruku."
- **Under about 155 characters,** so the end is not cut off **[secondary]**.

## 4. Headings and the one `h1` on every address

- Google: heading order "doesn't matter" for Search, and "there's no magical, ideal amount of headings" **[doc]** ([SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)). Several `h1`s or a repeated `h1` are not a documented problem for ranking. John Mueller has said several times that multiple `h1`s are fine **[secondary]** ([Search Engine Land, 2019](https://searchengineland.com/multiple-h1s-wont-get-in-the-way-of-your-seo-google-says-322909)). No Google source talks about the *same* `h1` on every page. An SEO tool vendor calls template-repeated `h1`s "not a serious problem" **[secondary]** ([Sistrix](https://www.sistrix.com/?p=106009)).
- **Where it does matter is the title link.** Google builds it partly from the "main visual title" and the `<h1>`. A rewrite happens when there is "no clear main title" ("more than one large, prominent heading"), and the advice is to put the title text in the "first visible `<h1>`" **[doc]** ([Title links](https://developers.google.com/search/docs/appearance/title-link)).
- **The case on this site [repo + inferred]:**
  - On `/`, `/contact/` and the 404, the name window is on screen, so the visible `h1` "Shrujan Cheruku" matches the title. Good.
  - On `/work/<slug>/`, `/timeline/` and `/now/`, the name window isn't shown (prior research: with JavaScript on, the `h1` is visible only on `/`, `/contact/` and the 404). The `h1` is the person's name, the `<title>` leads with the project, and the visible headings are window labels (`h2`s, per #63).
  - Google's documented preference is for the title text to appear as the first visible `h1`. The page doesn't meet that, so Google may build the title link from other prominent text **[inferred]**.
  - The likely result is still close to the `<title>`, because it is used about 87% of the time **[doc]**. The evidence that this hurts ranking for the project name is weak. It is an exposure to rewrites, not a known penalty.
- **Options, cheapest first [inferred]:**
  1. Keep the name as the `h1` everywhere (#63). On `/work/<slug>/`, make the project name the most prominent visible text: a large `h2` that is the window label, as the first heading after the `h1` in the document. This is the minimum.
  2. On `/work/<slug>/` only, make the project name the `h1`, and turn the name window's heading into something other than an `h1` there. That matches Google's "title text in the first visible `<h1>`" exactly. It reopens a #63 decision, so it would need a ticket.
- `/timeline/`, `/now/` and `/work/` have no competing name to rank for, so option 1 is enough there **[inferred]**.

## 5. `Person` and `ProfilePage`: which properties Google uses

From [Profile page structured data](https://developers.google.com/search/docs/appearance/structured-data/profile-page) **[doc]**:

| Level | Required | Recommended |
|---|---|---|
| `ProfilePage` | `mainEntity` | `dateCreated`, `dateModified` |
| `Person` (`mainEntity`) | `name` (or `alternateName`) | `alternateName`, `description`, `identifier`, `image`, `sameAs`, `interactionStatistic`, `agentInteractionStatistic` |

- The page's stated purpose is about creators in online communities, including "Discussions and Forums". It describes no visible result for a personal home page **[doc]**. Its value here is entity understanding, as the earlier research found **[inferred]**.
- **`jobTitle`:** not listed for ProfilePage **[doc: absent]**. Google's [Article author best practices](https://developers.google.com/search/docs/appearance/structured-data/article) say to keep the job title out of `author.name` and use `jobTitle` for it. So Google knows the property, but no feature that reads it is documented **[doc]**. It costs nothing, so keep it, and keep it identical to the visible role **[inferred]**.
- **`knowsAbout`:** schema.org defines it as "a topic that is known about - suggesting possible expertise but not implying it" (Text, Thing or URL) **[doc]** ([schema.org/Person](https://schema.org/Person)). No Google page mentions it **[doc: absent]**. Google says other schema.org properties "may be useful for other search engines, services, tools, and platforms" **[doc]** ([Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)). Optional. Use only topics the visible page supports (next bullet).
- **The visibility rule:** "Don't mark up content that is not visible to readers of the page", and markup "must be a true representation of the page content" **[doc]** ([General structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)). `jobTitle`, `knowsAbout` and `description` should repeat text the home page shows **[inferred]**.
- **`description`:** recommended by Google and missing from #63's JSON-LD. Add it with the same positioning sentence the home page shows **[doc + inferred]**.
- **`image`:** recommended, but #63 left it out. A real photo would help the profile markup and any later knowledge-panel claim, but nothing documents a ranking effect **[inferred]**. Treat it as the founder's call.
- **`hasOccupation`** (an `Occupation`, with past roles as `Role`) is the richer schema.org form **[doc]**. No Google feature uses it **[doc: absent]**. Skip it.
- **"Fewer but complete and accurate"** properties are better than many incomplete ones **[doc]** ([Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)).
- Structured data doesn't guarantee a feature, and markup alone doesn't change web ranking **[doc]** ([General guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)). The ranking work is still the title, the visible text and the links.

## 6. Project pages, beside their GitHub repositories

### What the projects look like today [repo, `gh repo view`]

| Project | GitHub description | Homepage field | Other address on shrujan.dev after the switch |
|---|---|---|---|
| unmacos | "A keyboard-first desktop for macOS: Rift tiling windows, SketchyBar…" plus 17 topics | `shrujancheruku.github.io/unmacos/` | `/unmacos/` (its own site) |
| orca-flow | "Matt Pocock's skills on Orca: implement-spec with Orca workers…" | empty | none |
| issho | "Find your people through the things you already love…" | `https://joinissho.com` | none (its own domain) |
| rapid-radiology | "Turn a radiologist's shorthand findings into a finished report…" | `shrujancheruku.github.io/rapid-radiology/` | `/rapid-radiology/` (demo site) |

### Markup

- **Software app (`SoftwareApplication`)** is the only software rich result. It requires `name`, plus "one of" `aggregateRating` or `review`, and `offers.price` (0 for free) **[doc]** ([Software app](https://developers.google.com/search/docs/appearance/structured-data/software-app)). No honest rating exists for these projects, so the rich result is out of reach. Markup with a made-up rating would break the guidelines **[inferred from doc]**.
- **`SoftwareSourceCode`** (Thing > CreativeWork) is the accurate schema.org type. It has `codeRepository`, `programmingLanguage`, `runtimePlatform` and `targetProduct`, and it inherits `name`, `description`, `url`, `author`, `license` and `sameAs` **[doc]** ([schema.org/SoftwareSourceCode](https://schema.org/SoftwareSourceCode)).
- **No Google feature reads it:** the Search gallery has no Person, SoftwareSourceCode or generic CreativeWork feature **[doc]** ([Search gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery)).
- **Optional shape [inferred]:** one block on `/work/<slug>/`.
  - `WebPage`, with `about` set to a `SoftwareSourceCode`.
  - The `SoftwareSourceCode` carries `name`, `description` (the visible pitch), `codeRepository` (the GitHub URL), `url` (the project site, if there is one), `programmingLanguage`, and `author: {"@id": "<site>/#person"}`.
  - The value is tying the project to the person and to the repository, for any consumer that reads it. It has no documented Google effect.
  - It reopens #63's "JSON-LD on `/` only" decision.
- `BreadcrumbList` is a supported Google feature **[doc: gallery]**. It isn't researched here, and its visibility in current results is not checked **[gap]**.

### Wording that can win the project name

The levers are all **[inferred]** from the title, snippet, link and canonical docs:

1. **The project name starts the `<title>`** and is the most prominent visible heading (section 4).
2. **The page doesn't copy the README or the GitHub description.** Google groups pages "with the same or very similar primary content" and picks one to show **[doc]** ([Canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization)). That page describes clusters within one site and says nothing about clusters across domains **[doc: absent]**, so the evidence here is weak. But a page that repeats the repository's text gives Google no reason to show both. Write what the repository doesn't say: the problem, what Shrujan did, and the outcome.
3. **Links both ways:**
   - The page links to the repository and the live site, with the project name as anchor text. Don't use `nofollow` on your own repository: Google says to use `nofollow` only for sources you don't trust **[doc]** ([Link best practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)).
   - The repository's homepage field and README link back. "Text within links that point to the page" is a title-link source **[doc]**, and links are how Google finds and weighs pages **[doc]**.
4. **The repository stays the likely first result** for a bare project name on GitHub's authority; the realistic aim is a second result beside it, under the site name "Shrujan Cheruku" **[inferred]**.

### Two shrujan.dev addresses per project [inferred]

- For unmacos and rapid-radiology, `/work/<slug>/` (the case study) and `/<repo>/` (the product site or demo) both sit on shrujan.dev and are both about the project.
- They are different content, so a canonical between them is wrong. Google treats `rel="canonical"` as a signal for duplicates **[doc]** ([Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)).
- Decide which one should win the bare project name. The natural split:
  - `/<repo>/` wins "unmacos". It is the product, and the GitHub homepage field points there.
  - `/work/unmacos/` wins "unmacos Shrujan Cheruku" and the hiring reader.
  - Each links to the other.
- This affects the project-site repositories' own titles. Those are out of this repo's scope.

### Project names with collisions [inferred]

- **issho** is a common Japanese word ("together"), and the product has its own domain, `joinissho.com`. The portfolio page should not try to outrank joinissho.com for "issho". It should target "issho Shrujan Cheruku" and link to joinissho.com.
- **orca-flow** is built on Orca, a product with a similar name. Its title benefits from a descriptor, for example "orca-flow: issues to merged PRs on Orca — Shrujan Cheruku". The repository's homepage field is empty, so the portfolio page could become its homepage.
- **unmacos** and **rapid-radiology** are distinctive, exact-match names. The name alone in the title is enough.

## 7. Site name and sitelinks (additions to the earlier research)

- Beyond `WebSite`, the site-name system reads `og:site_name`, `<title>`, headings and other home-page text. `alternateName` is "strongly" considered as a fallback. Domain-level site names only **[doc]** ([Site names](https://developers.google.com/search/docs/appearance/site-names)).
  - A `WebSite.alternateName` of "shrujan.dev" is Google's documented fallback, should "Shrujan Cheruku" not be picked **[doc]**. It is cheap insurance **[inferred]**.
- **Sitelinks:** Google generates them from "the link structure of your site". Make titles and headings "informative, relevant, and compact", and make internal anchor text "concise and relevant" **[doc]** ([Sitelinks](https://developers.google.com/search/docs/appearance/sitelinks)).
  - The status-bar links (#63) are the site's main internal links, so their text is the likely sitelink label **[inferred]**. "work", "timeline", "now" and "contact" read better than "1", "2" or "3". Hold each workspace number and its name in one anchor, or set an `aria-label`/visible text that carries the place name.

## Gaps

- Bing's current Webmaster Guidelines page needs JavaScript and was not read. The Bing points come from a 2014 Bing blog post and from third-party summaries.
- No Google source addresses an identical `h1` on every page, or duplicates across domains (a page and its GitHub README).
- No live search results were observed (the site isn't live at shrujan.dev yet). The claims about which result wins a project name are inference.
- No source documents a Google use of `jobTitle`, `knowsAbout`, `alumniOf` or `SoftwareSourceCode`.
