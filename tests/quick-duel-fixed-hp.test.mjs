import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const playtest = readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
const rules = JSON.parse(readFileSync(new URL("../app/data/rules.json", import.meta.url), "utf8"));
const definition = JSON.parse(readFileSync(new URL("../app/data/game-definition.json", import.meta.url), "utf8"));

test("Quick Duel promotion keeps current and Max HP fixed", () => {
  assert.equal(definition.progression.quickDuelUsesFullBeltRewards, false);
  assert.match(playtest, /schema: 8/);
  assert.match(playtest, /function applyBeltPromotion[\s\S]*return \{ \.\.\.board, belt: beltIndex \};/);
  assert.doesNotMatch(playtest.match(/function applyBeltPromotion[\s\S]*?\n\}/)?.[0] ?? "", /maxHpIncrease|board\.hp \+ 5/);
});

test("published Quick Duel rules explicitly disable promotion HP rewards", () => {
  const text = JSON.stringify(rules);
  assert.match(text, /promotion never raises Max HP or heals a fighter/);
  assert.match(text, /Quick Duel ignores every promotion's Max HP increase and healing/);
  assert.match(text, /Quick Duel ignores promotion Max-HP increases and promotion healing/);
});
