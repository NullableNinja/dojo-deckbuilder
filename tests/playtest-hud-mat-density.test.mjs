import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Live Mat sizes from content instead of stretching empty card lanes", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /HUD and live-mat density v11/);
  assert.match(css, /\.playtest-shell--live \.playtest-combat-desk[\s\S]*?height:\s*auto\s*!important[\s\S]*?grid-template-rows:\s*auto auto auto auto auto auto\s*!important/);
  assert.match(css, /\.playtest-shell--live \.live-mat-play[\s\S]*?min-height:\s*0\s*!important/);
  assert.match(css, /\.playtest-shell--live \.mat-lane[\s\S]*?height:\s*auto\s*!important/);
  assert.match(css, /\.fighter-column[\s\S]*?max-height:\s*clamp\(390px, 58vh, 480px\)\s*!important/);
});

test("Player and opponent combat stats share one stable HUD geometry", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(css, /\.fighter-dossier \.fighter-stats--combat > b[\s\S]*?grid-template-columns:\s*19px minmax\(0, 1fr\)/);
  assert.match(css, /> b > svg[\s\S]*?grid-row:\s*1 \/ 3/);
  assert.match(css, /fighter-dossier:not\(\.is-enemy\) \.fighter-loadout-launch/);
  assert.match(css, /fighter-dossier\.is-enemy \.fighter-loadout-launch/);
  assert.match(source, /const combatStats:[\s\S]*?enemy[\s\S]*?SPD[\s\S]*?DEF[\s\S]*?ATK[\s\S]*?:[\s\S]*?ATK[\s\S]*?DEF[\s\S]*?SPD/);
});
