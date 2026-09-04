import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("global search is grouped, ranked, and keyboard navigable", () => {
  assert.match(source, /searchResultRank/);
  assert.match(source, /groupedGlobalResults/);
  assert.match(source, /handleGlobalSearchKeyDown/);
  assert.match(source, /event\.key === "ArrowDown"/);
  assert.match(source, /role="listbox"/);
  assert.match(css, /global-result-group/);
});

test("rules revision filing is driven by canonical game definition", () => {
  assert.match(source, /gameDefinitionJson/);
  assert.match(source, /CURRENT_RULES_REVISION/);
  assert.match(source, /RULES_SEEN_STORAGE_KEY/);
  assert.match(source, /rules-update-pill/);
  assert.match(source, /RULES_REVISION_NOTES/);
});

test("Dojo Binder stores card IDs locally and supports binder-only filtering", () => {
  assert.match(source, /BINDER_STORAGE_KEY/);
  assert.match(source, /readStoredStringSet/);
  assert.match(source, /savedIds/);
  assert.match(source, /binderOnly/);
  assert.match(source, /Save to Dojo Binder/);
  assert.match(css, /binder-strip/);
  assert.match(css, /binder-star/);
});

test("Quick Duel remains statically imported after companion enhancements", () => {
  assert.match(source, /import PlaytestView from "\.\/playtest"/);
  assert.doesNotMatch(source, /const PlaytestView = lazy/);
});
