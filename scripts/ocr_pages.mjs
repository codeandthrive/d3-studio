import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createWorker } from "tesseract.js";

const cwd = process.cwd();
const pagesDir = path.join(cwd, "assets", "images", "pages");
const outDir = path.join(cwd, "assets", "text");

const cleanText = (text) =>
  text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

async function run() {
  await fs.mkdir(outDir, { recursive: true });

  const pageFiles = (await fs.readdir(pagesDir))
    .filter((f) => /^page-\d+\.png$/i.test(f))
    .sort((a, b) => a.localeCompare(b));

  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && m.progress) {
        // Keep output light but visible for long OCR runs.
        const pct = Math.round(m.progress * 100);
        if (pct % 20 === 0) {
          // eslint-disable-next-line no-console
          console.log(`OCR progress: ${pct}%`);
        }
      }
    }
  });

  const pages = [];
  for (const file of pageFiles) {
    const pageNumber = Number(file.match(/\d+/)?.[0] || 0);
    const inputPath = path.join(pagesDir, file);
    const preprocessed = await sharp(inputPath)
      .resize({ width: 2200, withoutEnlargement: true })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();

    const result = await worker.recognize(preprocessed);
    const text = cleanText(result.data.text || "");

    pages.push({
      page: pageNumber,
      image: `assets/images/pages/${file}`,
      text
    });

    // eslint-disable-next-line no-console
    console.log(`OCR complete: page ${pageNumber}`);
  }

  await worker.terminate();

  const markdown = [
    "# OCR Extracted Portfolio Text",
    "",
    ...pages.map((p) => `## Page ${p.page}\n\n${p.text || "(no readable text)"}\n`)
  ].join("\n");

  await fs.writeFile(path.join(outDir, "portfolio-ocr-text.md"), markdown, "utf8");
  await fs.writeFile(path.join(outDir, "portfolio-ocr-pages.json"), JSON.stringify(pages, null, 2), "utf8");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
