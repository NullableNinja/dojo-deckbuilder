import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Live Mat keeps a fixed combat canvas while its ledgers stay compact", async () => {
  const css = await readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8");
  assert.match(css, /\.playtest-shell--live \.playtest-table \{[^}]*height:\s*560px/);
  assert.match(css, /\.playtest-shell--live \.combat-stage \{[^}]*height:\s*560px[^}]*overflow:\s*hidden/);
  assert.match(css, /\.live-mat-play--stage \{[^}]*min-height:\s*0/);
  assert.match(css, /\.live-mat-play--stage \.mat-lane-cards \{[^}]*height:\s*56px/);
  assert.match(css, /\.fighter-column \{[^}]*height:\s*560px[^}]*overflow-y:\s*auto/);
});

test("Player and opponent combat stats share one stable fighter-card geometry", async () => {
  const css = await readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8");
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(css, /\.fighter-stats--combat \{[^}]*grid-template-columns:\s*repeat\(3/);
  assert.match(css, /\.fighter-stats--combat > b \{[^}]*grid-template-columns:\s*23px minmax\(0, 1fr\)/);
  assert.match(css, /\.fighter-stats--combat \.fighter-stat-glyph \{[^}]*grid-row:\s*1 \/ 3/);
  assert.match(source, /const combatStats:[\s\S]*?ATK[\s\S]*?DEF[\s\S]*?SPD[\s\S]*?\];/);
  assert.match(source, /<FighterEquipmentTabs board=\{board\} enemy=\{enemy\}/);
});
