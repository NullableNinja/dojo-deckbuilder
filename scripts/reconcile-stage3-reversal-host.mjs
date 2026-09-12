import fs from "node:fs";

const path = "app/playtest.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceExactlyOnce(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return text.replace(before, after);
}

const legacyComboStart = source.indexOf("type ComboModifier =");
const legacyComboEnd = source.indexOf("\nfunction locationAttackModifier", legacyComboStart);
if (legacyComboStart < 0 || legacyComboEnd <= legacyComboStart) throw new Error("legacy Combo evaluator block boundaries not found");
source = source.slice(0, legacyComboStart) + source.slice(legacyComboEnd + 1);

source = replaceExactlyOnce(
  source,
  'function attackHasFlow(board: Board, card: CardEntry, combo: ComboModifier | null, zone = card.zone?.split(",")[0] ?? "High", isReversal = false) {\n  if (board.nextAttackHasFlow || combo?.grantsFlow || stage3cAttackFlow(board, card, zone, isReversal)) return true;',
  'function attackHasFlow(board: Board, card: CardEntry, zone = card.zone?.split(",")[0] ?? "High", isReversal = false) {\n  if (board.nextAttackHasFlow || stage3cAttackFlow(board, card, zone, isReversal)) return true;',
  "remove legacy Combo argument from flow helper",
);
source = replaceExactlyOnce(source, 'attackHasFlow(current.player, card, null, zone)', 'attackHasFlow(current.player, card, zone)', "player flow call");
source = replaceExactlyOnce(source, 'attackHasFlow(activeEquipment.board, card, null, zone)', 'attackHasFlow(activeEquipment.board, card, zone)', "AI flow call");

const startMarker = '  const resolveReversal = () => setMatch((current) => {';
const endMarker = "\n  const useHandCard =";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end <= start) throw new Error("Reversal boundaries not found");
let reversal = source.slice(start, end);

const replacements = [
  [
    '    const zone = attackHasFlexibleZone(current.player, card) ? current.selectedZone : card.zone?.split(",")[0] ?? "High";\n    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;',
    '    const zone = attackHasFlexibleZone(current.player, card) ? current.selectedZone : card.zone?.split(",")[0] ?? "High";\n    const preparedComboAttack = prepareQuickDuelPlaytestAttack(current, "player", card, zone, cardFor, quickDuelHostOperations, { isReversal: true });\n    current = preparedComboAttack.match;\n    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;',
    "Reversal host preparation",
  ],
  [
    '    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const comboModifier = comboAttackModifier(current.player, card, zone, true);\n    const rawArmorModifier = equipmentDefenseModifier(current.ai, zone);',
    '    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const rawArmorModifier = equipmentDefenseModifier(current.ai, zone);',
    "remove Reversal legacy Combo evaluator",
  ],
  [
    '    const piercingModifier = attackPiercingModifier(current.player, current.ai, card, zone, comboModifier.piercing);',
    '    const piercingModifier = attackPiercingModifier(current.player, current.ai, card, zone, preparedComboAttack.attackFacts.piercing);',
    "Reversal hosted piercing",
  ],
  [
    '    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cReversalBonus + (current.player.reversalAttackBonus ?? 0) + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);',
    '    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cReversalBonus + (current.player.reversalAttackBonus ?? 0) + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power);',
    "remove Reversal legacy Combo power",
  ],
  [
    '    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage + comboModifier.damage) : 0;',
    '    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage) : 0;',
    "remove Reversal legacy Combo damage",
  ],
  [
    'triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0,',
    'triggeredCombos: current.player.triggeredCombos, comboTriggered: current.player.comboTriggered,',
    "Reversal Combo state ownership",
  ],
  [
    '    if (hit && comboModifier.focusOnHit) nextPlayer = gainFocus(nextPlayer, comboModifier.focusOnHit);\n    if (comboModifier.speedOnTrigger) nextPlayer.tempSpeed += comboModifier.speedOnTrigger;\n',
    '',
    "remove Reversal legacy Combo payoff mutation",
  ],
  [
    '    nextPlayer = markCompletedTask(nextPlayer);\n    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...piercingModifier.notes, ...armorModifier.notes, ...postDefensePower.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...(reduced.note ? [reduced.note] : [])];',
    '    let hostedComboMatch: Match = { ...current, player: nextPlayer, ai: nextAi };\n    if (hit) hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "onHit", quickDuelHostOperations, { isReversal: true, currentAttackHit: true }).match;\n    hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "afterResolve", quickDuelHostOperations, { isReversal: true, currentAttackHit: hit, currentDefense: defenseCard, currentDefenseBlocked: Boolean(defenseCard && !hit) }).match;\n    nextPlayer = hostedComboMatch.player;\n    nextAi = hostedComboMatch.ai;\n    nextPlayer = markCompletedTask(nextPlayer);\n    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...piercingModifier.notes, ...armorModifier.notes, ...postDefensePower.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...(reduced.note ? [reduced.note] : [])];',
    "Reversal hosted onHit/afterResolve",
  ],
];

for (const [before, after, label] of replacements) reversal = replaceExactlyOnce(reversal, before, after, label);
if (/comboAttackModifier|comboModifier/.test(reversal)) throw new Error("Reversal still contains legacy Combo evaluator references");
source = source.slice(0, start) + reversal + source.slice(end);

if (/function comboAttackModifier\(|type ComboModifier\b/.test(source)) throw new Error("legacy Combo evaluator survived cleanup");
const evaluateComboCount = (source.match(/evaluateCombo\(/g) ?? []).length;
if (evaluateComboCount !== 1) throw new Error(`expected one display-only evaluateCombo call, found ${evaluateComboCount}`);

fs.writeFileSync(path, source);
console.log("Reconciled Reversal through the unified Quick Duel Combo host and removed the legacy Combo evaluator.");
