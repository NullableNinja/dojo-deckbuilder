import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

test("builds a GitHub Pages index with repository-relative assets", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Dojo Deckbuilder<\/title>/);
  assert.match(html, /\/dojo-deckbuilder\/assets\//);
  assert.doesNotMatch(html, /localhost|terminal\.local|nullableninja\.chatgpt\.site/);
});

test("bundles the complete interactive companion", async () => {
  const assetDirectory = new URL("../dist/assets/", import.meta.url);
  const scripts = (await readdir(assetDirectory)).filter((name) => name.endsWith(".js"));
  const mainScript = scripts.find((name) => name.startsWith("index-"));
  const workerScript = scripts.find((name) => name.startsWith("simulation-worker-"));
  assert.ok(mainScript, "Expected the main application bundle");
  assert.ok(workerScript, "Expected a separately cacheable background simulation worker");
  const bundle = await readFile(new URL(mainScript, assetDirectory), "utf8");
  for (const expected of ["Quick Start", "Card Library", "Rulings & Errata", "Glossary", "House Rules", "Rita attacks Devin. Count the paper."]) {
    assert.ok(bundle.includes(expected), `Missing site content: ${expected}`);
  }
  const embeddedWebpImages = bundle.match(/data:image\/webp;base64,/g)?.length ?? 0;
  assert.equal(embeddedWebpImages, 0, "Artwork should be cacheable files, not embedded in the JavaScript bundle.");
  const webpAssets = (await readdir(assetDirectory)).filter((name) => name.endsWith(".webp"));
  assert.ok(webpAssets.length >= 17, `Expected emitted WebP artwork; found ${webpAssets.length} files.`);
  const bundleSize = (await stat(new URL(mainScript, assetDirectory))).size;
  assert.ok(bundleSize < 1_500_000, `JavaScript bundle is too large for a mobile-first companion: ${bundleSize} bytes.`);
});
