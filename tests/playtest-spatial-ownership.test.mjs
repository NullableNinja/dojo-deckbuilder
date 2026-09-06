import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel shell uses block flow so hand and arena cannot share a grid cell", async () => {
  const css = await readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8");
  assert.match(css, /\.playtest-shell\.playtest-shell--live,[\s\S]*?display:\s*block/);
  assert.match(css, /\.playtest-shell--live \.playtest-workspace--hand \{[^}]*display:\s*block[^}]*margin-top:\s*8px/);
  assert.match(css, /\.playtest-arena \{[^}]*display:\s*grid/);
});

test("center mat is stationary while complete fighter rails scroll independently", async () => {
  const css = await readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8");
  assert.match(css, /\.playtest-shell--live \.playtest-table \{[^}]*height:\s*560px/);
  assert.match(css, /\.playtest-shell--live \.combat-stage \{[^}]*height:\s*560px[^}]*overflow:\s*hidden/);
  assert.match(css, /\.fighter-column \{[^}]*height:\s*560px[^}]*overflow-y:\s*auto/);
});

test("Learned Combos use the whole player rail scrollbar rather than nesting one", async () => {
  const css = await readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8");
  assert.match(css, /\.fighter-combo-rack \.active-combo-grid \{[^}]*max-height:\s*none[^}]*overflow:\s*visible/);
});

test("player and opponent fighter dossiers retain opposite readable orientations", async () => {
  const css = await readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8");
  assert.match(css, /\.is-enemy \.fighter-dossier-name \{[^}]*text-align:\s*right/);
  assert.match(css, /\.is-enemy \.fighter-vitality > div \{[^}]*flex-direction:\s*row-reverse/);
  assert.match(css, /\.is-enemy \.fighter-card-illustration img \{[^}]*transform:\s*scaleX\(-1\)/);
});
