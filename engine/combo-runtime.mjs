// Canonical Combo requirement evaluation for the headless engine.
// Combo identities, requirements, and payoffs remain data-driven; this module
// only translates the machine-readable requirement vocabulary into predicates.

const lower = (value) => String(value ?? "").trim().toLocaleLowerCase();
const tagsOf = (card) => (card?.tags ?? []).map(lower);
const hasTag = (card, tag) => tagsOf(card).some((value) => value === lower(tag) || value.includes(lower(tag)));
const isAttack = (card) => Boolean(card) && (lower(card.subtype) === "attack" || lower(card.cardType) === "attack" || hasTag(card, "attack"));
const isDefense = (card) => Boolean(card) && (lower(card.subtype) === "defense" || lower(card.cardType) === "defense" || hasTag(card, "defense") || hasTag(card, "block"));
const isKata = (card) => Boolean(card) && (lower(card.subtype) === "kata" || lower(card.cardType) === "kata" || hasTag(card, "kata"));
const isConsumable = (card) => Boolean(card) && (lower(card.subtype) === "consumable" || lower(card.cardType) === "consumable" || hasTag(card, "consumable"));
const isEquipment = (card) => Boolean(card) && (["weapon", "gear", "defense equipment", "equipment"].includes(lower(card.subtype)) || hasTag(card, "equipment") || hasTag(card, "weapon"));
const isJunk = (card) => Boolean(card) && (lower(card.subtype) === "junk" || lower(card.cardType) === "junk" || hasTag(card, "junk"));

function familyMatches(card, family) {
  if (!card || !family) return true;
  const expected = lower(family);
  if (expected === "attack") return isAttack(card);
  if (expected === "defense") return isDefense(card);
  if (expected === "kata") return isKata(card);
  if (expected === "consumable") return isConsumable(card);
  if (expected === "equipment") return isEquipment(card);
  if (expected === "junk") return isJunk(card);
  return lower(card.cardType) === expected || lower(card.subtype) === expected;
}

function directStepMatches(step, card, zone = "") {
  if (!card) return false;
  if (step.family && !familyMatches(card, step.family)) return false;
  if ((step.families ?? []).length && !(step.families ?? []).some((family) => familyMatches(card, family))) return false;
  if ((step.tags ?? []).some((tag) => !hasTag(card, tag))) return false;
  if ((step.tagsAny ?? []).length && !(step.tagsAny ?? []).some((tag) => hasTag(card, tag))) return false;
  if (step.zone && lower(step.zone) !== lower(zone)) return false;
  if ((step.zones ?? []).length && !(step.zones ?? []).map(lower).includes(lower(zone))) return false;
  if (step.minimumFocusValue != null && Number(card.focusValue ?? 0) < Number(step.minimumFocusValue)) return false;
  return true;
}

function stepMatches(step, card, zone = "") {
  return (step.alternatives ?? []).length
    ? (step.alternatives ?? []).some((alternative) => directStepMatches(alternative, card, zone))
    : directStepMatches(step, card, zone);
}

function cardFor(data, id) {
  return data.byId.get(String(id).split("#")[0]) ?? null;
}

function cardsForFacts(data, facts = []) {
  return facts.map((fact) => ({ ...fact, card: cardFor(data, fact.cardId) })).filter((fact) => fact.card);
}

function historyEntries(context) {
  return [
    ...context.priorPlayed.map((fact) => ({ card: fact.card, zone: fact.zone ?? "", current: false })),
    ...(context.currentCard ? [{ card: context.currentCard, zone: context.currentZone, current: true }] : []),
  ];
}

function blockHistoryMatches(requirement, context) {
  const required = Number(requirement.amount ?? 1);
  const matches = (context.blockFacts ?? []).filter((fact) => {
    if (requirement.window && fact.window !== requirement.window) return false;
    if (requirement.zone && lower(fact.incomingZone) !== lower(requirement.zone)) return false;
    const tags = (fact.defenseTags ?? []).map(lower);
    if (requirement.tag && !tags.some((tag) => tag === lower(requirement.tag) || tag.includes(lower(requirement.tag)))) return false;
    if ((requirement.tagsAny ?? []).length && !(requirement.tagsAny ?? []).some((candidate) => tags.some((tag) => tag === lower(candidate) || tag.includes(lower(candidate))))) return false;
    return true;
  });
  return matches.length >= required;
}

function requirementSatisfied(requirement, context) {
  switch (requirement.kind) {
    case "orderedSequence": {
      const entries = historyEntries(context);
      let cursor = 0;
      let finalWasCurrent = false;
      for (const step of requirement.steps ?? []) {
        let matched = false;
        while (cursor < entries.length) {
          const entry = entries[cursor++];
          if (!stepMatches(step, entry.card, entry.zone)) continue;
          matched = true;
          finalWasCurrent = entry.current;
          break;
        }
        if (!matched) return false;
      }
      return Boolean((requirement.steps ?? []).length) && finalWasCurrent;
    }
    case "orderedAttackHits": {
      if (context.currentAttackHit !== true || !isAttack(context.currentCard)) return false;
      const actual = [...(context.hitZonesThisTurn ?? []), context.currentZone].map(lower);
      const expected = (requirement.zones ?? []).map(lower);
      return actual.length >= expected.length && expected.every((zone, index) => actual[actual.length - expected.length + index] === zone);
    }
    case "differentZoneFromPreviousAttack": {
      const previous = context.turnAttacks.at(-1)?.zone;
      return Boolean(previous && lower(previous) !== lower(context.currentZone));
    }
    case "defenseBlocksAttack": {
      const defense = context.currentDefense;
      return context.currentDefenseBlocked === true && Boolean(defense) && (!requirement.tag || hasTag(defense, requirement.tag));
    }
    case "defendedThisRound": return context.currentDefenseBlocked === true || context.blockedThisRound === true;
    case "minimumDefenseTag": return (context.priorPlayed ?? []).filter((fact) => isDefense(fact.card) && (!requirement.tag || hasTag(fact.card, requirement.tag))).length >= Number(requirement.amount ?? 1);
    case "differentComboAfterCombo": return context.triggeredCombosTurn.length >= Number(requirement.minimumPriorCombos ?? 1);
    case "beltExamThenAttackHit": return Boolean(context.completedBeltExamThisRound && context.currentAttackHit === true && isAttack(context.currentCard) && (!requirement.tag || hasTag(context.currentCard, requirement.tag)));
    case "priorCardFamily": return context.priorPlayed.some((fact) => familyMatches(fact.card, requirement.family));
    case "reversal": return Boolean(context.isReversal);
    case "attackOrdinal": return isAttack(context.currentCard) && context.turnAttacks.length + 1 === Number(requirement.ordinal ?? 1);
    case "minimumPriorAttacks": return context.turnAttacks.length >= Number(requirement.amount ?? 1);
    case "priorAttackHit": return context.turnAttacks.some((fact) => fact.hit) && context.turnAttacks.length >= Number(requirement.minimumPriorAttacks ?? 1);
    case "minimumEquipment": return context.equipment.length >= Number(requirement.amount ?? 1);
    case "weaponAttack": return isAttack(context.currentCard) && (hasTag(context.currentCard, "weapon") || context.equipment.some((card) => hasTag(card, "weapon") || lower(card.subtype).includes("weapon")));
    case "zonesPresent": {
      const source = requirement.window === "round" ? context.roundAttacks : context.turnAttacks;
      const zones = new Set([...source.map((fact) => fact.zone), ...(isAttack(context.currentCard) ? [context.currentZone] : [])].map(lower));
      return (requirement.zones ?? []).every((zone) => zones.has(lower(zone)));
    }
    case "priorAttackTag": return context.priorPlayed.some((fact) => isAttack(fact.card) && requirement.tag && hasTag(fact.card, requirement.tag));
    case "currentCardMatches": return stepMatches(requirement, context.currentCard, context.currentZone) && (requirement.hit !== true || context.currentAttackHit === true);
    case "priorCardMatches": return historyEntries(context).some((entry) => !entry.current && stepMatches(requirement, entry.card, entry.zone));
    case "equippedCardMatches": return context.equipment.filter((card) => stepMatches(requirement, card)).length >= Number(requirement.amount ?? 1);
    case "noWeaponEquipped": return !context.equipment.some((card) => hasTag(card, "weapon") || lower(card.subtype).includes("weapon"));
    case "previousAttackBlocked": return Boolean(context.previousAttackBlocked);
    case "blockHistory": return blockHistoryMatches(requirement, context);
    case "speedGainHistory": return context.speedGainedSinceLastTurn;
    case "startingHandTagCount": return context.startingHand.filter((card) => hasTag(card, requirement.tag) || familyMatches(card, requirement.tag)).length >= Number(requirement.amount ?? 1);
    case "purchaseHistory": return context.purchasesSinceLastAscend.filter((fact) => {
      if (requirement.window && fact.window !== requirement.window) return false;
      if (requirement.family && lower(fact.family) !== lower(requirement.family)) return false;
      if (requirement.tag && !fact.tags.some((tag) => lower(tag) === lower(requirement.tag) || lower(tag).includes(lower(requirement.tag)))) return false;
      return !(requirement.tagsAny ?? []).length || (requirement.tagsAny ?? []).some((candidate) => fact.tags.some((tag) => lower(tag) === lower(candidate) || lower(tag).includes(lower(candidate))));
    }).length >= Number(requirement.amount ?? 1);
    case "minimumAttackHits": return (requirement.window === "round" ? context.roundAttacks.filter((fact) => fact.hit).length : context.turnAttacks.filter((fact) => fact.hit).length + (context.currentAttackHit ? 1 : 0)) >= Number(requirement.amount ?? 1);
    case "playedCardHistory": return context.playedCardFacts.filter((fact) => (!requirement.window || fact.window === requirement.window) && stepMatches(requirement, fact.card, fact.zone)).length >= Number(requirement.amount ?? 1);
    case "attackHistory": return context.attackFacts.filter((fact) => {
      if (requirement.window && fact.window !== requirement.window) return false;
      if (!stepMatches(requirement, fact.card, fact.zone)) return false;
      if (requirement.hit != null && Boolean(fact.hit) !== requirement.hit) return false;
      if (requirement.reversal != null && Boolean(fact.reversal) !== requirement.reversal) return false;
      if (requirement.blocked != null && Boolean(fact.blocked) !== requirement.blocked) return false;
      return true;
    }).length >= Number(requirement.amount ?? 1);
    case "cardFamiliesPresent": {
      const cards = [...context.priorPlayed.map((fact) => fact.card), context.currentCard].filter(Boolean);
      return (requirement.requiredFamilies ?? []).every((family) => cards.some((card) => familyMatches(card, family)))
        && (!(requirement.anyFamilies ?? []).length || (requirement.anyFamilies ?? []).some((family) => cards.some((card) => familyMatches(card, family))));
    }
    default: return null;
  }
}

export function comboContext(data, player, currentCard, currentZone, event = {}) {
  const facts = player.comboFacts;
  const allTurnPlayed = cardsForFacts(data, facts.turnPlayed);
  const turnPlayed = currentCard && allTurnPlayed.at(-1)?.card?.catalogId === currentCard.catalogId ? allTurnPlayed.slice(0, -1) : allTurnPlayed;
  const roundPlayed = cardsForFacts(data, facts.roundPlayed);
  const sinceLastTurnPlayed = cardsForFacts(data, facts.sinceLastTurnPlayed);
  const currentAttackRecorded = Boolean(currentCard && facts.turnAttacks.at(-1)?.cardId === currentCard.catalogId);
  const turnAttacks = currentAttackRecorded ? facts.turnAttacks.slice(0, -1) : [...facts.turnAttacks];
  const roundAttacks = currentAttackRecorded ? facts.roundAttacks.slice(0, -1) : [...facts.roundAttacks];
  const sinceLastTurnAttacks = [...facts.sinceLastTurnAttacks];
  const blockFacts = [
    ...(facts.roundBlocks ?? []).map((fact) => ({ ...fact, window: "round" })),
    ...(facts.sinceLastTurnBlocks ?? []).map((fact) => ({ ...fact, window: "sinceLastTurn" })),
  ];
  const playedCardFacts = [
    ...turnPlayed.map((fact) => ({ ...fact, window: "turn" })),
    ...roundPlayed.map((fact) => ({ ...fact, window: "round" })),
    ...sinceLastTurnPlayed.map((fact) => ({ ...fact, window: "sinceLastTurn" })),
  ];
  const attackFacts = [
    ...turnAttacks.map((fact) => ({ ...fact, window: "turn" })),
    ...roundAttacks.map((fact) => ({ ...fact, window: "round" })),
    ...sinceLastTurnAttacks.map((fact) => ({ ...fact, window: "sinceLastTurn" })),
  ];
  const startingHand = facts.startingHandIds.map((id) => cardFor(data, id)).filter(Boolean);
  return {
    priorPlayed: [...turnPlayed],
    turnPlayed: facts.turnPlayed,
    turnAttacks,
    roundAttacks,
    startingHand,
    hitZonesThisTurn: turnAttacks.filter((fact) => fact.hit).map((fact) => fact.zone),
    equipment: player.equipment,
    currentCard,
    currentZone,
    currentAttackHit: event.currentAttackHit,
    currentDefense: event.currentDefense ?? facts.lastDefenseCard ?? null,
    currentDefenseBlocked: event.currentDefenseBlocked ?? facts.lastDefenseBlocked ?? false,
    blockedThisRound: Boolean(player.turnStats.blocked),
    completedBeltExamThisRound: Boolean(player.turnStats.completedBeltExamThisRound),
    previousAttackBlocked: facts.previousAttackBlocked,
    isReversal: Boolean(event.isReversal),
    triggeredCombosTurn: player.comboTriggeredTurn ?? [],
    speedGainedSinceLastTurn: Boolean(facts.speedGainedSinceLastTurn),
    purchasesSinceLastAscend: (facts.purchasesSinceLastAscend ?? []).map((fact) => ({ ...fact, tags: fact.tags ?? [] })),
    playedCardFacts,
    attackFacts,
    blockFacts,
  };
}

export function evaluateCombo(data, combo, player, currentCard, currentZone, event = {}) {
  const entry = data.comboRequirements?.cards?.[combo.catalogId];
  if (!entry?.requirements?.length) return { eligible: false, supported: false, reason: "Missing canonical Combo requirement definition." };
  const context = comboContext(data, player, currentCard, currentZone, event);
  for (const requirement of entry.requirements) {
    const satisfied = requirementSatisfied(requirement, context);
    if (satisfied === null) return { eligible: false, supported: false, reason: `Unsupported Combo requirement '${requirement.kind}'.` };
    if (!satisfied) return { eligible: false, supported: true, reason: `Requirement '${requirement.kind}' is not complete.` };
  }
  return { eligible: true, supported: true, reason: "Canonical Combo requirement complete.", context };
}

export function comboTimingAllows(combo, player) {
  const id = combo.catalogId;
  const timing = lower(combo.timing);
  if ((player.comboTriggeredRound ?? []).includes(id)) return false;
  if (timing.includes("once per turn") && (player.comboTriggeredTurn ?? []).includes(id)) return false;
  return true;
}

export function comboEffects(data, combo, trigger) {
  return (data.cardEffectById.get(combo.catalogId)?.effects ?? []).filter((effect) => effect.trigger === trigger);
}

export function comboCardFamily(card) {
  return card?.cardType === "Combo" || card?.subtype === "Learned Combo" ? "Combos" : "Other";
}
