from pathlib import Path

path = Path('app/playtest.tsx')
source = path.read_text()


def replace_once(old: str, new: str, label: str):
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    source = source.replace(old, new, 1)


if 'STAGE3D_LOCATION_RUNTIME_FIXUP_V2' in source:
    print('Stage 3D runtime fixup V2 already applied.')
    raise SystemExit(0)

replace_once(
    'import { resolveLocationEvent, structuredLocationAttackModifiers, structuredLocationDefenseGuardModifier, structuredLocationEquipmentContributionModifier, structuredLocationHealingModifier, structuredLocationPurchaseCostModifier, structuredLocationKataFocusModifier, structuredLocationComboNumericModifier, type LocationCommand } from "./location-effect-resolvers";',
    'import { resolveLocationEvent, structuredLocationAttackModifiers, structuredLocationDefenseGuardModifier, structuredLocationEquipmentContributionModifier, structuredLocationHealingModifier, structuredLocationPurchaseCostModifier, structuredLocationKataFocusModifier, structuredLocationXpModifier, structuredLocationKoXpModifier, structuredLocationComboNumericModifier, type LocationCommand } from "./location-effect-resolvers";',
    'Location resolver imports',
)

replace_once(
    '  if (delta.draw) next = drawCards(next, delta.draw);\n  const delayedSpeed =',
    '  if (delta.draw) next = drawCards(next, delta.draw);\n  // STAGE3D_LOCATION_RUNTIME_FIXUP_V2 — persist event-time combat modifiers to the next legal use.\n  if (delta.attackPower) next = { ...next, nextAttackBonus: next.nextAttackBonus + delta.attackPower };\n  if (delta.guard) next = { ...next, nextDefenseCardBonus: (next.nextDefenseCardBonus ?? 0) + delta.guard };\n  const delayedSpeed =',
    'Immediate next Attack/Defense Location state',
)

replace_once(
    'function applyLocationBlock(board: Board) {\n  const location = locationForBoard(board);\n  if (!location) return board;\n  const commands = resolveLocationEvent(location, "block", { ...locationUsageFor(board) });\n  return applyLocationImmediate(board, commands, board.locationController ?? "ai");\n}',
    'function applyLocationBlock(board: Board, blockedZone: string) {\n  const location = locationForBoard(board);\n  if (!location) return board;\n  const commands = resolveLocationEvent(location, "block", { ...locationUsageFor(board), attackZone: blockedZone, incomingAttackZone: blockedZone, defenseZone: blockedZone, blockedAttackZone: blockedZone });\n  return applyLocationImmediate(board, commands, board.locationController ?? "ai");\n}',
    'Zone-aware Location Block event',
)
replace_once('applyLocationBlock(nextAi);', 'applyLocationBlock(nextAi, zone);', 'player Attack block hook')
replace_once('applyLocationBlock(nextPlayer);', 'applyLocationBlock(nextPlayer, pending.zone);', 'AI Attack block hook')
replace_once('applyLocationBlock(nextAi);', 'applyLocationBlock(nextAi, zone);', 'reversal block hook')

replace_once(
    'firstEquipmentExhaustThisRound: !board.locationEquipmentExhaustedThisRound, selfSpeed: fighterStat(board, "Speed") });',
    'firstEquipmentExhaustThisRound: !board.locationEquipmentExhaustedThisRound, selfSpeed: fighterStat(board, "Speed"), selfSpeedAtLeast: fighterStat(board, "Speed") });',
    'Speed threshold Location defense context',
)

replace_once(
    '''function locationHealingAmount(board: Board, baseAmount: number, source: CardEntry) {
  if (baseAmount <= 0) return baseAmount;
  const location = locationForBoard(board);
  if (!location) return baseAmount;
  const parsed = structuredLocationHealingModifier(location, { ...locationUsageFor(board), healingSourceAny: [source.cardType, source.subtype, ...source.tags], cardTypeAny: [source.cardType], cardSubtypeOrTagAny: [source.subtype, ...source.tags] });
  return Math.max(parsed.minimum, baseAmount + parsed.amount);
}''',
    '''function applyLocationHealing(board: Board, baseAmount: number, source: CardEntry) {
  if (baseAmount <= 0) return { board, amount: baseAmount };
  const location = locationForBoard(board);
  if (!location) return { board, amount: baseAmount };
  const parsed = structuredLocationHealingModifier(location, { ...locationUsageFor(board), healingSourceAny: [source.cardType, source.subtype, ...source.tags], cardTypeAny: [source.cardType], cardSubtypeOrTagAny: [source.subtype, ...source.tags] });
  return { board: markLocationCommandsUsed(board, parsed.commands), amount: Math.max(parsed.minimum, baseAmount + parsed.amount) };
}
function applyLocationXpBonus(board: Board, xpSource: "Attack" | "Defense" | "KO", isKoXp = false) {
  const location = locationForBoard(board);
  if (!location) return board;
  const normal = structuredLocationXpModifier(location, { ...locationUsageFor(board), xpSourceAny: [xpSource], isKoXp });
  const ko = isKoXp ? structuredLocationKoXpModifier(location, { ...locationUsageFor(board), xpSourceAny: [xpSource], isKoXp: true }) : { amount: 0, commands: [] as LocationCommand[] };
  const commands = [...normal.commands, ...ko.commands];
  return { ...markLocationCommandsUsed(board, commands), xp: Math.max(0, board.xp + normal.amount + ko.amount) };
}''',
    'Healing and XP Location helpers',
)

replace_once(
    'if (next.hp > hpBeforeFamily) next = { ...next, hp: Math.min(next.maxHp, hpBeforeFamily + locationHealingAmount(next, next.hp - hpBeforeFamily, card)) };',
    'if (next.hp > hpBeforeFamily) { const healed = applyLocationHealing(next, next.hp - hpBeforeFamily, card); next = { ...healed.board, hp: Math.min(next.maxHp, hpBeforeFamily + healed.amount) }; }',
    'Migrated-family healing',
)
replace_once(
    'if (effect.kind === "heal") next.hp = Math.min(next.maxHp, next.hp + locationHealingAmount(next, effect.amount, card));',
    'if (effect.kind === "heal") { const healed = applyLocationHealing(next, effect.amount, card); next = { ...healed.board, hp: Math.min(next.maxHp, next.hp + healed.amount) }; }',
    'Legacy-plan healing',
)

replace_once(
    'let nextPlayer = applyCardEffects({ ...attackState, completesActiveBeltExamThisAttack: completesActiveBeltExam }, card, "player");',
    'let nextPlayer = applyLocationXpBonus(applyCardEffects({ ...attackState, completesActiveBeltExamThisAttack: completesActiveBeltExam }, card, "player"), "Attack");',
    'Player Attack XP Location modifier',
)
replace_once(
    'let nextAi = applyCardEffects({ ...consumedAttackBoard, hand: removeOne(current.ai.hand, card.id), playArea: [...current.ai.playArea, card.id], xp: current.ai.xp + 1,',
    'let nextAi = applyLocationXpBonus(applyCardEffects({ ...consumedAttackBoard, hand: removeOne(current.ai.hand, card.id), playArea: [...current.ai.playArea, card.id], xp: current.ai.xp + 1,',
    'AI Attack XP wrapper start',
)
replace_once(
    'triggeredCombos: [...current.ai.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.ai.comboTriggered || comboModifier.triggeredIds.length > 0 }, card, "ai");\n  const flowDraw =',
    'triggeredCombos: [...current.ai.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.ai.comboTriggered || comboModifier.triggeredIds.length > 0 }, card, "ai"), "Attack");\n  const flowDraw =',
    'AI Attack XP wrapper end',
)
replace_once(
    'nextPlayer = stage3cConsumeDefenseStatuses(markCompletedTask({ ...markLocationCommandsUsed(nextPlayer, locationModifier.locationCommands ?? []), hand: removeOne(nextPlayer.hand, defenseCard.id), discard: [...nextPlayer.discard, defenseCard.id], xp: nextPlayer.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, nextDefenseCardBonus: 0, tempo: tempoBonus ? false : nextPlayer.tempo }));',
    'nextPlayer = applyLocationXpBonus(stage3cConsumeDefenseStatuses(markCompletedTask({ ...markLocationCommandsUsed(nextPlayer, locationModifier.locationCommands ?? []), hand: removeOne(nextPlayer.hand, defenseCard.id), discard: [...nextPlayer.discard, defenseCard.id], xp: nextPlayer.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, nextDefenseCardBonus: 0, tempo: tempoBonus ? false : nextPlayer.tempo })), "Defense");',
    'Player Defense XP Location modifier',
)
replace_once(
    'if (defenseCard) nextAi = { ...markLocationCommandsUsed(nextAi, defenseModifier.locationCommands ?? []), hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, blockedSinceLastTurn: !hit || Boolean(nextAi.blockedSinceLastTurn), blockedThisRound: !hit || Boolean(nextAi.blockedThisRound), nextDefenseCardBonus: 0 };',
    'if (defenseCard) nextAi = applyLocationXpBonus({ ...markLocationCommandsUsed(nextAi, defenseModifier.locationCommands ?? []), hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, blockedSinceLastTurn: !hit || Boolean(nextAi.blockedSinceLastTurn), blockedThisRound: !hit || Boolean(nextAi.blockedThisRound), nextDefenseCardBonus: 0 }, "Defense");',
    'AI Defense XP Location modifier',
)
replace_once(
    'if (!nextAi.hp) nextPlayer.xp += 2;',
    'if (!nextAi.hp) nextPlayer = applyLocationXpBonus({ ...nextPlayer, xp: nextPlayer.xp + 2 }, "KO", true);',
    'Player KO XP Location modifier',
)
replace_once(
    'if (!nextPlayer.hp) nextAi = { ...nextAi, xp: nextAi.xp + 2 };',
    'if (!nextPlayer.hp) nextAi = applyLocationXpBonus({ ...nextAi, xp: nextAi.xp + 2 }, "KO", true);',
    'AI KO XP Location modifier',
)

path.write_text(source)
print('Applied Stage 3D runtime fixup V2.')
