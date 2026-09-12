import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(root, "dist", "assets");
const assetNames = await readdir(assetsDir);
const playtestName = assetNames.find((name) => /^playtest-.*\.js$/.test(name));

if (!playtestName) {
  throw new Error("Card Inspector bundle certification could not find the generated playtest chunk.");
}

const playtestSource = await readFile(path.join(assetsDir, playtestName), "utf8");
const lazyResolver = playtestSource.match(/import\(`\.\/([^`]+\.js)`\)\.then\(([$\w]+)=>\(\{default:\2\.CardInspector\}\)\)/);

if (!lazyResolver) {
  if (playtestSource.includes("CardInspector")) {
    throw new Error("CardInspector still appears in the generated playtest chunk, but its lazy resolver shape changed. Inspect the production bundle before shipping.");
  }
  console.log("[card-inspector-bundle] CardInspector is no longer lazy-loaded by the playtest chunk; no export bridge is required.");
  process.exit(0);
}

const targetName = lazyResolver[1];
const targetPath = path.join(assetsDir, targetName);
const targetSource = await readFile(targetPath, "utf8");
const exportsCardInspector = /export\{[^}]*\bas CardInspector\b[^}]*\}/s.test(targetSource);

if (!exportsCardInspector) {
  throw new Error(
    `Generated ${playtestName} resolves CardInspector from ${targetName}, but ${targetName} does not export CardInspector. This would crash Quick Duel with React error #306.`,
  );
}

console.log(`[card-inspector-bundle] verified ${playtestName} -> ${targetName} exports CardInspector`);
