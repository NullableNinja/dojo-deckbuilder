import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel gives Live Mat and hand separate non-overlapping layout ownership", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /Live Mat \/ hand ownership fix/);
  assert.match(css, /grid-template-rows:\s*54px minmax\(0, 1fr\) auto/);
  assert.match(css, /\.playtest-shell--live \.playtest-arena[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /\.playtest-shell--live \.playtest-combat-desk[\s\S]*?min-height:\s*0\s*!important/);
  assert.match(css, /\.playtest-shell--live \.playtest-workspace--hand[\s\S]*?z-index:\s*12/);
  assert.match(css, /\.play-card-row:empty[\s\S]*?display:\s*none/);
});

test("opponent fighter dossier is a true mirror of the player dossier", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /Opponent dossier mirror/);
  assert.match(css, /fighter-panel\.is-enemy[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 92px/);
  assert.match(css, /fighter-panel\.is-enemy \.fighter-panel-art[\s\S]*?grid-column:\s*2/);
  assert.match(css, /fighter-panel\.is-enemy \.fighter-panel-copy[\s\S]*?text-align:\s*right/);
  assert.match(css, /fighter-panel\.is-enemy \.fighter-stats--combat[\s\S]*?direction:\s*rtl/);
  assert.match(css, /fighter-panel\.is-enemy \.fighter-loadout-launch[\s\S]*?grid-template-columns:\s*auto auto 1fr/);
});
