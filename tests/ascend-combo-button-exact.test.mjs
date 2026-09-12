import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/ascend-combo-button.css", import.meta.url), "utf8");
const controller = readFileSync(new URL("../app/ascend-combo-popout.ts", import.meta.url), "utf8");

test("exact Combo correction loads after the earlier visual repair", () => {
  const repair = main.indexOf('import "../app/playtest-visual-repair.css";');
  const exact = main.indexOf('import "../app/ascend-combo-button.css";');
  assert.ok(repair >= 0 && exact > repair);
});

test("collapsed Featured Combo is a compact button rather than a miniature side panel", () => {
  assert.match(css, /ascend-featured-combo\[data-combo-popout="ready"\]:not\(\.is-open\)[\s\S]*width:\s*108px;[\s\S]*height:\s*112px;/);
  assert.match(css, /:not\(\.is-open\)[\s\S]*ascend-featured-combo-card,[\s\S]*ascend-featured-combo-meta,[\s\S]*ascend-featured-combo-copy,[\s\S]*ascend-featured-combo-actions[\s\S]*display:\s*none;/);
  assert.match(css, /header::before\s*\{[\s\S]*content:\s*"COMBO";/);
  assert.match(css, /header::after\s*\{[\s\S]*content:\s*"OPEN ↗";/);
});

test("Market keeps one horizontal lane with only a narrow Combo launcher column", () => {
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) 116px;/);
  assert.match(css, /grid-template-rows:\s*auto 366px;/);
});

test("expanded Combo replaces the Market lane and exposes card, rules and actions without vertical scrolling", () => {
  assert.match(css, /\.is-open\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset:\s*54px 0 auto 0;[\s\S]*height:\s*366px;[\s\S]*overflow:\s*hidden;/);
  assert.match(css, /\.is-open > \.ascend-featured-combo-card[\s\S]*width:\s*180px;[\s\S]*justify-self:\s*center;/);
  assert.match(css, /\.is-open > \.ascend-featured-combo-copy[\s\S]*grid-area:\s*combo-copy;[\s\S]*overflow:\s*hidden;/);
  assert.match(css, /\.is-open > \.ascend-featured-combo-actions[\s\S]*display:\s*flex;[\s\S]*justify-content:\s*flex-end;/);
});

test("existing controller still provides click, keyboard and Escape toggling", () => {
  assert.match(controller, /aria-expanded/);
  assert.match(controller, /event\.key === "Escape"/);
  assert.match(controller, /event\.key === "Enter"/);
  assert.match(controller, /event\.key === " "/);
  assert.match(controller, /setPanelOpen\(panel, true\)/);
});
