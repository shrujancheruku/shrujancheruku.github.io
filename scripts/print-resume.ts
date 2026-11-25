// Runs after `astro build`: prints dist/resume/ to dist/shrujan-cheruku-resume.pdf
// with headless Chromium. US Letter, one page or the build fails, Title and
// Author set (Chromium takes the Title from the page; the Author is added here).
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import {
  assertOnePage,
  PDF_AUTHOR,
  PDF_PATH,
  PDF_TITLE,
  RESUME_PATH,
} from "../src/lib/resume";

const outDir = new URL("../dist/", import.meta.url).pathname;

// serve dist/ the way Pages does: a directory serves its index.html
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const file = Bun.file(
      join(outDir, pathname.endsWith("/") ? `${pathname}index.html` : pathname),
    );
    return (await file.exists())
      ? new Response(file)
      : new Response("not found", { status: 404 });
  },
});

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.port}${RESUME_PATH}`);
  await page.evaluate(() => document.fonts.ready);
  const printed = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
  });

  const pdf = await PDFDocument.load(printed, { updateMetadata: false });
  assertOnePage(pdf.getPageCount());
  pdf.setTitle(PDF_TITLE);
  pdf.setAuthor(PDF_AUTHOR);
  await writeFile(join(outDir, PDF_PATH), await pdf.save());
  console.log(`✓ printed ${PDF_PATH}: 1 page, US Letter`);
} finally {
  await browser.close();
  await server.stop(true);
}
