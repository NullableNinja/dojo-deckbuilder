from pathlib import Path

root = Path('.')
resolver_path = root / 'app/effect-resolvers.ts'
resolver = resolver_path.read_text()
if 'export function firstIncomingAttackPowerPenalty' not in resolver:
    resolver += r'''

export function firstIncomingAttackPowerPenalty(cards: EffectCardLike[], isFirstIncomingAttack: boolean) {
  if (!isFirstIncomingAttack) return { amount: 0, sources: [] as string[] };
  let amount = 0;
  const sources: string[] = [];
  for (const card of cards) {
    const text = normalizedMinus(String(card.rulesText ?? ""));
    const match = text.match(/The first Attack targeting you each round gets -(\d+) Attack Power/i);
    if (!match) continue;
    amount -= Number(match[1]);
    sources.push(card.name ?? "Equipment");
  }
  return { amount, sources };
}

export function targetNextDefensePenalty(card: EffectCardLike) {
  const text = normalizedMinus(String(card.rulesText ?? ""));
  const match = text.match(/(?:Their|target[’']s|opponent[’']s) next Defense card(?: this round)? (?:gets|has|provides) -(\d+) (?:Guard|Defense)/i);
  return match ? Number(match[1]) : 0;
}
'''
resolver_path.write_text(resolver)

playtest_path = root / 'app/playtest.tsx'
playtest = playtest_path.read_text()
old_import = 'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, equipmentConditionalAttackPowerBonus, equipmentSpeedModifier, locationAttackRuleModifiers, optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty, targetSpeedPenaltyUntilHonor } from "./effect-resolvers";'
new_import = 'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, equipmentConditionalAttackPowerBonus, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor } from "./effect-resolvers";'
if old_import not in playtest: raise SystemExit('resolver import anchor missing')
playtest = playtest.replace(old_import, new_import, 1)

# These are optional so existing schema-6 saves remain valid.
if 'attacksReceivedThisRound?: number;' not in playtest:
    playtest = playtest.replace('  attacksThisTurn: number;\n', '  attacksThisTurn: number;\n  attacksReceivedThisRound?: number;\n  nextDefenseCardBonus?: number;\n', 1)

# Reusable incoming-attack modifier.
anchor = 'function equipmentDefenseModifier(board: Board, zone: string): CombatModifier {'
helper = r'''function incomingAttackEquipmentModifier(defender: Board): AttackModifier {
  const equipped = defender.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card));
  const parsed = firstIncomingAttackPowerPenalty(equipped, (defender.attacksReceivedThisRound ?? 0) === 0);
  return {
    power: parsed.amount,
    damage: 0,
    notes: parsed.amount ? [`${parsed.sources.join(" + ")} ${parsed.amount} Attack Power on first incoming Attack`] : [],
  };
}

'''
if 'function incomingAttackEquipmentModifier(' not in playtest:
    if anchor not in playtest: raise SystemExit('equipmentDefenseModifier anchor missing')
    playtest = playtest.replace(anchor, helper + anchor, 1)

# Target hit debuffs now include printed next-Defense penalties.
old_debuff = '''  const attackPenalty = targetNextAttackPenalty(card);\n  const speedPenalty = targetSpeedPenaltyUntilHonor(card);\n  const notes: string[] = [];\n  let next = board;'''
new_debuff = '''  const attackPenalty = targetNextAttackPenalty(card);\n  const defensePenalty = targetNextDefensePenalty(card);\n  const speedPenalty = targetSpeedPenaltyUntilHonor(card);\n  const notes: string[] = [];\n  let next = board;'''
if old_debuff not in playtest: raise SystemExit('target debuff declaration missing')
playtest = playtest.replace(old_debuff, new_debuff, 1)
old_speed = '''  if (speedPenalty) {\n    next = { ...next, tempSpeed: next.tempSpeed - speedPenalty };\n    notes.push(`target -${speedPenalty} Speed until Honor`);\n  }'''
new_speed = '''  if (defensePenalty) {\n    next = { ...next, nextDefenseCardBonus: (next.nextDefenseCardBonus ?? 0) - defensePenalty };\n    notes.push(`target next Defense card -${defensePenalty} Guard`);\n  }\n  if (speedPenalty) {\n    next = { ...next, tempSpeed: next.tempSpeed - speedPenalty };\n    notes.push(`target -${speedPenalty} Speed until Honor`);\n  }'''
if old_speed not in playtest: raise SystemExit('speed debuff block missing')
playtest = playtest.replace(old_speed, new_speed, 1)

# Initial board state.
init_anchor = 'tempSpeed: 0, nextAttackBonus: 0, attacksThisTurn: 0, defensePracticeUsed: false'
if 'attacksReceivedThisRound: 0' not in playtest:
    playtest = playtest.replace(init_anchor, 'tempSpeed: 0, nextAttackBonus: 0, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false', 1)

# AI defense selection knows the pending next-Defense penalty.
old_best_total = 'return { id, total: fighterStat(board, "DEF") + equipmentDefenseModifier(board, zone).value + cardPower(card) + printed + modifier };'
new_best_total = 'return { id, total: fighterStat(board, "DEF") + equipmentDefenseModifier(board, zone).value + cardPower(card) + (board.nextDefenseCardBonus ?? 0) + printed + modifier };'
if old_best_total not in playtest: raise SystemExit('bestDefense total missing')
playtest = playtest.replace(old_best_total, new_best_total, 1)

# Normal player Attack: first-incoming Equipment modifies AP, not damage.
old_normal_mod = '''    const fighterModifier = fighterAttackModifier(current.player, current.ai, card);\n    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card);\n    const comboModifier = comboAttackModifier(current.player, card, zone);'''
new_normal_mod = '''    const fighterModifier = fighterAttackModifier(current.player, current.ai, card);\n    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card);\n    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const comboModifier = comboAttackModifier(current.player, card, zone);'''
if old_normal_mod not in playtest: raise SystemExit('normal attack modifier block missing')
playtest = playtest.replace(old_normal_mod, new_normal_mod, 1)
playtest = playtest.replace(' + fighterModifier.power + printedModifier.power + comboModifier.power);', ' + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);', 1)
# Defense-card penalty is part of the actual Guard calculation.
old_normal_def = 'const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) : 0) + defenseCardModifier.value + defenseModifier.value);'
new_normal_def = 'const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (current.ai.nextDefenseCardBonus ?? 0) : 0) + defenseCardModifier.value + defenseModifier.value);'
if old_normal_def not in playtest: raise SystemExit('normal defense power missing')
playtest = playtest.replace(old_normal_def, new_normal_def, 1)
old_next_ai = 'let nextAi = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit, damageTaken: reduced.board.damageTaken + damage };'
new_next_ai = 'let nextAi = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), attacksReceivedThisRound: (reduced.board.attacksReceivedThisRound ?? 0) + 1, wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit, damageTaken: reduced.board.damageTaken + damage };'
if old_next_ai not in playtest: raise SystemExit('normal nextAi missing')
playtest = playtest.replace(old_next_ai, new_next_ai, 1)
old_normal_defcard = 'if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true };'
new_normal_defcard = 'if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, nextDefenseCardBonus: 0 };'
if old_normal_defcard not in playtest: raise SystemExit('normal defense card consume missing')
playtest = playtest.replace(old_normal_defcard, new_normal_defcard, 1)
playtest = playtest.replace('...printedModifier.notes, ...comboModifier.notes', '...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes', 1)

# Player support effects can prime the opponent's next Defense.
old_support_write = '''    const pendingChoice: PendingChoice | null = !pendingDiscard && junkCount && hasJunk ? { kind: "destroy-junk", sourceCardId: id, remaining: junkCount } : null;\n    return write(current, `${card.name} played.'''
new_support_write = '''    const pendingChoice: PendingChoice | null = !pendingDiscard && junkCount && hasJunk ? { kind: "destroy-junk", sourceCardId: id, remaining: junkCount } : null;\n    const defensePenalty = targetNextDefensePenalty(card);\n    const nextAi = defensePenalty ? { ...current.ai, nextDefenseCardBonus: (current.ai.nextDefenseCardBonus ?? 0) - defensePenalty } : current.ai;\n    return write(current, `${card.name} played.'''
if old_support_write not in playtest: raise SystemExit('support pending choice anchor missing')
playtest = playtest.replace(old_support_write, new_support_write, 1)
old_support_state = '{ player: nextPlayer, pendingDiscard, pendingChoice });'
new_support_state = '{ player: nextPlayer, ai: nextAi, pendingDiscard, pendingChoice });'
if old_support_state not in playtest: raise SystemExit('support write state missing')
playtest = playtest.replace(old_support_state, new_support_state, 1)

# Player Defense Window applies and consumes the next-Defense modifier.
old_def_power = 'defensePower += cardPower(defenseCard) + defenseCardModifier.value + tempoBonus + locationModifier.value;'
new_def_power = 'defensePower += cardPower(defenseCard) + (nextPlayer.nextDefenseCardBonus ?? 0) + defenseCardModifier.value + tempoBonus + locationModifier.value;'
if old_def_power not in playtest: raise SystemExit('player defense power line missing')
playtest = playtest.replace(old_def_power, new_def_power, 1)
old_def_state = 'discard: [...nextPlayer.discard, defenseCard.id], xp: nextPlayer.xp + 1, defendedThisRound: true, tempo: tempoBonus ? false : nextPlayer.tempo'
new_def_state = 'discard: [...nextPlayer.discard, defenseCard.id], xp: nextPlayer.xp + 1, defendedThisRound: true, nextDefenseCardBonus: 0, tempo: tempoBonus ? false : nextPlayer.tempo'
if old_def_state not in playtest: raise SystemExit('player defense state missing')
playtest = playtest.replace(old_def_state, new_def_state, 1)

# AI declares an Attack: apply defender first-incoming protection and mark the attack received immediately.
old_ai_combo = '''  const printedModifier = printedAttackRuleModifier(current.ai, current.player, card);\n  const comboModifier = comboAttackModifier(current.ai, card, zone);'''
new_ai_combo = '''  const printedModifier = printedAttackRuleModifier(current.ai, current.player, card);\n  const incomingModifier = incomingAttackEquipmentModifier(current.player);\n  const comboModifier = comboAttackModifier(current.ai, card, zone);'''
if old_ai_combo not in playtest: raise SystemExit('AI modifier block missing')
playtest = playtest.replace(old_ai_combo, new_ai_combo, 1)
# second AP occurrence now belongs to AI.
playtest = playtest.replace(' + fighterModifier.power + printedModifier.power + comboModifier.power);', ' + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);', 1)
old_ai_notes = 'const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...comboModifier.notes];'
new_ai_notes = 'const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes];'
if old_ai_notes not in playtest: raise SystemExit('AI modifier notes missing')
playtest = playtest.replace(old_ai_notes, new_ai_notes, 1)
old_ai_return = 'return { ...current, ai: nextAi, phase: "defense-window" as const, pendingStrike:'
new_ai_return = 'return { ...current, player: { ...current.player, attacksReceivedThisRound: (current.player.attacksReceivedThisRound ?? 0) + 1 }, ai: nextAi, phase: "defense-window" as const, pendingStrike:'
if old_ai_return not in playtest: raise SystemExit('openAiStrike return missing')
playtest = playtest.replace(old_ai_return, new_ai_return, 1)

# AI support cards can prime the player's next Defense.
old_prepare = '  const played: string[] = [];\n  for (const id of supportIds) {'
new_prepare = '  const played: string[] = [];\n  let nextPlayer = current.player;\n  for (const id of supportIds) {'
if old_prepare not in playtest: raise SystemExit('prepareAiTurn loop anchor missing')
playtest = playtest.replace(old_prepare, new_prepare, 1)
old_played = '    if (destroysAfterUse(card)) nextAi = destroyResolvedConsumable(nextAi, card);\n    played.push(card.name);'
new_played = '    if (destroysAfterUse(card)) nextAi = destroyResolvedConsumable(nextAi, card);\n    const defensePenalty = targetNextDefensePenalty(card);\n    if (defensePenalty) nextPlayer = { ...nextPlayer, nextDefenseCardBonus: (nextPlayer.nextDefenseCardBonus ?? 0) - defensePenalty };\n    played.push(card.name);'
if old_played not in playtest: raise SystemExit('AI support card tail missing')
playtest = playtest.replace(old_played, new_played, 1)
old_prepare_return = 'return { ...current, ai: nextAi, log: [`Computer prepares with ${preparations.join(", ")}. The strategy is now technically documented.`, ...current.log].slice(0, 32) };'
new_prepare_return = 'return { ...current, player: nextPlayer, ai: nextAi, log: [`Computer prepares with ${preparations.join(", ")}. The strategy is now technically documented.`, ...current.log].slice(0, 32) };'
if old_prepare_return not in playtest: raise SystemExit('prepareAiTurn return missing')
playtest = playtest.replace(old_prepare_return, new_prepare_return, 1)

# Reversal Attack receives the same defender Equipment modifier and Defense penalty handling.
old_rev_combo = '''    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card);\n    const comboModifier = comboAttackModifier(current.player, card, zone, true);'''
new_rev_combo = '''    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card);\n    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const comboModifier = comboAttackModifier(current.player, card, zone, true);'''
if old_rev_combo not in playtest: raise SystemExit('reversal modifier block missing')
playtest = playtest.replace(old_rev_combo, new_rev_combo, 1)
# remaining AP occurrence is Reversal.
playtest = playtest.replace(' + fighterModifier.power + printedModifier.power + comboModifier.power);', ' + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);', 1)
if old_normal_def not in playtest: raise SystemExit('reversal defense power missing')
playtest = playtest.replace(old_normal_def, new_normal_def, 1)
old_rev_ai = 'let nextAi = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), damageTaken: reduced.board.damageTaken + damage, wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit };'
new_rev_ai = 'let nextAi = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), attacksReceivedThisRound: (reduced.board.attacksReceivedThisRound ?? 0) + 1, damageTaken: reduced.board.damageTaken + damage, wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit };'
if old_rev_ai not in playtest: raise SystemExit('reversal nextAi missing')
playtest = playtest.replace(old_rev_ai, new_rev_ai, 1)
old_rev_defstate = 'playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true }'
new_rev_defstate = 'playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, nextDefenseCardBonus: 0 }'
if old_rev_defstate not in playtest: raise SystemExit('reversal defense state missing')
playtest = playtest.replace(old_rev_defstate, new_rev_defstate, 1)
# remaining notes occurrence should be reversal.
playtest = playtest.replace('...printedModifier.notes, ...comboModifier.notes', '...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes', 1)

# Honor clears per-round incoming counts and unused next-Defense penalties.
playtest = playtest.replace('attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0', 'attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0', 2)

playtest_path.write_text(playtest)

# Resolver tests.
test_path = root / 'tests/effect-resolvers.test.mjs'
test_text = test_path.read_text()
lines = test_text.splitlines()
for i, line in enumerate(lines):
    if 'from "../app/effect-resolvers.ts"' in line:
        if 'firstIncomingAttackPowerPenalty' not in line:
            line = line.replace('equipmentSpeedModifier,', 'equipmentSpeedModifier, firstIncomingAttackPowerPenalty,')
        if 'targetNextDefensePenalty' not in line:
            line = line.replace('targetNextAttackPenalty,', 'targetNextAttackPenalty, targetNextDefensePenalty,')
        lines[i] = line
        break
test_text = '\n'.join(lines) + '\n'
if 'first-incoming Attack and next-Defense penalties persist correctly' not in test_text:
    test_text += r'''

test("first-incoming Attack and next-Defense penalties persist correctly", () => {
  const shield = firstIncomingAttackPowerPenalty([{ name: "Museum Rope Barrier", rulesText: "The first Attack targeting you each round gets −1 Attack Power." }], true);
  assert.equal(shield.amount, -1);
  assert.equal(firstIncomingAttackPowerPenalty([{ rulesText: "The first Attack targeting you each round gets -2 Attack Power." }], false).amount, 0);
  assert.equal(targetNextDefensePenalty({ rulesText: "Their next Defense card this round gets −2 Guard." }), 2);
  assert.equal(targetNextDefensePenalty({ rulesText: "On Hit, target's next Defense card provides -1 Defense." }), 1);
});
'''
    test_path.write_text(test_text)

integration = root / 'tests/playtest-effect-integration.test.mjs'
itext = integration.read_text()
if 'tracks incoming attacks and next-Defense penalties' not in itext:
    itext += r'''

test("Quick Duel tracks incoming attacks and next-Defense penalties across cards", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /attacksReceivedThisRound/);
  assert.match(source, /nextDefenseCardBonus/);
  assert.match(source, /incomingAttackEquipmentModifier/);
  assert.match(source, /targetNextDefensePenalty/);
});
'''
    integration.write_text(itext)
