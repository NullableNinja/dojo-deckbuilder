import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/playtest-last-mile.css", import.meta.url), "utf8");

function indexOfOrFail(haystack, needle) {
  const index = haystack.indexOf(needle);
  assert.notEqual(index, -1, `Expected to find ${needle}`);
  return index;
}

test("last-mile repair loads after the Combo popout hook", () => {
  const popout = indexOfOrFail(main, 'import "../app/ascend-combo-popout";');
  const lastMile = indexOfOrFail(main, 'import "../app/playtest-last-mile.css";');
  assert.ok(lastMile > popout);
});

test("hand is forced to the full live shell width", () => {
  assert.match(css, /playtest-workspace\.playtest-workspace--hand\s*\{[\s\S]*width:\s*100% !important;[\s\S]*max-width:\s*none !important;/);
  assert.match(css, /hand-panel\.paper-stack\s*\{[\s\S]*width:\s*100% !important;[\s\S]*max-width:\s*none !important;/);
  assert.match(css, /play-card-row\s*\{[\s\S]*flex-wrap:\s*nowrap !important;[\s\S]*overflow-x:\s*auto !important;/);
});

test("fighter Combo launcher has a readable two-part compact layout", () => {
  assert.match(css, /fighter-combo-launch\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto !important;[\s\S]*gap:\s*6px !important;/);
  assert.match(css, /fighter-combo-launch > small\s*\{\s*display:\s*none !important;/);
});

test("expanded Combo is anchored to the whole Acquisition Market", () => {
  assert.match(css, /ascend-market\s*\{[\s\S]*position:\s*relative !important;[\s\S]*overflow:\s*visible !important;/);
  assert.match(css, /ascend-featured-combo\[data-combo-popout="ready"\]\.is-open\s*\{[\s\S]*inset:\s*54px 0 auto 0 !important;[\s\S]*width:\s*auto !important;[\s\S]*max-width:\s*none !important;/);
});

test("Acquisition footer keeps helper text and continue action on one compact row", () => {
  assert.match(css, /:has\(\.ascend-market\)\s*\{[\s\S]*grid-template-rows:\s*82px 54px auto 52px !important;/);
  assert.match(css, /ascend-guide-actions > div\s*\{[\s\S]*display:\s*flex !important;[\s\S]*flex-direction:\s*row !important;/);
});
