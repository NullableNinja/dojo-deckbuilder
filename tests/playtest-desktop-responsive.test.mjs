import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel has explicit wide, laptop, and compact-desktop layout tiers", async () => {
  const css = await readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8");
  assert.match(css, /@media \(min-width:\s*1000px\) and \(max-width:\s*1160px\)/);
  assert.match(css, /@media \(min-width:\s*761px\) and \(max-width:\s*999px\)/);
  assert.match(css, /@media \(max-width:\s*900px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});

test("compact desktop no longer requires a 560px or 660px center column", async () => {
  const css = await readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8");
  const compact = css.split("@media (min-width: 761px) and (max-width: 999px)")[1] ?? "";
  const section = compact.split("@media (max-width: 900px)")[0] ?? compact;
  assert.doesNotMatch(section, /minmax\((?:560|610|660)px,\s*1fr\)/);
  assert.match(section, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});
