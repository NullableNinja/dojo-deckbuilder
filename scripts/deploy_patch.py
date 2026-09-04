from pathlib import Path

root = Path('.')
css_path = root / 'app/playtest-board-v4.css'
test_path = root / 'tests/playtest-desktop-responsive.test.mjs'

css = css_path.read_text()
marker = '/* Desktop responsiveness v10 — desktop is a range, not one blessed viewport. */'
addition = r'''

/* Desktop responsiveness v10 — desktop is a range, not one blessed viewport. */
/* The full-size board remains unchanged on wide screens. Compact desktop widths
   progressively reduce the fighter rails and board height while keeping every
   gameplay system available. The center mat is allowed to flex instead of
   demanding a 660px minimum that forces horizontal overflow. */

@media (max-width: 1379px) and (min-width: 1101px) {
  .playtest-shell--live { --fighter-column: 205px; }
  .playtest-shell--live .playtest-table {
    grid-template-columns: 205px minmax(0, 1fr) 205px !important;
    gap: 9px !important;
    min-height: 500px !important;
    height: 500px !important;
  }
  .playtest-shell--live .playtest-combat-desk,
  .playtest-shell--live .fighter-column {
    min-height: 500px !important;
    height: 500px !important;
    max-height: 500px !important;
  }
  .playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) {
    grid-template-columns: 66px minmax(0, 1fr) !important;
  }
  .playtest-shell--live .fighter-panel.fighter-dossier.is-enemy {
    grid-template-columns: minmax(0, 1fr) 66px !important;
  }
  .playtest-shell--live .fighter-dossier .fighter-panel-art { width: 66px !important; }
  .playtest-shell--live .fighter-dossier .fighter-panel-copy p { -webkit-line-clamp: 2 !important; }
  .playtest-shell--live .mat-lane-cards > button {
    flex-basis: clamp(142px, 13vw, 180px) !important;
    width: clamp(142px, 13vw, 180px) !important;
    min-width: clamp(142px, 13vw, 180px) !important;
  }
}

@media (max-width: 1100px) and (min-width: 841px) {
  .playtest-shell--live { --fighter-column: 176px; }
  .playtest-shell--live .playtest-arena { padding-inline: 6px !important; }
  .playtest-shell--live .playtest-table {
    grid-template-columns: 176px minmax(0, 1fr) 176px !important;
    gap: 7px !important;
    min-width: 0 !important;
    min-height: 470px !important;
    height: 470px !important;
  }
  .playtest-shell--live .playtest-combat-desk,
  .playtest-shell--live .fighter-column {
    min-height: 470px !important;
    height: 470px !important;
    max-height: 470px !important;
  }
  .playtest-shell--live .playtest-combat-desk {
    padding: 7px !important;
    gap: 5px !important;
    grid-template-rows: auto minmax(170px, 1fr) auto auto auto auto !important;
  }
  .playtest-shell--live .live-mat-play {
    min-height: 170px !important;
    gap: 6px !important;
  }
  .playtest-shell--live .mat-lane { padding: 5px !important; }
  .playtest-shell--live .mat-lane-cards > button {
    flex: 0 0 136px !important;
    width: 136px !important;
    min-width: 136px !important;
    min-height: 94px !important;
    grid-template-columns: 48px minmax(0, 1fr) !important;
    padding: 5px !important;
  }
  .playtest-shell--live .mat-card-visual {
    width: 48px !important;
    min-width: 48px !important;
    height: 68px !important;
  }

  .playtest-shell--live .fighter-panel.fighter-dossier {
    gap: 6px !important;
    padding: 7px !important;
  }
  .playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) {
    grid-template-columns: 52px minmax(0, 1fr) !important;
  }
  .playtest-shell--live .fighter-panel.fighter-dossier.is-enemy {
    grid-template-columns: minmax(0, 1fr) 52px !important;
  }
  .playtest-shell--live .fighter-dossier .fighter-panel-art { width: 52px !important; }
  .playtest-shell--live .fighter-dossier-name { font-size: 13px !important; }
  .playtest-shell--live .fighter-dossier .fighter-panel-copy > span { font-size: 7px !important; }
  .playtest-shell--live .fighter-dossier .fighter-panel-copy p {
    margin: 3px 0 5px !important;
    -webkit-line-clamp: 1 !important;
    font-size: 8px !important;
  }
  .playtest-shell--live .fighter-resource-strip b { padding: 4px !important; font-size: 11px !important; }
  .playtest-shell--live .fighter-dossier .fighter-stats--combat { gap: 3px !important; }
  .playtest-shell--live .fighter-dossier .fighter-stats--combat > b {
    grid-template-columns: 14px 1fr auto !important;
    gap: 2px !important;
    padding: 4px !important;
  }
  .playtest-shell--live .fighter-dossier .fighter-stats--combat svg { width: 13px !important; height: 13px !important; }
  .playtest-shell--live .fighter-dossier .fighter-stats--combat small { font-size: 6px !important; }
  .playtest-shell--live .fighter-dossier .fighter-stats--combat span { font-size: 13px !important; }
  .playtest-shell--live .fighter-loadout-launch { padding: 5px !important; }
  .playtest-shell--live .fighter-loadout-launch span { font-size: 7px !important; }
  .playtest-shell--live .fighter-combo-rack { padding: 6px !important; }
  .playtest-shell--live .fighter-combo-rack .active-combo-card {
    grid-template-columns: 22px minmax(0, 1fr) !important;
    padding: 5px !important;
  }
  .playtest-shell--live .fighter-combo-rack .active-combo-card > i { width: 22px !important; height: 22px !important; }
  .playtest-shell--live .fighter-combo-rack .active-combo-card span { -webkit-line-clamp: 1 !important; }
  .playtest-shell--live .playtest-stage-rail { padding: 7px !important; }
  .playtest-shell--live .playtest-stage-rail > p { -webkit-line-clamp: 3 !important; font-size: 8px !important; }
  .playtest-shell--live .playtest-stage-rail > button { padding: 6px !important; }
  .playtest-shell--live .combat-meters > * { min-height: 48px !important; }
  .playtest-shell--live .combat-desk-links button { min-height: 43px !important; }
  .playtest-shell--live .play-card-row .play-card {
    flex-basis: 142px !important;
    width: 142px !important;
    min-width: 142px !important;
    max-width: 142px !important;
  }
  .playtest-shell--live .play-card-row .play-card-main { height: 196px !important; }
}

/* Short laptop screens need vertical compression without changing board ownership. */
@media (max-height: 820px) and (min-width: 1101px) {
  .playtest-shell--live .playtest-table {
    min-height: 450px !important;
    height: 450px !important;
  }
  .playtest-shell--live .playtest-combat-desk,
  .playtest-shell--live .fighter-column {
    min-height: 450px !important;
    height: 450px !important;
    max-height: 450px !important;
  }
  .playtest-shell--live .play-card-row .play-card-main { height: 190px !important; }
  .playtest-shell--live .playtest-workspace--hand { margin-top: 12px !important; }
}
'''

if marker not in css:
    css += addition
css_path.write_text(css)

test_path.write_text(r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel has explicit wide, laptop, and compact-desktop layout tiers", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /Desktop responsiveness v10/);
  assert.match(css, /max-width:\s*1379px[\s\S]*?min-width:\s*1101px/);
  assert.match(css, /max-width:\s*1100px[\s\S]*?min-width:\s*841px/);
  assert.match(css, /grid-template-columns:\s*176px\s+minmax\(0,\s*1fr\)\s+176px\s*!important/);
  assert.match(css, /max-height:\s*820px[\s\S]*?min-width:\s*1101px/);
});

test("compact desktop no longer requires a 560px or 660px center column", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  const compact = css.split("@media (max-width: 1100px) and (min-width: 841px)")[1] ?? "";
  const section = compact.split("/* Short laptop screens")[0] ?? compact;
  assert.doesNotMatch(section, /minmax\((?:560|610|660)px,\s*1fr\)/);
  assert.match(section, /minmax\(0,\s*1fr\)/);
});
''')
