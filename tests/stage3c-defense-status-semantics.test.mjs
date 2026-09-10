import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeNextDefenseStatuses,
  consumeNextIncomingAttackStatuses,
  nextDefenseGuardBonus,
  nextIncomingAttackDefenseBonus,
} from "../app/stage3c-defense-status-semantics.ts";

const status = (overrides) => ({
  sourceEffectId: "test-effect",
  effect: "combat.modifyDefense",
  target: "self",
  amount: 1,
  duration: "nextIncomingAttack",
  ...overrides,
});

test("next incoming Attack DEF applies independently of playing a Defense card", () => {
  const statuses = [
    status({ sourceEffectId: "ice-pack", amount: 1 }),
    status({ sourceEffectId: "pocket-sand", effect: "combat.modifyGuard", amount: -2, duration: "nextDefense" }),
  ];
  assert.equal(nextIncomingAttackDefenseBonus(statuses), 1);
  assert.equal(nextDefenseGuardBonus(statuses), -2);
});

test("incoming-Attack and next-Defense statuses consume on different gameplay events", () => {
  const statuses = [
    status({ sourceEffectId: "ice-pack" }),
    status({ sourceEffectId: "pocket-sand", effect: "combat.modifyGuard", amount: -2, duration: "nextDefense" }),
  ];
  const afterIncomingAttack = consumeNextIncomingAttackStatuses(statuses);
  assert.equal(afterIncomingAttack.some((entry) => entry.sourceEffectId === "ice-pack"), false);
  assert.equal(afterIncomingAttack.some((entry) => entry.sourceEffectId === "pocket-sand"), true);

  const afterDefense = consumeNextDefenseStatuses(statuses);
  assert.equal(afterDefense.some((entry) => entry.sourceEffectId === "ice-pack"), true);
  assert.equal(afterDefense.some((entry) => entry.sourceEffectId === "pocket-sand"), false);
});

test("consuming the next incoming Attack does not erase unrelated persistent statuses", () => {
  const statuses = [
    status({ sourceEffectId: "seaweed-wrap", amount: 1 }),
    status({ sourceEffectId: "pocket-sand", effect: "combat.modifyGuard", amount: -2, duration: "nextDefense" }),
    status({ sourceEffectId: "plum-wine", effect: "core.custom", amount: -1, duration: "nextTurn", qualifier: { stat: "DEF" } }),
  ];
  const remaining = consumeNextIncomingAttackStatuses(statuses);
  assert.deepEqual(remaining.map((entry) => entry.sourceEffectId), ["pocket-sand", "plum-wine"]);
});
