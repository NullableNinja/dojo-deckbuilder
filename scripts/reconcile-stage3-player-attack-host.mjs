import fs from "node:fs";

const path = "app/playtest.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceExactlyOnce(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return text.replace(before, after);
}

source = replaceExactlyOnce(
  source,
  'import { applyQuickDuelPlaytestTransition, publishQuickDuelPlaytestLifecycleEvent } from "./quick-duel-playtest-host";',
  'import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestLifecycleEvent } from "./quick-duel-playtest-host";',
  "Playtest host import",
);

source = replaceExactlyOnce(
  source,
  'function attackHasFlow(board: Board, card: CardEntry, combo: ComboModifier, zone = card.zone?.split(",")[0] ?? "High", isReversal = false) {\n  if (board.nextAttackHasFlow || combo.grantsFlow || stage3cAttackFlow(board, card, zone, isReversal)) return true;',
  'function attackHasFlow(board: Board, card: CardEntry, combo: ComboModifier | null, zone = card.zone?.split(",")[0] ?? "High", isReversal = false) {\n  if (board.nextAttackHasFlow || combo?.grantsFlow || stage3cAttackFlow(board, card, zone, isReversal)) return true;',
  "nullable legacy Combo flow bridge",
);

const playerStartMarker = "  const resolvePlayerAttackState = (current: Match): Match => {";
const playerEndMarker = "\n  const declareAttack =";
const playerStart = source.indexOf(playerStartMarker);
const playerEnd = source.indexOf(playerEndMarker, playerStart);
if (playerStart < 0 || playerEnd <= playerStart) throw new Error("player Attack resolver boundaries not found");
let playerAttack = source.slice(playerStart, playerEnd);

const replacements = [
  [
    '    const zone = anyZone ? current.selectedZone : card.zone?.split(",")[0] ?? "High";\n    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;',
    '    const zone = anyZone ? current.selectedZone : card.zone?.split(",")[0] ?? "High";\n    const preparedComboAttack = prepareQuickDuelPlaytestAttack(current, "player", card, zone, cardFor, quickDuelHostOperations);\n    current = preparedComboAttack.match;\n    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;',
    "player Attack host preparation",
  ],
  [
    '    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const comboModifier = comboAttackModifier(current.player, card, zone);\n    const armedEquipment = armedEquipmentAttackModifier(current.player, zone);',
    '    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const armedEquipment = armedEquipmentAttackModifier(current.player, zone);',
    "remove player legacy Combo evaluator",
  ],
  [
    '    const piercingModifier = attackPiercingModifier(current.player, aiIncomingReaction.board, card, zone, comboModifier.piercing + armedEquipment.piercing);',
    '    const piercingModifier = attackPiercingModifier(current.player, aiIncomingReaction.board, card, zone, preparedComboAttack.attackFacts.piercing + armedEquipment.piercing);',
    "player hosted piercing",
  ],
  [
    '    const hasFlow = attackHasFlow(current.player, card, comboModifier, zone);',
    '    const hasFlow = attackHasFlow(current.player, card, null, zone);',
    "player hosted flow ownership",
  ],
  [
    '    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);',
    '    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);',
    "remove player legacy Combo power",
  ],
  [
    '    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage + comboModifier.damage) : 0;',
    '    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage) : 0;',
    "remove player legacy Combo damage",
  ],
  [
    'triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0,',
    'triggeredCombos: current.player.triggeredCombos, comboTriggered: current.player.comboTriggered,',
    "player Combo state ownership",
  ],
  [
    '    if (hit && comboModifier.focusOnHit) nextPlayer = gainFocus(nextPlayer, comboModifier.focusOnHit);\n    if (comboModifier.speedOnTrigger) nextPlayer.tempSpeed += comboModifier.speedOnTrigger;\n',
    '',
    "remove player legacy Combo payoff mutation",
  ],
  [
    '    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...armedEquipment.notes, ...aiIncomingReaction.notes, ...aiConsumableReaction.notes, ...aiDefenseReaction.notes, ...piercingModifier.notes, ...armorModifier.notes, ...postDefensePower.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...targetDiscardNotes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...consumableAttackFollowup.notes, ...(reduced.note ? [reduced.note] : [])];',
    '    let hostedComboMatch: Match = { ...current, player: nextPlayer, ai: nextAi };\n    if (hit) hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "onHit", quickDuelHostOperations, { currentAttackHit: true }).match;\n    hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "afterResolve", quickDuelHostOperations, { currentAttackHit: hit, currentDefense: defenseCard, currentDefenseBlocked: Boolean(defenseCard && !hit) }).match;\n    nextPlayer = hostedComboMatch.player;\n    nextAi = hostedComboMatch.ai;\n    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...armedEquipment.notes, ...aiIncomingReaction.notes, ...aiConsumableReaction.notes, ...aiDefenseReaction.notes, ...piercingModifier.notes, ...armorModifier.notes, ...postDefensePower.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...targetDiscardNotes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...consumableAttackFollowup.notes, ...(reduced.note ? [reduced.note] : [])];',
    "player hosted onHit/afterResolve",
  ],
];

for (const [before, after, label] of replacements) {
  playerAttack = replaceExactlyOnce(playerAttack, before, after, label);
}

if (/comboAttackModifier|comboModifier/.test(playerAttack)) throw new Error("player Attack still contains legacy Combo evaluator references");
source = source.slice(0, playerStart) + playerAttack + source.slice(playerEnd);

fs.writeFileSync(path, source);
console.log("Reconciled player Attack through the unified Quick Duel Combo host.");
