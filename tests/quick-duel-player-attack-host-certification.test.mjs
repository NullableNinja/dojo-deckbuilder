import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../app/playtest.tsx", import.meta.url);
const source = await readFile(sourceUrl, "utf8");

function sliceBetween(sourceText, startMarker, endMarker) {
  const start = sourceText.indexOf(startMarker);
  assert.ok(start >= 0, `missing start marker: ${startMarker}`);

  const end = sourceText.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `missing end marker after ${startMarker}: ${endMarker}`);

  return sourceText.slice(start, end);
}

test("committed player Attack routes Combo gameplay through the canonical Playtest host", () => {
  const playerAttack = sliceBetween(source, "const resolvePlayerAttackState =", "const declareAttack =");
  assert.match(playerAttack, /prepareQuickDuelPlaytestAttack\(current, "player", card, zone, cardFor, quickDuelHostOperations\)/);
  assert.match(playerAttack, /hostQuickDuelPlaytestCardEvent\(hostedComboMatch, "player", card, zone, cardFor, "onHit", quickDuelHostOperations/);
  assert.match(playerAttack, /hostQuickDuelPlaytestCardEvent\(hostedComboMatch, "player", card, zone, cardFor, "afterResolve", quickDuelHostOperations/);
  assert.doesNotMatch(playerAttack, /comboAttackModifier|comboModifier|evaluateCombo\(/, "player Attack must not retain a parallel Combo rulebook");
});

test("committed AI Attack routes Combo gameplay through the canonical Playtest host", () => {
  const aiAttack = sliceBetween(source, "function openAiStrike", "function finishAiTurn");
  assert.match(aiAttack, /prepareQuickDuelPlaytestAttack\(current, "ai", card, zone, cardFor, quickDuelHostOperations\)/);
  assert.doesNotMatch(aiAttack, /comboAttackModifier|comboModifier|evaluateCombo\(/, "AI Attack declaration must not retain a parallel Combo rulebook");

  const defenseResolution = sliceBetween(source, "const resolveDefenseState =", "const resolveDefense =");
  assert.match(defenseResolution, /hostQuickDuelPlaytestCardEvent\(hostedComboMatch, "ai", aiCard, pending\.zone, cardFor, "onHit", quickDuelHostOperations/);
  assert.match(defenseResolution, /hostQuickDuelPlaytestCardEvent\(hostedComboMatch, "ai", aiCard, pending\.zone, cardFor, "afterResolve", quickDuelHostOperations/);
  assert.doesNotMatch(defenseResolution, /comboAttackModifier|comboModifier|evaluateCombo\(/, "AI Attack resolution must not retain a parallel Combo rulebook");
});

test("committed Reversal routes Combo gameplay through the canonical Playtest host", () => {
  const reversal = sliceBetween(source, "const resolveReversal =", "const useHandCard =");
  assert.match(reversal, /prepareQuickDuelPlaytestAttack\(current, "player", card, zone, cardFor, quickDuelHostOperations, \{ isReversal: true \}\)/);
  assert.match(reversal, /hostQuickDuelPlaytestCardEvent\(hostedComboMatch, "player", card, zone, cardFor, "onHit", quickDuelHostOperations, \{ isReversal: true/);
  assert.match(reversal, /hostQuickDuelPlaytestCardEvent\(hostedComboMatch, "player", card, zone, cardFor, "afterResolve", quickDuelHostOperations, \{ isReversal: true/);
  assert.doesNotMatch(reversal, /comboAttackModifier|comboModifier|evaluateCombo\(/, "Reversal must not retain a parallel Combo rulebook");
});

test("Playtest has no legacy Combo Attack evaluator and evaluateCombo is display-only", () => {
  assert.doesNotMatch(source, /function comboAttackModifier\(/, "legacy Combo Attack evaluator must stay deleted");
  assert.doesNotMatch(source, /type ComboModifier\b/, "legacy ComboModifier type must stay deleted");
  assert.equal((source.match(/comboAttackModifier\(/g) ?? []).length, 0, "no gameplay path may call the deleted Combo evaluator");

  const evaluateComboMatches = [...source.matchAll(/evaluateCombo\(/g)];
  assert.equal(evaluateComboMatches.length, 1, "evaluateCombo may remain only for the Learned Combo display preview");
  const learnedComboDisplay = source.indexOf("const learnedComboStates = player.learnedCombos.map");
  assert.ok(learnedComboDisplay >= 0, "Learned Combo preview state must remain discoverable");
  assert.ok(evaluateComboMatches[0].index > learnedComboDisplay, "the sole evaluateCombo call must be inside the Learned Combo display path");
});
