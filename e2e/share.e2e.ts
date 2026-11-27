import { expect, test } from "@playwright/test";

const SITE = "https://shrujancheruku.github.io";
const meta = (page: import("@playwright/test").Page, key: string) =>
  page
    .locator(`meta[property="${key}"], meta[name="${key}"]`)
    .getAttribute("content");

const featured = ["issho", "rapid-radiology", "orca-flow", "unmacos"];

test("a featured project shares its own card, title and pitch", async ({
  page,
}) => {
  for (const slug of featured) {
    await page.goto(`/work/${slug}/`);
    expect(await meta(page, "og:image")).toBe(`${SITE}/cards/${slug}.png`);
    expect(await meta(page, "twitter:image")).toBe(`${SITE}/cards/${slug}.png`);
    expect(await meta(page, "og:title")).toBe(await page.title());
    expect(await meta(page, "og:description")).toBe(
      await page.locator('meta[name="description"]').getAttribute("content"),
    );
    expect(await meta(page, "og:url")).toBe(`${SITE}/work/${slug}/`);
    expect(await meta(page, "twitter:card")).toBe("summary_large_image");
  }
});

test("every other address shares the site's card", async ({ page }) => {
  for (const path of [
    "/",
    "/timeline/",
    "/work/",
    "/about/",
    "/now/",
    "/contact/",
    "/archive/",
    "/work/claude-orchestrate/",
  ]) {
    await page.goto(path);
    expect(await meta(page, "og:image"), path).toBe(`${SITE}/cards/site.png`);
    expect(await meta(page, "og:title"), path).toBe(await page.title());
  }
});

test("the resume shares its own card", async ({ page }) => {
  await page.goto("/resume/");
  expect(await meta(page, "og:image")).toBe(`${SITE}/cards/resume.png`);
  expect(await meta(page, "og:title")).toBe("Resume — Shrujan Cheruku");
  expect(await meta(page, "description")).toBe(
    "I design things and I build them. Give me a problem, not a spec.",
  );
  expect(await meta(page, "og:description")).toBe(
    await meta(page, "description"),
  );
  expect(await meta(page, "og:url")).toBe(`${SITE}/resume/`);
});

test("the not-found page shares the site's card", async ({ page }) => {
  await page.goto("/404.html");
  expect(await meta(page, "og:image")).toBe(`${SITE}/cards/site.png`);
});

for (const name of ["site", "resume", ...featured]) {
  test(`the ${name} card is a 1200 × 630 PNG, in the paper theme`, async ({
    request,
  }) => {
    const res = await request.get(`/cards/${name}.png`);
    expect(res.ok()).toBe(true);
    const png = await res.body();
    // PNG header: signature, then IHDR's width and height
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
}

test("the cards are paper: the page behind the site card is the paper background", async ({
  page,
}) => {
  // decode a card in the browser and read its pixel inside the bezel
  await page.goto("/");
  const pixel = await page.evaluate(async () => {
    const img = new Image();
    img.src = "/cards/orca-flow.png";
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    ctx.drawImage(img, 0, 0);
    return [...ctx.getImageData(600, 2, 1, 1).data.slice(0, 3)];
  });
  // paper's background, #f2eede
  expect(pixel).toEqual([0xf2, 0xee, 0xde]);
});

test("the favicon is s_ in the paper accent on paper, in every theme", async ({
  page,
}) => {
  await page.goto("/");
  const href = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(href).toBe("/favicon.png");
  // one icon, not themed: whatever theme the visitor has, the link is the same
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "tokyo-night";
  });
  expect(await page.locator('link[rel="icon"]').getAttribute("href")).toBe(
    "/favicon.png",
  );
  const px = await page.evaluate(async () => {
    const img = new Image();
    img.src = "/favicon.png";
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    ctx.drawImage(img, 0, 0);
    const hex = (d: Uint8ClampedArray) =>
      [...d.slice(0, 3)].map((v) => v.toString(16).padStart(2, "0")).join("");
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const counts = new Map<string, number>();
    for (let i = 0; i < data.length; i += 4)
      counts.set(
        hex(data.slice(i, i + 4)),
        (counts.get(hex(data.slice(i, i + 4))) ?? 0) + 1,
      );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([k]) => k);
  });
  // the two dominant colours: paper background, paper accent
  expect(px).toEqual(["f2eede", "cc3e28"]);
});

test("compositions and photos are not in the first load", async ({ page }) => {
  const before: string[] = [];
  page.on("request", (r) => before.push(new URL(r.url()).pathname));
  await page.goto("/", { waitUntil: "load" });
  const loadedAt = before.length;
  const first = before.slice(0, loadedAt);
  for (const name of ["issho", "rapid-radiology", "orca-flow", "unmacos"])
    expect(first.some((u) => u.includes(`/_astro/${name}.`))).toBe(false);
  expect(first.some((u) => /\/_astro\/.+\.(avif|webp|jpe?g)$/.test(u))).toBe(
    false,
  );
});
