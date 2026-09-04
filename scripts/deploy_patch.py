from pathlib import Path

css_path = Path("app/playtest-board-v4.css")
css = css_path.read_text()

# Remove the earlier arena/hand ownership experiment; it assigns the live shell
# and hand to viewport grid rows and is the source of the visible overlap.
old_start = "/* Live Mat / hand ownership fix — arena scrolls, hand never overlays it. */"
old_end = "/* Opponent dossier mirror — inward-facing right-side HUD. */"
if old_start in css and old_end in css:
    before, rest = css.split(old_start, 1)
    _, after = rest.split(old_end, 1)
    css = before.rstrip() + "\n\n" + old_end + after

# v7 tried to out-prioritize the old grid; replace it with a simpler block-flow
# shell so arena and hand can never occupy the same grid cell.
v7 = "/* Board ownership v7 — natural board flow, scrollable fighter rails. */"
if v7 in css:
    css = css.split(v7, 1)[0].rstrip() + "\n"

v8 = r'''

/* Board ownership v8 — live shell is block flow; arena and hand cannot overlap. */
.playtest-shell--live {
  display: block !important;
  height: auto !important;
  min-height: 0 !important;
  overflow: visible !important;
  padding-bottom: 108px !important;
}

.playtest-shell--live .battle-versus-hud {
  position: relative !important;
  width: 100% !important;
  margin: 0 0 10px !important;
}

.playtest-shell--live .playtest-arena {
  position: relative !important;
  display: block !important;
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  overflow: visible !important;
  margin: 0 !important;
  padding-bottom: 8px !important;
}

.playtest-shell--live .playtest-table {
  position: relative !important;
  display: grid !important;
  width: 100% !important;
  min-height: 540px !important;
  height: 540px !important;
  grid-template-columns: clamp(230px, 15.5vw, 300px) minmax(660px, 1fr) clamp(230px, 15.5vw, 300px) !important;
  gap: 12px !important;
  align-items: stretch !important;
  overflow: visible !important;
}

/* Center mat owns the fixed visual field. */
.playtest-shell--live .playtest-combat-desk {
  min-height: 540px !important;
  height: 540px !important;
  max-height: 540px !important;
  overflow: hidden !important;
}
.playtest-shell--live .live-mat-play {
  min-height: 210px !important;
}

/* The complete fighter side is one scroll surface: fighter + Combos on the
   left, opponent + Stage on the right. */
.playtest-shell--live .fighter-column {
  min-height: 0 !important;
  height: 540px !important;
  max-height: 540px !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  align-content: start !important;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  padding-right: 5px;
}
.playtest-shell--live .fighter-column--enemy {
  padding-right: 0;
  padding-left: 5px;
}
.playtest-shell--live .fighter-combo-rack,
.playtest-shell--live .fighter-combo-rack .active-combo-grid {
  max-height: none !important;
  overflow: visible !important;
}
.playtest-shell--live .fighter-combo-rack .active-combo-grid {
  padding-right: 0 !important;
  scrollbar-gutter: auto !important;
}

/* Hand is a normal block AFTER the arena. Explicitly clear every grid/overlay
   property used by earlier responsive dashboard rules. */
.playtest-shell--live .playtest-workspace--hand {
  position: static !important;
  display: block !important;
  grid-row: auto !important;
  grid-column: auto !important;
  inset: auto !important;
  top: auto !important;
  right: auto !important;
  bottom: auto !important;
  left: auto !important;
  transform: none !important;
  width: 100% !important;
  min-height: 0 !important;
  height: auto !important;
  margin: 18px 0 0 !important;
  padding: 0 !important;
  overflow: visible !important;
  z-index: 2 !important;
}
.playtest-shell--live .hand-panel {
  position: relative !important;
  width: 100% !important;
  min-height: 0 !important;
  height: auto !important;
  max-height: none !important;
  margin: 0 !important;
  overflow: hidden !important;
}

/* Keep the floating primary action dock above the hand, as intended. */
.playtest-shell--live .playtest-action-dock {
  position: fixed !important;
  bottom: 48px !important;
  z-index: 92 !important;
}

/* Explicitly protect the player's left-facing dossier from enemy mirror rules. */
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) {
  grid-template-columns: 88px minmax(0, 1fr) !important;
  grid-template-areas:
    "art copy"
    "art copy"
    "stats stats"
    "loadout loadout" !important;
  text-align: left !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-panel-art {
  grid-area: art !important;
  width: 88px !important;
  justify-self: start !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-panel-copy,
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-panel-copy > span,
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-panel-copy p,
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-dossier-name {
  text-align: left !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-resource-strip b {
  flex-direction: row !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-stats--combat {
  direction: ltr !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-stats--combat > b {
  direction: ltr !important;
  grid-template-columns: 20px minmax(0, 1fr) auto !important;
  text-align: left !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-stats--combat > b svg { grid-column: 1 !important; }
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-stats--combat > b small { grid-column: 2 !important; }
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-stats--combat > b span { grid-column: 3 !important; }
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-loadout-launch {
  grid-template-columns: minmax(0, 1fr) auto auto !important;
  text-align: left !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-loadout-launch span { grid-column: 1 !important; }
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-loadout-launch b { grid-column: 2 !important; }
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-loadout-launch small { grid-column: 3 !important; }

@media (max-height: 760px) and (min-width: 1121px) {
  .playtest-shell--live .playtest-table,
  .playtest-shell--live .playtest-combat-desk,
  .playtest-shell--live .fighter-column {
    height: 500px !important;
    min-height: 500px !important;
    max-height: 500px !important;
  }
  .playtest-shell--live .live-mat-play { min-height: 185px !important; }
}
'''
css += v8
css_path.write_text(css)

Path("tests/playtest-spatial-ownership.test.mjs").write_text(r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel shell uses block flow so hand and arena cannot share a grid cell", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /Board ownership v8 — live shell is block flow/);
  assert.match(css, /\.playtest-shell--live\s*\{[\s\S]*?display:\s*block\s*!important/);
  assert.match(css, /\.playtest-shell--live \.playtest-workspace--hand[\s\S]*?position:\s*static\s*!important[\s\S]*?grid-row:\s*auto\s*!important[\s\S]*?transform:\s*none\s*!important/);
  assert.doesNotMatch(css, /Board ownership v7 — natural board flow/);
  assert.doesNotMatch(css, /Live Mat \/ hand ownership fix — arena scrolls/);
});

test("center mat is stationary while complete fighter rails scroll independently", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /\.playtest-shell--live \.playtest-table[\s\S]*?height:\s*540px\s*!important/);
  assert.match(css, /\.playtest-shell--live \.playtest-combat-desk[\s\S]*?height:\s*540px\s*!important[\s\S]*?overflow:\s*hidden\s*!important/);
  assert.match(css, /\.playtest-shell--live \.fighter-column[\s\S]*?height:\s*540px\s*!important[\s\S]*?overflow-y:\s*auto\s*!important/);
});

test("Learned Combos use the whole player rail scrollbar rather than nesting one", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /fighter-combo-rack,[\s\S]*?active-combo-grid[\s\S]*?max-height:\s*none\s*!important[\s\S]*?overflow:\s*visible\s*!important/);
});

test("player and opponent fighter dossiers retain opposite readable orientations", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /fighter-panel\.fighter-dossier:not\(\.is-enemy\)[\s\S]*?grid-template-columns:\s*88px minmax\(0, 1fr\)/);
  assert.match(css, /fighter-panel\.fighter-dossier\.is-enemy[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 88px/);
});
''')
