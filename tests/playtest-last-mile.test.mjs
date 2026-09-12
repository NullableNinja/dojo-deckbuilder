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

test("hand removes the legacy 190px rail instead of only changing width", () => {
  assert.match(css, /playtest-workspace\.playtest-workspace--hand\s*\{[\s\S]*width:\s*100% !important;[\s\S]*display:\s*block !important;[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) !important;[\s\S]*gap:\s*0 !important;/);
  assert.match(css, /hand-panel\.paper-stack\s*\{[\s\S]*width:\s*100% !important;[\s\S]*max-width:\s*none !important;/);
  assert.match(css, /play-card-row\s*\{[\s\S]*flex-wrap:\s*nowrap !important;[\s\S]*justify-content:\s*safe center !important;[\s\S]*overflow-x:\s*auto !important;/);
});

test("fighter Combo launcher is a styled readable two-part control", () => {
  assert.match(css, /fighter-combo-launch\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto !important;/);
  assert.match(css, /fighter-combo-launch\s*\{[\s\S]*gap:\s*7px !important;/);
  assert.match(css, /fighter-combo-launch\s*\{[\s\S]*background:\s*linear-gradient\([\s\S]*!important;/);
  assert.match(css, /fighter-combo-launch > small\s*\{\s*display:\s*none !important;/);
});

test("expanded Combo explicitly escapes the collapsed launcher grid area", () => {
  assert.match(css, /ascend-market\s*\{[\s\S]*position:\s*relative !important;[\s\S]*overflow:\s*visible !important;/);
  assert.match(css, /ascend-featured-combo\[data-combo-popout="ready"\]\.is-open\s*\{[\s\S]*grid-area:\s*unset !important;[\s\S]*left:\s*0 !important;[\s\S]*right:\s*0 !important;[\s\S]*width:\s*100% !important;[\s\S]*min-width:\s*100% !important;/);
});

test("Acquisition desk shrink-wraps its real content and keeps a compact footer", () => {
  assert.match(css, /ascend-desk-backdrop > \.ascend-desk\.ascend-desk--functional:has\(\.ascend-market\)\s*\{[\s\S]*height:\s*auto !important;[\s\S]*min-height:\s*0 !important;[\s\S]*grid-template-rows:\s*82px 54px auto 52px !important;/);
  assert.match(css, /ascend-desk-body\s*\{[\s\S]*height:\s*auto !important;[\s\S]*max-height:\s*calc\(100dvh - 238px\) !important;/);
});

test("Belt Check removes the helper sentence from layout and keeps both actions on one compact row", () => {
  assert.match(css, /ascend-guide-actions > div > small\s*\{\s*display:\s*none !important;/);
  assert.match(css, /ascend-guide-actions\s*\{[\s\S]*display:\s*flex !important;[\s\S]*align-items:\s*center !important;[\s\S]*gap:\s*10px !important;/);
  assert.match(css, /ascend-desk-backdrop > \.ascend-desk\.ascend-desk--functional:has\(\.ascend-belt\)\s*\{[\s\S]*grid-template-rows:\s*82px 54px auto 52px !important;/);
  assert.match(css, /ascend-desk\.ascend-desk--functional:has\(\.ascend-belt\) > \.ascend-desk-footer\s*\{[\s\S]*height:\s*52px !important;[\s\S]*min-height:\s*52px !important;[\s\S]*max-height:\s*52px !important;/);
});
