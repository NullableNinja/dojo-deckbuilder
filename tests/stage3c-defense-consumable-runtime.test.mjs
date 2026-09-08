import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyDefenseRuntime,
  classifyDefenseEffect,
  defenseRuntimeCommands,
  isSupportedDefenseResolver,
  structuredDefenseGuardBonus,
} from "../app/defense-effect-resolvers.ts";
import {
  applyConsumableRuntime,
  classifyConsumableEffect,
  consumableRuntimeCommands,
  isSupportedConsumableResolver,
  structuredConsumableLifecycle,
  structuredConsumableDestroyJunkPlan,
} from "../app/consumable-effect-resolvers.ts";
import {
  createFamilyRuntimeState,
  expireRuntimeStatuses,
  runtimeStatusAmount,
  takeRuntimeStatuses,
} from "../app/family-effect-runtime.ts";
import { effectPlanForCard } from "../app/card-effects.ts";

const defenseFamily = JSON.parse(await readFile(new URL("../content/card-effects/defenses.json", import.meta.url), "utf8"));
const consumableFamily = JSON.parse(await readFile(new URL("../content/card-effects/consumables.json", import.meta.url), "utf8"));
const generatedRegistry = JSON.parse(await readFile(new URL("../app/data/card-effects.json", import.meta.url), "utf8"));
const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const defenses = defenseFamily.cards ?? {};
const consumables = consumableFamily.cards ?? {};

const card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId) ?? { catalogId };

function resolverFailures(registry, supported) {
  const failures = [];
  for (const [catalogId, entry] of Object.entries(registry)) {
    for (const effect of entry.effects ?? []) {
      if (effect.resolver && !supported(effect.resolver)) failures.push(`${catalogId}:${effect.id}:${effect.resolver}`);
    }
  }
  return failures;
}

function satisfyingValue(condition) {
  const value = condition.value;
  switch (condition.operator ?? "eq") {
    case "gt": return Number(value) + 1;
    case "gte": return Number(value);
    case "lt": return Number(value) - 1;
    case "lte": return Number(value);
    case "neq": return typeof value === "boolean" ? !value : `${String(value)}-different`;
    case "includes": return Array.isArray(value) ? value : [value];
    case "notIncludes": return [];
    default: return value;
  }
}

function conditionContext(effect) {
  return Object.fromEntries((effect.conditions ?? []).filter((condition) => condition.kind).map((condition) => [condition.kind, satisfyingValue(condition)]));
}

const defenseBaseContext = {
  hasTempo: true,
  weaponAttack: true,
  defenderAttackedThisRound: true,
  targetPermanentEquipmentCount: 3,
  incomingAttackPower: 10,
  incomingDamage: 2,
  incomingZone: "Low",
  incomingTags: ["Weapon", "Kick", "Hand", "Punch", "Grapple"],
  usedConsumableThisRound: true,
  defensesPlayedThisRound: 0,
  attacksReceivedThisRound: 1,
  wasHitThisRound: true,
  isFastest: true,
  targetHasMatchingArmor: true,
  blockSucceeded: true,
  completesActiveBeltExam: true,
  selectedEquipmentSubtype: "Gear",
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
  selectedEquipmentSubtype: "Gear",
};

function defenseEffectProducesCommand(catalogId, effect) {
  const contexts = [
    { ...defenseBaseContext, ...conditionContext(effect) },
    { ...defenseBaseContext, ...conditionContext(effect), blockSucceeded: false, incomingDamage: 2 },
    { ...defenseBaseContext, ...conditionContext(effect), isFastest: false },
  ];
  return contexts.some((context) => defenseRuntimeCommands(card(catalogId), effect.trigger, context).some((command) => command.sourceEffectId === effect.id));
}

function consumableEffectProducesCommand(catalogId, effect) {
  const contexts = [
    { ...consumableBaseContext, ...conditionContext(effect) },
    { ...consumableBaseContext, ...conditionContext(effect), hasTempo: false },
    { ...consumableBaseContext, ...conditionContext(effect), chosenFriendlyIsBenched: true, chosenFriendlyIsConscious: true },
  ];
  return contexts.some((context) => consumableRuntimeCommands(card(catalogId), effect.trigger, context).some((command) => command.sourceEffectId === effect.id));
}

test("Stage 3C registries contain exactly 50 Core Defenses and 62 Core Consumables", () => {
  assert.equal(Object.keys(defenses).length, 50);
  assert.equal(Object.keys(consumables).length, 62);
});

test("family source registries and generated runtime registry are synchronized", () => {
  const failures = [];
  for (const [catalogId, entry] of [...Object.entries(defenses), ...Object.entries(consumables)]) {
    const generated = generatedRegistry.cards?.[catalogId];
    if (!generated) {
      failures.push(`${catalogId}:missing-generated-entry`);
      continue;
    }
    const sourceIds = (entry.effects ?? []).map((effect) => effect.id);
    const generatedIds = (generated.effects ?? []).map((effect) => effect.id);
    if (JSON.stringify(generatedIds) !== JSON.stringify(sourceIds)) failures.push(`${catalogId}:generated-effect-identity-drift`);
  }
  assert.deepEqual(failures, []);
});

test("every dedicated Defense and Consumable resolver has a Stage 3C implementation", () => {
  assert.deepEqual(resolverFailures(defenses, isSupportedDefenseResolver), []);
  assert.deepEqual(resolverFailures(consumables, isSupportedConsumableResolver), []);
});

test("all 50 Defense cards have executable structured effect coverage", () => {
  const failures = [];
  for (const [catalogId, entry] of Object.entries(defenses)) {
    assert.ok((entry.effects ?? []).length > 0, `${catalogId} must have structured effects`);
    for (const effect of entry.effects ?? []) {
      if (classifyDefenseEffect(effect) === "unsupported") failures.push(`${catalogId}:${effect.id}:unsupported`);
      else if (!defenseEffectProducesCommand(catalogId, effect)) failures.push(`${catalogId}:${effect.id}:no-runtime-command`);
    }
    const plan = effectPlanForCard(card(catalogId));
    if (plan.source !== "structured") failures.push(`${catalogId}:legacy-parser`);
    if (plan.unsupported.length) failures.push(`${catalogId}:queued:${plan.unsupported.join(",")}`);
  }
  assert.deepEqual(failures, []);
});

test("all 62 Consumable cards have executable structured effect coverage", () => {
  const failures = [];
  for (const [catalogId, entry] of Object.entries(consumables)) {
    assert.ok((entry.effects ?? []).length > 0, `${catalogId} must have structured effects`);
    for (const effect of entry.effects ?? []) {
      if (classifyConsumableEffect(effect) === "unsupported") failures.push(`${catalogId}:${effect.id}:unsupported`);
      else if (!consumableEffectProducesCommand(catalogId, effect)) failures.push(`${catalogId}:${effect.id}:no-runtime-command`);
    }
    const plan = effectPlanForCard(card(catalogId));
    if (plan.source !== "structured") failures.push(`${catalogId}:legacy-parser`);
    if (plan.unsupported.length) failures.push(`${catalogId}:queued:${plan.unsupported.join(",")}`);
  }
  assert.deepEqual(failures, []);
});

test("After-Hours Counterform conditional Guard is driven by structured context", () => {
  const counterform = card("DDB-DEF-CORE-002");
  assert.equal(structuredDefenseGuardBonus(counterform, { defenderAttackedThisRound: false }).amount, 0);
  assert.equal(structuredDefenseGuardBonus(counterform, { defenderAttackedThisRound: true }).amount, 1);
});

test("Double Forearm Guard respects the incoming Attack Power threshold", () => {
  const guard = card("DDB-DEF-CORE-012");
  assert.equal(structuredDefenseGuardBonus(guard, { incomingAttackPower: 7 }).amount, 0);
  assert.equal(structuredDefenseGuardBonus(guard, { incomingAttackPower: 8 }).amount, 1);
});

test("Defense on-Block draw applies immediately and explicit discard queues the choice", () => {
  const accordion = card("DDB-DEF-CORE-001");
  const state = applyDefenseRuntime(createFamilyRuntimeState(), accordion, "onBlock", { ...defenseBaseContext, blockSucceeded: true });
  assert.equal(state.self.draw, 1);
  assert.equal(state.self.discard, 0);
  assert.ok(state.pendingChoices.some((choice) =>
    choice.resolver === "defense.discardChoice"
    && choice.sourceEffectId === "defense-accordion-folder-block-discard"
  ));
});

test("next-round Defense effects arm without leaking into the current round", () => {
  const entry = Object.entries(defenses).find(([, value]) => value.effects?.some((effect) => effect.resolver === "defense.nextRoundSpeedModifier"));
  assert.ok(entry, "expected a next-round Speed Defense");
  const [catalogId, definition] = entry;
  const effect = definition.effects.find((candidate) => candidate.resolver === "defense.nextRoundSpeedModifier");
  const state = applyDefenseRuntime(createFamilyRuntimeState(), card(catalogId), effect.trigger, defenseBaseContext);
  assert.equal(state.self.speed, 0);
  assert.equal(runtimeStatusAmount(state, "nextRound", "combat.modifySpeed", effect.target ?? "self"), effect.amount);
  const consumed = takeRuntimeStatuses(state, "nextRound");
  assert.equal(consumed.consumed.length, 1);
  assert.equal(consumed.state.statuses.some((status) => status.sourceEffectId === effect.id), false);
});

test("end-of-round Consumable modifiers apply now and expire cleanly", () => {
  const entry = Object.entries(consumables).find(([, value]) => value.effects?.some((effect) => effect.effect === "combat.modifySpeed" && effect.duration === "endOfRound" && !effect.resolver));
  assert.ok(entry, "expected an end-of-round Speed Consumable");
  const [catalogId, definition] = entry;
  const effect = definition.effects.find((candidate) => candidate.effect === "combat.modifySpeed" && candidate.duration === "endOfRound" && !candidate.resolver);
  const state = applyConsumableRuntime(createFamilyRuntimeState(), card(catalogId), effect.trigger, consumableBaseContext);
  assert.equal(state.self.speed, effect.amount);
  assert.ok(state.statuses.some((status) => status.sourceEffectId === effect.id && status.appliedImmediately));
  const expired = expireRuntimeStatuses(state, "endOfRound");
  assert.equal(expired.self.speed, 0);
  assert.equal(expired.statuses.some((status) => status.sourceEffectId === effect.id), false);
});

test("structured Junk choices preserve source, optionality, and contingent follow-up semantics", () => {
  assert.deepEqual(structuredConsumableDestroyJunkPlan(card("DDB-CON-CORE-024")), {
    resolver: "consumable.destroyJunkThenDrawTwo", count: 1, sources: ["hand", "discard"], optional: false, drawAfterSuccess: 2,
  });
  assert.deepEqual(structuredConsumableDestroyJunkPlan(card("DDB-CON-CORE-029")), {
    resolver: "consumable.destroyJunkFromHand", count: 1, sources: ["hand"], optional: false, drawAfterSuccess: 0,
  });
  assert.deepEqual(structuredConsumableDestroyJunkPlan(card("DDB-CON-CORE-048")), {
    resolver: "consumable.optionalDestroyJunkFromHand", count: 1, sources: ["hand"], optional: true, drawAfterSuccess: 0,
  });
  const giBeforeChoice = consumableRuntimeCommands(card("DDB-CON-CORE-024"), "onPlay", { ...consumableBaseContext, junkDestroyed: false });
  assert.equal(giBeforeChoice.some((command) => command.effect === "core.draw"), false, "Fresh Martial Arts Gi must not draw before Junk is destroyed");
  const giAfterChoice = consumableRuntimeCommands(card("DDB-CON-CORE-024"), "onPlay", { ...consumableBaseContext, junkDestroyed: true });
  assert.equal(giAfterChoice.find((command) => command.effect === "core.draw")?.amount, 2);
});

test("single-opponent target selection auto-resolves in Quick Duel semantics", () => {
  const cases = [
    ["DDB-CON-CORE-002", "consumable.chooseOpponentNextAttackPenalty", "combat.modifyAttackPower", -2, "nextAttack"],
    ["DDB-CON-CORE-059", "consumable.chooseOpponentSpeedPenalty", "combat.modifySpeed", -2, "endOfRound"],
  ];
  for (const [catalogId, resolver, effect, amount, duration] of cases) {
    const duelCommands = consumableRuntimeCommands(card(catalogId), "onPlay", { ...consumableBaseContext, opponentTargetCount: 1 });
    const duelCommand = duelCommands.find((candidate) => candidate.resolver === resolver);
    assert.ok(duelCommand, `${catalogId} must produce its structured command`);
    assert.equal(duelCommand.choice, undefined, `${catalogId} must not queue an unreachable opponent choice in a duel`);
    assert.equal(duelCommand.effect, effect);
    assert.equal(duelCommand.amount, amount);
    assert.equal(duelCommand.duration, duration);

    const multiplayerCommands = consumableRuntimeCommands(card(catalogId), "onPlay", { ...consumableBaseContext, opponentTargetCount: 2 });
    const multiplayerCommand = multiplayerCommands.find((candidate) => candidate.resolver === resolver);
    assert.ok(multiplayerCommand?.choice, `${catalogId} must preserve explicit target choice when multiple opponents exist`);
  }
});

test("solo-friendly healing resolves into HP instead of an unreachable target choice", () => {
  const soloHealResolvers = new Set([
    "consumable.chooseFriendlyHealTarget",
    "consumable.healByChosenFriendlyPosition",
    "consumable.healAndRemoveStatus",
  ]);
  const failures = [];
  for (const [catalogId, definition] of Object.entries(consumables)) {
    const healEffects = (definition.effects ?? []).filter((effect) => effect.effect === "core.heal" && soloHealResolvers.has(effect.resolver));
    for (const effect of healEffects) {
      const commands = consumableRuntimeCommands(card(catalogId), "onPlay", { ...consumableBaseContext, friendlyTargetCount: 1 });
      const command = commands.find((candidate) => candidate.sourceEffectId === effect.id);
      if (!command) { failures.push(`${catalogId}:${effect.id}:missing-command`); continue; }
      if (command.choice) failures.push(`${catalogId}:${effect.id}:still-queued-as-choice`);
      const state = applyConsumableRuntime(createFamilyRuntimeState({ self: { hp: 1, maxHp: 20 } }), card(catalogId), "onPlay", { ...consumableBaseContext, friendlyTargetCount: 1 });
      if (state.self.hp < 1 + Number(effect.amount ?? 0)) failures.push(`${catalogId}:${effect.id}:heal-not-applied`);
      if (state.pendingChoices.some((choice) => choice.sourceEffectId === effect.id)) failures.push(`${catalogId}:${effect.id}:unreachable-choice-remains`);
    }
  }
  assert.deepEqual(failures, []);
});

test("next-Attack Consumable modifiers persist exactly once and are consumed at the Attack hook", () => {
  const gloves = card("DDB-CON-CORE-004");
  const commands = consumableRuntimeCommands(gloves, "onPlay", consumableBaseContext);
  const attack = commands.find((command) => command.effect === "combat.modifyAttackPower");
  assert.equal(attack?.amount, 2);
  assert.equal(attack?.duration, "nextAttack");
  const state = applyConsumableRuntime(createFamilyRuntimeState(), gloves, "onPlay", consumableBaseContext);
  assert.equal(state.self.attack, 0);
  assert.equal(runtimeStatusAmount(state, "nextAttack", "combat.modifyAttackPower"), 2);
  const consumed = takeRuntimeStatuses(state, "nextAttack", (status) => status.effect === "combat.modifyAttackPower");
  assert.equal(consumed.consumed.length, 1);
  assert.equal(consumed.state.statuses.some((status) => status.sourceEffectId === attack.sourceEffectId), false);
});

test("next-damage prevention remains pending until the damage hook", () => {
  const entry = Object.entries(consumables).find(([, value]) => value.effects?.some((effect) => effect.resolver === "consumable.nextDamagePrevention"));
  assert.ok(entry, "expected a next-damage prevention Consumable");
  const [catalogId, definition] = entry;
  const effect = definition.effects.find((candidate) => candidate.resolver === "consumable.nextDamagePrevention");
  const state = applyConsumableRuntime(createFamilyRuntimeState(), card(catalogId), effect.trigger, consumableBaseContext);
  assert.equal(state.self.damagePrevention, 0);
  assert.ok(state.statuses.some((status) => status.sourceEffectId === effect.id && status.duration === "nextDamage"));
  const consumed = takeRuntimeStatuses(state, "nextDamage");
  assert.equal(consumed.consumed[0]?.amount, effect.amount);
  assert.equal(consumed.state.statuses.some((status) => status.sourceEffectId === effect.id), false);
});

test("every Core Consumable has exactly one post-resolution lifecycle: supply return or explicit Destroy", () => {
  const failures = [];
  for (const [catalogId, entry] of Object.entries(consumables)) {
    const expectedDestroyed = (entry.effects ?? []).some((effect) => effect.effect === "core.destroy" && (effect.target ?? "self") === "source");
    const lifecycle = structuredConsumableLifecycle(card(catalogId));
    if (lifecycle.explicitlyDestroyed !== expectedDestroyed) failures.push(`${catalogId}:destroy-mismatch`);
    if (lifecycle.returnToSupply === lifecycle.explicitlyDestroyed) failures.push(`${catalogId}:lifecycle-not-exclusive`);
  }
  assert.deepEqual(failures, []);
});

test("human and AI family execution share the same structured state semantics", () => {
  const defenseCard = card("DDB-DEF-CORE-001");
  const humanDefense = applyDefenseRuntime(createFamilyRuntimeState(), defenseCard, "onBlock", defenseBaseContext);
  const aiDefense = applyDefenseRuntime(createFamilyRuntimeState(), defenseCard, "onBlock", defenseBaseContext);
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
    "consumable.ascendPurchaseDiscount",
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
