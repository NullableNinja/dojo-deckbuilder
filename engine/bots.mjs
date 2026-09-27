const number = (value) => Number.parseInt(String(value ?? 0), 10) || 0;
export const STRATEGIES = ["balanced", "aggression", "economy", "fortress"];
export const attackPower = (card) => number(card?.stats?.["Attack Power"]);
export const attackBonus = (card) => number(card?.stats?.["Attack Bonus"]);
export const guard = (card) => number(card?.stats?.Guard);
export const focus = (card) => number(card?.focusValue);
export const cost = (card) => number(card?.fpCost);

const tags = (card) => (card?.tags ?? []).map((tag) => String(tag).toLocaleLowerCase());
const hasTag = (card, tag) => tags(card).some((value) => value === String(tag).toLocaleLowerCase() || value.includes(String(tag).toLocaleLowerCase()));
const permanentEquipment = (card) => ["Weapon", "Gear", "Defense Equipment"].includes(card?.subtype);

function familyWeight(card, strategy) {
  if (card?.subtype === "Weapon") return strategy === "aggression" ? 7 : strategy === "fortress" ? 1 : 4;
  if (card?.subtype === "Defense Equipment") return strategy === "fortress" ? 7 : 3;
  if (card?.subtype === "Gear") return strategy === "economy" ? 6 : 3;
  if (card?.subtype === "Consumable" || card?.subtype === "Reaction Item") return strategy === "fortress" ? 4 : 2;
  if (card?.subtype === "Kata") return strategy === "economy" ? 5 : 3;
  if (card?.subtype === "Defense") return strategy === "fortress" ? 7 : 3;
  if (card?.subtype === "Attack") return strategy === "aggression" ? 7 : 4;
  return 0;
}

function capacityPenalty(card, context) {
  if (!permanentEquipment(card) || !context?.equipment) return 0;
  const slot = String(card.stats?.Slot ?? card.details?.Slot ?? "");
  const sameSlot = slot && context.equipment.some((entry) => String(entry.stats?.Slot ?? entry.details?.Slot ?? "") === slot);
  const hands = number(card.stats?.Hands ?? card.details?.Hands);
  const occupied = context.equipment.reduce((sum, entry) => sum + number(entry.stats?.Hands ?? entry.details?.Hands), 0);
  if (hands && occupied + hands > 2 && !context.allowReplacement) return 8;
  return sameSlot ? 0.5 : 0;
}

export function cardScore(card, strategy="balanced", context = {}) {
  const weights = strategy === "aggression" ? [5, 1, 1.5] : strategy === "economy" ? [2, 2, 5] : strategy === "fortress" ? [1.5, 5, 2.5] : [3.5, 3, 3];
  const printedPower = attackPower(card) + attackBonus(card);
  const effectValue = (context.effectValue ?? 0) + (hasTag(card, "draw") ? 2 : 0) + (hasTag(card, "flow") ? 2 : 0) + (hasTag(card, "healing") ? (context.lowHp ? 4 : 1) : 0) + (hasTag(card, "focus") ? 1.5 : 0);
  const synergy = (context.deckTags ?? []).reduce((sum, tag) => sum + (hasTag(card, tag) ? 0.8 : 0), 0);
  const survival = context.lowHp && (guard(card) > 0 || card?.subtype === "Consumable" || card?.subtype === "Defense Equipment") ? 4 : 0;
  return printedPower * weights[0] + guard(card) * weights[1] + focus(card) * weights[2] + familyWeight(card, strategy) + effectValue + synergy + survival - cost(card) * 0.35 - capacityPenalty(card, context);
}

export const chooseAttack = (hand, strategy, context = {}) => hand.filter((c) => attackPower(c) > 0).sort((a, b) => {
  const lethalA = context.opponent && attackPower(a) + (context.atk ?? 0) >= (context.opponent.hp ?? 0) + (context.opponent.def ?? 0) ? 1000 : 0;
  const lethalB = context.opponent && attackPower(b) + (context.atk ?? 0) >= (context.opponent.hp ?? 0) + (context.opponent.def ?? 0) ? 1000 : 0;
  return lethalB + cardScore(b, strategy, context) - lethalA - cardScore(a, strategy, context);
})[0] ?? null;

export const chooseDefense = (hand, context = {}) => hand.filter((c) => guard(c) > 0).sort((a, b) => guard(b) - guard(a) || focus(b) - focus(a))[0] ?? null;
export const choosePractice = (hand, strategy, context = {}) => hand.filter((c) => guard(c) > 0).sort((a, b) => focus(b) - focus(a) || cardScore(b, strategy, context) - cardScore(a, strategy, context))[0] ?? null;
export const choosePurchase = (market, available, strategy, context = {}) => market.filter((c) => cost(c) <= available).sort((a, b) => cardScore(b, strategy, context) - cardScore(a, strategy, context) || cost(b) - cost(a))[0] ?? null;

export function comboReadiness(combo, player, data) {
  const requirements = data?.comboRequirements?.cards?.[combo?.catalogId]?.requirements ?? [];
  const knownCards = [...(player?.hand ?? []), ...(player?.deck ?? []), ...(player?.discard ?? []), ...(player?.played ?? [])];
  const available = (step, cards = knownCards) => cards.some((card) => (!step.family || String(card.subtype ?? card.cardType).toLocaleLowerCase() === String(step.family).toLocaleLowerCase()) && (!step.tags?.length || step.tags.every((tag) => hasTag(card, tag))) && (!step.tagsAny?.length || step.tagsAny.some((tag) => hasTag(card, tag))) && (!step.zone || String(card.zone).toLocaleLowerCase() === String(step.zone).toLocaleLowerCase()));
  const attackCards = knownCards.filter((card) => String(card.subtype ?? card.cardType).toLocaleLowerCase() === "attack");
  const defenseCards = knownCards.filter((card) => String(card.subtype ?? card.cardType).toLocaleLowerCase() === "defense");
  const possibleStep = (step) => available(step) || (step.alternatives ?? []).some((alternative) => available(alternative));
  let ready = 0;
  for (const requirement of requirements) {
    if (requirement.kind === "orderedSequence") ready += (requirement.steps ?? []).filter(possibleStep).length / Math.max(1, (requirement.steps ?? []).length);
    else if (requirement.kind === "minimumEquipment") ready += player.equipment.length >= Number(requirement.amount ?? 1) ? 1 : 0;
    else if (requirement.kind === "equippedCardMatches") ready += player.equipment.some((card) => possibleStep({ ...requirement, family: requirement.family, tags: requirement.tags })) || knownCards.some((card) => possibleStep({ ...requirement, family: requirement.family, tags: requirement.tags })) ? 0.5 : 0;
    else if (requirement.kind === "noWeaponEquipped") ready += player.equipment.some((card) => card.subtype === "Weapon") ? 0 : 1;
    else if (["blockHistory", "defenseBlocksAttack", "defendedThisRound"].includes(requirement.kind)) ready += player.lastTurnWasBlocked ? 1 : defenseCards.length ? 0.5 : 0;
    else if (requirement.kind === "currentCardMatches" || requirement.kind === "minimumAttackHits" || requirement.kind === "attackOrdinal") ready += attackCards.length ? 0.5 : 0;
    else if (requirement.kind === "reversal") ready += defenseCards.length && attackCards.length ? 0.5 : 0;
    else if (requirement.kind === "zonesPresent") ready += Math.min(1, new Set(attackCards.map((card) => card.zone)).size / Math.max(1, (requirement.zones ?? []).length));
    else if (requirement.kind === "purchaseHistory") ready += player.comboFacts?.purchasesSinceLastAscend?.some((purchase) => requirement.tag ? purchase.tags?.some((tag) => hasTag({ tags: [tag] }, requirement.tag)) : true) ? 1 : knownCards.some((card) => requirement.tag ? hasTag(card, requirement.tag) : true) ? 0.5 : 0;
  }
  return { ready, total: requirements.length, score: requirements.length ? ready / requirements.length : 0 };
}
