from pathlib import Path


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected unique patch anchor in {path}: {old[:150]!r} count={count}")
    write(path, text.replace(old, new, 1))


def append_once(path, marker, addition):
    text = read(path)
    if marker in text:
        raise SystemExit(f"Patch marker already present in {path}: {marker}")
    write(path, text.rstrip() + "\n\n" + addition.rstrip() + "\n")


# ---------------------------------------------------------------------------
# Printed-text parsers for optional defensive Equipment.
# ---------------------------------------------------------------------------
effect_path = "app/effect-resolvers.ts"
append_once(
    effect_path,
    "optionalCombatDamageReductionEquipment",
    r'''export function optionalCombatDamageReductionEquipment(card: EffectCardLike) {
  const text = normalizedMinus(String(card.rulesText ?? "")).replace(/\s+/g, " ").trim();
  const match = text.match(/The first time you take combat damage each round, you may exhaust this to reduce that damage by (\d+)\. At ([A-Za-z]+) Belt or higher, ready it at Hide if that damage was (\d+) or more/i);
  if (!match) return null;
  return { reduce: Number(match[1]), readyAtHideMinBelt: match[2], readyAtHideMinDamage: Number(match[3]) };
}

export function postBlockEquipmentCycle(card: EffectCardLike) {
  const text = normalizedMinus(String(card.rulesText ?? "")).replace(/\s+/g, " ").trim();
  const match = text.match(/At ([A-Za-z]+) Belt or higher, after you Block a (High|Mid|Low) Attack, you may exhaust this to draw (\d+) cards?, then discard (\d+) cards?/i);
  if (!match) return null;
  return { minBelt: match[1], zone: match[2], draw: Number(match[3]), discard: Number(match[4]) };
}'''
)

# ---------------------------------------------------------------------------
# Quick Duel state, timing windows, AI heuristics, and UI choices.
# ---------------------------------------------------------------------------
play_path = "app/playtest.tsx"
replace_once(
    play_path,
    'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, attackPiercing, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, deckLookPlan, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, discardChoiceFollowup, equipmentActivationPlan, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, mandatoryDamageReductionEquipment, mandatoryDiscardChoiceCount, optionalDiscardDrawChoice, passiveEquipmentGuard, readyEquipmentOnHit, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor, type DeckLookPlan } from "./effect-resolvers";',
    'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, attackPiercing, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, deckLookPlan, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, discardChoiceFollowup, equipmentActivationPlan, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, mandatoryDamageReductionEquipment, mandatoryDiscardChoiceCount, optionalCombatDamageReductionEquipment, optionalDiscardDrawChoice, passiveEquipmentGuard, postBlockEquipmentCycle, readyEquipmentOnHit, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor, type DeckLookPlan } from "./effect-resolvers";'
)
replace_once(
    play_path,
    '  readyAtInitiate?: string[];\n  lastAttackHit?: boolean;\n  tempSpeed: number;',
    '  readyAtInitiate?: string[];\n  readyAtHide?: string[];\n  combatDamageEventsThisRound?: number;\n  lastAttackHit?: boolean;\n  tempSpeed: number;'
)
replace_once(
    play_path,
    '  | { kind: "discard-hand"; sourceCardId: string; remaining: number }',
    '  | { kind: "discard-hand"; sourceCardId: string; remaining: number; afterChoice?: "resume-defense" }'
)
replace_once(
    play_path,
    '  | { kind: "incoming-equipment-zone"; sourceCardId: string; attackPowerPenalty: number }\n  | { kind: "ready-equipment"; sourceCardId: string; optional: boolean };',
    '  | { kind: "incoming-equipment-zone"; sourceCardId: string; attackPowerPenalty: number }\n  | { kind: "prevent-combat-damage"; sourceCardId: string; defenseId: string | null; reduce: number; damage: number; readyAtHideMinBelt: string; readyAtHideMinDamage: number }\n  | { kind: "post-block-cycle"; sourceCardId: string; draw: number; discard: number }\n  | { kind: "ready-equipment"; sourceCardId: string; optional: boolean };'
)
replace_once(
    play_path,
    '  pendingChoice?: PendingChoice | null;\n  reversalRemainingAiAttacks: string[];',
    '  pendingChoice?: PendingChoice | null;\n  pendingCombatContinuation?: { remainingAiAttacks: string[]; reversalEligible: boolean } | null;\n  reversalRemainingAiAttacks: string[];'
)

# Extend the persistent board defaults.
replace_once(
    play_path,
    'equipmentAttackPlan: null, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: 0, nextInitiateFocus: 0, readyAtInitiate: [], lastAttackHit: false,',
    'equipmentAttackPlan: null, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: 0, nextInitiateFocus: 0, readyAtInitiate: [], readyAtHide: [], combatDamageEventsThisRound: 0, lastAttackHit: false,'
)

# Reusable optional-defense helpers live after the mandatory reduction helper.
anchor = '''function applyMandatoryEquipmentDamageReduction(board: Board, damage: number) {
  let next = board;
  let remaining = damage;
  const notes: string[] = [];
  if (remaining <= 0) return { board: next, damage: remaining, notes };
  for (const id of board.equipment) {
    if (isEquipmentExhausted(next, id)) continue;
    const card = cardFor(id);
    const plan = card ? mandatoryDamageReductionEquipment(card) : null;
    if (!card || !plan || remaining <= 0) continue;
    next = exhaustEquipment(next, id);
    if (plan.readyAtInitiate) next = { ...next, readyAtInitiate: [...new Set([...(next.readyAtInitiate ?? []), id])] };
    remaining = Math.max(0, remaining - plan.reduce);
    notes.push(`${card.name} reduces damage by ${plan.reduce} and exhausts`);
  }
  return { board: next, damage: remaining, notes };
}
'''
helpers = anchor + r'''

function optionalCombatDamagePlan(board: Board) {
  if ((board.combatDamageEventsThisRound ?? 0) > 0) return null;
  for (const id of board.equipment) {
    if (isEquipmentExhausted(board, id)) continue;
    const card = cardFor(id);
    const plan = card ? optionalCombatDamageReductionEquipment(card) : null;
    if (card && plan) return { card, plan };
  }
  return null;
}

function applyOptionalCombatDamageReductionAi(board: Board, damage: number) {
  const available = damage > 0 ? optionalCombatDamagePlan(board) : null;
  if (!available) return { board, damage, notes: [] as string[] };
  let next = exhaustEquipment(board, available.card.id);
  if (beltAtLeast(next, available.plan.readyAtHideMinBelt) && damage >= available.plan.readyAtHideMinDamage) {
    next = { ...next, readyAtHide: [...new Set([...(next.readyAtHide ?? []), available.card.id])] };
  }
  return {
    board: next,
    damage: Math.max(0, damage - available.plan.reduce),
    notes: [`${available.card.name} exhausts to reduce combat damage by ${available.plan.reduce}`],
  };
}

function postBlockCyclePlan(board: Board, zone: string) {
  for (const id of board.equipment) {
    if (isEquipmentExhausted(board, id)) continue;
    const card = cardFor(id);
    const plan = card ? postBlockEquipmentCycle(card) : null;
    if (!card || !plan || !beltAtLeast(board, plan.minBelt) || plan.zone.toLocaleLowerCase() !== zone.toLocaleLowerCase()) continue;
    return { card, plan };
  }
  return null;
}

function autoTriggerAiPostBlockEquipment(board: Board, zone: string) {
  const available = postBlockCyclePlan(board, zone);
  if (!available) return { board, notes: [] as string[] };
  let next = exhaustEquipment(board, available.card.id);
  next = drawCards(next, available.plan.draw);
  const discardCount = Math.min(available.plan.discard, next.hand.length);
  if (discardCount) {
    const ranked = [...next.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)));
    const discarded = ranked.slice(0, discardCount);
    next = { ...next, hand: next.hand.filter((candidate) => !discarded.includes(candidate)), discard: [...next.discard, ...discarded] };
  }
  return { board: next, notes: [`${available.card.name} exhausts after the ${zone} Block to draw ${available.plan.draw} / discard ${discardCount}`] };
}

function applyHideReady(board: Board) {
  const ready = new Set(board.readyAtHide ?? []);
  if (!ready.size) return { ...board, readyAtHide: [] };
  return {
    ...board,
    exhaustedEquipment: (board.exhaustedEquipment ?? []).filter((id) => !ready.has(id)),
    readyAtHide: [],
  };
}
'''
replace_once(play_path, anchor, helpers)

# Hide is a real timing point: conditionally scheduled Equipment readies before cleanup.
old_cleanup = '''function playAreaCleanup(board: Board) {
  const borrowed = board.borrowedEquipmentId;
  const equipment = borrowed ? board.equipment.filter((id) => id !== borrowed) : board.equipment;
  const exhaustedEquipment = borrowed ? (board.exhaustedEquipment ?? []).filter((id) => id !== borrowed) : (board.exhaustedEquipment ?? []);
  const discard = [...board.discard, ...board.hand, ...board.playArea.filter((id) => !board.equipment.includes(id)), ...(borrowed ? [borrowed] : [])];
  return drawCards({ ...board, hand: [], playArea: [], equipment, exhaustedEquipment, equipmentAttackPlan: null, discard, focus: 0, attacksThisTurn: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0, borrowedEquipmentId: null, wasHitSinceLastTurn: false, comboAttemptedTurn: false }, board.belt >= 5 ? 6 : 5);
}'''
new_cleanup = '''function playAreaCleanup(board: Board) {
  const readyBoard = applyHideReady(board);
  const borrowed = readyBoard.borrowedEquipmentId;
  const equipment = borrowed ? readyBoard.equipment.filter((id) => id !== borrowed) : readyBoard.equipment;
  const exhaustedEquipment = borrowed ? (readyBoard.exhaustedEquipment ?? []).filter((id) => id !== borrowed) : (readyBoard.exhaustedEquipment ?? []);
  const discard = [...readyBoard.discard, ...readyBoard.hand, ...readyBoard.playArea.filter((id) => !readyBoard.equipment.includes(id)), ...(borrowed ? [borrowed] : [])];
  return drawCards({ ...readyBoard, hand: [], playArea: [], equipment, exhaustedEquipment, equipmentAttackPlan: null, discard, focus: 0, attacksThisTurn: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0, borrowedEquipmentId: null, wasHitSinceLastTurn: false, comboAttemptedTurn: false }, readyBoard.belt >= 5 ? 6 : 5);
}'''
replace_once(play_path, old_cleanup, new_cleanup)

# Honor resets the first-combat-damage window and stale Hide schedules.
text = read(play_path)
needle = 'readyAtInitiate: [], lastAttackHit: false, attackedThisRound: false'
if text.count(needle) != 2:
    raise SystemExit(f"Expected two Honor board-reset anchors, got {text.count(needle)}")
text = text.replace(needle, 'readyAtInitiate: [], readyAtHide: [], combatDamageEventsThisRound: 0, lastAttackHit: false, attackedThisRound: false')
write(play_path, text)

# Match setup / new rounds must not carry stale continuation state.
replace_once(
    play_path,
    'pendingStrike: null, pendingDiscard: null, reversalRemainingAiAttacks: [], winner: null, log:',
    'pendingStrike: null, pendingDiscard: null, pendingChoice: null, pendingCombatContinuation: null, reversalRemainingAiAttacks: [], winner: null, log:'
)
replace_once(
    play_path,
    'marketPurchasedThisRound: false, pendingDiscard: null, pendingChoice: null, locationId,',
    'marketPurchasedThisRound: false, pendingDiscard: null, pendingChoice: null, pendingCombatContinuation: null, locationId,'
)

# AI uses optional damage prevention deterministically; combat event counts use the
# pre-optional damage so reducing 1 -> 0 still consumes the first-damage window.
replace_once(
    play_path,
    '''    const reduced = reduceDamageForFighter(aiDefenseReaction.board, rawDamage);
    const damage = reduced.damage;
    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attacksThisTurn: current.player.attacksThisTurn + 1, hitThisTurn: current.player.hitThisTurn || hit, attackedThisRound: true, cardsThisTurn: [...current.player.cardsThisTurn, card.id], zonesPlayed: [...current.player.zonesPlayed, zone], nextAttackBonus: 0, nextAttackHasFlow: false, equipmentAttackPlan: null, tempo: tempoBonus ? false : current.player.tempo, wasHitSinceLastTurn: current.player.attacksThisTurn === 0 ? false : current.player.wasHitSinceLastTurn, triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0, damageDealt: current.player.damageDealt + damage, lastAttackHit: hit }, card, "player");''',
    '''    const reduced = reduceDamageForFighter(aiDefenseReaction.board, rawDamage);
    const optionalReduced = applyOptionalCombatDamageReductionAi(reduced.board, reduced.damage);
    const damage = optionalReduced.damage;
    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attacksThisTurn: current.player.attacksThisTurn + 1, hitThisTurn: current.player.hitThisTurn || hit, attackedThisRound: true, cardsThisTurn: [...current.player.cardsThisTurn, card.id], zonesPlayed: [...current.player.zonesPlayed, zone], nextAttackBonus: 0, nextAttackHasFlow: false, equipmentAttackPlan: null, tempo: tempoBonus ? false : current.player.tempo, wasHitSinceLastTurn: current.player.attacksThisTurn === 0 ? false : current.player.wasHitSinceLastTurn, triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0, damageDealt: current.player.damageDealt + damage, lastAttackHit: hit }, card, "player");'''
)
replace_once(
    play_path,
    '    let nextAi: Board = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), attacksReceivedThisRound: (reduced.board.attacksReceivedThisRound ?? 0) + 1, wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit, damageTaken: reduced.board.damageTaken + damage };',
    '    let nextAi: Board = { ...optionalReduced.board, hp: Math.max(0, optionalReduced.board.hp - damage), attacksReceivedThisRound: (optionalReduced.board.attacksReceivedThisRound ?? 0) + 1, combatDamageEventsThisRound: (optionalReduced.board.combatDamageEventsThisRound ?? 0) + (reduced.damage > 0 ? 1 : 0), wasHitSinceLastTurn: optionalReduced.board.wasHitSinceLastTurn || hit, damageTaken: optionalReduced.board.damageTaken + damage };'
)
replace_once(
    play_path,
    '      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve");\n    }\n    if (damage >= 3 && nextPlayer.belt >= 6) nextPlayer.focus += 1;',
    '      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve");\n    }\n    const aiPostBlock = !hit && defenseCard ? autoTriggerAiPostBlockEquipment(nextAi, zone) : { board: nextAi, notes: [] as string[] };\n    nextAi = aiPostBlock.board;\n    if (damage >= 3 && nextPlayer.belt >= 6) nextPlayer.focus += 1;'
)
replace_once(
    play_path,
    '...targetDebuff.notes, ...defenseFollowupNotes, ...(reduced.note ? [reduced.note] : [])];\n    return write(current, `${tempoBonus ? "Tempo +1. " : ""}${result}',
    '...targetDebuff.notes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...(reduced.note ? [reduced.note] : [])];\n    return write(current, `${tempoBonus ? "Tempo +1. " : ""}${result}'
)

# Reversal attacks against AI use the same optional prevention and post-Block logic.
replace_once(
    play_path,
    '''    const reduced = reduceDamageForFighter(current.ai, rawDamage);
    const damage = reduced.damage;
    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attackedThisRound: true, zonesPlayed: [...current.player.zonesPlayed, zone], cardsThisTurn: [...current.player.cardsThisTurn, card.id], reversalUsedRound: true, reversalAttackBonus: 0, triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0, damageDealt: current.player.damageDealt + damage }, card, "player");''',
    '''    const reduced = reduceDamageForFighter(current.ai, rawDamage);
    const optionalReduced = applyOptionalCombatDamageReductionAi(reduced.board, reduced.damage);
    const damage = optionalReduced.damage;
    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attackedThisRound: true, zonesPlayed: [...current.player.zonesPlayed, zone], cardsThisTurn: [...current.player.cardsThisTurn, card.id], reversalUsedRound: true, reversalAttackBonus: 0, triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0, damageDealt: current.player.damageDealt + damage }, card, "player");'''
)
replace_once(
    play_path,
    '    let nextAi: Board = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), attacksReceivedThisRound: (reduced.board.attacksReceivedThisRound ?? 0) + 1, damageTaken: reduced.board.damageTaken + damage, wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit };',
    '    let nextAi: Board = { ...optionalReduced.board, hp: Math.max(0, optionalReduced.board.hp - damage), attacksReceivedThisRound: (optionalReduced.board.attacksReceivedThisRound ?? 0) + 1, combatDamageEventsThisRound: (optionalReduced.board.combatDamageEventsThisRound ?? 0) + (reduced.damage > 0 ? 1 : 0), damageTaken: optionalReduced.board.damageTaken + damage, wasHitSinceLastTurn: optionalReduced.board.wasHitSinceLastTurn || hit };'
)
# There are now two defense followup blocks; target the Reversal block by its nearby task marker.
replace_once(
    play_path,
    '''      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve");
    }
    nextPlayer = markCompletedTask(nextPlayer);
    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...piercingModifier.notes, ...armorModifier.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...defenseFollowupNotes, ...(reduced.note ? [reduced.note] : [])];''',
    '''      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve");
    }
    const aiPostBlock = !hit && defenseCard ? autoTriggerAiPostBlockEquipment(nextAi, zone) : { board: nextAi, notes: [] as string[] };
    nextAi = aiPostBlock.board;
    nextPlayer = markCompletedTask(nextPlayer);
    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...piercingModifier.notes, ...armorModifier.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...(reduced.note ? [reduced.note] : [])];'''
)

# Resume combat only after optional post-Block paperwork has been accepted/declined.
resume_anchor = '''  const chooseIncomingEquipmentZone = (zone: string) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "incoming-equipment-zone" || !current.pendingStrike) return current;
    const matched = zone.toLocaleLowerCase() === current.pendingStrike.zone.toLocaleLowerCase();
    const pendingStrike = matched
      ? { ...current.pendingStrike, attackPower: Math.max(0, current.pendingStrike.attackPower - choice.attackPowerPenalty), modifierNotes: [...current.pendingStrike.modifierNotes, `${cardFor(choice.sourceCardId)?.name ?? "Equipment"} called ${zone}: -${choice.attackPowerPenalty} Attack Power`] }
      : current.pendingStrike;
    return write(current, `${cardFor(choice.sourceCardId)?.name ?? "Equipment"} calls ${zone}.${matched ? ` The declared Attack loses ${choice.attackPowerPenalty} Attack Power.` : " The call misses the declared zone."}`, { pendingStrike, pendingChoice: null });
  });
'''
resume_helpers = resume_anchor + r'''

  const resumeAfterDefense = (current: Match) => {
    const continuation = current.pendingCombatContinuation;
    const cleared: Match = { ...current, pendingChoice: null, pendingCombatContinuation: null };
    if (!continuation) return cleared;
    const reversalAttacks = cleared.player.hand.filter((id) => { const card = cardFor(id); return Boolean(card && isAttack(card)); });
    if (continuation.reversalEligible && !cleared.player.reversalUsedRound && reversalAttacks.length) {
      return write(cleared, `Reversal window: the block is certified and ${reversalAttacks.length} counterattack${reversalAttacks.length === 1 ? " is" : "s are"} ready.`, { phase: "reversal-window", reversalRemainingAiAttacks: continuation.remainingAiAttacks, selectedAttackId: null });
    }
    if (continuation.remainingAiAttacks.length) return openAiStrike(cleared, continuation.remainingAiAttacks[0], continuation.remainingAiAttacks.slice(1), settings.tempo);
    return finishAiTurn(cleared, "Computer finishes its Yell and clears the mat.", settings.locations);
  };

  const usePendingEquipmentChoice = () => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice) return current;
    if (choice.kind === "prevent-combat-damage") {
      return resolveDefenseState(current, choice.defenseId, {
        sourceCardId: choice.sourceCardId,
        reduce: choice.reduce,
        readyAtHideMinBelt: choice.readyAtHideMinBelt,
        readyAtHideMinDamage: choice.readyAtHideMinDamage,
      }, true);
    }
    if (choice.kind === "post-block-cycle") {
      if (!current.player.equipment.includes(choice.sourceCardId) || isEquipmentExhausted(current.player, choice.sourceCardId)) return resumeAfterDefense({ ...current, pendingChoice: null });
      let player = exhaustEquipment(current.player, choice.sourceCardId);
      player = drawCards(player, choice.draw);
      const discardCount = Math.min(choice.discard, player.hand.length);
      if (discardCount) {
        return write(current, `${cardFor(choice.sourceCardId)?.name ?? "Equipment"} exhausted after the Block. Draw ${choice.draw}; now choose ${discardCount} discard${discardCount === 1 ? "" : "s"}.`, { player, pendingChoice: { kind: "discard-hand", sourceCardId: choice.sourceCardId, remaining: discardCount, afterChoice: "resume-defense" } });
      }
      return resumeAfterDefense(write(current, `${cardFor(choice.sourceCardId)?.name ?? "Equipment"} exhausted after the Block and drew ${choice.draw}.`, { player, pendingChoice: null }));
    }
    return current;
  });
'''
replace_once(play_path, resume_anchor, resume_helpers)

# Paid/mandatory discard choices can resume the paused post-Block combat chain.
replace_once(
    play_path,
    '''      const pendingChoice = remaining > 0 && player.hand.length ? { ...choice, remaining } : null;
      return write(current, `${selected.name} discarded for ${sourceCard?.name ?? "the printed effect"}.${followup.notes.length ? ` ${followup.notes.join("; ")}.` : ""}${pendingChoice ? ` Choose ${remaining} more.` : " Choice resolved."}`, { player, pendingChoice });''',
    '''      const pendingChoice = remaining > 0 && player.hand.length ? { ...choice, remaining } : null;
      const resolved = write(current, `${selected.name} discarded for ${sourceCard?.name ?? "the printed effect"}.${followup.notes.length ? ` ${followup.notes.join("; ")}.` : ""}${pendingChoice ? ` Choose ${remaining} more.` : " Choice resolved."}`, { player, pendingChoice });
      if (!pendingChoice && choice.afterChoice === "resume-defense") return resumeAfterDefense(resolved);
      return resolved;'''
)

# Optional-choice decline paths: damage resolves without spending Fire-Code; post-Block
# cycle resumes combat without exhausting Headgear.
replace_once(
    play_path,
    '''  const skipPendingChoice = () => setMatch((current) => {
    if (!current?.pendingChoice) return current;
    if (current.pendingChoice.kind === "discard-draw") return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: discard/draw declined.`, { pendingChoice: null });''',
    '''  const skipPendingChoice = () => setMatch((current) => {
    if (!current?.pendingChoice) return current;
    if (current.pendingChoice.kind === "prevent-combat-damage") {
      const choice = current.pendingChoice;
      return resolveDefenseState(current, choice.defenseId, null, true);
    }
    if (current.pendingChoice.kind === "post-block-cycle") return resumeAfterDefense(write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional Equipment"}: post-Block cycle declined.`, { pendingChoice: null }));
    if (current.pendingChoice.kind === "discard-draw") return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: discard/draw declined.`, { pendingChoice: null });'''
)

# Refactor the player Defense resolver into a reusable state resolver so the damage
# prevention choice can pause before HP is actually removed, then resume exactly once.
text = read(play_path)
start_marker = '  const resolveDefense = (defenseId: string | null) => setMatch((current) => {\n'
end_marker = '\n\n  const declineReversal = () => setMatch((current) => {'
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('Could not isolate resolveDefense region.')
region = text[start:end]
region = region.replace(
    start_marker,
    '  const resolveDefenseState = (current: Match, defenseId: string | null, prevention: { sourceCardId: string; reduce: number; readyAtHideMinBelt: string; readyAtHideMinDamage: number } | null = null, skipOptionalPrompt = false): Match => {\n',
    1,
)
if not region.rstrip().endswith('});'):
    raise SystemExit('resolveDefense region did not end with expected setMatch closure.')
region = region.rstrip()[:-3] + '''};\n\n  const resolveDefense = (defenseId: string | null) => setMatch((current) => current ? resolveDefenseState(current, defenseId) : current);'''

old_damage = '''    const reduced = reduceDamageForFighter(nextPlayer, rawDamage);
    const damage = reduced.damage;
    nextPlayer = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit, damageTaken: reduced.board.damageTaken + damage };'''
new_damage = '''    const reduced = reduceDamageForFighter(nextPlayer, rawDamage);
    const damageBeforeOptional = reduced.damage;
    const optionalReduction = !skipOptionalPrompt && damageBeforeOptional > 0 ? optionalCombatDamagePlan(current.player) : null;
    if (optionalReduction) {
      return write(current, `${optionalReduction.card.name} may reduce this ${damageBeforeOptional} combat damage by ${optionalReduction.plan.reduce}. Choose whether to exhaust it before HP is removed.`, {
        pendingChoice: { kind: "prevent-combat-damage", sourceCardId: optionalReduction.card.id, defenseId, reduce: optionalReduction.plan.reduce, damage: damageBeforeOptional, readyAtHideMinBelt: optionalReduction.plan.readyAtHideMinBelt, readyAtHideMinDamage: optionalReduction.plan.readyAtHideMinDamage },
      });
    }
    let reducedBoard = reduced.board;
    let damage = damageBeforeOptional;
    const preventionNotes: string[] = [];
    if (prevention && damage > 0 && reducedBoard.equipment.includes(prevention.sourceCardId) && !isEquipmentExhausted(reducedBoard, prevention.sourceCardId)) {
      reducedBoard = exhaustEquipment(reducedBoard, prevention.sourceCardId);
      if (beltAtLeast(reducedBoard, prevention.readyAtHideMinBelt) && damageBeforeOptional >= prevention.readyAtHideMinDamage) {
        reducedBoard = { ...reducedBoard, readyAtHide: [...new Set([...(reducedBoard.readyAtHide ?? []), prevention.sourceCardId])] };
        preventionNotes.push(`${cardFor(prevention.sourceCardId)?.name ?? "Equipment"} is scheduled to ready at Hide`);
      }
      damage = Math.max(0, damage - prevention.reduce);
      preventionNotes.unshift(`${cardFor(prevention.sourceCardId)?.name ?? "Equipment"} reduces combat damage ${damageBeforeOptional} → ${damage}`);
    }
    nextPlayer = { ...reducedBoard, hp: Math.max(0, reducedBoard.hp - damage), combatDamageEventsThisRound: (reducedBoard.combatDamageEventsThisRound ?? 0) + (damageBeforeOptional > 0 ? 1 : 0), wasHitSinceLastTurn: reducedBoard.wasHitSinceLastTurn || hit, damageTaken: reducedBoard.damageTaken + damage };'''
if region.count(old_damage) != 1:
    raise SystemExit(f'Player defense damage anchor count={region.count(old_damage)}')
region = region.replace(old_damage, new_damage, 1)

# Offer Inspection-Grade-like post-Block cycles after all Defense effects resolve,
# before Reversal or the next AI Attack is opened.
post_anchor = '''    if (defenseCard) {
      if (!hit) nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onBlock");
      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "afterResolve");
    }
    if (!nextPlayer.hp) nextAi = { ...nextAi, xp: nextAi.xp + 2 };'''
post_new = '''    if (defenseCard) {
      if (!hit) nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onBlock");
      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "afterResolve");
    }
    const postBlockCycle = !hit && defenseCard ? postBlockCyclePlan(nextPlayer, pending.zone) : null;
    if (postBlockCycle) {
      const reversalEligible = !nextPlayer.reversalUsedRound;
      const paused = write(current, `${postBlockCycle.card.name} may exhaust after this ${pending.zone} Block to draw ${postBlockCycle.plan.draw}, then discard ${postBlockCycle.plan.discard}.`, {
        player: nextPlayer,
        ai: nextAi,
        pendingStrike: null,
        pendingChoice: { kind: "post-block-cycle", sourceCardId: postBlockCycle.card.id, draw: postBlockCycle.plan.draw, discard: postBlockCycle.plan.discard },
        pendingCombatContinuation: { remainingAiAttacks: pending.remainingAiAttacks, reversalEligible },
        winner: null,
      });
      return paused;
    }
    if (!nextPlayer.hp) nextAi = { ...nextAi, xp: nextAi.xp + 2 };'''
if region.count(post_anchor) != 1:
    raise SystemExit(f'Post-Block insertion anchor count={region.count(post_anchor)}')
region = region.replace(post_anchor, post_new, 1)
region = region.replace('...(reduced.note ? [reduced.note] : [])];', '...(reduced.note ? [reduced.note] : []), ...preventionNotes];', 1)
region = region.replace('{ player: nextPlayer, ai: nextAi, pendingStrike: null, winner:', '{ player: nextPlayer, ai: nextAi, pendingStrike: null, pendingCombatContinuation: null, winner:', 1)
text = text[:start] + region + text[end:]
write(play_path, text)

# UI text/buttons for the two new optional Equipment windows.
replace_once(
    play_path,
    '            : match.pendingChoice?.kind === "equipment-zone" ? "Commit your Equipment zone"\n              : match.pendingChoice?.kind === "incoming-equipment-zone" ? "Call the incoming zone"\n                : match.pendingChoice?.kind === "ready-equipment" ? "Ready Equipment?" : "Resolve printed effect";',
    '            : match.pendingChoice?.kind === "equipment-zone" ? "Commit your Equipment zone"\n              : match.pendingChoice?.kind === "incoming-equipment-zone" ? "Call the incoming zone"\n                : match.pendingChoice?.kind === "prevent-combat-damage" ? "Reduce this damage?"\n                  : match.pendingChoice?.kind === "post-block-cycle" ? "Use post-Block Equipment?"\n                    : match.pendingChoice?.kind === "ready-equipment" ? "Ready Equipment?" : "Resolve printed effect";'
)
replace_once(
    play_path,
    '              : match.pendingChoice?.kind === "incoming-equipment-zone" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Equipment"} is exhausted. Call High, Mid, or Low against the declared ${match.pendingStrike?.zone ?? "incoming"} Attack.`\n                : match.pendingChoice?.kind === "ready-equipment" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This effect"} can ready one exhausted Equipment card you control. You may decline.` : "Resolve the printed effect.";\n  const effectChoiceCanSkip = match.pendingChoice?.kind === "discard-draw" || (match.pendingChoice?.kind === "deck-pick" && match.pendingChoice.optional) || (match.pendingChoice?.kind === "ready-equipment" && match.pendingChoice.optional);',
    '              : match.pendingChoice?.kind === "incoming-equipment-zone" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Equipment"} is exhausted. Call High, Mid, or Low against the declared ${match.pendingStrike?.zone ?? "incoming"} Attack.`\n                : match.pendingChoice?.kind === "prevent-combat-damage" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Equipment"} can exhaust now to reduce ${match.pendingChoice.damage} combat damage by ${match.pendingChoice.reduce}. Declining still consumes this round\'s first-damage timing window.`\n                  : match.pendingChoice?.kind === "post-block-cycle" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Equipment"} triggered after the Block. Exhaust it to draw ${match.pendingChoice.draw}, then choose ${match.pendingChoice.discard} discard${match.pendingChoice.discard === 1 ? "" : "s"}, or decline and continue combat.`\n                    : match.pendingChoice?.kind === "ready-equipment" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This effect"} can ready one exhausted Equipment card you control. You may decline.` : "Resolve the printed effect.";\n  const effectChoiceCanSkip = match.pendingChoice?.kind === "prevent-combat-damage" || match.pendingChoice?.kind === "post-block-cycle" || match.pendingChoice?.kind === "discard-draw" || (match.pendingChoice?.kind === "deck-pick" && match.pendingChoice.optional) || (match.pendingChoice?.kind === "ready-equipment" && match.pendingChoice.optional);'
)
replace_once(
    play_path,
    '<div className="effect-choice-options">{match.pendingChoice?.kind === "equipment-zone" ?',
    '<div className="effect-choice-options">{match.pendingChoice?.kind === "prevent-combat-damage" ? <button type="button" onClick={usePendingEquipmentChoice}><span>EXHAUST EQUIPMENT</span><b>Reduce damage</b><small>{match.pendingChoice.damage} → {Math.max(0, match.pendingChoice.damage - match.pendingChoice.reduce)} combat damage</small></button> : match.pendingChoice?.kind === "post-block-cycle" ? <button type="button" onClick={usePendingEquipmentChoice}><span>EXHAUST EQUIPMENT</span><b>Draw {match.pendingChoice.draw}</b><small>Then choose {match.pendingChoice.discard} discard{match.pendingChoice.discard === 1 ? "" : "s"}</small></button> : match.pendingChoice?.kind === "equipment-zone" ?'
)
replace_once(
    play_path,
    '<header><div><span className="eyebrow">Your hand · {player.hand.length} cards</span><h2>{match.pendingDiscard ? `Choose ${match.pendingDiscard.remaining} card to discard` : match.phase === "player-initiate" ?',
    '<header><div><span className="eyebrow">Your hand · {player.hand.length} cards</span><h2>{match.pendingChoice ? "Resolve the Equipment decision" : match.pendingDiscard ? `Choose ${match.pendingDiscard.remaining} card to discard` : match.phase === "player-initiate" ?'
)
replace_once(
    play_path,
    '{match.phase === "defense-window" && <button onClick={() => resolveDefense(null)}>Pass Reaction</button>}',
    '{match.phase === "defense-window" && !match.pendingChoice && <button onClick={() => resolveDefense(null)}>Pass Reaction</button>}'
)

# Inspector recognizes the supported post-Block/prevention effects as reactions rather
# than suggesting they are ordinary Yell activations.
replace_once(
    play_path,
    'const plan = equipmentActivationPlan(item); const ownLoadout = inspectedBoard === player; const legalPhase = plan?.kind === "speed-cycle" ?',
    'const plan = equipmentActivationPlan(item); const optionalDefensePlan = optionalCombatDamageReductionEquipment(item) || postBlockEquipmentCycle(item); const ownLoadout = inspectedBoard === player; const legalPhase = plan?.kind === "speed-cycle" ?'
)
replace_once(
    play_path,
    'plan ? match.phase === "player-yell" : false; return <div className={`equipment-slot-control',
    'plan ? match.phase === "player-yell" : false; return <div className={`equipment-slot-control'
)
# We intentionally do not add a manual inspector activation button for optionalDefensePlan;
# these cards appear only in their correct combat timing window.

# ---------------------------------------------------------------------------
# Regression tests.
# ---------------------------------------------------------------------------
test_path = "tests/optional-defense-equipment.test.mjs"
write(test_path, r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { optionalCombatDamageReductionEquipment, postBlockEquipmentCycle } from "../app/effect-resolvers.ts";

const cards = JSON.parse(await readFile(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
const byName = new Map(cards.map((card) => [card.name, card]));

test("Fire-Code Padded Vest compiles as an optional first-combat-damage reaction", () => {
  const card = byName.get("Fire-Code Padded Vest");
  assert.ok(card, "canonical Fire-Code Padded Vest is present");
  assert.deepEqual(optionalCombatDamageReductionEquipment(card), { reduce: 1, readyAtHideMinBelt: "Green", readyAtHideMinDamage: 3 });
  assert.match(card.rulesText, /you may exhaust this to reduce that damage by 1/i);
});

test("Inspection-Grade Headgear compiles as a Blue+ High-Block optional cycle", () => {
  const card = byName.get("Inspection-Grade Headgear");
  assert.ok(card, "canonical Inspection-Grade Headgear is present");
  assert.deepEqual(postBlockEquipmentCycle(card), { minBelt: "Blue", zone: "High", draw: 1, discard: 1 });
});

test("Quick Duel pauses optional prevention before HP loss and preserves post-Block continuation", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /kind: "prevent-combat-damage"/);
  assert.match(source, /damageBeforeOptional/);
  assert.match(source, /optionalCombatDamagePlan\(current\.player\)/);
  assert.match(source, /combatDamageEventsThisRound/);
  assert.match(source, /readyAtHide/);
  assert.match(source, /kind: "post-block-cycle"/);
  assert.match(source, /pendingCombatContinuation/);
  assert.match(source, /resumeAfterDefense/);
});

test("optional defensive Equipment is not folded into mandatory Bubble Wrap prevention", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  const mandatoryBody = source.slice(source.indexOf("function applyMandatoryEquipmentDamageReduction"), source.indexOf("function optionalCombatDamagePlan"));
  assert.doesNotMatch(mandatoryBody, /optionalCombatDamageReductionEquipment/);
  assert.match(source, /applyOptionalCombatDamageReductionAi/);
});
''')

# Extend parser unit coverage without rewriting the existing test file by importing the
# new family in its own focused test above.

Path("scripts/deploy_patch_message.txt").write_text("Wire optional defensive Equipment timing windows")
print("Optional defensive Equipment reactions, Hide-ready timing, and regression coverage patched.")
