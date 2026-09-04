from pathlib import Path


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f"Expected patch anchor missing in {path}: {old[:140]!r}")
    if text.count(old) != 1:
        raise SystemExit(f"Patch anchor not unique in {path}: {old[:140]!r} count={text.count(old)}")
    write(path, text.replace(old, new, 1))


def append_once(path, marker, addition):
    text = read(path)
    if marker in text:
        raise SystemExit(f"Patch marker already present in {path}: {marker}")
    write(path, text.rstrip() + "\n\n" + addition.rstrip() + "\n")

# ---------------------------------------------------------------------------
# Reusable printed-text resolvers.
# ---------------------------------------------------------------------------
effect_path = "app/effect-resolvers.ts"
replace_once(
    effect_path,
    '  | { kind: "incoming-zone-penalty"; attackPowerPenalty: number }\n  | { kind: "defense-guard"; guard: number; reversalPower: number };',
    '  | { kind: "incoming-zone-penalty"; attackPowerPenalty: number }\n  | { kind: "defense-guard"; guard: number; reversalPower: number }\n  | { kind: "initiate-tempo-focus"; focus: number }\n  | { kind: "after-kata-focus"; focus: number }\n  | { kind: "first-hit-discard-focus"; discard: number; focus: number }\n  | { kind: "hit-direct-damage"; damage: number }\n  | { kind: "hit-next-initiate-focus"; focus: number }\n  | { kind: "numbered-attack-power"; attackNumber: number; power: number; minBelt: string };'
)
replace_once(
    effect_path,
    '  match = text.match(/^Exhaust:\\s*When you play a Defense outside your turn, it gets \\+(\\d+) Guard\\. At Green Belt or higher, if it Blocks, your Reversal this round gets \\+(\\d+) Attack Power/i);\n  if (match) return { kind: "defense-guard", guard: Number(match[1]), reversalPower: Number(match[2]) };\n\n  return null;',
    '  match = text.match(/^Exhaust:\\s*When you play a Defense outside your turn, it gets \\+(\\d+) Guard\\. At Green Belt or higher, if it Blocks, your Reversal this round gets \\+(\\d+) Attack Power/i);\n  if (match) return { kind: "defense-guard", guard: Number(match[1]), reversalPower: Number(match[2]) };\n\n  match = text.match(/^Exhaust at Initiate\\. If you have Tempo after Speed is set, gain (\\d+) Focus/i);\n  if (match) return { kind: "initiate-tempo-focus", focus: Number(match[1]) };\n\n  match = text.match(/^Exhaust after you play a Kata:\\s*Gain (\\d+) Focus/i);\n  if (match) return { kind: "after-kata-focus", focus: Number(match[1]) };\n\n  match = text.match(/^Exhaust:\\s*After your first Attack Hits this turn, discard (\\d+) cards? to gain (\\d+) Focus/i);\n  if (match) return { kind: "first-hit-discard-focus", discard: Number(match[1]), focus: Number(match[2]) };\n\n  match = text.match(/^Exhaust after one of your Attacks Hits:\\s*deal (\\d+) direct damage to the same target/i);\n  if (match) return { kind: "hit-direct-damage", damage: Number(match[1]) };\n\n  match = text.match(/^Exhaust after your Attack Hits:\\s*Generate (\\d+) Focus during your next Initiate/i);\n  if (match) return { kind: "hit-next-initiate-focus", focus: Number(match[1]) };\n\n  match = text.match(/^At ([A-Za-z]+) Belt or higher, exhaust:\\s*Your (second|third|fourth) normal Attack this turn gets \\+(\\d+) Attack Power/i);\n  if (match) {\n    const attackNumber = match[2].toLocaleLowerCase() === "second" ? 2 : match[2].toLocaleLowerCase() === "third" ? 3 : 4;\n    return { kind: "numbered-attack-power", attackNumber, power: Number(match[3]), minBelt: match[1] };\n  }\n\n  return null;'
)
append_once(
    effect_path,
    "mandatoryDamageReductionEquipment",
    r'''export function mandatoryDamageReductionEquipment(card: EffectCardLike) {
  const text = normalizedMinus(String(card.rulesText ?? "")).replace(/\s+/g, " ").trim();
  const match = text.match(/The first time you take damage each round, reduce that damage by (\d+); then exhaust this card\. Ready it during your next Initiate Phase/i);
  return match ? { reduce: Number(match[1]), readyAtInitiate: true } : null;
}'''
)
replace_once(
    effect_path,
    '  const item = text.match(/If you discarded an Item, your next Defense this round gets \\+(\\d+) Guard/i);\n  if (item && String(discarded.cardType ?? \'\').toLocaleLowerCase() === \'item\') {\n    nextDefenseGuard += Number(item[1]);\n    notes.push(`Item discarded: next Defense +${item[1]} Guard`);\n  }\n  return { focus, nextAttackPower, nextDefenseGuard, notes };',
    '  const item = text.match(/If you discarded an Item, your next Defense this round gets \\+(\\d+) Guard/i);\n  if (item && String(discarded.cardType ?? \'\').toLocaleLowerCase() === \'item\') {\n    nextDefenseGuard += Number(item[1]);\n    notes.push(`Item discarded: next Defense +${item[1]} Guard`);\n  }\n  const discardForFocus = text.match(/discard \\d+ cards? to gain (\\d+) Focus/i);\n  if (discardForFocus) {\n    focus += Number(discardForFocus[1]);\n    notes.push(`Discard cost paid: +${discardForFocus[1]} Focus`);\n  }\n  return { focus, nextAttackPower, nextDefenseGuard, notes };'
)

# ---------------------------------------------------------------------------
# Quick Duel state + trigger engine.
# ---------------------------------------------------------------------------
play_path = "app/playtest.tsx"
replace_once(
    play_path,
    'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, attackPiercing, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, deckLookPlan, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, discardChoiceFollowup, equipmentActivationPlan, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, mandatoryDiscardChoiceCount, optionalDiscardDrawChoice, passiveEquipmentGuard, readyEquipmentOnHit, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor, type DeckLookPlan } from "./effect-resolvers";',
    'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, attackPiercing, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, deckLookPlan, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, discardChoiceFollowup, equipmentActivationPlan, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, mandatoryDamageReductionEquipment, mandatoryDiscardChoiceCount, optionalDiscardDrawChoice, passiveEquipmentGuard, readyEquipmentOnHit, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor, type DeckLookPlan } from "./effect-resolvers";'
)
replace_once(
    play_path,
    '  pendingReversalBonusOnBlock?: number;\n  reversalAttackBonus?: number;\n  tempSpeed: number;',
    '  pendingReversalBonusOnBlock?: number;\n  reversalAttackBonus?: number;\n  nextInitiateFocus?: number;\n  readyAtInitiate?: string[];\n  lastAttackHit?: boolean;\n  tempSpeed: number;'
)

# Helpers live beside the existing Exhaust helpers.
anchor = '''function readyEquipment(board: Board, id: string) {
  return { ...board, exhaustedEquipment: (board.exhaustedEquipment ?? []).filter((candidate) => candidate !== id) };
}
'''
helpers = anchor + r'''

function beltAtLeast(board: Board, beltName: string) {
  const index = belts.findIndex((belt) => belt.name.toLocaleLowerCase() === beltName.toLocaleLowerCase());
  return index >= 0 && board.belt >= index;
}

function applyInitiateCarryover(board: Board) {
  const ready = new Set(board.readyAtInitiate ?? []);
  return {
    ...board,
    focus: board.focus + (board.nextInitiateFocus ?? 0),
    nextInitiateFocus: 0,
    exhaustedEquipment: (board.exhaustedEquipment ?? []).filter((id) => !ready.has(id)),
    readyAtInitiate: [],
  };
}

function equipmentActivationAvailable(board: Board, card: CardEntry, phase: Match["phase"]) {
  if (isEquipmentExhausted(board, card.id)) return false;
  const plan = equipmentActivationPlan(card);
  if (!plan) return false;
  const lastCard = board.cardsThisTurn.length ? cardFor(board.cardsThisTurn[board.cardsThisTurn.length - 1]) : null;
  if (plan.kind === "incoming-zone-penalty" || plan.kind === "defense-guard") return phase === "defense-window";
  if (plan.kind === "speed-cycle") return phase === "player-initiate" || phase === "player-yell";
  if (plan.kind === "initiate-tempo-focus") return phase === "player-initiate" && board.tempo;
  if (plan.kind === "next-attack-power" || plan.kind === "zone-attack") return phase === "player-yell";
  if (plan.kind === "after-kata-focus") return phase === "player-yell" && Boolean(lastCard && isKata(lastCard));
  if (plan.kind === "first-hit-discard-focus") return phase === "player-yell" && board.attacksThisTurn === 1 && Boolean(board.lastAttackHit) && board.hand.length >= plan.discard;
  if (plan.kind === "hit-direct-damage" || plan.kind === "hit-next-initiate-focus") return phase === "player-yell" && Boolean(board.lastAttackHit) && Boolean(lastCard && isAttack(lastCard));
  if (plan.kind === "numbered-attack-power") return phase === "player-yell" && board.attacksThisTurn === plan.attackNumber - 1 && beltAtLeast(board, plan.minBelt);
  return false;
}

function equipmentActivationSummary(card: CardEntry) {
  const plan = equipmentActivationPlan(card);
  if (!plan) return "Unsupported activation";
  if (plan.kind === "initiate-tempo-focus") return `Tempo ready · +${plan.focus} Focus`;
  if (plan.kind === "after-kata-focus") return `Kata resolved · +${plan.focus} Focus`;
  if (plan.kind === "first-hit-discard-focus") return `First Attack Hit · discard ${plan.discard} → +${plan.focus} Focus`;
  if (plan.kind === "hit-direct-damage") return `Attack Hit · ${plan.damage} direct damage`;
  if (plan.kind === "hit-next-initiate-focus") return `Attack Hit · +${plan.focus} Focus next Initiate`;
  if (plan.kind === "numbered-attack-power") return `Attack ${plan.attackNumber} · +${plan.power} Attack Power`;
  if (plan.kind === "next-attack-power") return `Next Attack +${plan.power} Attack Power`;
  if (plan.kind === "zone-attack") return `Choose a zone · ${plan.piercing ? `Piercing ${plan.piercing}` : `+${plan.power} Attack Power`}`;
  if (plan.kind === "speed-cycle") return `+${plan.speed} Speed${plan.draw ? ` · Tempo cycles ${plan.draw}` : ""}`;
  if (plan.kind === "incoming-zone-penalty") return `Call a zone · -${plan.attackPowerPenalty} Attack Power on a match`;
  if (plan.kind === "defense-guard") return `Your Defense gets +${plan.guard} Guard${plan.reversalPower ? " · Green+ Block boosts Reversal" : ""}`;
  return "Printed Equipment activation";
}

function applyMandatoryEquipmentDamageReduction(board: Board, damage: number) {
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

function autoTriggerAiAfterKataEquipment(board: Board) {
  let next = board;
  const notes: string[] = [];
  for (const id of board.equipment) {
    if (isEquipmentExhausted(next, id)) continue;
    const card = cardFor(id);
    const plan = card ? equipmentActivationPlan(card) : null;
    if (!card || !plan || plan.kind !== "after-kata-focus") continue;
    next = exhaustEquipment(next, id);
    next = { ...next, focus: next.focus + plan.focus };
    notes.push(`${card.name} exhausts after the Kata for +${plan.focus} Focus`);
  }
  return { board: next, notes };
}

function autoTriggerAiAfterAttackEquipment(board: Board, target: Board, hit: boolean) {
  let attacker = { ...board, lastAttackHit: hit };
  let defender = target;
  const notes: string[] = [];
  if (!hit) return { attacker, target: defender, notes };
  for (const id of board.equipment) {
    if (isEquipmentExhausted(attacker, id)) continue;
    const card = cardFor(id);
    const plan = card ? equipmentActivationPlan(card) : null;
    if (!card || !plan) continue;
    if (plan.kind === "first-hit-discard-focus" && attacker.attacksThisTurn === 1 && attacker.hand.length >= plan.discard) {
      attacker = exhaustEquipment(attacker, id);
      const ranked = [...attacker.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)));
      const discarded = ranked.slice(0, plan.discard);
      attacker = { ...attacker, hand: attacker.hand.filter((candidate) => !discarded.includes(candidate)), discard: [...attacker.discard, ...discarded], focus: attacker.focus + plan.focus };
      notes.push(`${card.name} exhausts; computer discards ${plan.discard} and gains ${plan.focus} Focus`);
    } else if (plan.kind === "hit-direct-damage") {
      attacker = exhaustEquipment(attacker, id);
      defender = { ...defender, hp: Math.max(0, defender.hp - plan.damage), damageTaken: defender.damageTaken + plan.damage };
      attacker = { ...attacker, damageDealt: attacker.damageDealt + plan.damage };
      notes.push(`${card.name} exhausts for ${plan.damage} direct damage`);
    } else if (plan.kind === "hit-next-initiate-focus") {
      attacker = exhaustEquipment(attacker, id);
      attacker = { ...attacker, nextInitiateFocus: (attacker.nextInitiateFocus ?? 0) + plan.focus };
      notes.push(`${card.name} exhausts; +${plan.focus} Focus scheduled for next Initiate`);
    }
  }
  return { attacker, target: defender, notes };
}
'''
replace_once(play_path, anchor, helpers)

# Mandatory Armor reduction participates in the same damage pipeline as fighter reduction.
old_reduce = '''function reduceDamageForFighter(board: Board, damage: number): { board: Board; damage: number; note: string | null } {
  const fighter = cardFor(board.fighterId);
  if (!fighter || board.damageReductionUsed || damage <= 0) return { board, damage, note: null };
  const protects = fighter.name === "Sentry Bobby" || (fighter.name === "Crash Test Dummy" && damage >= 4);
  if (!protects) return { board, damage, note: null };
  return { board: { ...board, damageReductionUsed: true }, damage: Math.max(0, damage - 1), note: `${fighter.name} reduces the Hit by 1` };
}'''
new_reduce = '''function reduceDamageForFighter(board: Board, damage: number): { board: Board; damage: number; note: string | null } {
  const equipmentReduction = applyMandatoryEquipmentDamageReduction(board, damage);
  let next = equipmentReduction.board;
  let remaining = equipmentReduction.damage;
  const notes = [...equipmentReduction.notes];
  const fighter = cardFor(next.fighterId);
  if (fighter && !next.damageReductionUsed && remaining > 0) {
    const protects = fighter.name === "Sentry Bobby" || (fighter.name === "Crash Test Dummy" && remaining >= 4);
    if (protects) {
      next = { ...next, damageReductionUsed: true };
      remaining = Math.max(0, remaining - 1);
      notes.push(`${fighter.name} reduces the Hit by 1`);
    }
  }
  return { board: next, damage: remaining, note: notes.length ? notes.join("; ") : null };
}'''
replace_once(play_path, old_reduce, new_reduce)

# Initial state.
replace_once(
    play_path,
    'deck: shuffle(starterIds), hand: [], discard: [], playArea: [], equipment: [], exhaustedEquipment: [], equipmentAttackPlan: null, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: 0,',
    'deck: shuffle(starterIds), hand: [], discard: [], playArea: [], equipment: [], exhaustedEquipment: [], equipmentAttackPlan: null, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: 0, nextInitiateFocus: 0, readyAtInitiate: [], lastAttackHit: false,'
)

# AI Initiate activation + triggered plans.
replace_once(
    play_path,
    'function autoActivateAiTurnEquipment(board: Board) {\n  let next = board;',
    'function autoActivateAiTurnEquipment(board: Board) {\n  let next = board;'
)
replace_once(
    play_path,
    '    if (!card || !plan || plan.kind !== "speed-cycle") continue;\n    next = exhaustEquipment(next, id);\n    next = { ...next, tempSpeed: next.tempSpeed + plan.speed, speedChangedThisRound: true };\n    notes.push(`${card.name} exhausts for +${plan.speed} Speed`);\n    if (next.tempo && plan.draw) {',
    '    if (!card || !plan) continue;\n    if (plan.kind === "initiate-tempo-focus") {\n      if (!next.tempo) continue;\n      next = exhaustEquipment(next, id);\n      next = { ...next, focus: next.focus + plan.focus };\n      notes.push(`${card.name} exhausts at Initiate for +${plan.focus} Focus`);\n      continue;\n    }\n    if (plan.kind !== "speed-cycle") continue;\n    next = exhaustEquipment(next, id);\n    next = { ...next, tempSpeed: next.tempSpeed + plan.speed, speedChangedThisRound: true };\n    notes.push(`${card.name} exhausts for +${plan.speed} Speed`);\n    if (next.tempo && plan.draw) {'
)
replace_once(
    play_path,
    '    if (plan.kind === "next-attack-power") {\n      next = exhaustEquipment(next, id);\n      power += plan.power;\n      notes.push(`${card.name} exhausts for +${plan.power} Attack Power`);\n      continue;\n    }\n    if (plan.kind === "zone-attack") {',
    '    if (plan.kind === "next-attack-power") {\n      next = exhaustEquipment(next, id);\n      power += plan.power;\n      notes.push(`${card.name} exhausts for +${plan.power} Attack Power`);\n      continue;\n    }\n    if (plan.kind === "numbered-attack-power") {\n      if (next.attacksThisTurn !== plan.attackNumber - 1 || !beltAtLeast(next, plan.minBelt)) continue;\n      next = exhaustEquipment(next, id);\n      power += plan.power;\n      notes.push(`${card.name} exhausts for Attack ${plan.attackNumber}: +${plan.power} Attack Power`);\n      continue;\n    }\n    if (plan.kind === "zone-attack") {'
)

# Player activation uses one legality function and handles the new trigger plans.
replace_once(
    play_path,
    '      if (!card || !plan) return current;\n      if ((plan.kind === "next-attack-power" || plan.kind === "zone-attack") && current.phase !== "player-yell") return current;\n      if (plan.kind === "speed-cycle" && current.phase !== "player-initiate" && current.phase !== "player-yell") return current;\n      if ((plan.kind === "incoming-zone-penalty" || plan.kind === "defense-guard") && current.phase !== "defense-window") return current;\n      let player = exhaustEquipment(current.player, id);\n      let pendingChoice: PendingChoice | null = null;\n      let note = `${card.name} exhausted.`;',
    '      if (!card || !plan || !equipmentActivationAvailable(current.player, card, current.phase)) return current;\n      let player = exhaustEquipment(current.player, id);\n      let ai = current.ai;\n      let winner = current.winner;\n      let pendingChoice: PendingChoice | null = null;\n      let note = `${card.name} exhausted.`;'
)
replace_once(
    play_path,
    '      } else if (plan.kind === "defense-guard") {\n        const greenBeltIndex = belts.findIndex((belt) => belt.name.toLocaleLowerCase() === "green");\n        const reversalPower = greenBeltIndex >= 0 && player.belt >= greenBeltIndex ? plan.reversalPower : 0;\n        player = {\n          ...player,\n          equipmentDefenseGuard: (player.equipmentDefenseGuard ?? 0) + plan.guard,\n          pendingReversalBonusOnBlock: (player.pendingReversalBonusOnBlock ?? 0) + reversalPower,\n        };\n        note += ` Your next Defense in this Reaction Window gets +${plan.guard} Guard.${reversalPower ? ` A Block primes the Reversal for +${reversalPower} Attack Power.` : ""}`;\n      }\n      return write(current, note, { player, pendingChoice });',
    '      } else if (plan.kind === "defense-guard") {\n        const greenBeltIndex = belts.findIndex((belt) => belt.name.toLocaleLowerCase() === "green");\n        const reversalPower = greenBeltIndex >= 0 && player.belt >= greenBeltIndex ? plan.reversalPower : 0;\n        player = {\n          ...player,\n          equipmentDefenseGuard: (player.equipmentDefenseGuard ?? 0) + plan.guard,\n          pendingReversalBonusOnBlock: (player.pendingReversalBonusOnBlock ?? 0) + reversalPower,\n        };\n        note += ` Your next Defense in this Reaction Window gets +${plan.guard} Guard.${reversalPower ? ` A Block primes the Reversal for +${reversalPower} Attack Power.` : ""}`;\n      } else if (plan.kind === "initiate-tempo-focus" || plan.kind === "after-kata-focus") {\n        player = { ...player, focus: player.focus + plan.focus };\n        note += ` +${plan.focus} Focus.`;\n      } else if (plan.kind === "first-hit-discard-focus") {\n        pendingChoice = { kind: "discard-hand", sourceCardId: id, remaining: Math.min(plan.discard, player.hand.length) };\n        note += ` Choose ${plan.discard} card${plan.discard === 1 ? "" : "s"} to discard; completing the cost gains ${plan.focus} Focus.`;\n      } else if (plan.kind === "hit-direct-damage") {\n        ai = { ...ai, hp: Math.max(0, ai.hp - plan.damage), damageTaken: ai.damageTaken + plan.damage };\n        player = { ...player, damageDealt: player.damageDealt + plan.damage, xp: ai.hp - plan.damage <= 0 ? player.xp + 2 : player.xp };\n        winner = ai.hp ? winner : "player";\n        note += ` ${plan.damage} direct damage to ${cardFor(ai.fighterId)?.name ?? "the opponent"}.`;\n      } else if (plan.kind === "hit-next-initiate-focus") {\n        player = { ...player, nextInitiateFocus: (player.nextInitiateFocus ?? 0) + plan.focus };\n        note += ` +${plan.focus} Focus scheduled for your next Initiate.`;\n      } else if (plan.kind === "numbered-attack-power") {\n        player = { ...player, nextAttackBonus: player.nextAttackBonus + plan.power };\n        note += ` Attack ${plan.attackNumber} gets +${plan.power} Attack Power.`;\n      }\n      return write(current, note, { player, ai, pendingChoice, winner });'
)

# Set/close the latest-hit trigger window.
replace_once(
    play_path,
    'damageDealt: current.player.damageDealt + damage }, card, "player");',
    'damageDealt: current.player.damageDealt + damage, lastAttackHit: hit }, card, "player");'
)
replace_once(
    play_path,
    'let nextPlayer = markCompletedTask(applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id], focus: current.player.focus + locationModifier.value }, card, "player"));',
    'let nextPlayer = markCompletedTask(applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id], focus: current.player.focus + locationModifier.value, lastAttackHit: false }, card, "player"));'
)
replace_once(
    play_path,
    '      defensePracticeUsed: true,\n    };',
    '      defensePracticeUsed: true,\n      lastAttackHit: false,\n    };'
)

# AI support cards can trigger Kata Gear.
replace_once(
    play_path,
    '  const fighter = cardFor(current.ai.fighterId);\n  const turnEquipment = autoActivateAiTurnEquipment(current.ai);\n  const aiStart = turnEquipment.board;',
    '  const fighter = cardFor(current.ai.fighterId);\n  const initiatedAi = applyInitiateCarryover(current.ai);\n  const turnEquipment = autoActivateAiTurnEquipment(initiatedAi);\n  const aiStart = turnEquipment.board;'
)
replace_once(
    play_path,
    '  const played: string[] = [];\n  let nextPlayer = current.player;',
    '  const played: string[] = [];\n  const triggeredEquipment: string[] = [];\n  let nextPlayer = current.player;'
)
replace_once(
    play_path,
    '    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], focus: nextAi.focus + locationModifier.value }, card, "ai");\n    nextAi = resolveAiDeckLook(nextAi, card);',
    '    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], focus: nextAi.focus + locationModifier.value, lastAttackHit: false }, card, "ai");\n    if (isKata(card)) {\n      const kataEquipment = autoTriggerAiAfterKataEquipment(nextAi);\n      nextAi = kataEquipment.board;\n      triggeredEquipment.push(...kataEquipment.notes);\n    }\n    nextAi = resolveAiDeckLook(nextAi, card);'
)
replace_once(
    play_path,
    '    ...turnEquipment.notes,\n    ...(practiceId ? [`Defense Practice with ${cardFor(practiceId)?.name}`] : []),\n    ...played,',
    '    ...turnEquipment.notes,\n    ...triggeredEquipment,\n    ...(practiceId ? [`Defense Practice with ${cardFor(practiceId)?.name}`] : []),\n    ...played,'
)

# AI post-hit Equipment and direct damage.
replace_once(
    play_path,
    '    let nextAi = markCompletedTask({ ...current.ai, damageDealt: current.ai.damageDealt + damage, hitThisTurn: current.ai.hitThisTurn || hit });\n    nextAi = applyCardEffects(nextAi, aiCard, "ai", hit ? "onHit" : "afterResolve");\n    if (hit) nextAi = applyCardEffects(nextAi, aiCard, "ai", "afterResolve");',
    '    let nextAi = markCompletedTask({ ...current.ai, damageDealt: current.ai.damageDealt + damage, hitThisTurn: current.ai.hitThisTurn || hit, lastAttackHit: hit });\n    nextAi = applyCardEffects(nextAi, aiCard, "ai", hit ? "onHit" : "afterResolve");\n    if (hit) nextAi = applyCardEffects(nextAi, aiCard, "ai", "afterResolve");\n    const aiTriggeredEquipment = autoTriggerAiAfterAttackEquipment(nextAi, nextPlayer, hit);\n    nextAi = aiTriggeredEquipment.attacker;\n    nextPlayer = aiTriggeredEquipment.target;'
)
replace_once(
    play_path,
    '...(reduced.note ? [reduced.note] : [])];\n    const resolved = write(current, `${tempoBonus ? "Tempo +1 Guard. " : ""}${message}',
    '...aiTriggeredEquipment.notes, ...(reduced.note ? [reduced.note] : [])];\n    const resolved = write(current, `${tempoBonus ? "Tempo +1 Guard. " : ""}${message}'
)

# Initiate carryover: delayed Focus and cards explicitly scheduled to ready at Initiate.
replace_once(
    play_path,
    '  if (current.turnIndex === 0) return { ...finished, phase: "player-initiate" as const, turnIndex: 1 as const, log: ["You are second in this round\'s initiative order. Initiate begins now.", ...finished.log].slice(0, 32) };',
    '  if (current.turnIndex === 0) {\n    const player = applyInitiateCarryover(finished.player);\n    const carryover = player.focus - finished.player.focus;\n    return { ...finished, player, phase: "player-initiate" as const, turnIndex: 1 as const, log: [`You are second in this round\'s initiative order. Initiate begins now.${carryover ? ` Delayed effects generate ${carryover} Focus.` : ""}`, ...finished.log].slice(0, 32) };\n  }'
)
replace_once(
    play_path,
    '  const player = { ...current.player, xp: current.player.xp + 1, tempo: true, tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, equipmentAttackPlan: null, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: 0, exhaustedEquipment: [], attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], damageReductionUsed: false, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] };',
    '  const player = { ...current.player, xp: current.player.xp + 1, tempo: true, tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, equipmentAttackPlan: null, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: 0, exhaustedEquipment: [], readyAtInitiate: [], lastAttackHit: false, attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], damageReductionUsed: false, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] };'
)
replace_once(
    play_path,
    '  const ai = { ...current.ai, xp: current.ai.xp + 1, tempo: true, tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, equipmentAttackPlan: null, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: 0, exhaustedEquipment: [], attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], damageReductionUsed: false, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] };',
    '  const ai = { ...current.ai, xp: current.ai.xp + 1, tempo: true, tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, equipmentAttackPlan: null, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: 0, exhaustedEquipment: [], readyAtInitiate: [], lastAttackHit: false, attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], damageReductionUsed: false, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] };'
)
replace_once(
    play_path,
    '  const playerFirst = fighterStat(player, "Speed") >= fighterStat(ai, "Speed");\n  const turnOrder: Match["turnOrder"] = playerFirst ? ["player", "ai"] : ["ai", "player"];',
    '  const playerFirst = fighterStat(player, "Speed") >= fighterStat(ai, "Speed");\n  const initiatedPlayer = playerFirst ? applyInitiateCarryover(player) : player;\n  const turnOrder: Match["turnOrder"] = playerFirst ? ["player", "ai"] : ["ai", "player"];'
)
# Only the advanceRound return uses this exact fragment after the new initiatedPlayer declaration.
replace_once(
    play_path,
    '  return { ...current, ...marketState, player, ai, marketPurchasedThisRound: false, pendingDiscard: null, pendingChoice: null, locationId, locations: sceneChanges ? freshLocations.slice(1) : current.locations, round: nextRound, phase: playerFirst ? "player-initiate" as const : "ai-ready" as const, turnOrder, turnIndex: 0 as const, selectedAttackId: null, log:',
    '  return { ...current, ...marketState, player: initiatedPlayer, ai, marketPurchasedThisRound: false, pendingDiscard: null, pendingChoice: null, locationId, locations: sceneChanges ? freshLocations.slice(1) : current.locations, round: nextRound, phase: playerFirst ? "player-initiate" as const : "ai-ready" as const, turnOrder, turnIndex: 0 as const, selectedAttackId: null, log:'
)

# Surface legal Equipment trigger buttons next to existing reaction actions.
replace_once(
    play_path,
    '  const equipmentReactions = match.phase === "defense-window"\n    ? player.equipment.map(cardFor).filter((card): card is CardEntry => {\n        if (!card || isEquipmentExhausted(player, card.id)) return false;\n        const plan = equipmentActivationPlan(card);\n        return plan?.kind === "incoming-zone-penalty" || plan?.kind === "defense-guard";\n      })\n    : [];',
    '  const equipmentReactions = match.phase === "defense-window"\n    ? player.equipment.map(cardFor).filter((card): card is CardEntry => {\n        if (!card || isEquipmentExhausted(player, card.id)) return false;\n        const plan = equipmentActivationPlan(card);\n        return plan?.kind === "incoming-zone-penalty" || plan?.kind === "defense-guard";\n      })\n    : [];\n  const equipmentActions = (match.phase === "player-initiate" || match.phase === "player-yell")\n    ? player.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card && equipmentActivationAvailable(player, card, match.phase)))\n    : [];'
)
replace_once(
    play_path,
    '        {equipmentReactions.length > 0 && <div className="equipment-reaction-strip" aria-label="Available Equipment reactions"><span>Equipment reactions</span>{equipmentReactions.map((item) => { const plan = equipmentActivationPlan(item)!; return <button type="button" disabled={Boolean(match.pendingChoice)} onClick={() => activateEquipment(item.id)} key={item.id}><b>Exhaust {item.name}</b><small>{plan.kind === "incoming-zone-penalty" ? `Call a zone · -${plan.attackPowerPenalty} Attack Power on a match` : plan.kind === "defense-guard" ? `Your Defense gets +${plan.guard} Guard${plan.reversalPower ? " · Green+ Block boosts Reversal" : ""}` : "Unsupported activation"}</small></button>; })}</div>}\n        <div className="play-card-row">',
    '        {equipmentReactions.length > 0 && <div className="equipment-reaction-strip" aria-label="Available Equipment reactions"><span>Equipment reactions</span>{equipmentReactions.map((item) => <button type="button" disabled={Boolean(match.pendingChoice)} onClick={() => activateEquipment(item.id)} key={item.id}><b>Exhaust {item.name}</b><small>{equipmentActivationSummary(item)}</small></button>)}</div>}\n        {equipmentActions.length > 0 && <div className="equipment-reaction-strip equipment-trigger-strip" aria-label="Available Equipment actions"><span>Equipment actions</span>{equipmentActions.map((item) => <button type="button" disabled={Boolean(match.pendingChoice)} onClick={() => activateEquipment(item.id)} key={item.id}><b>Exhaust {item.name}</b><small>{equipmentActivationSummary(item)}</small></button>)}</div>}\n        <div className="play-card-row">'
)

# Make Guard contribution explicit in logs, including Cover Up +1 Guard.
replace_once(
    play_path,
    'const modifiers = [...(pending.modifierNotes ?? []), ...(exhaustedPiercingBonus ? [`Exhausted Equipment adds Piercing ${exhaustedPiercingBonus}`] : []),',
    'const modifiers = [...(pending.modifierNotes ?? []), ...(defenseCard ? [`${defenseCard.name} +${cardPower(defenseCard)} Guard`] : []), ...(exhaustedPiercingBonus ? [`Exhausted Equipment adds Piercing ${exhaustedPiercingBonus}`] : []),'
)

# Tests: parser coverage, Cover Up contract, integration state.
test_path = "tests/effect-resolvers.test.mjs"
replace_once(
    test_path,
    'mandatoryDiscardChoiceCount, optionalDiscardDrawChoice, passiveEquipmentGuard, readyEquipmentOnHit, targetNextAttackPenalty',
    'mandatoryDamageReductionEquipment, mandatoryDiscardChoiceCount, optionalDiscardDrawChoice, passiveEquipmentGuard, readyEquipmentOnHit, targetNextAttackPenalty'
)
append_once(
    test_path,
    'triggered Equipment activation plans compile',
    r'''test("triggered Equipment activation plans compile from printed timing clauses", () => {
  assert.deepEqual(equipmentActivationPlan({ rulesText: "Exhaust at Initiate. If you have Tempo after Speed is set, gain 1 Focus." }), { kind: "initiate-tempo-focus", focus: 1 });
  assert.deepEqual(equipmentActivationPlan({ rulesText: "Exhaust after you play a Kata: Gain 1 Focus. Once per round." }), { kind: "after-kata-focus", focus: 1 });
  assert.deepEqual(equipmentActivationPlan({ rulesText: "Exhaust: After your first Attack Hits this turn, discard 1 card to gain 1 Focus." }), { kind: "first-hit-discard-focus", discard: 1, focus: 1 });
  assert.deepEqual(equipmentActivationPlan({ rulesText: "Exhaust after one of your Attacks Hits: deal 1 direct damage to the same target." }), { kind: "hit-direct-damage", damage: 1 });
  assert.deepEqual(equipmentActivationPlan({ rulesText: "Exhaust after your Attack Hits: Generate 1 Focus during your next Initiate." }), { kind: "hit-next-initiate-focus", focus: 1 });
  assert.deepEqual(equipmentActivationPlan({ rulesText: "At Orange Belt or higher, exhaust: Your second normal Attack this turn gets +2 Attack Power." }), { kind: "numbered-attack-power", attackNumber: 2, power: 2, minBelt: "Orange" });
});

test("mandatory first-damage Armor reduction is parsed separately from optional reduction", () => {
  assert.deepEqual(mandatoryDamageReductionEquipment({ rulesText: "Chest slot. +1 DEF against all zones. The first time you take damage each round, reduce that damage by 2; then exhaust this card. Ready it during your next Initiate Phase." }), { reduce: 2, readyAtInitiate: true });
  assert.equal(mandatoryDamageReductionEquipment({ rulesText: "The first time you take combat damage each round, you may exhaust this to reduce that damage by 1." }), null);
});

test("discard-as-cost Equipment followups award Focus only after the player pays the discard", () => {
  const result = discardChoiceFollowup({ rulesText: "Exhaust: After your first Attack Hits this turn, discard 1 card to gain 1 Focus." }, { focusValue: 2 });
  assert.equal(result.focus, 1);
  assert.match(result.notes.join(" "), /Discard cost paid/);
});'''
)

integration_path = "tests/playtest-effect-integration.test.mjs"
append_once(
    integration_path,
    'trigger-heavy Equipment families',
    r'''test("Quick Duel wires trigger-heavy Equipment families and Initiate carryover", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /equipmentActivationAvailable/);
  assert.match(source, /equipmentActions/);
  assert.match(source, /autoTriggerAiAfterKataEquipment/);
  assert.match(source, /autoTriggerAiAfterAttackEquipment/);
  assert.match(source, /nextInitiateFocus/);
  assert.match(source, /applyInitiateCarryover/);
  assert.match(source, /lastAttackHit/);
  assert.match(source, /applyMandatoryEquipmentDamageReduction/);
});

test("Cover Up remains the weak universal starter Defense and its printed Guard is added to defense math", async () => {
  const catalog = JSON.parse(await readFile(new URL("../app/data/cards.json", import.meta.url), "utf8"));
  const byName = new Map(catalog.cards.map((card) => [card.name, card]));
  const cover = byName.get("Cover Up");
  assert.equal(cover.zone, "Any");
  assert.equal(Number(cover.stats.Guard), 1);
  for (const name of ["High Guard", "Center Guard", "Low Guard"]) assert.equal(Number(byName.get(name).stats.Guard), 2);
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /defensePower \+= cardPower\(defenseCard\)/);
  assert.match(source, /\$\{defenseCard\.name\} \+\$\{cardPower\(defenseCard\)\} Guard/);
});'''
)

# Remove the temporary patch-fix workflow branch from earlier maintenance work.
workflow_path = ".github/workflows/deploy-pages.yml"
replace_once(
    workflow_path,
    '          if [ -f scripts/deploy_patch.py ]; then\n            echo "present=true" >> "$GITHUB_OUTPUT"\n            if [ -f scripts/deploy_patch_fix.py ]; then\n              python scripts/deploy_patch_fix.py\n            else\n              python scripts/deploy_patch.py\n            fi\n          else',
    '          if [ -f scripts/deploy_patch.py ]; then\n            echo "present=true" >> "$GITHUB_OUTPUT"\n            python scripts/deploy_patch.py\n          else'
)

print("Triggered Equipment effects, Bubble Wrap reduction, Cover Up contract, and workflow cleanup patched.")
