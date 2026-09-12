import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const controller = readFileSync(new URL("../app/ascend-combo-popout.ts", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/playtest-layout.css", import.meta.url), "utf8");

test("Ascend Combo controller loads while styling stays in the consolidated presentation owner", () => {
  assert.match(main, /import "\.\.\/app\/playtest-layout\.css";/);
  assert.match(main, /import "\.\.\/app\/ascend-combo-popout";/);
  assert.doesNotMatch(main, /ascend-combo-button\.css/);
});

test("desktop Combo button opens and closes without changing gameplay state", () => {
  assert.match(controller, /COMBO_PANEL_SELECTOR\s*=\s*"\.playtest-shell--live \.ascend-featured-combo"/);
  assert.match(controller, /panel\.classList\.toggle\("is-open", open\)/);
  assert.match(controller, /event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*setPanelOpen\(panel, true\)/);
  assert.match(controller, /event\.key === "Escape"/);
  assert.match(controller, /aria-expanded/);
});

test("collapsed Combo is only a compact end-of-row button", () => {
  assert.match(layout, /grid-template-columns:\s*minmax\(0, 1fr\) 116px;/);
  assert.match(layout, /:not\(\.is-open\)[\s\S]*width:\s*108px;[\s\S]*height:\s*112px;/);
  assert.match(layout, /:not\(\.is-open\)[\s\S]*ascend-featured-combo-card,[\s\S]*ascend-featured-combo-meta,[\s\S]*ascend-featured-combo-copy,[\s\S]*ascend-featured-combo-actions[\s\S]*display:\s*none;/);
  assert.match(layout, /content:\s*"COMBO"/);
  assert.match(layout, /content:\s*"OPEN ↗"/);
});

test("expanded Combo replaces the Market lane with requirements and actions visible", () => {
  assert.match(layout, /ascend-featured-combo\[data-combo-popout="ready"\]\.is-open\s*\{[\s\S]*position:\s*absolute;[\s\S]*height:\s*366px;[\s\S]*overflow:\s*hidden;/);
  assert.match(layout, /\.is-open > \.ascend-featured-combo-copy[\s\S]*display:\s*grid;/);
  assert.match(layout, /\.is-open > \.ascend-featured-combo-actions[\s\S]*display:\s*flex;/);
  assert.match(layout, /content:\s*"CLOSE ×"/);
});
