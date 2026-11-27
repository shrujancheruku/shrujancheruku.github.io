import { expect, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const PDF = "/shrujan-cheruku-resume.pdf";
// a phone number: 3-3-4 digits with separators, optionally +1 and brackets
const PHONE = /(\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/;

const readPdf = async (bytes: Buffer) => {
  const pdf = await getDocument({ data: new Uint8Array(bytes) }).promise;
  const meta = (await pdf.getMetadata()).info as Record<string, string>;
  const page = await pdf.getPage(1);
  const text = (await page.getTextContent()).items
    .map((i) => ("str" in i ? i.str : ""))
    .join(" ");
  return { pages: pdf.numPages, size: page.view, meta, text };
};

test.describe("/resume/", () => {
  test("is a letter-size sheet with no desktop around it", async ({ page }) => {
    await page.goto("/resume/");
    await expect(page).toHaveTitle("Resume — Shrujan Cheruku");
    await expect(page.locator("main.area, .screen, nav.status")).toHaveCount(0);
    expect(await page.locator("body.idle, [data-crt]").count()).toBe(0);
    const box = await page.locator(".sheet").boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(816);
    expect(Math.round(box?.height ?? 0)).toBe(1056);
  });

  test("always light and greyscale, whatever the theme or system mode", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => localStorage.setItem("theme", "terminal"));
    await page.goto("/resume/");
    const colours = await page.evaluate(() =>
      [...document.querySelectorAll("body, body *")].flatMap((el) => {
        const s = getComputedStyle(el);
        return [s.color, s.backgroundColor, s.borderTopColor];
      }),
    );
    for (const c of colours) {
      const [r, g, b] = (c.match(/[\d.]+/g) ?? []).map(Number);
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
    const sheet = await page
      .locator(".sheet")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(sheet).toBe("rgb(255, 255, 255)");
  });

  test("shows the header and the body, and no phone, location or summary", async ({
    page,
  }) => {
    await page.goto("/resume/");
    const text = ((await page.locator(".sheet").textContent()) ?? "").replace(
      /\s+/g,
      " ",
    );
    for (const s of [
      "Shrujan",
      "Cheruku",
      "Senior Product Engineer",
      "shrujancheruku@gmail.com",
      "linkedin.com/in/shrujancheruku",
      "github.com/shrujancheruku",
      "shrujancheruku.github.io",
      "Sabbatical",
      "OpenBench",
      "Senior Software Engineer",
      "Full Stack Engineer",
      "Ibotta",
      "Orderly Health",
      "B.Sc Computer Science",
      "Teaching Assistant",
      "Sandia National Laboratories",
      "Indian School of Business",
      "EiQ Networks",
      "Telugu - native",
      "pub quizzes",
    ])
      expect(text.toLowerCase()).toContain(s.toLowerCase());
    expect(text).not.toMatch(PHONE);
    expect(text).not.toMatch(/Dallas|American|Who am I/i);
    await expect(page.locator(".bar")).toHaveCount(4);
    await expect(page.locator(".hobbies li")).toHaveCount(9);
  });

  test("on a phone it is one column and does not scroll sideways", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/resume/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const header = await page
      .locator("header")
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      );
    expect(header).toBe(1);
    await expect(page.locator(".bar").first()).toBeVisible();
  });

  test("hides Download PDF and the link back in print", async ({ page }) => {
    await page.goto("/resume/");
    await expect(
      page.getByRole("link", { name: "Download PDF" }),
    ).toBeVisible();
    await expect(
      page.locator("nav a", { hasText: "shrujancheruku.github.io" }),
    ).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("link", { name: "Download PDF" })).toBeHidden();
    await expect(
      page.locator("nav a", { hasText: "shrujancheruku.github.io" }),
    ).toBeHidden();
  });

  test("Download PDF points at the PDF", async ({ page }) => {
    await page.goto("/resume/");
    await expect(
      page.getByRole("link", { name: "Download PDF" }),
    ).toHaveAttribute("href", PDF);
  });
});

test.describe(PDF, () => {
  test("is one US Letter page with selectable text and no phone number", async ({
    request,
  }) => {
    const res = await request.get(PDF);
    expect(res.ok()).toBe(true);
    const pdf = await readPdf(await res.body());
    expect(pdf.pages).toBe(1);
    expect(pdf.size).toEqual([0, 0, 612, 792]);
    expect(pdf.text).toContain("Senior Product Engineer");
    expect(pdf.text).toContain("OpenBench");
    expect(pdf.text).not.toMatch(PHONE);
  });

  test("carries the Title and the Author", async ({ request }) => {
    const res = await request.get(PDF);
    const { meta } = await readPdf(await res.body());
    expect(meta.Title).toBe("Shrujan Cheruku – Resume");
    expect(meta.Author).toBe("Shrujan Cheruku");
  });
});

test.describe("the desktop and the resume", () => {
  test("the timeline workspace offers the PDF", async ({ page }) => {
    await page.goto("/timeline/");
    const link = page.locator('[data-window="timeline"] a[download]');
    await expect(link).toHaveAttribute("href", PDF);
  });

  test("no page of the desktop links to /resume/", async ({ page }) => {
    for (const path of [
      "/",
      "/timeline/",
      "/work/",
      "/about/",
      "/now/",
      "/contact/",
    ]) {
      await page.goto(path);
      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      expect(hrefs.filter((h) => h?.startsWith("/resume"))).toEqual([]);
    }
  });
});
