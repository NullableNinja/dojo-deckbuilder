import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyConsumableRuntime,
  consumableRuntimeCommands,
} from "../app/consumable-effect-resolvers.ts";
import {
  applyDefenseRuntime,
  defenseRuntimeCommands,
} from "../app/defense-effect-resolvers.ts";
import { createFamilyRuntimeState } from "../app/family-effect-runtime.ts";
import generatedCards from "../app/data/cards.json" with { type: "json" };
import generatedEffects from "../app/data/card-effects.json" with { type: "json" };

const defenses = generatedEffects.families.Defense.cards;
const consumables = generatedEffects.families.Consumable.cards;
const cardsByCatalogId = new Map(generatedCards.cards.map((entry) => [entry.catalogId, entry]));

function card(catalogId) {
  const entry = cardsByCatalogId.get(catalogId);
  assert.ok(entry, `missing generated card ${catalogId}`);
  return entry;
}

function conditionContext(effect) {
  const context = {};
  for (const condition of effect.conditions ?? []) {
    if (condition.operator === "eq") context[condition.kind] = condition.value;
    else if (condition.operator === "gte" || condition.operator === "gt") context[condition.kind] = Number(condition.value ?? 0) + (condition.operator === "gt" ? 1 : 0);
    else if (condition.operator === "lte" || condition.operator === "lt") context[condition.kind] = Number(condition.value ?? 0) - (condition.operator === "lt" ? 1 : 0);
    else if (condition.operator === "neq") context[condition.kind] = condition.value === true ? false : true;
  }
  return context;
}

const defenseBaseContext = {
  handSize: 5,
  handCount: 5,
  deckSize: 10,
  discardSize: 5,
  equipmentCount: 2,
  friendlyTargetCount: 2,
  opponentTargetCount: 2,
  incomingAttackPower: 4,
  incomingAttackZone: "High",
  selectedEquipmentSubtype: "Gear",
  currentGuard: 2,
  currentSpeed: 2,
  damageTaken: 2,
  hasTempo: true,
};

const consumableBaseContext = {
  hpThresholdMet: true,
  hasTempo: true,
  handEmptyAfterHeal: true,
  normalAttacksResolvedThisTurn: 2,
  reactionItemUsedSinceLastTurn: true,
  temporaryNegativeModifierPresent: true,
  removedTemporaryNegativeModifier: true,
  nextAttackBlocked: true,
  interferencePrevented: false,
  chosenFriendlyIsBenched: false,
  chosenFriendlyIsConscious: true,
  sameTurnSourceActive: true,
  discardedCount: 2,
  revealedFocusValue: 2,
  revealedDifferentTypeCount: 3,
  friendlyTargetCount: 2,
  opponentTargetCount: 2,
  junkDestroyed: true,
  selectedEquipmentSubtype: "Weapon",
};

test("generated runtime contains structured Defense and Consumable families", () => {
  assert.ok(Object.keys(defenses).length > 0);
  assert.ok(Object.keys(consumables).length > 0);
});

test("all generated Defense effects execute through the shared runtime", () => {
  const failures = [];
  for (const [catalogId, entry] of Object.entries(defenses)) {
    for (const effect of entry.effects ?? []) {
      const context = { ...defenseBaseContext, ...conditionContext(effect) };
      const commands = defenseRuntimeCommands(card(catalogId), effect.trigger, context)
        .filter((command) => command.sourceEffectId === effect.id);
      if (!commands.length) failures.push(`${catalogId}:${effect.id}`);
    }
  }
  assert.deepEqual(failures, []);
});

test("all generated Consumable effects execute through the shared runtime", () => {
  const failures = [];
  for (const [catalogId, entry] of Object.entries(consumables)) {
    for (const effect of entry.effects ?? []) {
      const context = { ...consumableBaseContext, ...conditionContext(effect) };
      const commands = consumableRuntimeCommands(card(catalogId), effect.trigger, context)
        .filter((command) => command.sourceEffectId === effect.id);
      if (!commands.length) failures.push(`${catalogId}:${effect.id}`);
    }
  }
  assert.deepEqual(failures, []);
});

test("Defense dedicated resolver metadata is preserved", () => {
  const commands = defenseRuntimeCommands(card("DDB-DEF-CORE-001"), "onPlay", defenseBaseContext);
  assert.ok(commands.length > 0);
});

test("Consumable dedicated resolver metadata is preserved", () => {
  const commands = consumableRuntimeCommands(card("DDB-CON-CORE-001"), "onPlay", consumableBaseContext);
  assert.ok(commands.length > 0);
});

test("human and AI family execution share the same structured state semantics", () => {
  const defenseCard = card("DDB-DEF-CORE-001");
  const humanDefense = applyDefenseRuntime(createFamilyRuntimeState(), defenseCard, "onPlay", defenseBaseContext);
  const aiDefense = applyDefenseRuntime(createFamilyRuntimeState(), defenseCard, "onPlay", defenseBaseContext);
  assert.deepEqual(aiDefense, humanDefense);

  const consumableCard = card("DDB-CON-CORE-006");
  const humanConsumable = applyConsumableRuntime(createFamilyRuntimeState(), consumableCard, "onPlay", consumableBaseContext);
  const aiConsumable = applyConsumableRuntime(createFamilyRuntimeState(), consumableCard, "onPlay", consumableBaseContext);
  assert.deepEqual(aiConsumable, humanConsumable);
});


test("all explicit Defense choice resolvers queue a structured runtime choice", () => {
  const choiceResolvers = new Set([
    "defense.discardChoice",
    "defense.equipmentChoice",
    "defense.optionalDiscardDraw",
    "defense.forceNextAttackZone",
    "defense.blockChoice",
    "defense.deckLookChoice",
    "defense.stepBackCycle",
  ]);
  const failures = [];
  for (const [catalogId, entry] of Object.entries(defenses)) {
    for (const effect of entry.effects ?? []) {
      if (!choiceResolvers.has(effect.resolver) && effect.effect !== "core.choice") continue;
      const context = { ...defenseBaseContext, ...conditionContext(effect) };
      const commands = defenseRuntimeCommands(card(catalogId), effect.trigger, context)
        .filter((command) => command.sourceEffectId === effect.id);
      if (!commands.some((command) => command.choice)) failures.push(`${catalogId}:${effect.id}:choice-not-queued`);
      const state = applyDefenseRuntime(createFamilyRuntimeState(), card(catalogId), effect.trigger, context);
      if (!state.pendingChoices.some((choice) => choice.sourceEffectId === effect.id)) failures.push(`${catalogId}:${effect.id}:choice-not-in-state`);
    }
  }
  assert.deepEqual(failures, []);
});

test("every Consumable explicit-choice resolver queues at least one structured choice contract", () => {
  const choiceResolvers = new Set([
    "consumable.cancelReaction",
    "consumable.chooseOpponentNextAttackPenalty",
    "consumable.chooseFriendlyHealTarget",
    "consumable.chooseOpponentDiscardReactionIfAble",
    "consumable.optionalExhaustToCycle",
    "consumable.raffleTicket",
    "consumable.replaceDisarmWithSelfDestroy",
    "consumable.zoneSpecificIncomingAttackPenalty",
    "consumable.reorderTopThree",
    "consumable.destroyJunkThenDrawTwo",
    "consumable.healByChosenFriendlyPosition",
    "consumable.destroyJunkFromHand",
    "consumable.removeTemporaryNegativeStatModifier",
    "consumable.discardUpToForFocus",
    "consumable.replaceRevealedMarketOrLocation",
    "consumable.suppressChosenWeaponClause",
    "consumable.exhaustEquipmentForFocus",
    "consumable.optionalDestroyJunkFromHand",
    "consumable.healAndRemoveStatus",
    "consumable.topThreeAttackSelection",
    "consumable.chooseOpponentSpeedPenalty",
  ]);
  const failures = [];
  for (const resolver of choiceResolvers) {
    let queued = false;
    for (const [catalogId, entry] of Object.entries(consumables)) {
      for (const effect of entry.effects ?? []) {
        if (effect.resolver !== resolver) continue;
        const context = { ...consumableBaseContext, ...conditionContext(effect) };
        const commands = consumableRuntimeCommands(card(catalogId), effect.trigger, context);
        if (commands.some((command) => command.resolver === resolver && command.choice)) {
          const state = applyConsumableRuntime(createFamilyRuntimeState(), card(catalogId), effect.trigger, context);
          if (state.pendingChoices.some((choice) => choice.resolver === resolver)) queued = true;
        }
      }
    }
    if (!queued) failures.push(`${resolver}:choice-not-queued`);
  }
  assert.deepEqual(failures, []);
});


test("Quick Duel auto-resolves single-opponent Guard penalties and preserves round expiry", () => {
  const sand = consumableRuntimeCommands(card("DDB-CON-CORE-043"), "onPlay", { ...consumableBaseContext, opponentTargetCount: 1 })
    .find((command) => command.resolver === "consumable.chooseOpponentNextDefenseGuardPenalty");
  assert.ok(sand);
  assert.equal(sand.choice, undefined);
  assert.equal(sand.duration, "nextDefense");
  assert.equal(sand.qualifier?.expires, "endOfRound");

  const multiplayer = consumableRuntimeCommands(card("DDB-CON-CORE-043"), "onPlay", { ...consumableBaseContext, opponentTargetCount: 2 })
    .find((command) => command.resolver === "consumable.chooseOpponentNextDefenseGuardPenalty");
  assert.ok(multiplayer?.choice);
});

test("structured this-turn and this-round Consumable statuses carry explicit expiry metadata", () => {
  const cases = [
    ["DDB-CON-CORE-002", "consumable.chooseOpponentNextAttackPenalty", "endOfRound"],
    ["DDB-CON-CORE-004", "consumable.nextQualifyingAttackModifier", "endOfTurn"],
    ["DDB-CON-CORE-007", "consumable.nextAttackUntilEndOfTurn", "endOfTurn"],
    ["DDB-CON-CORE-013", "consumable.nextAttackFlowUntilEndOfTurn", "endOfTurn"],
    ["DDB-CON-CORE-016", "consumable.nextIncomingAttackDefense", "endOfRound"],
    ["DDB-CON-CORE-031", "consumable.pepTalkConditionalAttackBonus", "endOfTurn"],
    ["DDB-CON-CORE-037", "consumable.blockedAttackBacklash", "endOfTurn"],
    ["DDB-CON-CORE-043", "consumable.chooseOpponentNextDefenseGuardPenalty", "endOfRound"],
  ];
  for (const [catalogId, resolver, expiry] of cases) {
    const command = consumableRuntimeCommands(card(catalogId), "onPlay", consumableBaseContext)
      .find((entry) => entry.resolver === resolver);
    assert.ok(command, `${catalogId}:${resolver}`);
    assert.equal(command.qualifier?.expires, expiry, `${catalogId}:${resolver}`);
  }
});
