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
  "AI Attack declaration host",
  `  const anyZone = attackHasFlexibleZone(current.ai, card);
  const zone = anyZone ? ["High", "Mid", "Low"][Math.floor(Math.random() * 3)] : card.zone?.split(",")[0] ?? "High";
  const previousCard = current.ai.cardsThisTurn.length ? cardFor(current.ai.cardsThisTurn[current.ai.cardsThisTurn.length - 1]) : null;`,
  `  const anyZone = attackHasFlexibleZone(current.ai, card);
  const zone = anyZone ? ["High", "Mid", "Low"][Math.floor(Math.random() * 3)] : card.zone?.split(",")[0] ?? "High";
  const preparedComboAttack = prepareQuickDuelPlaytestAttack(current, "ai", card, zone, cardFor, quickDuelHostOperations);
  current = preparedComboAttack.match;
  const previousCard = current.ai.cardsThisTurn.length ? cardFor(current.ai.cardsThisTurn[current.ai.cardsThisTurn.length - 1]) : null;`,
);

replaceOnce(
  "remove AI legacy Combo evaluator",
  '  const comboModifier = comboAttackModifier(current.ai, card, zone);\n',
  '',
);
replaceOnce(
  "AI canonical Combo piercing",
  '  const piercingModifier = attackPiercingModifier(activeEquipment.board, current.player, card, zone, comboModifier.piercing + activeEquipment.piercing);',
  '  const piercingModifier = attackPiercingModifier(activeEquipment.board, current.player, card, zone, preparedComboAttack.attackFacts.piercing + activeEquipment.piercing);',
);
replaceOnce(
  "AI canonical Combo Flow",
  '  const hasFlow = attackHasFlow(activeEquipment.board, card, comboModifier, zone);',
  '  const hasFlow = attackHasFlow(activeEquipment.board, card, null, zone);',
);
replaceOnce(
  "AI canonical Combo Attack Power",
  '  const attackPower = Math.max(0, cardPower(card) + fighterStat(activeEquipment.board, "ATK") + activeEquipment.board.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + activeEquipment.power);',
  '  const attackPower = Math.max(0, cardPower(card) + fighterStat(activeEquipment.board, "ATK") + activeEquipment.board.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + activeEquipment.power);',
);
replaceOnce(
  "AI canonical Combo activation markers",
  'triggeredCombos: [...current.ai.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.ai.comboTriggered || comboModifier.triggeredIds.length > 0',
  'triggeredCombos: current.ai.triggeredCombos, comboTriggered: current.ai.comboTriggered',
);
replaceOnce(
  "AI canonical Combo declaration notes",
  '  const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...activeEquipment.notes, ...piercingModifier.notes];',
  '  const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...activeEquipment.notes, ...piercingModifier.notes];',
);
replaceOnce(
  "AI canonical Combo pending damage",
  'damageModifier: locationModifier.damage + fighterModifier.damage + comboModifier.damage,',
  'damageModifier: locationModifier.damage + fighterModifier.damage,',
);

replaceOnce(
  "AI Combo post-combat event host",
  `    if (defenseCard) {
      if (!hit) {
        const familyDefenseContext = stage3cDefenseContext(nextPlayer, current.ai, defenseCard, aiCard, pending.zone, finalAttackPower, rawDamage, true);
        nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onBlock", familyDefenseContext);
        nextAi = applyStage3CTiming(nextAi, defenseCard, "onBlock", "ai", familyDefenseContext, "opponent");
        blockDiscardChoice = playerDiscardChoiceCount(defenseCard, "onBlock");
      }
      const familyDefenseContext = stage3cDefenseContext(nextPlayer, current.ai, defenseCard, aiCard, pending.zone, finalAttackPower, rawDamage, !hit);
      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "afterResolve", familyDefenseContext);
      nextAi = applyStage3CTiming(nextAi, defenseCard, "afterResolve", "ai", familyDefenseContext, "opponent");
    }
    const modifiers = [...(pending.modifierNotes ?? []),`,
  `    if (defenseCard) {
      if (!hit) {
        const familyDefenseContext = stage3cDefenseContext(nextPlayer, current.ai, defenseCard, aiCard, pending.zone, finalAttackPower, rawDamage, true);
        nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onBlock", familyDefenseContext);
        nextAi = applyStage3CTiming(nextAi, defenseCard, "onBlock", "ai", familyDefenseContext, "opponent");
        blockDiscardChoice = playerDiscardChoiceCount(defenseCard, "onBlock");
      }
      const familyDefenseContext = stage3cDefenseContext(nextPlayer, current.ai, defenseCard, aiCard, pending.zone, finalAttackPower, rawDamage, !hit);
      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "afterResolve", familyDefenseContext);
      nextAi = applyStage3CTiming(nextAi, defenseCard, "afterResolve", "ai", familyDefenseContext, "opponent");
    }
    let hostedComboMatch: Match = { ...current, player: nextPlayer, ai: nextAi };
    if (hit) hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "ai", aiCard, pending.zone, cardFor, "onHit", quickDuelHostOperations, { currentAttackHit: true }).match;
    hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "ai", aiCard, pending.zone, cardFor, "afterResolve", quickDuelHostOperations, { currentAttackHit: hit, currentDefense: defenseCard, currentDefenseBlocked: Boolean(defenseCard && !hit) }).match;
    nextPlayer = hostedComboMatch.player;
    nextAi = hostedComboMatch.ai;
    const modifiers = [...(pending.modifierNotes ?? []),`,
);

const aiAttackStart = source.indexOf("function openAiStrike(current: Match, cardId: string, remainingAiAttacks: string[], useTempo: boolean) {");
const aiAttackEnd = source.indexOf("\nfunction ", aiAttackStart + 10);
if (aiAttackStart < 0 || aiAttackEnd < 0) throw new Error("AI Attack function boundaries were not found after migration");
const aiAttackSource = source.slice(aiAttackStart, aiAttackEnd);
if (aiAttackSource.includes("comboAttackModifier") || aiAttackSource.includes("comboModifier")) throw new Error("AI Attack still contains legacy Combo gameplay authority");
if (!aiAttackSource.includes('prepareQuickDuelPlaytestAttack(current, "ai", card, zone, cardFor, quickDuelHostOperations)')) throw new Error("AI Attack declaration host was not installed");

const defenseStart = source.indexOf("  const resolveDefenseState = (current: Match, defenseId: string | null");
const defenseEnd = source.indexOf("\n  const resolveDefense =", defenseStart);
if (defenseStart < 0 || defenseEnd < 0) throw new Error("Defense resolution boundaries were not found after migration");
const defenseSource = source.slice(defenseStart, defenseEnd);
if (!defenseSource.includes('hostQuickDuelPlaytestCardEvent(hostedComboMatch, "ai", aiCard, pending.zone, cardFor, "onHit"')) throw new Error("AI Attack onHit host was not installed");
if (!defenseSource.includes('hostQuickDuelPlaytestCardEvent(hostedComboMatch, "ai", aiCard, pending.zone, cardFor, "afterResolve"')) throw new Error("AI Attack afterResolve host was not installed");

const remainingLegacyAttackCalls = source.match(/comboAttackModifier\(current\./g) ?? [];
if (remainingLegacyAttackCalls.length !== 1) throw new Error(`expected exactly one legacy Combo Attack call after AI migration; found ${remainingLegacyAttackCalls.length}`);

await writeFile(path, source);
console.log("Applied guarded Stage 3 AI Attack Combo-host migration.");
