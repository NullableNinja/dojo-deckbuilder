import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel keeps the Live Mat stationary and scrolls fighter rails independently", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /Board ownership v6/);
  assert.match(css, /grid-template-rows:\s*54px minmax\(0, 1fr\) clamp\(225px, 27dvh, 265px\)/);
  assert.match(css, /\.playtest-shell--live \.playtest-arena[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.playtest-shell--live \.fighter-column[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /\.playtest-shell--live \.playtest-combat-desk[\s\S]*?height:\s*100%/);
  assert.match(css, /\.playtest-shell--live \.playtest-workspace--hand[\s\S]*?z-index:\s*20/);
  assert.match(css, /\.play-card-row \.play-card-main[\s\S]*?height:\s*clamp\(164px, 19dvh, 198px\)/);
});

test("player fighter dossier keeps an explicit left-facing layout", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /fighter-panel\.fighter-dossier:not\(\.is-enemy\)[\s\S]*?grid-template-columns:\s*88px minmax\(0, 1fr\)/);
  assert.match(css, /fighter-panel\.fighter-dossier:not\(\.is-enemy\) \.fighter-panel-copy[\s\S]*?text-align:\s*left/);
  assert.match(css, /fighter-panel\.fighter-dossier:not\(\.is-enemy\) \.fighter-stats--combat > b[\s\S]*?grid-template-columns:\s*18px minmax\(0, 1fr\) auto/);
  assert.match(css, /fighter-panel\.fighter-dossier:not\(\.is-enemy\) \.fighter-loadout-launch[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto auto/);
});

test("opponent fighter dossier remains the true inward-facing mirror", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /fighter-panel\.fighter-dossier\.is-enemy[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 88px/);
  assert.match(css, /fighter-panel\.fighter-dossier\.is-enemy \.fighter-panel-copy[\s\S]*?text-align:\s*right/);
  assert.match(css, /fighter-panel\.fighter-dossier\.is-enemy \.fighter-loadout-launch[\s\S]*?grid-template-columns:\s*auto auto minmax\(0, 1fr\)/);
});
