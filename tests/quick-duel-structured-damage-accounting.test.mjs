import assert from "node:assert/strict";
import test from "node:test";
import { applyQuickDuelRuntimeCommands } from "../app/quick-duel-game-host.ts";

function board(overrides = {}) {
  return {
    hp: 10,
    maxHp: 10,
    xp: 0,
    focus: 0,
    tempSpeed: 0,
    nextAttackBonus: 0,
    nextDefenseCardBonus: 0,
    nextAttackHasFlow: false,
    nextAttackAnyZone: false,
    damageTaken: 0,
    damageDealt: 0,
    hand: [],
    discard: [],
    stage3cStatuses: [],
    stage3cChoices: [],
    stage3cRestrictions: [],
    ...overrides,
  };
}

const operations = {
  draw: (state) => state,
};

test("opponent-targeted structured damage reduces target HP and counts as acting damage dealt", () => {
  const command = {
    sourceEffectId: "combo-direct-damage",
    effect: "combat.dealDamage",
    trigger: "onHit",
    target: "opponent",
    amount: 3,
    duration: "immediate",
    conditions: [],
  };

  const result = applyQuickDuelRuntimeCommands(
    { self: board({ damageDealt: 4 }), opponent: board({ hp: 9, damageTaken: 2 }) },
    [command],
    "player",
    operations,
  );

  assert.equal(result.self.hp, 10);
  assert.equal(result.self.damageDealt, 7);
  assert.equal(result.opponent.hp, 6);
  assert.equal(result.opponent.damageTaken, 5);
});

test("structured self damage does not inflate damageDealt", () => {
  const command = {
    sourceEffectId: "self-damage",
    effect: "combat.dealDamage",
    trigger: "afterResolve",
    target: "self",
    amount: 2,
    duration: "immediate",
    conditions: [],
  };

  const result = applyQuickDuelRuntimeCommands(
    { self: board({ damageDealt: 4 }), opponent: board() },
    [command],
    "player",
    operations,
  );

  assert.equal(result.self.hp, 8);
  assert.equal(result.self.damageTaken, 2);
  assert.equal(result.self.damageDealt, 4);
  assert.equal(result.opponent.hp, 10);
});
