from pathlib import Path

root = Path(".")

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label} anchor missing")
    return text.replace(old, new, 1)

resolver_path = root / "app/effect-resolvers.ts"
resolver = resolver_path.read_text()
old_sig = 'export function conditionalAttackPowerBonus(card: EffectCardLike, context: { playedKata: boolean; firstAttack: boolean }) {'
new_sig = 'export function conditionalAttackPowerBonus(card: EffectCardLike, context: { playedKata: boolean; firstAttack: boolean; matchingArmor?: boolean; targetEquipmentCount?: number }) {'
resolver = replace_once(resolver, old_sig, new_sig, "conditionalAttackPowerBonus signature")
old_body = '''  const kata = text.match(/If you played a Kata this turn, this Attack gets \\+(\\d+) Attack Power/i);\n  if (kata && context.playedKata) { amount += Number(kata[1]); notes.push(`Kata setup +${kata[1]} Attack Power`); }\n  const unconditional = text.match(/(?:^|[.!?]\\s+)(?:This|The) Attack gets \\+(\\d+) Attack Power/i);'''
new_body = '''  const kata = text.match(/If you played a Kata this turn, this Attack gets \\+(\\d+) Attack Power/i);\n  if (kata && context.playedKata) { amount += Number(kata[1]); notes.push(`Kata setup +${kata[1]} Attack Power`); }\n  const armor = text.match(/If the target has matching Armor, this Attack gets \\+(\\d+) Attack Power/i);\n  if (armor && context.matchingArmor) { amount += Number(armor[1]); notes.push(`matching Armor +${armor[1]} Attack Power`); }\n  const equipment = text.match(/If the target has two or more permanent Equipment cards equipped, this Attack gets \\+(\\d+) Attack Power/i);\n  if (equipment && (context.targetEquipmentCount ?? 0) >= 2) { amount += Number(equipment[1]); notes.push(`loaded target +${equipment[1]} Attack Power`); }\n  const unconditional = text.match(/(?:^|[.!?]\\s+)(?:This|The) Attack gets \\+(\\d+) Attack Power/i);'''
resolver = replace_once(resolver, old_body, new_body, "conditional Attack body")
if "export function attackPiercing(" not in resolver:
    resolver += r'''

export function attackPiercing(card: EffectCardLike, context: {
  matchingArmor: boolean;
  targetEquipmentCount: number;
  targetHasExhaustedEquipment?: boolean;
  speedChangedThisRound?: boolean;
}) {
  const text = normalizedMinus(String(card.rulesText ?? ""));
  let amount = 0;
  const notes: string[] = [];
  const add = (value: number, note: string) => { amount += value; notes.push(note); };

  const armor = text.match(/If the target has matching Armor, this Attack(?: gets \+\d+ Attack Power and)? gains Piercing (\d+)/i);
  if (armor && context.matchingArmor) add(Number(armor[1]), `matching Armor grants Piercing ${armor[1]}`);

  const equipment = text.match(/If the target has two or more permanent Equipment cards equipped, this Attack(?: gets \+\d+ Attack Power and)? gains Piercing (\d+)/i);
  if (equipment && context.targetEquipmentCount >= 2) add(Number(equipment[1]), `loaded target grants Piercing ${equipment[1]}`);

  const exhausted = text.match(/If the target has exhausted Equipment, this Attack gains Piercing (\d+)/i);
  if (exhausted && context.targetHasExhaustedEquipment) add(Number(exhausted[1]), `exhausted Equipment grants Piercing ${exhausted[1]}`);

  const speed = text.match(/If your Speed changed this round, this Attack gets Piercing (\d+)/i);
  if (speed && context.speedChangedThisRound) add(Number(speed[1]), `Speed change grants Piercing ${speed[1]}`);

  return { amount, notes };
}

export function equipmentPiercing(cards: EffectCardLike[], context: {
  firstAttack: boolean;
  zone: string;
  matchingArmor: boolean;
}) {
  let amount = 0;
  const sources: string[] = [];
  const zone = context.zone.toLocaleLowerCase();

  for (const card of cards) {
    const text = normalizedMinus(String(card.rulesText ?? ""));
    let value = 0;
    const firstLowMid = text.match(/Your first Low or Mid Attack each turn gains Piercing (\d+)/i);
    if (firstLowMid && context.firstAttack && (zone === "low" || zone === "mid")) value += Number(firstLowMid[1]);
    const high = text.match(/Your High Attacks with this gain Piercing (\d+)/i);
    if (high && zone === "high") value += Number(high[1]);
    const armor = text.match(/Your Attacks with this gain Piercing (\d+) against Armor/i);
    if (armor && context.matchingArmor) value += Number(armor[1]);
    if (!value) continue;
    amount += value;
    sources.push(`${card.name ?? "Equipment"} Piercing ${value}`);
  }
  return { amount, sources };
}
'''
resolver_path.write_text(resolver)

combo_path = root / "app/combo-engine.ts"
combo = combo_path.read_text()
combo = replace_once(combo, '''  speedOnTrigger: number;\n};''', '''  speedOnTrigger: number;\n  piercing: number;\n};''', "ComboEvaluation piercing field")
combo = replace_once(combo, '''  const speed = Number(payoff.match(/gain\\s+\\+?(\\d+)\\s+Speed/i)?.[1] ?? 0);\n  const grantsFlow = /(?:Attack|strike|finisher)[^.]*gains? Flow|gains? Flow[^.]*Attack/i.test(payoff);\n  const focusOnHit = focus && /\\bHit(?:s)?\\b/i.test(payoff) ? focus : 0;\n  const recognized = Boolean(power || damage || focusOnHit || grantsFlow || speed);\n  return { power, damage, focusOnHit, grantsFlow, speedOnTrigger: speed, recognized };''', '''  const speed = Number(payoff.match(/gain\\s+\\+?(\\d+)\\s+Speed/i)?.[1] ?? 0);\n  const piercing = Number(payoff.match(/Piercing\\s+(\\d+)/i)?.[1] ?? 0);\n  const grantsFlow = /(?:Attack|strike|finisher)[^.]*gains? Flow|gains? Flow[^.]*Attack/i.test(payoff);\n  const focusOnHit = focus && /\\bHit(?:s)?\\b/i.test(payoff) ? focus : 0;\n  const recognized = Boolean(power || damage || focusOnHit || grantsFlow || speed || piercing);\n  return { power, damage, focusOnHit, grantsFlow, speedOnTrigger: speed, piercing, recognized };''', "combo payoff piercing parser")
weapon_anchor = '''  if (/two or more permanent equipment|2\\+ permanent equipment/i.test(requirement)) {\n    recognizedRequirement = true;\n    if (context.equipment.length < 2) { eligible = false; reasons.push('needs 2 permanent Equipment'); }\n  }\n'''
combo = replace_once(combo, weapon_anchor, weapon_anchor + '''\n  if (/weapon attack/i.test(requirement)) {\n    recognizedRequirement = true;\n    const weaponReady = hasTag(context.currentCard, 'Weapon') || context.equipment.some((card) => /weapon/i.test(value(card.subtype)) || hasTag(card, 'Weapon'));\n    if (!weaponReady) { eligible = false; reasons.push('needs a Weapon Attack'); }\n  }\n  if (/all three zones/i.test(requirement)) {\n    recognizedRequirement = true;\n    const zones = new Set([...context.zonesPlayed, context.currentZone].map((zone) => zone.toLocaleLowerCase()));\n    if (!['high', 'mid', 'low'].every((zone) => zones.has(zone))) { eligible = false; reasons.push('needs High, Mid, and Low Attacks'); }\n  }\n''', "combo requirement expansion")
combo = replace_once(combo, '''    speedOnTrigger: parsed.speedOnTrigger,\n  };''', '''    speedOnTrigger: parsed.speedOnTrigger,\n    piercing: parsed.piercing,\n  };''', "combo return piercing")
combo_path.write_text(combo)

playtest_path = root / "app/playtest.tsx"
playtest = playtest_path.read_text()
old_import = 'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, equipmentConditionalAttackPowerBonus, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor } from "./effect-resolvers";'
new_import = 'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, attackPiercing, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor } from "./effect-resolvers";'
playtest = replace_once(playtest, old_import, new_import, "playtest resolver import")
playtest = replace_once(playtest, '''  attacksThisTurn: number;\n  attacksReceivedThisRound?: number;''', '''  attacksThisTurn: number;\n  attacksReceivedThisRound?: number;\n  speedChangedThisRound?: boolean;''', "Board speed change field")
playtest = replace_once(playtest, '''  damageModifier: number;\n  modifierNotes: string[];''', '''  damageModifier: number;\n  piercing?: number;\n  modifierNotes: string[];''', "PendingStrike piercing")
playtest = replace_once(playtest, 'type ComboModifier = AttackModifier & { focusOnHit: number; grantsFlow: boolean; speedOnTrigger: number; triggeredIds: string[] };', 'type ComboModifier = AttackModifier & { focusOnHit: number; grantsFlow: boolean; speedOnTrigger: number; piercing: number; triggeredIds: string[] };', "ComboModifier type")
playtest = replace_once(playtest, 'const result: ComboModifier = { power: 0, damage: 0, focusOnHit: 0, grantsFlow: false, speedOnTrigger: 0, triggeredIds: [], notes: [] };', 'const result: ComboModifier = { power: 0, damage: 0, focusOnHit: 0, grantsFlow: false, speedOnTrigger: 0, piercing: 0, triggeredIds: [], notes: [] };', "ComboModifier init")
playtest = replace_once(playtest, '''    result.speedOnTrigger += evaluation.speedOnTrigger;\n    result.triggeredIds.push(combo.id);\n    const payoffBits = [evaluation.power ? `+${evaluation.power} power` : "", evaluation.damage ? `+${evaluation.damage} damage` : "", evaluation.grantsFlow ? "Flow" : "", evaluation.focusOnHit ? `${evaluation.focusOnHit} Focus on Hit` : "", evaluation.speedOnTrigger ? `+${evaluation.speedOnTrigger} Speed` : ""].filter(Boolean);''', '''    result.speedOnTrigger += evaluation.speedOnTrigger;\n    result.piercing += evaluation.piercing;\n    result.triggeredIds.push(combo.id);\n    const payoffBits = [evaluation.power ? `+${evaluation.power} power` : "", evaluation.damage ? `+${evaluation.damage} damage` : "", evaluation.grantsFlow ? "Flow" : "", evaluation.focusOnHit ? `${evaluation.focusOnHit} Focus on Hit` : "", evaluation.speedOnTrigger ? `+${evaluation.speedOnTrigger} Speed` : "", evaluation.piercing ? `Piercing ${evaluation.piercing}` : ""].filter(Boolean);''', "ComboModifier piercing accumulation")
old_printed = '''function printedAttackRuleModifier(attacker: Board, defender: Board, card: CardEntry): AttackModifier {\n  const playedKata = attacker.cardsThisTurn.some((id) => { const prior = cardFor(id); return Boolean(prior && isKata(prior)); });\n  const printed = conditionalAttackPowerBonus(card, { playedKata, firstAttack: attacker.attacksThisTurn === 0 });'''
new_printed = '''function printedAttackRuleModifier(attacker: Board, defender: Board, card: CardEntry, zone: string): AttackModifier {\n  const playedKata = attacker.cardsThisTurn.some((id) => { const prior = cardFor(id); return Boolean(prior && isKata(prior)); });\n  const printed = conditionalAttackPowerBonus(card, {\n    playedKata,\n    firstAttack: attacker.attacksThisTurn === 0,\n    matchingArmor: equipmentDefenseModifier(defender, zone).value > 0,\n    targetEquipmentCount: defender.equipment.length,\n  });'''
playtest = replace_once(playtest, old_printed, new_printed, "printedAttackRuleModifier context")
printed_end = '''  return {\n    power: printed.amount + equipment.amount,\n    damage: 0,\n    notes: [...printed.notes, ...(equipment.amount ? [`${equipment.sources.join(" + ")} +${equipment.amount} Attack Power vs faster fighter`] : [])],\n  };\n}\n\nfunction attackHasFlexibleZone'''
piercing_helpers = '''  return {\n    power: printed.amount + equipment.amount,\n    damage: 0,\n    notes: [...printed.notes, ...(equipment.amount ? [`${equipment.sources.join(" + ")} +${equipment.amount} Attack Power vs faster fighter`] : [])],\n  };\n}\n\nfunction attackPiercingModifier(attacker: Board, defender: Board, card: CardEntry, zone: string, comboPiercing = 0) {\n  const matchingArmor = equipmentDefenseModifier(defender, zone).value > 0;\n  const direct = attackPiercing(card, { matchingArmor, targetEquipmentCount: defender.equipment.length, targetHasExhaustedEquipment: false, speedChangedThisRound: Boolean(attacker.speedChangedThisRound) });\n  const equipped = attacker.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));\n  const equipment = equipmentPiercing(equipped, { firstAttack: attacker.attacksThisTurn === 0, zone, matchingArmor });\n  const value = direct.amount + equipment.amount + comboPiercing;\n  const notes = [...direct.notes, ...equipment.sources, ...(comboPiercing ? [`Combo grants Piercing ${comboPiercing}`] : [])];\n  return { value, notes };\n}\n\nfunction piercedArmorModifier(armor: CombatModifier, piercing: number): CombatModifier {\n  const ignored = Math.min(Math.max(0, piercing), Math.max(0, armor.value));\n  return { value: armor.value - ignored, notes: [...armor.notes, ...(ignored ? [`Piercing ${piercing} ignores ${ignored} Armor DEF`] : [])] };\n}\n\nfunction attackHasFlexibleZone'''
playtest = replace_once(playtest, printed_end, piercing_helpers, "piercing helper insertion")
playtest = replace_once(playtest, '''    if (isPermanent(card)) next.equipment = [...next.equipment, card.id];\n  }''', '''    if (isPermanent(card)) {\n      next.equipment = [...next.equipment, card.id];\n      if (equipmentSpeedModifier(card)) next.speedChangedThisRound = true;\n    }\n  }''', "permanent speed change tracking")
playtest = replace_once(playtest, 'if (effect.kind === "speed") next.tempSpeed += effect.amount;', 'if (effect.kind === "speed") { next.tempSpeed += effect.amount; if (effect.amount) next.speedChangedThisRound = true; }', "temporary speed change tracking")
playtest = replace_once(playtest, 'next = { ...next, tempSpeed: next.tempSpeed - speedPenalty };', 'next = { ...next, tempSpeed: next.tempSpeed - speedPenalty, speedChangedThisRound: true };', "target speed change tracking")
playtest = replace_once(playtest, 'function bestDefense(board: Board, zone: string, attackPower = Number.POSITIVE_INFINITY, difficulty: Difficulty = "certified", location?: CardEntry, incomingAttack?: CardEntry, attacker?: Board) {', 'function bestDefense(board: Board, zone: string, attackPower = Number.POSITIVE_INFINITY, difficulty: Difficulty = "certified", location?: CardEntry, incomingAttack?: CardEntry, attacker?: Board, piercing = 0) {', "bestDefense signature")
playtest = replace_once(playtest, 'return { id, total: fighterStat(board, "DEF") + equipmentDefenseModifier(board, zone).value + cardPower(card) + (board.nextDefenseCardBonus ?? 0) + printed + modifier };', 'return { id, total: fighterStat(board, "DEF") + piercedArmorModifier(equipmentDefenseModifier(board, zone), piercing).value + cardPower(card) + (board.nextDefenseCardBonus ?? 0) + printed + modifier };', "bestDefense armor piercing")
playtest = replace_once(playtest, 'tempSpeed: 0, nextAttackBonus: 0, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0,', 'tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0,', "emptyBoard speed flag")
playtest = playtest.replace('printedAttackRuleModifier(current.player, current.ai, card);', 'printedAttackRuleModifier(current.player, current.ai, card, zone);')
playtest = playtest.replace('printedAttackRuleModifier(current.ai, current.player, card);', 'printedAttackRuleModifier(current.ai, current.player, card, zone);')
old_player_attack = '''    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const comboModifier = comboAttackModifier(current.player, card, zone);\n    const hasFlow = attackHasFlow(current.player, card, comboModifier);\n    const attackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);\n    const defenseId = bestDefense(current.ai, zone, attackPower, settings.difficulty, location, card, current.player);\n    const defenseCard = defenseId ? cardFor(defenseId) : null;\n    const defenseModifier = locationDefenseModifier(location, defenseCard, current.ai, zone);\n    const armorModifier = equipmentDefenseModifier(current.ai, zone);\n    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(current.ai, current.player, defenseCard, card) : { value: 0, notes: [] as string[] };\n    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (current.ai.nextDefenseCardBonus ?? 0) : 0) + defenseCardModifier.value + defenseModifier.value);'''
new_player_attack = '''    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const comboModifier = comboAttackModifier(current.player, card, zone);\n    const rawArmorModifier = equipmentDefenseModifier(current.ai, zone);\n    const piercingModifier = attackPiercingModifier(current.player, current.ai, card, zone, comboModifier.piercing);\n    const armorModifier = piercedArmorModifier(rawArmorModifier, piercingModifier.value);\n    const hasFlow = attackHasFlow(current.player, card, comboModifier);\n    const attackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);\n    const defenseId = bestDefense(current.ai, zone, attackPower, settings.difficulty, location, card, current.player, piercingModifier.value);\n    const defenseCard = defenseId ? cardFor(defenseId) : null;\n    const defenseModifier = locationDefenseModifier(location, defenseCard, current.ai, zone);\n    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(current.ai, current.player, defenseCard, card) : { value: 0, notes: [] as string[] };\n    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (current.ai.nextDefenseCardBonus ?? 0) : 0) + defenseCardModifier.value + defenseModifier.value);'''
playtest = replace_once(playtest, old_player_attack, new_player_attack, "player attack piercing")
playtest = replace_once(playtest, 'const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...armorModifier.notes,', 'const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...piercingModifier.notes, ...armorModifier.notes,', "player attack piercing notes")
old_reversal = '''    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const comboModifier = comboAttackModifier(current.player, card, zone, true);\n    const attackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);\n    const defenseId = bestDefense(current.ai, zone, attackPower, settings.difficulty, location, card, current.player);\n    const defenseCard = defenseId ? cardFor(defenseId) : null;\n    const defenseModifier = locationDefenseModifier(location, defenseCard, current.ai, zone);\n    const armorModifier = equipmentDefenseModifier(current.ai, zone);\n    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(current.ai, current.player, defenseCard, card) : { value: 0, notes: [] as string[] };\n    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (current.ai.nextDefenseCardBonus ?? 0) : 0) + defenseCardModifier.value + defenseModifier.value);'''
new_reversal = '''    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const comboModifier = comboAttackModifier(current.player, card, zone, true);\n    const rawArmorModifier = equipmentDefenseModifier(current.ai, zone);\n    const piercingModifier = attackPiercingModifier(current.player, current.ai, card, zone, comboModifier.piercing);\n    const armorModifier = piercedArmorModifier(rawArmorModifier, piercingModifier.value);\n    const attackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);\n    const defenseId = bestDefense(current.ai, zone, attackPower, settings.difficulty, location, card, current.player, piercingModifier.value);\n    const defenseCard = defenseId ? cardFor(defenseId) : null;\n    const defenseModifier = locationDefenseModifier(location, defenseCard, current.ai, zone);\n    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(current.ai, current.player, defenseCard, card) : { value: 0, notes: [] as string[] };\n    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (current.ai.nextDefenseCardBonus ?? 0) : 0) + defenseCardModifier.value + defenseModifier.value);'''
playtest = replace_once(playtest, old_reversal, new_reversal, "reversal piercing")
needle = 'const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...armorModifier.notes,'
if needle in playtest:
    playtest = playtest.replace(needle, 'const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...piercingModifier.notes, ...armorModifier.notes,', 1)
else:
    raise SystemExit("reversal piercing notes anchor missing")
old_ai_open = '''  const incomingModifier = incomingAttackEquipmentModifier(current.player);\n  const comboModifier = comboAttackModifier(current.ai, card, zone);\n  const hasFlow = attackHasFlow(current.ai, card, comboModifier);\n  const attackPower = Math.max(0, cardPower(card) + fighterStat(current.ai, "ATK") + current.ai.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);'''
new_ai_open = '''  const incomingModifier = incomingAttackEquipmentModifier(current.player);\n  const comboModifier = comboAttackModifier(current.ai, card, zone);\n  const piercingModifier = attackPiercingModifier(current.ai, current.player, card, zone, comboModifier.piercing);\n  const hasFlow = attackHasFlow(current.ai, card, comboModifier);\n  const attackPower = Math.max(0, cardPower(card) + fighterStat(current.ai, "ATK") + current.ai.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);'''
playtest = replace_once(playtest, old_ai_open, new_ai_open, "AI open piercing")
playtest = replace_once(playtest, 'const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes];', 'const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...piercingModifier.notes];', "AI piercing notes")
playtest = replace_once(playtest, 'pendingStrike: { cardId, zone, attackPower, damageModifier: locationModifier.damage + fighterModifier.damage + comboModifier.damage, modifierNotes: modifiers, remainingAiAttacks }', 'pendingStrike: { cardId, zone, attackPower, damageModifier: locationModifier.damage + fighterModifier.damage + comboModifier.damage, piercing: piercingModifier.value, modifierNotes: modifiers, remainingAiAttacks }', "AI PendingStrike piercing")
playtest = replace_once(playtest, 'const armorModifier = equipmentDefenseModifier(nextPlayer, pending.zone);', 'const armorModifier = piercedArmorModifier(equipmentDefenseModifier(nextPlayer, pending.zone), pending.piercing ?? 0);', "defense-window armor piercing")
playtest = playtest.replace('tempo: true, tempSpeed: 0, nextAttackBonus: 0, attackedThisRound: false,', 'tempo: true, tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, attackedThisRound: false,')
playtest_path.write_text(playtest)

resolver_test_path = root / "tests/effect-resolvers.test.mjs"
resolver_test = resolver_test_path.read_text()
old_test_import = 'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, equipmentConditionalAttackPowerBonus, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor } from "../app/effect-resolvers.ts";'
new_test_import = 'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, attackPiercing, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor } from "../app/effect-resolvers.ts";'
resolver_test = replace_once(resolver_test, old_test_import, new_test_import, "resolver test import")
resolver_test += r'''

test("Piercing resolvers cover deterministic Attack and Weapon wording", () => {
  assert.equal(attackPiercing({ rulesText: "If the target has matching Armor, this Attack gains Piercing 2." }, { matchingArmor: true, targetEquipmentCount: 1 }).amount, 2);
  assert.equal(attackPiercing({ rulesText: "If the target has two or more permanent Equipment cards equipped, this Attack gets +1 Attack Power and gains Piercing 1." }, { matchingArmor: false, targetEquipmentCount: 2 }).amount, 1);
  assert.equal(attackPiercing({ rulesText: "If your Speed changed this round, this Attack gets Piercing 1." }, { matchingArmor: false, targetEquipmentCount: 0, speedChangedThisRound: true }).amount, 1);
  assert.equal(equipmentPiercing([{ name: "Naginata", rulesText: "Your first Low or Mid Attack each turn gains Piercing 1." }], { firstAttack: true, zone: "Low", matchingArmor: true }).amount, 1);
  assert.equal(equipmentPiercing([{ name: "Club", rulesText: "Your Attacks with this gain Piercing 1 against Armor." }], { firstAttack: false, zone: "Mid", matchingArmor: true }).amount, 1);
});

test("matching-Armor and loaded-target Attack Power clauses resolve with Piercing cards", () => {
  assert.equal(conditionalAttackPowerBonus({ rulesText: "If the target has matching Armor, this Attack gets +1 Attack Power and gains Piercing 1." }, { playedKata: false, firstAttack: false, matchingArmor: true, targetEquipmentCount: 1 }).amount, 1);
  assert.equal(conditionalAttackPowerBonus({ rulesText: "If the target has two or more permanent Equipment cards equipped, this Attack gets +1 Attack Power and gains Piercing 1." }, { playedKata: false, firstAttack: false, matchingArmor: false, targetEquipmentCount: 2 }).amount, 1);
});
'''
resolver_test_path.write_text(resolver_test)

combo_test_path = root / "tests/combo-engine.test.mjs"
combo_test = combo_test_path.read_text()
old_unsupported = '''test("Combo evaluator does not pretend an unsupported payoff works", () => {\n  const combo = { id: "c3", name: "Piercing Filing", tags: ["Block"], rulesText: "Requirement: Block an Attack, then make a Weapon Attack. Payoff: That Attack gets Piercing 1.", details: {} };\n  const result = evaluateCombo(combo, { priorCards: [], attacksThisTurn: 0, defendedThisRound: true, hitThisTurn: false, zonesPlayed: [], equipment: [], currentCard: attack("Weapon hit", ["Weapon"]), currentZone: "Mid" });\n  assert.equal(result.supported, false);\n  assert.equal(result.eligible, false);\n});'''
new_supported = '''test("Combo evaluator resolves Piercing payoffs and Weapon requirements", () => {\n  const combo = { id: "c3", name: "Piercing Filing", tags: ["Block"], rulesText: "Requirement: Block an Attack, then make a Weapon Attack. Payoff: That Attack gets Piercing 1.", details: {} };\n  const result = evaluateCombo(combo, { priorCards: [], attacksThisTurn: 0, defendedThisRound: true, hitThisTurn: false, zonesPlayed: [], equipment: [], currentCard: attack("Weapon hit", ["Weapon"]), currentZone: "Mid" });\n  assert.equal(result.supported, true);\n  assert.equal(result.eligible, true);\n  assert.equal(result.piercing, 1);\n});\n\ntest("Combo evaluator recognizes the all-three-zones Piercing finisher", () => {\n  const combo = { id: "c4", name: "Three-Zone Filing", tags: ["Zone"], rulesText: "Requirement: Play Attacks in all three zones across one round. Payoff: The final Attack gets Piercing 2.", details: {} };\n  const result = evaluateCombo(combo, { priorCards: [attack("High", [], "High"), attack("Mid", [], "Mid")], attacksThisTurn: 2, defendedThisRound: false, hitThisTurn: false, zonesPlayed: ["High", "Mid"], equipment: [], currentCard: attack("Low", [], "Low"), currentZone: "Low" });\n  assert.equal(result.eligible, true);\n  assert.equal(result.piercing, 2);\n});'''
combo_test = replace_once(combo_test, old_unsupported, new_supported, "combo piercing test")
combo_test_path.write_text(combo_test)

integration_path = root / "tests/playtest-effect-integration.test.mjs"
integration = integration_path.read_text()
integration += r'''

test("Quick Duel applies Piercing only to matching Armor DEF", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /attackPiercingModifier/);
  assert.match(source, /piercedArmorModifier/);
  assert.match(source, /Piercing \$\{piercing\} ignores \$\{ignored\} Armor DEF/);
  assert.match(source, /pending\.piercing/);
  assert.match(source, /speedChangedThisRound/);
});
'''
integration_path.write_text(integration)

(root / "scripts/deploy_patch_message.txt").write_text("Automate Piercing and anti-Armor card effects\n")
