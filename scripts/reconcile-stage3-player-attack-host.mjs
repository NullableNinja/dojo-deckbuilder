import fs from "node:fs";

const path = "app/playtest.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import { applyQuickDuelPlaytestTransition, publishQuickDuelPlaytestLifecycleEvent } from "./quick-duel-playtest-host";',
  'import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestLifecycleEvent } from "./quick-duel-playtest-host";',
  "Playtest host import",
);

replaceOnce(
  'function attackHasFlow(board: Board, card: CardEntry, combo: ComboModifier, zone = card.zone?.split(",")[0] ?? "High", isReversal = false) {\n  if (board.nextAttackHasFlow || combo.grantsFlow || stage3cAttackFlow(board, card, zone, isReversal)) return true;',
  'function attackHasFlow(board: Board, card: CardEntry, combo: ComboModifier | null, zone = card.zone?.split(",")[0] ?? "High", isReversal = false) {\n  if (board.nextAttackHasFlow || combo?.grantsFlow || stage3cAttackFlow(board, card, zone, isReversal)) return true;',
  "nullable legacy Combo flow bridge",
);

replaceOnce(
  '    const zone = anyZone ? current.selectedZone : card.zone?.split(",")[0] ?? "High";\n    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;',
  '    const zone = anyZone ? current.selectedZone : card.zone?.split(",")[0] ?? "High";\n    const preparedComboAttack = prepareQuickDuelPlaytestAttack(current, "player", card, zone, cardFor, quickDuelHostOperations);\n    current = preparedComboAttack.match;\n    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;',
  "player Attack host preparation",
);

replaceOnce(
  '    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const comboModifier = comboAttackModifier(current.player, card, zone);\n    const armedEquipment = armedEquipmentAttackModifier(current.player, zone);',
  '    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const armedEquipment = armedEquipmentAttackModifier(current.player, zone);',
  "remove player legacy Combo evaluator",
);

replaceOnce(
  '    const piercingModifier = attackPiercingModifier(current.player, aiIncomingReaction.board, card, zone, comboModifier.piercing + armedEquipment.piercing);',
  '    const piercingModifier = attackPiercingModifier(current.player, aiIncomingReaction.board, card, zone, preparedComboAttack.attackFacts.piercing + armedEquipment.piercing);',
  "player hosted piercing",
);

replaceOnce(
  '    const hasFlow = attackHasFlow(current.player, card, comboModifier, zone);',
  '    const hasFlow = attackHasFlow(current.player, card, null, zone);',
  "player hosted flow ownership",
);

replaceOnce(
  '    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);',
  '    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);',
  "remove player legacy Combo power",
);

replaceOnce(
  '    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage + comboModifier.damage) : 0;',
  '    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage) : 0;',
  "remove player legacy Combo damage",
);

replaceOnce(
  'triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0,',
  'triggeredCombos: current.player.triggeredCombos, comboTriggered: current.player.comboTriggered,',
  "player Combo state ownership",
);

replaceOnce(
  '    if (hit && comboModifier.focusOnHit) nextPlayer = gainFocus(nextPlayer, comboModifier.focusOnHit);\n    if (comboModifier.speedOnTrigger) nextPlayer.tempSpeed += comboModifier.speedOnTrigger;\n',
  '',
  "remove player legacy Combo payoff mutation",
);

replaceOnce(
  '    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...armedEquipment.notes, ...aiIncomingReaction.notes, ...aiConsumableReaction.notes, ...aiDefenseReaction.notes, ...piercingModifier.notes, ...armorModifier.notes, ...postDefensePower.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...targetDiscardNotes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...consumableAttackFollowup.notes, ...(reduced.note ? [reduced.note] : [])];',
  '    let hostedComboMatch: Match = { ...current, player: nextPlayer, ai: nextAi };\n    if (hit) hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "onHit", quickDuelHostOperations, { currentAttackHit: true }).match;\n    hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "afterResolve", quickDuelHostOperations, { currentAttackHit: hit, currentDefense: defenseCard, currentDefenseBlocked: Boolean(defenseCard && !hit) }).match;\n    nextPlayer = hostedComboMatch.player;\n    nextAi = hostedComboMatch.ai;\n    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...armedEquipment.notes, ...aiIncomingReaction.notes, ...aiConsumableReaction.notes, ...aiDefenseReaction.notes, ...piercingModifier.notes, ...armorModifier.notes, ...postDefensePower.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...targetDiscardNotes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...consumableAttackFollowup.notes, ...(reduced.note ? [reduced.note] : [])];',
  "player hosted onHit/afterResolve",
);

fs.writeFileSync(path, source);
console.log("Reconciled player Attack through the unified Quick Duel Combo host.");
