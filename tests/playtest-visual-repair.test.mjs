import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const repair = readFileSync(new URL("../app/playtest-visual-repair.css", import.meta.url), "utf8");
const playtest = readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");

function indexOfOrFail(haystack, needle) {
  const index = haystack.indexOf(needle);
  assert.notEqual(index, -1, `Expected to find ${needle}`);
  return index;
}

test("production visual repair loads after the consolidated live skin", () => {
  const skin = indexOfOrFail(main, 'import "../app/playtest-live-skin.css";');
  const repairImport = indexOfOrFail(main, 'import "../app/playtest-visual-repair.css";');
  assert.ok(repairImport > skin, "break/fix presentation must load after the live skin");
});

test("battle HUD cards fit inside their shared backing frame", () => {
  assert.match(repair, /playtest-topbar\.battle-versus-hud\s*\{[\s\S]*height:\s*80px;[\s\S]*padding:\s*8px 12px;/);
  assert.match(repair, /battle-versus-hud > \.battle-hud-fighter\s*\{[\s\S]*height:\s*62px;[\s\S]*align-self:\s*center;/);
});

test("location header no longer reserves the hidden Round column", () => {
  assert.match(playtest, /combat-stage-heading/);
  assert.match(repair, /\.combat-stage-heading\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(repair, /\.combat-stage-heading > button\s*\{[\s\S]*grid-column:\s*1 \/ -1;[\s\S]*width:\s*100%;/);
  assert.match(repair, /\.combat-stage-heading > div\s*\{\s*display:\s*none;/);
});

test("fighter abilities receive readable type and dedicated vertical space", () => {
  assert.match(repair, /grid-template-rows:\s*50px minmax\(150px, 1fr\) 46px 42px 28px minmax\(96px, 110px\) 40px;/);
  assert.match(repair, /\.fighter-ability,[\s\S]*font-size:\s*clamp\(10px, \.72vw, 11\.5px\);[\s\S]*line-height:\s*1\.45;/);
  assert.match(repair, /data-theme="dark"[\s\S]*\.fighter-ability[\s\S]*color:\s*#e5eee8;/);
});

test("Ascend owns four explicit rows at the consolidated selector strength", () => {
  assert.match(playtest, /className="ascend-desk-header"/);
  assert.match(playtest, /className="ascend-guide"/);
  assert.match(playtest, /className="ascend-desk-body"/);
  assert.match(playtest, /className="ascend-desk-footer"/);
  assert.match(repair, /ascend-desk-backdrop > \.ascend-desk\.ascend-desk--functional\s*\{\s*grid-template-rows:\s*82px 54px minmax\(0, 1fr\) 62px;/);
  assert.match(repair, /> \.ascend-guide\s*\{[\s\S]*grid-row:\s*2;/);
  assert.match(repair, /> \.ascend-desk-body\s*\{[\s\S]*grid-row:\s*3;/);
  assert.match(repair, /> \.ascend-desk-footer\s*\{\s*grid-row:\s*4;/);
});

test("Acquisition Desk removes the Combo-sized blank shelf above Market cards", () => {
  assert.match(repair, /ascend-market:has\(\.ascend-featured-combo\)\s*\{[\s\S]*grid-template-rows:\s*auto 366px;/);
  assert.match(repair, /> \.ascend-market-grid\s*\{[\s\S]*height:\s*366px;[\s\S]*align-content:\s*start;/);
  assert.match(repair, /> \.ascend-featured-combo\s*\{[\s\S]*max-height:\s*420px;[\s\S]*overflow:\s*auto;/);
  assert.match(repair, /\.ascend-featured-combo-card\s*\{[\s\S]*max-width:\s*218px;[\s\S]*max-height:\s*292px;/);
});

test("Acquisition Desk shrink-wraps its one-row Market instead of stretching to viewport height", () => {
  assert.match(repair, /ascend-desk\.ascend-desk--functional:has\(\.ascend-market\)\s*\{[\s\S]*height:\s*auto;[\s\S]*min-height:\s*0;[\s\S]*grid-template-rows:\s*82px 54px auto 62px;/);
  assert.match(repair, /ascend-desk--functional:has\(\.ascend-market\) > \.ascend-desk-body\s*\{[\s\S]*max-height:\s*calc\(100dvh - 238px\);[\s\S]*overflow-y:\s*auto;/);
  assert.match(repair, /ascend-desk--functional:has\(\.ascend-market\) \.ascend-market\s*\{\s*min-height:\s*0;/);
  assert.match(repair, /ascend-market:has\(\.ascend-featured-combo\)\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(300px, 330px\);[\s\S]*grid-template-rows:\s*auto 366px;/);
});

test("visual break/fix does not use important escalation", () => {
  assert.doesNotMatch(repair, /!important/);
});
