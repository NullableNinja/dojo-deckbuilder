import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel retires the HIYAH phase rail and uses a round-only center HUD", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /className="game-phase-rail"/);
  assert.doesNotMatch(source, /activePhaseIndex/);
  assert.match(source, /className="versus-center" aria-label=\{`Round \$\{match\.round\}`\}/);
  assert.match(source, /<span>ROUND<\/span><b>\{match\.round\}<\/b><\/div>/);
});

test("removing HIYAH also reclaims its legacy board column", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /Round HUD cleanup v9/);
  assert.match(css, /\.playtest-shell--live \.game-phase-rail[\s\S]*?display:\s*none\s*!important/);
  assert.match(css, /\.playtest-shell--live \.playtest-topbar,[\s\S]*?grid-column:\s*auto\s*!important/);
  assert.match(css, /\.versus-center > span[\s\S]*?color:\s*#fff\s*!important[\s\S]*?font-size:\s*9px\s*!important/);
  assert.match(css, /\.versus-center > small[\s\S]*?display:\s*none\s*!important/);
});
