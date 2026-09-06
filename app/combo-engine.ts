import cardEffectsJson from "./data/card-effects.json" with { type: "json" };

export type ComboCardLike = {
  id: string;
  name: string;
  catalogId?: string | null;
  cardType?: string;
  subtype?: string;
  zone?: string | null;
  tags?: string[];
  rulesText?: string | null;
  details?: Record<string, string | number | null | undefined>;
};

type ComboEffectRegistry = { cards?: Record<string, { effects?: { resolver?: string; amount?: number }[] }> };
const comboEffectRegistry = cardEffectsJson as unknown as ComboEffectRegistry;
function finalAttackComboMultiplicity(card: ComboCardLike) {
  const catalogId = String(card.catalogId ?? "").trim();
  if (!catalogId) return 1;
  return (comboEffectRegistry.cards?.[catalogId]?.effects ?? [])
    .filter((effect) => effect.resolver === "attack.final.comboMultiplicity")
    .reduce((largest, effect) => Math.max(largest, Math.max(1, Number(effect.amount ?? 1))), 1);
}

export type ComboContext = {
  priorCards: ComboCardLike[];
  attacksThisTurn: number;
  defendedThisRound: boolean;
  hitThisTurn: boolean;
  zonesPlayed: string[];
  equipment: ComboCardLike[];
  currentCard: ComboCardLike;
  currentZone: string;
  isReversal?: boolean;
};

export type ComboEvaluation = {
  requirement: string;
  payoff: string;
  eligible: boolean;
  supported: boolean;
  reason: string;
  power: number;
  damage: number;
  focusOnHit: number;
  grantsFlow: boolean;
  speedOnTrigger: number;
  piercing: number;
};

const value = (entry: unknown) => String(entry ?? '').trim();
const tags = (card: ComboCardLike) => (card.tags ?? []).map((tag) => tag.toLocaleLowerCase());
const hasTag = (card: ComboCardLike, tag: string) => tags(card).some((entry) => entry.includes(tag.toLocaleLowerCase()));
const isAttack = (card: ComboCardLike) => card.subtype === 'Attack' || card.cardType === 'Attack' || /attack/i.test(value(card.subtype)) || hasTag(card, 'Attack');
const isDefense = (card: ComboCardLike) => card.subtype === 'Defense' || /defense/i.test(value(card.subtype)) || hasTag(card, 'Defense') || hasTag(card, 'Block');
const isKata = (card: ComboCardLike) => card.subtype === 'Kata' || /kata/i.test(value(card.subtype)) || hasTag(card, 'Kata');

export function comboRequirementText(combo: ComboCardLike) {
  const details = combo.details ?? {};
  const explicit = value(details['Sequence / Requirement'] ?? details.Requirement ?? details['Sequence']);
  if (explicit && explicit !== '—') return explicit;
  const text = value(combo.rulesText);
  const match = text.match(/Requirement:\s*([^.]+)/i);
  return match?.[1]?.trim() || 'Complete the printed sequence or condition.';
}

export function comboPayoffText(combo: ComboCardLike) {
  const details = combo.details ?? {};
  const explicit = value(details.Effect ?? details.Payoff);
  if (explicit && explicit !== '—') return explicit;
  const text = value(combo.rulesText);
  const payoff = text.match(/Payoff:\s*(.+)$/i)?.[1]?.trim();
  return payoff || text || 'Printed payoff pending.';
}

function descriptorMatches(descriptor: string, card: ComboCardLike, zone = '') {
  const text = descriptor.toLocaleLowerCase();
  if (/\battack\b/.test(text) && !isAttack(card)) return false;
  if (/\bdefense\b|\bblock\b/.test(text) && !isDefense(card)) return false;
  if (/\bkata\b/.test(text) && !isKata(card)) return false;
  const tagChecks = ['punch', 'kick', 'jump', 'spin', 'weapon', 'hand', 'leg', 'multi-hit', 'flow', 'push', 'dodge'];
  for (const tag of tagChecks) if (text.includes(tag) && !hasTag(card, tag)) return false;
  for (const candidate of ['high', 'mid', 'low']) {
    if (new RegExp(`\\b${candidate}\\b`, 'i').test(text) && zone && zone.toLocaleLowerCase() !== candidate) return false;
  }
  return true;
}

function orderedAttackSequence(parts: string[], context: ComboContext) {
  const priorAttacks = context.priorCards.filter(isAttack);
  const virtual = priorAttacks.flatMap((card, index) => Array.from(
    { length: finalAttackComboMultiplicity(card) },
    () => ({ card, zone: context.zonesPlayed[index] ?? '', current: false }),
  ));
  virtual.push(...Array.from(
    { length: finalAttackComboMultiplicity(context.currentCard) },
    () => ({ card: context.currentCard, zone: context.currentZone, current: true }),
  ));
  let cursor = 0;
  let finalWasCurrent = false;
  for (const descriptor of parts) {
    let matched = false;
    while (cursor < virtual.length) {
      const entry = virtual[cursor++];
      if (!descriptorMatches(descriptor, entry.card, entry.zone)) continue;
      matched = true;
      finalWasCurrent = entry.current;
      break;
    }
    if (!matched) return false;
  }
  return finalWasCurrent;
}

function parsePayoff(payoff: string) {
  const power = Number(payoff.match(/\+(\d+)\s+Attack Power/i)?.[1] ?? 0);
  const damage = Number(payoff.match(/\+(\d+)\s+Damage/i)?.[1] ?? 0);
  const focus = Number(payoff.match(/gain\s+\+?(\d+)\s+Focus/i)?.[1] ?? 0);
  const speed = Number(payoff.match(/gain\s+\+?(\d+)\s+Speed/i)?.[1] ?? 0);
  const piercing = Number(payoff.match(/Piercing\s+(\d+)/i)?.[1] ?? 0);
  const grantsFlow = /(?:Attack|strike|finisher)[^.]*gains? Flow|gains? Flow[^.]*Attack/i.test(payoff);
  const focusOnHit = focus && /\bHit(?:s)?\b/i.test(payoff) ? focus : 0;
  const recognized = Boolean(power || damage || focusOnHit || grantsFlow || speed || piercing);
  return { power, damage, focusOnHit, grantsFlow, speedOnTrigger: speed, piercing, recognized };
}

export function evaluateCombo(combo: ComboCardLike, context: ComboContext): ComboEvaluation {
  const requirement = comboRequirementText(combo);
  const payoff = comboPayoffText(combo);
  const lower = requirement.toLocaleLowerCase();
  let eligible = true;
  let recognizedRequirement = false;
  const reasons: string[] = [];

  const arrowParts = requirement.split(/\s*(?:→|->)\s*/).map((part) => part.trim()).filter(Boolean);
  if (arrowParts.length > 1) {
    recognizedRequirement = true;
    if (!orderedAttackSequence(arrowParts, context)) { eligible = false; reasons.push('sequence not complete'); }
  }

  if (/different zone/i.test(requirement)) {
    recognizedRequirement = true;
    const priorZone = context.zonesPlayed.at(-1);
    if (!priorZone || priorZone.toLocaleLowerCase() === context.currentZone.toLocaleLowerCase()) { eligible = false; reasons.push('needs a different zone'); }
  }
  if (/block(?:ed)? an? attack|after you played a defense|\bblock\b/i.test(requirement)) {
    recognizedRequirement = true;
    if (!context.defendedThisRound) { eligible = false; reasons.push('needs a Block/Defense first'); }
  }
  if (/\bkata\b/i.test(requirement) && arrowParts.length <= 1) {
    recognizedRequirement = true;
    if (!context.priorCards.some(isKata)) { eligible = false; reasons.push('needs a Kata first'); }
  }
  if (/\breversal\b/i.test(requirement)) {
    recognizedRequirement = true;
    if (!context.isReversal) { eligible = false; reasons.push('needs a Reversal'); }
  }
  if (/second attack/i.test(requirement)) {
    recognizedRequirement = true;
    if (context.attacksThisTurn !== 1) { eligible = false; reasons.push('finisher must be your second Attack'); }
  }
  if (/third attack|first two attacks/i.test(requirement)) {
    recognizedRequirement = true;
    if (context.attacksThisTurn < 2) { eligible = false; reasons.push('needs two prior Attacks'); }
  }
  if (/first attack hit|first attack hits/i.test(requirement)) {
    recognizedRequirement = true;
    if (!context.hitThisTurn || context.attacksThisTurn < 1) { eligible = false; reasons.push('first Attack must Hit'); }
  }
  if (/two or more permanent equipment|2\+ permanent equipment/i.test(requirement)) {
    recognizedRequirement = true;
    if (context.equipment.length < 2) { eligible = false; reasons.push('needs 2 permanent Equipment'); }
  }

  if (/weapon attack/i.test(requirement)) {
    recognizedRequirement = true;
    const weaponReady = hasTag(context.currentCard, 'Weapon') || context.equipment.some((card) => /weapon/i.test(value(card.subtype)) || hasTag(card, 'Weapon'));
    if (!weaponReady) { eligible = false; reasons.push('needs a Weapon Attack'); }
  }
  if (/all three zones/i.test(requirement)) {
    recognizedRequirement = true;
    const zones = new Set([...context.zonesPlayed, context.currentZone].map((zone) => zone.toLocaleLowerCase()));
    if (!['high', 'mid', 'low'].every((zone) => zones.has(zone))) { eligible = false; reasons.push('needs High, Mid, and Low Attacks'); }
  }

  if (!recognizedRequirement) {
    if ((combo.tags ?? []).some((tag) => /Kata/i.test(tag))) {
      recognizedRequirement = true;
      if (!context.priorCards.some(isKata)) { eligible = false; reasons.push('needs a Kata first'); }
    }
    if ((combo.tags ?? []).some((tag) => /Block/i.test(tag))) {
      recognizedRequirement = true;
      if (!context.defendedThisRound) { eligible = false; reasons.push('needs a Block first'); }
    }
    if ((combo.tags ?? []).some((tag) => /Multi-Hit/i.test(tag))) {
      recognizedRequirement = true;
      if (!context.priorCards.some((card) => isAttack(card) && hasTag(card, 'Multi-Hit'))) { eligible = false; reasons.push('needs a Multi-Hit Attack first'); }
    }
    if ((combo.tags ?? []).some((tag) => /Jump/i.test(tag)) && (combo.tags ?? []).some((tag) => /Kick/i.test(tag))) {
      recognizedRequirement = true;
      if (!context.priorCards.some((card) => isAttack(card) && hasTag(card, 'Jump')) || !hasTag(context.currentCard, 'Kick')) { eligible = false; reasons.push('needs Jump Attack → Kick'); }
    }
  }

  const parsed = parsePayoff(payoff);
  const supported = recognizedRequirement && parsed.recognized;
  return {
    requirement,
    payoff,
    eligible: eligible && supported,
    supported,
    reason: !supported ? 'This Combo still needs a dedicated digital resolver.' : eligible ? 'Requirement complete on this Attack.' : reasons[0] ?? 'Requirement not complete yet.',
    power: parsed.power,
    damage: parsed.damage,
    focusOnHit: parsed.focusOnHit,
    grantsFlow: parsed.grantsFlow,
    speedOnTrigger: parsed.speedOnTrigger,
    piercing: parsed.piercing,
  };
}
