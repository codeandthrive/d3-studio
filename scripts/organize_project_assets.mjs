import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const cwd = process.cwd();
const sourceDir = path.join(cwd, "assets", "images", "source-pages");
const projectsDir = path.join(cwd, "assets", "images", "projects");
const diagramsDir = path.join(cwd, "assets", "images", "diagrams");
const rendersDir = path.join(cwd, "assets", "images", "renders");

const projectMap = [
  {
    slug: "project-01-vaayanasala",
    projects: [6, 7, 9],
    diagrams: [4, 5, 8],
    renders: [6, 7, 9],
    hero: 6
  },
  {
    slug: "project-02-flinders",
    projects: [10, 14],
    diagrams: [11, 12, 13],
    renders: [10, 14],
    hero: 10
  },
  {
    slug: "project-03-planet-sks",
    projects: [15, 17, 18],
    diagrams: [16, 19],
    renders: [15, 17, 18],
    hero: 15
  },
  {
    slug: "project-04-sks-office",
    projects: [23, 24, 25],
    diagrams: [22, 26],
    renders: [23, 24, 25],
    hero: 23
  }
];

const pagePath = (n) => path.join(sourceDir, `page-${String(n).padStart(3, "0")}.png`);

async function resetDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function writeJpeg(fromPath, toPath) {
  await sharp(fromPath).jpeg({ quality: 88, mozjpeg: true }).toFile(toPath);
}

async function run() {
  await resetDir(projectsDir);
  await resetDir(diagramsDir);
  await resetDir(rendersDir);

  for (const project of projectMap) {
    const pDir = path.join(projectsDir, project.slug);
    const dDir = path.join(diagramsDir, project.slug);
    const rDir = path.join(rendersDir, project.slug);
    await fs.mkdir(pDir, { recursive: true });
    await fs.mkdir(dDir, { recursive: true });
    await fs.mkdir(rDir, { recursive: true });

    let count = 1;
    for (const p of project.projects) {
      await writeJpeg(pagePath(p), path.join(pDir, `project-${count}.jpg`));
      count += 1;
    }

    count = 1;
    for (const p of project.diagrams) {
      await writeJpeg(pagePath(p), path.join(dDir, `diagram-${count}.jpg`));
      count += 1;
    }

    count = 1;
    for (const p of project.renders) {
      await writeJpeg(pagePath(p), path.join(rDir, `render-${count}.jpg`));
      count += 1;
    }

    await writeJpeg(
      pagePath(project.hero),
      path.join(projectsDir, `${project.slug}-hero.jpg`)
    );
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
