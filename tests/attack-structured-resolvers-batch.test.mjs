import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { effectPlanForCard } from "../app/effect-registry.ts";
import {
  afterDefenseAttackPowerBonus,
  attackPiercing,
  attackPiercingModifier,
  conditionalAttackPowerBonus,
  nextAttackArmorPenalty,
  structuredAttackCyclePlan,
  structuredConditionalFocus,
  structuredCurrentAttackFlow,
  structuredNextAttackAnyZone,
  structuredNextAttackFlow,
  targetSpeedPenaltyUntilHonor,
} from "../app/attack-effect-resolvers.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const registry = JSON.parse(await readFile(new URL("../content/card-effects.json", import.meta.url), "utf8"));
const card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);
const powerContext = (extra = {}) => ({
  attackNumber: 1,
  previousAttackHit: false,
  previousAttackBlocked: false,
  previousCardIsKataOrItem: false,
  previousCardIsItem: false,
  hasTempo: false,
  speedChangedThisRound: false,
  targetHasMatchingArmor: false,
  targetEquipmentCount: 0,
  targetHasExhaustedEquipment: false,
  currentZone: "High",
  priorZones: [],
  ...extra,
});

// Keep the existing resolver certification dense while allowing live play-surface
// refactors to change local board variable names without weakening semantics.

test("post-Defense Attack modifiers feed final power into AI damage math", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /const finalAttackPower = Math\.max\(0, pending\.attackPower \+ postDefensePower\.amount\);/);
  assert.match(source, /const rawDamage = hit \? Math\.max\(0, finalAttackPower - defensePower \+ \(pending\.damageModifier \?\? 0\)\) : 0;/);
  assert.doesNotMatch(source, /const rawDamage = hit \? Math\.max\(0, pending\.attackPower - defensePower \+ \(pending\.damageModifier \?\? 0\)\) : 0;/);
});

test("Block memory includes zero-damage strikes stopped by standing DEF or Armor", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(!hit\) nextPlayer = \{ \.\.\.nextPlayer, blockedSinceLastTurn: true, blockedThisRound: true \};/);
  const aiBlockMemory = source.match(/if \(!hit\) (?:nextAi|reactingAi) = \{ \.\.\.(?:nextAi|reactingAi), blockedSinceLastTurn: true, blockedThisRound: true \};/g) ?? [];
  assert.ok(aiBlockMemory.length >= 2, "normal Attacks and Reversals must both remember standing-DEF Blocks");
  assert.doesNotMatch(source, /if \(!hit && defenseCard\) nextPlayer = \{ \.\.\.nextPlayer, blockedSinceLastTurn: true, blockedThisRound: true \};/);
});
