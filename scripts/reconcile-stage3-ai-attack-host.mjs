import fs from "node:fs";

const path = "app/playtest.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceExactlyOnce(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return text.replace(before, after);
}

function sliceBetween(startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end <= start) throw new Error(`${label}: boundaries not found`);
  return { start, end, text: source.slice(start, end) };
}

const aiSlice = sliceBetween(
  "function openAiStrike(current: Match, cardId: string, remainingAiAttacks: string[], useTempo: boolean) {",
  "\nfunction finishAiTurn",
  "AI Attack declaration",
);
let aiAttack = aiSlice.text;

const aiReplacements = [
  [
    '  const zone = anyZone ? ["High", "Mid", "Low"][Math.floor(Math.random() * 3)] : card.zone?.split(",")[0] ?? "High";\n  const previousCard = current.ai.cardsThisTurn.length ? cardFor(current.ai.cardsThisTurn[current.ai.cardsThisTurn.length - 1]) : null;',
    '  const zone = anyZone ? ["High", "Mid", "Low"][Math.floor(Math.random() * 3)] : card.zone?.split(",")[0] ?? "High";\n  const preparedComboAttack = prepareQuickDuelPlaytestAttack(current, "ai", card, zone, cardFor, quickDuelHostOperations);\n  current = preparedComboAttack.match;\n  const previousCard = current.ai.cardsThisTurn.length ? cardFor(current.ai.cardsThisTurn[current.ai.cardsThisTurn.length - 1]) : null;',
    "AI Attack host preparation",
  ],
  [
    '  const incomingModifier = incomingAttackEquipmentModifier(current.player);\n  const comboModifier = comboAttackModifier(current.ai, card, zone);\n  const activeEquipment = autoActivateAiAttackEquipment(current.ai, zone);',
    '  const incomingModifier = incomingAttackEquipmentModifier(current.player);\n  const activeEquipment = autoActivateAiAttackEquipment(current.ai, zone);',
    "remove AI legacy Combo evaluator",
  ],
  [
    '  const piercingModifier = attackPiercingModifier(activeEquipment.board, current.player, card, zone, comboModifier.piercing + activeEquipment.piercing);',
    '  const piercingModifier = attackPiercingModifier(activeEquipment.board, current.player, card, zone, preparedComboAttack.attackFacts.piercing + activeEquipment.piercing);',
    "AI hosted piercing",
  ],
  [
    '  const hasFlow = attackHasFlow(activeEquipment.board, card, comboModifier, zone);',
    '  const hasFlow = attackHasFlow(activeEquipment.board, card, null, zone);',
    "AI hosted flow ownership",
  ],
  [
    '  const attackPower = Math.max(0, cardPower(card) + fighterStat(activeEquipment.board, "ATK") + activeEquipment.board.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + activeEquipment.power);',
    '  const attackPower = Math.max(0, cardPower(card) + fighterStat(activeEquipment.board, "ATK") + activeEquipment.board.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + activeEquipment.power);',
    "remove AI legacy Combo power",
  ],
  [
    'triggeredCombos: [...current.ai.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.ai.comboTriggered || comboModifier.triggeredIds.length > 0',
    'triggeredCombos: current.ai.triggeredCombos, comboTriggered: current.ai.comboTriggered',
    "AI Combo state ownership",
  ],
  [
    '  const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...activeEquipment.notes, ...piercingModifier.notes];',
    '  const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...activeEquipment.notes, ...piercingModifier.notes];',
    "remove AI legacy Combo notes",
  ],
  [
    'damageModifier: locationModifier.damage + fighterModifier.damage + comboModifier.damage,',
    'damageModifier: locationModifier.damage + fighterModifier.damage,',
    "remove AI legacy Combo damage",
  ],
];

for (const [before, after, label] of aiReplacements) aiAttack = replaceExactlyOnce(aiAttack, before, after, label);
if (/comboAttackModifier|comboModifier/.test(aiAttack)) throw new Error("AI Attack declaration still contains legacy Combo evaluator references");
source = source.slice(0, aiSlice.start) + aiAttack + source.slice(aiSlice.end);

const defenseStartMarker = "  const resolveDefenseState = (current: Match, defenseId: string | null";
const defenseEndMarker = "\n  const resolveDefense =";
const defenseStart = source.indexOf(defenseStartMarker);
const defenseEnd = source.indexOf(defenseEndMarker, defenseStart + defenseStartMarker.length);
if (defenseStart < 0 || defenseEnd <= defenseStart) throw new Error("Defense resolution boundaries not found");
let defenseResolution = source.slice(defenseStart, defenseEnd);

defenseResolution = replaceExactlyOnce(
  defenseResolution,
  '    const modifiers = [...(pending.modifierNotes ?? []), ...(defenseCard ? [`${defenseCard.name} +${cardPower(defenseCard)} Guard`] : []), ...(exhaustedPiercingBonus ? [`Exhausted Equipment adds Piercing ${exhaustedPiercingBonus}`] : []), ...((current.player.equipmentDefenseGuard ?? 0) ? [`Equipment reaction +${current.player.equipmentDefenseGuard} Guard`] : []), ...(reversalEquipmentBonus ? [`Block primes Reversal +${reversalEquipmentBonus} Attack Power`] : []), ...armorModifier.notes, ...defenseCardModifier.notes, ...locationModifier.notes, ...postDefensePower.notes, ...targetDebuff.notes, ...aiCycleNotes, ...aiTriggeredEquipment.notes, ...aiConsumableAttackFollowup.notes, ...(reduced.note ? [reduced.note] : []), ...preventionNotes];',
  '    let hostedComboMatch: Match = { ...current, player: nextPlayer, ai: nextAi };\n    if (hit) hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "ai", aiCard, pending.zone, cardFor, "onHit", quickDuelHostOperations, { currentAttackHit: true }).match;\n    hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "ai", aiCard, pending.zone, cardFor, "afterResolve", quickDuelHostOperations, { currentAttackHit: hit, currentDefense: defenseCard, currentDefenseBlocked: Boolean(defenseCard && !hit) }).match;\n    nextPlayer = hostedComboMatch.player;\n    nextAi = hostedComboMatch.ai;\n    const modifiers = [...(pending.modifierNotes ?? []), ...(defenseCard ? [`${defenseCard.name} +${cardPower(defenseCard)} Guard`] : []), ...(exhaustedPiercingBonus ? [`Exhausted Equipment adds Piercing ${exhaustedPiercingBonus}`] : []), ...((current.player.equipmentDefenseGuard ?? 0) ? [`Equipment reaction +${current.player.equipmentDefenseGuard} Guard`] : []), ...(reversalEquipmentBonus ? [`Block primes Reversal +${reversalEquipmentBonus} Attack Power`] : []), ...armorModifier.notes, ...defenseCardModifier.notes, ...locationModifier.notes, ...postDefensePower.notes, ...targetDebuff.notes, ...aiCycleNotes, ...aiTriggeredEquipment.notes, ...aiConsumableAttackFollowup.notes, ...(reduced.note ? [reduced.note] : []), ...preventionNotes];',
  "AI hosted onHit/afterResolve",
);

source = source.slice(0, defenseStart) + defenseResolution + source.slice(defenseEnd);
fs.writeFileSync(path, source);
console.log("Reconciled AI Attack through the unified Quick Duel Combo host.");
