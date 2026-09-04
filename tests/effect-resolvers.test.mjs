import assert from "node:assert/strict";
import test from "node:test";
import { afterDefenseNextAttackBonus, defenseEquipmentBonus, destroysAfterUse, passiveEquipmentGuard, targetNextAttackPenalty, targetSpeedPenaltyUntilHonor } from "../app/effect-resolvers.ts";

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
