from pathlib import Path

root = Path('.')
css_path = root / 'app/playtest-board-v4.css'
test_path = root / 'tests/playtest-live-mat-single-row.test.mjs'
css = css_path.read_text()
marker = '/* Live Mat v12 — exactly one horizontal row per fighter. */'
addition = r'''

/* Live Mat v12 — exactly one horizontal row per fighter. */
/* Played cards never create a second row. Additional cards scroll horizontally,
   so the mat only reserves enough vertical space for one filed-card ledger. */
.playtest-shell--live .live-mat-play {
  min-height: 0 !important;
  height: auto !important;
  align-items: start !important;
}
.playtest-shell--live .mat-lane {
  min-height: 0 !important;
  height: auto !important;
  grid-template-rows: 24px 88px !important;
  align-self: start !important;
  overflow: hidden !important;
}
.playtest-shell--live .mat-lane > header {
  min-height: 24px !important;
  height: 24px !important;
  margin: 0 !important;
  padding: 4px 7px !important;
}
.playtest-shell--live .mat-lane-cards {
  display: flex !important;
  flex-wrap: nowrap !important;
  min-height: 88px !important;
  height: 88px !important;
  max-height: 88px !important;
  align-items: stretch !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  padding: 4px 2px 6px !important;
}
.playtest-shell--live .mat-lane-cards > button {
  flex: 0 0 clamp(132px, 10vw, 178px) !important;
  width: clamp(132px, 10vw, 178px) !important;
  min-width: clamp(132px, 10vw, 178px) !important;
  min-height: 76px !important;
  height: 76px !important;
  max-height: 76px !important;
  grid-template-columns: 46px minmax(0, 1fr) !important;
  padding: 4px !important;
}
.playtest-shell--live .mat-card-visual {
  width: 46px !important;
  min-width: 46px !important;
  height: 64px !important;
}
.playtest-shell--live .mat-card-copy b {
  font-size: 9px !important;
  line-height: 1.1 !important;
}
.playtest-shell--live .mat-card-copy small {
  margin-top: 2px !important;
  font-size: 7px !important;
}
.playtest-shell--live .mat-lane-cards > p {
  min-height: 76px !important;
  height: 76px !important;
  width: 100%;
  margin: 0 !important;
  display: grid !important;
  place-items: center !important;
}

/* The combat desk has no synthetic mat-height row anymore. Everything below the
   one-row ledger follows immediately, which returns that vertical space to Hand. */
.playtest-shell--live .playtest-combat-desk {
  grid-template-rows: auto 120px auto auto auto auto !important;
  min-height: 0 !important;
  height: auto !important;
  max-height: none !important;
}

@media (max-width: 1100px) and (min-width: 841px) {
  .playtest-shell--live .mat-lane {
    grid-template-rows: 22px 80px !important;
  }
  .playtest-shell--live .mat-lane > header {
    min-height: 22px !important;
    height: 22px !important;
  }
  .playtest-shell--live .mat-lane-cards {
    min-height: 80px !important;
    height: 80px !important;
    max-height: 80px !important;
  }
  .playtest-shell--live .mat-lane-cards > button {
    flex-basis: 122px !important;
    width: 122px !important;
    min-width: 122px !important;
    min-height: 68px !important;
    height: 68px !important;
    max-height: 68px !important;
    grid-template-columns: 40px minmax(0, 1fr) !important;
  }
  .playtest-shell--live .mat-card-visual {
    width: 40px !important;
    min-width: 40px !important;
    height: 56px !important;
  }
  .playtest-shell--live .mat-lane-cards > p {
    min-height: 68px !important;
    height: 68px !important;
  }
  .playtest-shell--live .playtest-combat-desk {
    grid-template-rows: auto 110px auto auto auto auto !important;
  }
}
'''
if marker not in css:
    css += addition
css_path.write_text(css)

test_path.write_text(r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Live Mat always uses one horizontal card row and never reserves a second row", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /Live Mat v12 — exactly one horizontal row per fighter/);
  assert.match(css, /\.mat-lane-cards[\s\S]*?flex-wrap:\s*nowrap\s*!important/);
  assert.match(css, /\.mat-lane-cards[\s\S]*?height:\s*88px\s*!important/);
  assert.match(css, /\.playtest-combat-desk[\s\S]*?grid-template-rows:\s*auto 120px auto auto auto auto\s*!important/);
  assert.doesNotMatch(css.slice(css.indexOf("Live Mat v12")), /repeat\(2[^)]*\)/);
});
''')
