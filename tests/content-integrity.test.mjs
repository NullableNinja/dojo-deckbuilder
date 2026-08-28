import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("glossary terms are unique", async () => {
  const rules = JSON.parse(await readFile(new URL("../app/data/rules.json", import.meta.url), "utf8"));
  const normalized = rules.glossary.map((entry) => entry.term.trim().toLocaleLowerCase());
  assert.equal(new Set(normalized).size, normalized.length, "Glossary contains duplicate terms");
  for (const term of ["Belt Exam", "Boss Profile", "Ready", "Reversal"]) {
    assert.equal(rules.glossary.filter((entry) => entry.term === term).length, 1, `Expected one glossary entry for ${term}`);
  }
});

test("deployment gates publication on the test suite", async () => {
  const workflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
  assert.match(workflow, /run: npm test/);
});

test("deployment stamps a build fingerprint and cache-busts the app shell", async () => {
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const entry = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
  const workflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
  assert.match(index, /name="ddb-build" content="__DDB_BUILD__"/);
  assert.match(index, /Cache-Control/);
  assert.match(entry, /build\.json\?ts=/);
  assert.match(entry, /cache: "no-store"/);
  assert.match(entry, /_ddb_build/);
  assert.match(workflow, /Stamp deployment and bust stale app-shell caches/);
  assert.match(workflow, /build\.json/);
});

test("rulings have stable IDs and filing dates", async () => {
  const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");
  for (let number = 1; number <= 8; number += 1) {
    assert.ok(source.includes(`DDB-RUL-${String(number).padStart(3, "0")}`));
  }
  assert.ok(source.includes("Filed Aug 27, 2026"));
});

test("rendered glossary deduplicates terms at the UI boundary", async () => {
  const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");
  assert.match(source, /const GLOSSARY_ENTRIES = Array\.from\(new Map/);
  assert.match(source, /const glossaryKey =/);
  assert.ok(!source.includes("rulesData.glossary.filter("), "Glossary rendering/search must use the deduplicated collection");
  assert.ok(source.includes("{GLOSSARY_ENTRIES.length} terms"), "Glossary count must reflect the deduplicated collection");
});
