import fs from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const cwd = process.cwd();
const pdfPath = path.join(cwd, "Portfolio Reshma Muthuveetil.pdf");

const outBase = path.join(cwd, "assets");
const outImages = path.join(outBase, "images");
const outPages = path.join(outImages, "pages");
const outProjects = path.join(outImages, "projects");
const outDiagrams = path.join(outImages, "diagrams");
const outRenders = path.join(outImages, "renders");
const outText = path.join(outBase, "text");

const ensureDirs = async () => {
  await fs.mkdir(outPages, { recursive: true });
  await fs.mkdir(outProjects, { recursive: true });
  await fs.mkdir(outDiagrams, { recursive: true });
  await fs.mkdir(outRenders, { recursive: true });
  await fs.mkdir(outText, { recursive: true });
};

const pageName = (n) => `page-${String(n).padStart(3, "0")}.png`;

const classifyPage = (text, pageNumber) => {
  const t = text.toLowerCase();
  const diagramHints = [
    "diagram",
    "strategy",
    "concept",
    "hierarchy",
    "zoning",
    "section",
    "framework",
    "corridor",
    "heritage",
    "public realm",
    "existing system",
    "analysis",
    "process"
  ];
  const renderHints = [
    "render",
    "3d",
    "visualization",
    "view",
    "apartment",
    "residential",
    "tower",
    "interior",
    "office"
  ];

  const diagramScore = diagramHints.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
  const renderScore = renderHints.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);

  if (diagramScore >= 2) return "diagrams";
  if (renderScore >= 2) return "renders";
  if (pageNumber <= 2) return "projects";
  return "projects";
};

const projectBucket = (text, pageNumber) => {
  const t = text.toLowerCase();
  if (t.includes("vaayanasala") || t.includes("public realm")) return "project-01-vaayanasala";
  if (t.includes("flinders") || t.includes("yarra") || t.includes("railway")) return "project-02-flinders";
  if (t.includes("planet sks") || t.includes("apartments") || t.includes("high-rise")) return "project-03-planet-sks";
  if (t.includes("sks associates") || t.includes("office")) return "project-04-sks-office";

  // Fallback ranges for this portfolio's sequence.
  if (pageNumber >= 3 && pageNumber <= 9) return "project-01-vaayanasala";
  if (pageNumber >= 10 && pageNumber <= 14) return "project-02-flinders";
  if (pageNumber >= 15 && pageNumber <= 19) return "project-03-planet-sks";
  if (pageNumber >= 20) return "project-04-sks-office";
  return "general";
};

const run = async () => {
  await ensureDirs();
  const data = new Uint8Array(await fs.readFile(pdfPath));
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: false
  });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 3.0 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");

    await page.render({ canvasContext: context, viewport }).promise;
    const pngBuffer = canvas.toBuffer("image/png");

    const pageFileName = pageName(i);
    const pagePath = path.join(outPages, pageFileName);
    await fs.writeFile(pagePath, pngBuffer);

    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => (typeof item.str === "string" ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const group = classifyPage(pageText, i);
    const bucket = projectBucket(pageText, i);

    const groupPath = path.join(outImages, group, pageFileName);
    await fs.copyFile(pagePath, groupPath);

    pages.push({
      page: i,
      image: `assets/images/pages/${pageFileName}`,
      group,
      groupedImage: `assets/images/${group}/${pageFileName}`,
      projectBucket: bucket,
      text: pageText
    });
  }

  // Create project-specific markdown summaries from extracted page text.
  const bucketMap = new Map();
  for (const p of pages) {
    const arr = bucketMap.get(p.projectBucket) || [];
    arr.push(p);
    bucketMap.set(p.projectBucket, arr);
  }

  const projectFileMap = {
    "project-01-vaayanasala": "project-01-reframing-vaayanasala.md",
    "project-02-flinders": "project-02-flinders-street.md",
    "project-03-planet-sks": "project-03-planet-sks-apartments.md",
    "project-04-sks-office": "project-04-office-of-sks-associates.md"
  };

  for (const [bucket, fileName] of Object.entries(projectFileMap)) {
    const rows = bucketMap.get(bucket) || [];
    const body = rows
      .map((r) => `## Page ${r.page}\n- Group: ${r.group}\n- Image: ${r.groupedImage}\n\n${r.text || "(no readable text)"}\n`)
      .join("\n");
    await fs.writeFile(path.join(outText, fileName), `# ${bucket}\n\n${body}`.trim() + "\n", "utf8");
  }

  const fullTextMd = [
    "# Extracted Portfolio Text",
    "",
    ...pages.map((p) => `## Page ${p.page}\n${p.text || "(no readable text)"}\n`)
  ].join("\n");
  await fs.writeFile(path.join(outText, "portfolio-full-text.md"), fullTextMd, "utf8");

  await fs.writeFile(
    path.join(outText, "portfolio-pages.json"),
    JSON.stringify(
      {
        source: "Portfolio Reshma Muthuveetil.pdf",
        pageCount: pdf.numPages,
        extractedAt: new Date().toISOString(),
        pages
      },
      null,
      2
    ),
    "utf8"
  );
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
