import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel has explicit wide, laptop, and compact-desktop layout tiers", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /Desktop responsiveness v10/);
  assert.match(css, /max-width:\s*1379px[\s\S]*?min-width:\s*1101px/);
  assert.match(css, /max-width:\s*1100px[\s\S]*?min-width:\s*841px/);
  assert.match(css, /grid-template-columns:\s*176px\s+minmax\(0,\s*1fr\)\s+176px\s*!important/);
  assert.match(css, /max-height:\s*820px[\s\S]*?min-width:\s*1101px/);
});

test("compact desktop no longer requires a 560px or 660px center column", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  const compact = css.split("@media (max-width: 1100px) and (min-width: 841px)")[1] ?? "";
  const section = compact.split("/* Short laptop screens")[0] ?? compact;
  assert.doesNotMatch(section, /minmax\((?:560|610|660)px,\s*1fr\)/);
  assert.match(section, /minmax\(0,\s*1fr\)/);
});
