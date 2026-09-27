const number = (value) => Number.parseInt(String(value ?? 0), 10) || 0;
export const STRATEGY_PROFILES = Object.freeze({
  balanced: { attack: 3.5, guard: 3, focus: 3, costPenalty: 0.35, lowHp: 4, destroy: 0, blockThreshold: 3, utilityBias: 0, family: { Attack: 4, Defense: 3, Consumable: 2, Kata: 3, Weapon: 4, Gear: 3, "Defense Equipment": 3, "Reaction Item": 2 }, tags: { draw: 2, flow: 2, focus: 1.5, speed: 1, healing: 1 } },
  aggression: { attack: 5, guard: 1, focus: 1.5, costPenalty: 0.25, lowHp: 1, destroy: 0, blockThreshold: 4, utilityBias: -2, family: { Attack: 7, Defense: 1, Consumable: 2, Kata: 3, Weapon: 7, Gear: 2, "Defense Equipment": 1, "Reaction Item": 1 }, tags: { draw: 2, flow: 3, focus: 1, speed: 2, healing: 0.5 } },
  economy: { attack: 2, guard: 2, focus: 5, costPenalty: 0.15, lowHp: 3, destroy: 1, blockThreshold: 4, utilityBias: 2, family: { Attack: 2, Defense: 2, Consumable: 4, Kata: 6, Weapon: 3, Gear: 6, "Defense Equipment": 3, "Reaction Item": 2 }, tags: { draw: 3, flow: 2, focus: 3, speed: 1, healing: 2 } },
  fortress: { attack: 1.5, guard: 5, focus: 2.5, costPenalty: 0.4, lowHp: 6, destroy: 0, blockThreshold: 1, utilityBias: 1, family: { Attack: 1.5, Defense: 7, Consumable: 4, Kata: 3, Weapon: 1, Gear: 3, "Defense Equipment": 7, "Reaction Item": 5 }, tags: { draw: 2, flow: 1, focus: 2, speed: 0.5, healing: 3 } },
  "kata-specialist": { attack: 3, guard: 2, focus: 4, costPenalty: 0.25, lowHp: 3, destroy: 2, blockThreshold: 4, utilityBias: 4, family: { Attack: 3, Defense: 2, Consumable: 4, Kata: 9, Weapon: 2, Gear: 3, "Defense Equipment": 2, "Reaction Item": 2 }, tags: { draw: 4, flow: 4, focus: 3, speed: 2, healing: 1 } },
  tempo: { attack: 4.5, guard: 2, focus: 2.5, costPenalty: 0.2, lowHp: 2, destroy: 1, blockThreshold: 4, utilityBias: 3, family: { Attack: 6, Defense: 2, Consumable: 4, Kata: 5, Weapon: 5, Gear: 3, "Defense Equipment": 1, "Reaction Item": 2 }, tags: { draw: 5, flow: 4, focus: 2, speed: 3, healing: 1 } },
  control: { attack: 2.5, guard: 4.5, focus: 3, costPenalty: 0.35, lowHp: 5, destroy: 1, blockThreshold: 2, utilityBias: 1, family: { Attack: 2, Defense: 6, Consumable: 3, Kata: 4, Weapon: 2, Gear: 4, "Defense Equipment": 6, "Reaction Item": 7 }, tags: { draw: 3, flow: 1, focus: 2, speed: 1, healing: 2 } },
  cleanup: { attack: 2.5, guard: 2.5, focus: 3.5, costPenalty: 0.2, lowHp: 4, destroy: 6, blockThreshold: 3, utilityBias: 4, family: { Attack: 2, Defense: 2, Consumable: 7, Kata: 8, Weapon: 2, Gear: 2, "Defense Equipment": 2, "Reaction Item": 3 }, tags: { draw: 5, flow: 2, focus: 3, speed: 1, healing: 2 } },
});
export const STRATEGIES = Object.freeze(Object.keys(STRATEGY_PROFILES));
const profileFor = (strategy) => STRATEGY_PROFILES[strategy] ?? STRATEGY_PROFILES.balanced;
export const getStrategyProfile = (strategy) => profileFor(strategy);
export const attackPower = (card) => number(card?.stats?.["Attack Power"]);
export const attackBonus = (card) => number(card?.stats?.["Attack Bonus"]);
export const guard = (card) => number(card?.stats?.Guard);
export const focus = (card) => number(card?.focusValue);
export const cost = (card) => number(card?.fpCost);

const tags = (card) => (card?.tags ?? []).map((tag) => String(tag).toLocaleLowerCase());
const hasTag = (card, tag) => tags(card).some((value) => value === String(tag).toLocaleLowerCase() || value.includes(String(tag).toLocaleLowerCase()));
const permanentEquipment = (card) => ["Weapon", "Gear", "Defense Equipment"].includes(card?.subtype);
const family = (card) => attackPower(card) > 0 ? "Attack" : guard(card) > 0 ? "Defense" : String(card?.subtype ?? "Other");
const hasDestroyText = (card) => /\bdestroy\b/i.test(String(card?.rulesText ?? card?.details?.["Rules Text"] ?? ""));

function familyWeight(card, strategy) {
  return profileFor(strategy).family[family(card)] ?? 0;
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
  const profile = profileFor(strategy); const printedPower = attackPower(card) + attackBonus(card);
  const tagValue = Object.entries(profile.tags).reduce((sum, [tag, value]) => sum + (hasTag(card, tag) ? value : 0), 0);
  const effectValue = (context.effectValue ?? 0) + tagValue + (hasDestroyText(card) ? profile.destroy : 0);
  const synergy = (context.deckTags ?? []).reduce((sum, tag) => sum + (hasTag(card, tag) ? 0.8 : 0), 0);
  const survival = context.lowHp && (guard(card) > 0 || card?.subtype === "Consumable" || card?.subtype === "Defense Equipment") ? profile.lowHp : 0;
  const densityPenalty = context.familyCounts?.[family(card)] >= 8 ? 0.8 : 0;
  return printedPower * profile.attack + guard(card) * profile.guard + focus(card) * profile.focus + familyWeight(card, strategy) + effectValue + synergy + survival - densityPenalty - cost(card) * profile.costPenalty - capacityPenalty(card, context);
}

export const chooseAttack = (hand, strategy, context = {}) => hand.filter((c) => attackPower(c) > 0).sort((a, b) => {
  const lethalA = context.opponent && attackPower(a) + (context.atk ?? 0) >= (context.opponent.hp ?? 0) + (context.opponent.def ?? 0) ? 1000 : 0;
  const lethalB = context.opponent && attackPower(b) + (context.atk ?? 0) >= (context.opponent.hp ?? 0) + (context.opponent.def ?? 0) ? 1000 : 0;
  return lethalB + cardScore(b, strategy, context) - lethalA - cardScore(a, strategy, context);
})[0] ?? null;

export const chooseDefense = (hand, context = {}) => hand.filter((c) => guard(c) > 0).sort((a, b) => cardScore(b, context.strategy ?? "balanced", context) - cardScore(a, context.strategy ?? "balanced", context) || guard(b) - guard(a))[0] ?? null;
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
