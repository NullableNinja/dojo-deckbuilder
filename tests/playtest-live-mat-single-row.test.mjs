import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Live Mat always uses one horizontal card row and never reserves a second row", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /Live Mat v12 — exactly one horizontal row per fighter/);
  assert.match(css, /\.mat-lane-cards[\s\S]*?flex-wrap:\s*nowrap\s*!important/);
  assert.match(css, /\.mat-lane-cards[\s\S]*?height:\s*88px\s*!important/);
  assert.match(css, /\.playtest-combat-desk[\s\S]*?grid-template-rows:\s*auto 120px auto auto auto auto\s*!important/);
  assert.doesNotMatch(css.slice(css.indexOf("Live Mat v12")), /repeat\(2[^)]*\)/);
});
