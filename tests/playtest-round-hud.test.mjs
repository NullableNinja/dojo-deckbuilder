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
  const css = await readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /\.game-phase-rail/);
  assert.match(css, /\.playtest-shell--live \.playtest-topbar,[\s\S]*?grid-template-columns:\s*1fr 76px 1fr/);
  assert.match(css, /\.playtest-shell--live \.versus-center > span \{[^}]*color:\s*#fff7da[^}]*font-size:\s*7px/);
  assert.doesNotMatch(css, /\.versus-center > small/);
});
