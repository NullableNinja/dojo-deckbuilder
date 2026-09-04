from pathlib import Path

css_path = Path("app/playtest-board-v4.css")
css = css_path.read_text()
marker = "/* Board ownership v7 — natural board flow, scrollable fighter rails. */"
addition = r'''

/* Board ownership v7 — natural board flow, scrollable fighter rails. */
/*
   Keep the board in normal document/grid flow. We intentionally do NOT size the
   shell from 100dvh: if a shorter screen needs a little page scrolling, it gets
   page scrolling instead of clipping game state. The center mat keeps a stable
   footprint while only the fighter rails own vertical overflow.
*/
.playtest-shell--live {
  height: auto !important;
  min-height: 0 !important;
  overflow: visible !important;
  grid-template-rows: auto auto auto !important;
  padding-bottom: 44px !important;
}

.playtest-shell--live .playtest-arena {
  min-height: 0 !important;
  height: auto !important;
  overflow: visible !important;
  padding-bottom: 8px !important;
}

.playtest-shell--live .playtest-table {
  min-height: 0 !important;
  height: auto !important;
  align-items: start !important;
  overflow: visible !important;
}

/* The playmat is the visual anchor. Give it enough real height to show both
   card lanes plus meters/actions without asking the viewport to solve a ratio. */
.playtest-shell--live .playtest-combat-desk {
  min-height: 540px !important;
  height: auto !important;
  max-height: none !important;
  overflow: hidden !important;
}
.playtest-shell--live .live-mat-play {
  min-height: 210px !important;
}

/* The complete side rail scrolls as one surface. This means the fighter HUD,
   Learned Combos, opponent HUD, and Current Stage never compete with the hand. */
.playtest-shell--live .fighter-column {
  min-height: 0 !important;
  height: auto !important;
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

/* One rail, one scrollbar. Do not put a second vertical scroller inside the
   Learned Combo filing. */
.playtest-shell--live .fighter-combo-rack {
  max-height: none !important;
  overflow: visible !important;
}
.playtest-shell--live .fighter-combo-rack .active-combo-grid {
  max-height: none !important;
  overflow: visible !important;
  padding-right: 0 !important;
  scrollbar-gutter: auto !important;
}

/* The hand is ordinary flow content below the arena. It can sit lower on the
   page; the floating action dock is allowed to overlap the hand instead. */
.playtest-shell--live .playtest-workspace--hand {
  position: relative !important;
  z-index: 2 !important;
  min-height: 0 !important;
  height: auto !important;
  margin-top: 18px !important;
  align-self: auto !important;
  overflow: visible !important;
  border-top: 2px solid rgba(245,179,34,.34);
  background: rgba(8,24,16,.98);
}
.playtest-shell--live .hand-panel {
  min-height: 0 !important;
  height: auto !important;
  max-height: none !important;
  overflow: hidden !important;
}
.playtest-shell--live .playtest-action-dock {
  bottom: 48px !important;
  z-index: 92 !important;
}

/* Protect the player's left-facing dossier from enemy mirror rules. */
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

/* Keep the same ownership model on laptop-height screens. We reduce card art a
   little, but never collapse the mat or turn the arena into the scroll owner. */
@media (max-height: 760px) and (min-width: 1121px) {
  .playtest-shell--live .playtest-combat-desk { min-height: 500px !important; }
  .playtest-shell--live .fighter-column { max-height: 500px !important; }
  .playtest-shell--live .live-mat-play { min-height: 185px !important; }
  .playtest-shell--live .play-card-row .play-card-main { height: 190px !important; }
}
'''

if marker not in css:
    css_path.write_text(css.rstrip() + addition + "\n")

Path("tests/playtest-spatial-ownership.test.mjs").write_text(r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel keeps the mat in natural flow and gives vertical scrolling only to fighter rails", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /Board ownership v7 — natural board flow, scrollable fighter rails/);
  assert.match(css, /\.playtest-shell--live\s*\{[\s\S]*?height:\s*auto\s*!important[\s\S]*?grid-template-rows:\s*auto auto auto/);
  assert.match(css, /\.playtest-shell--live \.playtest-arena[\s\S]*?overflow:\s*visible\s*!important/);
  assert.match(css, /\.playtest-shell--live \.playtest-combat-desk[\s\S]*?min-height:\s*540px\s*!important/);
  assert.match(css, /\.playtest-shell--live \.fighter-column[\s\S]*?max-height:\s*540px\s*!important[\s\S]*?overflow-y:\s*auto\s*!important/);
  assert.match(css, /\.playtest-shell--live \.playtest-workspace--hand[\s\S]*?margin-top:\s*18px\s*!important[\s\S]*?overflow:\s*visible\s*!important/);
  assert.doesNotMatch(css, /Board ownership v6 — stationary mat, independent side rails/);
});

test("Learned Combos use the player rail scrollbar instead of nesting another vertical scrollbar", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /fighter-combo-rack[\s\S]*?max-height:\s*none\s*!important[\s\S]*?overflow:\s*visible\s*!important/);
  assert.match(css, /fighter-combo-rack \.active-combo-grid[\s\S]*?max-height:\s*none\s*!important[\s\S]*?overflow:\s*visible\s*!important/);
});

test("player and opponent fighter dossiers retain opposite readable orientations", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /fighter-panel\.fighter-dossier:not\(\.is-enemy\)[\s\S]*?grid-template-columns:\s*88px minmax\(0, 1fr\)/);
  assert.match(css, /fighter-panel\.fighter-dossier:not\(\.is-enemy\) \.fighter-stats--combat > b[\s\S]*?grid-template-columns:\s*20px minmax\(0, 1fr\) auto/);
  assert.match(css, /fighter-panel\.fighter-dossier\.is-enemy[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 88px/);
  assert.match(css, /fighter-panel\.fighter-dossier\.is-enemy \.fighter-panel-copy[\s\S]*?text-align:\s*right/);
});
''')

Path("scripts/deploy_patch_message.txt").write_text("Stabilize Quick Duel mat, side rails, and hand ownership\n")
