import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel keeps exact HP on each living fighter card and attaches its secondary systems", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /living-fighter-card/);
  assert.match(source, /fighter-hp-track/);
  assert.match(source, /fighter-column--player/);
  assert.match(source, /data-side=\{enemy \? "ai" : "player"\}/);
  assert.match(source, /LearnedComboRack states=\{learnedComboStates\}/);
  assert.match(source, /fighter-loadout-launch/);
});

test("fighter inspection exposes slotted equipment and a true zoom state", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  const css = (await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8"),
  ])).join("\n");
  assert.match(source, /LOADOUT_SLOTS/);
  assert.match(source, /inspector-loadout-grid/);
  assert.match(source, /equipmentSlotLabel/);
  assert.match(css, /playtest-inspector\.is-zoomed/);
  assert.match(css, /playtest-inspector \.inspector-heading \{[^}]*grid-template-columns:\s*minmax\(240px, 340px\) minmax\(0, 1fr\)/);
});

test("Live Mat cards use a real non-overlapping single-row ledger", async () => {
  const css = await readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8");
  assert.match(css, /\.live-mat-play--stage \.mat-lane-cards \{[^}]*display:\s*flex[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.live-mat-play--stage \.mat-lane-cards > button \{[^}]*position:\s*relative[^}]*flex:\s*0 0 72px/);
  assert.match(css, /\.combat-stage-heading > button b \{[^}]*text-overflow:\s*ellipsis/);
});
