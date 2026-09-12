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


test("Quick Duel wires structured Location Attack modifiers plus shared Attack/Defense modifiers into combat math", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /printedAttackRuleModifier/);
  assert.match(source, /defenseCardRuleModifier/);
  assert.match(source, /attackHasFlexibleZone/);
  assert.match(source, /structuredLocationAttackForHost/);
  assert.doesNotMatch(source, /locationAttackRuleModifiers\(/);
  assert.match(source, /conditionalHealAfterHit/);
});


test("Quick Duel marks its single friendly fighter so structured healing auto-resolves", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /friendlyTargetCount: 1/);
  assert.match(source, /opponentTargetCount: 1/);
  assert.match(source, /applyStage3CTiming\(next, card, timing, owner, context, "self"\)/);
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

test("Quick Duel wires trigger-heavy Equipment families and Initiate carryover", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /equipmentActivationAvailable/);
  assert.match(source, /equipmentActions/);
  assert.match(source, /autoTriggerAiAfterKataEquipment/);
  assert.match(source, /autoTriggerAiAfterAttackEquipment/);
  assert.match(source, /nextInitiateFocus/);
  assert.match(source, /applyInitiateCarryover/);
  assert.match(source, /lastAttackHit/);
  assert.match(source, /applyMandatoryEquipmentDamageReduction/);
});

test("Cover Up remains the weak universal starter Defense and its printed Guard is added to defense math", async () => {
  const catalog = JSON.parse(await readFile(new URL("../app/data/cards.json", import.meta.url), "utf8"));
  const byName = new Map(catalog.cards.map((card) => [card.name, card]));
  const cover = byName.get("Cover Up");
  assert.equal(cover.zone, "Any");
  assert.equal(Number(cover.stats.Guard), 1);
  for (const name of ["High Guard", "Center Guard", "Low Guard"]) assert.equal(Number(byName.get(name).stats.Guard), 2);
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /defensePower \+= cardPower\(defenseCard\)/);
  assert.match(source, /\$\{defenseCard\.name\} \+\$\{cardPower\(defenseCard\)\} Guard/);
});


test("Quick Duel evaluates Consumable onPlay context after the played card leaves hand and expires qualified statuses", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /const supportEntryBoard = \{ \.\.\.supportBoard, hand: removeOne\(supportBoard\.hand, id\)/);
  assert.match(source, /stage3cConsumableContext\(supportEntryBoard\)/);
  assert.match(source, /function expireStage3CQualified\(board: Board, expires: "endOfTurn" \| "endOfRound"\)/);
  assert.match(source, /status\.qualifier\?\.expires === expires/);
});


test("Quick Duel applies nextIncomingAttack DEF without requiring a Defense card and consumes it independently", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /let defensePower = fighterStat\(nextPlayer, "DEF"\) \+ armorModifier\.value \+ stage3cIncomingAttackDefenseBonus\(nextPlayer\)/);
  assert.match(source, /stage3cIncomingAttackDefenseBonus\(aiDefenseReaction\.board\)/);
  assert.match(source, /nextAi = stage3cConsumeIncomingAttackStatuses\(nextAi\)/);
  assert.match(source, /nextPlayer = stage3cConsumeIncomingAttackStatuses\(nextPlayer\)/);
  assert.match(source, /stage3cConsumeDefenseStatuses\(\{ \.\.\.nextAi/);
});


test("Quick Duel gates Consumable timing and attack restrictions through shared Stage 3C helpers", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /canPlayCoreConsumableInPhase\(card, "defense-window"/);
  assert.match(source, /stage3cRestrictionBlocks\(current\.player\.stage3cRestrictions, "attack"\)/);
  assert.match(source, /stage3cRestrictionBlocks\(prepared\.ai\.stage3cRestrictions, "attack"\)/);
  assert.match(source, /structuredConsumableMandatoryDiscard\(card, stage3cConsumableContext\(supportEntryBoard\)\)/);
  assert.match(source, /revealedFocusValue: board\.deck\.length \? cardFocus\(cardFor\(board\.deck\[board\.deck\.length - 1\]\)\) : 0/);
});


test("Quick Duel resolves structured Consumable watched-Attack followups for both fighters", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /armConsumableAttackFollowupStatuses\(nextPlayer\.stage3cStatuses/);
  assert.match(source, /armConsumableAttackFollowupStatuses\(nextAi\.stage3cStatuses/);
  assert.match(source, /resolveConsumableAttackFollowupStatuses\(nextPlayer\.stage3cStatuses/);
  assert.match(source, /resolveConsumableAttackFollowupStatuses\(nextAi\.stage3cStatuses/);
  assert.match(source, /!isConsumableAttackFollowupStatus\(status\)/);
});


test("Quick Duel persists Consumable Hide effects and Reaction Item history after source cards leave play", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /armConsumableHideStatuses\(armConsumableAttackFollowupStatuses/);
  assert.match(source, /resolveConsumableHideStatuses\(board\.stage3cStatuses/);
  assert.match(source, /reactionItemUsedSinceLastTurn: Boolean\(next\.reactionItemUsedSinceLastTurn\)/);
  assert.match(source, /reactionItemUsedSinceLastTurn: Boolean\(board\.reactionItemUsedSinceLastTurn\)/);
  assert.match(source, /reactionItemUsedSinceLastTurn: false/);
});


test("Quick Duel gives AI the same incoming-combat Consumable Reaction semantics without off-turn printed Focus", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /chooseAiDefensiveConsumable\(candidates/);
  assert.match(source, /applyCardEffects\(entry, selected, "ai", "onPlay", stage3cConsumableContext\(entry\), false\)/);
  assert.match(source, /const ownTurnPlay = current\.phase === "player-yell"/);
  assert.match(source, /cardsThisTurn: ownTurnPlay \?/);
  assert.match(source, /if \(grantPrintedFocus\) next = gainFocus/);
  assert.match(source, /aiConsumableReaction\.notes/);
});
