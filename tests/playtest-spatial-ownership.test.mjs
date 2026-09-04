import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel shell uses block flow so hand and arena cannot share a grid cell", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /Board ownership v8 — live shell is block flow/);
  assert.match(css, /\.playtest-shell--live\s*\{[\s\S]*?display:\s*block\s*!important/);
  assert.match(css, /\.playtest-shell--live \.playtest-workspace--hand[\s\S]*?position:\s*static\s*!important[\s\S]*?grid-row:\s*auto\s*!important[\s\S]*?transform:\s*none\s*!important/);
  assert.doesNotMatch(css, /Board ownership v7 — natural board flow/);
  assert.doesNotMatch(css, /Live Mat \/ hand ownership fix — arena scrolls/);
});

test("center mat is stationary while complete fighter rails scroll independently", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /\.playtest-shell--live \.playtest-table[\s\S]*?height:\s*540px\s*!important/);
  assert.match(css, /\.playtest-shell--live \.playtest-combat-desk[\s\S]*?height:\s*540px\s*!important[\s\S]*?overflow:\s*hidden\s*!important/);
  assert.match(css, /\.playtest-shell--live \.fighter-column[\s\S]*?height:\s*540px\s*!important[\s\S]*?overflow-y:\s*auto\s*!important/);
});

test("Learned Combos use the whole player rail scrollbar rather than nesting one", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /fighter-combo-rack,[\s\S]*?active-combo-grid[\s\S]*?max-height:\s*none\s*!important[\s\S]*?overflow:\s*visible\s*!important/);
});

test("player and opponent fighter dossiers retain opposite readable orientations", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /fighter-panel\.fighter-dossier:not\(\.is-enemy\)[\s\S]*?grid-template-columns:\s*88px minmax\(0, 1fr\)/);
  assert.match(css, /fighter-panel\.fighter-dossier\.is-enemy[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 88px/);
});
