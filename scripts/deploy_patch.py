from pathlib import Path

css_path = Path("app/playtest-board-v4.css")
css = css_path.read_text()
marker = "/* Live Mat / hand ownership fix — arena scrolls, hand never overlays it. */"
addition = r'''

/* Live Mat / hand ownership fix — arena scrolls, hand never overlays it. */
.playtest-shell--live {
  grid-template-rows: 54px minmax(0, 1fr) auto !important;
}

/* Row 2 owns every arena pixel. If it gets short, scroll the arena instead of
   letting a 500px mat paint underneath the hand row. */
.playtest-shell--live .playtest-arena {
  min-height: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
  padding-bottom: 8px;
}
.playtest-shell--live .playtest-table {
  min-height: 0 !important;
  overflow: visible !important;
}
.playtest-shell--live .playtest-combat-desk {
  min-height: 0 !important;
  height: auto !important;
  max-height: none !important;
}
.playtest-shell--live .live-mat-play {
  min-height: clamp(150px, 24dvh, 270px) !important;
}
.playtest-shell--live .fighter-column {
  min-height: 0 !important;
}

/* Row 3 is a real hand tray, never an overlay. Its opaque paper surface also
   provides an unmistakable visual boundary between table and hand. */
.playtest-shell--live .playtest-workspace--hand {
  position: relative !important;
  z-index: 12 !important;
  min-height: 0 !important;
  margin-top: 0 !important;
  align-self: end !important;
  overflow: hidden !important;
  border-top: 2px solid rgba(245,179,34,.34);
  box-shadow: 0 -10px 24px rgba(4,15,9,.24);
  background: rgba(8,24,16,.98);
}
.playtest-shell--live .hand-panel {
  margin: 0 !important;
  min-height: 0 !important;
  max-height: min(36dvh, 310px);
  overflow: hidden !important;
}

/* Empty / exhausted hands should collapse to their useful header instead of
   reserving a huge invisible card tray and stealing the mat. */
.playtest-shell--live .play-card-row:empty {
  display: none !important;
}
.playtest-shell--live .hand-panel:has(.play-card-row:empty) {
  padding-bottom: 10px !important;
}

/* The opponent dossier is a true horizontal mirror of the player's dossier. */
.playtest-shell--live .fighter-panel.is-enemy {
  grid-template-columns: minmax(0, 1fr) 92px !important;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-panel-art {
  grid-column: 2 !important;
  grid-row: 1 / span 2 !important;
  justify-self: end;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-panel-copy {
  grid-column: 1 !important;
  grid-row: 1 !important;
  text-align: right;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-panel-copy > span,
.playtest-shell--live .fighter-panel.is-enemy .fighter-panel-copy p,
.playtest-shell--live .fighter-panel.is-enemy .fighter-dossier-name {
  text-align: right !important;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-dossier-name {
  margin-left: auto;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-resource-strip b {
  flex-direction: row-reverse;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-stats--combat {
  direction: rtl;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-stats--combat > b {
  direction: ltr;
  grid-template-columns: auto 1fr 20px !important;
  text-align: right;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-stats--combat > b svg {
  grid-column: 3;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-stats--combat > b small {
  grid-column: 2;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-stats--combat > b span {
  grid-column: 1;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-loadout-launch {
  grid-template-columns: auto auto 1fr;
  text-align: right;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-loadout-launch span {
  grid-column: 3;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-loadout-launch b {
  grid-column: 2;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-loadout-launch small {
  grid-column: 1;
}

/* Short displays keep both surfaces usable: the hand remains stable and the
   arena becomes scrollable rather than overlapping it. */
@media (max-height: 720px) and (min-width: 761px) {
  .playtest-shell--live .playtest-arena { padding-bottom: 5px; }
  .playtest-shell--live .playtest-combat-desk { padding-block: 7px !important; }
  .playtest-shell--live .live-mat-play { min-height: 145px !important; }
  .playtest-shell--live .hand-panel { max-height: min(34dvh, 255px); }
}
'''
if marker not in css:
    css_path.write_text(css + addition)

# Lock both spatial ownership and the mirrored opponent dossier contract.
test_path = Path("tests/playtest-spatial-ownership.test.mjs")
test_path.write_text(r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel gives Live Mat and hand separate non-overlapping layout ownership", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /Live Mat \/ hand ownership fix/);
  assert.match(css, /grid-template-rows:\s*54px minmax\(0, 1fr\) auto/);
  assert.match(css, /\.playtest-shell--live \.playtest-arena[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /\.playtest-shell--live \.playtest-combat-desk[\s\S]*?min-height:\s*0\s*!important/);
  assert.match(css, /\.playtest-shell--live \.playtest-workspace--hand[\s\S]*?z-index:\s*12/);
  assert.match(css, /\.play-card-row:empty[\s\S]*?display:\s*none/);
});

test("opponent fighter dossier is a true mirror of the player dossier", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /fighter-panel\.is-enemy[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 92px/);
  assert.match(css, /fighter-panel\.is-enemy \.fighter-panel-art[\s\S]*?grid-column:\s*2/);
  assert.match(css, /fighter-panel\.is-enemy \.fighter-panel-copy[\s\S]*?text-align:\s*right/);
  assert.match(css, /fighter-panel\.is-enemy \.fighter-stats--combat[\s\S]*?direction:\s*rtl/);
  assert.match(css, /fighter-panel\.is-enemy \.fighter-loadout-launch[\s\S]*?grid-template-columns:\s*auto auto 1fr/);
});
''')

Path("scripts/deploy_patch_message.txt").write_text("Fix hand overlap and mirror opponent fighter HUD\n")
