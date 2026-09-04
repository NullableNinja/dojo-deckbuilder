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

test("opponent fighter dossier is a structural mirror and the stage owns the right rail", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(css, /Board density v5/);
  assert.match(css, /fighter-panel\.fighter-dossier\.is-enemy[\s\S]*?grid-template-areas:[\s\S]*?"copy art"/);
  assert.match(source, /enemy \? <>\{identity\}\{portrait\}<\/> : <>\{portrait\}\{identity\}<\/>/);
  assert.match(source, /playtest-stage-rail/);
  assert.doesNotMatch(source, /className="playtest-location paper-stack"/);
});
