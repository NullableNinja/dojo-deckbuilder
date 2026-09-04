from pathlib import Path


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_first(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f"Expected patch anchor missing in {path}: {old[:140]!r}")
    write(path, text.replace(old, new, 1))


Path("scripts/deploy_patch_message.txt").write_text("Add reaction Exhaust equipment effects")

# --- effect resolvers -------------------------------------------------------
effect_path = "app/effect-resolvers.ts"
replace_first(
    effect_path,
    '''export type EquipmentActivationPlan =
  | { kind: "speed-cycle"; speed: number; draw: number; discard: number }
  | { kind: "next-attack-power"; power: number }
  | { kind: "zone-attack"; power: number; piercing: number; blockedFocus: number; requireDifferentPreviousZone: boolean };''',
    '''export type EquipmentActivationPlan =
  | { kind: "speed-cycle"; speed: number; draw: number; discard: number }
  | { kind: "next-attack-power"; power: number }
  | { kind: "zone-attack"; power: number; piercing: number; blockedFocus: number; requireDifferentPreviousZone: boolean }
  | { kind: "incoming-zone-penalty"; attackPowerPenalty: number }
  | { kind: "defense-guard"; guard: number; reversalPower: number };'''
)
replace_first(
    effect_path,
    '''  match = text.match(/^Exhaust:\\s*Before you play an Attack, choose High, Mid, or Low\\. If that Attack uses the chosen zone and differs from your previous Attack zone this turn, it gets \\+(\\d+) Attack Power/i);
  if (match) return { kind: "zone-attack", power: Number(match[1]), piercing: 0, blockedFocus: 0, requireDifferentPreviousZone: true };

  return null;''',
    '''  match = text.match(/^Exhaust:\\s*Before you play an Attack, choose High, Mid, or Low\\. If that Attack uses the chosen zone and differs from your previous Attack zone this turn, it gets \\+(\\d+) Attack Power/i);
  if (match) return { kind: "zone-attack", power: Number(match[1]), piercing: 0, blockedFocus: 0, requireDifferentPreviousZone: true };

  match = text.match(/^Exhaust:\\s*After an opponent declares an Attack targeting you, choose High, Mid, or Low\\. If that Attack uses the chosen zone, it gets -(\\d+) Attack Power/i);
  if (match) return { kind: "incoming-zone-penalty", attackPowerPenalty: Number(match[1]) };

  match = text.match(/^Exhaust:\\s*When you play a Defense outside your turn, it gets \\+(\\d+) Guard\\. At Green Belt or higher, if it Blocks, your Reversal this round gets \\+(\\d+) Attack Power/i);
  if (match) return { kind: "defense-guard", guard: Number(match[1]), reversalPower: Number(match[2]) };

  return null;'''
)

# --- playtest state + helpers ---------------------------------------------
play_path = "app/playtest.tsx"
replace_first(
    play_path,
    '''  equipmentAttackPlan?: { sourceCardId: string; zone: string; power: number; piercing: number; blockedFocus: number; requireDifferentPreviousZone: boolean } | null;
  tempSpeed: number;''',
    '''  equipmentAttackPlan?: { sourceCardId: string; zone: string; power: number; piercing: number; blockedFocus: number; requireDifferentPreviousZone: boolean } | null;
  equipmentDefenseGuard?: number;
  pendingReversalBonusOnBlock?: number;
  reversalAttackBonus?: number;
  tempSpeed: number;'''
)
replace_first(
    play_path,
    '''  blockedFocus?: number;
  modifierNotes: string[];''',
    '''  blockedFocus?: number;
  targetExhaustedAtDeclaration?: boolean;
  modifierNotes: string[];'''
)
replace_first(
    play_path,
    '''  | { kind: "equipment-zone"; sourceCardId: string; power: number; piercing: number; blockedFocus: number; requireDifferentPreviousZone: boolean }
  | { kind: "ready-equipment"; sourceCardId: string; optional: boolean };''',
    '''  | { kind: "equipment-zone"; sourceCardId: string; power: number; piercing: number; blockedFocus: number; requireDifferentPreviousZone: boolean }
  | { kind: "incoming-equipment-zone"; sourceCardId: string; attackPowerPenalty: number }
  | { kind: "ready-equipment"; sourceCardId: string; optional: boolean };'''
)

helper_anchor = '''function autoActivateAiTurnEquipment(board: Board) {
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
helper_add = helper_anchor + '''
function autoActivateAiIncomingEquipment(board: Board, zone: string) {
  let next = board;
  let attackPowerPenalty = 0;
  const notes: string[] = [];
  for (const id of board.equipment) {
    if (isEquipmentExhausted(next, id)) continue;
    const card = cardFor(id);
    const plan = card ? equipmentActivationPlan(card) : null;
    if (!card || !plan || plan.kind !== "incoming-zone-penalty") continue;
    next = exhaustEquipment(next, id);
    attackPowerPenalty += plan.attackPowerPenalty;
    notes.push(`${card.name} exhausts, calls ${zone}, and applies -${plan.attackPowerPenalty} Attack Power`);
  }
  return { board: next, attackPowerPenalty, notes };
}

function autoActivateAiDefenseGuardEquipment(board: Board) {
  let next = board;
  let guard = 0;
  const notes: string[] = [];
  for (const id of board.equipment) {
    if (isEquipmentExhausted(next, id)) continue;
    const card = cardFor(id);
    const plan = card ? equipmentActivationPlan(card) : null;
    if (!card || !plan || plan.kind !== "defense-guard") continue;
    next = exhaustEquipment(next, id);
    guard += plan.guard;
    notes.push(`${card.name} exhausts for +${plan.guard} Guard`);
  }
  return { board: next, guard, notes };
}
'''
replace_first(play_path, helper_anchor, helper_add)
replace_first(
    play_path,
    '''    deck: shuffle(starterIds), hand: [], discard: [], playArea: [], equipment: [], exhaustedEquipment: [], equipmentAttackPlan: null,
    tempSpeed: 0,''',
    '''    deck: shuffle(starterIds), hand: [], discard: [], playArea: [], equipment: [], exhaustedEquipment: [], equipmentAttackPlan: null, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: 0,
    tempSpeed: 0,'''
)

# --- player activation -----------------------------------------------------
replace_first(
    play_path,
    '''      if ((plan.kind === "next-attack-power" || plan.kind === "zone-attack") && current.phase !== "player-yell") return current;
      if (plan.kind === "speed-cycle" && current.phase !== "player-initiate" && current.phase !== "player-yell") return current;''',
    '''      if ((plan.kind === "next-attack-power" || plan.kind === "zone-attack") && current.phase !== "player-yell") return current;
      if (plan.kind === "speed-cycle" && current.phase !== "player-initiate" && current.phase !== "player-yell") return current;
      if ((plan.kind === "incoming-zone-penalty" || plan.kind === "defense-guard") && current.phase !== "defense-window") return current;'''
)
replace_first(
    play_path,
    '''      } else if (plan.kind === "speed-cycle") {
        player = { ...player, tempSpeed: player.tempSpeed + plan.speed, speedChangedThisRound: true };
        note += ` +${plan.speed} Speed until Honor.`;
        if (player.tempo && plan.draw) {
          player = drawCards(player, plan.draw);
          const discard = Math.min(plan.discard, player.hand.length);
          if (discard) pendingChoice = { kind: "discard-hand", sourceCardId: id, remaining: discard };
          note += ` Tempo is ready, so draw ${plan.draw}${discard ? ` and choose ${discard} discard${discard === 1 ? "" : "s"}` : ""}.`;
        }
      }
      return write(current, note, { player, pendingChoice });''',
    '''      } else if (plan.kind === "speed-cycle") {
        player = { ...player, tempSpeed: player.tempSpeed + plan.speed, speedChangedThisRound: true };
        note += ` +${plan.speed} Speed until Honor.`;
        if (player.tempo && plan.draw) {
          player = drawCards(player, plan.draw);
          const discard = Math.min(plan.discard, player.hand.length);
          if (discard) pendingChoice = { kind: "discard-hand", sourceCardId: id, remaining: discard };
          note += ` Tempo is ready, so draw ${plan.draw}${discard ? ` and choose ${discard} discard${discard === 1 ? "" : "s"}` : ""}.`;
        }
      } else if (plan.kind === "incoming-zone-penalty") {
        pendingChoice = { kind: "incoming-equipment-zone", sourceCardId: id, attackPowerPenalty: plan.attackPowerPenalty };
        note += " Call High, Mid, or Low against the declared Attack.";
      } else if (plan.kind === "defense-guard") {
        const greenBeltIndex = belts.findIndex((belt) => belt.name.toLocaleLowerCase() === "green");
        const reversalPower = greenBeltIndex >= 0 && player.belt >= greenBeltIndex ? plan.reversalPower : 0;
        player = {
          ...player,
          equipmentDefenseGuard: (player.equipmentDefenseGuard ?? 0) + plan.guard,
          pendingReversalBonusOnBlock: (player.pendingReversalBonusOnBlock ?? 0) + reversalPower,
        };
        note += ` Your next Defense in this Reaction Window gets +${plan.guard} Guard.${reversalPower ? ` A Block primes the Reversal for +${reversalPower} Attack Power.` : ""}`;
      }
      return write(current, note, { player, pendingChoice });'''
)
replace_first(
    play_path,
    '''  const chooseEquipmentZone = (zone: string) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "equipment-zone") return current;
    const player = { ...current.player, equipmentAttackPlan: { sourceCardId: choice.sourceCardId, zone, power: choice.power, piercing: choice.piercing, blockedFocus: choice.blockedFocus, requireDifferentPreviousZone: choice.requireDifferentPreviousZone } };
    return write(current, `${cardFor(choice.sourceCardId)?.name ?? "Equipment"} commits its next-Attack effect to ${zone}.`, { player, pendingChoice: null });
  });
''',
    '''  const chooseEquipmentZone = (zone: string) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "equipment-zone") return current;
    const player = { ...current.player, equipmentAttackPlan: { sourceCardId: choice.sourceCardId, zone, power: choice.power, piercing: choice.piercing, blockedFocus: choice.blockedFocus, requireDifferentPreviousZone: choice.requireDifferentPreviousZone } };
    return write(current, `${cardFor(choice.sourceCardId)?.name ?? "Equipment"} commits its next-Attack effect to ${zone}.`, { player, pendingChoice: null });
  });

  const chooseIncomingEquipmentZone = (zone: string) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "incoming-equipment-zone" || !current.pendingStrike) return current;
    const matched = zone.toLocaleLowerCase() === current.pendingStrike.zone.toLocaleLowerCase();
    const pendingStrike = matched
      ? { ...current.pendingStrike, attackPower: Math.max(0, current.pendingStrike.attackPower - choice.attackPowerPenalty), modifierNotes: [...current.pendingStrike.modifierNotes, `${cardFor(choice.sourceCardId)?.name ?? "Equipment"} called ${zone}: -${choice.attackPowerPenalty} Attack Power`] }
      : current.pendingStrike;
    return write(current, `${cardFor(choice.sourceCardId)?.name ?? "Equipment"} calls ${zone}.${matched ? ` The declared Attack loses ${choice.attackPowerPenalty} Attack Power.` : " The call misses the declared zone."}`, { pendingStrike, pendingChoice: null });
  });
'''
)

# --- AI reacts to player's Attack -----------------------------------------
replace_first(
    play_path,
    '''    const comboModifier = comboAttackModifier(current.player, card, zone);
    const armedEquipment = armedEquipmentAttackModifier(current.player, zone);
    const rawArmorModifier = equipmentDefenseModifier(current.ai, zone);
    const piercingModifier = attackPiercingModifier(current.player, current.ai, card, zone, comboModifier.piercing + armedEquipment.piercing);
    const armorModifier = piercedArmorModifier(rawArmorModifier, piercingModifier.value);
    const hasFlow = attackHasFlow(current.player, card, comboModifier);
    const attackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + armedEquipment.power);
    const defenseId = bestDefense(current.ai, zone, attackPower, settings.difficulty, location, card, current.player, piercingModifier.value);
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    const defenseModifier = locationDefenseModifier(location, defenseCard, current.ai, zone);
    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(current.ai, current.player, defenseCard, card) : { value: 0, notes: [] as string[] };
    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (current.ai.nextDefenseCardBonus ?? 0) : 0) + defenseCardModifier.value + defenseModifier.value);
    const hit = attackPower > defensePower;
    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage + comboModifier.damage) : 0;
    const reduced = reduceDamageForFighter(current.ai, rawDamage);''',
    '''    const comboModifier = comboAttackModifier(current.player, card, zone);
    const armedEquipment = armedEquipmentAttackModifier(current.player, zone);
    const aiIncomingReaction = autoActivateAiIncomingEquipment(current.ai, zone);
    const rawArmorModifier = equipmentDefenseModifier(aiIncomingReaction.board, zone);
    const piercingModifier = attackPiercingModifier(current.player, aiIncomingReaction.board, card, zone, comboModifier.piercing + armedEquipment.piercing);
    const armorModifier = piercedArmorModifier(rawArmorModifier, piercingModifier.value);
    const hasFlow = attackHasFlow(current.player, card, comboModifier);
    const attackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);
    const defenseId = bestDefense(aiIncomingReaction.board, zone, attackPower, settings.difficulty, location, card, current.player, piercingModifier.value);
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    const aiDefenseReaction = defenseCard ? autoActivateAiDefenseGuardEquipment(aiIncomingReaction.board) : { board: aiIncomingReaction.board, guard: 0, notes: [] as string[] };
    const defenseModifier = locationDefenseModifier(location, defenseCard, aiDefenseReaction.board, zone);
    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(aiDefenseReaction.board, current.player, defenseCard, card) : { value: 0, notes: [] as string[] };
    const defensePower = Math.max(0, fighterStat(aiDefenseReaction.board, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (aiDefenseReaction.board.nextDefenseCardBonus ?? 0) + aiDefenseReaction.guard : 0) + defenseCardModifier.value + defenseModifier.value);
    const hit = attackPower > defensePower;
    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage + comboModifier.damage) : 0;
    const reduced = reduceDamageForFighter(aiDefenseReaction.board, rawDamage);'''
)
replace_first(
    play_path,
    '''    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...armedEquipment.notes, ...piercingModifier.notes, ...armorModifier.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...defenseFollowupNotes, ...(reduced.note ? [reduced.note] : [])];''',
    '''    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...armedEquipment.notes, ...aiIncomingReaction.notes, ...aiDefenseReaction.notes, ...piercingModifier.notes, ...armorModifier.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...defenseFollowupNotes, ...(reduced.note ? [reduced.note] : [])];'''
)

# --- player Defense resolution --------------------------------------------
replace_first(
    play_path,
    '''    let nextPlayer = { ...current.player };
    const armorModifier = piercedArmorModifier(equipmentDefenseModifier(nextPlayer, pending.zone), pending.piercing ?? 0);
    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(nextPlayer, current.ai, defenseCard, aiCard) : { value: 0, notes: [] as string[] };''',
    '''    let nextPlayer = { ...current.player };
    const matchingArmor = equipmentDefenseModifier(nextPlayer, pending.zone).value > 0;
    const exhaustedPiercingBonus = !pending.targetExhaustedAtDeclaration && (nextPlayer.exhaustedEquipment ?? []).length
      ? Math.max(0,
          attackPiercing(aiCard, { matchingArmor, targetEquipmentCount: nextPlayer.equipment.length, targetHasExhaustedEquipment: true, speedChangedThisRound: Boolean(current.ai.speedChangedThisRound) }).amount
          - attackPiercing(aiCard, { matchingArmor, targetEquipmentCount: nextPlayer.equipment.length, targetHasExhaustedEquipment: false, speedChangedThisRound: Boolean(current.ai.speedChangedThisRound) }).amount)
      : 0;
    const effectivePiercing = (pending.piercing ?? 0) + exhaustedPiercingBonus;
    const armorModifier = piercedArmorModifier(equipmentDefenseModifier(nextPlayer, pending.zone), effectivePiercing);
    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(nextPlayer, current.ai, defenseCard, aiCard) : { value: 0, notes: [] as string[] };'''
)
replace_first(
    play_path,
    '''      defensePower += cardPower(defenseCard) + (nextPlayer.nextDefenseCardBonus ?? 0) + defenseCardModifier.value + tempoBonus + locationModifier.value;''',
    '''      defensePower += cardPower(defenseCard) + (nextPlayer.nextDefenseCardBonus ?? 0) + (nextPlayer.equipmentDefenseGuard ?? 0) + defenseCardModifier.value + tempoBonus + locationModifier.value;'''
)
replace_first(
    play_path,
    '''    const hit = pending.attackPower > defensePower;
    const rawDamage = hit ? Math.max(0, pending.attackPower - defensePower + (pending.damageModifier ?? 0)) : 0;''',
    '''    const hit = pending.attackPower > defensePower;
    const reversalEquipmentBonus = !hit && defenseCard ? (nextPlayer.pendingReversalBonusOnBlock ?? 0) : 0;
    const rawDamage = hit ? Math.max(0, pending.attackPower - defensePower + (pending.damageModifier ?? 0)) : 0;'''
)
replace_first(
    play_path,
    '''    nextPlayer = targetDebuff.board;
    let nextAi = markCompletedTask({ ...current.ai, damageDealt: current.ai.damageDealt + damage, hitThisTurn: current.ai.hitThisTurn || hit });''',
    '''    nextPlayer = { ...targetDebuff.board, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: (targetDebuff.board.reversalAttackBonus ?? 0) + reversalEquipmentBonus };
    let nextAi = markCompletedTask({ ...current.ai, damageDealt: current.ai.damageDealt + damage, hitThisTurn: current.ai.hitThisTurn || hit });'''
)
replace_first(
    play_path,
    '''    const modifiers = [...(pending.modifierNotes ?? []), ...armorModifier.notes, ...defenseCardModifier.notes, ...locationModifier.notes, ...targetDebuff.notes, ...(reduced.note ? [reduced.note] : [])];''',
    '''    const modifiers = [...(pending.modifierNotes ?? []), ...(exhaustedPiercingBonus ? [`Exhausted Equipment adds Piercing ${exhaustedPiercingBonus}`] : []), ...((current.player.equipmentDefenseGuard ?? 0) ? [`Equipment reaction +${current.player.equipmentDefenseGuard} Guard`] : []), ...(reversalEquipmentBonus ? [`Block primes Reversal +${reversalEquipmentBonus} Attack Power`] : []), ...armorModifier.notes, ...defenseCardModifier.notes, ...locationModifier.notes, ...targetDebuff.notes, ...(reduced.note ? [reduced.note] : [])];'''
)
replace_first(
    play_path,
    '''    const resumed = write(current, "Reversal declined. Restraint has been noted and immediately questioned.", { selectedAttackId: null });''',
    '''    const resumed = write(current, "Reversal declined. Restraint has been noted and immediately questioned.", { selectedAttackId: null, player: { ...current.player, reversalAttackBonus: 0 } });'''
)
replace_first(
    play_path,
    '''    const attackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);''',
    '''    const attackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + (current.player.reversalAttackBonus ?? 0) + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);'''
)
replace_first(
    play_path,
    '''    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attackedThisRound: true, zonesPlayed: [...current.player.zonesPlayed, zone], cardsThisTurn: [...current.player.cardsThisTurn, card.id], reversalUsedRound: true,''',
    '''    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attackedThisRound: true, zonesPlayed: [...current.player.zonesPlayed, zone], cardsThisTurn: [...current.player.cardsThisTurn, card.id], reversalUsedRound: true, reversalAttackBonus: 0,'''
)

# AI strike records whether Exhaust-based Piercing was already active at declaration.
replace_first(
    play_path,
    '''pendingStrike: { cardId, zone, attackPower, damageModifier: locationModifier.damage + fighterModifier.damage + comboModifier.damage, piercing: piercingModifier.value, blockedFocus: activeEquipment.blockedFocus, modifierNotes: modifiers, remainingAiAttacks }''',
    '''pendingStrike: { cardId, zone, attackPower, damageModifier: locationModifier.damage + fighterModifier.damage + comboModifier.damage, piercing: piercingModifier.value, blockedFocus: activeEquipment.blockedFocus, targetExhaustedAtDeclaration: Boolean(current.player.exhaustedEquipment?.length), modifierNotes: modifiers, remainingAiAttacks }'''
)

# --- reset temporary reaction state at Honor ------------------------------
replace_first(
    play_path,
    '''equipmentAttackPlan: null, exhaustedEquipment: [], attackedThisRound: false''',
    '''equipmentAttackPlan: null, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: 0, exhaustedEquipment: [], attackedThisRound: false'''
)
replace_first(
    play_path,
    '''equipmentAttackPlan: null, exhaustedEquipment: [], attackedThisRound: false''',
    '''equipmentAttackPlan: null, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: 0, exhaustedEquipment: [], attackedThisRound: false'''
)

# --- UI: reaction tray, choice dialog, loadout legal timing ----------------
replace_first(
    play_path,
    '''  const defenseOptions = match.pendingStrike ? legalDefenseIds(player, match.pendingStrike.zone) : [];
  const pendingChoiceOptions =''',
    '''  const defenseOptions = match.pendingStrike ? legalDefenseIds(player, match.pendingStrike.zone) : [];
  const equipmentReactions = match.phase === "defense-window"
    ? player.equipment.map(cardFor).filter((card): card is CardEntry => {
        if (!card || isEquipmentExhausted(player, card.id)) return false;
        const plan = equipmentActivationPlan(card);
        return plan?.kind === "incoming-zone-penalty" || plan?.kind === "defense-guard";
      })
    : [];
  const pendingChoiceOptions ='''
)
replace_first(
    play_path,
    '''          : match.pendingChoice?.kind === "deck-order" ? "Set your draw order"
            : match.pendingChoice?.kind === "equipment-zone" ? "Commit your Equipment zone"
              : match.pendingChoice?.kind === "ready-equipment" ? "Ready Equipment?" : "Resolve printed effect";''',
    '''          : match.pendingChoice?.kind === "deck-order" ? "Set your draw order"
            : match.pendingChoice?.kind === "equipment-zone" ? "Commit your Equipment zone"
              : match.pendingChoice?.kind === "incoming-equipment-zone" ? "Call the incoming zone"
                : match.pendingChoice?.kind === "ready-equipment" ? "Ready Equipment?" : "Resolve printed effect";'''
)
replace_first(
    play_path,
    '''            : match.pendingChoice?.kind === "equipment-zone" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Equipment"} is exhausted. Choose High, Mid, or Low for its armed next-Attack effect.`
              : match.pendingChoice?.kind === "ready-equipment" ?''',
    '''            : match.pendingChoice?.kind === "equipment-zone" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Equipment"} is exhausted. Choose High, Mid, or Low for its armed next-Attack effect.`
              : match.pendingChoice?.kind === "incoming-equipment-zone" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Equipment"} is exhausted. Call High, Mid, or Low against the declared ${match.pendingStrike?.zone ?? "incoming"} Attack.`
                : match.pendingChoice?.kind === "ready-equipment" ?'''
)
replace_first(
    play_path,
    '''<div className="effect-choice-options">{match.pendingChoice?.kind === "equipment-zone" ? ["High", "Mid", "Low"].map((zone) => <button type="button" onClick={() => chooseEquipmentZone(zone)} key={zone}><span>COMMIT ZONE</span><b>{zone}</b><small>Applies to the next Attack only</small></button>) : pendingChoiceOptions.map''',
    '''<div className="effect-choice-options">{match.pendingChoice?.kind === "equipment-zone" ? ["High", "Mid", "Low"].map((zone) => <button type="button" onClick={() => chooseEquipmentZone(zone)} key={zone}><span>COMMIT ZONE</span><b>{zone}</b><small>Applies to the next Attack only</small></button>) : match.pendingChoice?.kind === "incoming-equipment-zone" ? ["High", "Mid", "Low"].map((zone) => <button type="button" onClick={() => chooseIncomingEquipmentZone(zone)} key={zone}><span>CALL ZONE</span><b>{zone}</b><small>{zone === match.pendingStrike?.zone ? "Matches the declared Attack" : "Does not match the declared Attack"}</small></button>) : pendingChoiceOptions.map'''
)
replace_first(
    play_path,
    '''        <div className="play-card-row">{player.hand.map''',
    '''        {equipmentReactions.length > 0 && <div className="equipment-reaction-strip" aria-label="Available Equipment reactions"><span>Equipment reactions</span>{equipmentReactions.map((item) => { const plan = equipmentActivationPlan(item)!; return <button type="button" disabled={Boolean(match.pendingChoice)} onClick={() => activateEquipment(item.id)} key={item.id}><b>Exhaust {item.name}</b><small>{plan.kind === "incoming-zone-penalty" ? `Call a zone · -${plan.attackPowerPenalty} Attack Power on a match` : `Your Defense gets +${plan.guard} Guard${plan.reversalPower ? " · Green+ Block boosts Reversal" : ""}`}</small></button>; })}</div>}
        <div className="play-card-row">{player.hand.map'''
)
replace_first(
    play_path,
    '''const legalPhase = plan?.kind === "speed-cycle" ? match.phase === "player-initiate" || match.phase === "player-yell" : plan ? match.phase === "player-yell" : false;''',
    '''const legalPhase = plan?.kind === "speed-cycle" ? match.phase === "player-initiate" || match.phase === "player-yell" : plan?.kind === "incoming-zone-penalty" || plan?.kind === "defense-guard" ? match.phase === "defense-window" : plan ? match.phase === "player-yell" : false;'''
)
replace_first(
    play_path,
    '''{exhausted ? "Exhausted" : legalPhase ? "Exhaust →" : "Use during Yell"}''',
    '''{exhausted ? "Exhausted" : legalPhase ? "Exhaust →" : plan?.kind === "incoming-zone-penalty" || plan?.kind === "defense-guard" ? "Use in Reaction" : "Use during Yell"}'''
)

# --- CSS -------------------------------------------------------------------
css_path = "app/playtest-board-v4.css"
css = read(css_path)
if ".equipment-reaction-strip" in css:
    raise SystemExit("Reaction Equipment CSS already present")
write(css_path, css.rstrip() + '''

/* Reaction Equipment stays compact above the hand and only appears when legal. */
.equipment-reaction-strip {
  display: flex;
  align-items: stretch;
  gap: 7px;
  margin: 2px 0 9px;
  padding: 7px;
  border: 1px solid rgba(245,179,34,.3);
  background: rgba(245,179,34,.055);
  overflow-x: auto;
}
.equipment-reaction-strip > span {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  padding: 0 8px;
  color: var(--gold);
  font-size: 8px;
  font-weight: 900;
  letter-spacing: .1em;
  text-transform: uppercase;
}
.equipment-reaction-strip button {
  flex: 0 0 min(310px, 34vw);
  display: grid;
  gap: 2px;
  padding: 7px 9px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(7,20,14,.42);
  color: inherit;
  text-align: left;
}
.equipment-reaction-strip button b { font-size: 10px; }
.equipment-reaction-strip button small { font-size: 8px; opacity: .72; }
.equipment-reaction-strip button:disabled { opacity: .4; }
''' + "\n")

# --- tests -----------------------------------------------------------------
test_path = "tests/effect-resolvers.test.mjs"
tests = read(test_path)
tests += '''

test("reaction Exhaust plans compile from incoming-Attack and Defense Gear text", () => {
  assert.deepEqual(equipmentActivationPlan({ rulesText: "Exhaust: After an opponent declares an Attack targeting you, choose High, Mid, or Low. If that Attack uses the chosen zone, it gets −1 Attack Power." }), { kind: "incoming-zone-penalty", attackPowerPenalty: 1 });
  assert.deepEqual(equipmentActivationPlan({ rulesText: "Exhaust: When you play a Defense outside your turn, it gets +1 Guard. At Green Belt or higher, if it Blocks, your Reversal this round gets +1 Attack Power." }), { kind: "defense-guard", guard: 1, reversalPower: 1 });
});
'''
write(test_path, tests)

integration_path = "tests/playtest-effect-integration.test.mjs"
integration = read(integration_path)
integration += '''

test("Quick Duel exposes optional reaction Exhaust Gear without auto-spending the player's Equipment", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /equipmentReactions/);
  assert.match(source, /equipment-reaction-strip/);
  assert.match(source, /incoming-equipment-zone/);
  assert.match(source, /chooseIncomingEquipmentZone/);
  assert.match(source, /equipmentDefenseGuard/);
  assert.match(source, /pendingReversalBonusOnBlock/);
  assert.match(source, /reversalAttackBonus/);
});

test("AI uses deterministic reaction Equipment and late Exhaust can enable Piercing", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /autoActivateAiIncomingEquipment/);
  assert.match(source, /autoActivateAiDefenseGuardEquipment/);
  assert.match(source, /targetExhaustedAtDeclaration/);
  assert.match(source, /exhaustedPiercingBonus/);
  assert.match(source, /effectivePiercing/);
});
'''
write(integration_path, integration)
