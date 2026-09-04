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

export function conditionalAttackPowerBonus(card: EffectCardLike, context: { playedKata: boolean; firstAttack: boolean; matchingArmor?: boolean; targetEquipmentCount?: number }) {
  const text = normalizedMinus(String(card.rulesText ?? ""));
  let amount = 0;
  const notes: string[] = [];
  const kata = text.match(/If you played a Kata this turn, this Attack gets \+(\d+) Attack Power/i);
  if (kata && context.playedKata) { amount += Number(kata[1]); notes.push(`Kata setup +${kata[1]} Attack Power`); }
  const armor = text.match(/If the target has matching Armor, this Attack gets \+(\d+) Attack Power/i);
  if (armor && context.matchingArmor) { amount += Number(armor[1]); notes.push(`matching Armor +${armor[1]} Attack Power`); }
  const equipment = text.match(/If the target has two or more permanent Equipment cards equipped, this Attack gets \+(\d+) Attack Power/i);
  if (equipment && (context.targetEquipmentCount ?? 0) >= 2) { amount += Number(equipment[1]); notes.push(`loaded target +${equipment[1]} Attack Power`); }
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


export function destroyJunkChoiceCount(card: EffectCardLike) {
  const match = String(card.rulesText ?? "").match(/Destroy (\d+) Junk cards? from your hand or discard pile/i);
  return match ? Number(match[1]) : 0;
}

export function optionalDiscardDrawChoice(card: EffectCardLike) {
  const text = String(card.rulesText ?? "");
  const match = text.match(/After (?:this Attack|this|it|that Attack) resolves, you may discard (\d+) cards? to draw (\d+) cards?/i);
  return match ? { discard: Number(match[1]), draw: Number(match[2]) } : null;
}


export function firstIncomingAttackPowerPenalty(cards: EffectCardLike[], isFirstIncomingAttack: boolean) {
  if (!isFirstIncomingAttack) return { amount: 0, sources: [] as string[] };
  let amount = 0;
  const sources: string[] = [];
  for (const card of cards) {
    const text = normalizedMinus(String(card.rulesText ?? ""));
    const match = text.match(/The first Attack targeting you each round gets -(\d+) Attack Power/i);
    if (!match) continue;
    amount -= Number(match[1]);
    sources.push(card.name ?? "Equipment");
  }
  return { amount, sources };
}

export function targetNextDefensePenalty(card: EffectCardLike) {
  const text = normalizedMinus(String(card.rulesText ?? ""));
  const match = text.match(/(?:Their|target[’']s|opponent[’']s) next Defense card(?: this round)? (?:gets|has|provides) -(\d+) (?:Guard|Defense)/i);
  return match ? Number(match[1]) : 0;
}


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
