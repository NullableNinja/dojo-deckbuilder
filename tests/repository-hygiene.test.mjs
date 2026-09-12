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
  "reports/card-effect-audit.json",
  "reports/card-effect-audit.md",
  "reports/simulation-v2.3-1000.json",
  "reports/simulation-v2.3-1000.md",
  "reports/simulation-v2.3.json",
  "reports/simulation-v2.3.md",
]);

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
  const emptyAssets = trackedFiles.filter((file) =>
    productionAssetRoots.some((root) => file.startsWith(root)) && statSync(file).size === 0,
  );

  assert.deepEqual(emptyAssets, []);
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
