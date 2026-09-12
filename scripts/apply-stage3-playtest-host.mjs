import { readFile, writeFile } from "node:fs/promises";

// One-time guarded authoring migration for the isolated Stage 3 feature branch.
const path = new URL("../app/playtest.tsx", import.meta.url);
let source = await readFile(path, "utf8");

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source fragment was not found; refusing to edit playtest.tsx`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: source fragment matched more than once; refusing an ambiguous edit`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  "Quick Duel Attack host imports",
  'import { applyQuickDuelPlaytestTransition, publishQuickDuelPlaytestLifecycleEvent } from "./quick-duel-playtest-host";',
  'import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestLifecycleEvent } from "./quick-duel-playtest-host";',
);

replaceOnce(
  "Flow helper accepts canonical-host path",
  'function attackHasFlow(board: Board, card: CardEntry, combo: ComboModifier, zone = card.zone?.split(",")[0] ?? "High", isReversal = false) {',
  'function attackHasFlow(board: Board, card: CardEntry, combo: ComboModifier | null, zone = card.zone?.split(",")[0] ?? "High", isReversal = false) {',
);
replaceOnce(
  "Flow helper canonical-host state",
  '  if (board.nextAttackHasFlow || combo.grantsFlow || stage3cAttackFlow(board, card, zone, isReversal)) return true;',
  '  if (board.nextAttackHasFlow || combo?.grantsFlow || stage3cAttackFlow(board, card, zone, isReversal)) return true;',
);

replaceOnce(
  "player Attack declaration host",
  `    const anyZone = attackHasFlexibleZone(current.player, card);
    const zone = anyZone ? current.selectedZone : card.zone?.split(",")[0] ?? "High";
    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;`,
  `    const anyZone = attackHasFlexibleZone(current.player, card);
    const zone = anyZone ? current.selectedZone : card.zone?.split(",")[0] ?? "High";
    const preparedComboAttack = prepareQuickDuelPlaytestAttack(current, "player", card, zone, cardFor, quickDuelHostOperations);
    current = preparedComboAttack.match;
    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;`,
);

replaceOnce(
  "remove player legacy Combo evaluator",
  '    const comboModifier = comboAttackModifier(current.player, card, zone);\n',
  '',
);
replaceOnce(
  "player canonical Combo piercing",
  '    const piercingModifier = attackPiercingModifier(current.player, aiIncomingReaction.board, card, zone, comboModifier.piercing + armedEquipment.piercing);',
  '    const piercingModifier = attackPiercingModifier(current.player, aiIncomingReaction.board, card, zone, preparedComboAttack.attackFacts.piercing + armedEquipment.piercing);',
);
replaceOnce(
  "player canonical Combo Flow",
  '    const hasFlow = attackHasFlow(current.player, card, comboModifier, zone);',
  '    const hasFlow = attackHasFlow(current.player, card, null, zone);',
);
replaceOnce(
  "player canonical Combo Attack Power",
  '    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);',
  '    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);',
);
replaceOnce(
  "player canonical Combo damage",
  `    const hit = attackPower > defensePower;
    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage + comboModifier.damage) : 0;
    const reduced = reduceDamageForFighter(aiDefenseReaction.board, rawDamage);`,
  `    const hit = attackPower > defensePower;
    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage) : 0;
    const reduced = reduceDamageForFighter(aiDefenseReaction.board, rawDamage);`,
);
replaceOnce(
  "player canonical Combo activation markers",
  'attacksThisTurn: current.player.attacksThisTurn + 1, hitThisTurn: current.player.hitThisTurn || hit, attackedThisRound: true, cardsThisTurn: [...current.player.cardsThisTurn, card.id], zonesPlayed: [...current.player.zonesPlayed, zone], nextAttackBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false, nextAttackArmorPenalty: 0, equipmentAttackPlan: null, tempo: tempoBonus ? false : current.player.tempo, wasHitSinceLastTurn: current.player.attacksThisTurn === 0 ? false : current.player.wasHitSinceLastTurn, triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0, damageDealt: current.player.damageDealt + damage',
  'attacksThisTurn: current.player.attacksThisTurn + 1, hitThisTurn: current.player.hitThisTurn || hit, attackedThisRound: true, cardsThisTurn: [...current.player.cardsThisTurn, card.id], zonesPlayed: [...current.player.zonesPlayed, zone], nextAttackBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false, nextAttackArmorPenalty: 0, equipmentAttackPlan: null, tempo: tempoBonus ? false : current.player.tempo, wasHitSinceLastTurn: current.player.attacksThisTurn === 0 ? false : current.player.wasHitSinceLastTurn, triggeredCombos: current.player.triggeredCombos, comboTriggered: current.player.comboTriggered, damageDealt: current.player.damageDealt + damage',
);
replaceOnce(
  "remove player legacy Combo hit payoff",
  `    const flowDraw = hasFlow && !current.player.flowUsedThisTurn;
    if (flowDraw) nextPlayer = drawCards({ ...nextPlayer, flowUsedThisTurn: true }, 1);
    if (current.player.flowAfterFirstAttack && current.player.attacksThisTurn === 0) nextPlayer = { ...nextPlayer, flowAfterFirstAttack: false, nextAttackHasFlow: true };
    if (hit && comboModifier.focusOnHit) nextPlayer = gainFocus(nextPlayer, comboModifier.focusOnHit);
    if (comboModifier.speedOnTrigger) nextPlayer.tempSpeed += comboModifier.speedOnTrigger;
    if (!hit && armedEquipment.blockedFocus) nextPlayer = gainFocus(nextPlayer, armedEquipment.blockedFocus);`,
  `    const flowDraw = hasFlow && !current.player.flowUsedThisTurn;
    if (flowDraw) nextPlayer = drawCards({ ...nextPlayer, flowUsedThisTurn: true }, 1);
    if (current.player.flowAfterFirstAttack && current.player.attacksThisTurn === 0) nextPlayer = { ...nextPlayer, flowAfterFirstAttack: false, nextAttackHasFlow: true };
    if (!hit && armedEquipment.blockedFocus) nextPlayer = gainFocus(nextPlayer, armedEquipment.blockedFocus);`,
);
replaceOnce(
  "player Combo post-combat event host",
  '    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...armedEquipment.notes, ...aiIncomingReaction.notes, ...aiConsumableReaction.notes, ...aiDefenseReaction.notes, ...piercingModifier.notes, ...armorModifier.notes, ...postDefensePower.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...targetDiscardNotes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...consumableAttackFollowup.notes, ...(reduced.note ? [reduced.note] : [])];',
  `    let hostedComboMatch: Match = { ...current, player: nextPlayer, ai: nextAi };
    if (hit) hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "onHit", quickDuelHostOperations, { currentAttackHit: true }).match;
    hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "afterResolve", quickDuelHostOperations, { currentAttackHit: hit, currentDefense: defenseCard, currentDefenseBlocked: Boolean(defenseCard && !hit) }).match;
    nextPlayer = hostedComboMatch.player;
    nextAi = hostedComboMatch.ai;
    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...armedEquipment.notes, ...aiIncomingReaction.notes, ...aiConsumableReaction.notes, ...aiDefenseReaction.notes, ...piercingModifier.notes, ...armorModifier.notes, ...postDefensePower.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...targetDiscardNotes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...consumableAttackFollowup.notes, ...(reduced.note ? [reduced.note] : [])];`,
);

const playerAttackStart = source.indexOf("  const resolvePlayerAttackState = (current: Match): Match => {");
const playerAttackEnd = source.indexOf("\n  const declareAttack =", playerAttackStart);
if (playerAttackStart < 0 || playerAttackEnd < 0) throw new Error("player Attack function boundaries were not found after migration");
const playerAttackSource = source.slice(playerAttackStart, playerAttackEnd);
if (playerAttackSource.includes("comboAttackModifier") || playerAttackSource.includes("comboModifier")) throw new Error("player Attack still contains legacy Combo gameplay authority");
if (!playerAttackSource.includes("prepareQuickDuelPlaytestAttack")) throw new Error("player Attack declaration host was not installed");
if (!playerAttackSource.includes('hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "onHit"')) throw new Error("player Attack onHit host was not installed");
if (!playerAttackSource.includes('hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "afterResolve"')) throw new Error("player Attack afterResolve host was not installed");

await writeFile(path, source);
console.log("Applied guarded Stage 3 player Attack Combo-host migration.");
