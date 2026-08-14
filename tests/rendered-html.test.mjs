import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("renders the static GitHub Pages shell with mobile metadata", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0" \/>/);
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /\/dojo-deckbuilder\/assets\/index-[^"']+\.js/);
});

test("bundles the interactive Starter Deck lesson and both card examples", async () => {
  const assetDirectory = new URL("../dist/assets/", import.meta.url);
  const companionBundles = (await readdir(assetDirectory)).filter((name) => /^index-.*\.js$/.test(name));
  assert.equal(companionBundles.length, 1);

  const bundle = await readFile(new URL(companionBundles[0], assetDirectory), "utf8");
  for (const expected of ["Build this exact 15-card deck.", "Basic Jab", "High Guard", "Attacks", "Defenses", "Katas", "Junk"]) {
    assert.ok(bundle.includes(expected), `Missing Starter Deck lesson content: ${expected}`);
  }

  const embeddedWebpImages = bundle.match(/data:image\/webp;base64,/g)?.length ?? 0;
  assert.equal(embeddedWebpImages, 0, "Starter art should remain a separately cacheable asset on mobile.");
  const starterArt = (await readdir(assetDirectory)).filter((name) => /(?:starter-jab-art|high-guard-art)-.*\.webp$/.test(name));
  assert.equal(starterArt.length, 2);
});

test("bundles the interactive worked combat example", async () => {
  const assetDirectory = new URL("../dist/assets/", import.meta.url);
  const companionBundles = (await readdir(assetDirectory)).filter((name) => /^index-.*\.js$/.test(name));
  assert.equal(companionBundles.length, 1);

  const bundle = await readFile(new URL(companionBundles[0], assetDirectory), "utf8");
  for (const expected of ["Rita attacks Devin. Count the paper.", "Wild Swing", "Desperate Cover", "Remove Devin’s Defense", "Devin loses 0 HP.", "Devin loses "]) {
    assert.ok(bundle.includes(expected), `Missing worked combat content: ${expected}`);
  }
});

test("defaults the Card Library to Core Game with balanced controls", async () => {
  const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");
  assert.match(source, /useState\(CORE_EXPANSION\)/);
  assert.match(source, /setExpansion\(CORE_EXPANSION\)/);
  assert.match(source, /library-search-control/);
  assert.match(source, /cardsInScope\.length/);
});
