import { readFileSync, writeFileSync } from "node:fs";

function read(path) { return readFileSync(path, "utf8"); }
function write(path, content) { writeFileSync(path, content); }
function replaceOnce(text, from, to, label) {
  const index = text.indexOf(from);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (text.indexOf(from, index + from.length) >= 0) throw new Error(`Patch anchor is not unique: ${label}`);
  return text.slice(0, index) + to + text.slice(index + from.length);
}
function replaceRegex(text, pattern, to, label) {
  const matches = [...text.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"))];
  if (matches.length !== 1) throw new Error(`Expected one regex patch anchor for ${label}, found ${matches.length}`);
  return text.replace(pattern, to);
}

const registryPath = "content/card-effects.json";
const registry = JSON.parse(read(registryPath));
const cards = registry.cards;
const additions = {
  "DDB-ATK-CORE-001": { name: "Aftermarket Uppercut", effects: [{ id: "attack-aftermarket-last-ascend-zone", trigger: "onAttackDeclared", action: "chooseZone", target: "source", conditions: [{ kind: "boughtCardLastAscend", operator: "eq", value: true }, { kind: "alternateZone", value: "Mid" }], resolver: "attack.final.alternateZone" }] },
  "DDB-ATK-CORE-003": { name: "Ankle Invoice", effects: [{ id: "attack-ankle-invoice-suppress-equipment", trigger: "onHit", action: "modifyGuard", target: "chosen-equipment", amount: -2, duration: "endOfTurn", resolver: "attack.final.equipmentSuppression" }] },
  "DDB-ATK-CORE-008": { name: "Budget-Cut Backfist", effects: [{ id: "attack-budget-cut-focus-refund", trigger: "afterResolve", action: "gainFocus", target: "self", amount: 1, duration: "immediate", conditions: [{ kind: "focusSpentEarlierThisTurn", operator: "eq", value: true }], resolver: "attack.final.focus" }] },
  "DDB-ATK-CORE-010": { name: "Certified Palm Stamp", effects: [{ id: "attack-certified-palm-exam-power", trigger: "onAttackDeclared", action: "modifyAttackPower", target: "source", amount: 2, duration: "immediate", conditions: [{ kind: "completedBeltExamThisRound", operator: "eq", value: true }], resolver: "attack.final.power" }, { id: "attack-certified-palm-first-normal-hit-focus", trigger: "onHit", action: "gainFocus", target: "self", amount: 1, duration: "immediate", conditions: [{ kind: "firstNormalAttackThisTurn", operator: "eq", value: true }], resolver: "attack.final.focus" }] },
  "DDB-ATK-CORE-012": { name: "Courtesy-Notice Knee", effects: [{ id: "attack-courtesy-notice-choice", trigger: "onHit", action: "custom", target: "opponent", conditions: [{ kind: "choiceKind", value: "courtesy-notice" }, { kind: "itemCostPenalty", value: 1 }, { kind: "defenseGuardPenalty", value: 1 }], resolver: "attack.final.hitChoice" }] },
  "DDB-ATK-CORE-013": { name: "Defensive Front Kick", effects: [{ id: "attack-defensive-front-kick-reaction", trigger: "passive", action: "custom", target: "source", amount: 1, conditions: [{ kind: "incomingZones", value: ["Mid", "Low"] }], resolver: "attack.final.defensiveReaction" }] },
  "DDB-ATK-CORE-015": { name: "Discount Dim Mak", effects: [{ id: "attack-discount-dim-mak-choice", trigger: "onHit", action: "custom", target: "opponent", conditions: [{ kind: "choiceKind", value: "discount-dim-mak" }, { kind: "focusGain", value: 1 }], resolver: "attack.final.hitChoice" }] },
  "DDB-ATK-CORE-016": { name: "Double Punch", effects: [{ id: "attack-double-punch-combo-steps", trigger: "passive", action: "custom", target: "source", amount: 2, resolver: "attack.final.comboMultiplicity" }] },
  "DDB-ATK-CORE-020": { name: "Fire-Drill Feint", effects: [{ id: "attack-fire-drill-zone", trigger: "onAttackDeclared", action: "chooseZone", target: "source", resolver: "attack.chooseAnyZone" }, { id: "attack-fire-drill-feint", trigger: "onDefenseDeclared", action: "custom", target: "source", conditions: [{ kind: "discardCost", value: 1 }], resolver: "attack.final.fireDrillFeint" }] },
  "DDB-ATK-CORE-021": { name: "Fire-Exit Flying Elbow", effects: [{ id: "attack-fire-exit-cycle-draw", trigger: "afterResolve", action: "draw", target: "self", amount: 1, duration: "immediate", conditions: [{ kind: "nonHonorSceneChangedThisRound", operator: "eq", value: true }], resolver: "attack.final.cycle" }, { id: "attack-fire-exit-cycle-discard", trigger: "afterResolve", action: "discard", target: "self", amount: 1, duration: "immediate", conditions: [{ kind: "nonHonorSceneChangedThisRound", operator: "eq", value: true }], resolver: "attack.final.cycle" }] },
  "DDB-ATK-CORE-034": { name: "Knifehand Strike", effects: [{ id: "attack-knifehand-suppress-equipment", trigger: "onHit", action: "modifyGuard", target: "chosen-equipment", amount: -1, duration: "endOfTurn", resolver: "attack.final.equipmentSuppression" }] },
  "DDB-ATK-CORE-040": { name: "Overtime Open-Palm", effects: [{ id: "attack-overtime-focus-power", trigger: "onAttackDeclared", action: "modifyAttackPower", target: "source", amount: 1, duration: "immediate", conditions: [{ kind: "focusGeneratedThisTurn", operator: "gte", value: 5 }], resolver: "attack.final.power" }] },
  "DDB-ATK-CORE-044": { name: "Question Mark Kick", effects: [{ id: "attack-question-mark-zone", trigger: "onAttackDeclared", action: "chooseZone", target: "source", resolver: "attack.chooseAnyZone" }] },
  "DDB-ATK-CORE-052": { name: "Side Kick", effects: [{ id: "attack-side-kick-only-power", trigger: "onAttackDeclared", action: "modifyAttackPower", target: "source", amount: 2, duration: "immediate", conditions: [{ kind: "firstAttackThisTurn", operator: "eq", value: true }], resolver: "attack.final.power" }, { id: "attack-side-kick-only-lock", trigger: "onAttackDeclared", action: "custom", target: "self", conditions: [{ kind: "firstAttackThisTurn", operator: "eq", value: true }], resolver: "attack.final.onlyAttackLock" }] },
  "DDB-ATK-CORE-059": { name: "Switching Axe Kick", effects: [{ id: "attack-switching-axe-discard-cost", trigger: "onAttackDeclared", action: "modifyAttackPower", target: "source", amount: 2, duration: "immediate", conditions: [{ kind: "discardCost", value: 1 }], resolver: "attack.final.optionalAttackCost" }] },
  "DDB-ATK-CORE-062": { name: "Three-Gate Tour", effects: [{ id: "attack-three-gate-cycle-draw", trigger: "afterResolve", action: "draw", target: "self", amount: 1, duration: "immediate", conditions: [{ kind: "yellowBeltExamThirdZone", operator: "eq", value: true }], resolver: "attack.final.cycle" }, { id: "attack-three-gate-cycle-discard", trigger: "afterResolve", action: "discard", target: "self", amount: 1, duration: "immediate", conditions: [{ kind: "yellowBeltExamThirdZone", operator: "eq", value: true }], resolver: "attack.final.cycle" }] },
  "DDB-ATK-CORE-063": { name: "Three-Stamp Roundhouse", effects: [{ id: "attack-three-stamp-exam-focus", trigger: "afterResolve", action: "gainFocus", target: "self", amount: 1, duration: "immediate", conditions: [{ kind: "completesActiveBeltExam", operator: "eq", value: true }], resolver: "attack.final.focus" }] },
  "DDB-ATK-CORE-064": { name: "Tornado Crescent Kick", effects: [{ id: "attack-tornado-crescent-choice", trigger: "onHit", action: "custom", target: "self", conditions: [{ kind: "choiceKind", value: "tornado-crescent" }, { kind: "focusGain", value: 1 }, { kind: "draw", value: 1 }, { kind: "discard", value: 1 }], resolver: "attack.final.hitChoice" }] }
};
for (const [id, entry] of Object.entries(additions)) {
  if (cards[id]) throw new Error(`${id} already migrated`);
  cards[id] = entry;
}
registry.cards = Object.fromEntries(Object.entries(cards).sort(([a], [b]) => a.localeCompare(b)));
write(registryPath, JSON.stringify(registry, null, 2) + "\n");

let cardEffects = read("app/card-effects.ts");
cardEffects = replaceOnce(cardEffects,
  '  "attack.nextAttackArmorPenalty",\n]);',
  '  "attack.nextAttackArmorPenalty",\n  "attack.final.alternateZone",\n  "attack.final.equipmentSuppression",\n  "attack.final.focus",\n  "attack.final.power",\n  "attack.final.hitChoice",\n  "attack.final.defensiveReaction",\n  "attack.final.comboMultiplicity",\n  "attack.final.fireDrillFeint",\n  "attack.final.cycle",\n  "attack.final.onlyAttackLock",\n  "attack.final.optionalAttackCost",\n]);',
  "implemented final Attack resolvers");
write("app/card-effects.ts", cardEffects);

let combo = read("app/combo-engine.ts");
combo = replaceOnce(combo,
  'export type ComboCardLike = {',
  'import { finalAttackComboMultiplicity } from "./attack-final-effects";\n\nexport type ComboCardLike = {',
  "combo final resolver import");
combo = replaceOnce(combo,
  '  id: string;\n  name: string;',
  '  id: string;\n  name: string;\n  catalogId?: string | null;',
  "combo catalog id");
combo = replaceRegex(combo,
  /function orderedAttackSequence\(parts: string\[], context: ComboContext\) \{[\s\S]*?\n\}/,
  `function orderedAttackSequence(parts: string[], context: ComboContext) {
  const priorAttacks = context.priorCards.filter(isAttack);
  const virtual = priorAttacks.flatMap((card, index) => Array.from(
    { length: finalAttackComboMultiplicity(card) },
    () => ({ card, zone: context.zonesPlayed[index] ?? '', current: false }),
  ));
  virtual.push(...Array.from(
    { length: finalAttackComboMultiplicity(context.currentCard) },
    () => ({ card: context.currentCard, zone: context.currentZone, current: true }),
  ));
  let cursor = 0;
  let finalWasCurrent = false;
  for (const descriptor of parts) {
    let matched = false;
    while (cursor < virtual.length) {
      const entry = virtual[cursor++];
      if (!descriptorMatches(descriptor, entry.card, entry.zone)) continue;
      matched = true;
      finalWasCurrent = entry.current;
      break;
    }
    if (!matched) return false;
  }
  return finalWasCurrent;
}`,
  "combo double-punch sequence");
write("app/combo-engine.ts", combo);

let play = read("app/playtest.tsx");
play = replaceOnce(play,
  'import { comboPayoffText, comboRequirementText, evaluateCombo } from "./combo-engine";',
  'import { comboPayoffText, comboRequirementText, evaluateCombo } from "./combo-engine";\nimport { finalAttackAllowedZones, finalAttackCycle, finalAttackDefensiveReactionBonus, finalAttackEquipmentSuppression, finalAttackFireDrillFeint, finalAttackFocusReward, finalAttackHitChoice, finalAttackOnlyAttackLock, finalAttackOptionalAttackCost, finalAttackPowerBonus } from "./attack-final-effects";',
  "playtest final resolver import");
play = replaceOnce(play,
  '  focus: number;\n  belt: number;',
  '  focus: number;\n  focusGeneratedThisTurn?: number;\n  focusSpentThisTurn?: number;\n  belt: number;',
  "Board focus ledger fields");
play = replaceOnce(play,
  '  blockedThisRound?: boolean;\n  usedEffectIdsThisTurn?: string[];',
  '  blockedThisRound?: boolean;\n  completedBeltExamThisRound?: boolean;\n  completesActiveBeltExamThisAttack?: boolean;\n  currentAttackIsReversal?: boolean;\n  boughtCardThisAscend?: boolean;\n  boughtCardLastAscend?: boolean;\n  targetEquipmentDefPenalties?: Record<string, number>;\n  nextItemCostPenalty?: number;\n  attackLockedThisTurn?: boolean;\n  usedEffectIdsThisTurn?: string[];',
  "Board final Attack state fields");
play = replaceOnce(play,
  '  | { kind: "ready-equipment"; sourceCardId: string; optional: boolean };',
  '  | { kind: "ready-equipment"; sourceCardId: string; optional: boolean }\n  | { kind: "attack-equipment-target"; sourceCardId: string; candidates: string[]; amount: number }\n  | { kind: "attack-option"; sourceCardId: string; effect: "courtesy-notice" | "discount-dim-mak" | "tornado-crescent" }\n  | { kind: "attack-cost-discard"; sourceCardId: string; bonus: number; optional: true }\n  | { kind: "fire-drill-discard"; sourceCardId: string; defenseId: string; originalZone: string; alternativeZones: string[]; optional: true }\n  | { kind: "fire-drill-zone"; sourceCardId: string; defenseId: string; originalZone: string; alternativeZones: string[] };',
  "PendingChoice Attack variants");
play = replaceOnce(play,
  '  pendingCombatContinuation?: { remainingAiAttacks: string[]; reversalEligible: boolean } | null;',
  '  pendingCombatContinuation?: { remainingAiAttacks: string[]; reversalEligible: boolean; reactionCardId?: string | null; incomingZone?: string | null } | null;',
  "reaction continuation fields");
play = replaceOnce(play,
  '  reversalRemainingAiAttacks: string[];\n  log: string[];',
  '  reversalRemainingAiAttacks: string[];\n  reversalReason?: "block" | "defensive-front-kick" | null;\n  reversalIncomingZone?: string | null;\n  attackCostDecisionCardId?: string | null;\n  nonHonorSceneChangedThisRound?: boolean;\n  log: string[];',
  "Match final Attack state fields");
play = replaceOnce(play,
  'function cardFocus(card: CardEntry | undefined) { return numberValue(card?.focusValue); }',
  `function cardFocus(card: CardEntry | undefined) { return numberValue(card?.focusValue); }
function gainFocus(board: Board, amount: number) {
  const gain = Math.max(0, Number(amount) || 0);
  if (!gain) return board;
  return { ...board, focus: board.focus + gain, focusGeneratedThisTurn: (board.focusGeneratedThisTurn ?? 0) + gain };
}
function spendFocus(board: Board, amount: number) {
  const spend = Math.max(0, Math.min(board.focus, Number(amount) || 0));
  if (!spend) return board;
  return { ...board, focus: board.focus - spend, focusSpentThisTurn: (board.focusSpentThisTurn ?? 0) + spend };
}
function marketPriceFor(board: Board, card: CardEntry | undefined) {
  if (!card) return Number.POSITIVE_INFINITY;
  return cardCost(card) + (card.cardType === "Item" ? (board.nextItemCostPenalty ?? 0) : 0);
}
function equipmentSuppressionForZone(attacker: Board, defender: Board, zone: string) {
  const penalties = attacker.targetEquipmentDefPenalties ?? {};
  let amount = 0;
  for (const [id, penalty] of Object.entries(penalties)) {
    if (!defender.equipment.includes(id)) continue;
    const equipment = cardFor(id);
    if (!equipment) continue;
    const contribution = defenseEquipmentBonus(equipment, zone) || passiveEquipmentGuard(equipment);
    amount += Math.min(Math.max(0, Number(penalty) || 0), Math.max(0, contribution));
  }
  return amount;
}
function suppressionCandidates(defender: Board, zone: string) {
  return defender.equipment.filter((id) => {
    const equipment = cardFor(id);
    return Boolean(equipment && (defenseEquipmentBonus(equipment, zone) > 0 || passiveEquipmentGuard(equipment) > 0));
  });
}`,
  "Focus and suppression helpers");

play = replaceRegex(play,
  /function attackHasFlexibleZone\(board: Board, card: CardEntry\) \{[\s\S]*?\n\}/,
  `function attackAllowedZones(board: Board, card: CardEntry) {
  const conditional = finalAttackAllowedZones(card, { boughtCardLastAscend: board.boughtCardLastAscend });
  if (conditional.handled && conditional.zones.length > 1) return conditional.zones;
  if (board.nextAttackAnyZone || card.zone?.includes("Any")) return ["High", "Mid", "Low"];
  const equipped = board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));
  if (attackCanChooseAnyZone(card, board.attacksThisTurn === 0, equipped)) return ["High", "Mid", "Low"];
  if (cardFor(board.fighterId)?.name === "Whirlwind Wynn" && board.attacksThisTurn === 0 && hasTag(card, "Spin")) return ["High", "Mid", "Low"];
  return [card.zone?.split(",")[0] ?? "High"];
}
function attackHasFlexibleZone(board: Board, card: CardEntry) {
  return attackAllowedZones(board, card).length > 1;
}`,
  "allowed Attack zones");

play = replaceOnce(play,
  '    matchingArmor: equipmentDefenseModifier(defender, zone).value > 0,',
  '    matchingArmor: Math.max(0, equipmentDefenseModifier(defender, zone).value - equipmentSuppressionForZone(attacker, defender, zone)) > 0,',
  "conditional Attack matching Armor suppression");
play = replaceOnce(play,
  '  const equipment = equipmentConditionalAttackPowerBonus(equipped, {\n    firstAttack: attacker.attacksThisTurn === 0,\n    attackerSpeed,\n    defenderSpeed,\n  });\n  return {\n    power: printed.amount + equipment.amount,\n    damage: 0,\n    notes: [...printed.notes, ...(equipment.amount ? [`${equipment.sources.join(" + ")} +${equipment.amount} Attack Power vs faster fighter`] : [])],\n  };',
  '  const equipment = equipmentConditionalAttackPowerBonus(equipped, {\n    firstAttack: attacker.attacksThisTurn === 0,\n    attackerSpeed,\n    defenderSpeed,\n  });\n  const finalPrinted = finalAttackPowerBonus(card, { completedBeltExamThisRound: attacker.completedBeltExamThisRound, focusGeneratedThisTurn: attacker.focusGeneratedThisTurn, firstAttackThisTurn: attacker.attacksThisTurn === 0 });\n  return {\n    power: printed.amount + equipment.amount + finalPrinted.amount,\n    damage: 0,\n    notes: [...printed.notes, ...finalPrinted.notes, ...(equipment.amount ? [`${equipment.sources.join(" + ")} +${equipment.amount} Attack Power vs faster fighter`] : [])],\n  };',
  "final Attack power integration");
play = replaceRegex(play,
  /function structuredAttackCyclePlan\(board: Board, card: CardEntry, zone: string\) \{[\s\S]*?\n\}/,
  `function structuredAttackCyclePlan(board: Board, card: CardEntry, zone: string, nonHonorSceneChangedThisRound = false) {
  const priorCards = board.cardsThisTurn.map(cardFor).filter((prior): prior is CardEntry => Boolean(prior));
  const priorAttacks = priorCards.filter(isAttack);
  const previousZone = board.zonesPlayed.at(-1);
  const existing = structuredConditionalCycle(card, {
    timing: "afterResolve",
    firstAttackThisTurn: board.attacksThisTurn === 0,
    priorJumpOrSpinAttack: priorAttacks.some((prior) => hasTag(prior, "Jump") || hasTag(prior, "Spin")),
    previousAttackHit: board.attacksThisTurn > 0 && Boolean(board.lastAttackHit),
    differentZoneFromPreviousAttack: Boolean(previousZone && previousZone.toLocaleLowerCase() !== zone.toLocaleLowerCase()),
  });
  const priorZones = new Set(board.zonesPlayed.map((played) => played.toLocaleLowerCase()));
  const finalCycle = finalAttackCycle(card, {
    timing: "afterResolve",
    nonHonorSceneChangedThisRound,
    yellowBeltExamThirdZone: board.belt === 0 && priorZones.size === 2 && !priorZones.has(zone.toLocaleLowerCase()),
  });
  return { handled: existing.handled || finalCycle.handled, draw: existing.draw + finalCycle.draw, discard: existing.discard + finalCycle.discard };
}`,
  "final Attack cycle integration");
play = replaceOnce(play,
  '  const matchingArmor = equipmentDefenseModifier(defender, zone).value > 0;',
  '  const matchingArmor = Math.max(0, equipmentDefenseModifier(defender, zone).value - equipmentSuppressionForZone(attacker, defender, zone)) > 0;',
  "piercing matching Armor suppression");
play = replaceOnce(play,
  '    return { id, total: fighterStat(board, "DEF") + piercedArmorModifier(applyNextAttackArmorPenalty(equipmentDefenseModifier(board, zone), armorPenalty), piercing).value + cardPower(card) + (board.nextDefenseCardBonus ?? 0) + printed + modifier };',
  '    const suppression = attacker ? equipmentSuppressionForZone(attacker, board, zone) : 0;\n    return { id, total: fighterStat(board, "DEF") + piercedArmorModifier(applyNextAttackArmorPenalty(equipmentDefenseModifier(board, zone), armorPenalty + suppression), piercing).value + cardPower(card) + (board.nextDefenseCardBonus ?? 0) + printed + modifier };',
  "best Defense suppression");

play = replaceOnce(play,
  'function applyInitiateCarryover(board: Board) {\n  const ready = new Set(board.readyAtInitiate ?? []);\n  return {\n    ...board,\n    focus: board.focus + (board.nextInitiateFocus ?? 0),\n    nextInitiateFocus: 0,\n    exhaustedEquipment: (board.exhaustedEquipment ?? []).filter((id) => !ready.has(id)),\n    readyAtInitiate: [],\n  };\n}',
  'function applyInitiateCarryover(board: Board) {\n  const ready = new Set(board.readyAtInitiate ?? []);\n  const carryover = board.nextInitiateFocus ?? 0;\n  const reset = { ...board, focusGeneratedThisTurn: 0, focusSpentThisTurn: 0, nextInitiateFocus: 0, exhaustedEquipment: (board.exhaustedEquipment ?? []).filter((id) => !ready.has(id)), readyAtInitiate: [] };\n  return gainFocus(reset, carryover);\n}',
  "Initiate Focus ledger reset");
play = replaceOnce(play,
  '    if (owner === "player" || owner === "ai") next.focus += numberValue(card.focusValue);',
  '    if (owner === "player" || owner === "ai") next = gainFocus(next, numberValue(card.focusValue));',
  "printed Focus ledger");
play = replaceOnce(play,
  '    if (effect.kind === "focus") next.focus += effect.amount;',
  '    if (effect.kind === "focus") next = gainFocus(next, effect.amount);',
  "generic Focus ledger");
play = replaceOnce(play,
  '  if (structuredFocus.handled && structuredFocus.amount) next.focus += structuredFocus.amount;',
  '  if (structuredFocus.handled && structuredFocus.amount) next = gainFocus(next, structuredFocus.amount);',
  "structured Focus ledger");
play = replaceOnce(play,
  '  const structuredAnyZone = structuredNextAttackAnyZone(card, { timing, attackNumber: board.attacksThisTurn });',
  '  const finalFocus = finalAttackFocusReward(card, { timing, focusSpentThisTurn: board.focusSpentThisTurn, firstNormalAttackThisTurn: board.attacksThisTurn === 1 && !board.currentAttackIsReversal, completesActiveBeltExam: board.completesActiveBeltExamThisAttack });\n  if (finalFocus) next = gainFocus(next, finalFocus);\n  const structuredAnyZone = structuredNextAttackAnyZone(card, { timing, attackNumber: board.attacksThisTurn });',
  "final contextual Focus reward");

play = replaceOnce(play,
  '    fighterId, hp: gameDefinition.mode.startingHp, maxHp: gameDefinition.mode.startingHp, xp: 0, focus: 0, belt: 0,',
  '    fighterId, hp: gameDefinition.mode.startingHp, maxHp: gameDefinition.mode.startingHp, xp: 0, focus: 0, focusGeneratedThisTurn: 0, focusSpentThisTurn: 0, belt: 0,',
  "empty board Focus ledger");
play = replaceOnce(play,
  '    damageReductionUsed: false, wasHitSinceLastTurn: false, borrowedEquipmentId: null, abilityUsedRound: false,',
  '    damageReductionUsed: false, wasHitSinceLastTurn: false, borrowedEquipmentId: null, abilityUsedRound: false, completedBeltExamThisRound: false, completesActiveBeltExamThisAttack: false, currentAttackIsReversal: false, boughtCardThisAscend: false, boughtCardLastAscend: false, targetEquipmentDefPenalties: {}, nextItemCostPenalty: 0, attackLockedThisTurn: false,',
  "empty board final state");
play = replaceOnce(play,
  '  return drawCards({ ...readyBoard, hand: [], playArea: [], equipment, exhaustedEquipment, equipmentAttackPlan: null, discard, focus: 0, attacksThisTurn: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0, borrowedEquipmentId: null, wasHitSinceLastTurn: false, playedDefenseSinceLastTurn: false, blockedSinceLastTurn: false, usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, comboAttemptedTurn: false }, gameDefinition.turn.handSize + (readyBoard.belt >= 5 ? 1 : 0));',
  '  return drawCards({ ...readyBoard, hand: [], playArea: [], equipment, exhaustedEquipment, equipmentAttackPlan: null, discard, focus: 0, focusGeneratedThisTurn: 0, focusSpentThisTurn: 0, attacksThisTurn: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0, borrowedEquipmentId: null, wasHitSinceLastTurn: false, playedDefenseSinceLastTurn: false, blockedSinceLastTurn: false, usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, comboAttemptedTurn: false, boughtCardLastAscend: Boolean(readyBoard.boughtCardThisAscend), boughtCardThisAscend: false, targetEquipmentDefPenalties: {}, attackLockedThisTurn: false, completesActiveBeltExamThisAttack: false, currentAttackIsReversal: false }, gameDefinition.turn.handSize + (readyBoard.belt >= 5 ? 1 : 0));',
  "Hide final Attack state reset");
play = replaceOnce(play,
  'function markCompletedTask(board: Board) {\n  const next = board.belt + 1;\n  if (!beltTaskMet(board) || board.completedTasks.includes(next)) return board;\n  return { ...board, completedTasks: [...board.completedTasks, next] };\n}',
  'function markCompletedTask(board: Board) {\n  const next = board.belt + 1;\n  if (!beltTaskMet(board) || board.completedTasks.includes(next)) return board;\n  return { ...board, completedTasks: [...board.completedTasks, next], completedBeltExamThisRound: true };\n}',
  "Belt Exam completion state");

play = replaceOnce(play,
  '    setMatch({ schema: 8, rulesVersion: activeRulesRevision, player, ai, market: openingMarket.market, marketDeck: openingMarket.marketDeck, marketDiscard: [], marketPurchasedThisRound: false, comboDeck: comboDeck.slice(1), comboOfferId: comboDeck[0] ?? null, locations: locations.slice(1), locationId: currentLocation, round: 1, phase: playerFirst ? "player-initiate" : "ai-ready", turnOrder, turnIndex: 0, selectedAttackId: null, selectedZone: "High", pendingStrike: null, pendingDiscard: null, pendingChoice: null, pendingCombatContinuation: null, reversalRemainingAiAttacks: [], winner: null, log:',
  '    setMatch({ schema: 8, rulesVersion: activeRulesRevision, player, ai, market: openingMarket.market, marketDeck: openingMarket.marketDeck, marketDiscard: [], marketPurchasedThisRound: false, comboDeck: comboDeck.slice(1), comboOfferId: comboDeck[0] ?? null, locations: locations.slice(1), locationId: currentLocation, round: 1, phase: playerFirst ? "player-initiate" : "ai-ready", turnOrder, turnIndex: 0, selectedAttackId: null, selectedZone: "High", pendingStrike: null, pendingDiscard: null, pendingChoice: null, pendingCombatContinuation: null, reversalRemainingAiAttacks: [], reversalReason: null, reversalIncomingZone: null, attackCostDecisionCardId: null, nonHonorSceneChangedThisRound: false, winner: null, log:',
  "initial Match final Attack state");
play = replaceRegex(play,
  /const chooseAttack = \(card: CardEntry\) => setMatch\(\(current\) => current \? \{ \.\.\.current, selectedAttackId:[\s\S]*?\} : current\);/,
  `const chooseAttack = (card: CardEntry) => setMatch((current) => {
    if (!current) return current;
    if (current.player.attackLockedThisTurn && current.player.attacksThisTurn > 0) return current;
    if (current.attackCostDecisionCardId && current.attackCostDecisionCardId !== card.id) return current;
    const zones = attackAllowedZones(current.player, card);
    const selectedAttackId = current.selectedAttackId === card.id ? null : card.id;
    const selectedZone = zones.includes(current.selectedZone) ? current.selectedZone : zones[0] ?? "High";
    return { ...current, selectedAttackId, selectedZone };
  });`,
  "Attack selection state");

play = replaceOnce(play,
  '    const conditionalCycle = structuredAttackCyclePlan(current.player, card, zone);',
  '    const conditionalCycle = structuredAttackCyclePlan(current.player, card, zone, current.nonHonorSceneChangedThisRound);',
  "player final cycle context");
play = replaceOnce(play,
  '    const rawArmorModifier = equipmentDefenseModifier(aiIncomingReaction.board, zone);',
  '    const rawArmorModifier = equipmentDefenseModifier(aiIncomingReaction.board, zone);\n    const persistentSuppression = equipmentSuppressionForZone(current.player, aiIncomingReaction.board, zone);',
  "player persistent equipment suppression");
play = replaceOnce(play,
  '    const penalizedArmorModifier = applyNextAttackArmorPenalty(rawArmorModifier, armorPenalty);',
  '    const penalizedArmorModifier = applyNextAttackArmorPenalty(rawArmorModifier, armorPenalty + persistentSuppression);',
  "player suppression armor math");
play = replaceOnce(play,
  '    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attacksThisTurn: current.player.attacksThisTurn + 1, hitThisTurn: current.player.hitThisTurn || hit, attackedThisRound: true, cardsThisTurn: [...current.player.cardsThisTurn, card.id], zonesPlayed: [...current.player.zonesPlayed, zone], nextAttackBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false, nextAttackArmorPenalty: 0, equipmentAttackPlan: null, tempo: tempoBonus ? false : current.player.tempo, wasHitSinceLastTurn: current.player.attacksThisTurn === 0 ? false : current.player.wasHitSinceLastTurn, triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0, damageDealt: current.player.damageDealt + damage, lastAttackHit: hit }, card, "player");',
  '    const attackState = { ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attacksThisTurn: current.player.attacksThisTurn + 1, hitThisTurn: current.player.hitThisTurn || hit, attackedThisRound: true, cardsThisTurn: [...current.player.cardsThisTurn, card.id], zonesPlayed: [...current.player.zonesPlayed, zone], nextAttackBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false, nextAttackArmorPenalty: 0, equipmentAttackPlan: null, tempo: tempoBonus ? false : current.player.tempo, wasHitSinceLastTurn: current.player.attacksThisTurn === 0 ? false : current.player.wasHitSinceLastTurn, triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0, damageDealt: current.player.damageDealt + damage, lastAttackHit: hit, currentAttackIsReversal: false, attackLockedThisTurn: current.player.attackLockedThisTurn || finalAttackOnlyAttackLock(card, current.player.attacksThisTurn === 0) };\n    const completesActiveBeltExam = !beltTaskMet(current.player) && beltTaskMet(attackState);\n    let nextPlayer = applyCardEffects({ ...attackState, completesActiveBeltExamThisAttack: completesActiveBeltExam }, card, "player");',
  "player Belt Exam/final state before effects");
play = replaceOnce(play,
  '    if (hit && comboModifier.focusOnHit) nextPlayer.focus += comboModifier.focusOnHit;',
  '    if (hit && comboModifier.focusOnHit) nextPlayer = gainFocus(nextPlayer, comboModifier.focusOnHit);',
  "player Combo Focus ledger");
play = replaceOnce(play,
  '    if (!hit && armedEquipment.blockedFocus) nextPlayer.focus += armedEquipment.blockedFocus;',
  '    if (!hit && armedEquipment.blockedFocus) nextPlayer = gainFocus(nextPlayer, armedEquipment.blockedFocus);',
  "player blocked Focus ledger");
play = replaceOnce(play,
  '    if (damage >= 3 && nextPlayer.belt >= 6) nextPlayer.focus += 1;',
  '    if (damage >= 3 && nextPlayer.belt >= 6) nextPlayer = gainFocus(nextPlayer, 1);',
  "player red Belt Focus ledger");

play = replaceOnce(play,
  '    const readyOnHit = hit ? readyEquipmentOnHit(card) : 0;\n    const optionalCycle = !nextAi.hp ? null : optionalDiscardDrawChoice(card);\n    const pendingChoice: PendingChoice | null = readyOnHit && (nextPlayer.exhaustedEquipment ?? []).length',
  '    const readyOnHit = hit ? readyEquipmentOnHit(card) : 0;\n    const optionalCycle = !nextAi.hp ? null : optionalDiscardDrawChoice(card);\n    const suppression = hit ? finalAttackEquipmentSuppression(card) : 0;\n    const suppressionTargets = suppression ? suppressionCandidates(nextAi, zone) : [];\n    const hitChoice = hit ? finalAttackHitChoice(card) : null;\n    const pendingChoice: PendingChoice | null = suppressionTargets.length\n      ? { kind: "attack-equipment-target", sourceCardId: card.id, candidates: suppressionTargets, amount: suppression }\n      : hitChoice\n        ? { kind: "attack-option", sourceCardId: card.id, effect: hitChoice.kind }\n      : readyOnHit && (nextPlayer.exhaustedEquipment ?? []).length',
  "post-Hit Attack choices");

play = replaceOnce(play,
  '    const choiceNote = pendingChoice?.kind === "destroy-junk" ? `Choose ${junkCount} Junk card${junkCount === 1 ? "" : "s"} from your hand or discard pile to destroy.` : pendingChoice?.kind === "discard-hand" ? `Choose ${pendingChoice.remaining} card${pendingChoice.remaining === 1 ? "" : "s"} from your hand to discard.` : deckNote || cardEffectNote(card);',
  '    const choiceNote = pendingChoice?.kind === "destroy-junk" ? `Choose ${junkCount} Junk card${junkCount === 1 ? "" : "s"} from your hand or discard pile to destroy.` : pendingChoice?.kind === "discard-hand" ? `Choose ${pendingChoice.remaining} card${pendingChoice.remaining === 1 ? "" : "s"} from your hand to discard.` : deckNote || cardEffectNote(card);',
  "stable support anchor");

play = replaceOnce(play,
  '    const nextPlayer = {\n      ...current.player,\n      hand: removeOne(current.player.hand, id),\n      discard: [...current.player.discard, id],\n      focus: current.player.focus + gain,\n      badHabitFocusUsed: true,\n      lastAttackHit: false,\n    };',
  '    const nextPlayer = gainFocus({ ...current.player, hand: removeOne(current.player.hand, id), discard: [...current.player.discard, id], badHabitFocusUsed: true, lastAttackHit: false }, gain);',
  "Bad Habit Focus ledger");
play = replaceOnce(play,
  '    const nextPlayer = {\n      ...current.player,\n      hand: removeOne(current.player.hand, id),\n      playArea: [...current.player.playArea, id],\n      focus: current.player.focus + cardFocus(card),\n      defensePracticeUsed: true,\n      lastAttackHit: false,\n    };',
  '    const nextPlayer = gainFocus({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], defensePracticeUsed: true, lastAttackHit: false }, cardFocus(card));',
  "Defense Practice Focus ledger");
play = replaceOnce(play,
  'setMatch((current) => current?.phase === "player-yell" && !current.pendingDiscard && !current.pendingChoice ? write(current, "Ascend: the acquisition desk opens. Spend this turn\'s Focus before it leaves your mat.", { phase: "player-ascend", selectedAttackId: null }) : current);',
  'setMatch((current) => current?.phase === "player-yell" && !current.pendingDiscard && !current.pendingChoice ? write(current, "Ascend: the acquisition desk opens. Spend this turn\'s Focus before it leaves your mat.", { phase: "player-ascend", selectedAttackId: null, player: { ...current.player, boughtCardThisAscend: false } }) : current);',
  "Ascend purchase tracking reset");
play = replaceOnce(play,
  '    const price = cardCost(card);\n    if (!card || slot < 0 || current.player.focus < price) return current;\n    const focusBefore = current.player.focus;\n    const nextPlayer = markCompletedTask({ ...current.player, focus: focusBefore - price, discard: [...current.player.discard, id], purchasedTypes: [...current.player.purchasedTypes, card.cardType], cardsBought: current.player.cardsBought + 1 });',
  '    const price = marketPriceFor(current.player, card);\n    if (!card || slot < 0 || current.player.focus < price) return current;\n    const focusBefore = current.player.focus;\n    let nextPlayer = spendFocus(current.player, price);\n    nextPlayer = markCompletedTask({ ...nextPlayer, discard: [...nextPlayer.discard, id], purchasedTypes: [...nextPlayer.purchasedTypes, card.cardType], cardsBought: nextPlayer.cardsBought + 1, boughtCardThisAscend: true, nextItemCostPenalty: card.cardType === "Item" ? 0 : nextPlayer.nextItemCostPenalty });',
  "Market Focus spend and Item penalty");
play = replaceOnce(play,
  '      ? { ...current.player, focus: current.player.focus - cost, learnedCombos: [...current.player.learnedCombos, combo.id], comboAttemptedTurn: true }',
  '      ? { ...spendFocus(current.player, cost), learnedCombos: [...current.player.learnedCombos, combo.id], comboAttemptedTurn: true }',
  "Combo Focus spend ledger");

// The remaining complex player-choice/reaction wiring is inserted in a follow-up patch after this foundation builds.
write("app/playtest.tsx", play);

console.log(`Structured ${Object.keys(additions).length} remaining Core Attacks.`);
