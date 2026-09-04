from pathlib import Path

css_path = Path("app/playtest-board-v4.css")
css = css_path.read_text()
marker = "/* Board ownership v6 — stationary mat, independent side rails, lower hand. */"
addition = r'''

/* Board ownership v6 — stationary mat, independent side rails, lower hand. */
.playtest-shell--live {
  height: 100dvh !important;
  min-height: 100dvh !important;
  overflow: hidden !important;
  padding-bottom: 38px !important;
  grid-template-rows: 54px minmax(0, 1fr) clamp(225px, 27dvh, 265px) !important;
}

/* The center arena is the immovable table surface. Vertical scrolling belongs
   to the fighter rails, never to the mat itself. */
.playtest-shell--live .playtest-arena {
  min-height: 0 !important;
  height: 100% !important;
  overflow: hidden !important;
  padding: 8px 6px 6px !important;
}
.playtest-shell--live .playtest-table {
  min-height: 0 !important;
  height: 100% !important;
  max-height: 100% !important;
  align-items: stretch !important;
  overflow: hidden !important;
  grid-template-columns: clamp(245px, 16vw, 310px) minmax(660px, 1fr) clamp(245px, 16vw, 310px) !important;
}
.playtest-shell--live .fighter-column {
  min-height: 0 !important;
  height: 100% !important;
  max-height: 100% !important;
  align-content: start !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding-right: 4px;
}
.playtest-shell--live .fighter-column--enemy {
  padding-right: 0;
  padding-left: 4px;
}

/* The Live Mat remains stationary while each lane handles only horizontal card
   overflow. Nothing in the center column should create page-height pressure. */
.playtest-shell--live .playtest-combat-desk {
  min-height: 0 !important;
  height: 100% !important;
  max-height: 100% !important;
  overflow: hidden !important;
  grid-template-rows: auto minmax(0, 1fr) auto auto auto auto !important;
}
.playtest-shell--live .live-mat-play {
  min-height: 0 !important;
  height: 100% !important;
  overflow: hidden !important;
}
.playtest-shell--live .mat-lane,
.playtest-shell--live .mat-lane-cards {
  min-height: 0 !important;
}

/* The hand is deliberately lower and shallower. The floating action dock may
   overlap its lower edge; the mat and side rails may not overlap the hand. */
.playtest-shell--live .playtest-workspace--hand {
  position: relative !important;
  z-index: 20 !important;
  height: 100% !important;
  min-height: 0 !important;
  max-height: 100% !important;
  margin: 0 !important;
  align-self: stretch !important;
  overflow: hidden !important;
  padding: 6px 8px 0 !important;
  background: rgba(8,24,16,.99) !important;
  box-shadow: 0 -9px 22px rgba(3,14,8,.28);
}
.playtest-shell--live .hand-panel {
  height: 100% !important;
  min-height: 0 !important;
  max-height: none !important;
  overflow: hidden !important;
  padding-bottom: 4px !important;
}
.playtest-shell--live .hand-panel > header {
  margin-bottom: 5px !important;
}
.playtest-shell--live .play-card-row {
  min-height: 0 !important;
  max-height: calc(100% - 58px) !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  padding-bottom: 6px !important;
}
.playtest-shell--live .play-card-row .play-card {
  flex-basis: clamp(125px, 8.3vw, 150px) !important;
  width: clamp(125px, 8.3vw, 150px) !important;
  min-width: clamp(125px, 8.3vw, 150px) !important;
  max-width: clamp(125px, 8.3vw, 150px) !important;
}
.playtest-shell--live .play-card-row .play-card-main {
  height: clamp(164px, 19dvh, 198px) !important;
}
.playtest-shell--live .playtest-action-dock {
  bottom: 46px !important;
  z-index: 92 !important;
}

/* Restore the player's dossier as an explicit left-side contract. Enemy
   mirroring is not allowed to leak through shared stat/loadout rules. */
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
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-panel-copy {
  grid-area: copy !important;
  text-align: left !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-panel-copy > span,
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-panel-copy p,
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-dossier-name {
  text-align: left !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-resource-strip b {
  flex-direction: row !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-stats--combat {
  grid-area: stats !important;
  direction: ltr !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-stats--combat > b {
  direction: ltr !important;
  grid-template-columns: 18px minmax(0, 1fr) auto !important;
  grid-template-rows: auto !important;
  text-align: left !important;
  padding: 6px 5px !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-stats--combat > b svg { grid-column: 1 !important; }
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-stats--combat > b small { grid-column: 2 !important; white-space: nowrap; }
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-stats--combat > b span { grid-column: 3 !important; }
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-loadout-launch {
  grid-area: loadout !important;
  grid-template-columns: minmax(0, 1fr) auto auto !important;
  text-align: left !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-loadout-launch span {
  grid-column: 1 !important;
  white-space: nowrap;
}
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-loadout-launch b { grid-column: 2 !important; }
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) .fighter-loadout-launch small { grid-column: 3 !important; }

/* Enemy remains the inward-facing mirror while keeping each stat readable. */
.playtest-shell--live .fighter-panel.fighter-dossier.is-enemy .fighter-stats--combat > b {
  grid-template-columns: auto minmax(0, 1fr) 18px !important;
  text-align: right !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier.is-enemy .fighter-stats--combat > b span { grid-column: 1 !important; }
.playtest-shell--live .fighter-panel.fighter-dossier.is-enemy .fighter-stats--combat > b small { grid-column: 2 !important; white-space: nowrap; }
.playtest-shell--live .fighter-panel.fighter-dossier.is-enemy .fighter-stats--combat > b svg { grid-column: 3 !important; }

/* On shorter laptop displays preserve the same ownership model and reduce the
   hand instead of letting it climb over the rails. */
@media (max-height: 760px) and (min-width: 761px) {
  .playtest-shell--live {
    grid-template-rows: 50px minmax(0, 1fr) 205px !important;
  }
  .playtest-shell--live .play-card-row .play-card-main { height: 148px !important; }
  .playtest-shell--live .play-card-row .play-card {
    flex-basis: 118px !important;
    width: 118px !important;
    min-width: 118px !important;
    max-width: 118px !important;
  }
}
'''
if marker not in css:
    css_path.write_text(css + addition)

# Replace the old spatial contract with the new stationary-mat/scrolling-rails
# contract, while preserving the opponent mirror checks.
test_path = Path("tests/playtest-spatial-ownership.test.mjs")
test_path.write_text(r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel keeps the Live Mat stationary and scrolls fighter rails independently", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /Board ownership v6/);
  assert.match(css, /grid-template-rows:\s*54px minmax\(0, 1fr\) clamp\(225px, 27dvh, 265px\)/);
  assert.match(css, /\.playtest-shell--live \.playtest-arena[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.playtest-shell--live \.fighter-column[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /\.playtest-shell--live \.playtest-combat-desk[\s\S]*?height:\s*100%/);
  assert.match(css, /\.playtest-shell--live \.playtest-workspace--hand[\s\S]*?z-index:\s*20/);
  assert.match(css, /\.play-card-row \.play-card-main[\s\S]*?height:\s*clamp\(164px, 19dvh, 198px\)/);
});

test("player fighter dossier keeps an explicit left-facing layout", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /fighter-panel\.fighter-dossier:not\(\.is-enemy\)[\s\S]*?grid-template-columns:\s*88px minmax\(0, 1fr\)/);
  assert.match(css, /fighter-panel\.fighter-dossier:not\(\.is-enemy\) \.fighter-panel-copy[\s\S]*?text-align:\s*left/);
  assert.match(css, /fighter-panel\.fighter-dossier:not\(\.is-enemy\) \.fighter-stats--combat > b[\s\S]*?grid-template-columns:\s*18px minmax\(0, 1fr\) auto/);
  assert.match(css, /fighter-panel\.fighter-dossier:not\(\.is-enemy\) \.fighter-loadout-launch[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto auto/);
});

test("opponent fighter dossier remains the true inward-facing mirror", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /fighter-panel\.fighter-dossier\.is-enemy[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 88px/);
  assert.match(css, /fighter-panel\.fighter-dossier\.is-enemy \.fighter-panel-copy[\s\S]*?text-align:\s*right/);
  assert.match(css, /fighter-panel\.fighter-dossier\.is-enemy \.fighter-loadout-launch[\s\S]*?grid-template-columns:\s*auto auto minmax\(0, 1fr\)/);
});
''')

Path("scripts/deploy_patch_message.txt").write_text("Make the Live Mat stationary and scroll fighter rails independently\n")
