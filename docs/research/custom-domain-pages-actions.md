# Custom domain `shrujan.dev` on GitHub Pages with an Actions deploy

Research for issue #54. Gathered 2026-11-26. Nothing was changed: no GitHub setting, no DNS record, no Pages config. Every live observation is a read-only `gh api` call, `dig` lookup or HTTP HEAD/GET.

It builds on [`pages-deploy-coexistence.md`](https://github.com/shrujancheruku/shrujancheruku.github.io/blob/research/pages-deploy-coexistence/docs/research/pages-deploy-coexistence.md) (branch `research/pages-deploy-coexistence`, issue #3), which covers the Actions workflow, the legacy site and the path collision check. That ground is not repeated here.

Each claim is tagged with where it comes from:

- **[doc]** GitHub Docs, the GitHub changelog, the Porkbun knowledge base, hstspreload.org or the Chromium preload list.
- **[api]** the live GitHub REST API for this account.
- **[dns]** a live `dig` answer.
- **[http]** a live HTTP response.
- **[repo]** this repo's code on `integration/portfolio-site`.
- **[inferred]** reasoned from the above, not documented anywhere I read.

## Summary

1. **Order:** verify `shrujan.dev` on the account first (one TXT record). Then replace Porkbun's parking records with GitHub's 4 A, 4 AAAA and a `www` CNAME. Then set the custom domain on this repo (Settings > Pages, or `PUT /repos/{owner}/{repo}/pages` with `cname`). Then turn on Enforce HTTPS once the certificate is issued. A `CNAME` file does nothing with an Actions deploy.
2. **Redirects:** with apex as the custom domain and `www` pointing at `shrujancheruku.github.io`, GitHub redirects `www` to the apex. GitHub's docs do not say that `shrujancheruku.github.io` redirects to the custom domain. Live sites on other accounts show it does: a 301 that keeps the path and query. Project sites without their own domain follow it to `shrujan.dev/<repo>/`.
3. **HTTPS gap:** because of `.dev` HSTS preloading, browsers will only use HTTPS for `shrujan.dev` and `www.shrujan.dev`, and a certificate error cannot be clicked through. Until GitHub's Let's Encrypt certificate is issued ("up to an hour"), visitors who follow the new redirect get an error page. That is the only real downtime. Setting DNS before setting the domain makes it as short as possible.
4. **Code:** `site` in `astro.config.mjs`, the resume's "Site" contact (text and href), the resume page's back-link text, the unit and e2e tests that assert those strings, and the `unmacos` project's `live:` URL. The collision check stays as it is. Share cards (#48) are not built yet, so they have nothing to change. They only need to take their absolute URLs from `site`.
5. **Other sites:** `aidan-landing-page` keeps `aidanbelizaire.com`. The three live project sites use repo-prefixed or relative paths, so they keep working under `shrujan.dev/<repo>/`. The five legacy project sites already return 404 and still will.

## 1. Setting the domain with an Actions deploy

- With a custom Actions workflow, "no `CNAME` file is created, and any existing `CNAME` file is ignored and is not required." The domain is set under Settings > Pages > Custom domain > Save. **[doc]** [Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) The [troubleshooting page](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages) says the same.
- API: `PUT /repos/{owner}/{repo}/pages` takes `cname` (string, or `null` to remove it) and `https_enforced` (boolean). `GET` returns `cname`, `protected_domain_state` (`pending`/`verified`/`unverified`), `pending_domain_unverified_at` and `https_certificate.state` (`new` … `approved`, `errored`, `bad_authz`, `dns_changed`, among others). `GET /repos/{owner}/{repo}/pages/health` runs a DNS/HTTPS health check: it returns 202 first, then 200 with results. **[doc]** [REST: Pages](https://docs.github.com/en/rest/pages/pages)
- Equivalent CLI (for the decision ticket; **not run**): `gh api -X PUT repos/shrujancheruku/shrujancheruku.github.io/pages -f cname=shrujan.dev`, then later `-F https_enforced=true`. **[inferred]** from the REST parameters.
- The integration branch has no `public/CNAME`, and none is needed. **[repo]**
- Today this repo is `build_type: legacy`, `cname: null`, `https_enforced: true`. **[api]**

### Verifying the domain (takeover protection)

- Verification lives in **Profile** settings > Pages > Add a domain, not in the repository's settings. GitHub shows a TXT record named `_github-pages-challenge-USERNAME.example.com` with a value it generates. Click Verify once DNS has propagated. Check it with `dig _github-pages-challenge-shrujancheruku.shrujan.dev +nostats +nocomments +nocmd TXT`. **[doc]** [Verifying your custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
- Effect: "Verifying your domain stops other GitHub users from taking over your custom domain". Only repos owned by this account can then publish to `shrujan.dev` and its immediate subdomains (so `www` is covered). "keep the TXT record in your domain's DNS configuration" means the record stays permanently. **[doc]** same page.
- "We recommend verifying your custom domain prior to adding it to your repository". Without verification, pointing DNS at GitHub before the domain is claimed "could result in someone else being able to host a site on one of your subdomains." **[doc]** [Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [About custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)
- Wildcard records "put you at an immediate risk of domain takeovers, even if you verify the domain." **[doc]** This matters because Porkbun's parking setup includes a wildcard (see below).

## 2. DNS at Porkbun

### Current records **[dns]** (2026-11-26)

| Name | Answer |
|---|---|
| `shrujan.dev` NS | `curitiba`, `fortaleza`, `maceio`, `salvador` `.ns.porkbun.com` |
| `shrujan.dev` A | `207.207.210.229`, `207.207.210.107` (Porkbun parking) |
| `shrujan.dev` AAAA, TXT, CAA, MX | none |
| `www.shrujan.dev` | CNAME `pixie.porkbun.com` |
| `random123xyz.shrujan.dev` | CNAME `pixie.porkbun.com`, so a wildcard `*` record exists |
| DS | none (no DNSSEC) |

That the apex parking record is an ALIAS to `pixie.porkbun.com` rather than plain A records cannot be told from DNS. Check it in the Porkbun panel. **[inferred]**

### Target records

Delete first: the apex parking record(s), the `*` wildcard CNAME and the `www` CNAME to `pixie.porkbun.com`. GitHub warns that extra A/AAAA/ALIAS/ANAME/CNAME records, or records that do not point at Pages, can block the certificate. It also advises against wildcards. **[doc]** [Securing with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https), [Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

Then add the following. In Porkbun's Host field, blank means the apex. **[doc]** [How to add DNS records on Porkbun](https://kb.porkbun.com/article/231-how-to-add-dns-records-on-porkbun)

| Type | Host (Porkbun) | Answer |
|---|---|---|
| TXT | `_github-pages-challenge-shrujancheruku` | value GitHub shows in Profile > Pages |
| A | *(blank)* | `185.199.108.153` |
| A | *(blank)* | `185.199.109.153` |
| A | *(blank)* | `185.199.110.153` |
| A | *(blank)* | `185.199.111.153` |
| AAAA | *(blank)* | `2606:50c0:8000::153` |
| AAAA | *(blank)* | `2606:50c0:8001::153` |
| AAAA | *(blank)* | `2606:50c0:8002::153` |
| AAAA | *(blank)* | `2606:50c0:8003::153` |
| CNAME | `www` | `shrujancheruku.github.io` |

- IPs and the `www` rule ("points directly to `<user>.github.io` … without including the repository name") come from **[doc]** [Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site). GitHub recommends "using an `A` record in addition to your `AAAA` record". **[doc]**
- No CAA record exists, so any CA may issue. If one is ever added, "at least one CAA record must exist with the value `letsencrypt.org`". **[doc]** [Troubleshooting](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages)
- The `www` CNAME must point at `shrujancheruku.github.io`, not at the apex. Observed: `codeguide.co`'s `www` CNAMEs to its apex, and its certificate covers only `codeguide.co`. `https://www.codeguide.co/` fails with a name mismatch against the `*.github.io` certificate. **[http]** **[dns]** Under `.dev` HSTS, that mistake would make `www.shrujan.dev` unreachable.

### Porkbun ALIAS: an option, not the recommendation

- GitHub accepts an ALIAS/ANAME at the apex pointing to the default domain (`shrujancheruku.github.io`), "or alternatively add only the `ALIAS`/`ANAME` record". **[doc]** [Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- Porkbun supports it as "ALIAS - CNAME flattening" with a blank host. "ALIAS records only pass through A and AAAA records", so they can sit next to the TXT record at the apex. **[doc]** [Porkbun: root domain without an IP](https://kb.porkbun.com/article/85-how-to-connect-your-root-domain-when-your-web-host-wont-provide-an-ip-address), [Porkbun: adding DNS records](https://kb.porkbun.com/article/231-how-to-add-dns-records-on-porkbun)
- Recommendation: use the 8 explicit A/AAAA records. GitHub publishes them, they work without Porkbun's flattening resolver, and they are what the GitHub health check expects. **[inferred]** Use either the ALIAS or the A/AAAA records at the apex, never both, because extra apex records can block the certificate. **[doc]**
- Porkbun's Quick DNS Config has a "Github" button that "reconfigure[s] your domain's DNS records" and then asks for a subdomain CNAME. The KB article does not list the records it writes or say whether it deletes the wildcard. **[doc]** [Porkbun: connect to GitHub Pages](https://kb.porkbun.com/article/64-how-to-connect-your-domain-to-github-pages) If it is used, compare the result against the table above.

## 3. HTTPS and the `.dev` HSTS preload

- `.dev` is preloaded as a whole TLD: Chromium's list has `{ "name": "dev", "policy": "public-suffix", "mode": "force-https", "include_subdomains": true }`. **[doc]** [transport_security_state_static.json](https://chromium.googlesource.com/chromium/src/+/main/net/http/transport_security_state_static.json). [hstspreload.org status API](https://hstspreload.org/api/v2/status?domain=dev) reports `"status": "preloaded"`. "Other major browsers (Firefox, Safari, IE 11 and Edge) also have HSTS preload lists based on the Chrome list." **[doc]** [hstspreload.org](https://hstspreload.org/)
- Consequences **[inferred]** from how HSTS works:
  - Browsers never request `http://shrujan.dev`. Port 80 and GitHub's HTTP redirects only matter to non-browser clients.
  - Under HSTS a certificate error cannot be clicked through. So between pointing traffic at `shrujan.dev` and the certificate being issued, browsers show a hard error.
  - The Enforce HTTPS setting changes nothing for browsers. Turn it on anyway, for curl and bots.
- Issuance: after the domain is saved and the DNS check passes, GitHub "queues a job to request a TLS certificate from" Let's Encrypt. "It can take up to an hour for your site to become available over HTTPS." If nothing happens after several minutes, Remove the domain and Save it again to restart provisioning. **[doc]** [Securing with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https), [Troubleshooting](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages)
- Apex plus `www`: GitHub requests "a certificate for both the Apex and `www` subdomain" when DNS for both is set up correctly. **[doc]** [Changelog 2021-04-08](https://github.blog/changelog/2021-04-08-github-pages-can-now-automatically-secure-the-www-variant-of-your-custom-domain) So the `www` CNAME must already be in place when the domain is saved. If `www` is added later, Remove and re-Save the domain to get it onto the certificate. **[inferred]** from the changelog and the "remove and re-add" advice.
- Watch progress through `https_certificate.state` (wait for `approved`) and `/pages/health` (`responds_to_https`). **[doc]** [REST: Pages](https://docs.github.com/en/rest/pages/pages)

## 4. Project sites

### What the docs say

- "If you set a custom domain for a user or organization site, by default, the same custom domain will be used for all project sites owned by the same account", e.g. `www.octocat.com/octo-project`. A repo can override this with its own custom domain. **[doc]** [About custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)
- GitHub's docs do **not** say whether `<user>.github.io` URLs redirect to the custom domain.

### What live sites show **[http]**

- User site with a custom domain: `https://jlord.github.io/` gives a 301 to `http://jlord.computer/`.
- A project site under it: `https://jlord.github.io/patchwork/some/deep?x=1` gives a 301 to `http://jlord.computer/patchwork/some/deep?x=1`. The path and query are kept. (`http://` there because that site does not enforce HTTPS.)
- A project site with its own domain: `https://shrujancheruku.github.io/aidan-landing-page/` gives a 301 to `https://aidanbelizaire.com/` on this account today. `https://mdo.github.io/code-guide/` gives a 301 to `https://codeguide.co/`.
- GitHub's 301s send no `Cache-Control` or `Expires`. Browsers may cache a permanent redirect for a long time, which matters for undoing the change (section 6). **[http]** **[inferred]**

So after cut-over **[inferred]** from the above: `shrujancheruku.github.io/<path>` gives a 301 to `shrujan.dev/<path>`, and `shrujancheruku.github.io/<repo>/…` gives a 301 to `shrujan.dev/<repo>/…`.

### This account's Pages repos **[api]** **[http]**

| Repo | build_type | cname | Live now | After cut-over |
|---|---|---|---|---|
| aidan-landing-page | workflow | `aidanbelizaire.com` (`protected_domain_state: unverified`) | 301 to aidanbelizaire.com (Cloudflare-proxied) | Unchanged: own domain overrides. **[doc]** |
| GameResume | legacy | — | 404 | still 404 |
| Interactive-Graphics | legacy | — | 404 | still 404 |
| ISB_TEP-LMS_Portal | legacy | — | 404 | still 404 |
| issho | workflow | — | 404 (no Pages workflow in the repo) | still 404 |
| Portfolio | legacy | — | 404 | still 404 |
| rapid-radiology | workflow | — | 200 | `shrujan.dev/rapid-radiology/` |
| Sineflex-Website | legacy | — | 200 | `shrujan.dev/Sineflex-Website/` |
| unmacos | workflow | — | 200 | `shrujan.dev/unmacos/` |

The four legacy 404s are already listed as unexplained in the coexistence research.

### Absolute paths in the live project sites **[http]**

- **rapid-radiology:** path-absolute with the repo prefix (`/rapid-radiology/assets/…`, a Vite `base`). This still works, because the prefix is unchanged under `shrujan.dev`.
- **Sineflex-Website:** relative paths only. Works.
- **unmacos:** relative paths for assets and links. Works. But `og:url`, `og:image` and a link hard-code `https://shrujancheruku.github.io/unmacos/…`. These keep working through the 301, but they advertise a non-canonical URL, and some share-card scrapers may not follow a redirect for `og:image`. **[inferred]** Fix them in the `unmacos` repo; this repo cannot change them. Its install command uses `raw.githubusercontent.com`, so it is unaffected.
- What would break, in general **[inferred]**: root-absolute paths without the repo prefix (`/assets/x.js`). Those already break on `github.io/<repo>/`, so nothing new breaks. Full `http://` URLs (not `https://`) to `*.github.io` would only add a redirect hop. None were found in the three live sites.

## 5. Code changes in this repo (`integration/portfolio-site`) **[repo]**

| Where | Today | Change |
|---|---|---|
| `astro.config.mjs` | `site: "https://shrujancheruku.github.io"` | `site: "https://shrujan.dev"` |
| `src/lib/resume.ts:88-89` | Site contact `shrujancheruku.github.io` / `https://shrujancheruku.github.io/` | `shrujan.dev` / `https://shrujan.dev/` (the printed PDF picks it up on the next build) |
| `src/pages/resume.astro:33` | `← shrujancheruku.github.io` (href is `/`) | `← shrujan.dev` |
| `test/resume.test.ts:96`, `e2e/resume.e2e.ts:67,114,119` | assert `shrujancheruku.github.io` | assert `shrujan.dev` |
| `src/content/projects/unmacos/index.md:3` | `live: https://shrujancheruku.github.io/unmacos/` | `https://shrujan.dev/unmacos/` (or keep; it redirects) |
| Share cards (#48) | no `og:`/`twitter:` tags exist yet (only `meta name="description"`) | build `og:url`/`og:image` from `Astro.site`, never from a literal, so the switch is one line |

- The collision check (`src/lib/collisions.ts`, `scripts/check-collisions.ts`) needs no change. Project sites still occupy `/<repo>/` on the user site's domain, now `shrujan.dev`. It excludes the repo named `${owner}.github.io`, and that repo name does not change. **[repo]** **[doc]**
- One optional refinement: a repo with its own `cname` (`aidan-landing-page`) probably does not occupy `/aidan-landing-page/` on `shrujan.dev`, but this is undocumented. Treating it as taken, as the check does now, is the safe choice. **[inferred]**
- The only code comment to reword is `src/lib/collisions.ts`, which says "on the same domain as this user site". That stays true.
- The workflow (`.github/workflows/pages.yml`) needs no change. A custom domain is a repo setting, not part of the artifact. **[doc]** `deploy-pages`'s `page_url` output then reports the custom domain. **[inferred]**
- `docs/agents/*` and `flow.json` mention the repo name `shrujancheruku.github.io`, which does not change. Leave them.

## 6. Cut-over and rollback

### Suggested order (after #50 is live on `shrujancheruku.github.io`)

1. Profile > Pages > Add a domain `shrujan.dev`, then add the TXT record at Porkbun and Verify. **No visible effect.**
2. At Porkbun, delete the parking apex record, `*` and `www`. Add the 8 A/AAAA records and the `www` CNAME. **No visible effect:** `shrujan.dev` currently serves nothing on HTTPS, and with no Pages site claiming it, GitHub answers with its own 404. The verified TXT means no other account can claim it in the meantime. **[doc]** **[inferred]**
3. Wait until `dig` returns GitHub's IPs from Porkbun's nameservers and a public resolver.
4. Repo Settings > Pages > Custom domain `shrujan.dev` > Save. **The gap starts here.** `shrujancheruku.github.io` begins redirecting to `shrujan.dev`, and browsers get a certificate error there until the Let's Encrypt certificate is issued. **[inferred]** That GitHub redirects before the certificate exists is not documented. The docs only promise HTTPS "up to an hour" after configuring the domain. **[doc]**
5. Poll `GET …/pages` until `https_certificate.state` is `approved`, then turn on Enforce HTTPS.
6. Check `https://shrujan.dev/`, `https://www.shrujan.dev/` (expect 301 to the apex), `https://shrujancheruku.github.io/` (expect 301), and `https://shrujancheruku.github.io/unmacos/` (expect 301 to `shrujan.dev/unmacos/`).
7. Merge the code changes from section 5. They can also ship before step 4: canonical URLs pointing at `shrujan.dev` while it is still unreachable is harmless for an hour, and shipping them later leaves `github.io` canonicals in place for a while. **[inferred]**

Doing step 2 well before step 4 keeps the gap to certificate issuance alone, because the DNS check passes as soon as the domain is saved. **[inferred]** from "after you set … a DNS check runs".

### Rollback

- Repo Settings > Pages > Custom domain > Remove, or `PUT …/pages` with `cname: null`. `shrujancheruku.github.io` then serves the site directly again. **[doc]**
- Caveat **[inferred]**: browsers that have already seen the 301 (sent without cache headers) may keep sending `github.io` visitors to `shrujan.dev`. Keep the DNS pointing at GitHub during a rollback. Visitors who cached the redirect then land on GitHub's 404 for `shrujan.dev` rather than a parked page, which is still broken. Rollback is not instant for returning visitors, so treat the cut-over as one-way in practice.
- Keep the TXT record after any rollback, so that a leftover DNS record cannot be taken over. Removing the domain while DNS still points at GitHub is exactly the takeover case that verification protects. **[doc]**
- Revert the section 5 commit if `site` must go back.

## Open questions for the decision ticket

1. Is a few minutes to an hour of certificate errors on `shrujancheruku.github.io` acceptable? Or should the cut-over happen at go-live (#50), before the new site has any traffic? If so, can #50 and this switch happen together?
2. Explicit A/AAAA (recommended) or a Porkbun ALIAS at the apex?
3. Should the code changes ship before or after the domain switch? Should `site` be read from `actions/configure-pages`' `base_url` instead of a literal?
4. Should `unmacos`'s hard-coded `github.io` `og:url`/`og:image` be fixed in that repo (separate ticket)?
5. `aidanbelizaire.com` shows `protected_domain_state: unverified` on `aidan-landing-page`. That is a takeover risk if that repo's Pages is ever disabled while the domain still points at GitHub (it is currently proxied through Cloudflare). Whoever owns that domain should verify it, outside this ticket.
6. Keep `www` as a redirect only, or skip it? GitHub recommends having it, and the certificate covers it only if it exists at save time.

## Not verified

- That `<user>.github.io` redirects to the custom domain. This is observed on other accounts, not documented.
- Whether GitHub starts the `github.io` to custom-domain redirect before the certificate is issued, and so whether the gap in step 4 really happens.
- What Porkbun's "Github" Quick DNS Config writes, and whether the current apex parking record is an ALIAS or A records.
- Whether a project site with its own custom domain is also reachable at `shrujan.dev/<repo>/`.
- How long browsers cache GitHub's header-less 301s.
