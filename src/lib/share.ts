// How an address presents itself when shared (#23, #48): which card it shows
// and the tags that say so. Pure, no DOM. Every URL is built from the site's
// own address (`site` in astro.config.mjs, `Astro.site`), never a host written
// here, so moving the site to its own domain changes that one value.

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** Where the build writes the cards, and so where the tags point. */
export const CARDS_DIR = "/cards/";
export const SITE_CARD = `${CARDS_DIR}site.png`;
export const RESUME_CARD = `${CARDS_DIR}resume.png`;
export const FAVICON = "/favicon.png";
export const APPLE_ICON = "/apple-touch-icon.png";

const WORK = "/work/";

/** A featured project's card: its repository, lowercase, like its address. */
export const projectCardPath = (repository: string): string =>
  `${CARDS_DIR}${repository.toLowerCase()}.png`;

/**
 * The card an address shares: a featured project's own page its composition,
 * `/resume/` the top of the sheet, everything else the site's.
 */
export function cardPathFor(path: string, featured: readonly string[]): string {
  if (path === "/resume/") return RESUME_CARD;
  if (path.startsWith(WORK)) {
    const slug = path.slice(WORK.length, -1).toLowerCase();
    const own = featured.find((r) => r.toLowerCase() === slug);
    if (own) return projectCardPath(own);
  }
  return SITE_CARD;
}

export interface Tag {
  /** `<meta property>`, for Open Graph. */
  property?: string;
  /** `<meta name>`, for Twitter. */
  name?: string;
  content: string;
}

interface ShareInput {
  site: URL;
  path: string;
  title: string;
  description: string;
  /** A path from `cardPathFor`. */
  card: string;
}

export function shareTags({
  site,
  path,
  title,
  description,
  card,
}: ShareInput): Tag[] {
  const image = new URL(card, site).href;
  return [
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Shrujan Cheruku" },
    { property: "og:url", content: new URL(path, site).href },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    { property: "og:image:width", content: String(CARD_WIDTH) },
    { property: "og:image:height", content: String(CARD_HEIGHT) },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];
}
