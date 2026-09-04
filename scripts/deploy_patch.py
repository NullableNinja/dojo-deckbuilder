from pathlib import Path
import re

root = Path('.')
resolver_path = root / 'app/effect-resolvers.ts'
resolver = resolver_path.read_text()
playtest_path = root / 'app/playtest.tsx'
playtest = playtest_path.read_text()

addition = r'''

export function equipmentSpeedModifier(card: EffectCardLike) {
  const text = normalizedMinus(String(card.rulesText ?? ""));
  const match = text.match(/(?:and\s+)?-(\d+)\s+Speed\b/i);
  return match ? -Number(match[1]) : 0;
}

export function attackCanChooseAnyZone(card: EffectCardLike, firstAttack: boolean, equipment: EffectCardLike[] = []) {
  const text = String(card.rulesText ?? "");
  if (/Choose High, Mid, or Low when declared/i.test(text)) return true;
  if (/may be declared as Any zone/i.test(text)) return true;
  if (firstAttack && equipment.some((item) => /Your first Attack each turn may be declared as Any zone/i.test(String(item.rulesText ?? "")))) return true;
  return false;
}

export function conditionalAttackPowerBonus(card: EffectCardLike, context: { playedKata: boolean; firstAttack: boolean }) {
  const text = normalizedMinus(String(card.rulesText ?? ""));
  let amount = 0;
  const notes: string[] = [];
  const kata = text.match(/If you played a Kata this turn, this Attack gets \+(\d+) Attack Power/i);
  if (kata && context.playedKata) { amount += Number(kata[1]); notes.push(`Kata setup +${kata[1]} Attack Power`); }
  const unconditional = text.match(/(?:^|[.!?]\s+)(?:This|The) Attack gets \+(\d+) Attack Power/i);
  if (unconditional && !/Payoff:/i.test(text)) { amount += Number(unconditional[1]); notes.push(`printed Attack bonus +${unconditional[1]}`); }
  return { amount, notes };
}

export function equipmentConditionalAttackPowerBonus(cards: EffectCardLike[], context: { firstAttack: boolean; attackerSpeed: number; defenderSpeed: number }) {
  if (!context.firstAttack || context.attackerSpeed >= context.defenderSpeed) return { amount: 0, sources: [] as string[] };
  let amount = 0;
  const sources: string[] = [];
  for (const card of cards) {
    const match = String(card.rulesText ?? "").match(/Your first Attack against a fighter with higher Speed gets \+(\d+) Attack Power/i);
    if (!match) continue;
    amount += Number(match[1]);
    sources.push(card.name ?? "Equipment");
  }
  return { amount, sources };
}

export function conditionalDefenseGuardBonus(defense: EffectCardLike, context: { weaponAttack: boolean; defenderAttackedThisRound: boolean }) {
  const text = normalizedMinus(String(defense.rulesText ?? ""));
  let amount = 0;
  const notes: string[] = [];
  const weapon = text.match(/Against a Weapon Attack, this Defense gets \+(\d+) Guard/i);
  if (weapon && context.weaponAttack) { amount += Number(weapon[1]); notes.push(`Weapon defense +${weapon[1]} Guard`); }
  const attacked = text.match(/If you played an Attack this round, this Defense gets \+(\d+) Guard/i);
  if (attacked && context.defenderAttackedThisRound) { amount += Number(attacked[1]); notes.push(`attack-and-defend +${attacked[1]} Guard`); }
  return { amount, notes };
}

export function conditionalHealAfterHit(card: EffectCardLike, wasHitSinceLastTurn: boolean) {
  if (!wasHitSinceLastTurn) return 0;
  const match = String(card.rulesText ?? "").match(/If you were Hit since your last turn, heal (\d+) HP/i);
  return match ? Number(match[1]) : 0;
}

export function locationAttackRuleModifiers(location: EffectCardLike, context: { zone: string; firstAttack: boolean; attackTags: string[]; hasWeapon: boolean; equipmentTags: string[] }) {
  const text = normalizedMinus(String(location.rulesText ?? ""));
  const tags = context.attackTags.map((tag) => tag.toLocaleLowerCase());
  const equipmentTags = context.equipmentTags.map((tag) => tag.toLocaleLowerCase());
  let power = 0;
  let damage = 0;
  let matched = 0;
  const notes: string[] = [];

  const conditionMatches = (sentence: string) => {
    const lower = sentence.toLocaleLowerCase();
    if (/\bfirst Attack\b/i.test(sentence) && !context.firstAttack) return false;
    if (/\bfirst Low Attack\b/i.test(sentence) && (!context.firstAttack || context.zone.toLocaleLowerCase() !== "low")) return false;
    const zoneMatch = sentence.match(/\b(High|Mid|Low) Attacks?\b/i);
    if (zoneMatch && zoneMatch[1].toLocaleLowerCase() !== context.zone.toLocaleLowerCase()) return false;
    const tagged = sentence.match(/\b(Jump|Spin|Push)-tag Attacks?\b/i);
    if (tagged && !tags.some((tag) => tag.includes(tagged[1].toLocaleLowerCase()))) return false;
    if (/\bUnarmed Attacks?\b/i.test(sentence) && context.hasWeapon) return false;
    if (/\bWeapon Attacks?\b/i.test(sentence) && !context.hasWeapon && !tags.some((tag) => tag.includes("weapon"))) return false;
    if (/\bImprovised Weapons?\b/i.test(sentence) && !equipmentTags.some((tag) => tag.includes("improvised"))) return false;
    if (/\bStaff and Polearm Weapons?\b/i.test(sentence) && !equipmentTags.some((tag) => tag.includes("staff") || tag.includes("polearm"))) return false;
    if (/their first Attack that turn/i.test(sentence) && !context.firstAttack) return false;
    return true;
  };

  for (const raw of text.split(/(?<=[.!?])\s+/)) {
    const sentence = raw.trim();
    if (!sentence || /next Attack|target|opponent/i.test(sentence)) continue;
    if (!conditionMatches(sentence)) continue;
    const ap = sentence.match(/(?:get|gets|gain|gains)\s*([+-]\d+)\s+Attack (?:Power|Bonus)/i);
    const dmg = sentence.match(/(?:deal|deals|get|gets|gain|gains)\s*([+-]\d+)\s+(?:additional )?damage/i);
    if (ap) {
      const value = Number(ap[1]);
      power += value;
      matched += 1;
      notes.push(`${location.name ?? "Stage"} ${value >= 0 ? "+" : ""}${value} Attack Power`);
    }
    if (dmg) {
      const value = Number(dmg[1]);
      damage += value;
      matched += 1;
      notes.push(`${location.name ?? "Stage"} ${value >= 0 ? "+" : ""}${value} damage`);
    }
  }
  return { power, damage, notes, matched };
}
'''
if 'export function equipmentSpeedModifier' not in resolver:
    resolver += addition
resolver_path.write_text(resolver)

old_import = 'import { afterDefenseNextAttackBonus, defenseEquipmentBonus, destroysAfterUse, passiveEquipmentGuard, targetNextAttackPenalty, targetSpeedPenaltyUntilHonor } from "./effect-resolvers";'
new_import = 'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, defenseEquipmentBonus, destroysAfterUse, equipmentConditionalAttackPowerBonus, equipmentSpeedModifier, locationAttackRuleModifiers, passiveEquipmentGuard, targetNextAttackPenalty, targetSpeedPenaltyUntilHonor } from "./effect-resolvers";'
if old_import not in playtest: raise SystemExit('resolver import anchor missing')
playtest = playtest.replace(old_import, new_import, 1)

# Speed penalties printed on equipped Gear/Armor are live while the card is equipped.
old_speed_return = '    if (stat === "DEF") return total + passiveEquipmentGuard(card);\n    return total;'
new_speed_return = '    if (stat === "DEF") return total + passiveEquipmentGuard(card);\n    if (stat === "Speed") return total + equipmentSpeedModifier(card);\n    return total;'
if old_speed_return not in playtest: raise SystemExit('fighterStat speed anchor missing')
playtest = playtest.replace(old_speed_return, new_speed_return, 1)

# Replace hard-coded stage attack math with text-driven Attack Power / damage parsing,
# while retaining the old fallback only for an as-yet-unparsed stage sentence.
start = playtest.index('function locationAttackModifier(')
end = playtest.index('\nfunction locationDefenseModifier(', start)
old_location = playtest[start:end]
new_location = r'''function locationAttackModifier(location: CardEntry | undefined, card: CardEntry, board: Board, zone: string): AttackModifier {
  if (!location) return { power: 0, damage: 0, notes: [] };
  const firstAttack = board.attacksThisTurn === 0;
  const equipped = board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));
  const parsed = locationAttackRuleModifiers(location, {
    zone,
    firstAttack,
    attackTags: card.tags,
    hasWeapon: equipped.some(isWeapon),
    equipmentTags: equipped.flatMap((item) => item.tags),
  });
  if (parsed.matched) return { power: parsed.power, damage: parsed.damage, notes: parsed.notes };

  // Legacy fallback for unusual Quick Duel stages whose printed sentence has not
  // yet been generalized. Keep this list small and delete entries as parsers land.
  let power = 0;
  let damage = 0;
  const notes: string[] = [];
  const applyPower = (amount: number, reason: string) => { power += amount; notes.push(`${reason} ${amount > 0 ? "+" : ""}${amount} Attack Power`); };
  if (location.name === "River Dock" && hasTag(card, "Push")) applyPower(2, "dock edge");
  if (location.name === "Yoga Studio") applyPower(-1, "indoor voice");
  return { power, damage, notes };
}
'''
playtest = playtest[:start] + new_location + playtest[end:]

# Attack-card and equipped-weapon conditional Attack Power.
helper_anchor = 'function fighterAttackModifier(attacker: Board, defender: Board, card: CardEntry): AttackModifier {'
helper = r'''function printedAttackRuleModifier(attacker: Board, defender: Board, card: CardEntry): AttackModifier {
  const playedKata = attacker.cardsThisTurn.some((id) => { const prior = cardFor(id); return Boolean(prior && isKata(prior)); });
  const printed = conditionalAttackPowerBonus(card, { playedKata, firstAttack: attacker.attacksThisTurn === 0 });
  const equipped = attacker.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));
  const equipment = equipmentConditionalAttackPowerBonus(equipped, {
    firstAttack: attacker.attacksThisTurn === 0,
    attackerSpeed: fighterStat(attacker, "Speed"),
    defenderSpeed: fighterStat(defender, "Speed"),
  });
  return {
    power: printed.amount + equipment.amount,
    damage: 0,
    notes: [...printed.notes, ...(equipment.amount ? [`${equipment.sources.join(" + ")} +${equipment.amount} Attack Power vs faster fighter`] : [])],
  };
}

function attackHasFlexibleZone(board: Board, card: CardEntry) {
  if (card.zone?.includes("Any")) return true;
  const equipped = board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));
  if (attackCanChooseAnyZone(card, board.attacksThisTurn === 0, equipped)) return true;
  return cardFor(board.fighterId)?.name === "Whirlwind Wynn" && board.attacksThisTurn === 0 && hasTag(card, "Spin");
}

function defenseCardRuleModifier(defender: Board, attacker: Board, defense: CardEntry, incomingAttack: CardEntry): CombatModifier {
  const weaponAttack = hasTag(incomingAttack, "Weapon") || attacker.equipment.some((id) => { const item = cardFor(id); return Boolean(item && isWeapon(item)); });
  const parsed = conditionalDefenseGuardBonus(defense, { weaponAttack, defenderAttackedThisRound: defender.attackedThisRound });
  return { value: parsed.amount, notes: parsed.notes };
}

'''
if 'function printedAttackRuleModifier(' not in playtest:
    if helper_anchor not in playtest: raise SystemExit('fighterAttackModifier anchor missing')
    playtest = playtest.replace(helper_anchor, helper + helper_anchor, 1)

# Conditional healing that depends on having been Hit since the last turn.
heal_anchor = '  const text = card.rulesText ?? "";\n'
heal_insert = '  if (timing === "onPlay") {\n    const conditionalHeal = conditionalHealAfterHit(card, board.wasHitSinceLastTurn);\n    if (conditionalHeal) next.hp = Math.min(next.maxHp, next.hp + conditionalHeal);\n  }\n'
apply_start = playtest.index('function applyCardEffects(')
anchor_pos = playtest.index(heal_anchor, apply_start)
if heal_insert.strip() not in playtest[apply_start:apply_start+5000]:
    playtest = playtest[:anchor_pos] + heal_insert + playtest[anchor_pos:]

# bestDefense gets the incoming card/attacker so it can value conditional Guard.
old_sig = 'function bestDefense(board: Board, zone: string, attackPower = Number.POSITIVE_INFINITY, difficulty: Difficulty = "certified", location?: CardEntry) {'
new_sig = 'function bestDefense(board: Board, zone: string, attackPower = Number.POSITIVE_INFINITY, difficulty: Difficulty = "certified", location?: CardEntry, incomingAttack?: CardEntry, attacker?: Board) {'
if old_sig not in playtest: raise SystemExit('bestDefense signature missing')
playtest = playtest.replace(old_sig, new_sig, 1)
old_rank = '    const modifier = locationDefenseModifier(location, card, board, zone).value;\n    return { id, total: fighterStat(board, "DEF") + equipmentDefenseModifier(board, zone).value + cardPower(card) + modifier };'
new_rank = '    const modifier = locationDefenseModifier(location, card, board, zone).value;\n    const printed = incomingAttack && attacker ? defenseCardRuleModifier(board, attacker, card, incomingAttack).value : 0;\n    return { id, total: fighterStat(board, "DEF") + equipmentDefenseModifier(board, zone).value + cardPower(card) + printed + modifier };'
if old_rank not in playtest: raise SystemExit('bestDefense ranking block missing')
playtest = playtest.replace(old_rank, new_rank, 1)

# Three attack declaration sites: flexible zone + printed/equipment Attack Power.
playtest = playtest.replace('const anyZone = card.zone?.includes("Any") || (cardFor(current.player.fighterId)?.name === "Whirlwind Wynn" && current.player.attacksThisTurn === 0 && hasTag(card, "Spin"));', 'const anyZone = attackHasFlexibleZone(current.player, card);', 1)
playtest = playtest.replace('const anyZone = card.zone?.includes("Any") || (fighter?.name === "Whirlwind Wynn" && current.ai.attacksThisTurn === 0 && hasTag(card, "Spin"));', 'const anyZone = attackHasFlexibleZone(current.ai, card);', 1)
playtest = playtest.replace('const zone = card.zone?.includes("Any") ? current.selectedZone : card.zone?.split(",")[0] ?? "High";', 'const zone = attackHasFlexibleZone(current.player, card) ? current.selectedZone : card.zone?.split(",")[0] ?? "High";', 1)

# Player normal Attack.
old_modifiers = '    const fighterModifier = fighterAttackModifier(current.player, current.ai, card);\n    const comboModifier = comboAttackModifier(current.player, card, zone);'
new_modifiers = '    const fighterModifier = fighterAttackModifier(current.player, current.ai, card);\n    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card);\n    const comboModifier = comboAttackModifier(current.player, card, zone);'
if old_modifiers not in playtest: raise SystemExit('player attack modifier anchor missing')
playtest = playtest.replace(old_modifiers, new_modifiers, 1)
playtest = playtest.replace(' + locationModifier.power + fighterModifier.power + comboModifier.power);', ' + locationModifier.power + fighterModifier.power + printedModifier.power + comboModifier.power);', 1)
playtest = playtest.replace('bestDefense(current.ai, zone, attackPower, settings.difficulty, location);', 'bestDefense(current.ai, zone, attackPower, settings.difficulty, location, card, current.player);', 1)
playtest = playtest.replace('...fighterModifier.notes, ...comboModifier.notes, ...armorModifier.notes', '...fighterModifier.notes, ...printedModifier.notes, ...comboModifier.notes, ...armorModifier.notes', 1)

# AI Attack.
old_ai_mod = '  const fighterModifier = fighterAttackModifier(current.ai, current.player, card);\n  const comboModifier = comboAttackModifier(current.ai, card, zone);'
new_ai_mod = '  const fighterModifier = fighterAttackModifier(current.ai, current.player, card);\n  const printedModifier = printedAttackRuleModifier(current.ai, current.player, card);\n  const comboModifier = comboAttackModifier(current.ai, card, zone);'
if old_ai_mod not in playtest: raise SystemExit('AI attack modifier anchor missing')
playtest = playtest.replace(old_ai_mod, new_ai_mod, 1)
playtest = playtest.replace(' + locationModifier.power + fighterModifier.power + comboModifier.power);', ' + locationModifier.power + fighterModifier.power + printedModifier.power + comboModifier.power);', 1)
playtest = playtest.replace('const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...comboModifier.notes];', 'const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...comboModifier.notes];', 1)

# Reversal.
old_rev_mod = '    const fighterModifier = fighterAttackModifier(current.player, current.ai, card);\n    const comboModifier = comboAttackModifier(current.player, card, zone, true);'
new_rev_mod = '    const fighterModifier = fighterAttackModifier(current.player, current.ai, card);\n    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card);\n    const comboModifier = comboAttackModifier(current.player, card, zone, true);'
if old_rev_mod not in playtest: raise SystemExit('reversal attack modifier anchor missing')
playtest = playtest.replace(old_rev_mod, new_rev_mod, 1)
playtest = playtest.replace(' + locationModifier.power + fighterModifier.power + comboModifier.power);', ' + locationModifier.power + fighterModifier.power + printedModifier.power + comboModifier.power);', 1)
playtest = playtest.replace('bestDefense(current.ai, zone, attackPower, settings.difficulty, location);', 'bestDefense(current.ai, zone, attackPower, settings.difficulty, location, card, current.player);', 1)
# Reversal modifier array is now the remaining occurrence.
playtest = playtest.replace('...fighterModifier.notes, ...comboModifier.notes, ...armorModifier.notes', '...fighterModifier.notes, ...printedModifier.notes, ...comboModifier.notes, ...armorModifier.notes', 1)

# Actual AI Defense during player/reversal attacks gets the same conditional Guard used by bestDefense.
# Normal player Attack block.
needle = '    const armorModifier = equipmentDefenseModifier(current.ai, zone);\n    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) : 0) + defenseModifier.value);'
replacement = '    const armorModifier = equipmentDefenseModifier(current.ai, zone);\n    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(current.ai, current.player, defenseCard, card) : { value: 0, notes: [] as string[] };\n    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) : 0) + defenseCardModifier.value + defenseModifier.value);'
if needle not in playtest: raise SystemExit('normal AI defense actual block missing')
playtest = playtest.replace(needle, replacement, 1)
playtest = playtest.replace('...armorModifier.notes, ...defenseModifier.notes', '...armorModifier.notes, ...defenseCardModifier.notes, ...defenseModifier.notes', 1)

# Reversal AI Defense actual block (same text after first replacement).
if needle not in playtest: raise SystemExit('reversal AI defense actual block missing')
playtest = playtest.replace(needle, replacement, 1)
playtest = playtest.replace('...armorModifier.notes, ...defenseModifier.notes', '...armorModifier.notes, ...defenseCardModifier.notes, ...defenseModifier.notes', 1)

# Player Defense Window: move incoming card lookup before math and apply conditional Guard.
old_start = '    const defenseCard = defenseId ? cardFor(defenseId) : null;\n    let nextPlayer = { ...current.player };\n    const armorModifier = equipmentDefenseModifier(nextPlayer, pending.zone);\n    let defensePower = fighterStat(nextPlayer, "DEF") + armorModifier.value;\n    let tempoBonus = 0;\n    const locationModifier = locationDefenseModifier(cardFor(current.locationId), defenseCard, nextPlayer, pending.zone);'
new_start = '    const defenseCard = defenseId ? cardFor(defenseId) : null;\n    const aiCard = cardFor(pending.cardId)!;\n    let nextPlayer = { ...current.player };\n    const armorModifier = equipmentDefenseModifier(nextPlayer, pending.zone);\n    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(nextPlayer, current.ai, defenseCard, aiCard) : { value: 0, notes: [] as string[] };\n    let defensePower = fighterStat(nextPlayer, "DEF") + armorModifier.value;\n    let tempoBonus = 0;\n    const locationModifier = locationDefenseModifier(cardFor(current.locationId), defenseCard, nextPlayer, pending.zone);'
if old_start not in playtest: raise SystemExit('resolveDefense start block missing')
playtest = playtest.replace(old_start, new_start, 1)
playtest = playtest.replace('defensePower += cardPower(defenseCard) + tempoBonus + locationModifier.value;', 'defensePower += cardPower(defenseCard) + defenseCardModifier.value + tempoBonus + locationModifier.value;', 1)
# Remove the later duplicate aiCard declaration.
playtest = playtest.replace('    const aiCard = cardFor(pending.cardId)!;\n    const targetDebuff', '    const targetDebuff', 1)
playtest = playtest.replace('...armorModifier.notes, ...locationModifier.notes', '...armorModifier.notes, ...defenseCardModifier.notes, ...locationModifier.notes', 1)

playtest_path.write_text(playtest)

# Extend pure tests.
test_path = root / 'tests/effect-resolvers.test.mjs'
test_text = test_path.read_text()
if 'location Attack Power rules are applied before damage math' not in test_text:
    test_text = test_text.replace('import { afterDefenseNextAttackBonus, defenseEquipmentBonus, destroysAfterUse, passiveEquipmentGuard, targetNextAttackPenalty, targetSpeedPenaltyUntilHonor } from "../app/effect-resolvers.ts";', 'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, defenseEquipmentBonus, destroysAfterUse, equipmentConditionalAttackPowerBonus, equipmentSpeedModifier, locationAttackRuleModifiers, passiveEquipmentGuard, targetNextAttackPenalty, targetSpeedPenaltyUntilHonor } from "../app/effect-resolvers.ts";')
    test_text += r'''

test("location Attack Power rules are applied before damage math", () => {
  const bus = locationAttackRuleModifiers({ name: "City Bus in Motion", rulesText: "Mid Attacks get +1 Attack Power." }, { zone: "Mid", firstAttack: true, attackTags: [], hasWeapon: false, equipmentTags: [] });
  assert.equal(bus.power, 1);
  assert.equal(bus.damage, 0);
  const alley = locationAttackRuleModifiers({ name: "Rain-Slick Alley", rulesText: "Low Attacks get +1 Attack Power. Spin-tag Attacks get -1 Attack Power." }, { zone: "Low", firstAttack: true, attackTags: ["Spin"], hasWeapon: false, equipmentTags: [] });
  assert.equal(alley.power, 0);
});

test("conditional Attack and Defense wording resolves from printed text", () => {
  assert.equal(conditionalAttackPowerBonus({ rulesText: "If you played a Kata this turn, this Attack gets +2 Attack Power." }, { playedKata: true, firstAttack: false }).amount, 2);
  assert.equal(conditionalDefenseGuardBonus({ rulesText: "Against a Weapon Attack, this Defense gets +2 Guard." }, { weaponAttack: true, defenderAttackedThisRound: false }).amount, 2);
  assert.equal(conditionalDefenseGuardBonus({ rulesText: "If you played an Attack this round, this Defense gets +1 Guard." }, { weaponAttack: false, defenderAttackedThisRound: true }).amount, 1);
});

test("equipment conditional Attack bonuses and Speed penalties resolve", () => {
  const bonus = equipmentConditionalAttackPowerBonus([{ name: "Tanto", rulesText: "Your first Attack against a fighter with higher Speed gets +1 Attack Power." }], { firstAttack: true, attackerSpeed: 3, defenderSpeed: 5 });
  assert.equal(bonus.amount, 1);
  assert.equal(equipmentSpeedModifier({ rulesText: "+4 DEF against all zones and −2 Speed." }), -2);
});

test("flexible-zone and conditional recovery wording is recognized", () => {
  assert.equal(attackCanChooseAnyZone({ rulesText: "Choose High, Mid, or Low when declared." }, false, []), true);
  assert.equal(attackCanChooseAnyZone({ rulesText: "" }, true, [{ rulesText: "Your first Attack each turn may be declared as Any zone." }]), true);
  assert.equal(conditionalHealAfterHit({ rulesText: "If you were Hit since your last turn, heal 3 HP." }, true), 3);
  assert.equal(conditionalHealAfterHit({ rulesText: "If you were Hit since your last turn, heal 3 HP." }, false), 0);
});
'''
    test_path.write_text(test_text)

integration = root / 'tests/playtest-effect-integration.test.mjs'
text = integration.read_text()
if 'printed Attack/Defense modifiers and flexible zones' not in text:
    text += r'''

test("Quick Duel wires printed Attack/Defense modifiers and flexible zones into combat math", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /printedAttackRuleModifier/);
  assert.match(source, /defenseCardRuleModifier/);
  assert.match(source, /attackHasFlexibleZone/);
  assert.match(source, /locationAttackRuleModifiers/);
  assert.match(source, /conditionalHealAfterHit/);
});
'''
    integration.write_text(text)
