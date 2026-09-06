import { readFile, writeFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");

const vocabulary = await readJson("content/effects.json");
const registry = await readJson("content/card-effects/equipment.json");

const ensureTrigger = (effectId, trigger) => {
  const definition = vocabulary.effects?.[effectId];
  if (!definition) throw new Error(`Missing canonical effect ${effectId}`);
  definition.allowedTriggers = [...new Set([...(definition.allowedTriggers ?? []), trigger])];
};

// These are narrow reusable timing expansions required by canonical Equipment text.
ensureTrigger("equipment.ready", "onEquip");
ensureTrigger("core.draw", "onEquip");
ensureTrigger("core.discard", "onEquip");
ensureTrigger("combat.piercing", "onBlock");

const reusableConditions = {
  oncePerRound: "The effect may successfully resolve no more than once during the current round.",
  oncePerGame: "The effect may successfully resolve no more than once during the current game.",
  minimumBelt: "Metadata condition carrying the minimum Belt rank required for the effect to resolve.",
  equippedThisTurn: "The source Equipment entered the equipped area during the controller's current turn.",
  equippedCardIsSource: "The Equipment currently entering play is the source Equipment itself.",
  equippedCardIsOtherPermanentEquipment: "The Equipment currently entering play is a different permanent Equipment controlled by the source's controller.",
  equippedCardSubtypeIn: "Metadata condition listing Equipment subtypes that qualify for the current equip trigger.",
  sourceActivationArmed: "A prior activation of this source created the pending conditional effect being checked.",
  manualActivation: "The effect resolves only after its controller explicitly activates the ready source Equipment at a legal timing window.",
  attackUsesSourceEquipment: "The current Attack is using or receiving the eligible contribution of the source Weapon/Equipment.",
  attackZones: "Metadata condition listing declared Attack zones to which an offensive Equipment effect applies.",
  attackHasTag: "Metadata condition naming a required tag on the current Attack.",
  attackHasAnyTag: "Metadata condition listing tags of which at least one must be present on the current Attack.",
  nextAttackHasTag: "Metadata condition naming a required tag on the next Attack that consumes the pending effect.",
  defenseHasTag: "Metadata condition naming a required tag on the Defense that created the trigger.",
  hasTwoPairedWeapons: "The controller currently has at least two equipped Weapons with the Paired tag.",
  firstHitThisTurn: "The current Hit is the controller's first Hit this turn.",
  firstHitWithSourceThisTurn: "The current Hit is the first Hit this turn made using the source Equipment.",
  firstHitWithSourceThisRound: "The current Hit is the first Hit this round made using the source Equipment.",
  firstQualifyingHitThisTurn: "The current Hit is the first Hit this turn satisfying the effect's other qualifying conditions.",
  firstCombatDamageWithSourceThisTurn: "The current event is the first time this turn the source Equipment contributed to combat damage dealt.",
  combatDamageDealt: "Exact combat damage dealt by the current Attack after prevention and reduction.",
  firstDifferentZoneSequenceThisTurn: "This is the first time this turn the controller has produced the qualifying different-zone Attack sequence.",
  targetXpHigher: "The targeted opposing fighter/player currently has strictly more XP than the controller.",
  selfIsLowestXp: "The controller is currently tied for or solely has the lowest XP among the compared legal players.",
  targetHasTemporaryNegativeStat: "The target currently has at least one temporary negative ATK, DEF, or Speed modifier.",
  firstAttackAfterKataThisTurn: "The current Attack is the controller's first Attack after playing a Kata this turn.",
  firstAttackWithTagThisTurn: "Metadata condition naming a tag for which the current Attack is the first matching Attack this turn.",
  firstDefenseThisRound: "The current Defense is the controller's first Defense this round.",
  attackedThisTurn: "The controller has already made at least one Attack during the current turn.",
  firstIncomingAttackThisRound: "The current incoming Attack is the first Attack targeting this controller during the round.",
  incomingAttackUsesWeapon: "The current incoming Attack qualifies as a Weapon Attack under the canonical Weapon rules.",
  incomingAttackIsUnarmed: "The current incoming Attack qualifies as Unarmed under the canonical rules.",
  incomingAttackTargetsSelf: "The current incoming Attack legally targets the source Equipment's controller.",
  sameOpponentAsBlockedAttack: "The pending effect applies only against the opponent whose Attack created the Block trigger.",
  didNotAttackPreviousTurn: "The controller made no Attack during their immediately previous turn.",
  hasNotAttackedThisTurn: "The controller has not yet made an Attack during the current turn.",
  sceneChangeOccurred: "A Scene Change has just resolved at the relevant trigger window.",
  nextPurchaseOnly: "The cost modifier is consumed by the next qualifying purchase and does not modify later purchases.",
  nextItemOnly: "The pending modifier is consumed by the next qualifying Item and does not affect later Items.",
  marketEndSlot: "The chosen Market card occupies either end slot of the current Market row.",
  minimumFinalCost: "Metadata condition carrying the minimum final Focus cost after the modifier is applied.",
  scheduledTiming: "Metadata condition naming a delayed expiration or resolution timing handled by the dedicated resolver.",
  resolvedCardType: "Metadata condition naming the card type whose completed resolution created the trigger.",
  examRequirementCompleted: "A legal requirement of the controller's active Belt Exam was just completed.",
  ascendCompleted: "The controller's Ascend phase has just completed.",
  boughtCardThisAscend: "The controller bought at least one card during the current Ascend phase.",
  purchaseCompleted: "A legal Market purchase has just completed.",
  purchasedCardCost: "Printed Focus cost of the card involved in the current purchase event.",
  pendingFromSource: "A prior effect from this source scheduled the current Initiate reward.",
  forcedDiscardEvent: "An opponent-controlled effect is currently forcing the controller to discard one or more cards.",
  defenseOutsideTurn: "The current Defense is being played outside the controller's own turn.",
  armedEquipmentZoneMatched: "The current Attack uses the zone previously chosen by this source Equipment's armed effect.",
  discardedPrintedFocusValue: "Printed Focus Value of the card paid/discarded for the current Equipment effect.",
  costPaid: "The optional cost required by the effect was successfully paid.",
  xpFromLegalAttackOrDefense: "The XP gain that created the trigger came from a legal Attack or Defense resolution.",
  focusGeneratedBySingleCard: "Amount of Focus generated by the single card that created the trigger.",
  firstNegativeCombatModifierThisRound: "The current negative Attack Power or Guard modifier is the first qualifying one affecting the controller this round.",
  sourceArmorHelpedBlock: "The source Armor/Defense Equipment contributed Defense to an Attack that was Blocked.",
  firstArmorBlockThisRound: "The current Block is the first qualifying Block this round in which the source Armor contributed.",
  sourceAffectedCountThreshold: "Metadata condition carrying the number of qualifying affected events after which the source is destroyed or otherwise changes state.",
  firstDamageThisRound: "The current damage event is the first damage the controller has taken this round.",
  firstCombatDamageThisRound: "The current event is the first combat-damage event the controller has taken this round.",
  incomingDamageAtLeast: "Metadata threshold for the unreduced incoming damage amount relevant to the effect.",
  sourceExhausted: "The source Equipment is currently exhausted.",
  targetHpAtMost: "Metadata threshold requiring the affected fighter's current HP to be at or below the stated value.",
  firstSwapThisGame: "The current Equipment swap is the first swap of this source during the game.",
  discardedByEffect: "The source card is being discarded by a card/effect rather than normal Hide cleanup.",
  firstDamagingAttackThisRound: "The current incoming Attack is the first Attack this round that deals positive damage to the controller.",
  damageSourceIsWeapon: "The current damage event was caused by a Weapon Attack/effect as defined by the canonical rules.",
  minimumDraw: "Metadata floor for the number of cards drawn during the affected Hide draw.",
  currentAttackIsNormal: "The current Attack is a normal Attack rather than a Reversal or other special Attack timing.",
  nextAttackDifferentZone: "The next Attack consuming the pending effect must use a different zone from the Attack that created it.",
  nextQualifyingAttackOnly: "The pending effect is consumed by the next Attack satisfying its other source/qualifier conditions.",
  reactionPlayedAgainstSelf: "A Reaction was just played against the source Equipment's controller.",
  sameTurnOnly: "The pending effect expires at the end of the current turn if it has not been consumed.",
  sameRoundOnly: "The pending effect expires at the end of the current round if it has not been consumed."
};
for (const [id, description] of Object.entries(reusableConditions)) {
  vocabulary.conditions[id] ??= description;
}

const effectsById = new Map();
for (const [catalogId, card] of Object.entries(registry.cards ?? {})) {
  for (const effect of card.effects ?? []) {
    if (!effect.id) throw new Error(`${catalogId} has an Equipment effect without an id`);
    if (effectsById.has(effect.id)) throw new Error(`Duplicate Equipment effect id ${effect.id}`);
    effectsById.set(effect.id, { catalogId, effect });
  }
}
const get = (id) => {
  const found = effectsById.get(id);
  if (!found) throw new Error(`Missing Equipment effect ${id}`);
  return found.effect;
};
const add = (id, kind, value = true, operator = "eq") => {
  const effect = get(id);
  effect.conditions ??= [];
  if (effect.conditions.some((condition) => condition.kind === kind)) return;
  const condition = { kind, value };
  if (operator != null) condition.operator = operator;
  effect.conditions.push(condition);
};
const set = (id, patch) => {
  const effect = get(id);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete effect[key];
    else effect[key] = value;
  }
};
const replaceCondition = (id, oldKind, newKind) => {
  for (const condition of get(id).conditions ?? []) {
    if (condition.kind === oldKind) condition.kind = newKind;
  }
};

for (const id of ["equipment-wpn-002-after-defense-next-attack", "equipment-wpn-027-after-defense-next-attack", "equipment-wpn-031-after-defense-next-attack"]) {
  add(id, "defenderPlayedDefense", true);
  add(id, "sameTurnOnly", true);
}
for (const id of ["equipment-wpn-004-blocked-attack-focus", "equipment-wpn-011-blocked-attack-focus"]) add(id, "oncePerTurn", true);
add("equipment-wpn-005-punch-hit-next-punch", "attackHasTag", "Punch", null);
add("equipment-wpn-005-punch-hit-next-punch", "nextAttackHasTag", "Punch", null);
add("equipment-wpn-005-punch-hit-next-punch", "oncePerTurn", true);
set("equipment-wpn-006-delayed-direct-damage", { effect: "core.custom", amount: 1, duration: null });
add("equipment-wpn-006-delayed-direct-damage", "firstHitWithSourceThisRound", true);
add("equipment-wpn-006-delayed-direct-damage", "attackUsesSourceEquipment", true);
add("equipment-wpn-006-delayed-direct-damage", "scheduledTiming", "endOfTargetNextTurn", null);
for (const id of ["equipment-wpn-007-punch-kick-hit-draw", "equipment-wpn-007-punch-kick-hit-discard"]) {
  add(id, "attackHasAnyTag", ["Punch", "Kick"], null);
  add(id, "firstQualifyingHitThisTurn", true);
}
add("equipment-wpn-008-equipped-this-turn-first-attack", "equippedThisTurn", true);
replaceCondition("equipment-wpn-009-high-piercing", "incomingZones", "attackZones");
add("equipment-wpn-009-high-piercing", "attackUsesSourceEquipment", true);
add("equipment-wpn-010-armor-piercing", "attackUsesSourceEquipment", true);
for (const id of ["equipment-wpn-013-block-next-attack", "equipment-wpn-016-block-next-attacker", "equipment-wpn-050-parry-block-next-attack", "equipment-wpn-053-block-next-attacker", "equipment-wpn-062-block-next-attack"]) add(id, "sameRoundOnly", true);
set("equipment-wpn-014-low-hit-speed-penalty", { effect: "core.custom", amount: -1, duration: null });
add("equipment-wpn-014-low-hit-speed-penalty", "attackZones", ["Low"], null);
add("equipment-wpn-014-low-hit-speed-penalty", "attackUsesSourceEquipment", true);
add("equipment-wpn-014-low-hit-speed-penalty", "scheduledTiming", "nextRound", null);
add("equipment-wpn-015-first-hit-additional-damage", "firstHitThisTurn", true);
add("equipment-wpn-016-block-next-attacker", "oncePerRound", true);
add("equipment-wpn-016-block-next-attacker", "sameOpponentAsBlockedAttack", true);
replaceCondition("equipment-wpn-017-first-low-attack", "incomingZones", "attackZones");
add("equipment-wpn-019-paired-second-attack-flow", "hasTwoPairedWeapons", true);
add("equipment-wpn-020-exact-one-damage-focus", "combatDamageDealt", 1);
add("equipment-wpn-020-exact-one-damage-focus", "oncePerTurn", true);
add("equipment-wpn-021-two-zone-sequence-focus", "firstDifferentZoneSequenceThisTurn", true);
for (const id of ["equipment-wpn-022-post-block-purchase-discount", "equipment-deq-011-block-purchase-discount", "equipment-deq-044-weapon-block-purchase-discount"]) {
  add(id, "nextPurchaseOnly", true);
  add(id, "minimumFinalCost", 1);
}
add("equipment-wpn-022-post-block-purchase-discount", "oncePerRound", true);
add("equipment-wpn-023-equip-next-attack", "equippedThisTurn", true);
add("equipment-wpn-023-equip-next-attack", "sameTurnOnly", true);
for (const id of ["equipment-wpn-024-scene-change-ready", "equipment-wpn-024-scene-change-next-any-zone"]) add(id, "sceneChangeOccurred", true);
add("equipment-wpn-024-scene-change-next-any-zone", "sameRoundOnly", true);
add("equipment-wpn-025-hit-focus", "firstHitWithSourceThisTurn", true);
add("equipment-wpn-025-hit-focus", "attackUsesSourceEquipment", true);
add("equipment-wpn-026-declared-attack-zone-change", "oncePerTurn", true);
add("equipment-wpn-028-lower-xp-first-attack", "targetXpHigher", true);
add("equipment-wpn-029-matching-armor-defense-suppression", "targetHasMatchingArmor", true);
add("equipment-wpn-029-matching-armor-defense-suppression", "attackUsesSourceEquipment", true);
add("equipment-wpn-030-chosen-armor-gear-defense-suppression", "attackUsesSourceEquipment", true);
add("equipment-wpn-030-chosen-armor-gear-defense-suppression", "choiceKind", "matching-armor-or-gear", null);
get("equipment-wpn-032-first-after-kata").conditions = (get("equipment-wpn-032-first-after-kata").conditions ?? []).filter((condition) => condition.kind !== "playedKataThisTurn");
add("equipment-wpn-032-first-after-kata", "firstAttackAfterKataThisTurn", true);
add("equipment-wpn-033-paired-first-defense", "hasTwoPairedWeapons", true);
add("equipment-wpn-033-paired-first-defense", "firstDefenseThisRound", true);
add("equipment-wpn-036-negative-stat-target-power", "targetHasTemporaryNegativeStat", true);
add("equipment-wpn-036-negative-stat-target-power", "attackUsesSourceEquipment", true);
set("equipment-wpn-038-healing-suppression", { amount: 2 });
add("equipment-wpn-038-healing-suppression", "attackUsesSourceEquipment", true);
add("equipment-wpn-038-healing-suppression", "scheduledTiming", "beforeControllerNextTurn", null);
add("equipment-wpn-039-mid-hit-next-defense-penalty", "attackZones", ["Mid"], null);
add("equipment-wpn-039-mid-hit-next-defense-penalty", "attackUsesSourceEquipment", true);
add("equipment-wpn-039-mid-hit-next-defense-penalty", "sameTurnOnly", true);
for (const id of ["equipment-wpn-040-no-defense-cycle-draw", "equipment-wpn-040-no-defense-cycle-discard"]) add(id, "oncePerTurn", true);
for (const id of ["equipment-wpn-042-patience-defense", "equipment-wpn-042-patience-attack"]) {
  add(id, "didNotAttackPreviousTurn", true);
  add(id, "hasNotAttackedThisTurn", true);
}
add("equipment-wpn-043-first-defense-after-attack", "firstDefenseThisRound", true);
add("equipment-wpn-043-first-defense-after-attack", "attackedThisTurn", true);
replaceCondition("equipment-wpn-044-first-low-mid-piercing", "incomingZones", "attackZones");
add("equipment-wpn-044-first-low-mid-piercing", "attackUsesSourceEquipment", true);
add("equipment-wpn-045-first-hit-next-flow", "firstHitThisTurn", true);
for (const id of ["equipment-wpn-046-exhaust", "equipment-wpn-046-orange-second-normal-power"]) {
  add(id, "minimumBelt", "Orange", null);
  add(id, "attackNumber", 2);
  add(id, "currentAttackIsNormal", true);
  add(id, "manualActivation", true);
}
get("equipment-wpn-047-first-hand-attack").conditions = (get("equipment-wpn-047-first-hand-attack").conditions ?? []).filter((condition) => condition.kind !== "firstAttackThisTurn");
add("equipment-wpn-047-first-hand-attack", "firstAttackWithTagThisTurn", "Hand", null);
add("equipment-wpn-048-combat-damage-focus", "firstCombatDamageWithSourceThisTurn", true);
add("equipment-wpn-048-combat-damage-focus", "attackUsesSourceEquipment", true);
add("equipment-wpn-050-parry-block-next-attack", "defenseHasTag", "Parry", null);
set("equipment-wpn-051-reaction-defense", { effect: "core.custom", amount: 1, duration: null });
add("equipment-wpn-051-reaction-defense", "oncePerRound", true);
add("equipment-wpn-051-reaction-defense", "reactionPlayedAgainstSelf", true);
add("equipment-wpn-051-reaction-defense", "scheduledTiming", "exchangeEnd", null);
set("equipment-wpn-052-hit-speed-penalty", { effect: "core.custom", amount: -1, duration: null });
add("equipment-wpn-052-hit-speed-penalty", "attackUsesSourceEquipment", true);
add("equipment-wpn-052-hit-speed-penalty", "scheduledTiming", "nextRound", null);
add("equipment-wpn-053-block-next-attacker", "sameOpponentAsBlockedAttack", true);
for (const id of ["equipment-wpn-055-dodge-block-next-attack", "equipment-wpn-055-dodge-block-cycle"]) add(id, "defenseHasTag", "Dodge", null);
add("equipment-wpn-056-blocked-next-different-zone", "nextAttackDifferentZone", true);
add("equipment-wpn-056-blocked-next-different-zone", "sameTurnOnly", true);
add("equipment-wpn-058-hit-defense-until-next-initiate", "firstHitWithSourceThisRound", true);
add("equipment-wpn-058-hit-defense-until-next-initiate", "attackUsesSourceEquipment", true);
add("equipment-wpn-058-hit-defense-until-next-initiate", "scheduledTiming", "nextInitiate", null);
add("equipment-wpn-059-blocked-round-next-attack", "attackUsesSourceEquipment", true);
add("equipment-wpn-059-blocked-round-next-attack", "nextQualifyingAttackOnly", true);
add("equipment-wpn-061-punch-counts-unarmed", "attackHasTag", "Punch", null);
add("equipment-wpn-064-hit-spend-target-tempo", "attackUsesSourceEquipment", true);
add("equipment-wpn-065-second-attack-hit-focus", "attackUsesSourceEquipment", true);

for (const id of ["equipment-gea-001-exhaust", "equipment-gea-001-after-kata-focus"]) {
  set(id, { trigger: "afterResolve" });
  add(id, "resolvedCardType", "Kata", null);
  add(id, "oncePerRound", true);
}
for (const id of ["equipment-gea-002-exhaust", "equipment-gea-002-exam-speed", "equipment-gea-002-orange-exam-complete-focus"]) {
  add(id, "examRequirementCompleted", true);
  add(id, "oncePerRound", true);
}
add("equipment-gea-002-orange-exam-complete-focus", "minimumBelt", "Orange", null);
add("equipment-gea-002-orange-exam-complete-focus", "choiceKind", "complete-task-instead", null);
for (const id of ["equipment-gea-003-exhaust", "equipment-gea-003-blue-equip-cycle-draw", "equipment-gea-003-blue-equip-cycle-discard"]) {
  set(id, { trigger: "onEquip" });
  add(id, "minimumBelt", "Blue", null);
  add(id, "equippedCardIsOtherPermanentEquipment", true);
}
add("equipment-gea-003-on-equip-ready-other", "equippedCardIsSource", true);
for (const id of ["equipment-gea-004-exhaust", "equipment-gea-004-incoming-zone-choice", "equipment-gea-004-chosen-zone-attack-penalty"]) {
  add(id, "incomingAttackTargetsSelf", true);
  add(id, "manualActivation", true);
}
for (const id of ["equipment-gea-006-exhaust", "equipment-gea-006-activation-speed", "equipment-gea-006-tempo-cycle-draw", "equipment-gea-006-tempo-cycle-discard"]) add(id, "manualActivation", true);
for (const id of ["equipment-gea-007-exhaust", "equipment-gea-007-activation-discard", "equipment-gea-007-activation-focus", "equipment-gea-007-zero-focus-upgrade"]) add(id, "manualActivation", true);
add("equipment-gea-007-zero-focus-upgrade", "discardedPrintedFocusValue", 0);
for (const id of ["equipment-gea-008-exhaust", "equipment-gea-008-reduce-forced-discard"]) {
  add(id, "oncePerRound", true);
  add(id, "forcedDiscardEvent", true);
}
for (const id of ["equipment-gea-009-exhaust", "equipment-gea-009-outside-turn-defense-guard"]) add(id, "defenseOutsideTurn", true);
add("equipment-gea-009-green-block-reversal", "minimumBelt", "Green", null);
add("equipment-gea-009-green-block-reversal", "sameRoundOnly", true);
for (const id of ["equipment-gea-010-exhaust", "equipment-gea-010-attack-zone-choice", "equipment-gea-010-chosen-zone-piercing"]) add(id, "manualActivation", true);
add("equipment-gea-010-chosen-zone-blocked-focus", "armedEquipmentZoneMatched", true);
add("equipment-gea-011-exhaust", "ascendCompleted", true);
add("equipment-gea-011-exhaust", "boughtCardThisAscend", false);
add("equipment-gea-011-next-initiate-focus", "pendingFromSource", true);
for (const id of ["equipment-gea-012-exhaust", "equipment-gea-012-end-market-discount"]) {
  add(id, "marketEndSlot", true);
  add(id, "nextPurchaseOnly", true);
  add(id, "minimumFinalCost", 2);
}
for (const id of ["equipment-gea-013-exhaust", "equipment-gea-013-next-item-discount"]) {
  add(id, "manualActivation", true);
  add(id, "nextItemOnly", true);
  add(id, "minimumFinalCost", 1);
}
add("equipment-gea-013-qualifying-item-ready-other", "equippedCardIsOtherPermanentEquipment", true);
add("equipment-gea-013-qualifying-item-ready-other", "equippedCardSubtypeIn", ["Gear", "Defense Equipment"], null);
add("equipment-gea-013-qualifying-item-ready-other", "sourceActivationArmed", true);
for (const id of ["equipment-gea-014-exhaust", "equipment-gea-014-ignore-first-negative-combat-modifier"]) add(id, "resolvedCardType", "Kata", null);
add("equipment-gea-014-ignore-first-negative-combat-modifier", "firstNegativeCombatModifierThisRound", true);
for (const id of ["equipment-gea-015-exhaust", "equipment-gea-015-bonus-xp", "equipment-gea-015-xp-next-attack-penalty"]) {
  add(id, "oncePerRound", true);
  add(id, "xpFromLegalAttackOrDefense", true);
}
for (const id of ["equipment-gea-016-exhaust", "equipment-gea-016-focus-generation-reward"]) add(id, "focusGeneratedBySingleCard", 2, "gte");
for (const id of ["equipment-gea-017-exhaust", "equipment-gea-017-exam-cycle-draw", "equipment-gea-017-exam-cycle-discard"]) add(id, "examRequirementCompleted", true);
for (const id of ["equipment-gea-018-exhaust", "equipment-gea-018-bottom-hand-card"]) add(id, "purchaseCompleted", true);
add("equipment-gea-018-next-initiate-draw", "pendingFromSource", true);
add("equipment-gea-019-exhaust", "purchasedCardCost", 4, "gte");
add("equipment-gea-019-next-initiate-focus", "pendingFromSource", true);
for (const id of ["equipment-gea-020-exhaust", "equipment-gea-020-reversal-piercing"]) {
  add(id, "oncePerRound", true);
  add(id, "defenderPlayedDefense", true);
  add(id, "sameOpponentAsBlockedAttack", true);
}
for (const id of ["equipment-gea-021-exhaust", "equipment-gea-021-scene-change-focus"]) {
  add(id, "sceneChangeOccurred", true);
  add(id, "nonHonorSceneChangedThisRound", true);
}
for (const id of ["equipment-gea-022-exhaust", "equipment-gea-022-first-hit-discard", "equipment-gea-022-first-hit-focus"]) add(id, "firstHitThisTurn", true);
add("equipment-gea-022-first-hit-focus", "costPaid", true);
add("equipment-gea-023-next-initiate-focus", "pendingFromSource", true);
for (const id of ["equipment-gea-024-exhaust", "equipment-gea-024-attack-zone-choice"]) add(id, "manualActivation", true);
add("equipment-gea-024-different-zone-power", "armedEquipmentZoneMatched", true);
add("equipment-gea-024-yellow-exam-draw", "minimumBelt", "Yellow", null);

add("equipment-deq-002-consumable-round-defense", "consumableUsedThisRound", true);
for (const id of ["equipment-deq-003-first-damage-reduction", "equipment-deq-003-exhaust"]) add(id, "firstDamageThisRound", true);
add("equipment-deq-003-next-initiate-ready", "sourceExhausted", true);
add("equipment-deq-004-first-weapon-extra-defense", "firstIncomingAttackThisRound", true);
add("equipment-deq-004-first-weapon-extra-defense", "incomingAttackUsesWeapon", true);
add("equipment-deq-005-armor-block-focus", "firstArmorBlockThisRound", true);
add("equipment-deq-005-armor-block-focus", "sourceArmorHelpedBlock", true);
add("equipment-deq-006-destroy-after-two-preventions", "sourceAffectedCountThreshold", 2);
add("equipment-deq-007-once-game-zero-attack", "oncePerGame", true);
add("equipment-deq-007-once-game-zero-attack", "incomingAttackTargetsSelf", true);
add("equipment-deq-009-weapon-extra-defense", "incomingAttackUsesWeapon", true);
add("equipment-deq-012-low-hp-untargetable", "oncePerGame", true);
add("equipment-deq-012-low-hp-untargetable", "targetHpAtMost", 5);
add("equipment-deq-012-low-hp-untargetable", "scheduledTiming", "startNextTurnOrUntilAttack", null);
add("equipment-deq-013-once-round-attack-reduction", "oncePerRound", true);
for (const id of ["equipment-deq-014-combat-damage-reduction", "equipment-deq-014-exhaust"]) add(id, "firstCombatDamageThisRound", true);
add("equipment-deq-014-green-hide-ready", "minimumBelt", "Green", null);
add("equipment-deq-014-green-hide-ready", "incomingDamageAtLeast", 3);
add("equipment-deq-014-green-hide-ready", "sourceExhausted", true);
add("equipment-deq-015-low-block-speed", "incomingZones", ["Low"], null);
add("equipment-deq-018-hide-draw-penalty", "minimumDraw", 1);
replaceCondition("equipment-deq-019-low-attack-penalty", "incomingZones", "attackZones");
for (const id of ["equipment-deq-020-exhaust", "equipment-deq-020-blue-high-block-draw", "equipment-deq-020-blue-high-block-discard"]) {
  add(id, "minimumBelt", "Blue", null);
  add(id, "incomingZones", ["High"], null);
}
add("equipment-deq-024-weapon-high-mid-defense", "incomingAttackUsesWeapon", true);
add("equipment-deq-025-first-swap-discard", "firstSwapThisGame", true);
add("equipment-deq-026-weapon-damage-reduction", "oncePerRound", true);
add("equipment-deq-026-weapon-damage-reduction", "damageSourceIsWeapon", true);
add("equipment-deq-027-discard-return-hand", "oncePerGame", true);
add("equipment-deq-027-discard-return-hand", "discardedByEffect", true);
add("equipment-deq-028-first-high-damage-reduction", "firstDamagingAttackThisRound", true);
add("equipment-deq-028-first-high-damage-reduction", "incomingZones", ["High"], null);
add("equipment-deq-029-first-incoming-attack-penalty", "firstIncomingAttackThisRound", true);
add("equipment-deq-029-destroy-after-three-affected", "sourceAffectedCountThreshold", 3);
add("equipment-deq-030-first-target-discard-or-retarget", "firstIncomingAttackThisRound", true);
add("equipment-deq-030-first-target-discard-or-retarget", "choiceKind", "discard-or-retarget", null);
add("equipment-deq-032-lowest-xp-extra-defense", "selfIsLowestXp", true);
add("equipment-deq-034-block-attacker-focus-loss", "sourceArmorHelpedBlock", true);
add("equipment-deq-035-first-incoming-attack-penalty", "firstIncomingAttackThisRound", true);
add("equipment-deq-036-no-tempo-extra-defense", "hasTempo", false);
add("equipment-deq-037-first-incoming-attack-penalty", "firstIncomingAttackThisRound", true);
add("equipment-deq-037-first-incoming-attack-penalty", "oncePerRound", true);
add("equipment-deq-040-once-game-prevent-all-damage", "oncePerGame", true);
add("equipment-deq-041-first-unarmed-mid-damage-reduction", "firstIncomingAttackThisRound", true);
add("equipment-deq-041-first-unarmed-mid-damage-reduction", "incomingAttackIsUnarmed", true);
add("equipment-deq-042-armor-block-mark-exam", "firstArmorBlockThisRound", true);
add("equipment-deq-042-armor-block-mark-exam", "sourceArmorHelpedBlock", true);
add("equipment-deq-044-weapon-block-purchase-discount", "incomingAttackUsesWeapon", true);
for (const id of ["equipment-deq-045-exhaust", "equipment-deq-045-block-reveal-attacker-top"]) add(id, "oncePerRound", true);
add("equipment-deq-046-once-game-ignore-speed-penalty", "oncePerGame", true);

for (const { effect } of effectsById.values()) {
  if (!effect.conditions) continue;
  const seen = new Set();
  effect.conditions = effect.conditions.filter((condition) => {
    const key = JSON.stringify([condition.kind, condition.operator ?? null, condition.value ?? null]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

await writeJson("content/effects.json", vocabulary);
await writeJson("content/card-effects/equipment.json", registry);
console.log(`Reconciled ${Object.keys(registry.cards).length} Equipment cards / ${effectsById.size} structured effects.`);
