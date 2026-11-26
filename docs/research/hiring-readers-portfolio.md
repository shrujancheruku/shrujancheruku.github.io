# What hiring readers look for in an engineer's portfolio

Research for issue #119, part of the copy map (#118). Gathered 2026-11-26. Nothing in the site was changed.

**The reader:** a founder or engineering leader hiring a senior, lead or founding product engineer for a remote, full-time role. Recruiters are secondary.

**The question:** what do they look for, in what order and for how long? What persuades them and what puts them off? What do strong first screens say, and how is availability stated? What follows for the first screen, achievement wording, the sabbatical and AI-built side projects?

Each claim carries a tag for how far to trust it:

- **[study]** measured research with a stated method: an eye-tracking study, a field experiment, or a survey with a stated sample.
- **[first-party]** a company or platform describing its own process or data, such as Shopify, Canva or LinkedIn.
- **[practitioner]** a named hiring manager or founder writing from their own experience. Credible, but it is one person's view.
- **[opinion]** commentary, vendor content or forum posts. Treat it as a direction, not as evidence.
- **[inferred]** my reasoning from the sources above. No source says it.

## Summary

1. **There is very little time.** Recruiters' first screen of a resume averages 7.4 seconds **[study, weak method]**. In a better-designed study, the median was 31 seconds **[study]**. On the web, the first 10 seconds decide whether a visitor stays **[study]**. The first screen gets the most viewing time, and the first words of each line are what get read **[study]**. The first screen has to answer three things in about ten seconds: who he is, the level and kind of role, and that he is available.
2. **Readers trust specific, plain claims over slogans.** Objective, non-promotional copy measured 27% more usable than marketing copy. Concise copy measured 58% more usable **[study]**. Hiring managers say the same about resumes: numbers, scope, and what *you* did **[practitioner]**. "I design and build." and "Give me a problem, not a spec." are exactly the subjective claims these sources warn against **[inferred]**.
3. **How an achievement is worded:** the outcome first, then a number or scope, then his specific part in it. Bock's "Accomplished X as measured by Y by doing Z" **[practitioner]**, Orosz's "Accomplished {impact} as measured by {number} by doing {specific contribution}" **[practitioner]**, and Swizec's "What did you do, for whom, what was the impact" **[practitioner]** all say this. Resumes that clearly state what the person did, using verbs like "ship" and "create", did better than ones that list technologies **[study, single company]**.
4. **The career break:** explaining it helps. 51% of hirers say they are more likely to contact a candidate who gives context about a break **[first-party survey]**. The penalty for a *silent* gap grows with its length, and most of the drop comes within the first eight months **[study, US entry-level roles]**. The sabbatical is now about 12 months long, so it needs a short, positive, forward-looking explanation and a clear "back, and looking" signal. Hiding it is not an option **[inferred]**.
5. **AI-built side projects:** large employers now *require* fluent AI use **[first-party: Shopify, Canva]**. What they test is judgement and ownership of the output, not the fact that AI was used **[first-party: Canva]**. Present AI projects as engineering: what he decided, how it was verified, and what shipped. Do not present them as "built with AI" **[inferred from Canva, Willison]**.
6. **Availability:** the evidence is thin. Signalling openness raises recruiter outreach by about 40% on LinkedIn **[first-party]**. Some recruiters say a loud "open to work" reads as desperate **[opinion]**. No source measures availability wording on a personal site. The consensus advice is to lead with the role, then state availability in one short, specific line: role, full-time, remote, and when he can start **[opinion]**.

## 1. Time and order: how the first look works

### Resumes

- **Ladders (2018):** recruiters' "initial screen" averages **7.4 seconds**, up from 6 seconds in 2012. Layouts that held attention were "simple layouts, with clear sections and heading titles". Layouts with "cluttered layouts, a lack of white space on the page, multiple columns and long sentences" did poorly. Resumes laid out for "E- or F-pattern" reading did well **[study]** ([HR Dive summary](https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/); [the report](https://www.bu.edu/com/files/2018/10/TheLadders-EyeTracking-StudyC2.pdf)).
  - **Weak method:** the report does not say how many recruiters took part, how experienced they were, or which roles were involved. A recruiter-press critic calls it "essentially a how-to guide" **[opinion]** ([ERE](https://www.ere.net/articles/is-the-6-second-resume-scan-a-myth)). Use it for the order of reading, not for the exact number of seconds.
- **interviewing.io and Learning Collider:** 76 technical recruiters made about 2,200 evaluations of engineer resumes. The **median time was 31 seconds**: 25 seconds for those advanced to interview and 44 seconds for those rejected. The strongest pull was **experience at a top-tier tech company** (+35% chance of an interview decision). Recruiters' calls were right 55% of the time, "just slightly better than a coin flip" **[study]** ([interviewing.io](https://interviewing.io/blog/are-recruiters-better-than-a-coin-flip-at-judging-resumes)).
  - **What follows** **[inferred]**: with no FAANG name to lean on, the first screen has to carry scope signals that do not need brand recognition, such as "first engineering hire" and "Lead Engineer".
- **Commercial self-report surveys** put screening at 30 to 60 seconds (ResumeGo) or 1 to 3 minutes for tech hiring managers (Resume Genius) **[opinion: vendor surveys]** ([summary of figures](https://resumego.net/research/how-much-time-spend-resume)).

### Web pages

- **The first 10 seconds:** Nielsen: "the first 10 seconds of the page visit are critical", so "communicate your value proposition within 10 seconds". The average page visit is "a little less than a minute". Pages show "negative aging": a visitor who stays past the first seconds is likely to keep going **[study]** ([NN/g, 2011](https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/)).
- **Above the fold:** users spent **about 57% of page-viewing time above the fold**, and 74% in the first two screenfuls. The study covered 120 participants and over 130,000 fixations **[study]** ([NN/g, 2018](https://www.nngroup.com/articles/scrolling-and-attention/)).
- **The F-pattern:** first lines get the most gazes, then readers scan down the left edge. Readers skip lines that start with the same words ("bypassing"). NN/g: "Start subheads, paragraphs, and bullet points with information-carrying words" **[study]** ([NN/g](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/)).
- **Promotional copy:** NN/g's classic web-writing study measured **concise +58%, scannable +47%, objective (no "exaggeration, subjective claims, or boasting") +27%** in usability, against promotional copy **[study, 1997 but often replicated]** ([NN/g](https://www.nngroup.com/articles/concise-scannable-and-objective-how-to-write-for-the-web/)).

### Do hiring readers open portfolios at all?

- **For engineers, it varies.** In an informal survey of 60+ React hiring managers, "the overwhelming majority … look at your website", but few weigh it heavily. Bad design or broken links "can make you look incompetent" **[opinion: informal survey, junior roles]** ([Profy.dev](https://dev.to/profydev/this-survey-among-60-hiring-managers-reveals-don-t-waste-your-time-on-a-react-portfolio-website-17ge)).
- **The Holloway technical-hiring guide** calls public projects "a potentially powerful complement" to LinkedIn. It advises reviewers to look at the site itself for linked projects and for frontend skill **[practitioner]** ([Holloway](https://www.holloway.com/g/technical-recruiting-hiring/sections/linkedin-github-and-personal-websites)).
- **YC's Work at a Startup** advises engineers to "link a GitHub profile, portfolio, or other things that you have actually built" **[first-party, via a talk write-up]** ([Arc.dev on Ryan Choi of YC](https://arc.dev/blog/ycombinator-work-at-a-startup-engineering-job-9x1w1lxl9e)).
- **Design hiring managers** "very rarely … read your entire portfolio word for word". They want "the problem you were trying to solve, your role, any constraints". NN/g surveyed 204 people who hire for UX **[study, adjacent field]** ([NN/g, 2019](https://www.nngroup.com/articles/ux-design-portfolios/)).
- **What follows** **[inferred]**: the site is a second look, usually after a resume, a LinkedIn profile or a referral. The reader arrives to confirm a hunch, so the first screen has to confirm it fast. Depth is for the few who stay.

**Evidence gap:** no eye-tracking or timing study of engineer portfolio *websites*, or of founders as readers, was found. Everything above comes from resumes or general web pages.

## 2. What persuades, and what puts readers off

### Persuades

- **Numbers.** "Most resumes do not contain numbers", so adding them stands out. "Impact and your contribution are more important to convey than the technologies you know." **[practitioner: Gergely Orosz, ex-Uber EM]** ([freeCodeCamp](https://www.freecodecamp.org/news/how-to-write-a-developer-resume-recruiters-will-read/)). In an interview, Orosz says only about 15% of engineer resumes say how many users a thing had **[practitioner]** ([CodingSans](https://codingsans.com/blog/software-engineer-resume)).
- **Scope, not titles.** "What did you do, for whom, what was the impact." Titles are weak signals across companies. Growing scope and promotions are "huge" signals. Business metrics such as ARR and headcount read across companies **[practitioner: Swizec Teller]** ([Swizec](https://swizec.com/blog/put-scope-on-your-resume/)).
- **Clarity about one's own part.** In ~300 candidates at TrialPay, those whose resumes made their contribution clear did better, and strong resumes used action verbs ("manage", "ship", "create") over lists of technologies. Typos were the strongest negative signal: "about 87% of people who got offers made 2 or fewer mistakes" **[study, single company, 2012]** ([Aline Lerner](https://interviewing.io/blog/lessons-from-a-years-worth-of-hiring-data)).
- **Business value.** "Engineers are hired to create business value, not to program things": add revenue, reduce costs. "Anyone describing themselves as either a Java programmer or .NET programmer has already lost." **[practitioner: Patrick McKenzie]** ([Kalzumeus](https://www.kalzumeus.com/2011/10/28/dont-call-yourself-a-programmer/)).
- **Shipped, used products.** YC tells engineers to show "things that you have actually built" **[first-party]** (above). Founding-engineer guides stress ownership: "a senior engineer executes within the structure, whereas a founding engineer creates the structure" **[opinion: hiring-vendor content]** ([Uplers](https://www.uplers.com/article/hiring-founding-engineers/)).

### Puts readers off

- Clutter, multiple columns and long sentences **[study: Ladders]**.
- Marketing tone and boasting **[study: NN/g, -27% usability]**.
- Internal project names without context **[practitioner: Orosz]**.
- Duties instead of outcomes, as in "delivered technical solutions to client problems" **[practitioner: Swizec]**.
- Typos **[study: Lerner]**.
- Broken links, stale content, and over-engineered sites **[opinion: Profy.dev survey and comments]**.

### Checked against the current copy [inferred]

| Current line | What the sources say |
|---|---|
| `whoami: product engineer` / "I design and build." / "Give me a problem, not a spec." | Subjective claims with no seniority, domain or availability. These fail the 10-second test (NN/g) and the objectivity test (NN/g). |
| OpenBench: "built the workflows that ran cutting-edge AI models across trillions of compounds" | Good scope ("first engineering hire", "trillions"). "Cutting-edge" is marketese. It lacks an outcome: what the workflows enabled. |
| Unsupervised: "Helped design and build…", "mentored", "set up the tooling" | Duties, not outcomes. "Helped" hides his part (Orosz: say what *you* did). |
| Ibotta "23m downloads" | This is the company's figure. Orosz's test is "what was your contribution": tie it to what he built for those users. |
| issho proof lines | Sell the product to its users. A hiring reader needs his role and the result (shipped, users, what he owned). |
| "successor to claude-orchestrate" | An internal name without context (Orosz). |
| Sabbatical: "10/10 would recommend to a friend" | Reads as a holiday. It gives no context or forward signal (LinkedIn; see section 4). |
| Contact: "Feel free to get in touch…" | Asks for nothing. Says nothing about availability. |

## 3. How to word an achievement

**The pattern** **[practitioner, consistent across sources]**: the outcome first, then a measure or scope, then his specific part. Laszlo Bock (ex-Google SVP of People Operations): "Accomplished [X] as measured by [Y] by doing [Z]". The order is flexible, but all three parts should be there **[practitioner]** ([Bock on LinkedIn, 2014](https://www.linkedin.com/pulse/20140929001534-24454816-my-personal-formula-for-a-winning-resume); [Inc. on Google's X-Y-Z](https://www.inc.com/bill-murphy-jr/google-recruiters-say-these-5-resume-tips-including-x-y-z-formula-will-improve-your-odds-of-getting-hired-at-google.html)). Orosz gives the same pattern ([freeCodeCamp](https://www.freecodecamp.org/news/how-to-write-a-developer-resume-recruiters-will-read/)).

**For this site** **[inferred]**:

- **Start each line with the information-carrying word,** because readers scan down the left edge (NN/g). Start with the outcome or the scope ("First engineering hire…", "Cut…", "Shipped…"), not with "Helped" or "I".
- **Use "I" for his own part and "we" only for the team's result.** State the team size when it shows scope.
- **Use only numbers he can defend in an interview.** If a metric is the company's, say what he built that touched it.
- **No adjectives that grade his own work,** such as "cutting-edge", "pixel-perfect" or "world-class" (NN/g objectivity).
- **Where there is no hard number, use scope:** first hire, team size, the users or customers served, the systems owned, the scale handled, or time to ship.

## 4. Presenting the career break

**Evidence:**

- **Context helps:** "51% of hirers say they are more likely to contact a candidate that provides context about their career break". "48% of hirers think the biggest mistake candidates make when discussing their career breaks is undervaluing themselves". "52% of hiring managers believe candidates should proactively bring up their career break" **[first-party survey, sample size not stated on the page]** ([LinkedIn, March 2022](https://news.linkedin.com/2022/march/new-way-to-represent-career-breaks-on-linkedin)). LinkedIn's own career-break types include "travel", "personal goal pursuit" and "professional development" **[first-party, via secondary listings]** ([Pitt Career Central](https://careercentral.pitt.edu/blog/2023/04/12/a-new-way-to-explain-the-pause-in-your-career/)).
- **Silent gaps cost more over time:** in a field experiment with ~12,000 fictitious resumes sent to ~3,000 US postings, callbacks "sharply" declined with unemployment duration, "with the majority of this decline occurring during the first eight months" **[study]** ([Kroft, Lange & Notowidigdo, QJE 2013; NBER digest](https://www.nber.org/digest/mar13/duration-dependence-and-labor-market-conditions)).
  - **Caveats:** the roles were sales, customer service and clerical, and the applicants were young. The gaps were *unexplained* unemployment, not a stated, chosen sabbatical. How far this applies to senior engineers is unknown.
- **The reader's two worries** are "is he ready to work again?" and "has he kept up?" Don't sound like a "vacation hire" **[opinion]** ([techinterview.org](https://www.techinterview.org/post/3233475374/returning-tech-after-travel-sabbatical-telling-the-story/)).

**For this site** **[inferred]**:

- **Name it as chosen and bounded:** "Sabbatical, Nov 2025 – now". At ~12 months it is past the eight-month window where a silent gap costs most, so the context has to be on the page, not left for the interview.
- **Lead with what he built and kept current on during it:** orca-flow, rapid-radiology, issho, and helping friends launch products. That answers "has he kept up?" with evidence rather than reassurance. Travel and family can stay as one human clause. The joke ("10/10 would recommend") undercuts the forward signal, and it appears twice.
- **End with the forward signal:** back and looking for a full-time role. The sabbatical should not open the timeline as its headline unless it carries that signal. Whether it opens the timeline is a copy decision for the map, not something the evidence settles.

## 5. Presenting side projects built with AI tools

**Evidence:**

- **Shopify:** "Reflexive AI usage is now a baseline expectation at Shopify." The company published this on its candidate guide, so it is addressed to applicants **[first-party, March 2025]** ([Shopify careers](https://www.shopify.com/careers/candidate-guide/ai-usage)).
- **Canva requires AI tools in its coding interviews.** Candidates who struggled "lacked the judgment to guide AI effectively or identify when its suggestions were suboptimal". Canva expects engineers "to take full ownership of any code they produce, whether they wrote it themselves or with AI assistance". It asks: "Can they identify and fix issues in AI-generated code?" **[first-party, June 2025]** ([Canva Engineering](https://canva.dev/blog/engineering/yes-you-can-use-ai-in-our-interviews)).
- **Simon Willison separates "vibe coding"** ("the fast, loose and irresponsible way") from **"vibe engineering"**, where professionals stay accountable. The marks of vibe engineering are automated tests, planning in advance, documentation, version-control habits, CI, code review, manual QA and preview deploys **[practitioner, Oct 2025]** ([Willison](https://simonwillison.net/2025/Oct/7/vibe-engineering/)).
- **Hiring readers' skepticism:** 76% of hiring managers say AI makes it harder to judge authenticity, and 35% have seen AI-made portfolio work **[opinion: vendor survey, not checked against the original]** ([Resume Genius](https://resumegenius.com/blog/job-hunting/ai-impact-on-hiring)).
- **Evidence gap:** no study measures how hiring managers rate AI-built portfolio projects.

**For this site** **[inferred]**:

- **AI fluency is a selling point for this reader, not a confession.** Say it plainly. It also belongs in the skills window, which currently leaves AI out, though three of the four featured projects are AI products.
- **Frame each AI project by the engineering judgement in it:** what problem, for whom, what he decided, how correctness was checked, what shipped, and who uses it. rapid-radiology's "every normal line kept word for word" is the right kind of line: it shows verification. orca-flow's "each ticket goes to the cheapest model that can do it" and "this portfolio was built with it" show judgement and real use.
- **Don't lead with the tool** ("built with Claude"). Lead with the outcome and his decisions. The tool can sit in the technologies list.
- **Real users or real use beat a demo.** Use any adoption, stars, users or time-saved figure that exists.

## 6. First screens and availability

- **Observed patterns** **[inferred from two samples; weak]**:
  - Brittany Chiang opens with her name, "Frontend Engineer" and "I build accessible, pixel-perfect experiences for the web." ([brittanychiang.com](https://brittanychiang.com/)).
  - Lee Robinson opens with "I'm an engineer and writer. I work on Product at SpaceX (formerly at Cursor)…" ([leerob.com](https://leerob.com/)).
  - Both are employed, so neither states availability. Their shared pattern is name, role and a credibility anchor in the first lines. The anchor is a known employer or product. Without a famous employer, the anchor has to be scope or a shipped product.
- **Openness helps outreach.** LinkedIn says members who show #OpenToWork are "on average, 40% more likely to receive InMails from recruiters". That is outreach, not offers **[first-party]** ([LinkedIn, 2020](https://blog.linkedin.com/2020/october/29/the-benefits-of-sharing-with-your-community-you-re-open-to-work); [Fortune, 2024](https://fortune.com/2024/09/05/linkedin-opentowork-badge-recruiters-job-search/)).
- **Some say it reads as desperate.** One recruiter quoted by Fortune says the badge "can look desperate, amateurish", and another person warns it can invite lowball offers. No data supports either claim **[opinion]** (Fortune, above).
- **Advice on headlines:** lead with the specialty and target role, then state availability in a short, specific phrase **[opinion]** ([Built In](https://builtin.com/articles/is-open-to-work-effective)).

**For this site** **[inferred]**:

- **The first screen carries five things:**
  - His name.
  - A role at a level: senior, lead or founding product engineer.
  - One anchor of proof, such as "first engineering hire at an AI drug-discovery startup" or a shipped product.
  - The domain: AI and ML products, data platforms.
  - One availability line.
- **Word availability as a fact about the role, not a plea:** for example "Looking for a senior or founding product engineer role, remote, full-time. Available now." It is specific about level, mode and timing.
- **A start date or "now" removes a question** the sabbatical raises.
- **The contact window should repeat the ask:** what kind of message he wants, and how fast he replies if that is true.

## Evidence quality, in short

- **Strong:**
  - NN/g's web-reading studies: the 10-second window, time above the fold, the F-pattern and objective copy.
  - Kroft et al. on gap duration, with the caveat that it covers entry-level roles and unexplained gaps.
  - interviewing.io and Learning Collider on recruiter time and the pull of brand names.
- **Moderate:**
  - Ladders: a weak method, but the direction agrees with the other sources.
  - The LinkedIn career-break survey: first-party, and the sample size is not stated.
  - Shopify's and Canva's own statements of policy.
- **Practitioner consensus, not measured:** the outcome-number-contribution wording (Bock, Orosz, Swizec, McKenzie).
- **Weak or missing:**
  - Any study of engineer portfolio sites, or of founders as readers.
  - How the wording of an availability statement affects response.
  - How hiring managers rate AI-built projects.
  - The issue #118 plan to run a five-second test with three people who hire engineers is the right way to fill these gaps.
