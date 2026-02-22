import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const cwd = process.cwd();
const pdfPath = path.join(cwd, "Portfolio Reshma Muthuveetil.pdf");
const outDir = path.join(cwd, "assets", "images", "pages");

function convertToRgba(img) {
  const w = img.width;
  const h = img.height;
  const d = img.data;

  let channels = 4;
  if (img.kind === 2) channels = 3;
  else if (img.kind === 3) channels = 4;
  else if (img.kind === 1) channels = d.length === w * h ? 1 : 4;
  else {
    if (d.length === w * h * 4) channels = 4;
    else if (d.length === w * h * 3) channels = 3;
    else if (d.length === w * h) channels = 1;
  }

  if (channels === 4) {
    return { data: Buffer.from(d), width: w, height: h };
  }

  const out = Buffer.alloc(w * h * 4);

  if (channels === 3) {
    for (let i = 0, j = 0; i < d.length; i += 3, j += 4) {
      out[j] = d[i];
      out[j + 1] = d[i + 1];
      out[j + 2] = d[i + 2];
      out[j + 3] = 255;
    }
  } else if (channels === 1) {
    for (let i = 0, j = 0; i < d.length; i += 1, j += 4) {
      const v = d[i];
      out[j] = v;
      out[j + 1] = v;
      out[j + 2] = v;
      out[j + 3] = 255;
    }
  }

  return { data: out, width: w, height: h };
}

async function run() {
  await fs.mkdir(outDir, { recursive: true });

  const data = new Uint8Array(await fs.readFile(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const opList = await page.getOperatorList();
    const images = [];

    for (let i = 0; i < opList.fnArray.length; i += 1) {
      const fn = opList.fnArray[i];
      if (
        fn !== pdfjsLib.OPS.paintImageXObject &&
        fn !== pdfjsLib.OPS.paintJpegXObject &&
        fn !== pdfjsLib.OPS.paintInlineImageXObject
      ) {
        continue;
      }

      try {
        let img;
        if (fn === pdfjsLib.OPS.paintInlineImageXObject) {
          img = opList.argsArray[i][0];
        } else {
          const name = opList.argsArray[i][0];
          img = await new Promise((resolve) => page.objs.get(name, resolve));
        }
        if (img?.width && img?.height && img?.data) {
          images.push(img);
        }
      } catch {
        // Skip problematic objects and continue.
      }
    }

    if (images.length === 0) continue;

    images.sort((a, b) => b.width * b.height - a.width * a.height);
    const best = images[0];
    const rgba = convertToRgba(best);

    const outPath = path.join(outDir, `page-${String(pageNumber).padStart(3, "0")}.png`);
    await sharp(rgba.data, {
      raw: {
        width: rgba.width,
        height: rgba.height,
        channels: 4
      }
    })
      .png({ compressionLevel: 9 })
      .toFile(outPath);

    // eslint-disable-next-line no-console
    console.log(
      `page ${pageNumber}: ${best.width}x${best.height} (${images.length} extracted images)`
    );
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
