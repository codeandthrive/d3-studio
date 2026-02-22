import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const cwd = process.cwd();
const extractedDir = path.join(cwd, "assets", "images", "pages");
const renderedDir = path.join(cwd, "assets", "images", "projects");
const outDir = path.join(cwd, "assets", "images", "source-pages");

const pageFile = (n) => `page-${String(n).padStart(3, "0")}.png`;

async function scoreImage(filePath) {
  try {
    const image = sharp(filePath);
    const meta = await image.metadata();
    const stats = await image.stats();
    const w = meta.width || 0;
    const h = meta.height || 0;
    const area = w * h;
    const std = stats.channels.reduce((s, ch) => s + ch.stdev, 0) / stats.channels.length;

    const sizeFactor = Math.min(w / 1000, 1) * Math.min(h / 1000, 1);
    const score = std * Math.sqrt(Math.max(area, 1)) * sizeFactor;
    return { ok: true, score, width: w, height: h };
  } catch {
    return { ok: false, score: -1, width: 0, height: 0 };
  }
}

async function run() {
  await fs.mkdir(outDir, { recursive: true });

  for (let p = 1; p <= 30; p += 1) {
    const file = pageFile(p);
    const a = path.join(extractedDir, file);
    const b = path.join(renderedDir, file);

    const sa = await scoreImage(a);
    const sb = await scoreImage(b);

    let selected = null;
    if (sa.ok && sb.ok) selected = sa.score >= sb.score ? a : b;
    else if (sa.ok) selected = a;
    else if (sb.ok) selected = b;

    if (!selected) continue;

    const outPath = path.join(outDir, file);
    await fs.copyFile(selected, outPath);
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
