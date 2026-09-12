import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("renders the static GitHub Pages shell with mobile metadata", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0" \/>/);
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /\/dojo-deckbuilder\/assets\/index-[^"']+\.js/);
});

test("bundles the interactive Starter Deck lesson from canonical card and rule data", async () => {
  const assetDirectory = new URL("../dist/assets/", import.meta.url);
  const bundles = (await readdir(assetDirectory)).filter((name) => /^index-.*\.js$/.test(name));
  assert.equal(bundles.length, 1);
  const bundle = await readFile(new URL(bundles[0], assetDirectory), "utf8");
  const [companion, presentation, rules] = await Promise.all([
    readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/canonical-presentation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/rules.json", import.meta.url), "utf8"),
  ]);

  for (const expected of ["Build this exact 15-card deck.", "Rita attacks Devin. Count the paper."]) {
    assert.ok(bundle.includes(expected), `Missing companion lesson UI content: ${expected}`);
  }
  for (const expected of ["Basic Jab", "High Guard", "Attacks", "Defenses", "Katas", "Junk"]) {
    assert.ok(rules.includes(expected), `Missing canonical Starter Deck content: ${expected}`);
  }
  assert.match(companion, /CANONICAL_STARTER_CARDS\.map/);
  assert.match(companion, /STARTER_EXAMPLES\.basicJab/);
  assert.match(companion, /STARTER_EXAMPLES\.highGuard/);
  assert.match(presentation, /standard-starter-deck/);
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

test("global search spans the whole companion through the shared canonical engine", async () => {
  const [source, search] = await Promise.all([
    readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/search.ts", import.meta.url), "utf8"),
  ]);

  for (const expected of ['type: "card"', 'type: "rule"', 'type: "glossary"', 'type: "ruling"', 'type: "house-rule"']) {
    assert.ok(search.includes(expected), `Missing shared search result family: ${expected}`);
  }
  assert.match(search, /CANONICAL_RULES/);
  assert.match(source, /searchDojo\(globalSearch\)/);
  assert.match(source, /placeholder="Search the dojo"/);
  assert.match(source, /navigate\(\{ page: "search", query \}\)/);
});

test("Quick Duel has a stable static render boundary and missing artwork is presented intentionally", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /import PlaytestView from "\.\/playtest";/);
  assert.match(source, /const CardInspector = lazy/);
  assert.match(source, /<Suspense fallback=\{null\}><CardInspector/);
  assert.match(source, /card-art--pending/);
  assert.match(css, /ARTWORK PENDING · FORM 37-B/);
});
