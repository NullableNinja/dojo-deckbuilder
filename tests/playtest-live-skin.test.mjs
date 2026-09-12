import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const skin = readFileSync(new URL("../app/playtest-live-skin.css", import.meta.url), "utf8");
const playtest = readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");

function indexOfOrFail(haystack, needle) {
  const index = haystack.indexOf(needle);
  assert.notEqual(index, -1, `Expected to find ${needle}`);
  return index;
}

test("live skin loads after consolidated layout", () => {
  const layout = indexOfOrFail(main, 'import "../app/playtest-layout.css";');
  const liveSkin = indexOfOrFail(main, 'import "../app/playtest-live-skin.css";');
  assert.ok(liveSkin > layout, "live presentation must load after layout ownership");
});

test("top HUD owns framed HP bars and one centered round marker", () => {
  assert.match(playtest, /battle-hud-fighter battle-hud-fighter--player/);
  assert.match(playtest, /versus-center[^>]*aria-label=\{`Round \$\{match\.round\}`\}/);
  assert.match(skin, /\.battle-hud-fighter\s*\{/);
  assert.match(skin, /\.battle-hud-fighter i\s*\{[\s\S]*background:\s*#6c2b27;/);
  assert.match(skin, /fighter-column--player \.fighter-hp-track,[\s\S]*fighter-column--enemy \.fighter-hp-track\s*\{\s*display:\s*none;/);
  assert.match(skin, /\.versus-center\s*\{[\s\S]*justify-self:\s*center;/);
  assert.match(skin, /\.combat-stage-heading > div\s*\{\s*display:\s*none;/);
});

test("fighter presentation restores belt colors, status row, and bottom tools row", () => {
  for (const belt of ["white", "gold", "orange", "green", "purple", "blue", "red", "brown", "black"]) {
    assert.match(skin, new RegExp(`fighter-belt-badge\\[data-belt=\\"${belt}\\"\\]`));
  }
  assert.match(skin, /\.fighter-vitality,[\s\S]*\.fighter-panel\.is-enemy \.fighter-vitality\s*\{\s*display:\s*none;/);
  assert.match(skin, /\.fighter-status-tray,[\s\S]*grid-area:\s*status;/);
  assert.match(skin, /\.fighter-equipment-tabs,[\s\S]*grid-area:\s*tools;/);
});

test("Focus is a fourth stat tile rather than an oval seal", () => {
  assert.match(skin, /\.fighter-focus-seal,[\s\S]*border-radius:\s*6px 2px 7px 3px;/);
  assert.match(skin, /\.fighter-focus-seal,[\s\S]*background:\s*rgba\(255, 250, 236, \.68\);/);
});

test("hand is centered and primary action remains compact", () => {
  assert.match(skin, /\.play-card-row\s*\{[\s\S]*justify-content:\s*center;/);
  assert.match(skin, /\.hand-panel > header > \.playtest-action-dock\s*\{[\s\S]*width:\s*min\(560px, 100%\);/);
  assert.match(skin, /\.hand-panel > header > \.playtest-action-dock\s*\{[\s\S]*justify-self:\s*end;/);
});

test("Inspect controls use the Paper-Fu tab treatment", () => {
  assert.match(skin, /\.fighter-card-illustration > span:last-child,[\s\S]*\.play-card-inspect\s*\{/);
  assert.match(skin, /background:\s*#f2dfb8;/);
  assert.match(skin, /border-radius:\s*5px 2px 6px 3px;/);
});

test("Ascend uses its actual four-part DOM contract", () => {
  assert.match(playtest, /ascend-desk paper-stack[^`]*ascend-desk--functional/);
  assert.match(playtest, /className="ascend-desk-header"/);
  assert.match(playtest, /className="ascend-guide"/);
  assert.match(playtest, /className="ascend-desk-body"/);
  assert.match(playtest, /className="ascend-desk-footer"/);
  assert.match(skin, /\.ascend-desk\s*\{[\s\S]*grid-template-rows:\s*82px 50px minmax\(0, 1fr\) 62px;/);
});

test("Ascend Market fills the workspace and integrates the actual Featured Combo class", () => {
  assert.match(playtest, /<FeaturedComboPanel/);
  assert.match(skin, /\.ascend-desk--functional \.ascend-market:has\(\.ascend-featured-combo\)/);
  assert.match(skin, /\.ascend-market-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(7, 195px\);/);
  assert.match(skin, /\.ascend-market-grid \.play-card\s*\{[\s\S]*height:\s*350px;/);
  assert.match(skin, /\.ascend-desk-body\s*\{[\s\S]*width:\s*100%;/);
});

test("restored skin does not restart the old important-escalation stack", () => {
  assert.doesNotMatch(skin, /!important/);
});
