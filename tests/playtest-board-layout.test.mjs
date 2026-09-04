import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel board keeps HP in the versus HUD and moves secondary systems off the Live Mat", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fighter-hp-track/);
  assert.match(source, /fighter-column--player/);
  assert.match(source, /LearnedComboRack states=\{learnedComboStates\}/);
  assert.match(source, /fighter-loadout-launch/);
});

test("fighter inspection exposes slotted equipment and a true zoom state", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(source, /LOADOUT_SLOTS/);
  assert.match(source, /inspector-loadout-grid/);
  assert.match(source, /equipmentSlotLabel/);
  assert.match(css, /playtest-inspector\.is-zoomed/);
  assert.match(css, /minmax\(480px, 650px\)/);
});

test("Live Mat cards use a real non-overlapping grid", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /\.mat-lane-cards[\s\S]*display: grid !important/);
  assert.match(css, /\.mat-lane-cards > button[\s\S]*position: relative !important/);
  assert.match(css, /\.playtest-location[\s\S]*text-overflow: ellipsis/);
});
