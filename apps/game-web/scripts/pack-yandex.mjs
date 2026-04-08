import fs from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import archiver from "archiver";

const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const ASCII_PATH_PATTERN = /^[A-Za-z0-9._/-]+$/;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(appDir, "..", "..");
const distDir = path.join(appDir, "dist");
const artifactsDir = path.join(appDir, "artifacts", "yandex");
const rootPackage = JSON.parse(
  await readFile(path.join(repoDir, "package.json"), "utf8"),
);

await assertDistIsReady();
const files = await collectFiles(distDir);
const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
  throw new Error(
    `Yandex build is too large: ${formatMegabytes(totalBytes)} MB (limit: ${formatMegabytes(MAX_UNCOMPRESSED_BYTES)} MB).`,
  );
}

await mkdir(artifactsDir, { recursive: true });

const zipName = `bubble-kingdom-yandex-${rootPackage.version}.zip`;
const zipPath = path.join(artifactsDir, zipName);
const reportPath = path.join(artifactsDir, "package-report.json");

await rm(zipPath, { force: true });
await createArchive({
  sourceDir: distDir,
  outputPath: zipPath,
});

const report = {
  game: "Bubble Kingdom",
  version: rootPackage.version,
  generatedAt: new Date().toISOString(),
  buildTarget: "yandex",
  archiveName: zipName,
  fileCount: files.length,
  uncompressedBytes: totalBytes,
  uncompressedMegabytes: formatMegabytes(totalBytes),
  budgetMegabytes: formatMegabytes(MAX_UNCOMPRESSED_BYTES),
  indexAtArchiveRoot: true,
};

await writeFile(reportPath, JSON.stringify(report, null, 2));

console.log(
  `Packed Yandex artifact: ${zipPath}\nUncompressed size: ${formatMegabytes(totalBytes)} MB across ${files.length} files.`,
);

async function assertDistIsReady() {
  const indexPath = path.join(distDir, "index.html");
  let indexStat;
  try {
    indexStat = await stat(indexPath);
  } catch {
    throw new Error(
      `Missing dist/index.html. Run the Yandex build before packaging: ${path.relative(repoDir, distDir)}`,
    );
  }

  if (!indexStat.isFile()) {
    throw new Error("dist/index.html exists but is not a file.");
  }
}

async function collectFiles(dir, parentRelative = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = parentRelative
      ? `${parentRelative}/${entry.name}`
      : entry.name;

    if (!ASCII_PATH_PATTERN.test(relativePath)) {
      throw new Error(
        `Non-ASCII or unsupported path detected in Yandex build: ${relativePath}`,
      );
    }

    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath, relativePath)));
      continue;
    }

    const fileStat = await stat(absolutePath);
    files.push({
      relativePath,
      absolutePath,
      size: fileStat.size,
    });
  }

  return files;
}

function createArchive({ sourceDir, outputPath }) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    void archive.finalize();
  });
}

function formatMegabytes(bytes) {
  return Number((bytes / (1024 * 1024)).toFixed(2));
}
