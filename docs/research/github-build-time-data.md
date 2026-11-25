# What GitHub exposes about each project at build time

Research for issue #2. Checked on 2026-11-25 against GitHub's official docs and the live API, queried with an authenticated `gh` as the repository owner.

Every claim is tagged:

- **[docs]** stated in GitHub's documentation (linked).
- **[observed]** seen in a live API or HTTP response on the date above.
- **[unverified]** not confirmed by either; treat as an assumption.

One caveat applies to the whole file: every live query ran with the owner's user token, not with a workflow's `GITHUB_TOKEN`. Nothing here was run inside GitHub Actions. See [Not verified](#not-verified).

## Summary

- Everything the site needs per repository is available, and one GraphQL request returns all of it for all 25 public repositories at a cost of 2 rate-limit points.
- The social preview is readable only through GraphQL, and it cannot be set through any API. It is uploaded by hand in each repository's settings.
- A repository with no custom social preview still returns an image URL: a generated 1200 x 600 card with the repository name, description, owner avatar and counters. It is not usable as project imagery. `usesCustomOpenGraphImage` tells the two cases apart.
- Rate limits are not a constraint: 1,000 requests or points per hour for `GITHUB_TOKEN`, against a need of 1 to about 45.
- A daily cron is best-effort (it can be delayed, and can be dropped under load) and GitHub disables it after 60 days without repository activity in a public repository.
- A push to another repository can trigger a rebuild, but only with a credential stored in that other repository. `GITHUB_TOKEN` cannot do it.

## The owner's repositories today

[observed] 25 public repositories owned by `shrujancheruku`: 3 forks, 22 non-forks. Leaving out forks and this repository gives 21 archive candidates. Of those 21:

| Field | Repositories that have it |
| --- | --- |
| Description | 5 of 21 |
| Topics | 1 of 21 |
| Homepage URL | 4 of 21 |
| Custom social preview | 1 of 21 (`unmacos`) |
| A README | 15 of 21 |
| Any detected language | 19 of 21 |
| Stars | 0 of 21 (every repository has 0 stars) |

Six repositories are pinned on the profile: `issho`, `orca-flow`, `unmacos`, `look-together`, `claude-orchestrate`, `rapid-radiology`.

The data is sparse. Most archive entries will have a name, a language and a pushed date, and nothing else.

Two oddities worth knowing:

- `gatsby-starter-dimension` is a copied starter but is not flagged as a fork, so "leave out forks" will not remove it.
- `Portfolio` has the same language breakdown, byte for byte, as this repository. It looks like a duplicate of the legacy site.

## Fields per repository

| Data | REST | GraphQL (`Repository`) | Notes |
| --- | --- | --- | --- |
| Description | `description` | `description`, `descriptionHTML`, `shortDescriptionHTML` | `null` when unset. [observed] |
| Topics | `topics` (array, on both the single-repo and the list endpoint) | `repositoryTopics(first: N) { nodes { topic { name } } }` | [observed] |
| Primary language | `language` | `primaryLanguage { name color }` | `null` for a repository with no detected code. GraphQL also gives the language's colour. [observed] |
| Language breakdown | `GET /repos/{owner}/{repo}/languages` (one extra request per repository) | `languages(first: N, orderBy: {field: SIZE, direction: DESC}) { totalSize edges { size node { name color } } }` | Sizes are bytes of code. [observed] |
| Homepage | `homepage` | `homepageUrl` | Unset shows up as either `null` or an empty string `""`. Treat both as missing. [observed] |
| Stars | `stargazers_count` | `stargazerCount` | [observed] |
| Pushed date | `pushed_at` | `pushedAt` | See the caveat below. [observed] |
| Fork, archived, template | `fork`, `archived`, `is_template` | `isFork`, `isArchived`, `isTemplate` | [observed] |
| Pinned status | Not available | `user { pinnedItems(first: 6, types: REPOSITORY) }` | Pinning is a property of the profile, not the repository, and GraphQL-only. [observed] |
| README | `GET /repos/{owner}/{repo}/readme` | `object(expression: "HEAD:README.md") { ... on Blob { text } }` | See below. |
| Social preview | Not available | `openGraphImageUrl`, `usesCustomOpenGraphImage` | The REST repository object has no social preview field. [observed] |

Sources: the REST field list is the live response of `GET /repos/shrujancheruku/orca-flow`; the GraphQL fields were confirmed by schema introspection and by querying them.

### Pushed date caveat

[observed] This repository reports `pushed_at` as `2017-02-08`, although it has recent issues. So `pushed_at` tracks git pushes only, not issue or other activity. Whether a push to a non-default branch moves it is checked in [Not verified](#not-verified).

### README

- [docs] `GET /repos/{owner}/{repo}/readme` "gets the preferred README for a repository". The default response is JSON with base64 content. The media type `application/vnd.github.html+json` returns it rendered to HTML; `application/vnd.github.raw+json` returns the raw file. ([REST: repository contents](https://docs.github.com/en/rest/repos/contents))
- [observed] It returns `404` for a repository without a README. That is 6 of the 21 candidates, so the build must treat 404 as "no README", not as a failure.
- [observed] The rendered HTML keeps relative image paths as written (for example `src="assets/brand/logo.svg"`). Images break unless the build rewrites them to absolute URLs.
- [observed] The GraphQL route needs the exact file name. `HEAD:README.md` returns `null` for a README named anything else. REST finds the README whatever its name, so REST is the safer route if README content is used.
- [docs] The contents API supports all features for files up to 1 MB. The largest README here is 119 KB. [observed]

## Social preview

### Reading it

[observed] Both fields are GraphQL-only. Schema descriptions:

- `openGraphImageUrl`: "The image used to represent this repository in Open Graph data."
- `usesCustomOpenGraphImage`: "Whether this repository has a custom image to use with Open Graph as opposed to being represented by the owner's avatar."

### With a custom image

[observed] `unmacos` returns `usesCustomOpenGraphImage: true` and a URL on `repository-images.githubusercontent.com`. Fetching it returns the uploaded file itself: `200`, `image/png`, 1280 x 640, 357 KB.

### Without a custom image

[observed] Every other repository returns `usesCustomOpenGraphImage: false` and a URL of the form:

```
https://opengraph.githubassets.com/<64-hex-digit hash>/shrujancheruku/<repo>
```

Fetching it returns `200`, `image/png`, 1200 x 600: a generated card on a white background showing `owner/` and the repository name, the description (truncated; blank if there is none), the owner's avatar, counters for contributors, issues, stars and forks, and a language-colour bar along the bottom edge.

It is never an error and never empty, so the URL alone does not say whether a repository has imagery. `usesCustomOpenGraphImage` is the only reliable signal.

Other observed behaviour of the generated card:

- The hash segment is not validated. Replacing it with `1` returned a byte-identical image.
- The hash was the same across two queries a few seconds apart. Whether it changes when the repository's description or counters change is unverified.
- The response carries `cache-control: public, max-age=21600, immutable` (6 hours).
- The host sends its own rate-limit headers: `x-ratelimit-limit: 100`. The window and what it is keyed on are undocumented. A build that downloads 21 cards stays under it; a page that hot-links them from visitors' browsers is each visitor's own budget.

### Setting it

It cannot be set through an API.

- [docs] The only documented method is by hand: repository **Settings**, then **Social preview**, **Edit**, **Upload an image**. The image should be PNG, JPG or GIF under 1 MB, at least 640 x 320, and 1280 x 640 for best display. ([Customizing your repository's social media preview](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview))
- [docs] `PATCH /repos/{owner}/{repo}` has no social preview or Open Graph parameter. ([REST: repositories](https://docs.github.com/en/rest/repos/repos))
- [observed] The GraphQL schema has no mutation whose name mentions Open Graph, social, preview or image, and `UpdateRepositoryInput` has no such field. Its fields are: `repositoryId`, `name`, `description`, `template`, `homepageUrl`, and feature toggles.

Consequence: a social preview per project is a manual upload per repository, with 20 still to do. Imagery kept in a repository file (or in this site's own repository) can be automated; social previews cannot.

## Rate limits

| Limit | Value | Source |
| --- | --- | --- |
| REST, `GITHUB_TOKEN` | 1,000 requests per hour per repository | [docs] [REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) |
| GraphQL, `GITHUB_TOKEN` | 1,000 points per hour per repository | [docs] [GraphQL rate limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api) |
| REST or GraphQL, user token | 5,000 per hour | [docs], [observed] |
| REST, no token | 60 requests per hour per IP | [docs], [observed] |
| GraphQL, no token | 0 (GraphQL always needs a token) | [observed] |
| Secondary: concurrency | 100 concurrent requests, shared by REST and GraphQL | [docs] |
| Secondary: per minute | 900 points for REST, 2,000 points for GraphQL | [docs] |
| GraphQL request timeout | 10 seconds | [docs] |

What a build for about 25 repositories costs:

- **GraphQL.** [observed] One query returning every field in the table above (including languages, topics, social preview and README size) for all 25 repositories, plus the pinned list, reported `cost: 2`. That is 0.2% of the hourly budget.
- **REST.** One list request, plus one `languages` and one `readme` request per repository: about 45 requests, 4.5% of the hourly budget. REST cannot supply the social preview or pinned status at all.

Rate limits do not constrain this design. A build could run every few minutes and stay inside them.

## Scheduled workflows

All [docs], from [Events that trigger workflows: schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) and [Disabling and enabling a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows):

- **Delays.** "The `schedule` event can be delayed during periods of high loads of GitHub Actions workflow runs. High load times include the start of every hour."
- **Dropped runs.** "If the load is sufficiently high enough, some queued jobs may be dropped."
- **Mitigation.** "To decrease the chance of delay, schedule your workflow to run at a different time of the hour." Use a minute such as `17`, not `0`.
- **Branch.** "Scheduled workflows will only run on the default branch", on its latest commit. Here that is `master`.
- **Inactivity.** "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days."
- **Re-enabling.** In the Actions tab, with `gh workflow enable <workflow>`, or with `PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/enable`. A disabled workflow reports `state: disabled_inactivity`.

So a daily cron is good enough for "the site is at most about a day stale", but there is no guarantee that any single run happens or happens on time. There is no documented delivery guarantee or retry.

### The 60-day rule and this site

This site reads other repositories. Work on those repositories is not activity in this one. If the site's own repository gets no commits for 60 days, the daily rebuild stops, silently, and the site freezes on its last build.

What keeps it alive:

- **A commit to this repository at least every 60 days.** This is the one thing the docs wording clearly covers.
- **Re-enabling the workflow** after it is disabled, by hand or through the API above.
- [unverified] The docs do not define "repository activity". Whether a scheduled run, a `repository_dispatch` run, an issue, or a Pages deployment counts is not stated. Community workarounds (a workflow that re-enables itself through the API, or one that pushes an empty commit on a timer) are widely used, but none is documented by GitHub and none was tested here.
- [unverified] GitHub is reported to send an email warning before disabling. Not confirmed in the docs read for this ticket.

## Rebuilding on a push to another repository

It is possible, and it needs a credential.

### How

Two events can start a workflow in this repository from outside it:

| Event | Endpoint | Fine-grained token permission on this repository |
| --- | --- | --- |
| `repository_dispatch` | `POST /repos/{owner}/{repo}/dispatches` | Contents: write |
| `workflow_dispatch` | `POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches` | Actions: write |

Sources: [docs] [Permissions required for fine-grained personal access tokens](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens). A classic personal access token needs the `repo` scope for either. ([REST: repositories](https://docs.github.com/en/rest/repos/repos), [REST: workflows](https://docs.github.com/en/rest/actions/workflows))

`workflow_dispatch` is the narrower grant: Actions: write cannot change the repository's files, Contents: write can.

[docs] Both events only start a workflow whose file is on the default branch. `event_type` is at most 100 characters; `client_payload` has at most 10 top-level properties.

### What it requires

- [docs] **Not `GITHUB_TOKEN`.** "The token's permissions are limited to the repository that contains your workflow." A workflow in another repository cannot call this repository's dispatch endpoint with its own token. ([GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token))
- [docs] **A personal access token or a GitHub App.** GitHub's guidance is to "create a GitHub App and generate an installation access token within your workflow", or to "create a personal access token, store it as a secret in your repository, and use the token in your workflow". ([Use GITHUB_TOKEN for authentication in workflows](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token))
- **A workflow in every source repository** that fires on push and calls the endpoint, and the secret stored in every source repository. That is about 21 workflow files and 21 secrets today, plus one of each for every new repository.
- [unverified] Personal accounts have no shared secrets across repositories (organization-level secrets belong to organizations), so the secret would be set repository by repository. Not checked against the docs for this ticket.
- [unverified] Fine-grained tokens expire, and an expired token makes the trigger fail silently in the source repository. The maximum lifetime was not checked.

### What it buys

The daily cron already picks up changes in other repositories within about a day. The cross-repository trigger only shortens that delay, at the price of a credential and a workflow in every repository, and a brand-new repository has neither until someone adds them. A new repository therefore always appears through the cron, never through the trigger.

A push to this repository itself needs none of this: `on: push` works with no extra credential.

## Not verified

1. **`GITHUB_TOKEN` reading the owner's other repositories.** Every query here used the owner's user token. A workflow's `GITHUB_TOKEN` is scoped to its own repository; reading other *public* repositories, `user.pinnedItems`, `openGraphImageUrl` and `usesCustomOpenGraphImage` with it is expected to work because the data is public, but it was not run inside a workflow. This is the assumption the whole build-time design rests on, and a five-minute throwaway workflow would settle it.
2. **What counts as "repository activity"** for the 60-day rule, and whether any keep-alive other than a real commit works.
3. **Whether the generated card's hash changes** when the repository changes, and so whether a stored URL goes stale. The hash is not validated, so a stale URL still returns an image.
4. **The `opengraph.githubassets.com` rate limit** beyond the header value of 100: its window and its key.
5. **Fine-grained token lifetime** and **per-repository secrets on a personal account**, both in the cross-repository section.
6. **How late or how often a daily cron is dropped in practice.** GitHub publishes no figures.
7. **Whether `pushed_at` moves on a push to a non-default branch.** Checked when this file was pushed; see the resolution comment on issue #2.
