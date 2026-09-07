import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const fixCss = await readFile(new URL("../app/card-inspector-host-fix.css", import.meta.url), "utf8");
const playtest = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");

const inspectorImport = main.indexOf('import "../app/card-inspector.css";');
const hostFixImport = main.indexOf('import "../app/card-inspector-host-fix.css";');

test("card inspector host recovery loads after the base inspector cascade", () => {
  assert.ok(inspectorImport >= 0, "base Card Inspector stylesheet must remain mounted");
  assert.ok(hostFixImport > inspectorImport, "host recovery must load after Card Inspector styles");
});

test("universal inspector no longer locks the host page vertically", () => {
  assert.match(fixCss, /body:has\(\.universal-card-inspector-backdrop\)[\s\S]*overflow-y:\s*auto\s*!important/);
  assert.match(fixCss, /\.universal-card-inspector-backdrop[\s\S]*overscroll-behavior:\s*contain/);
});

test("Quick Duel loadout remains clickable and its dossier stays above fixed playtest layers", () => {
  assert.match(playtest, /className="fighter-loadout-launch"\s+onClick=\{\(\) => onInspect\(cardFor\(board\.fighterId\)!\)\}/);
  assert.match(fixCss, /\.playtest-inspector-backdrop[\s\S]*z-index:\s*2147483500\s*!important/);
  assert.match(fixCss, /\.fighter-equipment-tabs[\s\S]*pointer-events:\s*auto\s*!important/);
  assert.match(fixCss, /\.fighter-loadout-launch[\s\S]*pointer-events:\s*auto\s*!important/);
});

test("blocking printed-effect choices remain the top interactive Quick Duel layer", () => {
  assert.match(playtest, /className="playtest-inspector-backdrop effect-choice-backdrop"/);
  assert.match(playtest, /onClick=\{usePendingEquipmentChoice\}/);
  assert.match(playtest, /onClick=\{skipPendingChoice\}>Skip this optional effect<\/button>/);
  assert.match(fixCss, /\.effect-choice-backdrop[\s\S]*z-index:\s*2147483647\s*!important/);
  assert.match(fixCss, /\.effect-choice-backdrop[\s\S]*pointer-events:\s*auto\s*!important/);
  assert.match(fixCss, /\.effect-choice-options\s*>\s*button[\s\S]*pointer-events:\s*auto\s*!important/);
  assert.match(fixCss, /footer\s+\.button[\s\S]*pointer-events:\s*auto\s*!important/);
});
