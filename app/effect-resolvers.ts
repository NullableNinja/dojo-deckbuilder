import cardEffectsJson from "./data/card-effects.json" with { type: "json" };

export type EffectCardLike = {
  catalogId?: string | null;
  name?: string;
  cardType?: string;
  subtype?: string;
  focusValue?: string | number | null;
  rulesText?: string | null;
  zone?: string | null;
  tags?: string[];
  stats?: Record<string, string | number | null | undefined>;
  details?: Record<string, string | number | null | undefined>;
};

type RegistryEffect = {
  id?: string;
  trigger?: string;
  action?: string;
  amount?: number;
  resolver?: string;
  conditions?: { kind?: string; operator?: string; value?: unknown }[];
};

type StructuredEffectRegistry = {
  cards?: Record<string, { name?: string; effects?: RegistryEffect[] }>;
};

const structuredEffectRegistry = cardEffectsJson as unknown as StructuredEffectRegistry;

function structuredEntry(card: EffectCardLike) {
  const catalogId = String(card.catalogId ?? "").trim();
  return catalogId ? structuredEffectRegistry.cards?.[catalogId] ?? null : null;
}

function structuredEffects(card: EffectCardLike) {
  return structuredEntry(card)?.effects ?? [];
}

function structuredResolvers(card: EffectCardLike, resolver: string) {
  return structuredEffects(card).filter((effect) => effect.resolver === resolver);
}

function structuredResolver(card: EffectCardLike, resolver: string) {
  return structuredResolvers(card, resolver)[0] ?? null;
}

function numberValue(value: unknown) {
  const match = String(value ?? "").match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizedMinus(text: string) {
  return text.replace(/[−–—]/g, "-");
}

function structuredConditionsMatch(effect: RegistryEffect, values: Record<string, unknown>) {
  return (effect.conditions ?? []).every((condition) => {
    const actual = values[String(condition.kind ?? "")];
    const expected = condition.value;
    switch (condition.operator ?? "eq") {
      case "eq": return actual === expected;
      case "neq": return actual !== expected;
      case "gt": return Number(actual) > Number(expected);
      case "gte": return Number(actual) >= Number(expected);
      case "lt": return Number(actual) < Number(expected);
      case "lte": return Number(actual) <= Number(expected);
      case "includes": return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? "").includes(String(expected ?? ""));
      case "notIncludes": return Array.isArray(actual) ? !actual.includes(expected) : !String(actual ?? "").includes(String(expected ?? ""));
      default: return false;
    }
  });
}

function structuredConditionValue(effect: RegistryEffect, kind: string) {
  return effect.conditions?.find((condition) => condition.kind === kind)?.value;
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

export function targetDiscardOnHitCount(card: EffectCardLike) {
  const text = String(card.rulesText ?? "").replace(/\s+/g, " ").trim();
  const match = text.match(/(?:If (?:this Attack|it|that Attack) Hits?|On Hit), (?:the )?(?:target|opponent) discards? (\d+) cards?/i);
  return match ? Number(match[1]) : 0;
}

export function targetNextAttackPenalty(card: EffectCardLike) {
  const entry = structuredEntry(card);
  if (entry) {
    return structuredResolvers(card, "attack.targetNextAttackPenalty")
      .reduce((total, effect) => total + Math.abs(Number(effect.amount ?? 0)), 0);
  }
  const text = normalizedMinus(String(card.rulesText ?? ""));
  const match = text.match(/(?:target|opponent)[’']s next Attack(?: this round)? (?:gets|has) -(\d+) Attack Power/i);
  return match ? Number(match[1]) : 0;
}

export function targetSpeedPenaltyUntilHonor(card: EffectCardLike, context: { previousCardIsItem?: boolean } = {}) {
  const entry = structuredEntry(card);
  if (entry) {
    const values = { previousCardIsItem: Boolean(context.previousCardIsItem) };
    return structuredResolvers(card, "attack.targetSpeedPenaltyUntilHonor")
      .filter((effect) => structuredConditionsMatch(effect, values))
      .reduce((total, effect) => total + Math.abs(Number(effect.amount ?? 0)), 0);
  }
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
  if (structuredResolver(card, "attack.chooseAnyZone")) return true;
  if (!structuredEntry(card)) {
    const text = String(card.rulesText ?? "");
    if (/Choose High, Mid, or Low when declared/i.test(text)) return true;
    if (/may be declared as Any zone/i.test(text)) return true;
  }
  if (firstAttack && equipment.some((item) => /Your first Attack each turn may be declared as Any zone/i.test(String(item.rulesText ?? "")))) return true;
  return false;
}

export function structuredFocusIfFastest(card: EffectCardLike, selfSpeed: number, opponentSpeed: number) {
  const effect = structuredResolver(card, "starter.gainFocusIfFastest");
  if (!effect) return 0;
  const hasFastestCondition = (effect.conditions ?? []).some((condition) => condition.kind === "isFastest" && condition.value === true);
  if (!hasFastestCondition || selfSpeed <= opponentSpeed) return 0;
  return Number(effect.amount ?? 0);
}

export function structuredNextAttackFlow(card: EffectCardLike, context: {
  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";
  differentZoneFromPreviousAttack?: boolean;
}) {
  const effects = structuredResolvers(card, "attack.grantNextAttackFlow");
  if (!effects.length) return { handled: false, grant: false };
  const values = {
    differentZoneFromPreviousAttack: Boolean(context.differentZoneFromPreviousAttack),
  };
  return {
    handled: true,
    grant: effects.some((effect) => effect.trigger === context.timing && structuredConditionsMatch(effect, values)),
  };
}

export function structuredConditionalFocus(card: EffectCardLike, context: {
  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";
  attackNumber: number;
  usedEffectIds?: string[];
}) {
  const effects = structuredResolvers(card, "attack.conditionalFocus");
  if (!effects.length) return { handled: false, amount: 0 };
  const values = { firstAttackThisTurn: context.attackNumber === 1, attackNumber: context.attackNumber, oncePerTurn: true };
  const used = new Set(context.usedEffectIds ?? []);
  const consumed: string[] = [];
  const matched = effects.filter((effect) => {
    if (effect.trigger !== context.timing || !structuredConditionsMatch(effect, values)) return false;
    const oncePerTurn = (effect.conditions ?? []).some((condition) => condition.kind === "oncePerTurn" && condition.value === true);
    if (oncePerTurn && effect.id && used.has(effect.id)) return false;
    if (oncePerTurn && effect.id) consumed.push(effect.id);
    return true;
  });
  const result = {
    handled: true,
    amount: matched.reduce((total, effect) => total + Number(effect.amount ?? 0), 0),
  };
  return consumed.length ? { ...result, effectIds: consumed } : result;
}

export function structuredConditionalCycle(card: EffectCardLike, context: {
  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";
  firstAttackThisTurn?: boolean;
  priorJumpOrSpinAttack?: boolean;
  previousAttackHit?: boolean;
  differentZoneFromPreviousAttack?: boolean;
}) {
  const effects = structuredResolvers(card, "attack.conditionalCycle");
  if (!effects.length) return { handled: false, draw: 0, discard: 0 };
  const values = {
    firstAttackThisTurn: Boolean(context.firstAttackThisTurn),
    priorJumpOrSpinAttack: Boolean(context.priorJumpOrSpinAttack),
    previousAttackHit: Boolean(context.previousAttackHit),
    differentZoneFromPreviousAttack: Boolean(context.differentZoneFromPreviousAttack),
  };
  let draw = 0;
  let discard = 0;
  for (const effect of effects) {
    if (effect.trigger !== context.timing || !structuredConditionsMatch(effect, values)) continue;
    if (effect.action === "draw") draw += Number(effect.amount ?? 0);
    if (effect.action === "discard") discard += Number(effect.amount ?? 0);
  }
  return { handled: true, draw, discard };
}

export function afterDefenseAttackPowerBonus(card: EffectCardLike, defenderPlayedDefense: boolean) {
  const effects = structuredResolvers(card, "attack.afterDefensePower");
  if (!effects.length) return { amount: 0, notes: [] as string[] };
  const values = { defenderPlayedDefense };
  let amount = 0;
  const notes: string[] = [];
  for (const effect of effects) {
    if (effect.trigger !== "onDefenseDeclared" || !structuredConditionsMatch(effect, values)) continue;
    const value = Number(effect.amount ?? 0);
    amount += value;
    notes.push(`Defense response ${value >= 0 ? "+" : ""}${value} Attack Power`);
  }
  return { amount, notes };
}

export function nextAttackArmorPenalty(card: EffectCardLike) {
  return structuredResolvers(card, "attack.nextAttackArmorPenalty")
    .reduce((total, effect) => total + Math.abs(Number(effect.amount ?? 0)), 0);
}

export function structuredNextAttackAnyZone(card: EffectCardLike, context: {
  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";
  attackNumber: number;
}) {
  const effects = structuredResolvers(card, "attack.grantNextAttackAnyZone");
  if (!effects.length) return { handled: false, grant: false };
  return {
    handled: true,
    grant: context.attackNumber > 0 && effects.some((effect) => effect.trigger === context.timing),
  };
}

export function structuredCurrentAttackFlow(card: EffectCardLike, context: { hasWeaponEquipped: boolean }) {
  const effects = structuredResolvers(card, "attack.currentAttackFlow");
  if (!effects.length) return { handled: false, hasFlow: false };
  const values = { hasWeaponEquipped: context.hasWeaponEquipped };
  return {
    handled: true,
    hasFlow: effects.some((effect) => effect.trigger === "onAttackDeclared" && structuredConditionsMatch(effect, values)),
  };
}

export function conditionalAttackPowerBonus(card: EffectCardLike, context: {
  playedKata: boolean;
  firstAttack: boolean;
  matchingArmor?: boolean;
  targetEquipmentCount?: number;
  attackNumber?: number;
  hasTempo?: boolean;
  hasFewerCardsThanTarget?: boolean;
  targetSpeedHigher?: boolean;
  priorLowAttack?: boolean;
  previousCardIsItemOrConsumable?: boolean;
  hasImprovisedWeapon?: boolean;
  wasHitSinceLastTurn?: boolean;
  differentZoneFromPreviousAttack?: boolean;
  previousAttackZoneMidOrHigh?: boolean;
  priorDifferentZoneCount?: number;
  priorPunchAttack?: boolean;
  priorSpinAttack?: boolean;
  targetTempoUsed?: boolean;
  playedAsReversal?: boolean;
  playedDefenseSinceLastTurn?: boolean;
  blockedSinceLastTurn?: boolean;
  blockedThisRound?: boolean;
  previousAttackBlocked?: boolean;
  previousCardIsKataOrItem?: boolean;
}) {
  let amount = 0;
  const notes: string[] = [];
  const entry = structuredEntry(card);
  if (entry) {
    const values = {
      playedKataThisTurn: context.playedKata,
      firstAttackThisTurn: context.firstAttack,
      targetHasMatchingArmor: Boolean(context.matchingArmor),
      targetPermanentEquipmentCount: context.targetEquipmentCount ?? 0,
      attackNumber: context.attackNumber ?? (context.firstAttack ? 1 : 0),
      hasTempo: Boolean(context.hasTempo),
      hasFewerCardsThanTarget: Boolean(context.hasFewerCardsThanTarget),
      targetSpeedHigher: Boolean(context.targetSpeedHigher),
      priorLowAttack: Boolean(context.priorLowAttack),
      previousCardIsItemOrConsumable: Boolean(context.previousCardIsItemOrConsumable),
      hasImprovisedWeapon: Boolean(context.hasImprovisedWeapon),
      wasHitSinceLastTurn: Boolean(context.wasHitSinceLastTurn),
      differentZoneFromPreviousAttack: Boolean(context.differentZoneFromPreviousAttack),
      previousAttackZoneMidOrHigh: Boolean(context.previousAttackZoneMidOrHigh),
      priorDifferentZoneCount: context.priorDifferentZoneCount ?? 0,
      priorPunchAttack: Boolean(context.priorPunchAttack),
      priorSpinAttack: Boolean(context.priorSpinAttack),
      targetTempoUsed: Boolean(context.targetTempoUsed),
      playedAsReversal: Boolean(context.playedAsReversal),
      playedDefenseSinceLastTurn: Boolean(context.playedDefenseSinceLastTurn),
      blockedSinceLastTurn: Boolean(context.blockedSinceLastTurn),
      blockedThisRound: Boolean(context.blockedThisRound),
      previousAttackBlocked: Boolean(context.previousAttackBlocked),
      previousCardIsKataOrItem: Boolean(context.previousCardIsKataOrItem),
    };
    for (const effect of structuredResolvers(card, "attack.conditionalPower")) {
      if (!structuredConditionsMatch(effect, values)) continue;
      const value = Number(effect.amount ?? 0);
      amount += value;
      notes.push(`structured condition ${value >= 0 ? "+" : ""}${value} Attack Power`);
    }
    return { amount, notes };
  }
  const text = normalizedMinus(String(card.rulesText ?? ""));
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
  const entry = structuredEntry(card);
  if (entry) {
    const effect = structuredResolver(card, "attack.optionalDiscardDraw");
    if (!effect) return null;
    return {
      discard: Number(structuredConditionValue(effect, "discardCost") ?? 0),
      draw: Number(structuredConditionValue(effect, "drawAfterCost") ?? 0),
    };
  }
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
  let amount = 0;
  const notes: string[] = [];
  const add = (value: number, note: string) => { amount += value; notes.push(note); };
  const entry = structuredEntry(card);
  if (entry) {
    const values = {
      targetHasMatchingArmor: context.matchingArmor,
      targetPermanentEquipmentCount: context.targetEquipmentCount,
      targetHasExhaustedEquipment: Boolean(context.targetHasExhaustedEquipment),
      selfSpeedChangedThisRound: Boolean(context.speedChangedThisRound),
    };
    for (const effect of structuredResolvers(card, "attack.piercing")) {
      if (!structuredConditionsMatch(effect, values)) continue;
      const value = Number(effect.amount ?? 0);
      add(value, `structured Piercing ${value}`);
    }
    return { amount, notes };
  }

  const text = normalizedMinus(String(card.rulesText ?? ""));
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

export function mandatoryDiscardChoiceCount(card: EffectCardLike) {
  const text = String(card.rulesText ?? "");
  if (/\bmay\s+discard\b/i.test(text)) return 0;
  const match = text.match(/Draw\s+\d+\s+cards?,\s*then\s+discard\s+(\d+)\s+cards?/i);
  return match ? Number(match[1]) : 0;
}

export function discardChoiceFollowup(source: EffectCardLike, discarded: EffectCardLike) {
  const text = String(source.rulesText ?? "");
  let focus = 0;
  let nextAttackPower = 0;
  let nextDefenseGuard = 0;
  const notes: string[] = [];

  const zeroFocus = text.match(/If you discarded a card with Focus Value 0, gain (\d+) Focus/i);
  if (zeroFocus && Number(discarded.focusValue ?? 0) === 0) {
    focus += Number(zeroFocus[1]);
    notes.push(`Focus Value 0: +${zeroFocus[1]} Focus`);
  }
  const technique = text.match(/If you discarded a Technique, your next Attack this turn gets \+(\d+) Attack Power/i);
  if (technique && String(discarded.cardType ?? '').toLocaleLowerCase() === 'technique') {
    nextAttackPower += Number(technique[1]);
    notes.push(`Technique discarded: next Attack +${technique[1]} Attack Power`);
  }
  const item = text.match(/If you discarded an Item, your next Defense this round gets \+(\d+) Guard/i);
  if (item && String(discarded.cardType ?? '').toLocaleLowerCase() === 'item') {
    nextDefenseGuard += Number(item[1]);
    notes.push(`Item discarded: next Defense +${item[1]} Guard`);
  }
  const discardForFocus = text.match(/discard \d+ cards? to gain (\d+) Focus/i);
  if (discardForFocus) {
    focus += Number(discardForFocus[1]);
    notes.push(`Discard cost paid: +${discardForFocus[1]} Focus`);
  }
  return { focus, nextAttackPower, nextDefenseGuard, notes };
}

export type DeckLookPlan =
  | { kind: 'pick-discard'; count: number; filter: 'defense-or-kata'; optional: false; noMatchFocus: number }
  | { kind: 'reorder'; count: number; distinctTypeFocus: number }
  | { kind: 'pick-reorder'; count: number; filter: 'technique'; optional: false }
  | { kind: 'pick-shuffle'; count: number; filter: 'item'; optional: true };

export function deckLookPlan(card: EffectCardLike): DeckLookPlan | null {
  const text = String(card.rulesText ?? '').replace(/\s+/g, ' ').trim();
  let match = text.match(/Look at the top (\d+) cards? of your deck\. Put one Defense or Kata into your hand and discard the rest\. If you found neither, gain (\d+) Focus/i);
  if (match) return { kind: 'pick-discard', count: Number(match[1]), filter: 'defense-or-kata', optional: false, noMatchFocus: Number(match[2]) };

  match = text.match(/Look at the top (\d+) cards? of your deck and put them back in any order\. If they contain three different card types, gain (\d+) Focus/i);
  if (match) return { kind: 'reorder', count: Number(match[1]), distinctTypeFocus: Number(match[2]) };

  match = text.match(/Look at the top (\d+) cards? of your deck\. Put 1 Technique into your hand; return the rest in any order/i);
  if (match) return { kind: 'pick-reorder', count: Number(match[1]), filter: 'technique', optional: false };

  match = text.match(/Look at the top (\d+) cards? of your deck\. You may reveal an Item and put it into your hand\. Shuffle the rest/i);
  if (match) return { kind: 'pick-shuffle', count: Number(match[1]), filter: 'item', optional: true };

  match = text.match(/Look at the top (\d+) cards? of your deck\. Put them back in either order\. If they have different card types, gain (\d+) Focus/i);
  if (match) return { kind: 'reorder', count: Number(match[1]), distinctTypeFocus: Number(match[2]) };
  return null;
}

export type EquipmentActivationPlan =
  | { kind: "speed-cycle"; speed: number; draw: number; discard: number }
  | { kind: "next-attack-power"; power: number }
  | { kind: "zone-attack"; power: number; piercing: number; blockedFocus: number; requireDifferentPreviousZone: boolean }
  | { kind: "incoming-zone-penalty"; attackPowerPenalty: number }
  | { kind: "defense-guard"; guard: number; reversalPower: number }
  | { kind: "initiate-tempo-focus"; focus: number }
  | { kind: "after-kata-focus"; focus: number }
  | { kind: "first-hit-discard-focus"; discard: number; focus: number }
  | { kind: "hit-direct-damage"; damage: number }
  | { kind: "hit-next-initiate-focus"; focus: number }
  | { kind: "numbered-attack-power"; attackNumber: number; power: number; minBelt: string };

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

  match = text.match(/^Exhaust:\s*After an opponent declares an Attack targeting you, choose High, Mid, or Low\. If that Attack uses the chosen zone, it gets -(\d+) Attack Power/i);
  if (match) return { kind: "incoming-zone-penalty", attackPowerPenalty: Number(match[1]) };

  match = text.match(/^Exhaust:\s*When you play a Defense outside your turn, it gets \+(\d+) Guard\. At Green Belt or higher, if it Blocks, your Reversal this round gets \+(\d+) Attack Power/i);
  if (match) return { kind: "defense-guard", guard: Number(match[1]), reversalPower: Number(match[2]) };

  match = text.match(/^Exhaust at Initiate\. If you have Tempo after Speed is set, gain (\d+) Focus/i);
  if (match) return { kind: "initiate-tempo-focus", focus: Number(match[1]) };

  match = text.match(/^Exhaust after you play a Kata:\s*Gain (\d+) Focus/i);
  if (match) return { kind: "after-kata-focus", focus: Number(match[1]) };

  match = text.match(/^Exhaust:\s*After your first Attack Hits this turn, discard (\d+) cards? to gain (\d+) Focus/i);
  if (match) return { kind: "first-hit-discard-focus", discard: Number(match[1]), focus: Number(match[2]) };

  match = text.match(/^Exhaust after one of your Attacks Hits:\s*deal (\d+) direct damage to the same target/i);
  if (match) return { kind: "hit-direct-damage", damage: Number(match[1]) };

  match = text.match(/^Exhaust after your Attack Hits:\s*Generate (\d+) Focus during your next Initiate/i);
  if (match) return { kind: "hit-next-initiate-focus", focus: Number(match[1]) };

  match = text.match(/^At ([A-Za-z]+) Belt or higher, exhaust:\s*Your (second|third|fourth) normal Attack this turn gets \+(\d+) Attack Power/i);
  if (match) {
    const attackNumber = match[2].toLocaleLowerCase() === "second" ? 2 : match[2].toLocaleLowerCase() === "third" ? 3 : 4;
    return { kind: "numbered-attack-power", attackNumber, power: Number(match[3]), minBelt: match[1] };
  }

  return null;
}

export function readyEquipmentOnHit(card: EffectCardLike) {
  const entry = structuredEntry(card);
  if (entry) {
    return structuredResolvers(card, "attack.readyEquipmentOnHit")
      .reduce((total, effect) => total + Number(effect.amount ?? 0), 0);
  }
  const text = String(card.rulesText ?? "");
  const match = text.match(/If (?:it|this Attack) Hits, you may ready one Equipment card you control/i);
  return match ? 1 : 0;
}

export function mandatoryDamageReductionEquipment(card: EffectCardLike) {
  const text = normalizedMinus(String(card.rulesText ?? "")).replace(/\s+/g, " ").trim();
  const match = text.match(/The first time you take damage each round, reduce that damage by (\d+); then exhaust this card\. Ready it during your next Initiate Phase/i);
  return match ? { reduce: Number(match[1]), readyAtInitiate: true } : null;
}

export function optionalCombatDamageReductionEquipment(card: EffectCardLike) {
  const text = normalizedMinus(String(card.rulesText ?? "")).replace(/\s+/g, " ").trim();
  const match = text.match(/The first time you take combat damage each round, you may exhaust this to reduce that damage by (\d+)\. At ([A-Za-z]+) Belt or higher, ready it at Hide if that damage was (\d+) or more/i);
  if (!match) return null;
  return { reduce: Number(match[1]), readyAtHideMinBelt: match[2], readyAtHideMinDamage: Number(match[3]) };
}

export function postBlockEquipmentCycle(card: EffectCardLike) {
  const text = normalizedMinus(String(card.rulesText ?? "")).replace(/\s+/g, " ").trim();
  const match = text.match(/At ([A-Za-z]+) Belt or higher, after you Block a (High|Mid|Low) Attack, you may exhaust this to draw (\d+) cards?, then discard (\d+) cards?/i);
  if (!match) return null;
  return { minBelt: match[1], zone: match[2], draw: Number(match[3]), discard: Number(match[4]) };
}
