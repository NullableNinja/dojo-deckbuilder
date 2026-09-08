from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)

path = Path("app/playtest.tsx")
p = path.read_text()

p = replace_once(
    p,
    'import { armConsumableHideStatuses, resolveConsumableHideStatuses } from "./stage3c-consumable-hide-followup.ts";\n',
    'import { armConsumableHideStatuses, resolveConsumableHideStatuses } from "./stage3c-consumable-hide-followup.ts";\nimport { chooseAiDefensiveConsumable } from "./stage3c-consumable-reaction-ai.ts";\n',
    "ai reaction import",
)

p = replace_once(
    p,
    'function applyCardEffects(board: Board, card: CardEntry, owner: "player" | "ai", timing: "onPlay" | "onHit" | "onBlock" | "afterResolve" = "onPlay", familyContext: DefenseRuntimeContext | ConsumableRuntimeContext = {}) {\n  let next = { ...board };\n  const migratedFamily = isCoreDefenseCard(card) || isCoreConsumableCard(card);\n  if (timing === "onPlay") {\n    next = gainFocus(next, numberValue(card.focusValue));',
    'function applyCardEffects(board: Board, card: CardEntry, owner: "player" | "ai", timing: "onPlay" | "onHit" | "onBlock" | "afterResolve" = "onPlay", familyContext: DefenseRuntimeContext | ConsumableRuntimeContext = {}, grantPrintedFocus = true) {\n  let next = { ...board };\n  const migratedFamily = isCoreDefenseCard(card) || isCoreConsumableCard(card);\n  if (timing === "onPlay") {\n    if (grantPrintedFocus) next = gainFocus(next, numberValue(card.focusValue));',
    "printed focus gate",
)

best_defense_anchor = '''function bestDefense(board: Board, zone: string, attackPower = Number.POSITIVE_INFINITY, difficulty: Difficulty = "certified", location?: CardEntry, incomingAttack?: CardEntry, attacker?: Board, piercing = 0, armorPenalty = 0) {
  const options = legalDefenseIds(board, zone);'''
if best_defense_anchor not in p:
    raise SystemExit("missing anchor: bestDefense")
helper = '''function autoPlayAiDefensiveConsumable(board: Board, expectedIncomingDamage: number) {
  if (stage3cRestrictionBlocks(board.stage3cRestrictions, "consumable")) return { board, card: null as CardEntry | null, notes: [] as string[] };
  const candidates = board.hand.map(cardFor).filter((card): card is CardEntry => Boolean(card && isCoreConsumableCard(card)));
  const selected = chooseAiDefensiveConsumable(candidates, {
    ...stage3cConsumableContext(board),
    missingHp: Math.max(0, board.maxHp - board.hp),
    expectedIncomingDamage: Math.max(0, expectedIncomingDamage),
    friendlyTargetCount: 1,
    opponentTargetCount: 1,
  }) as CardEntry | null;
  if (!selected) return { board, card: null as CardEntry | null, notes: [] as string[] };

  const entry: Board = {
    ...board,
    hand: removeOne(board.hand, selected.id),
    playArea: [...board.playArea, selected.id],
  };
  let next = applyCardEffects(entry, selected, "ai", "onPlay", stage3cConsumableContext(entry), false);
  next = applyCardEffects(next, selected, "ai", "afterResolve", stage3cConsumableContext(next), false);
  next = { ...next, stage3cStatuses: armConsumableHideStatuses(armConsumableAttackFollowupStatuses(next.stage3cStatuses ?? [], selected), selected) };
  if (destroysAfterUse(selected)) next = destroyResolvedConsumable(next, selected);
  else if (returnsToSupplyAfterUse(selected)) next = returnResolvedConsumable(next, selected);
  return { board: next, card: selected, notes: [`${selected.name} is used as the computer's defensive Reaction`] };
}

'''
p = p.replace(best_defense_anchor, helper + best_defense_anchor, 1)

p = replace_once(
    p,
    '    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);\n    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);\n    const defenseId = bestDefense(aiIncomingReaction.board, zone, Math.max(0, baseAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value, armorPenalty);',
    '    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);\n    const aiConsumableReaction = autoPlayAiDefensiveConsumable(aiIncomingReaction.board, Math.max(0, baseAttackPower - fighterStat(aiIncomingReaction.board, "DEF")));\n    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);\n    const defenseId = bestDefense(aiConsumableReaction.board, zone, Math.max(0, baseAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value, armorPenalty);',
    "ai reaction before defense",
)

p = replace_once(
    p,
    '    const aiDefenseReaction = defenseCard ? autoActivateAiDefenseGuardEquipment(aiIncomingReaction.board) : { board: aiIncomingReaction.board, guard: 0, notes: [] as string[] };',
    '    const aiDefenseReaction = defenseCard ? autoActivateAiDefenseGuardEquipment(aiConsumableReaction.board) : { board: aiConsumableReaction.board, guard: 0, notes: [] as string[] };',
    "defense board after consumable",
)

p = replace_once(
    p,
    '...incomingModifier.notes, ...comboModifier.notes, ...armedEquipment.notes, ...aiIncomingReaction.notes, ...aiDefenseReaction.notes,',
    '...incomingModifier.notes, ...comboModifier.notes, ...armedEquipment.notes, ...aiIncomingReaction.notes, ...aiConsumableReaction.notes, ...aiDefenseReaction.notes,',
    "reaction combat notes",
)

p = replace_once(
    p,
    '    const supportEntryBoard = { ...supportBoard, hand: removeOne(supportBoard.hand, id), playArea: [...supportBoard.playArea, id], cardsThisTurn: [...supportBoard.cardsThisTurn, id], focus: supportBoard.focus + locationModifier.value, lastAttackHit: false };\n    let nextPlayer = markCompletedTask(applyCardEffects(supportEntryBoard, card, "player", "onPlay", isCoreConsumableCard(card) ? stage3cConsumableContext(supportEntryBoard) : {}));',
    '    const ownTurnPlay = current.phase === "player-yell";\n    const supportEntryBoard = { ...supportBoard, hand: removeOne(supportBoard.hand, id), playArea: [...supportBoard.playArea, id], cardsThisTurn: ownTurnPlay ? [...supportBoard.cardsThisTurn, id] : supportBoard.cardsThisTurn, focus: supportBoard.focus + (ownTurnPlay ? locationModifier.value : 0), lastAttackHit: false };\n    let nextPlayer = markCompletedTask(applyCardEffects(supportEntryBoard, card, "player", "onPlay", isCoreConsumableCard(card) ? stage3cConsumableContext(supportEntryBoard) : {}, ownTurnPlay));',
    "human reaction off-turn semantics",
)

p = replace_once(
    p,
    '    return write(current, `${card.name} played. ${choiceNote}${destroyedAfterUse ? " Destroyed after use; it will not enter your discard pile." : ""}${locationModifier.notes.length ? ` ${locationModifier.notes.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, pendingDiscard, pendingChoice });',
    '    return write(current, `${card.name} played. ${choiceNote}${destroyedAfterUse ? " Destroyed after use; it will not enter your discard pile." : ""}${ownTurnPlay && locationModifier.notes.length ? ` ${locationModifier.notes.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, pendingDiscard, pendingChoice });',
    "off-turn location focus note",
)

path.write_text(p)

integration = Path("tests/playtest-effect-integration.test.mjs")
i = integration.read_text()
if 'Quick Duel gives AI the same incoming-combat Consumable Reaction semantics without off-turn printed Focus' not in i:
    i += '''\n\ntest("Quick Duel gives AI the same incoming-combat Consumable Reaction semantics without off-turn printed Focus", async () => {\n  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");\n  assert.match(source, /chooseAiDefensiveConsumable\\(candidates/);\n  assert.match(source, /applyCardEffects\\(entry, selected, "ai", "onPlay", stage3cConsumableContext\\(entry\\), false\\)/);\n  assert.match(source, /const ownTurnPlay = current\\.phase === "player-yell"/);\n  assert.match(source, /cardsThisTurn: ownTurnPlay \\?/);\n  assert.match(source, /if \\(grantPrintedFocus\\) next = gainFocus/);\n  assert.match(source, /aiConsumableReaction\\.notes/);\n});\n'''
integration.write_text(i)
