from pathlib import Path
import re

root = Path('.')
playtest_path = root / 'app/playtest.tsx'
playtest = playtest_path.read_text()

resolver_path = root / 'app/effect-resolvers.ts'
resolver_path.write_text(r'''export type EffectCardLike = {
  name?: string;
  subtype?: string;
  rulesText?: string | null;
  zone?: string | null;
  tags?: string[];
  stats?: Record<string, string | number | null | undefined>;
  details?: Record<string, string | number | null | undefined>;
};

function numberValue(value: unknown) {
  const match = String(value ?? "").match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizedMinus(text: string) {
  return text.replace(/[−–—]/g, "-");
}

export function isDefenseEquipment(card: EffectCardLike) {
  return String(card.subtype ?? "").toLocaleLowerCase() === "defense equipment";
}

export function passiveEquipmentGuard(card: EffectCardLike) {
  if (isDefenseEquipment(card)) return 0;
  return numberValue(card.stats?.Guard);
}

export function defenseEquipmentBonus(card: EffectCardLike, zone: string) {
  if (!isDefenseEquipment(card)) return 0;
  const text = normalizedMinus(String(card.rulesText ?? ""));
  const explicit = text.match(/\+(\d+)\s+DEF\s+against\s+([^.]+?)(?:\s+Attacks?|\s+zones?)\b/i);
  if (explicit) {
    const amount = Number(explicit[1]);
    const scope = explicit[2].toLocaleLowerCase();
    if (/all|any|universal/.test(scope)) return amount;
    const target = zone.toLocaleLowerCase();
    const zones = ["high", "mid", "low"].filter((candidate) => new RegExp(`\\b${candidate}\\b`, "i").test(scope));
    return zones.includes(target) ? amount : 0;
  }

  const universal = text.match(/\+(\d+)\s+DEF\s+against\s+all\s+zones/i);
  if (universal) return Number(universal[1]);

  const guard = numberValue(card.stats?.Guard);
  if (!guard) return 0;
  const scope = `${card.zone ?? ""} ${card.details?.Zone ?? ""} ${card.details?.["Default Zone"] ?? ""} ${text}`.toLocaleLowerCase();
  if (/\b(?:all|any|universal)\b/.test(scope)) return guard;
  return new RegExp(`\\b${zone.toLocaleLowerCase()}\\b`, "i").test(scope) ? guard : 0;
}

export function afterDefenseNextAttackBonus(cards: EffectCardLike[]) {
  let amount = 0;
  const sources: string[] = [];
  for (const card of cards) {
    const text = String(card.rulesText ?? "");
    const match = text.match(/After you play a Defense(?: card| Technique)?[^.]*next Attack(?: this turn)? gets \+(\d+) Attack Power/i);
    if (!match) continue;
    amount += Number(match[1]);
    sources.push(card.name ?? "Equipment");
  }
  return { amount, sources };
}

export function targetNextAttackPenalty(card: EffectCardLike) {
  const text = normalizedMinus(String(card.rulesText ?? ""));
  const match = text.match(/(?:target|opponent)[’']s next Attack(?: this round)? (?:gets|has) -(\d+) Attack Power/i);
  return match ? Number(match[1]) : 0;
}

export function targetSpeedPenaltyUntilHonor(card: EffectCardLike) {
  const text = normalizedMinus(String(card.rulesText ?? ""));
  const match = text.match(/(?:target(?:[’']s active Character)?|opponent) gets? -(\d+) Speed until (?:the )?next Honor Phase/i);
  return match ? Number(match[1]) : 0;
}

export function destroysAfterUse(card: EffectCardLike) {
  return /Destroy this after use\.?/i.test(String(card.rulesText ?? ""));
}
''')

# Import reusable deterministic resolvers.
import_line = 'import { compileCardEffects, describeEffectPlan } from "./card-effects";\n'
resolver_import = 'import { afterDefenseNextAttackBonus, defenseEquipmentBonus, destroysAfterUse, passiveEquipmentGuard, targetNextAttackPenalty, targetSpeedPenaltyUntilHonor } from "./effect-resolvers";\n'
if resolver_import not in playtest:
    if import_line not in playtest: raise SystemExit('card-effects import anchor missing')
    playtest = playtest.replace(import_line, import_line + resolver_import, 1)

# Persist destroyed/exiled cards without invalidating existing schema-6 saves.
if 'destroyed?: string[];' not in playtest:
    playtest = playtest.replace('  cardsBought: number;\n};', '  cardsBought: number;\n  destroyed?: string[];\n};', 1)
if 'destroyed: [],' not in playtest:
    playtest = playtest.replace('    damageDealt: 0, damageTaken: 0, cardsBought: 0,\n', '    damageDealt: 0, damageTaken: 0, cardsBought: 0, destroyed: [],\n', 1)

# Defense Equipment is conditional by zone; only non-armor Guard is static.
old_fighter = '''    if (stat === "ATK") return total + numberValue(card.stats["Attack Bonus"]);\n    if (stat === "DEF") return total + numberValue(card.stats.Guard);\n    return total;'''
new_fighter = '''    if (stat === "ATK") return total + numberValue(card.stats["Attack Bonus"]);\n    if (stat === "DEF") return total + passiveEquipmentGuard(card);\n    return total;'''
if old_fighter not in playtest: raise SystemExit('fighterStat equipment block missing')
playtest = playtest.replace(old_fighter, new_fighter, 1)

# Insert combat-state helpers once.
helper_anchor = 'function emptyBoard(fighterId: string): Board {'
helpers = r'''function equipmentDefenseModifier(board: Board, zone: string): CombatModifier {
  let value = 0;
  const notes: string[] = [];
  for (const id of board.equipment) {
    const card = cardFor(id);
    if (!card) continue;
    const bonus = defenseEquipmentBonus(card, zone);
    if (!bonus) continue;
    value += bonus;
    notes.push(`${card.name} +${bonus} DEF vs ${zone}`);
  }
  return { value, notes };
}

function applyAfterDefenseEquipment(board: Board) {
  const equipped = board.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card));
  const bonus = afterDefenseNextAttackBonus(equipped);
  if (!bonus.amount) return { board, notes: [] as string[] };
  return {
    board: { ...board, nextAttackBonus: board.nextAttackBonus + bonus.amount },
    notes: [`${bonus.sources.join(" + ")} primes next Attack +${bonus.amount}`],
  };
}

function applyTargetHitDebuffs(board: Board, card: CardEntry) {
  const attackPenalty = targetNextAttackPenalty(card);
  const speedPenalty = targetSpeedPenaltyUntilHonor(card);
  const notes: string[] = [];
  let next = board;
  if (attackPenalty) {
    next = { ...next, nextAttackBonus: next.nextAttackBonus - attackPenalty };
    notes.push(`target next Attack -${attackPenalty} Attack Power`);
  }
  if (speedPenalty) {
    next = { ...next, tempSpeed: next.tempSpeed - speedPenalty };
    notes.push(`target -${speedPenalty} Speed until Honor`);
  }
  return { board: next, notes };
}

function destroyResolvedConsumable(board: Board, card: CardEntry) {
  if (!destroysAfterUse(card)) return board;
  return {
    ...board,
    playArea: removeOne(board.playArea, card.id),
    destroyed: [...(board.destroyed ?? []), card.id],
  };
}

'''
if 'function equipmentDefenseModifier(' not in playtest:
    if helper_anchor not in playtest: raise SystemExit('emptyBoard anchor missing')
    playtest = playtest.replace(helper_anchor, helpers + helper_anchor, 1)

# bestDefense must rank legal Defense cards against the actual zone-aware standing DEF.
old_best = '    return { id, total: fighterStat(board, "DEF") + cardPower(card) + modifier };'
new_best = '    return { id, total: fighterStat(board, "DEF") + equipmentDefenseModifier(board, zone).value + cardPower(card) + modifier };'
if old_best not in playtest: raise SystemExit('bestDefense total anchor missing')
playtest = playtest.replace(old_best, new_best, 1)

# Player attack -> AI defense: zonal equipment, target debuffs, and defense-trigger Equipment.
old_decl = '''    const defenseModifier = locationDefenseModifier(location, defenseCard, current.ai, zone);\n    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + (defenseCard ? cardPower(defenseCard) : 0) + defenseModifier.value);'''
new_decl = '''    const defenseModifier = locationDefenseModifier(location, defenseCard, current.ai, zone);\n    const armorModifier = equipmentDefenseModifier(current.ai, zone);\n    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) : 0) + defenseModifier.value);'''
if old_decl not in playtest: raise SystemExit('declareAttack defense block missing')
playtest = playtest.replace(old_decl, new_decl, 1)

old_next_ai = '    let nextAi = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit, damageTaken: reduced.board.damageTaken + damage };\n    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true };'
new_next_ai = '    let nextAi = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit, damageTaken: reduced.board.damageTaken + damage };\n    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card) : { board: nextAi, notes: [] as string[] };\n    nextAi = targetDebuff.board;\n    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true };'
if old_next_ai not in playtest: raise SystemExit('declareAttack nextAi block missing')
playtest = playtest.replace(old_next_ai, new_next_ai, 1)

old_def_effects = '''    if (defenseCard) {\n      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onPlay");\n      if (!hit) nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onBlock");\n      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve");\n    }'''
new_def_effects = '''    let defenseFollowupNotes: string[] = [];\n    if (defenseCard) {\n      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onPlay");\n      const followup = applyAfterDefenseEquipment(nextAi);\n      nextAi = followup.board;\n      defenseFollowupNotes = followup.notes;\n      if (!hit) nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onBlock");\n      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve");\n    }'''
if old_def_effects not in playtest: raise SystemExit('declareAttack defense effects block missing')
playtest = playtest.replace(old_def_effects, new_def_effects, 1)

old_mods = '    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...comboModifier.notes, ...defenseModifier.notes, ...(reduced.note ? [reduced.note] : [])];'
new_mods = '    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...comboModifier.notes, ...armorModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...defenseFollowupNotes, ...(reduced.note ? [reduced.note] : [])];'
if old_mods not in playtest: raise SystemExit('declareAttack modifier block missing')
playtest = playtest.replace(old_mods, new_mods, 1)
playtest = playtest.replace("'s base DEF; no Defense card was played.", "'s standing DEF/Equipment; no Defense card was played.", 1)

# Player support Consumables marked Destroy leave the game immediately.
old_support = '''    const nextPlayer = markCompletedTask(applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id], focus: current.player.focus + locationModifier.value }, card, "player"));\n    const pendingDiscard = card.name === "Morning-Shift Meditation" && nextPlayer.hand.length ? { sourceCardId: id, remaining: 1 } : null;\n    return write(current, `${card.name} played. ${pendingDiscard ? "Draw 1 card, then choose a card to discard." : cardEffectNote(card)}${locationModifier.notes.length ? ` ${locationModifier.notes.join("; ")}.` : ""}`, { player: nextPlayer, pendingDiscard });'''
new_support = '''    let nextPlayer = markCompletedTask(applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id], focus: current.player.focus + locationModifier.value }, card, "player"));\n    const destroyedAfterUse = destroysAfterUse(card);\n    if (destroyedAfterUse) nextPlayer = destroyResolvedConsumable(nextPlayer, card);\n    const pendingDiscard = card.name === "Morning-Shift Meditation" && nextPlayer.hand.length ? { sourceCardId: id, remaining: 1 } : null;\n    return write(current, `${card.name} played. ${pendingDiscard ? "Draw 1 card, then choose a card to discard." : cardEffectNote(card)}${destroyedAfterUse ? " Destroyed after use; it will not enter your discard pile." : ""}${locationModifier.notes.length ? ` ${locationModifier.notes.join("; ")}.` : ""}`, { player: nextPlayer, pendingDiscard });'''
if old_support not in playtest: raise SystemExit('playSupport block missing')
playtest = playtest.replace(old_support, new_support, 1)

# AI support cards obey Destroy-after-use too.
old_ai_support = '    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], focus: nextAi.focus + locationModifier.value }, card, "ai");\n    played.push(card.name);'
new_ai_support = '    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], focus: nextAi.focus + locationModifier.value }, card, "ai");\n    if (destroysAfterUse(card)) nextAi = destroyResolvedConsumable(nextAi, card);\n    played.push(card.name);'
if old_ai_support not in playtest: raise SystemExit('AI support block missing')
playtest = playtest.replace(old_ai_support, new_ai_support, 1)

# Defense window: standing zonal armor counts whether or not a Defense card is played.
old_resolve_start = '''    let nextPlayer = { ...current.player };\n    let defensePower = fighterStat(nextPlayer, "DEF");\n    let tempoBonus = 0;\n    const locationModifier = locationDefenseModifier(cardFor(current.locationId), defenseCard, nextPlayer, pending.zone);'''
new_resolve_start = '''    let nextPlayer = { ...current.player };\n    const armorModifier = equipmentDefenseModifier(nextPlayer, pending.zone);\n    let defensePower = fighterStat(nextPlayer, "DEF") + armorModifier.value;\n    let tempoBonus = 0;\n    const locationModifier = locationDefenseModifier(cardFor(current.locationId), defenseCard, nextPlayer, pending.zone);'''
if old_resolve_start not in playtest: raise SystemExit('resolveDefense start missing')
playtest = playtest.replace(old_resolve_start, new_resolve_start, 1)

old_resolve_onplay = '      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onPlay");\n    }'
new_resolve_onplay = '      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onPlay");\n      const followup = applyAfterDefenseEquipment(nextPlayer);\n      nextPlayer = followup.board;\n    }'
# only first occurrence after resolveDefense? Earlier declareAttack has different owner. This exact player form should be unique.
if old_resolve_onplay not in playtest: raise SystemExit('resolveDefense onPlay missing')
playtest = playtest.replace(old_resolve_onplay, new_resolve_onplay, 1)

old_player_damage = '    nextPlayer = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit, damageTaken: reduced.board.damageTaken + damage };\n    const aiCard = cardFor(pending.cardId)!;'
new_player_damage = '    nextPlayer = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit, damageTaken: reduced.board.damageTaken + damage };\n    const aiCard = cardFor(pending.cardId)!;\n    const targetDebuff = hit ? applyTargetHitDebuffs(nextPlayer, aiCard) : { board: nextPlayer, notes: [] as string[] };\n    nextPlayer = targetDebuff.board;'
if old_player_damage not in playtest: raise SystemExit('resolveDefense player damage missing')
playtest = playtest.replace(old_player_damage, new_player_damage, 1)

old_resolve_mods = '    const modifiers = [...(pending.modifierNotes ?? []), ...locationModifier.notes, ...(reduced.note ? [reduced.note] : [])];'
new_resolve_mods = '    const modifiers = [...(pending.modifierNotes ?? []), ...armorModifier.notes, ...locationModifier.notes, ...targetDebuff.notes, ...(reduced.note ? [reduced.note] : [])];'
if old_resolve_mods not in playtest: raise SystemExit('resolveDefense modifiers missing')
playtest = playtest.replace(old_resolve_mods, new_resolve_mods, 1)
playtest = playtest.replace('No Defense card was played; your base DEF blocks', 'No Defense card was played; your standing DEF/Equipment blocks', 1)

# Reversal uses the same zonal standing Defense and target hit debuffs.
old_rev_def = '''    const defenseModifier = locationDefenseModifier(location, defenseCard, current.ai, zone);\n    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + (defenseCard ? cardPower(defenseCard) : 0) + defenseModifier.value);'''
new_rev_def = '''    const defenseModifier = locationDefenseModifier(location, defenseCard, current.ai, zone);\n    const armorModifier = equipmentDefenseModifier(current.ai, zone);\n    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) : 0) + defenseModifier.value);'''
if old_rev_def not in playtest: raise SystemExit('reversal defense block missing')
playtest = playtest.replace(old_rev_def, new_rev_def, 1)

old_rev_ai = '    let nextAi = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), damageTaken: reduced.board.damageTaken + damage, wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit };\n    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true };'
new_rev_ai = '    let nextAi = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), damageTaken: reduced.board.damageTaken + damage, wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit };\n    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card) : { board: nextAi, notes: [] as string[] };\n    nextAi = targetDebuff.board;\n    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true };'
if old_rev_ai not in playtest: raise SystemExit('reversal nextAi missing')
playtest = playtest.replace(old_rev_ai, new_rev_ai, 1)

# Reversal defense follow-up equipment.
old_rev_effects = '''    if (defenseCard) {\n      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onPlay");\n      if (!hit) nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onBlock");\n      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve");\n    }\n    nextPlayer = markCompletedTask(nextPlayer);'''
new_rev_effects = '''    let defenseFollowupNotes: string[] = [];\n    if (defenseCard) {\n      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onPlay");\n      const followup = applyAfterDefenseEquipment(nextAi);\n      nextAi = followup.board;\n      defenseFollowupNotes = followup.notes;\n      if (!hit) nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onBlock");\n      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve");\n    }\n    nextPlayer = markCompletedTask(nextPlayer);'''
if old_rev_effects not in playtest: raise SystemExit('reversal defense effects missing')
playtest = playtest.replace(old_rev_effects, new_rev_effects, 1)

# There are now two modifier arrays with similar shape; replace the reversal one after the marker.
rev_marker = '    nextPlayer = markCompletedTask(nextPlayer);\n    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...comboModifier.notes, ...defenseModifier.notes, ...(reduced.note ? [reduced.note] : [])];'
rev_repl = '    nextPlayer = markCompletedTask(nextPlayer);\n    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...comboModifier.notes, ...armorModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...defenseFollowupNotes, ...(reduced.note ? [reduced.note] : [])];'
if rev_marker not in playtest: raise SystemExit('reversal modifier array missing')
playtest = playtest.replace(rev_marker, rev_repl, 1)

# End-of-round cleanup must expire all temporary next-Attack modifiers.
playtest = playtest.replace('tempo: true, tempSpeed: 0, attackedThisRound: false', 'tempo: true, tempSpeed: 0, nextAttackBonus: 0, attackedThisRound: false', 2)

playtest_path.write_text(playtest)

# Pure resolver tests: representative real catalog wording, not card-name branches.
(root / 'tests/effect-resolvers.test.mjs').write_text(r'''import assert from "node:assert/strict";
import test from "node:test";
import { afterDefenseNextAttackBonus, defenseEquipmentBonus, destroysAfterUse, passiveEquipmentGuard, targetNextAttackPenalty, targetSpeedPenaltyUntilHonor } from "../app/effect-resolvers.ts";

test("Defense Equipment protects only its printed zone", () => {
  const chest = { name: "Cardboard Chestplate", subtype: "Defense Equipment", rulesText: "+2 DEF against Mid Attacks.", stats: { Guard: 2 } };
  assert.equal(defenseEquipmentBonus(chest, "Mid"), 2);
  assert.equal(defenseEquipmentBonus(chest, "High"), 0);
  assert.equal(defenseEquipmentBonus(chest, "Low"), 0);
});

test("multi-zone and all-zone Defense Equipment resolve correctly", () => {
  const arms = { name: "Forearm Guards", subtype: "Defense Equipment", rulesText: "+1 DEF against High and Mid Attacks.", stats: { Guard: 1 } };
  const gi = { name: "Bubble Wrap Gi", subtype: "Defense Equipment", rulesText: "+1 DEF against all zones.", stats: { Guard: 1 } };
  assert.equal(defenseEquipmentBonus(arms, "High"), 1);
  assert.equal(defenseEquipmentBonus(arms, "Mid"), 1);
  assert.equal(defenseEquipmentBonus(arms, "Low"), 0);
  assert.equal(defenseEquipmentBonus(gi, "High"), 1);
  assert.equal(defenseEquipmentBonus(gi, "Mid"), 1);
  assert.equal(defenseEquipmentBonus(gi, "Low"), 1);
});

test("non-armor Gear Guard remains a static defense bonus", () => {
  assert.equal(passiveEquipmentGuard({ subtype: "Gear", stats: { Guard: 1 } }), 1);
  assert.equal(passiveEquipmentGuard({ subtype: "Defense Equipment", stats: { Guard: 3 } }), 0);
});

test("equipped weapons can prime the next Attack after a Defense", () => {
  const result = afterDefenseNextAttackBonus([
    { name: "Bo Staff", rulesText: "After you play a Defense card, your next Attack this turn gets +1 Attack Power." },
    { name: "Unrelated Gear", rulesText: "Once per turn, complain about paperwork." },
  ]);
  assert.equal(result.amount, 1);
  assert.deepEqual(result.sources, ["Bo Staff"]);
});

test("on-hit target debuffs parse real Attack wording", () => {
  assert.equal(targetNextAttackPenalty({ rulesText: "On Hit, the target's next Attack this round gets −2 Attack Power." }), 2);
  assert.equal(targetNextAttackPenalty({ rulesText: "If this Attack Hits, the target's next Attack this round has -1 Attack Power." }), 1);
  assert.equal(targetSpeedPenaltyUntilHonor({ rulesText: "If this Attack Hits, the target's active Character gets −1 Speed until the next Honor Phase." }), 1);
});

test("Consumables marked Destroy after use are removed from circulation", () => {
  assert.equal(destroysAfterUse({ rulesText: "Gain 2 Focus. Destroy this after use." }), true);
  assert.equal(destroysAfterUse({ rulesText: "Gain 2 Focus." }), false);
});
''')

# Static integration checks keep the actual Quick Duel pipeline wired to the resolvers.
(root / 'tests/playtest-effect-integration.test.mjs').write_text(r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel applies zonal equipment, destroy-after-use, and target debuffs", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /equipmentDefenseModifier\(current\.ai, zone\)/);
  assert.match(source, /equipmentDefenseModifier\(nextPlayer, pending\.zone\)/);
  assert.match(source, /applyAfterDefenseEquipment/);
  assert.match(source, /applyTargetHitDebuffs/);
  assert.match(source, /destroyResolvedConsumable/);
  assert.match(source, /Destroyed after use; it will not enter your discard pile/);
});
''')
