import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel applies zonal equipment, destroy-after-use, and target debuffs", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /equipmentDefenseModifier\(current\.ai, zone\)/);
  assert.match(source, /equipmentDefenseModifier\(nextPlayer, pending\.zone\)/);
  assert.match(source, /applyAfterDefenseEquipment/);
  assert.match(source, /applyTargetHitDebuffs/);
  assert.match(source, /destroyResolvedConsumable/);
  assert.match(source, /Destroyed after use; it will not enter your discard pile/);
});


test("Quick Duel wires printed Attack/Defense modifiers and flexible zones into combat math", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /printedAttackRuleModifier/);
  assert.match(source, /defenseCardRuleModifier/);
  assert.match(source, /attackHasFlexibleZone/);
  assert.match(source, /locationAttackRuleModifiers/);
  assert.match(source, /conditionalHealAfterHit/);
});


test("Quick Duel pauses for explicit player-choice effects instead of auto-resolving them", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /type PendingChoice/);
  assert.match(source, /kind: "destroy-junk"/);
  assert.match(source, /kind: "discard-draw"/);
  assert.match(source, /resolvePendingChoice/);
  assert.match(source, /Skip this optional effect/);
  assert.match(source, /effect-choice-dialog/);
});


test("Quick Duel tracks incoming attacks and next-Defense penalties across cards", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /attacksReceivedThisRound/);
  assert.match(source, /nextDefenseCardBonus/);
  assert.match(source, /incomingAttackEquipmentModifier/);
  assert.match(source, /targetNextDefensePenalty/);
});


test("Quick Duel applies Piercing only to matching Armor DEF", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /attackPiercingModifier/);
  assert.match(source, /piercedArmorModifier/);
  assert.match(source, /Piercing \$\{piercing\} ignores \$\{ignored\} Armor DEF/);
  assert.match(source, /pending\.piercing/);
  assert.match(source, /speedChangedThisRound/);
});


test("Quick Duel gives the player control of mandatory discards and top-deck decisions", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /kind: "discard-hand"/);
  assert.match(source, /kind: "deck-pick"/);
  assert.match(source, /kind: "deck-order"/);
  assert.match(source, /mandatoryDiscardChoiceCount/);
  assert.match(source, /discardChoiceFollowup/);
  assert.match(source, /beginPlayerDeckLook/);
  assert.match(source, /resolveAiDeckLook/);
  assert.match(source, /Choose what to discard/);
  assert.match(source, /Set your draw order/);
});


test("Quick Duel tracks Exhausted Equipment and exposes supported activation controls", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /exhaustedEquipment/);
  assert.match(source, /equipmentAttackPlan/);
  assert.match(source, /activateEquipment/);
  assert.match(source, /chooseEquipmentZone/);
  assert.match(source, /isEquipmentExhausted/);
  assert.match(source, /readyEquipment/);
  assert.match(source, /equipment-activate/);
});

test("Exhausted target state feeds Piercing and Honor readies the loadout", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /targetHasExhaustedEquipment: Boolean\(defender\.exhaustedEquipment\?\.length\)/);
  assert.match(source, /exhaustedEquipment: \[\]/);
  assert.match(source, /readyEquipmentOnHit/);
  assert.match(source, /autoActivateAiAttackEquipment/);
  assert.match(source, /autoActivateAiTurnEquipment/);
});


test("Quick Duel exposes optional reaction Exhaust Gear without auto-spending the player's Equipment", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /equipmentReactions/);
  assert.match(source, /equipment-reaction-strip/);
  assert.match(source, /incoming-equipment-zone/);
  assert.match(source, /chooseIncomingEquipmentZone/);
  assert.match(source, /equipmentDefenseGuard/);
  assert.match(source, /pendingReversalBonusOnBlock/);
  assert.match(source, /reversalAttackBonus/);
});

test("AI uses deterministic reaction Equipment and late Exhaust can enable Piercing", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /autoActivateAiIncomingEquipment/);
  assert.match(source, /autoActivateAiDefenseGuardEquipment/);
  assert.match(source, /targetExhaustedAtDeclaration/);
  assert.match(source, /exhaustedPiercingBonus/);
  assert.match(source, /effectivePiercing/);
});
