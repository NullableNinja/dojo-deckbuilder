import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../app/playtest.tsx", import.meta.url);

test("committed player Attack routes Combo gameplay through the canonical Playtest host", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const start = source.indexOf("  const resolvePlayerAttackState = (current: Match): Match => {");
  const end = source.indexOf("\n  const declareAttack =", start);
  assert.ok(start >= 0 && end > start, "player Attack function boundaries must remain discoverable");

  const playerAttack = source.slice(start, end);
  assert.match(playerAttack, /prepareQuickDuelPlaytestAttack\(current, "player", card, zone, cardFor, quickDuelHostOperations\)/);
  assert.match(playerAttack, /hostQuickDuelPlaytestCardEvent\(hostedComboMatch, "player", card, zone, cardFor, "onHit"/);
  assert.match(playerAttack, /hostQuickDuelPlaytestCardEvent\(hostedComboMatch, "player", card, zone, cardFor, "afterResolve"/);
  assert.doesNotMatch(playerAttack, /comboAttackModifier|comboModifier/, "player Attack must not retain a parallel Combo rulebook");
});

test("committed AI Attack routes Combo gameplay through the canonical Playtest host", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const start = source.indexOf("function openAiStrike(current: Match, cardId: string, remainingAiAttacks: string[], useTempo: boolean) {");
  const end = source.indexOf("\nfunction ", start + 10);
  assert.ok(start >= 0 && end > start, "AI Attack function boundaries must remain discoverable");

  const aiAttack = source.slice(start, end);
  assert.match(aiAttack, /prepareQuickDuelPlaytestAttack\(current, "ai", card, zone, cardFor, quickDuelHostOperations\)/);
  assert.doesNotMatch(aiAttack, /comboAttackModifier|comboModifier/, "AI Attack must not retain a parallel Combo rulebook");

  const defenseStart = source.indexOf("  const resolveDefenseState = (current: Match, defenseId: string | null");
  const defenseEnd = source.indexOf("\n  const resolveDefense =", defenseStart);
  assert.ok(defenseStart >= 0 && defenseEnd > defenseStart, "Defense resolution boundaries must remain discoverable");
  const defenseResolution = source.slice(defenseStart, defenseEnd);
  assert.match(defenseResolution, /hostQuickDuelPlaytestCardEvent\(hostedComboMatch, "ai", aiCard, pending\.zone, cardFor, "onHit"/);
  assert.match(defenseResolution, /hostQuickDuelPlaytestCardEvent\(hostedComboMatch, "ai", aiCard, pending\.zone, cardFor, "afterResolve"/);

  const remainingLegacyAttackCalls = source.match(/comboAttackModifier\(current\./g) ?? [];
  assert.equal(remainingLegacyAttackCalls.length, 1, "only Reversal may remain on the legacy Combo path during this migration stage");
});
