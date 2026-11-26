# Portfolio

Shrujan Cheruku's personal site: a marketing showcase for his career, driven by the GitHub repositories he selects and his work history.

## Language

**Desktop**:
The form the whole portfolio takes: one tiled desktop the visitor stays in from arrival to leaving. Every part of the story is a workspace or a window inside it.
_Avoid_: Page, site shell, app

**Workspace**:
One part of the portfolio's story, shown as a numbered workspace of the desktop. The set is fixed and does not change when the featured projects change; all featured projects share one workspace.
_Avoid_: Section, page, screen, slide

**Step**:
One stop in the desktop's story, a single arrangement of windows within a workspace. Every workspace is one step except the projects workspace, which has one step per featured project.
_Avoid_: Stop, scroll position, workspace

**Screen**:
What a phone shows of a step at once. On a phone every step is one screen except the timeline step, which is two: the timeline, then Education & Internships over Skills. A window with more entries than fit one screen adds screens of its own (the archive, and Education's roles or Skills if they are too long for their screen). One swipe moves one screen. On a wide screen, each step is a single screen.
_Avoid_: Slide, view, workspace, page

**Page**:
The share of a window's entries that fits one screen on a phone. A window whose entries do not all fit (the archive, and Education's roles or Skills if they are too long for their screen) has several pages, each on a screen of its own. The timeline's entries collapse to their headings and never page.
_Avoid_: Screen, slide; never the desktop or a workspace

**Opening a window**:
A window coming on show in a step while its neighbours stay: it slides out of the edge of the desktop it sits against, and its neighbours give up the space as it comes, sharing one moving border with it.
_Avoid_: Fade in, pop in, launch; "the opening" (that is the first workspace)

**Closing a window**:
The reverse of opening a window: it slides back into the edge it came from while its neighbours fill the space it leaves.
_Avoid_: Fade out, dismiss, hide

**Rolling past**:
How one project gives way to the next. The tiles stay put; inside each one the old project's window slides out and the next one's slides in, like a scroll: forwards, the old goes up and the next comes from below; backwards, the reverse. A window both projects share (the stack) doesn't move.
_Avoid_: Crossfade, swap, carousel, page turn

**Changing workspace**:
How the desktop moves from one workspace to another. Nothing opens or closes: the old workspace's windows slide up and off one after another in tiling order, as the next workspace's come up from below in the same order (the reverse going to a lower number). A window on both workspaces (the name) travels with each one rather than staying. A jump across several workspaces travels one screen, like a step to the next.
_Avoid_: Page transition, slide, scroll, swipe

**Project**:
A public GitHub repository that Shrujan has selected to appear on the portfolio. Nothing appears without being selected.
_Avoid_: Repo (when talking about what the visitor sees), work, piece

**Featured project**:
A project Shrujan has chosen to market in full, with a hero image, screenshots and copy. Featured projects are an ordered list that Shrujan sets by hand and that changes over time.
_Avoid_: Highlighted, pinned, showcase project

**Archive**:
The compact listing of projects that are selected but not featured. A visitor opens it on request; it is not part of the main story. A featured project that is replaced moves here.
_Avoid_: Other projects, the rest, graveyard

**Pitch**:
The one-line claim Shrujan writes for a project. Every project has one, and it is not the repository's GitHub description.
_Avoid_: Description, tagline, blurb

**Proof line**:
A short statement of fact under a featured project's pitch that backs the pitch up. A featured project has two to five, each one true when a visitor checks it against the project, and none repeating the pitch.
_Avoid_: Bullet, feature, highlight

**Hero image**:
The lead visual that represents a featured project in its window. It is always a composition, never a screenshot or recording shown on its own.
_Avoid_: Banner, cover, thumbnail

**Composition**:
A live scene written by hand for one featured project, designed around what that project should show: a site beside its app, a console and its tickets, a tiling desktop, an app flow. It is drawn from text and shapes, not from recordings, and is tiled into panes like the desktop around it, with no drawn hardware.
_Avoid_: Mockup, demo, animation, scene (when talking to a visitor)

**Share card**:
The still image shown when an address of the portfolio is shared. A featured project's share card is its composition frozen in its end state; every other address shares the site's card, the opening workspace frozen in its end state. Every share card shows the paper theme.
_Avoid_: OG image, social preview (that is GitHub's image for a repository)

**Social preview**:
The image GitHub serves for a repository when its link is shared. It is not a hero image and the portfolio never shows it.
_Avoid_: OG image, card

**Timeline**:
The portfolio's presentation of Shrujan's career, newest first, starting with the sabbatical. Each employer is one entry; a title progression at one employer stays inside that entry. Earlier work belongs to Education & Internships, not the timeline.
_Avoid_: Resume section, CV, experience

**Education & Internships**:
The window of the timeline workspace that sits beside the timeline: the degree as its heading, with the teaching post and every internship beneath it, hidden until the visitor opens it.
_Avoid_: Illinois section, education section, early career

**Skill bar**:
A skill Shrujan rates himself on out of ten, shown as the length of a bar with no number. The last one, Comedic Talent, is a joke and always outranks the rest.
_Avoid_: Skill meter, proficiency, rating

**Resume**:
The one-page document of Shrujan's career that a visitor can download or be sent straight to. It states the same facts as the timeline and Education & Internships and may word a description more briefly. It is the one part of the portfolio that stands outside the desktop.
_Avoid_: CV, resume section

**Sabbatical**:
The period from Nov 2025 to now: travelling, time with family, and helping friends launch their products. It is both a workspace of the portfolio and the top entry of the timeline.
_Avoid_: Career break, gap

**Canonical address**:
The one public address the portfolio is known by, `https://shrujan.dev`. Every other address that reaches it (`www`, `http`, `shrujancheruku.github.io`) redirects there.
_Avoid_: Domain (that is the name registered at Porkbun), home URL

**Legacy site**:
The 2017 portfolio this repository originally served. Its code is kept in the repository for posterity and is not published.
_Avoid_: Old site, v1
