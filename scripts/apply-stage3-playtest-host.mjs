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
  "Reversal declaration host",
  `    const zone = attackHasFlexibleZone(current.player, card) ? current.selectedZone : card.zone?.split(",")[0] ?? "High";
    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;`,
  `    const zone = attackHasFlexibleZone(current.player, card) ? current.selectedZone : card.zone?.split(",")[0] ?? "High";
    const preparedComboAttack = prepareQuickDuelPlaytestAttack(current, "player", card, zone, cardFor, quickDuelHostOperations, { isReversal: true });
    current = preparedComboAttack.match;
    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;`,
);

replaceOnce(
  "remove Reversal legacy Combo evaluator",
  '    const comboModifier = comboAttackModifier(current.player, card, zone, true);\n',
  '',
);
replaceOnce(
  "Reversal canonical Combo piercing",
  '    const piercingModifier = attackPiercingModifier(current.player, current.ai, card, zone, comboModifier.piercing);',
  '    const piercingModifier = attackPiercingModifier(current.player, current.ai, card, zone, preparedComboAttack.attackFacts.piercing);',
);
replaceOnce(
  "Reversal canonical Combo Attack Power",
  '    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cReversalBonus + (current.player.reversalAttackBonus ?? 0) + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);',
  '    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cReversalBonus + (current.player.reversalAttackBonus ?? 0) + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power);',
);
replaceOnce(
  "Reversal canonical Combo damage",
  '    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage + comboModifier.damage) : 0;',
  '    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage) : 0;',
);
replaceOnce(
  "Reversal canonical Combo activation markers",
  'triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0',
  'triggeredCombos: current.player.triggeredCombos, comboTriggered: current.player.comboTriggered',
);
replaceOnce(
  "remove Reversal legacy Combo hit payoff",
  `    nextPlayer.focus = Math.max(0, nextPlayer.focus - cardFocus(card));
    if (hit && comboModifier.focusOnHit) nextPlayer = gainFocus(nextPlayer, comboModifier.focusOnHit);
    if (comboModifier.speedOnTrigger) nextPlayer.tempSpeed += comboModifier.speedOnTrigger;`,
  `    nextPlayer.focus = Math.max(0, nextPlayer.focus - cardFocus(card));`,
);
replaceOnce(
  "Reversal Combo post-combat event host",
  `    const aiPostBlock = !hit && defenseCard ? autoTriggerAiPostBlockEquipment(nextAi, zone) : { board: nextAi, notes: [] as string[] };
    nextAi = aiPostBlock.board;
    nextPlayer = markCompletedTask(nextPlayer);
    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...piercingModifier.notes, ...armorModifier.notes, ...postDefensePower.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...(reduced.note ? [reduced.note] : [])];`,
  `    const aiPostBlock = !hit && defenseCard ? autoTriggerAiPostBlockEquipment(nextAi, zone) : { board: nextAi, notes: [] as string[] };
    nextAi = aiPostBlock.board;
    let hostedComboMatch: Match = { ...current, player: nextPlayer, ai: nextAi };
    if (hit) hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "onHit", quickDuelHostOperations, { isReversal: true, currentAttackHit: true }).match;
    hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "afterResolve", quickDuelHostOperations, { isReversal: true, currentAttackHit: hit, currentDefense: defenseCard, currentDefenseBlocked: Boolean(defenseCard && !hit) }).match;
    nextPlayer = hostedComboMatch.player;
    nextAi = hostedComboMatch.ai;
    nextPlayer = markCompletedTask(nextPlayer);
    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...piercingModifier.notes, ...armorModifier.notes, ...postDefensePower.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...(reduced.note ? [reduced.note] : [])];`,
);

replaceOnce(
  "remove obsolete Combo Attack evaluator",
  `type ComboModifier = AttackModifier & { focusOnHit: number; grantsFlow: boolean; speedOnTrigger: number; piercing: number; triggeredIds: string[] };

function comboAttackModifier(board: Board, card: CardEntry, zone: string, isReversal = false): ComboModifier {
  const result: ComboModifier = { power: 0, damage: 0, focusOnHit: 0, grantsFlow: false, speedOnTrigger: 0, piercing: 0, triggeredIds: [], notes: [] };
  const priorCards = board.cardsThisTurn.map(cardFor).filter(Boolean) as CardEntry[];
  const equipment = board.equipment.map(cardFor).filter(Boolean) as CardEntry[];
  for (const comboId of board.learnedCombos) {
    if (board.triggeredCombos.includes(comboId)) continue;
    const combo = cardFor(comboId);
    if (!combo) continue;
    const evaluation = evaluateCombo(combo, {
      priorCards,
      attacksThisTurn: board.attacksThisTurn,
      defendedThisRound: board.defendedThisRound,
      hitThisTurn: board.hitThisTurn,
      zonesPlayed: board.zonesPlayed,
      equipment,
      currentCard: card,
      currentZone: zone,
      isReversal,
    });
    if (!evaluation.eligible) continue;
    result.power += evaluation.power;
    result.damage += evaluation.damage;
    result.focusOnHit += evaluation.focusOnHit;
    result.grantsFlow ||= evaluation.grantsFlow;
    result.speedOnTrigger += evaluation.speedOnTrigger;
    result.piercing += evaluation.piercing;
    result.triggeredIds.push(combo.id);
    const payoffBits = [evaluation.power ? \`+\${evaluation.power} power\` : "", evaluation.damage ? \`+\${evaluation.damage} damage\` : "", evaluation.grantsFlow ? "Flow" : "", evaluation.focusOnHit ? \`\${evaluation.focusOnHit} Focus on Hit\` : "", evaluation.speedOnTrigger ? \`+\${evaluation.speedOnTrigger} Speed\` : "", evaluation.piercing ? \`Piercing \${evaluation.piercing}\` : ""].filter(Boolean);
    result.notes.push(\`COMBO — \${combo.name}: \${payoffBits.join(", ")}\`);
  }
  return result;
}

`,
  '',
);

replaceOnce(
  "simplify Flow helper signature",
  'function attackHasFlow(board: Board, card: CardEntry, combo: ComboModifier | null, zone = card.zone?.split(",")[0] ?? "High", isReversal = false) {',
  'function attackHasFlow(board: Board, card: CardEntry, zone = card.zone?.split(",")[0] ?? "High", isReversal = false) {',
);
replaceOnce(
  "remove legacy Combo Flow input",
  '  if (board.nextAttackHasFlow || combo?.grantsFlow || stage3cAttackFlow(board, card, zone, isReversal)) return true;',
  '  if (board.nextAttackHasFlow || stage3cAttackFlow(board, card, zone, isReversal)) return true;',
);
replaceOnce(
  "simplify player Flow call",
  '    const hasFlow = attackHasFlow(current.player, card, null, zone);',
  '    const hasFlow = attackHasFlow(current.player, card, zone);',
);
replaceOnce(
  "simplify AI Flow call",
  '  const hasFlow = attackHasFlow(activeEquipment.board, card, null, zone);',
  '  const hasFlow = attackHasFlow(activeEquipment.board, card, zone);',
);

const reversalStart = source.indexOf('  const resolveReversal = () => setMatch((current) => {');
const reversalEnd = source.indexOf('\n  const useHandCard =', reversalStart);
if (reversalStart < 0 || reversalEnd < 0) throw new Error("Reversal function boundaries were not found after migration");
const reversalSource = source.slice(reversalStart, reversalEnd);
if (reversalSource.includes("comboAttackModifier") || reversalSource.includes("comboModifier")) throw new Error("Reversal still contains legacy Combo gameplay authority");
if (!reversalSource.includes('prepareQuickDuelPlaytestAttack(current, "player", card, zone, cardFor, quickDuelHostOperations, { isReversal: true })')) throw new Error("Reversal declaration host was not installed");
if (!reversalSource.includes('hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "onHit", quickDuelHostOperations, { isReversal: true')) throw new Error("Reversal onHit host was not installed");
if (!reversalSource.includes('hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "afterResolve", quickDuelHostOperations, { isReversal: true')) throw new Error("Reversal afterResolve host was not installed");

if (source.includes("function comboAttackModifier(")) throw new Error("legacy Combo Attack evaluator function survived migration");
if (source.includes("type ComboModifier")) throw new Error("legacy ComboModifier type survived migration");
if ((source.match(/comboAttackModifier\(/g) ?? []).length !== 0) throw new Error("legacy Combo Attack call survived migration");
const evaluateComboCalls = source.match(/evaluateCombo\(/g) ?? [];
if (evaluateComboCalls.length !== 1) throw new Error(`evaluateCombo must remain display-only after migration; found ${evaluateComboCalls.length} calls`);
const learnedComboDisplay = source.indexOf("const learnedComboStates = player.learnedCombos.map");
const remainingEvaluateCombo = source.indexOf("evaluateCombo(");
if (learnedComboDisplay < 0 || remainingEvaluateCombo < learnedComboDisplay) throw new Error("remaining evaluateCombo call is not confined to Learned Combo display state");

await writeFile(path, source);
console.log("Applied guarded Stage 3 Reversal Combo-host migration and removed the legacy Combo Attack evaluator.");
