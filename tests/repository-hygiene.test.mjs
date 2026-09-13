import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const temporarySuffixes = [".tmp", ".bak", ".orig", ".rej", ".old", ".save", ".swp", ".swo"];
const temporaryNames = new Set([".ds_store", "thumbs.db"]);
const productionAssetRoots = ["app/assets/", "public/"];
const textExtensions = new Set([
  ".css", ".html", ".js", ".json", ".md", ".mjs", ".py", ".ts", ".tsx", ".webmanifest", ".yml", ".yaml",
]);
const retiredCheckedInReports = new Set([
  "reports/FINAL-REPORT.md",
  "reports/card-effect-audit.md",
  "reports/simulation-v2.3-1000.json",
  "reports/simulation-v2.3-1000.md",
  "reports/simulation-v2.3.json",
  "reports/simulation-v2.3.md",
]);

function isProductionAsset(file) {
  return productionAssetRoots.some((root) => file.startsWith(root));
}

function hasValidImageSignature(file) {
  const extension = path.extname(file).toLowerCase();
  const bytes = readFileSync(file);

  switch (extension) {
    case ".png":
      return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case ".jpg":
    case ".jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case ".gif":
      return bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"));
    case ".webp":
      return bytes.length >= 12
        && bytes.subarray(0, 4).toString("ascii") === "RIFF"
        && bytes.subarray(8, 12).toString("ascii") === "WEBP";
    case ".svg":
      return bytes.toString("utf8").includes("<svg");
    default:
      return true;
  }
}

test("tracked files do not include common temporary or conflict-recovery suffixes", () => {
  const debris = trackedFiles.filter((file) => {
    const name = path.basename(file).toLowerCase();
    return temporaryNames.has(name)
      || name.endsWith("~")
      || temporarySuffixes.some((suffix) => name.endsWith(suffix));
  });

  assert.deepEqual(debris, []);
});

test("tracked production assets are not zero-byte placeholders", () => {
  const emptyAssets = trackedFiles.filter((file) => isProductionAsset(file) && statSync(file).size === 0);
  assert.deepEqual(emptyAssets, []);
});

test("tracked production images have a recognizable file signature", () => {
  const imageExtensions = new Set([".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
  const invalidImages = trackedFiles.filter((file) =>
    isProductionAsset(file)
    && imageExtensions.has(path.extname(file).toLowerCase())
    && !hasValidImageSignature(file),
  );

  assert.deepEqual(invalidImages, []);
});

test("tracked text files do not contain unresolved merge-conflict markers", () => {
  const leftMarker = "<".repeat(7);
  const rightMarker = ">".repeat(7);
  const middleMarker = "=".repeat(7);
  const conflicted = [];

  for (const file of trackedFiles) {
    const extension = path.extname(file).toLowerCase();
    if (!textExtensions.has(extension) && path.basename(file) !== ".gitignore") continue;

    const text = readFileSync(file, "utf8");
    const hasBoundary = text.includes(leftMarker) || text.includes(rightMarker);
    const hasMiddle = text.split(/\r?\n/).some((line) => line.trim() === middleMarker);
    if (hasBoundary || hasMiddle) conflicted.push(file);
  }

  assert.deepEqual(conflicted, []);
});

test("retired checked-in diagnostic reports are not reintroduced", () => {
  const reintroduced = trackedFiles.filter((file) => retiredCheckedInReports.has(file));
  assert.deepEqual(reintroduced, []);
});
