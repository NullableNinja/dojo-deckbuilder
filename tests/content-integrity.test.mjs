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

test("rulings have stable IDs and filing dates", async () => {
  const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");
  for (let number = 1; number <= 8; number += 1) {
    assert.ok(source.includes(`DDB-RUL-${String(number).padStart(3, "0")}`));
  }
  assert.ok(source.includes("Filed Aug 27, 2026"));
});
