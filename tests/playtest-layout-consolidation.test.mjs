import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const [main, layout, playtest, appFiles] = await Promise.all([
  readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/playtest-layout.css", import.meta.url), "utf8"),
  readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
  readdir(new URL("../app/", import.meta.url)),
]);

const retiredLayoutSheets = [
  "playtest-production-layout.css",
  "playtest-polish.css",
  "playtest-readability.css",
  "playtest-acquisition-desk.css",
  "playtest-hand-stage.css",
  "playtest-stability-pass.css",
  "playtest-ui-overhaul.css",
  "playtest-final-fit.css",
  "playtest-refinement-pass.css",
  "playtest-overlay-fix.css",
  "playtest-functional-recovery.css",
  "playtest-collision-guard.css",
  "playtest-graphics-fix.css",
  "playtest-user-facing-polish.css",
  "playtest-house-rule-layout-fix.css",
  // Post-consolidation regressions: these must never become a second patch stack.
  "playtest-live-skin.css",
  "playtest-visual-repair.css",
  "ascend-combo-button.css",
  "playtest-finishing-pass.css",
  "playtest-last-mile.css",
];

test("Quick Duel loads one final presentation authority and retires every patch sheet", async () => {
  assert.match(main, /import "\.\.\/app\/playtest-layout\.css";/);
  assert.equal((main.match(/import "\.\.\/app\/playtest-layout\.css";/g) ?? []).length, 1);
  assert.ok(main.indexOf("playtest-layout.css") > main.indexOf("playtest-card-surface.css"));
  assert.ok(main.indexOf("playtest-layout.css") > main.indexOf("playtest-market-card-polish.css"));

  for (const filename of retiredLayoutSheets) {
    assert.doesNotMatch(main, new RegExp(filename.replaceAll(".", "\\.")));
    assert.equal(appFiles.includes(filename), false, `${filename} should be deleted`);
    await assert.rejects(access(new URL(`../app/${filename}`, import.meta.url)));
  }
});

test("consolidated presentation explicitly forbids another post-layout patch stack", () => {
  assert.match(layout, /single final presentation authority/);
  assert.match(layout, /Do not add post-layout playtest fix\/polish\/pass stylesheets/);
  assert.doesNotMatch(layout, /!important/);

  const imports = [...main.matchAll(/import "\.\.\/app\/([^"']+\.css)";/g)].map((match) => match[1]);
  const layoutIndex = imports.indexOf("playtest-layout.css");
  assert.notEqual(layoutIndex, -1);
  const laterPlaytestCss = imports.slice(layoutIndex + 1).filter((path) => /(?:^|\/)playtest-|ascend-combo/.test(path));
  assert.deepEqual(laterPlaytestCss, [], `No Quick Duel CSS may load after playtest-layout.css: ${laterPlaytestCss.join(", ")}`);
});

test("consolidated presentation keeps the verified live HUD and fighter corrections", () => {
  assert.match(layout, /\.battle-hud-fighter\s*\{/);
  assert.match(layout, /\.battle-hud-fighter i\s*\{[^}]*background:\s*#6c2b27;/s);
  for (const belt of ["white", "gold", "orange", "green", "purple", "blue", "red", "brown", "black"]) {
    assert.match(layout, new RegExp(`fighter-belt-badge\\[data-belt=\\"${belt}\\"\\]`));
  }
  assert.match(layout, /\.fighter-focus-seal,[\s\S]*border-radius:\s*6px 2px 7px 3px;/);
  assert.match(layout, /\.fighter-status-tray,[\s\S]*grid-area:\s*status;/);
  assert.match(layout, /\.fighter-equipment-tabs,[\s\S]*grid-area:\s*tools;/);
});

test("consolidated presentation keeps the verified hand, Combo, and Belt Check repairs", () => {
  assert.match(layout, /playtest-workspace\.playtest-workspace--hand\s*\{[^}]*grid-area:\s*hand \/ 1 \/ hand \/ -1;[^}]*display:\s*block;/s);
  assert.match(layout, /playtest-workspace--hand \.play-card-row\s*\{[^}]*justify-content:\s*safe center;[^}]*overflow-x:\s*auto;/s);
  assert.match(layout, /grid-template-columns:\s*minmax\(0, 1fr\) 116px;/);
  assert.match(layout, /:not\(\.is-open\)[^}]*width:\s*108px;[^}]*height:\s*112px;/s);
  assert.match(layout, /ascend-featured-combo\[data-combo-popout="ready"\]\.is-open\s*\{[^}]*position:\s*absolute;[^}]*width:\s*100%;[^}]*height:\s*366px;/s);
  assert.match(layout, /ascend-guide-actions > div > small\s*\{\s*display:\s*none;/);
  assert.match(layout, /ascend-desk\.ascend-desk--functional:has\(\.ascend-belt\) > \.ascend-desk-footer\s*\{[^}]*height:\s*52px;[^}]*max-height:\s*52px;/s);
});

test("consolidated layout has explicit spatial ownership", () => {
  assert.match(layout, /grid-template-areas:\s*"status"\s*"arena"\s*"hand"\s*"utility"/);
  assert.match(layout, /\.playtest-shell--live > \.playtest-arena\s*\{[^}]*grid-area:\s*arena/s);
  assert.match(layout, /\.playtest-shell--live \.playtest-table\s*\{[^}]*grid-template-columns:/s);
  assert.match(layout, /\.playtest-shell--live > \.playtest-workspace--hand\s*\{[^}]*grid-area:\s*hand/s);
  assert.match(layout, /\.playtest-shell--live > \.playtest-utility-dock\s*\{[^}]*grid-area:\s*utility/s);
  assert.match(playtest, /className="playtest-table"/);
  assert.match(playtest, /className="playtest-workspace playtest-workspace--hand"/);
});

test("House Rules and hand diagnostics cannot reclaim board layout space", () => {
  assert.match(playtest, /className="playtest-active-variants"/);
  assert.match(layout, /\.playtest-shell--live \.playtest-active-variants\s*\{[^}]*position:\s*absolute[^}]*pointer-events:\s*none/s);
  assert.doesNotMatch(layout, /\.playtest-active-variants\s*\{[^}]*grid-area:/s);
  assert.match(layout, /\.playtest-shell--live \.hand-counters\s*\{[^}]*display:\s*none/s);
  assert.match(layout, /\.hand-panel > header > \.playtest-action-dock\s*\{[^}]*position:\s*relative/s);
});

test("overlay hierarchy uses a small documented layer scale", () => {
  assert.doesNotMatch(layout, /214748|100001|9999/);
  assert.match(layout, /--layer-board:\s*0;/);
  assert.match(layout, /--layer-backdrop:\s*70;/);
  assert.match(layout, /--layer-critical:\s*100;/);
  assert.match(layout, /\.ascend-desk-backdrop[\s\S]*?position:\s*fixed/);
  assert.match(layout, /\.playtest-inspector-backdrop[\s\S]*?position:\s*fixed/);
  assert.match(layout, /\.match-result[\s\S]*?position:\s*fixed/);
});

test("desktop layout has intentional wide, standard, and narrow-safe tiers", () => {
  assert.match(layout, /@media \(min-width:\s*1440px\)/);
  assert.match(layout, /@media \(min-width:\s*1024px\) and \(max-width:\s*1439px\)/);
  assert.match(layout, /@media \(min-width:\s*761px\) and \(max-width:\s*1023px\)/);
  assert.match(layout, /min-width:\s*960px/);
  assert.match(layout, /overflow-x:\s*auto/);
});
