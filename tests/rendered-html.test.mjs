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
  const bundles = (await readdir(assetDirectory)).filter((name) => /^index-.*\.js$/.test(name));
  assert.equal(bundles.length, 1);
  const bundle = await readFile(new URL(bundles[0], assetDirectory), "utf8");
  for (const expected of ["Build this exact 15-card deck.", "Basic Jab", "High Guard", "Attacks", "Defenses", "Katas", "Junk", "Rita attacks Devin. Count the paper."]) {
    assert.ok(bundle.includes(expected), `Missing companion lesson content: ${expected}`);
  }
  assert.equal(bundle.match(/data:image\/webp;base64,/g)?.length ?? 0, 0, "Artwork should remain separately cacheable.");
});

test("public companion copy is version-free and uses the current featured roster", async () => {
  const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");
  for (const forbidden of ["v2.0 alpha field test", "complete v2.0 Core catalog", "Every defined v2.0 rules term", "Defined v2.0 term", "Rules source: v2.0"]) {
    assert.ok(!source.includes(forbidden), `Public version label survived: ${forbidden}`);
  }
  assert.ok(source.includes("Field test active"));
  for (const fighter of ["Honorable Trash Panda", "Karatesaurus", "Janitor Joe", "Miss Direction"]) {
    assert.ok(source.includes(`name: "${fighter}"`), `Featured roster is missing ${fighter}`);
  }
  assert.ok(!source.includes('assets/cards/characters/sentry-bobby.webp'));
  assert.ok(source.includes("publicCardDetails(card)"));
});

test("global search spans the whole companion", async () => {
  const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");
  for (const expected of ['type: "Rule"', 'type: "Ruling"', 'type: "Card"', 'type: "Glossary"', 'type: "House Rule"', 'placeholder="Search the dojo"']) {
    assert.ok(source.includes(expected), `Missing unified search behavior: ${expected}`);
  }
});
