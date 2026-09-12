import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const controller = readFileSync(new URL("../app/ascend-combo-popout.ts", import.meta.url), "utf8");
const repair = readFileSync(new URL("../app/playtest-visual-repair.css", import.meta.url), "utf8");

test("Ascend Combo popout controller is loaded by the application shell", () => {
  assert.match(main, /import "\.\.\/app\/ascend-combo-popout";/);
});

test("desktop Combo tile opens and closes without changing gameplay state", () => {
  assert.match(controller, /COMBO_PANEL_SELECTOR\s*=\s*"\.playtest-shell--live \.ascend-featured-combo"/);
  assert.match(controller, /panel\.classList\.toggle\("is-open", open\)/);
  assert.match(controller, /event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*setPanelOpen\(panel, true\)/);
  assert.match(controller, /event\.key === "Escape"/);
  assert.match(controller, /aria-expanded/);
});

test("collapsed Combo is a compact launcher at the end of the one-row Market", () => {
  assert.match(repair, /ascend-market:has\(\.ascend-featured-combo\[data-combo-popout="ready"\]\)[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 148px;[\s\S]*grid-template-areas:[\s\S]*"market combo"/);
  assert.match(repair, /ascend-featured-combo\[data-combo-popout="ready"\][\s\S]*height:\s*366px;[\s\S]*overflow:\s*hidden;/);
  assert.match(repair, /content:\s*"OPEN COMBO ↗"/);
});

test("expanded Combo overlays the Market lane with requirements and actions visible", () => {
  assert.match(repair, /ascend-featured-combo\[data-combo-popout="ready"\]\.is-open\s*\{[\s\S]*position:\s*absolute;[\s\S]*height:\s*366px;[\s\S]*overflow:\s*hidden;/);
  assert.match(repair, /\.is-open > \.ascend-featured-combo-copy\s*\{[\s\S]*display:\s*grid;[\s\S]*overflow:\s*visible;/);
  assert.match(repair, /\.is-open > \.ascend-featured-combo-actions\s*\{[\s\S]*display:\s*flex;/);
  assert.match(repair, /content:\s*"CLOSE ×"/);
});
