import assert from "node:assert/strict";
import test from "node:test";
import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, attackPiercing, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, deckLookPlan, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, discardChoiceFollowup, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, mandatoryDiscardChoiceCount, optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor } from "../app/effect-resolvers.ts";

test("Defense Equipment protects only its printed zone", () => {
  const chest = { name: "Cardboard Chestplate", subtype: "Defense Equipment", rulesText: "+2 DEF against Mid Attacks.", stats: { Guard: 2 } };
  assert.equal(defenseEquipmentBonus(chest, "Mid"), 2);
  assert.equal(defenseEquipmentBonus(chest, "High"), 0);
  assert.equal(defenseEquipmentBonus(chest, "Low"), 0);
});

test("multi-zone and all-zone Defense Equipment resolve correctly", () => {
  const arms = { name: "Forearm Guards", subtype: "Defense Equipment", rulesText: "+1 DEF against High and Mid Attacks.", stats: { Guard: 1 } };
  const gi = { name: "Bubble Wrap Gi", subtype: "Defense Equipment", rulesText: "+1 DEF against all zones.", stats: { Guard: 1 } };
  assert.equal(defenseEquipmentBonus(arms, "High"), 1);
  assert.equal(defenseEquipmentBonus(arms, "Mid"), 1);
  assert.equal(defenseEquipmentBonus(arms, "Low"), 0);
  assert.equal(defenseEquipmentBonus(gi, "High"), 1);
  assert.equal(defenseEquipmentBonus(gi, "Mid"), 1);
  assert.equal(defenseEquipmentBonus(gi, "Low"), 1);
});

test("non-armor Gear Guard remains a static defense bonus", () => {
  assert.equal(passiveEquipmentGuard({ subtype: "Gear", stats: { Guard: 1 } }), 1);
  assert.equal(passiveEquipmentGuard({ subtype: "Defense Equipment", stats: { Guard: 3 } }), 0);
});

test("equipped weapons can prime the next Attack after a Defense", () => {
  const result = afterDefenseNextAttackBonus([
    { name: "Bo Staff", rulesText: "After you play a Defense card, your next Attack this turn gets +1 Attack Power." },
    { name: "Unrelated Gear", rulesText: "Once per turn, complain about paperwork." },
  ]);
  assert.equal(result.amount, 1);
  assert.deepEqual(result.sources, ["Bo Staff"]);
});

test("on-hit target debuffs parse real Attack wording", () => {
  assert.equal(targetNextAttackPenalty({ rulesText: "On Hit, the target's next Attack this round gets −2 Attack Power." }), 2);
  assert.equal(targetNextAttackPenalty({ rulesText: "If this Attack Hits, the target's next Attack this round has -1 Attack Power." }), 1);
  assert.equal(targetSpeedPenaltyUntilHonor({ rulesText: "If this Attack Hits, the target's active Character gets −1 Speed until the next Honor Phase." }), 1);
});

test("Consumables marked Destroy after use are removed from circulation", () => {
  assert.equal(destroysAfterUse({ rulesText: "Gain 2 Focus. Destroy this after use." }), true);
  assert.equal(destroysAfterUse({ rulesText: "Gain 2 Focus." }), false);
});


test("location Attack Power rules are applied before damage math", () => {
  const bus = locationAttackRuleModifiers({ name: "City Bus in Motion", rulesText: "Mid Attacks get +1 Attack Power." }, { zone: "Mid", firstAttack: true, attackTags: [], hasWeapon: false, equipmentTags: [] });
  assert.equal(bus.power, 1);
  assert.equal(bus.damage, 0);
  const alley = locationAttackRuleModifiers({ name: "Rain-Slick Alley", rulesText: "Low Attacks get +1 Attack Power. Spin-tag Attacks get -1 Attack Power." }, { zone: "Low", firstAttack: true, attackTags: ["Spin"], hasWeapon: false, equipmentTags: [] });
  assert.equal(alley.power, 0);
});

test("conditional Attack and Defense wording resolves from printed text", () => {
  assert.equal(conditionalAttackPowerBonus({ rulesText: "If you played a Kata this turn, this Attack gets +2 Attack Power." }, { playedKata: true, firstAttack: false }).amount, 2);
  assert.equal(conditionalDefenseGuardBonus({ rulesText: "Against a Weapon Attack, this Defense gets +2 Guard." }, { weaponAttack: true, defenderAttackedThisRound: false }).amount, 2);
  assert.equal(conditionalDefenseGuardBonus({ rulesText: "If you played an Attack this round, this Defense gets +1 Guard." }, { weaponAttack: false, defenderAttackedThisRound: true }).amount, 1);
});

test("equipment conditional Attack bonuses and Speed penalties resolve", () => {
  const bonus = equipmentConditionalAttackPowerBonus([{ name: "Tanto", rulesText: "Your first Attack against a fighter with higher Speed gets +1 Attack Power." }], { firstAttack: true, attackerSpeed: 3, defenderSpeed: 5 });
  assert.equal(bonus.amount, 1);
  assert.equal(equipmentSpeedModifier({ rulesText: "+4 DEF against all zones and −2 Speed." }), -2);
});

test("flexible-zone and conditional recovery wording is recognized", () => {
  assert.equal(attackCanChooseAnyZone({ rulesText: "Choose High, Mid, or Low when declared." }, false, []), true);
  assert.equal(attackCanChooseAnyZone({ rulesText: "" }, true, [{ rulesText: "Your first Attack each turn may be declared as Any zone." }]), true);
  assert.equal(conditionalHealAfterHit({ rulesText: "If you were Hit since your last turn, heal 3 HP." }, true), 3);
  assert.equal(conditionalHealAfterHit({ rulesText: "If you were Hit since your last turn, heal 3 HP." }, false), 0);
});


test("explicit choice resolvers recognize Junk destruction and optional cycling", () => {
  assert.equal(destroyJunkChoiceCount({ rulesText: "Destroy 1 Junk card from your hand or discard pile." }), 1);
  assert.deepEqual(optionalDiscardDrawChoice({ rulesText: "After this Attack resolves, you may discard 1 card to draw 1 card." }), { discard: 1, draw: 1 });
  assert.equal(optionalDiscardDrawChoice({ rulesText: "Draw 1 card." }), null);
});


test("first-incoming Attack and next-Defense penalties persist correctly", () => {
  const shield = firstIncomingAttackPowerPenalty([{ name: "Museum Rope Barrier", rulesText: "The first Attack targeting you each round gets −1 Attack Power." }], true);
  assert.equal(shield.amount, -1);
  assert.equal(firstIncomingAttackPowerPenalty([{ rulesText: "The first Attack targeting you each round gets -2 Attack Power." }], false).amount, 0);
  assert.equal(targetNextDefensePenalty({ rulesText: "Their next Defense card this round gets −2 Guard." }), 2);
  assert.equal(targetNextDefensePenalty({ rulesText: "On Hit, target's next Defense card provides -1 Defense." }), 1);
});


test("Piercing resolvers cover deterministic Attack and Weapon wording", () => {
  assert.equal(attackPiercing({ rulesText: "If the target has matching Armor, this Attack gains Piercing 2." }, { matchingArmor: true, targetEquipmentCount: 1 }).amount, 2);
  assert.equal(attackPiercing({ rulesText: "If the target has two or more permanent Equipment cards equipped, this Attack gets +1 Attack Power and gains Piercing 1." }, { matchingArmor: false, targetEquipmentCount: 2 }).amount, 1);
  assert.equal(attackPiercing({ rulesText: "If your Speed changed this round, this Attack gets Piercing 1." }, { matchingArmor: false, targetEquipmentCount: 0, speedChangedThisRound: true }).amount, 1);
  assert.equal(equipmentPiercing([{ name: "Naginata", rulesText: "Your first Low or Mid Attack each turn gains Piercing 1." }], { firstAttack: true, zone: "Low", matchingArmor: true }).amount, 1);
  assert.equal(equipmentPiercing([{ name: "Club", rulesText: "Your Attacks with this gain Piercing 1 against Armor." }], { firstAttack: false, zone: "Mid", matchingArmor: true }).amount, 1);
});

test("matching-Armor and loaded-target Attack Power clauses resolve with Piercing cards", () => {
  assert.equal(conditionalAttackPowerBonus({ rulesText: "If the target has matching Armor, this Attack gets +1 Attack Power and gains Piercing 1." }, { playedKata: false, firstAttack: false, matchingArmor: true, targetEquipmentCount: 1 }).amount, 1);
  assert.equal(conditionalAttackPowerBonus({ rulesText: "If the target has two or more permanent Equipment cards equipped, this Attack gets +1 Attack Power and gains Piercing 1." }, { playedKata: false, firstAttack: false, matchingArmor: false, targetEquipmentCount: 2 }).amount, 1);
});


test("mandatory draw-discard effects pause for a player choice and apply typed followups", () => {
  assert.equal(mandatoryDiscardChoiceCount({ rulesText: "Draw 1 card, then discard 1 card." }), 1);
  assert.equal(mandatoryDiscardChoiceCount({ rulesText: "You may discard 1 card to draw 1 card." }), 0);
  const huddle = { rulesText: "Draw 1 card, then discard 1 card. If you discarded a Technique, your next Attack this turn gets +1 Attack Power. If you discarded an Item, your next Defense this round gets +1 Guard." };
  assert.equal(discardChoiceFollowup(huddle, { cardType: "Technique" }).nextAttackPower, 1);
  assert.equal(discardChoiceFollowup(huddle, { cardType: "Item" }).nextDefenseGuard, 1);
  assert.equal(discardChoiceFollowup({ rulesText: "If you discarded a card with Focus Value 0, gain 1 Focus." }, { focusValue: 0 }).focus, 1);
});

test("top-deck look/search/reorder patterns compile into explicit plans", () => {
  assert.deepEqual(deckLookPlan({ rulesText: "Look at the top 3 cards of your deck. Put one Defense or Kata into your hand and discard the rest. If you found neither, gain 1 Focus." }), { kind: "pick-discard", count: 3, filter: "defense-or-kata", optional: false, noMatchFocus: 1 });
  assert.deepEqual(deckLookPlan({ rulesText: "Look at the top 3 cards of your deck and put them back in any order. If they contain three different card types, gain 1 Focus." }), { kind: "reorder", count: 3, distinctTypeFocus: 1 });
  assert.deepEqual(deckLookPlan({ rulesText: "Look at the top 3 cards of your deck. Put 1 Technique into your hand; return the rest in any order." }), { kind: "pick-reorder", count: 3, filter: "technique", optional: false });
  assert.deepEqual(deckLookPlan({ rulesText: "Look at the top 5 cards of your deck. You may reveal an Item and put it into your hand. Shuffle the rest." }), { kind: "pick-shuffle", count: 5, filter: "item", optional: true });
  assert.deepEqual(deckLookPlan({ rulesText: "Look at the top 2 cards of your deck. Put them back in either order. If they have different card types, gain 1 Focus." }), { kind: "reorder", count: 2, distinctTypeFocus: 1 });
});
