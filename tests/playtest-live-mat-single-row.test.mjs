import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Live Mat always uses one horizontal card row and never reserves a second row", async () => {
  const css = await readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8");
  assert.match(css, /\.live-mat-play--stage \.mat-lane-cards \{[^}]*display:\s*flex[^}]*flex-wrap:\s*nowrap[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.live-mat-play--stage \.mat-lane-cards > button \{[^}]*flex:\s*0 0 72px/);
  assert.match(css, /\.playtest-shell--live \.combat-stage \{[^}]*grid-template-rows:\s*auto minmax\(155px, 1\.55fr\) auto 80px minmax\(88px, auto\) auto/);
});
