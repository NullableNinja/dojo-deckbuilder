import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Live Mat shows the complete play area in horizontally scrollable ledgers", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(source, /const visible = cardIds;/);
  assert.doesNotMatch(source, /cardIds\.slice\(-4\)/);
  assert.match(css, /\.mat-lane-cards[\s\S]*?display:\s*flex\s*!important[\s\S]*?overflow-x:\s*auto\s*!important/);
});

test("fighter inspector contains fallback Equipment artwork and uses fixed two-pane geometry", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /playtest-inspector\.is-fighter-dossier[\s\S]*?height:\s*min\(760px, 88dvh\)/);
  assert.match(css, /equipment-slot-art[\s\S]*?contain:\s*layout paint/);
  assert.match(css, /equipment-slot-art > \.native-card-art[\s\S]*?position:\s*relative\s*!important/);
});
