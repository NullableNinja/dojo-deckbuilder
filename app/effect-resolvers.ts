export type EffectCardLike = {
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
