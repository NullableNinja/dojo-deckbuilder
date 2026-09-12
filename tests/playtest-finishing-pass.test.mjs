import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/playtest-finishing-pass.css", import.meta.url), "utf8");

function indexOfOrFail(haystack, needle) {
  const index = haystack.indexOf(needle);
  assert.notEqual(index, -1, `Expected to find ${needle}`);
  return index;
}

test("finishing pass loads after the Combo button presentation layer", () => {
  const combo = indexOfOrFail(main, 'import "../app/ascend-combo-button.css";');
  const finish = indexOfOrFail(main, 'import "../app/playtest-finishing-pass.css";');
  assert.ok(finish > combo, "finishing corrections must be the last CSS geometry authority");
});

test("hand owns the full live shell width", () => {
  assert.match(css, /playtest-workspace\.playtest-workspace--hand\s*\{[\s\S]*grid-column:\s*1 \/ -1;[\s\S]*width:\s*100%;[\s\S]*max-width:\s*none;/);
  assert.match(css, /playtest-workspace--hand > \.hand-panel\.paper-stack\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*none;/);
});

test("larger hands remain one horizontal row and scroll safely", () => {
  assert.match(css, /playtest-workspace--hand \.play-card-row\s*\{[\s\S]*flex-wrap:\s*nowrap;[\s\S]*justify-content:\s*safe center;[\s\S]*overflow-x:\s*auto;/);
  assert.match(css, /play-card-row \.play-card\s*\{\s*flex-shrink:\s*0;/);
});

test("Belt Check drops the legacy narrow cap and uses a composed full-width grid", () => {
  assert.match(css, /ascend-belt\.belt-panel\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*none;[\s\S]*grid-template-columns:\s*minmax\(0, 1\.25fr\) minmax\(320px, \.75fr\);/);
  assert.match(css, /grid-template-areas:[\s\S]*"belt-eyebrow belt-track"[\s\S]*"belt-ledger belt-ledger"[\s\S]*"belt-promote belt-promote"/);
  assert.match(css, /belt-ledger-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);[\s\S]*max-height:\s*none;/);
});

test("Belt Check content fits its real height instead of stretching the dialog", () => {
  assert.match(css, /ascend-desk\.ascend-desk--functional:has\(\.ascend-belt\)\s*\{[\s\S]*height:\s*auto;[\s\S]*min-height:\s*0;[\s\S]*grid-template-rows:\s*82px 54px auto 62px;/);
});

test("Previous review and Finish Ascend actions share the same 42px row", () => {
  assert.match(css, /ascend-guide-actions > div\s*\{[\s\S]*min-height:\s*42px;[\s\S]*height:\s*42px;[\s\S]*align-items:\s*center;/);
  assert.match(css, /ascend-guide-actions > div > \.button\s*\{[\s\S]*height:\s*42px;[\s\S]*min-height:\s*42px;[\s\S]*margin:\s*0;/);
});

test("finishing pass does not use important escalation", () => {
  assert.doesNotMatch(css, /!important/);
});
