import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Live Mat shows the complete play area in horizontally scrollable ledgers", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8");
  assert.match(source, /const visible = cardIds;/);
  assert.doesNotMatch(source, /cardIds\.slice\(-4\)/);
  assert.match(css, /\.live-mat-play--stage \.mat-lane-cards \{[^}]*display:\s*flex[^}]*overflow-x:\s*auto/);
});

test("fighter inspector contains fallback Equipment artwork and uses fixed two-pane geometry", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8");
  assert.match(css, /playtest-inspector\.is-fighter-dossier \.inspector-heading \{[^}]*grid-template-columns:\s*minmax\(210px, 285px\) minmax\(0, 1fr\)/);
  assert.match(css, /\.equipment-slot-art \{[^}]*overflow:\s*hidden/);
  assert.match(source, /artistUrl\(item\) \? <img src=\{artistUrl\(item\)\} alt="" \/> : <NativeCardArt card=\{item\} \/>/);
});
