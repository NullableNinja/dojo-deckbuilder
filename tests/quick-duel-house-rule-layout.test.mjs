import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [main, css, playtest] = await Promise.all([
  readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/playtest-layout.css", import.meta.url), "utf8"),
  readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
]);

test("active Quick Duel House Rules stay out of arena grid flow", () => {
  assert.match(playtest, /className="playtest-active-variants"/);
  assert.match(main, /import "\.\.\/app\/playtest-layout\.css";/);
  assert.match(css, /\.playtest-shell--live > \.playtest-arena\s*\{[^}]*position:\s*relative/s);
  assert.match(css, /\.playtest-shell--live \.playtest-active-variants\s*\{[^}]*position:\s*absolute/s);
  assert.doesNotMatch(css, /\.playtest-active-variants\s*\{[^}]*grid-(?:area|row|column):/s);
});

test("active House Rule badge is a non-interactive HUD surface", () => {
  assert.match(css, /\.playtest-shell--live \.playtest-active-variants\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /transform:\s*translateX\(-50%\)/);
});
