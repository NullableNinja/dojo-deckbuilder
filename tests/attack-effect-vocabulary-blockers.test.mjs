import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const vocabulary = JSON.parse(await readFile(new URL("../content/effects.json", import.meta.url), "utf8"));
const attacks = JSON.parse(await readFile(new URL("../content/card-effects/attacks.json", import.meta.url), "utf8"));

const effect = (id) => {
  const found = vocabulary.effects?.[id];
  assert.ok(found, `canonical effect ${id} must exist`);
  return found;
};

const attackEffect = (catalogId, effectId) => {
  const entry = attacks.cards?.[catalogId];
  assert.ok(entry, `${catalogId} must exist in the Attack family registry`);
  const found = entry.effects?.find((candidate) => candidate.id === effectId);
  assert.ok(found, `${effectId} must exist on ${catalogId}`);
  return found;
};

test("Front Ridgehand has a dedicated reusable Equipment DEF suppression vocabulary contract", () => {
  const equipmentDefense = effect("equipment.modifyDefenseContribution");
  assert.equal(equipmentDefense.action, "custom");
  assert.equal(equipmentDefense.implementation, "resolver-required");
  assert.ok(equipmentDefense.allowedTargets.includes("opponent"));
  assert.ok(equipmentDefense.allowedTargets.includes("chosen-equipment"));
  assert.ok(equipmentDefense.allowedTriggers.includes("onHit"));
  assert.ok(equipmentDefense.allowedDurations.includes("nextAttack"));

  const guard = effect("combat.modifyGuard");
  assert.equal(guard.allowedDurations.includes("nextAttack"), false, "Defense-card Guard must not be broadened to nextAttack");

  const ridgehand = attackEffect("DDB-ATK-CORE-026", "attack-front-ridgehand-next-armor-penalty");
  assert.equal(ridgehand.resolver, "attack.nextAttackArmorPenalty");
  assert.equal(ridgehand.target, "opponent");
  assert.equal(ridgehand.amount, -1);
  assert.equal(ridgehand.duration, "nextAttack");
});

test("Inside Crescent Kick's optional discard-to-draw metadata is canonical for core.choice", () => {
  const choice = effect("core.choice");
  assert.ok(choice.allowedTriggers.includes("afterResolve"));
  assert.ok(choice.allowedTargets.includes("self"));
  assert.ok(vocabulary.conditions?.discardCost);
  assert.ok(vocabulary.conditions?.drawAfterCost);

  const crescent = attackEffect("DDB-ATK-CORE-032", "attack-inside-crescent-cycle");
  assert.equal(crescent.resolver, "attack.optionalDiscardDraw");
  assert.deepEqual(crescent.conditions, [
    { kind: "discardCost", operator: "eq", value: 1 },
    { kind: "drawAfterCost", operator: "eq", value: 1 },
  ]);
});

test("Swan Kick's delayed Any-zone grant is valid under combat.chooseZone", () => {
  const chooseZone = effect("combat.chooseZone");
  assert.ok(chooseZone.allowedTriggers.includes("onHit"));
  assert.ok(chooseZone.allowedDurations.includes("nextAttack"));
  assert.ok(chooseZone.allowedTargets.includes("self"));

  const swan = attackEffect("DDB-ATK-CORE-058", "attack-swan-kick-next-any-zone");
  assert.equal(swan.trigger, "onHit");
  assert.equal(swan.target, "self");
  assert.equal(swan.duration, "nextAttack");
  assert.equal(swan.resolver, "attack.grantNextAttackAnyZone");
});
