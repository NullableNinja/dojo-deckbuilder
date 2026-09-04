from pathlib import Path

def read(path):
    return Path(path).read_text()

def write(path, text):
    Path(path).write_text(text)

def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f"Expected patch anchor missing in {path}: {old[:120]!r}")
    if text.count(old) != 1:
        raise SystemExit(f"Patch anchor not unique in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))

effect_path = "app/effect-resolvers.ts"
effect = read(effect_path)
append = r'''

export type EquipmentActivationPlan =
  | { kind: "speed-cycle"; speed: number; draw: number; discard: number }
  | { kind: "next-attack-power"; power: number }
  | { kind: "zone-attack"; power: number; piercing: number; blockedFocus: number; requireDifferentPreviousZone: boolean };

export function equipmentActivationPlan(card: EffectCardLike): EquipmentActivationPlan | null {
  const text = normalizedMinus(String(card.rulesText ?? "")).replace(/\s+/g, " ").trim();

  let match = text.match(/^Exhaust:\s*Gain \+(\d+) Speed until (?:the )?next Honor Phase\. If you have Tempo after doing so, draw (\d+) cards?, then discard (\d+) cards?/i);
  if (match) return { kind: "speed-cycle", speed: Number(match[1]), draw: Number(match[2]), discard: Number(match[3]) };

  match = text.match(/^Exhaust:\s*Your next Attack using this Weapon gets \+(\d+) Attack Power/i);
  if (match) return { kind: "next-attack-power", power: Number(match[1]) };

  match = text.match(/^Exhaust:\s*Before you play an Attack, choose High, Mid, or Low\. If your next Attack this turn uses that zone, it gains Piercing (\d+)\. If it is Blocked, gain (\d+) Focus/i);
  if (match) return { kind: "zone-attack", power: 0, piercing: Number(match[1]), blockedFocus: Number(match[2]), requireDifferentPreviousZone: false };

  match = text.match(/^Exhaust:\s*Before you play an Attack, choose High, Mid, or Low\. If that Attack uses the chosen zone and differs from your previous Attack zone this turn, it gets \+(\d+) Attack Power/i);
  if (match) return { kind: "zone-attack", power: Number(match[1]), piercing: 0, blockedFocus: 0, requireDifferentPreviousZone: true };

  return null;
}

export function readyEquipmentOnHit(card: EffectCardLike) {
  const text = String(card.rulesText ?? "");
  const match = text.match(/If (?:it|this Attack) Hits, you may ready one Equipment card you control/i);
  return match ? 1 : 0;
}
'''
if "export type EquipmentActivationPlan" in effect:
    raise SystemExit("Equipment activation resolvers already present")
write(effect_path, effect.rstrip() + append + "\n")

play_path = "app/playtest.tsx"

replace_once(
    play_path,
    'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, attackPiercing, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, deckLookPlan, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, discardChoiceFollowup, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, mandatoryDiscardChoiceCount, optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor, type DeckLookPlan } from "./effect-resolvers";',
    'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, attackPiercing, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, deckLookPlan, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, discardChoiceFollowup, equipmentActivationPlan, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, mandatoryDiscardChoiceCount, optionalDiscardDrawChoice, passiveEquipmentGuard, readyEquipmentOnHit, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor, type DeckLookPlan } from "./effect-resolvers";'
)

replace_once(play_path, '  equipment: string[];\n  tempSpeed: number;', '  equipment: string[];\n  exhaustedEquipment?: string[];\n  equipmentAttackPlan?: { sourceCardId: string; zone: string; power: number; piercing: number; blockedFocus: number; requireDifferentPreviousZone: boolean } | null;\n  tempSpeed: number;')
replace_once(play_path, '  piercing?: number;\n  modifierNotes: string[];', '  piercing?: number;\n  blockedFocus?: number;\n  modifierNotes: string[];')
replace_once(play_path, '  | { kind: "deck-pick"; sourceCardId: string; revealed: string[]; filter: "defense-or-kata" | "technique" | "item"; optional: boolean; restAction: "discard" | "reorder" | "shuffle" }\n  | { kind: "deck-order"; sourceCardId: string; revealed: string[]; ordered: string[]; bonusFocus: number };', '  | { kind: "deck-pick"; sourceCardId: string; revealed: string[]; filter: "defense-or-kata" | "technique" | "item"; optional: boolean; restAction: "discard" | "reorder" | "shuffle" }\n  | { kind: "deck-order"; sourceCardId: string; revealed: string[]; ordered: string[]; bonusFocus: number }\n  | { kind: "equipment-zone"; sourceCardId: string; power: number; piercing: number; blockedFocus: number; requireDifferentPreviousZone: boolean }\n  | { kind: "ready-equipment"; sourceCardId: string; optional: boolean };')
replace_once(play_path, '  const direct = attackPiercing(card, { matchingArmor, targetEquipmentCount: defender.equipment.length, targetHasExhaustedEquipment: false, speedChangedThisRound: Boolean(attacker.speedChangedThisRound) });', '  const direct = attackPiercing(card, { matchingArmor, targetEquipmentCount: defender.equipment.length, targetHasExhaustedEquipment: Boolean(defender.exhaustedEquipment?.length), speedChangedThisRound: Boolean(attacker.speedChangedThisRound) });')

anchor = '''function piercedArmorModifier(armor: CombatModifier, piercing: number): CombatModifier {
  const ignored = Math.min(Math.max(0, piercing), Math.max(0, armor.value));
  return { value: armor.value - ignored, notes: [...armor.notes, ...(ignored ? [`Piercing ${piercing} ignores ${ignored} Armor DEF`] : [])] };
}
'''
helpers = anchor + r'''

function isEquipmentExhausted(board: Board, id: string) {
  return (board.exhaustedEquipment ?? []).includes(id);
}

function exhaustEquipment(board: Board, id: string) {
  if (isEquipmentExhausted(board, id)) return board;
  return { ...board, exhaustedEquipment: [...(board.exhaustedEquipment ?? []), id] };
}

function readyEquipment(board: Board, id: string) {
  return { ...board, exhaustedEquipment: (board.exhaustedEquipment ?? []).filter((candidate) => candidate !== id) };
}

function armedEquipmentAttackModifier(board: Board, zone: string) {
  const plan = board.equipmentAttackPlan;
  if (!plan) return { power: 0, piercing: 0, blockedFocus: 0, notes: [] as string[] };
  const previousZone = board.zonesPlayed.at(-1);
  const zoneMatches = plan.zone.toLocaleLowerCase() === zone.toLocaleLowerCase();
  const differentPrevious = !plan.requireDifferentPreviousZone || Boolean(previousZone && previousZone.toLocaleLowerCase() !== zone.toLocaleLowerCase());
  if (!zoneMatches || !differentPrevious) return { power: 0, piercing: 0, blockedFocus: 0, notes: [`${cardFor(plan.sourceCardId)?.name ?? "Equipment"} commitment missed`] };
  const notes = [
    ...(plan.power ? [`${cardFor(plan.sourceCardId)?.name ?? "Equipment"} +${plan.power} Attack Power`] : []),
    ...(plan.piercing ? [`${cardFor(plan.sourceCardId)?.name ?? "Equipment"} grants Piercing ${plan.piercing}`] : []),
  ];
  return { power: plan.power, piercing: plan.piercing, blockedFocus: plan.blockedFocus, notes };
}

function autoActivateAiAttackEquipment(board: Board, zone: string) {
  let next = board;
  let power = 0;
  let piercing = 0;
  let blockedFocus = 0;
  const notes: string[] = [];
  for (const id of board.equipment) {
    if (isEquipmentExhausted(next, id)) continue;
    const card = cardFor(id);
    const plan = card ? equipmentActivationPlan(card) : null;
    if (!card || !plan) continue;
    if (plan.kind === "next-attack-power") {
      next = exhaustEquipment(next, id);
      power += plan.power;
      notes.push(`${card.name} exhausts for +${plan.power} Attack Power`);
      continue;
    }
    if (plan.kind === "zone-attack") {
      const previousZone = next.zonesPlayed.at(-1);
      if (plan.requireDifferentPreviousZone && (!previousZone || previousZone.toLocaleLowerCase() === zone.toLocaleLowerCase())) continue;
      next = exhaustEquipment(next, id);
      power += plan.power;
      piercing += plan.piercing;
      blockedFocus += plan.blockedFocus;
      notes.push(`${card.name} exhausts and commits to ${zone}`);
    }
  }
  return { board: next, power, piercing, blockedFocus, notes };
}

function autoActivateAiTurnEquipment(board: Board) {
  let next = board;
  const notes: string[] = [];
  for (const id of board.equipment) {
    if (isEquipmentExhausted(next, id)) continue;
    const card = cardFor(id);
    const plan = card ? equipmentActivationPlan(card) : null;
    if (!card || !plan || plan.kind !== "speed-cycle") continue;
    next = exhaustEquipment(next, id);
    next = { ...next, tempSpeed: next.tempSpeed + plan.speed, speedChangedThisRound: true };
    notes.push(`${card.name} exhausts for +${plan.speed} Speed`);
    if (next.tempo && plan.draw) {
      next = drawCards(next, plan.draw);
      const discardCount = Math.min(plan.discard, next.hand.length);
      if (discardCount) {
        const ranked = [...next.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)));
        const discarded = ranked.slice(0, discardCount);
        next = { ...next, hand: next.hand.filter((candidate) => !discarded.includes(candidate)), discard: [...next.discard, ...discarded] };
        notes.push(`Tempo cycles ${plan.draw} draw / ${discardCount} discard`);
      }
    }
  }
  return { board: next, notes };
}
'''
replace_once(play_path, anchor, helpers)
replace_once(play_path, '    deck: shuffle(starterIds), hand: [], discard: [], playArea: [], equipment: [],', '    deck: shuffle(starterIds), hand: [], discard: [], playArea: [], equipment: [], exhaustedEquipment: [], equipmentAttackPlan: null,')
replace_once(play_path, '  const equipment = borrowed ? board.equipment.filter((id) => id !== borrowed) : board.equipment;\n  const discard = [...board.discard, ...board.hand, ...board.playArea.filter((id) => !board.equipment.includes(id)), ...(borrowed ? [borrowed] : [])];\n  return drawCards({ ...board, hand: [], playArea: [], equipment, discard, focus: 0, attacksThisTurn: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0, borrowedEquipmentId: null, wasHitSinceLastTurn: false, comboAttemptedTurn: false }, board.belt >= 5 ? 6 : 5);', '  const equipment = borrowed ? board.equipment.filter((id) => id !== borrowed) : board.equipment;\n  const exhaustedEquipment = borrowed ? (board.exhaustedEquipment ?? []).filter((id) => id !== borrowed) : (board.exhaustedEquipment ?? []);\n  const discard = [...board.discard, ...board.hand, ...board.playArea.filter((id) => !board.equipment.includes(id)), ...(borrowed ? [borrowed] : [])];\n  return drawCards({ ...board, hand: [], playArea: [], equipment, exhaustedEquipment, equipmentAttackPlan: null, discard, focus: 0, attacksThisTurn: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0, borrowedEquipmentId: null, wasHitSinceLastTurn: false, comboAttemptedTurn: false }, board.belt >= 5 ? 6 : 5);')
replace_once(play_path, '    const comboModifier = comboAttackModifier(current.player, card, zone);\n    const rawArmorModifier = equipmentDefenseModifier(current.ai, zone);\n    const piercingModifier = attackPiercingModifier(current.player, current.ai, card, zone, comboModifier.piercing);', '    const comboModifier = comboAttackModifier(current.player, card, zone);\n    const armedEquipment = armedEquipmentAttackModifier(current.player, zone);\n    const rawArmorModifier = equipmentDefenseModifier(current.ai, zone);\n    const piercingModifier = attackPiercingModifier(current.player, current.ai, card, zone, comboModifier.piercing + armedEquipment.piercing);')
replace_once(play_path, '    const attackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);', '    const attackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + armedEquipment.power);')
replace_once(play_path, '    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attacksThisTurn: current.player.attacksThisTurn + 1, hitThisTurn: current.player.hitThisTurn || hit, attackedThisRound: true, cardsThisTurn: [...current.player.cardsThisTurn, card.id], zonesPlayed: [...current.player.zonesPlayed, zone], nextAttackBonus: 0, nextAttackHasFlow: false, tempo: tempoBonus ? false : current.player.tempo, wasHitSinceLastTurn: current.player.attacksThisTurn === 0 ? false : current.player.wasHitSinceLastTurn, triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0, damageDealt: current.player.damageDealt + damage }, card, "player");', '    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attacksThisTurn: current.player.attacksThisTurn + 1, hitThisTurn: current.player.hitThisTurn || hit, attackedThisRound: true, cardsThisTurn: [...current.player.cardsThisTurn, card.id], zonesPlayed: [...current.player.zonesPlayed, zone], nextAttackBonus: 0, nextAttackHasFlow: false, equipmentAttackPlan: null, tempo: tempoBonus ? false : current.player.tempo, wasHitSinceLastTurn: current.player.attacksThisTurn === 0 ? false : current.player.wasHitSinceLastTurn, triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0, damageDealt: current.player.damageDealt + damage }, card, "player");')
replace_once(play_path, '    if (comboModifier.speedOnTrigger) nextPlayer.tempSpeed += comboModifier.speedOnTrigger;\n    let nextAi: Board =', '    if (comboModifier.speedOnTrigger) nextPlayer.tempSpeed += comboModifier.speedOnTrigger;\n    if (!hit && armedEquipment.blockedFocus) nextPlayer.focus += armedEquipment.blockedFocus;\n    let nextAi: Board =')
replace_once(play_path, '    const optionalCycle = !nextAi.hp ? null : optionalDiscardDrawChoice(card);\n    const pendingChoice: PendingChoice | null = optionalCycle && nextPlayer.hand.length ? { kind: "discard-draw", sourceCardId: card.id, remaining: optionalCycle.discard, draw: optionalCycle.draw } : null;\n    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...piercingModifier.notes, ...armorModifier.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...defenseFollowupNotes, ...(reduced.note ? [reduced.note] : [])];', '    const readyOnHit = hit ? readyEquipmentOnHit(card) : 0;\n    const optionalCycle = !nextAi.hp ? null : optionalDiscardDrawChoice(card);\n    const pendingChoice: PendingChoice | null = readyOnHit && (nextPlayer.exhaustedEquipment ?? []).length\n      ? { kind: "ready-equipment", sourceCardId: card.id, optional: true }\n      : optionalCycle && nextPlayer.hand.length ? { kind: "discard-draw", sourceCardId: card.id, remaining: optionalCycle.discard, draw: optionalCycle.draw } : null;\n    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...armedEquipment.notes, ...piercingModifier.notes, ...armorModifier.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...defenseFollowupNotes, ...(reduced.note ? [reduced.note] : [])];')

begin_yell = '  const beginYell = () => setMatch((current) => current?.phase === "player-initiate" ? write(current, "Initiate complete. Yell begins; subtlety has left the building.", { phase: "player-yell" }) : current);\n'
activation_block = begin_yell + r'''

  const activateEquipment = (id: string) => {
    setInspectedId(null);
    setMatch((current) => {
      if (!current || current.winner || current.pendingChoice || !current.player.equipment.includes(id) || isEquipmentExhausted(current.player, id)) return current;
      const card = cardFor(id);
      const plan = card ? equipmentActivationPlan(card) : null;
      if (!card || !plan) return current;
      if ((plan.kind === "next-attack-power" || plan.kind === "zone-attack") && current.phase !== "player-yell") return current;
      if (plan.kind === "speed-cycle" && current.phase !== "player-initiate" && current.phase !== "player-yell") return current;
      let player = exhaustEquipment(current.player, id);
      let pendingChoice: PendingChoice | null = null;
      let note = `${card.name} exhausted.`;
      if (plan.kind === "next-attack-power") {
        player = { ...player, nextAttackBonus: player.nextAttackBonus + plan.power };
        note += ` Your next Attack gets +${plan.power} Attack Power.`;
      } else if (plan.kind === "zone-attack") {
        pendingChoice = { kind: "equipment-zone", sourceCardId: id, power: plan.power, piercing: plan.piercing, blockedFocus: plan.blockedFocus, requireDifferentPreviousZone: plan.requireDifferentPreviousZone };
        note += " Choose the zone for the armed effect.";
      } else if (plan.kind === "speed-cycle") {
        player = { ...player, tempSpeed: player.tempSpeed + plan.speed, speedChangedThisRound: true };
        note += ` +${plan.speed} Speed until Honor.`;
        if (player.tempo && plan.draw) {
          player = drawCards(player, plan.draw);
          const discard = Math.min(plan.discard, player.hand.length);
          if (discard) pendingChoice = { kind: "discard-hand", sourceCardId: id, remaining: discard };
          note += ` Tempo is ready, so draw ${plan.draw}${discard ? ` and choose ${discard} discard${discard === 1 ? "" : "s"}` : ""}.`;
        }
      }
      return write(current, note, { player, pendingChoice });
    });
  };

  const chooseEquipmentZone = (zone: string) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "equipment-zone") return current;
    const player = { ...current.player, equipmentAttackPlan: { sourceCardId: choice.sourceCardId, zone, power: choice.power, piercing: choice.piercing, blockedFocus: choice.blockedFocus, requireDifferentPreviousZone: choice.requireDifferentPreviousZone } };
    return write(current, `${cardFor(choice.sourceCardId)?.name ?? "Equipment"} commits its next-Attack effect to ${zone}.`, { player, pendingChoice: null });
  });
'''
replace_once(play_path, begin_yell, activation_block)
replace_once(play_path, '  const resolvePendingChoice = (cardId: string, source: "hand" | "discard" | "deck" = "hand") => setMatch((current) => {', '  const resolvePendingChoice = (cardId: string, source: "hand" | "discard" | "deck" | "equipment" = "hand") => setMatch((current) => {')

resolve_anchor = '''    if (choice.kind === "deck-order") {
      if (source !== "deck" || !choice.revealed.includes(cardId) || choice.ordered.includes(cardId) && choice.revealed.filter((id) => id === cardId).length <= choice.ordered.filter((id) => id === cardId).length) return current;
      const remainingRevealed = removeOne(choice.revealed, cardId);
      const ordered = [...choice.ordered, cardId];
      if (remainingRevealed.length) {
        return write(current, `${selected.name} filed as draw position ${ordered.length}. Choose the next card.`, { pendingChoice: { ...choice, revealed: remainingRevealed, ordered } });
      }
      const player = { ...current.player, deck: [...current.player.deck, ...ordered.slice().reverse()], focus: current.player.focus + choice.bonusFocus };
      return write(current, `Deck order certified: ${ordered.map((id) => cardFor(id)?.name ?? "Unknown").join(" → ")}.${choice.bonusFocus ? ` Different card types grant +${choice.bonusFocus} Focus.` : ""}`, { player, pendingChoice: null });
    }

'''
ready_case = resolve_anchor + r'''    if (choice.kind === "ready-equipment") {
      if (source !== "equipment" || !current.player.equipment.includes(cardId) || !isEquipmentExhausted(current.player, cardId)) return current;
      const player = readyEquipment(current.player, cardId);
      return write(current, `${selected.name} readied by ${cardFor(choice.sourceCardId)?.name ?? "the printed effect"}.`, { player, pendingChoice: null });
    }

'''
replace_once(play_path, resolve_anchor, ready_case)
replace_once(play_path, '    if (current.pendingChoice.kind === "discard-draw") return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: discard/draw declined.`, { pendingChoice: null });', '    if (current.pendingChoice.kind === "discard-draw") return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: discard/draw declined.`, { pendingChoice: null });\n    if (current.pendingChoice.kind === "ready-equipment" && current.pendingChoice.optional) return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: ready effect declined.`, { pendingChoice: null });')
replace_once(play_path, '        : match.pendingChoice?.kind === "deck-order"\n          ? match.pendingChoice.revealed.map((id, index) => ({ id, source: "deck" as const, index }))\n          : [];', '        : match.pendingChoice?.kind === "deck-order"\n          ? match.pendingChoice.revealed.map((id, index) => ({ id, source: "deck" as const, index }))\n          : match.pendingChoice?.kind === "ready-equipment"\n            ? (player.exhaustedEquipment ?? []).filter((id) => player.equipment.includes(id)).map((id, index) => ({ id, source: "equipment" as const, index }))\n            : [];')
replace_once(play_path, '        : match.pendingChoice?.kind === "deck-pick" ? "Choose from the revealed cards"\n          : match.pendingChoice?.kind === "deck-order" ? "Set your draw order" : "Resolve printed effect";', '        : match.pendingChoice?.kind === "deck-pick" ? "Choose from the revealed cards"\n          : match.pendingChoice?.kind === "deck-order" ? "Set your draw order"\n            : match.pendingChoice?.kind === "equipment-zone" ? "Commit your Equipment zone"\n              : match.pendingChoice?.kind === "ready-equipment" ? "Ready Equipment?" : "Resolve printed effect";')
replace_once(play_path, '        : match.pendingChoice?.kind === "deck-pick" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} revealed ${match.pendingChoice.revealed.length} card${match.pendingChoice.revealed.length === 1 ? "" : "s"}. ${match.pendingChoice.optional ? "Take an eligible card or skip." : "Choose the eligible card to put into your hand."}`\n          : match.pendingChoice?.kind === "deck-order" ? `Choose the card you want to draw ${match.pendingChoice.ordered.length ? `in position ${match.pendingChoice.ordered.length + 1}` : "first"}. ${match.pendingChoice.revealed.length} card${match.pendingChoice.revealed.length === 1 ? " remains" : "s remain"}.` : "Resolve the printed effect.";', '        : match.pendingChoice?.kind === "deck-pick" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} revealed ${match.pendingChoice.revealed.length} card${match.pendingChoice.revealed.length === 1 ? "" : "s"}. ${match.pendingChoice.optional ? "Take an eligible card or skip." : "Choose the eligible card to put into your hand."}`\n          : match.pendingChoice?.kind === "deck-order" ? `Choose the card you want to draw ${match.pendingChoice.ordered.length ? `in position ${match.pendingChoice.ordered.length + 1}` : "first"}. ${match.pendingChoice.revealed.length} card${match.pendingChoice.revealed.length === 1 ? " remains" : "s remain"}.`\n            : match.pendingChoice?.kind === "equipment-zone" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Equipment"} is exhausted. Choose High, Mid, or Low for its armed next-Attack effect.`\n              : match.pendingChoice?.kind === "ready-equipment" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This effect"} can ready one exhausted Equipment card you control. You may decline.` : "Resolve the printed effect.";')
replace_once(play_path, '  const effectChoiceCanSkip = match.pendingChoice?.kind === "discard-draw" || (match.pendingChoice?.kind === "deck-pick" && match.pendingChoice.optional);', '  const effectChoiceCanSkip = match.pendingChoice?.kind === "discard-draw" || (match.pendingChoice?.kind === "deck-pick" && match.pendingChoice.optional) || (match.pendingChoice?.kind === "ready-equipment" && match.pendingChoice.optional);')
replace_once(play_path, '<div className="effect-choice-options">{pendingChoiceOptions.map((entry) => { const option = cardFor(entry.id); if (!option) return null; return <button type="button" onClick={() => resolvePendingChoice(entry.id, entry.source)} key={`${entry.source}-${entry.id}-${entry.index}`}><span>{entry.source === "discard" ? "DISCARD PILE" : entry.source === "deck" ? "REVEALED" : "HAND"}</span><b>{option.name}</b><small>{option.catalogId} · {option.subtype || option.cardType}</small></button>; })}</div>{effectChoiceCanSkip &&', '<div className="effect-choice-options">{match.pendingChoice?.kind === "equipment-zone" ? ["High", "Mid", "Low"].map((zone) => <button type="button" onClick={() => chooseEquipmentZone(zone)} key={zone}><span>COMMIT ZONE</span><b>{zone}</b><small>Applies to the next Attack only</small></button>) : pendingChoiceOptions.map((entry) => { const option = cardFor(entry.id); if (!option) return null; return <button type="button" onClick={() => resolvePendingChoice(entry.id, entry.source)} key={`${entry.source}-${entry.id}-${entry.index}`}><span>{entry.source === "discard" ? "DISCARD PILE" : entry.source === "deck" ? "REVEALED" : entry.source === "equipment" ? "EQUIPMENT" : "HAND"}</span><b>{option.name}</b><small>{option.catalogId} · {option.subtype || option.cardType}</small></button>; })}</div>{effectChoiceCanSkip &&')

old_loadout = '''{inspectedBoard && <section className="inspector-loadout"><header><div><span className="eyebrow">Current equipment</span><h3>Fighter loadout</h3></div><small>{inspectedBoard.equipment.length} equipped card{inspectedBoard.equipment.length === 1 ? "" : "s"}</small></header><div className="inspector-loadout-grid">{LOADOUT_SLOTS.map((slot) => { const equipped = inspectedBoard.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card && equipmentSlotLabel(card) === slot)); return <article className={`equipment-slot ${equipped.length ? "is-filled" : ""}`} key={slot}><span>{slot}</span>{equipped.length ? <div>{equipped.map((item, index) => <button type="button" onClick={() => setInspectedId(item.id)} key={`${item.id}-${index}`}><span className="equipment-slot-art">{artistUrl(item) ? <img src={artistUrl(item)} alt="" /> : <NativeCardArt card={item} />}</span><b>{item.name}</b><small>{item.details?.Slot ? String(item.details.Slot) : item.subtype}</small></button>)}</div> : <em>Empty</em>}</article>; })}</div></section>}'''
new_loadout = '''{inspectedBoard && <section className="inspector-loadout"><header><div><span className="eyebrow">Current equipment</span><h3>Fighter loadout</h3></div><small>{inspectedBoard.equipment.length} equipped card{inspectedBoard.equipment.length === 1 ? "" : "s"} · {(inspectedBoard.exhaustedEquipment ?? []).length} exhausted</small></header><div className="inspector-loadout-grid">{LOADOUT_SLOTS.map((slot) => { const equipped = inspectedBoard.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card && equipmentSlotLabel(card) === slot)); return <article className={`equipment-slot ${equipped.length ? "is-filled" : ""}`} key={slot}><span>{slot}</span>{equipped.length ? <div>{equipped.map((item, index) => { const exhausted = isEquipmentExhausted(inspectedBoard, item.id); const plan = equipmentActivationPlan(item); const ownLoadout = inspectedBoard === player; const legalPhase = plan?.kind === "speed-cycle" ? match.phase === "player-initiate" || match.phase === "player-yell" : plan ? match.phase === "player-yell" : false; return <div className={`equipment-slot-control ${exhausted ? "is-exhausted" : ""}`} key={`${item.id}-${index}`}><button type="button" onClick={() => setInspectedId(item.id)}><span className="equipment-slot-art">{artistUrl(item) ? <img src={artistUrl(item)} alt="" /> : <NativeCardArt card={item} />}</span><b>{item.name}</b><small>{exhausted ? "EXHAUSTED" : "READY"} · {item.details?.Slot ? String(item.details.Slot) : item.subtype}</small></button>{ownLoadout && plan && <button type="button" className="equipment-activate" disabled={exhausted || !legalPhase || Boolean(match.pendingChoice)} onClick={() => activateEquipment(item.id)}>{exhausted ? "Exhausted" : legalPhase ? "Exhaust →" : "Use during Yell"}</button>}</div>; })}</div> : <em>Empty</em>}</article>; })}</div></section>}'''
replace_once(play_path, old_loadout, new_loadout)

replace_once(play_path, '  const comboModifier = comboAttackModifier(current.ai, card, zone);\n  const piercingModifier = attackPiercingModifier(current.ai, current.player, card, zone, comboModifier.piercing);\n  const hasFlow = attackHasFlow(current.ai, card, comboModifier);\n  const attackPower = Math.max(0, cardPower(card) + fighterStat(current.ai, "ATK") + current.ai.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);\n  let nextAi = applyCardEffects({ ...current.ai,', '  const comboModifier = comboAttackModifier(current.ai, card, zone);\n  const activeEquipment = autoActivateAiAttackEquipment(current.ai, zone);\n  const piercingModifier = attackPiercingModifier(activeEquipment.board, current.player, card, zone, comboModifier.piercing + activeEquipment.piercing);\n  const hasFlow = attackHasFlow(activeEquipment.board, card, comboModifier);\n  const attackPower = Math.max(0, cardPower(card) + fighterStat(activeEquipment.board, "ATK") + activeEquipment.board.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + activeEquipment.power);\n  let nextAi = applyCardEffects({ ...activeEquipment.board,')
replace_once(play_path, '  const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...piercingModifier.notes];\n  return { ...current, player: { ...current.player, attacksReceivedThisRound: (current.player.attacksReceivedThisRound ?? 0) + 1 }, ai: nextAi, phase: "defense-window" as const, pendingStrike: { cardId, zone, attackPower, damageModifier: locationModifier.damage + fighterModifier.damage + comboModifier.damage, piercing: piercingModifier.value, modifierNotes: modifiers, remainingAiAttacks },', '  const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...activeEquipment.notes, ...piercingModifier.notes];\n  return { ...current, player: { ...current.player, attacksReceivedThisRound: (current.player.attacksReceivedThisRound ?? 0) + 1 }, ai: nextAi, phase: "defense-window" as const, pendingStrike: { cardId, zone, attackPower, damageModifier: locationModifier.damage + fighterModifier.damage + comboModifier.damage, piercing: piercingModifier.value, blockedFocus: activeEquipment.blockedFocus, modifierNotes: modifiers, remainingAiAttacks },')
replace_once(play_path, '    nextAi = applyCardEffects(nextAi, aiCard, "ai", hit ? "onHit" : "afterResolve");\n    if (hit) nextAi = applyCardEffects(nextAi, aiCard, "ai", "afterResolve");', '    nextAi = applyCardEffects(nextAi, aiCard, "ai", hit ? "onHit" : "afterResolve");\n    if (hit) nextAi = applyCardEffects(nextAi, aiCard, "ai", "afterResolve");\n    if (!hit && pending.blockedFocus) nextAi.focus += pending.blockedFocus;\n    if (hit && readyEquipmentOnHit(aiCard) && (nextAi.exhaustedEquipment ?? []).length) nextAi = readyEquipment(nextAi, (nextAi.exhaustedEquipment ?? [])[0]);')
replace_once(play_path, '  const player = { ...current.player, xp: current.player.xp + 1, tempo: true, tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], damageReductionUsed: false, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] };\n  const ai = { ...current.ai, xp: current.ai.xp + 1, tempo: true, tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], damageReductionUsed: false, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] };', '  const player = { ...current.player, xp: current.player.xp + 1, tempo: true, tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, equipmentAttackPlan: null, exhaustedEquipment: [], attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], damageReductionUsed: false, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] };\n  const ai = { ...current.ai, xp: current.ai.xp + 1, tempo: true, tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, equipmentAttackPlan: null, exhaustedEquipment: [], attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], damageReductionUsed: false, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] };')
replace_once(play_path, 'function prepareAiTurn(current: Match) {\n  const fighter = cardFor(current.ai.fighterId);\n  const practiceId = current.ai.defensePracticeUsed ? undefined : current.ai.hand', 'function prepareAiTurn(current: Match) {\n  const fighter = cardFor(current.ai.fighterId);\n  const turnEquipment = autoActivateAiTurnEquipment(current.ai);\n  const aiStart = turnEquipment.board;\n  const practiceId = aiStart.defensePracticeUsed ? undefined : aiStart.hand')
replace_once(play_path, '  let nextAi = practiceId ? {\n    ...current.ai,', '  let nextAi = practiceId ? {\n    ...aiStart,')
replace_once(play_path, '    defensePracticeUsed: true,\n  } : current.ai;', '    defensePracticeUsed: true,\n  } : aiStart;')
replace_once(play_path, '  if (!supportIds.length && !practiceId) return current;', '  if (!supportIds.length && !practiceId && !turnEquipment.notes.length) return current;')
replace_once(play_path, '  const preparations = [\n    ...(practiceId ? [`Defense Practice with ${cardFor(practiceId)?.name}`] : []),\n    ...played,\n  ];', '  const preparations = [\n    ...turnEquipment.notes,\n    ...(practiceId ? [`Defense Practice with ${cardFor(practiceId)?.name}`] : []),\n    ...played,\n  ];')

css_path = "app/playtest-board-v4.css"
css = read(css_path)
css_append = r'''

/* Exhaust / Ready state lives inside the loadout inspector, not on the main board. */
.equipment-slot-control { display: grid; gap: 4px; }
.equipment-slot-control.is-exhausted { opacity: .62; }
.equipment-slot-control.is-exhausted .equipment-slot-art { transform: rotate(4deg); filter: saturate(.55); }
.equipment-slot-control .equipment-activate {
  display: block !important;
  width: 100%;
  min-height: 28px;
  padding: 5px 7px !important;
  border: 1px solid rgba(245,179,34,.4) !important;
  background: rgba(245,179,34,.09) !important;
  color: inherit !important;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: .08em;
  text-align: center !important;
  text-transform: uppercase;
}
.equipment-slot-control .equipment-activate:disabled { opacity: .38; cursor: not-allowed; }
'''
if ".equipment-slot-control .equipment-activate" in css:
    raise SystemExit("Equipment activation CSS already present")
write(css_path, css.rstrip() + css_append + "\n")

test_path = "tests/effect-resolvers.test.mjs"
tests = read(test_path)
tests = tests.replace('discardChoiceFollowup, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier,', 'discardChoiceFollowup, equipmentActivationPlan, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier,')
tests = tests.replace('optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty,', 'optionalDiscardDrawChoice, passiveEquipmentGuard, readyEquipmentOnHit, targetNextAttackPenalty,')
tests += r'''

test("Equipment Exhaust activation plans compile from printed Gear and Weapon text", () => {
  assert.deepEqual(equipmentActivationPlan({ rulesText: "Exhaust: Gain +1 Speed until the next Honor Phase. If you have Tempo after doing so, draw 1 card, then discard 1 card." }), { kind: "speed-cycle", speed: 1, draw: 1, discard: 1 });
  assert.deepEqual(equipmentActivationPlan({ rulesText: "Exhaust: Your next Attack using this Weapon gets +3 Attack Power." }), { kind: "next-attack-power", power: 3 });
  assert.deepEqual(equipmentActivationPlan({ rulesText: "Exhaust: Before you play an Attack, choose High, Mid, or Low. If your next Attack this turn uses that zone, it gains Piercing 1. If it is Blocked, gain 1 Focus." }), { kind: "zone-attack", power: 0, piercing: 1, blockedFocus: 1, requireDifferentPreviousZone: false });
  assert.deepEqual(equipmentActivationPlan({ rulesText: "Exhaust: Before you play an Attack, choose High, Mid, or Low. If that Attack uses the chosen zone and differs from your previous Attack zone this turn, it gets +1 Attack Power." }), { kind: "zone-attack", power: 1, piercing: 0, blockedFocus: 0, requireDifferentPreviousZone: true });
});

test("on-hit ready text is recognized without pretending all Ready clauses are automatic", () => {
  assert.equal(readyEquipmentOnHit({ rulesText: "If the target has exhausted Equipment, this Attack gains Piercing 1. If it Hits, you may ready one Equipment card you control." }), 1);
  assert.equal(readyEquipmentOnHit({ rulesText: "Ready one Equipment during Initiate." }), 0);
});
'''
write(test_path, tests)

integration_path = "tests/playtest-effect-integration.test.mjs"
integration = read(integration_path)
integration += r'''

test("Quick Duel tracks Exhausted Equipment and exposes supported activation controls", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /exhaustedEquipment/);
  assert.match(source, /equipmentAttackPlan/);
  assert.match(source, /activateEquipment/);
  assert.match(source, /chooseEquipmentZone/);
  assert.match(source, /isEquipmentExhausted/);
  assert.match(source, /readyEquipment/);
  assert.match(source, /equipment-activate/);
});

test("Exhausted target state feeds Piercing and Honor readies the loadout", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /targetHasExhaustedEquipment: Boolean\(defender\.exhaustedEquipment\?\.length\)/);
  assert.match(source, /exhaustedEquipment: \[\]/);
  assert.match(source, /readyEquipmentOnHit/);
  assert.match(source, /autoActivateAiAttackEquipment/);
  assert.match(source, /autoActivateAiTurnEquipment/);
});
'''
write(integration_path, integration)
