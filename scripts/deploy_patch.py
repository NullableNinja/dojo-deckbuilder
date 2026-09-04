from pathlib import Path

root = Path('.')
css_path = root / 'app/playtest-board-v4.css'
test_path = root / 'tests/playtest-hud-mat-density.test.mjs'
css = css_path.read_text()
marker = '/* HUD and live-mat density v11 — one HUD contract, no stretched empty lanes. */'
addition = r'''

/* HUD and live-mat density v11 — one HUD contract, no stretched empty lanes. */
/* The outer board may be wide or compact, but the mat must size from real content.
   Side rails scroll when necessary; they do not dictate a fake fixed table height. */
.playtest-shell--live .playtest-table {
  min-height: 0 !important;
  height: auto !important;
  align-items: start !important;
}
.playtest-shell--live .playtest-combat-desk {
  min-height: 0 !important;
  height: auto !important;
  max-height: none !important;
  grid-template-rows: auto auto auto auto auto auto !important;
  align-content: start !important;
}
.playtest-shell--live .live-mat-play {
  min-height: 0 !important;
  height: auto !important;
  align-items: start !important;
}
.playtest-shell--live .mat-lane {
  min-height: 0 !important;
  height: auto !important;
  align-self: start !important;
  grid-template-rows: auto auto !important;
}
.playtest-shell--live .mat-lane-cards {
  min-height: 104px !important;
  height: auto !important;
  align-self: start !important;
}
.playtest-shell--live .mat-lane-cards > p {
  min-height: 92px;
  margin: 0 !important;
  display: grid;
  place-items: center;
}

/* The fighter rails are allowed to be shorter than their content and become the
   scroll surface. They never stretch the center mat just to match their contents. */
.playtest-shell--live .fighter-column {
  min-height: 0 !important;
  height: auto !important;
  max-height: clamp(390px, 58vh, 480px) !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  align-content: start !important;
}

/* One combat-stat layout for BOTH fighters. JSX determines ATK/DEF/SPD order;
   CSS only controls presentation. This prevents enemy mirroring rules from
   corrupting the player's HUD. */
.playtest-shell--live .fighter-dossier .fighter-stats--combat {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 5px !important;
  direction: ltr !important;
}
.playtest-shell--live .fighter-dossier .fighter-stats--combat > b {
  min-width: 0 !important;
  min-height: 46px !important;
  display: grid !important;
  grid-template-columns: 19px minmax(0, 1fr) !important;
  grid-template-rows: auto auto !important;
  column-gap: 5px !important;
  row-gap: 0 !important;
  align-items: center !important;
  padding: 6px !important;
  text-align: left !important;
}
.playtest-shell--live .fighter-dossier .fighter-stats--combat > b > svg {
  grid-column: 1 !important;
  grid-row: 1 / 3 !important;
  width: 18px !important;
  height: 18px !important;
  align-self: center !important;
}
.playtest-shell--live .fighter-dossier .fighter-stats--combat > b > small {
  grid-column: 2 !important;
  grid-row: 1 !important;
  justify-self: start !important;
  align-self: end !important;
  margin: 0 !important;
  font-size: 7px !important;
  line-height: 1 !important;
  white-space: nowrap;
}
.playtest-shell--live .fighter-dossier .fighter-stats--combat > b > span {
  grid-column: 2 !important;
  grid-row: 2 !important;
  justify-self: start !important;
  align-self: start !important;
  margin: 1px 0 0 !important;
  font-size: 17px !important;
  line-height: 1 !important;
}

/* Loadout is the same two-column information block on both fighters; enemy only
   mirrors which side owns the label. This prevents words/numbers from colliding. */
.playtest-shell--live .fighter-dossier:not(.is-enemy) .fighter-loadout-launch {
  grid-template-columns: minmax(0, 1fr) auto !important;
  grid-template-rows: auto auto !important;
}
.playtest-shell--live .fighter-dossier:not(.is-enemy) .fighter-loadout-launch > span {
  grid-column: 1 !important;
  grid-row: 1 / 3 !important;
  align-self: center !important;
}
.playtest-shell--live .fighter-dossier:not(.is-enemy) .fighter-loadout-launch > b {
  grid-column: 2 !important;
  grid-row: 1 !important;
  justify-self: end !important;
}
.playtest-shell--live .fighter-dossier:not(.is-enemy) .fighter-loadout-launch > small {
  grid-column: 2 !important;
  grid-row: 2 !important;
  justify-self: end !important;
}
.playtest-shell--live .fighter-dossier.is-enemy .fighter-loadout-launch {
  grid-template-columns: auto minmax(0, 1fr) !important;
  grid-template-rows: auto auto !important;
}
.playtest-shell--live .fighter-dossier.is-enemy .fighter-loadout-launch > b {
  grid-column: 1 !important;
  grid-row: 1 !important;
  justify-self: start !important;
}
.playtest-shell--live .fighter-dossier.is-enemy .fighter-loadout-launch > small {
  grid-column: 1 !important;
  grid-row: 2 !important;
  justify-self: start !important;
}
.playtest-shell--live .fighter-dossier.is-enemy .fighter-loadout-launch > span {
  grid-column: 2 !important;
  grid-row: 1 / 3 !important;
  justify-self: end !important;
  align-self: center !important;
  text-align: right !important;
}

/* Compact desktop still uses the same HUD contract rather than a second one. */
@media (max-width: 1100px) and (min-width: 841px) {
  .playtest-shell--live .fighter-dossier .fighter-stats--combat > b {
    min-height: 40px !important;
    grid-template-columns: 14px minmax(0, 1fr) !important;
    column-gap: 3px !important;
    padding: 4px !important;
  }
  .playtest-shell--live .fighter-dossier .fighter-stats--combat > b > svg {
    width: 13px !important;
    height: 13px !important;
  }
  .playtest-shell--live .fighter-dossier .fighter-stats--combat > b > small { font-size: 6px !important; }
  .playtest-shell--live .fighter-dossier .fighter-stats--combat > b > span { font-size: 13px !important; }
}
'''
if marker not in css:
    css += addition
css_path.write_text(css)

test_path.write_text(r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Live Mat sizes from content instead of stretching empty card lanes", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /HUD and live-mat density v11/);
  assert.match(css, /\.playtest-shell--live \.playtest-combat-desk[\s\S]*?height:\s*auto\s*!important[\s\S]*?grid-template-rows:\s*auto auto auto auto auto auto\s*!important/);
  assert.match(css, /\.playtest-shell--live \.live-mat-play[\s\S]*?min-height:\s*0\s*!important/);
  assert.match(css, /\.playtest-shell--live \.mat-lane[\s\S]*?height:\s*auto\s*!important/);
  assert.match(css, /\.fighter-column[\s\S]*?max-height:\s*clamp\(390px, 58vh, 480px\)\s*!important/);
});

test("Player and opponent combat stats share one stable HUD geometry", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(css, /\.fighter-dossier \.fighter-stats--combat > b[\s\S]*?grid-template-columns:\s*19px minmax\(0, 1fr\)/);
  assert.match(css, /> b > svg[\s\S]*?grid-row:\s*1 \/ 3/);
  assert.match(css, /fighter-dossier:not\(\.is-enemy\) \.fighter-loadout-launch/);
  assert.match(css, /fighter-dossier\.is-enemy \.fighter-loadout-launch/);
  assert.match(source, /const combatStats:[\s\S]*?enemy[\s\S]*?SPD[\s\S]*?DEF[\s\S]*?ATK[\s\S]*?:[\s\S]*?ATK[\s\S]*?DEF[\s\S]*?SPD/);
});
''')
