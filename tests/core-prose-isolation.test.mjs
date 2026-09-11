import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  afterDefenseAttackPowerBonus,
  afterDefenseNextAttackBonus,
  attackCanChooseAnyZone,
  attackPiercing,
  conditionalAttackPowerBonus,
  conditionalDefenseGuardBonus,
  conditionalHealAfterHit,
  deckLookPlan,
  defenseEquipmentBonus,
  destroyJunkChoiceCount,
  destroyJunkChoicePlan,
  destroysAfterUse,
  discardChoiceFollowup,
  equipmentActivationPlan,
  equipmentConditionalAttackPowerBonus,
  equipmentOnEquipPlan,
  equipmentPiercing,
  equipmentSpeedModifier,
  firstIncomingAttackPowerPenalty,
  mandatoryDamageReductionEquipment,
  mandatoryDiscardChoiceCount,
  nextAttackArmorPenalty,
  optionalCombatDamageReductionEquipment,
  optionalDiscardDrawChoice,
  passiveEquipmentGuard,
  postBlockEquipmentCycle,
  readyEquipmentOnHit,
  structuredConditionalCycle,
  structuredConditionalFocus,
  structuredCurrentAttackFlow,
  structuredFocusIfFastest,
  structuredNextAttackAnyZone,
  structuredNextAttackFlow,
  targetDiscardOnHitCount,
  targetNextAttackPenalty,
  targetNextDefensePenalty,
  targetSpeedPenaltyUntilHonor,
} from "../app/effect-resolvers.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const core = (token) => cards.filter((card) => String(card.catalogId ?? "").includes(`-${token}-CORE-`));

const poison = [
  "Destroy this after use.",
  "Destroy 9 Junk cards from your hand or discard pile.",
  "Draw 9 cards, then discard 9 cards.",
  "If you were Hit since your last turn, heal 99 HP.",
  "On Hit, target discards 9 cards.",
  "Target's next Attack gets -9 Attack Power.",
  "Target's next Defense card gets -9 Guard.",
  "Target gets -9 Speed until the next Honor Phase.",
  "Choose High, Mid, or Low when declared.",
  "This Attack gets +99 Attack Power.",
  "If the target has matching Armor, this Attack gains Piercing 9.",
  "After this Attack resolves, you may discard 1 card to draw 9 cards.",
  "If you discarded a Technique, your next Attack this turn gets +9 Attack Power.",
  "If you discarded an Item, your next Defense this round gets +9 Guard.",
  "If you discarded a card with Focus Value 0, gain 9 Focus.",
  "Look at the top 9 cards of your deck. Put one Defense or Kata into your hand and discard the rest. If you found neither, gain 9 Focus.",
  "Your first Attack each turn may be declared as Any zone.",
  "Your first Attack against a fighter with higher Speed gets +9 Attack Power.",
  "The first Attack targeting you each round gets -9 Attack Power.",
  "Your High Attacks with this gain Piercing 9.",
  "Exhaust: Your next Attack using this Weapon gets +9 Attack Power.",
].join(" ");

const mutate = (card) => ({ ...card, rulesText: poison });
const stable = (label, card, evaluate) => {
  const before = evaluate(card);
  const after = evaluate(mutate(card));
  assert.deepEqual(after, before, `${card.catalogId} changed ${label} when only printed rulesText changed`);
};

const attackContext = {
  playedKata: true,
  firstAttack: true,
  matchingArmor: true,
  targetEquipmentCount: 3,
  attackNumber: 2,
  hasTempo: true,
  hasFewerCardsThanTarget: true,
  targetSpeedHigher: true,
  priorLowAttack: true,
  previousCardIsItemOrConsumable: true,
  hasImprovisedWeapon: true,
  wasHitSinceLastTurn: true,
  differentZoneFromPreviousAttack: true,
  previousAttackZoneMidOrHigh: true,
  priorDifferentZoneCount: 2,
  priorPunchAttack: true,
  priorSpinAttack: true,
  targetTempoUsed: true,
  playedAsReversal: true,
  playedDefenseSinceLastTurn: true,
  blockedSinceLastTurn: true,
  blockedThisRound: true,
  previousAttackBlocked: true,
  previousCardIsKataOrItem: true,
};

const discarded = { cardType: "Technique", subtype: "Attack", focusValue: 0, rulesText: "" };

test("all 71 Core Attacks are invariant to contradictory printed prose across Playtest compatibility helpers", () => {
  const attacks = core("ATK");
  assert.equal(attacks.length, 71);
  for (const card of attacks) {
    stable("conditional Attack Power", card, (entry) => conditionalAttackPowerBonus(entry, attackContext));
    stable("Attack Piercing", card, (entry) => attackPiercing(entry, { matchingArmor: true, targetEquipmentCount: 3, targetHasExhaustedEquipment: true, speedChangedThisRound: true }));
    stable("zone legality", card, (entry) => attackCanChooseAnyZone(entry, true, []));
    stable("ready Equipment on Hit", card, readyEquipmentOnHit);
    stable("target discard", card, targetDiscardOnHitCount);
    stable("next Attack penalty", card, targetNextAttackPenalty);
    stable("next Defense penalty", card, targetNextDefensePenalty);
    stable("Speed penalty", card, (entry) => targetSpeedPenaltyUntilHonor(entry, { previousCardIsItem: true }));
    stable("Defense response Power", card, (entry) => afterDefenseAttackPowerBonus(entry, true));
    stable("armor penalty", card, nextAttackArmorPenalty);
    stable("optional discard/draw", card, optionalDiscardDrawChoice);
    stable("conditional cycle", card, (entry) => structuredConditionalCycle(entry, { timing: "afterResolve", firstAttackThisTurn: true, priorJumpOrSpinAttack: true, previousAttackHit: true, differentZoneFromPreviousAttack: true }));
    stable("conditional Focus", card, (entry) => structuredConditionalFocus(entry, { timing: "onHit", attackNumber: 1, usedEffectIds: [] }));
    stable("current Flow", card, (entry) => structuredCurrentAttackFlow(entry, { hasWeaponEquipped: true }));
    stable("next zone override", card, (entry) => structuredNextAttackAnyZone(entry, { timing: "afterResolve", attackNumber: 1 }));
    stable("next Flow", card, (entry) => structuredNextAttackFlow(entry, { timing: "afterResolve", differentZoneFromPreviousAttack: true }));
    stable("destroy after use", card, destroysAfterUse);
    stable("Junk destroy count", card, destroyJunkChoiceCount);
    stable("Junk destroy plan", card, destroyJunkChoicePlan);
    stable("mandatory discard", card, mandatoryDiscardChoiceCount);
    stable("conditional heal", card, (entry) => conditionalHealAfterHit(entry, true));
    stable("discard followup", card, (entry) => discardChoiceFollowup(entry, discarded));
    stable("deck look", card, deckLookPlan);
  }
});

test("all 62 Core Katas are invariant to contradictory printed prose on bridged semantics", () => {
  const katas = core("KAT");
  assert.equal(katas.length, 62);
  for (const card of katas) {
    stable("destroy after use", card, destroysAfterUse);
    stable("Junk destroy count", card, destroyJunkChoiceCount);
    stable("Junk destroy plan", card, destroyJunkChoicePlan);
    stable("mandatory discard", card, mandatoryDiscardChoiceCount);
    stable("conditional heal", card, (entry) => conditionalHealAfterHit(entry, true));
    stable("discard followup", card, (entry) => discardChoiceFollowup(entry, discarded));
    stable("fastest Focus", card, (entry) => structuredFocusIfFastest(entry, 8, 2));
    stable("next Flow", card, (entry) => structuredNextAttackFlow(entry, { timing: "onPlay", differentZoneFromPreviousAttack: true }));
    stable("next zone override", card, (entry) => structuredNextAttackAnyZone(entry, { timing: "onPlay", attackNumber: 0 }));
    stable("deck look", card, deckLookPlan);
  }
});

test("all 50 Core Defenses and 62 Core Consumables cannot gain compatibility behavior from printed prose", () => {
  const defenses = core("DEF");
  const consumables = core("CON");
  assert.equal(defenses.length, 50);
  assert.equal(consumables.length, 62);
  for (const card of defenses) {
    stable("Defense Guard", card, (entry) => conditionalDefenseGuardBonus(entry, { weaponAttack: true, defenderAttackedThisRound: true, incomingAttackPower: 9, incomingDamage: 2, incomingZone: "Low", incomingTags: ["Kick", "Grapple"], usedConsumableThisRound: true, defensesPlayedThisRound: 0, attacksReceivedThisRound: 1, wasHitThisRound: true, isFastest: true, targetHasMatchingArmor: true, blockSucceeded: true, completesActiveBeltExam: true }));
    stable("optional discard/draw", card, optionalDiscardDrawChoice);
    stable("destroy after use", card, destroysAfterUse);
    stable("conditional heal", card, (entry) => conditionalHealAfterHit(entry, true));
    stable("discard followup", card, (entry) => discardChoiceFollowup(entry, discarded));
    stable("deck look", card, deckLookPlan);
  }
  for (const card of consumables) {
    stable("destroy after use", card, destroysAfterUse);
    stable("Junk destroy count", card, destroyJunkChoiceCount);
    stable("Junk destroy plan", card, destroyJunkChoicePlan);
    stable("mandatory discard", card, mandatoryDiscardChoiceCount);
    stable("next Attack penalty", card, targetNextAttackPenalty);
    stable("next Defense penalty", card, targetNextDefensePenalty);
    stable("Speed penalty", card, (entry) => targetSpeedPenaltyUntilHonor(entry, { previousCardIsItem: true }));
    stable("conditional heal", card, (entry) => conditionalHealAfterHit(entry, true));
    stable("discard followup", card, (entry) => discardChoiceFollowup(entry, discarded));
    stable("deck look", card, deckLookPlan);
  }
});

test("all 135 Core Equipment cards are invariant to contradictory printed prose", () => {
  const equipment = cards.filter((card) => /DDB-(?:DEQ|GEA|WPN)-CORE-/.test(String(card.catalogId ?? "")));
  assert.equal(equipment.length, 135);
  const attack = core("ATK")[0];
  for (const card of equipment) {
    stable("passive Guard", card, passiveEquipmentGuard);
    stable("Defense contribution", card, (entry) => defenseEquipmentBonus(entry, "High", { weaponAttack: true, firstIncomingAttack: true, hasTempo: true, selfIsLowestXp: true, consumableUsedThisRound: true }));
    stable("Speed", card, equipmentSpeedModifier);
    stable("activation", card, equipmentActivationPlan);
    stable("mandatory damage reduction", card, mandatoryDamageReductionEquipment);
    stable("optional damage reduction", card, optionalCombatDamageReductionEquipment);
    stable("post-Block cycle", card, postBlockEquipmentCycle);
    stable("on-Equip plan", card, (entry) => equipmentOnEquipPlan(entry, entry, { sourceActivationArmed: true, beltName: "Black" }));
    stable("after-Defense Attack bonus", card, (entry) => afterDefenseNextAttackBonus([entry]));
    stable("conditional Attack bonus", card, (entry) => equipmentConditionalAttackPowerBonus([entry], { firstAttack: true, attackerSpeed: 1, defenderSpeed: 9, attackNumber: 2, zone: "High", targetXpHigher: true, targetHasTemporaryNegativeStat: true, didNotAttackPreviousTurn: true, hasNotAttackedThisTurn: true, firstAttackAfterKataThisTurn: true, attackTags: ["Kick", "Weapon", "Hand"], blockedThisRound: true, hasTwoPairedWeapons: true, equippedThisTurnCatalogIds: [entry.catalogId], currentAttackIsNormal: true }));
    stable("incoming Attack penalty", card, (entry) => firstIncomingAttackPowerPenalty([entry], true));
    stable("Piercing", card, (entry) => equipmentPiercing([entry], { firstAttack: true, zone: "High", matchingArmor: true, attackTags: ["Kick", "Weapon"] }));
    stable("Equipment zone grant", card, (entry) => attackCanChooseAnyZone(attack, true, [entry]));
  }
});
