import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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
  assert.equal(scripts.length, 1);
  const bundle = await readFile(new URL(scripts[0], assetDirectory), "utf8");
  for (const expected of ["Quick Start", "Card Library", "Rulings & Errata", "Glossary", "House Rules", "Rita attacks Devin. Count the paper."]) {
    assert.ok(bundle.includes(expected), `Missing site content: ${expected}`);
  }
  const embeddedWebpImages = bundle.match(/data:image\/webp;base64,/g)?.length ?? 0;
  assert.ok(embeddedWebpImages >= 17, `Expected embedded artwork; found ${embeddedWebpImages} images.`);
});
