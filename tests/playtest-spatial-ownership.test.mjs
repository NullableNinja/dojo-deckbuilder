import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel keeps the mat in natural flow and gives vertical scrolling only to fighter rails", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /Board ownership v7 — natural board flow, scrollable fighter rails/);
  assert.match(css, /\.playtest-shell--live\s*\{[\s\S]*?height:\s*auto\s*!important[\s\S]*?grid-template-rows:\s*auto auto auto/);
  assert.match(css, /\.playtest-shell--live \.playtest-arena[\s\S]*?overflow:\s*visible\s*!important/);
  assert.match(css, /\.playtest-shell--live \.playtest-combat-desk[\s\S]*?min-height:\s*540px\s*!important/);
  assert.match(css, /\.playtest-shell--live \.fighter-column[\s\S]*?max-height:\s*540px\s*!important[\s\S]*?overflow-y:\s*auto\s*!important/);
  assert.match(css, /\.playtest-shell--live \.playtest-workspace--hand[\s\S]*?margin-top:\s*18px\s*!important[\s\S]*?overflow:\s*visible\s*!important/);
  assert.doesNotMatch(css, /Board ownership v6 — stationary mat, independent side rails/);
});

test("Learned Combos use the player rail scrollbar instead of nesting another vertical scrollbar", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /fighter-combo-rack[\s\S]*?max-height:\s*none\s*!important[\s\S]*?overflow:\s*visible\s*!important/);
  assert.match(css, /fighter-combo-rack \.active-combo-grid[\s\S]*?max-height:\s*none\s*!important[\s\S]*?overflow:\s*visible\s*!important/);
});

test("player and opponent fighter dossiers retain opposite readable orientations", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /fighter-panel\.fighter-dossier:not\(\.is-enemy\)[\s\S]*?grid-template-columns:\s*88px minmax\(0, 1fr\)/);
  assert.match(css, /fighter-panel\.fighter-dossier:not\(\.is-enemy\) \.fighter-stats--combat > b[\s\S]*?grid-template-columns:\s*20px minmax\(0, 1fr\) auto/);
  assert.match(css, /fighter-panel\.fighter-dossier\.is-enemy[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 88px/);
  assert.match(css, /fighter-panel\.fighter-dossier\.is-enemy \.fighter-panel-copy[\s\S]*?text-align:\s*right/);
});
