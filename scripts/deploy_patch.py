from pathlib import Path
import re

root = Path('.')
tsx_path = root / 'app/playtest.tsx'
css_path = root / 'app/playtest-board-v4.css'
test_path = root / 'tests/playtest-round-hud.test.mjs'

tsx = tsx_path.read_text()

# Remove the now-redundant phase index computation.
tsx = re.sub(r'\n  const activePhaseIndex = match\.phase === "player-initiate"[^\n]+;', '', tsx, count=1)

# Make the center HUD round-only: prominent ROUND label + number, no phase subtitle.
old_center = '<div className="versus-center"><span>ROUND</span><b>{match.round}</b><small>{["HONOR", "INITIATE", "YELL", "ASCEND", "HIDE"][activePhaseIndex]}</small></div>'
new_center = '<div className="versus-center" aria-label={`Round ${match.round}`}><span>ROUND</span><b>{match.round}</b></div>'
if old_center in tsx:
    tsx = tsx.replace(old_center, new_center, 1)
elif new_center not in tsx:
    raise SystemExit('Could not locate versus-center round HUD')

# Remove the floating H.I.Y.A.H. phase rail entirely. Other in-context UI already teaches phase state.
tsx, removed = re.subn(r'\n    <section className="game-phase-rail" aria-label="Current H\.I\.Y\.A\.H\. phase">.*?</section>', '', tsx, count=1)
if removed != 1 and 'className="game-phase-rail"' in tsx:
    raise SystemExit('Could not remove phase rail')

tsx_path.write_text(tsx)

css = css_path.read_text()
marker = '/* Round HUD cleanup v9 — retire HIYAH rail and reclaim the full board width. */'
addition = r'''

/* Round HUD cleanup v9 — retire HIYAH rail and reclaim the full board width. */
/* Phase is already communicated by the action dock, zone/reaction state, Ascend guide,
   and contextual copy. The old vertical HIYAH filing rail is redundant and no longer
   owns any screen space. */
.playtest-shell--live .game-phase-rail {
  display: none !important;
}

/* The legacy desktop dashboard reserved column 1 for HIYAH. Clear every old grid
   placement so the health HUD, arena, and hand use the full live-shell width. */
.playtest-shell--live .playtest-topbar,
.playtest-shell--live .playtest-arena,
.playtest-shell--live .playtest-workspace--hand,
.playtest-shell--live .match-result {
  grid-column: auto !important;
  grid-row: auto !important;
  width: 100% !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}

/* Round badge: one job, unmistakably. */
.playtest-shell--live .battle-versus-hud {
  grid-template-columns: minmax(0, 1fr) 92px minmax(0, 1fr) !important;
  overflow: visible !important;
}
.playtest-shell--live .versus-center {
  min-width: 92px;
  overflow: visible;
  isolation: isolate;
}
.playtest-shell--live .versus-center > span {
  top: -5px !important;
  z-index: 3 !important;
  color: #fff !important;
  font-size: 9px !important;
  font-weight: 1000 !important;
  letter-spacing: .18em !important;
  line-height: 1 !important;
  text-shadow: 0 2px 2px rgba(0,0,0,.9), 0 0 8px rgba(255,255,255,.22);
}
.playtest-shell--live .versus-center > b {
  width: 52px !important;
  height: 52px !important;
  border-width: 3px !important;
  color: #fff !important;
  font-size: 28px !important;
  box-shadow:
    0 0 0 2px rgba(255,255,255,.18),
    4px 5px 0 var(--gold),
    0 8px 18px rgba(0,0,0,.28) !important;
  text-shadow: 0 2px 1px rgba(0,0,0,.28);
}
.playtest-shell--live .versus-center > small {
  display: none !important;
}

@media (max-width: 1120px) {
  .playtest-shell--live .battle-versus-hud {
    grid-template-columns: minmax(0, 1fr) 72px minmax(0, 1fr) !important;
  }
  .playtest-shell--live .versus-center { min-width: 72px; }
  .playtest-shell--live .versus-center > b { width: 46px !important; height: 46px !important; font-size: 25px !important; }
  .playtest-shell--live .versus-center > span { top: -3px !important; font-size: 8px !important; }
}
'''
if marker not in css:
    css += addition
css_path.write_text(css)

test_path.write_text(r'''import assert from "node:assert/strict";
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
''')
