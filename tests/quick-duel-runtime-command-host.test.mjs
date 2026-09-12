import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyQuickDuelRuntimeCommands } from "../app/quick-duel-runtime-command-host.ts";

const source = await readFile(new URL("../app/quick-duel-runtime-command-host.ts", import.meta.url), "utf8");

function board(overrides = {}) {
  return {
    hp: 10,
    maxHp: 10,
    xp: 0,
    focus: 0,
    focusGeneratedThisTurn: 0,
    tempSpeed: 0,
    nextAttackBonus: 0,
    nextDefenseCardBonus: 0,
    nextAttackHasFlow: false,
    nextAttackAnyZone: false,
    damageTaken: 0,
    speedChangedThisRound: false,
    hand: ["a", "b", "c"],
    stage3cStatuses: [],
    stage3cChoices: [],
    stage3cRestrictions: [],
    stage3cDefenseModifier: 0,
    stage3cAttackModifier: 0,
    stage3cSpeedOverride: null,
    stage3cPurchaseCostModifier: 0,
    drawn: 0,
    discardedByAi: 0,
    ...overrides,
  };
}

const operations = {
  draw: (state, amount) => ({ ...state, drawn: state.drawn + Math.max(0, amount) }),
  discardForAi: (state, amount) => ({ ...state, discardedByAi: state.discardedByAi + Math.min(state.hand.length, Math.max(0, amount)) }),
};

function command(effect, amount, target = "self", duration = "immediate", extras = {}) {
  return {
    sourceEffectId: `${effect}-${target}-${duration}`,
    effect,
    trigger: "onHit",
    target,
    amount,
    duration,
    conditions: [],
    ...extras,
  };
}

test("generic runtime command host routes self and opponent effects without card identity", () => {
  const result = applyQuickDuelRuntimeCommands({ self: board(), opponent: board() }, [
    command("core.gainXP", 1),
    command("combat.dealDamage", 2, "opponent"),
    command("core.gainFocus", 2),
  ], "player", operations);
  assert.equal(result.self.xp, 1);
  assert.equal(result.self.focus, 2);
  assert.equal(result.self.focusGeneratedThisTurn, 2);
  assert.equal(result.opponent.hp, 8);
  assert.equal(result.opponent.damageTaken, 2);
});

test("persistent opponent modifiers are applied and stored on the targeted board", () => {
  const result = applyQuickDuelRuntimeCommands({ self: board(), opponent: board() }, [
    command("combat.modifySpeed", -1, "opponent", "nextHonor"),
  ], "player", operations);
  assert.equal(result.self.tempSpeed, 0);
  assert.equal(result.opponent.tempSpeed, -1);
  assert.equal(result.opponent.stage3cStatuses.length, 1);
  assert.equal(result.opponent.stage3cStatuses[0].duration, "nextHonor");
  assert.equal(result.opponent.stage3cStatuses[0].target, "self");
});

test("draw and discard remain host operations rather than card-specific runtime logic", () => {
  const player = applyQuickDuelRuntimeCommands({ self: board(), opponent: board() }, [
    command("core.draw", 2),
    command("core.discard", 1),
  ], "player", operations);
  assert.equal(player.self.drawn, 2);
  assert.equal(player.self.stage3cChoices.length, 1);
  assert.equal(player.self.stage3cChoices[0].payload.count, 1);

  const ai = applyQuickDuelRuntimeCommands({ self: board(), opponent: board() }, [command("core.discard", 2)], "ai", operations);
  assert.equal(ai.self.discardedByAi, 2);
  assert.equal(ai.self.stage3cChoices.length, 0);
});

test("choice commands remain structured UI choices and are not executed as prose", () => {
  const choice = command("core.choice", 0, "self", "immediate", {
    resolver: "combo.discardWeaponChoice",
    choice: { kind: "chooseCard", filter: { tag: "Weapon" } },
  });
  const result = applyQuickDuelRuntimeCommands({ self: board(), opponent: board() }, [choice], "player", operations);
  assert.equal(result.self.stage3cChoices.length, 1);
  assert.equal(result.self.stage3cChoices[0].resolver, "combo.discardWeaponChoice");
  assert.deepEqual(result.self.stage3cChoices[0].payload.filter, { tag: "Weapon" });
});

test("runtime command projection has no card/fighter identity or printed-rules parsing", () => {
  assert.doesNotMatch(source, /DDB-(?:ATK|DEF|KAT|CON|ITM|CMB|CHR|LOC)-CORE-/);
  assert.doesNotMatch(source, /rulesText|Requirement:|Payoff:|fighterId\s*===|catalogId\s*===/);
  assert.match(source, /RuntimeCommand/);
});
