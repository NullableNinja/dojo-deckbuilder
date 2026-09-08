from pathlib import Path

playtest = Path("app/playtest.tsx")
p = playtest.read_text()

old = 'import { applyStage3CBoardCustomCommand, revertStage3CBoardCustomStatus } from "./stage3c-board-command-semantics.ts";\n'
new = old + 'import { consumeNextDefenseStatuses, consumeNextIncomingAttackStatuses, nextDefenseGuardBonus, nextIncomingAttackDefenseBonus } from "./stage3c-defense-status-semantics.ts";\n'
if old not in p:
    raise SystemExit("import anchor missing")
p = p.replace(old, new, 1)

old = '''function stage3cDefenseStatusBonus(board: Board, defense: CardEntry | null | undefined) {
  if (!defense) return 0;
  return (board.stage3cStatuses ?? []).filter((status) => status.duration === "nextDefense" && status.effect === "combat.modifyGuard").reduce((total, status) => total + status.amount, 0)
    + (board.stage3cStatuses ?? []).filter((status) => status.duration === "nextIncomingAttack" && status.effect === "combat.modifyDefense").reduce((total, status) => total + status.amount, 0);
}

function stage3cConsumeDefenseStatuses(board: Board) {
  return { ...board, stage3cStatuses: (board.stage3cStatuses ?? []).filter((status) => status.duration !== "nextDefense" && status.duration !== "nextIncomingAttack") };
}
'''
new = '''function stage3cNextDefenseGuardBonus(board: Board) {
  return nextDefenseGuardBonus(board.stage3cStatuses ?? []);
}

function stage3cIncomingAttackDefenseBonus(board: Board) {
  return nextIncomingAttackDefenseBonus(board.stage3cStatuses ?? []);
}

function stage3cConsumeDefenseStatuses(board: Board) {
  return { ...board, stage3cStatuses: consumeNextDefenseStatuses(board.stage3cStatuses ?? []) };
}

function stage3cConsumeIncomingAttackStatuses(board: Board) {
  return { ...board, stage3cStatuses: consumeNextIncomingAttackStatuses(board.stage3cStatuses ?? []) };
}
'''
if old not in p:
    raise SystemExit("status helper anchor missing")
p = p.replace(old, new, 1)

old = 'return { id, total: fighterStat(board, "DEF") + piercedArmorModifier(applyNextAttackArmorPenalty(equipmentDefenseModifier(board, zone), armorPenalty + suppression), piercing).value + cardPower(card) + (board.nextDefenseCardBonus ?? 0) + stage3cDefenseStatusBonus(board, card) + printed + modifier };'
new = 'return { id, total: fighterStat(board, "DEF") + piercedArmorModifier(applyNextAttackArmorPenalty(equipmentDefenseModifier(board, zone), armorPenalty + suppression), piercing).value + stage3cIncomingAttackDefenseBonus(board) + cardPower(card) + (board.nextDefenseCardBonus ?? 0) + stage3cNextDefenseGuardBonus(board) + printed + modifier };'
if old not in p:
    raise SystemExit("bestDefense anchor missing")
p = p.replace(old, new, 1)

old = 'const defensePower = Math.max(0, fighterStat(aiDefenseReaction.board, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (aiDefenseReaction.board.nextDefenseCardBonus ?? 0) + stage3cDefenseStatusBonus(aiDefenseReaction.board, defenseCard) + aiDefenseReaction.guard : 0) + defenseCardModifier.value + defenseModifier.value);'
new = 'const defensePower = Math.max(0, fighterStat(aiDefenseReaction.board, "DEF") + armorModifier.value + stage3cIncomingAttackDefenseBonus(aiDefenseReaction.board) + (defenseCard ? cardPower(defenseCard) + (aiDefenseReaction.board.nextDefenseCardBonus ?? 0) + stage3cNextDefenseGuardBonus(aiDefenseReaction.board) + aiDefenseReaction.guard : 0) + defenseCardModifier.value + defenseModifier.value);'
if old not in p:
    raise SystemExit("declareAttack defensePower anchor missing")
p = p.replace(old, new, 1)

old = '''    let nextAi: Board = { ...optionalReduced.board, hp: Math.max(0, optionalReduced.board.hp - damage), attacksReceivedThisRound: (optionalReduced.board.attacksReceivedThisRound ?? 0) + 1, combatDamageEventsThisRound: (optionalReduced.board.combatDamageEventsThisRound ?? 0) + (reduced.damage > 0 ? 1 : 0), wasHitSinceLastTurn: optionalReduced.board.wasHitSinceLastTurn || hit, damageTaken: optionalReduced.board.damageTaken + damage };
    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card, { previousCardIsItem }) : { board: nextAi, notes: [] as string[] };
'''
new = '''    let nextAi: Board = { ...optionalReduced.board, hp: Math.max(0, optionalReduced.board.hp - damage), attacksReceivedThisRound: (optionalReduced.board.attacksReceivedThisRound ?? 0) + 1, combatDamageEventsThisRound: (optionalReduced.board.combatDamageEventsThisRound ?? 0) + (reduced.damage > 0 ? 1 : 0), wasHitSinceLastTurn: optionalReduced.board.wasHitSinceLastTurn || hit, damageTaken: optionalReduced.board.damageTaken + damage };
    nextAi = stage3cConsumeIncomingAttackStatuses(nextAi);
    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card, { previousCardIsItem }) : { board: nextAi, notes: [] as string[] };
'''
if old not in p:
    raise SystemExit("declareAttack consume incoming anchor missing")
p = p.replace(old, new, 1)

old = '    let defensePower = fighterStat(nextPlayer, "DEF") + armorModifier.value;'
new = '    let defensePower = fighterStat(nextPlayer, "DEF") + armorModifier.value + stage3cIncomingAttackDefenseBonus(nextPlayer);'
if old not in p:
    raise SystemExit("resolveDefense base defense anchor missing")
p = p.replace(old, new, 1)

old = '      defensePower += cardPower(defenseCard) + (nextPlayer.nextDefenseCardBonus ?? 0) + stage3cDefenseStatusBonus(nextPlayer, defenseCard) + (nextPlayer.equipmentDefenseGuard ?? 0) + defenseCardModifier.value + tempoBonus + locationModifier.value;'
new = '      defensePower += cardPower(defenseCard) + (nextPlayer.nextDefenseCardBonus ?? 0) + stage3cNextDefenseGuardBonus(nextPlayer) + (nextPlayer.equipmentDefenseGuard ?? 0) + defenseCardModifier.value + tempoBonus + locationModifier.value;'
if old not in p:
    raise SystemExit("resolveDefense card bonus anchor missing")
p = p.replace(old, new, 1)

old = '''      const followup = applyAfterDefenseEquipment(nextPlayer);
      nextPlayer = followup.board;
    }
    const postDefensePower = afterDefenseAttackPowerBonus(aiCard, Boolean(defenseCard));
'''
new = '''      const followup = applyAfterDefenseEquipment(nextPlayer);
      nextPlayer = followup.board;
    }
    nextPlayer = stage3cConsumeIncomingAttackStatuses(nextPlayer);
    const postDefensePower = afterDefenseAttackPowerBonus(aiCard, Boolean(defenseCard));
'''
if old not in p:
    raise SystemExit("resolveDefense consume incoming anchor missing")
p = p.replace(old, new, 1)

old = 'const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (current.ai.nextDefenseCardBonus ?? 0) + stage3cDefenseStatusBonus(current.ai, defenseCard) : 0) + defenseCardModifier.value + defenseModifier.value);'
new = 'const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + stage3cIncomingAttackDefenseBonus(current.ai) + (defenseCard ? cardPower(defenseCard) + (current.ai.nextDefenseCardBonus ?? 0) + stage3cNextDefenseGuardBonus(current.ai) : 0) + defenseCardModifier.value + defenseModifier.value);'
if old not in p:
    raise SystemExit("reversal defensePower anchor missing")
p = p.replace(old, new, 1)

old = '''    let nextAi: Board = { ...optionalReduced.board, hp: Math.max(0, optionalReduced.board.hp - damage), attacksReceivedThisRound: (optionalReduced.board.attacksReceivedThisRound ?? 0) + 1, combatDamageEventsThisRound: (optionalReduced.board.combatDamageEventsThisRound ?? 0) + (reduced.damage > 0 ? 1 : 0), damageTaken: optionalReduced.board.damageTaken + damage, wasHitSinceLastTurn: optionalReduced.board.wasHitSinceLastTurn || hit };
    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card, { previousCardIsItem }) : { board: nextAi, notes: [] as string[] };
'''
new = '''    let nextAi: Board = { ...optionalReduced.board, hp: Math.max(0, optionalReduced.board.hp - damage), attacksReceivedThisRound: (optionalReduced.board.attacksReceivedThisRound ?? 0) + 1, combatDamageEventsThisRound: (optionalReduced.board.combatDamageEventsThisRound ?? 0) + (reduced.damage > 0 ? 1 : 0), damageTaken: optionalReduced.board.damageTaken + damage, wasHitSinceLastTurn: optionalReduced.board.wasHitSinceLastTurn || hit };
    nextAi = stage3cConsumeIncomingAttackStatuses(nextAi);
    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card, { previousCardIsItem }) : { board: nextAi, notes: [] as string[] };
'''
if old not in p:
    raise SystemExit("reversal consume incoming anchor missing")
p = p.replace(old, new, 1)

old = '''    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, blockedSinceLastTurn: !hit || Boolean(nextAi.blockedSinceLastTurn), blockedThisRound: !hit || Boolean(nextAi.blockedThisRound), nextDefenseCardBonus: 0 };
'''
new = '''    if (defenseCard) nextAi = stage3cConsumeDefenseStatuses({ ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, blockedSinceLastTurn: !hit || Boolean(nextAi.blockedSinceLastTurn), blockedThisRound: !hit || Boolean(nextAi.blockedThisRound), nextDefenseCardBonus: 0 });
'''
if old not in p:
    raise SystemExit("reversal consume defense anchor missing")
p = p.replace(old, new, 1)

playtest.write_text(p)

integration = Path("tests/playtest-effect-integration.test.mjs")
r = integration.read_text()
addition = r'''

test("Quick Duel applies nextIncomingAttack DEF without requiring a Defense card and consumes it independently", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /let defensePower = fighterStat\(nextPlayer, "DEF"\) \+ armorModifier\.value \+ stage3cIncomingAttackDefenseBonus\(nextPlayer\)/);
  assert.match(source, /stage3cIncomingAttackDefenseBonus\(aiDefenseReaction\.board\)/);
  assert.match(source, /nextAi = stage3cConsumeIncomingAttackStatuses\(nextAi\)/);
  assert.match(source, /nextPlayer = stage3cConsumeIncomingAttackStatuses\(nextPlayer\)/);
  assert.match(source, /stage3cConsumeDefenseStatuses\(\{ \.\.\.nextAi/);
});
'''
if "Quick Duel applies nextIncomingAttack DEF without requiring a Defense card" not in r:
    r += addition
integration.write_text(r)
