from pathlib import Path

css_path = Path("app/playtest-board-v4.css")
css = css_path.read_text()
mirror_marker = "/* Opponent dossier mirror — inward-facing right-side HUD. */"
mirror_css = r'''

/* Opponent dossier mirror — inward-facing right-side HUD. */
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
.playtest-shell--live .fighter-panel.is-enemy .fighter-dossier-name { margin-left: auto; }
.playtest-shell--live .fighter-panel.is-enemy .fighter-resource-strip b { flex-direction: row-reverse; }
.playtest-shell--live .fighter-panel.is-enemy .fighter-stats--combat { direction: rtl; }
.playtest-shell--live .fighter-panel.is-enemy .fighter-stats--combat > b {
  direction: ltr;
  grid-template-columns: auto 1fr 20px !important;
  text-align: right;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-stats--combat > b svg { grid-column: 3; }
.playtest-shell--live .fighter-panel.is-enemy .fighter-stats--combat > b small { grid-column: 2; }
.playtest-shell--live .fighter-panel.is-enemy .fighter-stats--combat > b span { grid-column: 1; }
.playtest-shell--live .fighter-panel.is-enemy .fighter-loadout-launch {
  grid-template-columns: auto auto 1fr;
  text-align: right;
}
.playtest-shell--live .fighter-panel.is-enemy .fighter-loadout-launch span { grid-column: 3; }
.playtest-shell--live .fighter-panel.is-enemy .fighter-loadout-launch b { grid-column: 2; }
.playtest-shell--live .fighter-panel.is-enemy .fighter-loadout-launch small { grid-column: 1; }

@media (max-width: 1260px) and (min-width: 1121px) {
  .playtest-shell--live .fighter-panel.is-enemy { grid-template-columns: minmax(0, 1fr) 74px !important; }
  .playtest-shell--live .fighter-panel.is-enemy .fighter-panel-art { width: 74px !important; }
}
'''
if mirror_marker not in css:
    css_path.write_text(css + mirror_css)

# Preserve the hand/mat ownership test already added, and add the mirror contract.
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
  assert.match(css, /Opponent dossier mirror/);
  assert.match(css, /fighter-panel\.is-enemy[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 92px/);
  assert.match(css, /fighter-panel\.is-enemy \.fighter-panel-art[\s\S]*?grid-column:\s*2/);
  assert.match(css, /fighter-panel\.is-enemy \.fighter-panel-copy[\s\S]*?text-align:\s*right/);
  assert.match(css, /fighter-panel\.is-enemy \.fighter-stats--combat[\s\S]*?direction:\s*rtl/);
  assert.match(css, /fighter-panel\.is-enemy \.fighter-loadout-launch[\s\S]*?grid-template-columns:\s*auto auto 1fr/);
});
''')

Path("scripts/deploy_patch_message.txt").write_text("Mirror opponent fighter HUD\n")
