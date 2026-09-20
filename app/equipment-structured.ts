import cardEffectsJson from "./data/card-effects.json" with { type: "json" };

export const EQUIPMENT_STRUCTURED_RESOLVER = "equipment.structured";

export type EquipmentCardLike = {
  catalogId?: string | null;
  id?: string | null;
  name?: string;
  subtype?: string;
  zone?: string | null;
  tags?: string[];
  stats?: Record<string, string | number | null | undefined>;
  details?: Record<string, string | number | null | undefined>;
};

type Condition = { kind?: string; operator?: string; value?: unknown };
export type EquipmentRegistryEffect = {
  id?: string;
  effect?: string;
  trigger?: string;
  action?: string;
  target?: string;
  amount?: number;
  duration?: string;
  resolver?: string;
  conditions?: Condition[];
};

type Registry = { cards?: Record<string, { name?: string; effects?: EquipmentRegistryEffect[] }> };
const registry = cardEffectsJson as unknown as Registry;
const BELT_ORDER = ["White", "Gold", "Orange", "Green", "Purple", "Blue", "Red", "Brown", "Black"];
const beltAtLeast = (actual: unknown, required: unknown) => {
  const actualIndex = BELT_ORDER.findIndex((belt) => belt.toLocaleLowerCase() === String(actual ?? "").toLocaleLowerCase());
  const requiredIndex = BELT_ORDER.findIndex((belt) => belt.toLocaleLowerCase() === String(required ?? "").toLocaleLowerCase());
  return actualIndex >= 0 && requiredIndex >= 0 && actualIndex >= requiredIndex;
};

const equipmentCatalogId = (card: EquipmentCardLike) => String(card.catalogId ?? "").toUpperCase();
export function isStructuredEquipment(card: EquipmentCardLike) {
  const id = equipmentCatalogId(card);
  return Boolean(id && (id.includes("-WPN-") || id.includes("-GEA-") || id.includes("-DEQ-")) && registry.cards?.[id]);
}

export function structuredEquipmentEffects(card: EquipmentCardLike): EquipmentRegistryEffect[] | null {
  const id = equipmentCatalogId(card);
  if (!id || !(id.includes("-WPN-") || id.includes("-GEA-") || id.includes("-DEQ-"))) return null;
  const entry = registry.cards?.[id];
  if (!entry) return null;
  return (entry.effects ?? []).filter((effect) => effect.resolver === EQUIPMENT_STRUCTURED_RESOLVER);
}

export function equipmentConditionValue(effect: EquipmentRegistryEffect, kind: string) {
  return effect.conditions?.find((condition) => condition.kind === kind)?.value;
}

export function equipmentHasCondition(effect: EquipmentRegistryEffect, kind: string, expected?: unknown) {
  const condition = effect.conditions?.find((candidate) => candidate.kind === kind);
  if (!condition) return false;
  return arguments.length < 3 || Object.is(condition.value, expected);
}

function numberValue(value: unknown) {
  const match = String(value ?? "").match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function tagsOf(values: unknown) {
  return Array.isArray(values) ? values.map((value) => String(value).toLocaleLowerCase()) : [];
}

function includesTag(tags: string[], tag: unknown) {
  const expected = String(tag ?? "").toLocaleLowerCase();
  return tags.some((value) => value === expected || value.includes(expected));
}

function conditionMatches(condition: Condition, context: Record<string, unknown>) {
  const kind = String(condition.kind ?? "");
  const expected = condition.value;
  const actual = context[kind];
  if (kind === "minimumBelt") return beltAtLeast(context.beltName, expected);
  if (["choiceKind", "scheduledTiming", "firstAttackWithTagThisTurn", "attackHasTag", "nextAttackHasTag", "minimumFinalCost", "sourceAffectedCountThreshold", "minimumDraw", "nextPurchaseOnly", "draw", "discard", "sameRoundOnly", "sameTurnOnly", "nextAttackDifferentZone"].includes(kind)) return true;
  if (["resolvedCardType", "defenderPlayedDefense", "goldBeltExamThirdZone", "purchaseCompleted", "marketEndSlot"].includes(kind)) return actual === expected;
  if (["oncePerTurn", "oncePerRound"].includes(kind)) return Boolean(actual) === Boolean(expected);
  if (kind === "attackHasAnyTag") {
    const tags = tagsOf(context.attackTags);
    return Array.isArray(expected) && expected.some((tag) => includesTag(tags, tag));
  }
  if (kind === "defenseHasTag") return includesTag(tagsOf(context.defenseTags), expected);
  if (kind === "attackZones") return Array.isArray(expected) && expected.map(String).some((zone) => zone.toLocaleLowerCase() === String(context.attackZone ?? "").toLocaleLowerCase());
  if (kind === "incomingZones") return Array.isArray(expected) && expected.map(String).some((zone) => zone.toLocaleLowerCase() === String(context.incomingZone ?? context.attackZone ?? "").toLocaleLowerCase());
  if (kind === "equippedCardSubtypeIn") return Array.isArray(expected) && expected.map(String).some((subtype) => subtype.toLocaleLowerCase() === String(context.equippedCardSubtype ?? "").toLocaleLowerCase());
  if (!(kind in context)) return false;
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
}

export function equipmentConditionsMatch(effect: EquipmentRegistryEffect, context: Record<string, unknown>) {
  return (effect.conditions ?? []).every((condition) => conditionMatches(condition, context));
}

function baseArmorDefense(card: EquipmentCardLike, zone: string) {
  if (String(card.subtype ?? "").toLocaleLowerCase() !== "defense equipment") return 0;
  const guard = numberValue(card.stats?.Guard);
  if (!guard) return 0;
  const slot = String(card.stats?.Slot ?? card.details?.Slot ?? "").toLocaleLowerCase();
  const target = zone.toLocaleLowerCase();
  if (slot.includes("head")) return target === "high" ? guard : 0;
  if (slot.includes("chest")) return target === "mid" ? guard : 0;
  if (slot.includes("leg") || slot.includes("feet") || slot.includes("foot")) return target === "low" ? guard : 0;
  if (slot.includes("arm")) return target === "high" || target === "mid" ? guard : 0;
  return 0;
}

export type EquipmentDefenseContext = {
  weaponAttack?: boolean;
  firstIncomingAttack?: boolean;
  hasTempo?: boolean;
  selfIsLowestXp?: boolean;
  consumableUsedThisRound?: boolean;
};

export function structuredDefenseEquipmentBonus(card: EquipmentCardLike, zone: string, context: EquipmentDefenseContext = {}): number | null {
  const effects = structuredEquipmentEffects(card);
  if (!effects) return null;
  const relevant = effects.filter((effect) => effect.effect === "equipment.modifyDefenseContribution" && effect.trigger === "passive" && effect.target === "self");
  const hasUnconditionalStatic = relevant.some((effect) => {
    const conditionalKinds = new Set(["incomingAttackUsesWeapon", "firstIncomingAttackThisRound", "hasTempo", "selfIsLowestXp", "consumableUsedThisRound"]);
    return !(effect.conditions ?? []).some((condition) => conditionalKinds.has(String(condition.kind)));
  });
  let amount = hasUnconditionalStatic ? 0 : baseArmorDefense(card, zone);
  const runtime = {
    incomingZone: zone,
    weaponAttack: Boolean(context.weaponAttack),
    incomingAttackUsesWeapon: Boolean(context.weaponAttack),
    firstIncomingAttackThisRound: Boolean(context.firstIncomingAttack),
    hasTempo: context.hasTempo ?? true,
    selfIsLowestXp: Boolean(context.selfIsLowestXp),
    consumableUsedThisRound: Boolean(context.consumableUsedThisRound),
  };
  for (const effect of relevant) {
    if (!equipmentConditionsMatch(effect, runtime)) continue;
    amount += Number(effect.amount ?? 0);
  }
  return amount;
}

export function structuredPassiveEquipmentGuard(card: EquipmentCardLike): number | null {
  const effects = structuredEquipmentEffects(card);
  if (!effects) return null;
  if (String(card.subtype ?? "").toLocaleLowerCase() === "defense equipment") return 0;
  return numberValue(card.stats?.Guard);
}

export function structuredEquipmentSpeedModifier(card: EquipmentCardLike): number | null {
  const effects = structuredEquipmentEffects(card);
  if (!effects) return null;
  return effects
    .filter((effect) => effect.effect === "combat.modifySpeed" && effect.trigger === "passive" && effect.duration === "whileEquipped")
    .reduce((total, effect) => total + Number(effect.amount ?? 0), 0);
}

export function structuredAfterDefenseNextAttackBonus(cards: EquipmentCardLike[]) {
  let handled = false;
  let amount = 0;
  const sources: string[] = [];
  for (const card of cards) {
    const effects = structuredEquipmentEffects(card);
    if (!effects) continue;
    handled = true;
    const cardAmount = effects
      .filter((effect) => effect.effect === "combat.modifyAttackPower" && effect.trigger === "onDefenseDeclared" && effect.duration === "nextAttack")
      .filter((effect) => !equipmentHasCondition(effect, "defenderPlayedDefense", false))
      .reduce((total, effect) => total + Number(effect.amount ?? 0), 0);
    if (!cardAmount) continue;
    amount += cardAmount;
    sources.push(card.name ?? "Equipment");
  }
  return { handled, amount, sources };
}

export type EquipmentAttackContext = {
  firstAttack: boolean;
  attackNumber?: number;
  zone?: string;
  attackerSpeed?: number;
  defenderSpeed?: number;
  targetXpHigher?: boolean;
  targetHasTemporaryNegativeStat?: boolean;
  didNotAttackPreviousTurn?: boolean;
  hasNotAttackedThisTurn?: boolean;
  firstAttackAfterKataThisTurn?: boolean;
  attackTags?: string[];
  blockedThisRound?: boolean;
  hasTwoPairedWeapons?: boolean;
  equippedThisTurnCatalogIds?: string[];
  currentAttackIsNormal?: boolean;
};

function attackContextValues(card: EquipmentCardLike, context: EquipmentAttackContext) {
  const attackTags = context.attackTags ?? [];
  const catalogId = equipmentCatalogId(card);
  return {
    firstAttackThisTurn: context.firstAttack,
    attackNumber: context.attackNumber ?? (context.firstAttack ? 1 : 0),
    attackZone: context.zone ?? "",
    targetSpeedHigher: Number(context.defenderSpeed ?? 0) > Number(context.attackerSpeed ?? 0),
    targetXpHigher: Boolean(context.targetXpHigher),
    targetHasTemporaryNegativeStat: Boolean(context.targetHasTemporaryNegativeStat),
    didNotAttackPreviousTurn: Boolean(context.didNotAttackPreviousTurn),
    hasNotAttackedThisTurn: context.hasNotAttackedThisTurn ?? context.firstAttack,
    firstAttackAfterKataThisTurn: Boolean(context.firstAttackAfterKataThisTurn),
    blockedThisRound: Boolean(context.blockedThisRound),
    hasTwoPairedWeapons: Boolean(context.hasTwoPairedWeapons),
    equippedThisTurn: Boolean(context.equippedThisTurnCatalogIds?.includes(catalogId)),
    currentAttackIsNormal: context.currentAttackIsNormal ?? true,
    attackTags,
    attackUsesSourceEquipment: true,
  };
}

function requiredTagConditionMatches(effect: EquipmentRegistryEffect, context: EquipmentAttackContext) {
  const tags = context.attackTags ?? [];
  const attackTag = equipmentConditionValue(effect, "attackHasTag");
  if (attackTag != null && !includesTag(tags.map((tag) => tag.toLocaleLowerCase()), attackTag)) return false;
  const firstTag = equipmentConditionValue(effect, "firstAttackWithTagThisTurn");
  if (firstTag != null && !includesTag(tags.map((tag) => tag.toLocaleLowerCase()), firstTag)) return false;
  return true;
}

export function structuredEquipmentAttackPowerBonus(cards: EquipmentCardLike[], context: EquipmentAttackContext) {
  let handled = false;
  let amount = 0;
  const sources: string[] = [];
  const unsupported: string[] = [];
  for (const card of cards) {
    const effects = structuredEquipmentEffects(card);
    if (!effects) continue;
    handled = true;
    let cardAmount = 0;
    for (const effect of effects.filter((candidate) => candidate.effect === "combat.modifyAttackPower" && candidate.trigger === "onAttackDeclared" && candidate.duration === "immediate")) {
      if (equipmentHasCondition(effect, "manualActivation") || equipmentHasCondition(effect, "armedEquipmentZoneMatched") || equipmentHasCondition(effect, "nextQualifyingAttackOnly")) continue;
      if (!requiredTagConditionMatches(effect, context)) continue;
      const values = attackContextValues(card, context);
      const unknown = (effect.conditions ?? []).filter((condition) => ![
        "firstAttackThisTurn", "attackNumber", "attackZones", "targetSpeedHigher", "targetXpHigher", "targetHasTemporaryNegativeStat",
        "didNotAttackPreviousTurn", "hasNotAttackedThisTurn", "firstAttackAfterKataThisTurn", "blockedThisRound", "hasTwoPairedWeapons",
        "equippedThisTurn", "currentAttackIsNormal", "attackUsesSourceEquipment", "attackHasTag", "firstAttackWithTagThisTurn"
      ].includes(String(condition.kind)));
      if (unknown.length) {
        unsupported.push(effect.id ?? "unknown-equipment-effect");
        continue;
      }
      if (!equipmentConditionsMatch(effect, values)) continue;
      cardAmount += Number(effect.amount ?? 0);
    }
    if (cardAmount) {
      amount += cardAmount;
      sources.push(card.name ?? "Equipment");
    }
  }
  return { handled, amount, sources, unsupported };
}

export function structuredEquipmentFirstIncomingPenalty(cards: EquipmentCardLike[], firstIncomingAttack: boolean) {
  let handled = false;
  let amount = 0;
  const sources: string[] = [];
  for (const card of cards) {
    const effects = structuredEquipmentEffects(card);
    if (!effects) continue;
    handled = true;
    const value = effects
      .filter((effect) => effect.effect === "combat.modifyAttackPower" && effect.trigger === "onAttackDeclared" && effect.target === "opponent")
      .filter((effect) => equipmentHasCondition(effect, "firstIncomingAttackThisRound"))
      .filter(() => firstIncomingAttack)
      .reduce((total, effect) => total + Number(effect.amount ?? 0), 0);
    if (!value) continue;
    amount += value;
    sources.push(card.name ?? "Equipment");
  }
  return { handled, amount, sources };
}

export function structuredEquipmentPiercing(cards: EquipmentCardLike[], context: { firstAttack: boolean; zone: string; matchingArmor: boolean; attackTags?: string[] }) {
  let handled = false;
  let amount = 0;
  const sources: string[] = [];
  for (const card of cards) {
    const effects = structuredEquipmentEffects(card);
    if (!effects) continue;
    handled = true;
    let value = 0;
    for (const effect of effects.filter((candidate) => candidate.effect === "combat.piercing" && candidate.trigger === "onAttackDeclared" && candidate.duration === "immediate")) {
      if (equipmentHasCondition(effect, "manualActivation")) continue;
      const values = {
        firstAttackThisTurn: context.firstAttack,
        attackZone: context.zone,
        targetHasMatchingArmor: context.matchingArmor,
        attackUsesSourceEquipment: true,
        attackTags: context.attackTags ?? [],
      };
      if (!equipmentConditionsMatch(effect, values)) continue;
      value += Number(effect.amount ?? 0);
    }
    if (!value) continue;
    amount += value;
    sources.push(`${card.name ?? "Equipment"} Piercing ${value}`);
  }
  return { handled, amount, sources };
}

export function structuredEquipmentCanChooseAnyZone(cards: EquipmentCardLike[], firstAttack: boolean) {
  let handled = false;
  let grant = false;
  for (const card of cards) {
    const effects = structuredEquipmentEffects(card);
    if (!effects) continue;
    handled = true;
    for (const effect of effects.filter((candidate) => candidate.effect === "combat.chooseZone" && candidate.trigger === "onAttackDeclared")) {
      if (equipmentHasCondition(effect, "manualActivation")) continue;
      if (equipmentHasCondition(effect, "firstAttackThisTurn") && !firstAttack) continue;
      grant = true;
    }
  }
  return { handled, grant };
}

const effectById = (effects: EquipmentRegistryEffect[], id: string) => effects.find((effect) => effect.id === id);
const amountOf = (effects: EquipmentRegistryEffect[], id: string) => Number(effectById(effects, id)?.amount ?? 0);

export type StructuredEquipmentActivationPlan =
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

export function structuredEquipmentActivationPlan(card: EquipmentCardLike): StructuredEquipmentActivationPlan | null | undefined {
  const effects = structuredEquipmentEffects(card);
  if (!effects) return undefined;
  const id = equipmentCatalogId(card);
  if (id === "DDB-GEA-CORE-006") return { kind: "speed-cycle", speed: amountOf(effects, "equipment-gea-006-activation-speed"), draw: amountOf(effects, "equipment-gea-006-tempo-cycle-draw"), discard: amountOf(effects, "equipment-gea-006-tempo-cycle-discard") };
  if (id === "DDB-WPN-CORE-054") return { kind: "next-attack-power", power: amountOf(effects, "equipment-wpn-054-exhaust-next-attack") };
  if (id === "DDB-GEA-CORE-010") return { kind: "zone-attack", power: 0, piercing: amountOf(effects, "equipment-gea-010-chosen-zone-piercing"), blockedFocus: amountOf(effects, "equipment-gea-010-chosen-zone-blocked-focus"), requireDifferentPreviousZone: false };
  if (id === "DDB-GEA-CORE-024") return { kind: "zone-attack", power: amountOf(effects, "equipment-gea-024-different-zone-power"), piercing: 0, blockedFocus: 0, requireDifferentPreviousZone: true };
  if (id === "DDB-GEA-CORE-004") return { kind: "incoming-zone-penalty", attackPowerPenalty: Math.abs(amountOf(effects, "equipment-gea-004-chosen-zone-attack-penalty")) };
  if (id === "DDB-GEA-CORE-009") return { kind: "defense-guard", guard: amountOf(effects, "equipment-gea-009-outside-turn-defense-guard"), reversalPower: amountOf(effects, "equipment-gea-009-green-block-reversal") };
  if (id === "DDB-GEA-CORE-005") return { kind: "initiate-tempo-focus", focus: amountOf(effects, "equipment-gea-005-tempo-initiate-focus") };
  if (id === "DDB-GEA-CORE-001") return { kind: "after-kata-focus", focus: amountOf(effects, "equipment-gea-001-after-kata-focus") };
  if (id === "DDB-GEA-CORE-022") return { kind: "first-hit-discard-focus", discard: amountOf(effects, "equipment-gea-022-first-hit-discard"), focus: amountOf(effects, "equipment-gea-022-first-hit-focus") };
  if (id === "DDB-WPN-CORE-057") return { kind: "hit-direct-damage", damage: amountOf(effects, "equipment-wpn-057-hit-direct-damage") };
  if (id === "DDB-GEA-CORE-023") return { kind: "hit-next-initiate-focus", focus: amountOf(effects, "equipment-gea-023-next-initiate-focus") };
  if (id === "DDB-WPN-CORE-046") return { kind: "numbered-attack-power", attackNumber: Number(equipmentConditionValue(effectById(effects, "equipment-wpn-046-orange-second-normal-power") ?? {}, "attackNumber") ?? 2), power: amountOf(effects, "equipment-wpn-046-orange-second-normal-power"), minBelt: String(equipmentConditionValue(effectById(effects, "equipment-wpn-046-orange-second-normal-power") ?? {}, "minimumBelt") ?? "Orange") };
  return null;
}

export function structuredMandatoryDamageReduction(card: EquipmentCardLike) {
  const effects = structuredEquipmentEffects(card);
  if (!effects) return undefined;
  const reduction = effectById(effects, "equipment-deq-003-first-damage-reduction");
  if (!reduction) return null;
  return { reduce: Number(reduction.amount ?? 0), readyAtInitiate: Boolean(effectById(effects, "equipment-deq-003-next-initiate-ready")) };
}

export function structuredOptionalDamageReduction(card: EquipmentCardLike) {
  const effects = structuredEquipmentEffects(card);
  if (!effects) return undefined;
  const reduction = effectById(effects, "equipment-deq-014-combat-damage-reduction");
  if (!reduction) return null;
  const ready = effectById(effects, "equipment-deq-014-green-hide-ready");
  return { reduce: Number(reduction.amount ?? 0), readyAtHideMinBelt: String(equipmentConditionValue(ready ?? {}, "minimumBelt") ?? "Green"), readyAtHideMinDamage: Number(equipmentConditionValue(ready ?? {}, "incomingDamageAtLeast") ?? 3) };
}

export function structuredPostBlockCycle(card: EquipmentCardLike) {
  const effects = structuredEquipmentEffects(card);
  if (!effects) return undefined;
  const choice = effects.find((effect) => {
    if (effect.effect !== "core.choice" || effect.trigger !== "onBlock") return false;
    const kinds = new Set((effect.conditions ?? []).map((condition) => String(condition.kind ?? "")));
    return kinds.has("draw") && kinds.has("discard") && kinds.has("defenseHasTag");
  });
  if (choice) {
    const zones = equipmentConditionValue(choice, "incomingZones");
    return {
      minBelt: "White",
      zone: Array.isArray(zones) ? String(zones[0] ?? "") : "",
      defenseTag: String(equipmentConditionValue(choice, "defenseHasTag") ?? ""),
      draw: Number(equipmentConditionValue(choice, "draw") ?? 0),
      discard: Number(equipmentConditionValue(choice, "discard") ?? 0),
    };
  }
  const draw = effectById(effects, "equipment-deq-020-blue-high-block-draw");
  const discard = effectById(effects, "equipment-deq-020-blue-high-block-discard");
  if (!draw || !discard) return null;
  const zones = equipmentConditionValue(draw, "incomingZones");
  return { minBelt: String(equipmentConditionValue(draw, "minimumBelt") ?? "Blue"), zone: Array.isArray(zones) ? String(zones[0] ?? "High") : "High", draw: Number(draw.amount ?? 0), discard: Number(discard.amount ?? 0) };
}

export function structuredOnEquipPlan(card: EquipmentCardLike, enteringCard?: EquipmentCardLike, context: { sourceActivationArmed?: boolean; beltName?: string } = {}) {
  const effects = structuredEquipmentEffects(card);
  if (!effects) return undefined;
  const values = {
    equippedCardIsSource: equipmentCatalogId(card) === equipmentCatalogId(enteringCard ?? card),
    equippedCardIsOtherPermanentEquipment: Boolean(enteringCard && equipmentCatalogId(card) !== equipmentCatalogId(enteringCard)),
    equippedCardSubtype: enteringCard?.subtype ?? "",
    equippedThisTurn: Boolean(enteringCard),
    sourceActivationArmed: Boolean(context.sourceActivationArmed),
  };
  let readyOther = 0;
  let exhaustSource = false;
  let draw = 0;
  let discard = 0;
  let nextAttackPower = 0;
  const unsupported: string[] = [];
  for (const effect of effects.filter((candidate) => candidate.trigger === "onEquip")) {
    const minimumBelt = equipmentConditionValue(effect, "minimumBelt");
    if (minimumBelt && !beltAtLeast(context.beltName, minimumBelt)) continue;
    if (!equipmentConditionsMatch(effect, values)) continue;
    if (effect.effect === "equipment.ready" && effect.target === "chosen-equipment") readyOther += Number(effect.amount ?? 1);
    else if (effect.effect === "equipment.exhaust" && effect.target === "source") exhaustSource = true;
    else if (effect.effect === "core.draw") draw += Number(effect.amount ?? 0);
    else if (effect.effect === "core.discard") discard += Number(effect.amount ?? 0);
    else if (effect.effect === "combat.modifyAttackPower" && effect.duration === "nextAttack") nextAttackPower += Number(effect.amount ?? 0);
    else unsupported.push(effect.id ?? "unknown-on-equip-effect");
  }
  return { readyOther, exhaustSource, draw, discard, nextAttackPower, unsupported };
}

export type EquipmentRuntimeResolution = {
  handled: boolean;
  matched: EquipmentRegistryEffect[];
  unsupported: string[];
};

const explicitlyImplementedCustomIds = new Set([
  "equipment-deq-001-no-two-handed-weapon",
  "equipment-deq-006-destroy-after-two-preventions",
  "equipment-deq-007-once-game-zero-attack",
  "equipment-deq-012-low-hp-untargetable",
  "equipment-deq-018-hide-draw-penalty",
  "equipment-deq-025-first-swap-discard",
  "equipment-deq-027-discard-return-hand",
  "equipment-deq-030-first-target-discard-or-retarget",
  "equipment-deq-032-lowest-xp-extra-defense",
  "equipment-deq-040-once-game-prevent-all-damage",
  "equipment-deq-042-armor-block-mark-exam",
  "equipment-deq-046-once-game-ignore-speed-penalty",
  "equipment-gea-007-zero-focus-upgrade",
  "equipment-gea-008-reduce-forced-discard",
  "equipment-gea-014-ignore-first-negative-combat-modifier",
  "equipment-wpn-006-delayed-direct-damage",
  "equipment-wpn-014-low-hit-speed-penalty",
  "equipment-wpn-018-speed-floor-2",
  "equipment-wpn-038-healing-suppression",
  "equipment-wpn-051-reaction-defense",
  "equipment-wpn-052-hit-speed-penalty",
  "equipment-wpn-058-hit-defense-until-next-initiate",
  "equipment-wpn-061-punch-counts-unarmed",
  "equipment-wpn-064-hit-spend-target-tempo"
]);

export function resolveStructuredEquipmentEvent(card: EquipmentCardLike, trigger: string, context: Record<string, unknown> = {}): EquipmentRuntimeResolution {
  const effects = structuredEquipmentEffects(card);
  if (!effects) return { handled: false, matched: [], unsupported: [] };
  const matched: EquipmentRegistryEffect[] = [];
  const unsupported: string[] = [];
  for (const effect of effects.filter((candidate) => candidate.trigger === trigger || (trigger === "passive" && candidate.trigger === "passive"))) {
    if (!equipmentConditionsMatch(effect, context)) continue;
    matched.push(effect);
    if (effect.effect === "core.custom" && !explicitlyImplementedCustomIds.has(String(effect.id ?? ""))) unsupported.push(String(effect.id ?? "unknown-custom-equipment-effect"));
  }
  return { handled: true, matched, unsupported };
}

export type EquipmentHitContext = {
  attackNumber: number;
  attackZone: string;
  attackTags?: string[];
  combatDamageDealt: number;
  firstHitThisTurn: boolean;
  firstQualifyingHitThisTurn?: boolean;
  attackUsesSourceEquipment?: boolean;
  usedEffectIdsThisTurn?: string[];
  usedEffectIdsThisRound?: string[];
};

export type EquipmentHitResolution = {
  handled: boolean;
  focus: number;
  draw: number;
  nextAttackPower: number;
  grantFlow: boolean;
  directDamage: number;
  exhaustSourceIds: string[];
  matchedEffectIds: string[];
  unsupported: string[];
};

export type EquipmentBlockContext = {
  incomingZone: string;
  incomingAttackUsesWeapon?: boolean;
  incomingAttackTags?: string[];
  defenseTags?: string[];
  sourceArmorHelpedBlock?: boolean;
  firstArmorBlockThisRound?: boolean;
  defenderPlayedDefense?: boolean;
  sameOpponentAsBlockedAttack?: boolean;
  armedEquipmentZoneMatched?: boolean;
  sameRoundOnly?: boolean;
  sameTurnOnly?: boolean;
  nextAttackDifferentZone?: boolean;
  beltName?: string;
  usedEffectIdsThisTurn?: string[];
  usedEffectIdsThisRound?: string[];
};

export type EquipmentBlockResolution = {
  handled: boolean;
  focus: number;
  draw: number;
  nextAttackPower: number;
  nextAttackDifferentFromZones: string[];
  nextAttackPiercing: number;
  speed: number;
  purchaseDiscount: number;
  minimumFinalCost: number;
  opponentFocusLoss: number;
  exhaustSourceIds: string[];
  matchedEffectIds: string[];
  unsupported: string[];
};

const BLOCK_RUNTIME_CONDITIONS = new Set([
  "incomingZones",
  "incomingAttackUsesWeapon",
  "incomingAttackTags",
  "defenseHasTag",
  "sourceArmorHelpedBlock",
  "firstArmorBlockThisRound",
  "defenderPlayedDefense",
  "sameOpponentAsBlockedAttack",
  "armedEquipmentZoneMatched",
  "sameRoundOnly",
  "sameTurnOnly",
  "nextAttackDifferentZone",
  "minimumBelt",
  "oncePerTurn",
  "oncePerRound",
  "nextPurchaseOnly",
  "minimumFinalCost",
  "choiceKind",
  "draw",
  "discard",
]);

/** Resolves the choice-free Equipment effects published after a Block. */
export function structuredEquipmentBlockResolution(cards: EquipmentCardLike[], context: EquipmentBlockContext): EquipmentBlockResolution {
  const result: EquipmentBlockResolution = {
    handled: false,
    focus: 0,
    draw: 0,
    nextAttackPower: 0,
    nextAttackDifferentFromZones: [],
    nextAttackPiercing: 0,
    speed: 0,
    purchaseDiscount: 0,
    minimumFinalCost: 0,
    opponentFocusLoss: 0,
    exhaustSourceIds: [],
    matchedEffectIds: [],
    unsupported: [],
  };
  for (const card of cards) {
    const effects = structuredEquipmentEffects(card);
    if (!effects) continue;
    result.handled = true;
    for (const effect of effects.filter((candidate) => candidate.trigger === "onBlock")) {
      const effectId = String(effect.id ?? "unknown-equipment-block-effect");
      const unknown = (effect.conditions ?? []).filter((condition) => !BLOCK_RUNTIME_CONDITIONS.has(String(condition.kind ?? "")));
      if (unknown.length) {
        result.unsupported.push(effectId);
        continue;
      }
      const values = {
        ...context,
        incomingZone: context.incomingZone,
        incomingZones: [context.incomingZone],
        incomingAttackTags: context.incomingAttackTags ?? [],
        defenseHasTag: context.defenseTags ?? [],
        oncePerTurn: !(context.usedEffectIdsThisTurn ?? []).includes(effectId),
        oncePerRound: !(context.usedEffectIdsThisRound ?? []).includes(effectId),
      };
      if (!equipmentConditionsMatch(effect, values)) continue;
      const amount = Number(effect.amount ?? 0);
      let applied = true;
      if (effect.effect === "core.gainFocus" && effect.target === "self") result.focus += amount;
      else if (effect.effect === "core.draw" && effect.target === "self") result.draw += amount;
      else if (effect.effect === "combat.modifyAttackPower" && effect.target === "self" && effect.duration === "nextAttack") {
        result.nextAttackPower += amount;
        if (effect.conditions?.some((condition) => condition.kind === "nextAttackDifferentZone")) result.nextAttackDifferentFromZones.push(context.incomingZone);
      }
      else if (effect.effect === "combat.piercing" && effect.target === "self" && effect.duration === "nextAttack") result.nextAttackPiercing += amount;
      else if (effect.effect === "combat.modifySpeed" && effect.target === "self" && effect.duration === "endOfRound") result.speed += amount;
      else if (effect.effect === "economy.modifyCost" && effect.target === "self" && effect.conditions?.some((condition) => condition.kind === "nextPurchaseOnly")) {
        result.purchaseDiscount += amount;
        result.minimumFinalCost = Math.max(result.minimumFinalCost, Number(equipmentConditionValue(effect, "minimumFinalCost") ?? 0));
      } else if (effect.effect === "economy.spendFocus" && effect.target === "opponent") result.opponentFocusLoss += Math.max(0, amount);
      else if (effect.effect === "equipment.exhaust" && effect.target === "source") result.exhaustSourceIds.push(String(card.id ?? card.catalogId ?? ""));
      else applied = false;
      if (applied) result.matchedEffectIds.push(effectId);
      else result.unsupported.push(effectId);
    }
  }
  return result;
}

const HIT_RUNTIME_CONDITIONS = new Set([
  "attackNumber",
  "attackZone",
  "attackTags",
  "attackHasTag",
  "attackHasAnyTag",
  "attackZones",
  "attackUsesSourceEquipment",
  "combatDamageDealt",
  "firstHitThisTurn",
  "firstQualifyingHitThisTurn",
  "firstHitWithSourceThisTurn",
  "firstHitWithSourceThisRound",
  "firstCombatDamageWithSourceThisTurn",
  "oncePerTurn",
  "oncePerRound",
]);

/**
 * Resolves the non-choice Equipment effects that occur after a successful Hit.
 * Effects requiring a discard, pending source, or delayed watcher remain
 * explicitly unsupported so the host never silently grants a partial payoff.
 */
export function structuredEquipmentHitResolution(cards: EquipmentCardLike[], context: EquipmentHitContext): EquipmentHitResolution {
  const result: EquipmentHitResolution = {
    handled: false,
    focus: 0,
    draw: 0,
    nextAttackPower: 0,
    grantFlow: false,
    directDamage: 0,
    exhaustSourceIds: [],
    matchedEffectIds: [],
    unsupported: [],
  };
  for (const card of cards) {
    const effects = structuredEquipmentEffects(card);
    if (!effects) continue;
    result.handled = true;
    const hitEffects = effects.filter((effect) => effect.trigger === "onHit");
    if (!hitEffects.length) continue;
    if (hitEffects.some((effect) => effect.effect === "core.discard")) {
      result.unsupported.push(...hitEffects.map((effect) => String(effect.id ?? "unknown-equipment-hit-effect")));
      continue;
    }
    if (structuredEquipmentActivationPlan(card)) continue;
    for (const effect of hitEffects) {
      const effectId = String(effect.id ?? "unknown-equipment-hit-effect");
      if ((effect.conditions ?? []).some((condition) => !HIT_RUNTIME_CONDITIONS.has(String(condition.kind ?? "")))) {
        result.unsupported.push(effectId);
        continue;
      }
      const requiredTag = equipmentConditionValue(effect, "attackHasTag");
      if (requiredTag != null && !includesTag(tagsOf(context.attackTags), requiredTag)) continue;
      const usedThisTurn = context.usedEffectIdsThisTurn ?? [];
      const usedThisRound = context.usedEffectIdsThisRound ?? [];
      const firstSourceHitThisTurn = !usedThisTurn.includes(effectId);
      const firstSourceHitThisRound = !usedThisRound.includes(effectId);
      const values = {
        ...context,
        attackHasTag: context.attackTags ?? [],
        attackHasAnyTag: context.attackTags ?? [],
        firstQualifyingHitThisTurn: context.firstQualifyingHitThisTurn ?? firstSourceHitThisTurn,
        firstHitWithSourceThisTurn: firstSourceHitThisTurn,
        firstHitWithSourceThisRound: firstSourceHitThisRound,
        firstCombatDamageWithSourceThisTurn: firstSourceHitThisTurn,
        oncePerTurn: !usedThisTurn.includes(effectId),
        oncePerRound: !usedThisRound.includes(effectId),
      };
      if (!equipmentConditionsMatch(effect, values)) continue;
      const amount = Number(effect.amount ?? 0);
      let applied = true;
      if (effect.effect === "core.gainFocus" && effect.target === "self") result.focus += amount;
      else if (effect.effect === "core.draw" && effect.target === "self") result.draw += amount;
      else if (effect.effect === "combat.modifyAttackPower" && effect.target === "source" && effect.duration === "nextAttack") result.nextAttackPower += amount;
      else if (effect.effect === "combat.grantFlow" && effect.target === "self" && effect.duration === "nextAttack") result.grantFlow = true;
      else if (effect.effect === "combat.dealDamage" && effect.target === "opponent") result.directDamage += amount;
      else if (effect.effect === "equipment.exhaust" && effect.target === "source") result.exhaustSourceIds.push(String(card.id ?? card.catalogId ?? ""));
      else applied = false;
      if (applied) result.matchedEffectIds.push(effectId);
      else result.unsupported.push(effectId);
    }
  }
  return result;
}

export type EquipmentAfterResolveContext = {
  resolvedCardType: string;
  defenderPlayedDefense?: boolean;
  goldBeltExamThirdZone?: boolean;
  usedEffectIdsThisTurn?: string[];
  usedEffectIdsThisRound?: string[];
};

export type EquipmentAfterResolveResolution = {
  handled: boolean;
  focus: number;
  draw: number;
  exhaustSourceIds: string[];
  matchedEffectIds: string[];
  unsupported: string[];
};

const AFTER_RESOLVE_RUNTIME_CONDITIONS = new Set([
  "resolvedCardType",
  "defenderPlayedDefense",
  "goldBeltExamThirdZone",
  "minimumBelt",
  "oncePerTurn",
  "oncePerRound",
]);

/** Resolves non-choice Equipment watchers after a card has completed. */
export function structuredEquipmentAfterResolveResolution(cards: EquipmentCardLike[], context: EquipmentAfterResolveContext): EquipmentAfterResolveResolution {
  const result: EquipmentAfterResolveResolution = { handled: false, focus: 0, draw: 0, exhaustSourceIds: [], matchedEffectIds: [], unsupported: [] };
  for (const card of cards) {
    const effects = structuredEquipmentEffects(card);
    if (!effects) continue;
    result.handled = true;
    const afterResolveEffects = effects.filter((candidate) => candidate.trigger === "afterResolve");
    if (afterResolveEffects.some((effect) => effect.effect === "core.discard")) {
      result.unsupported.push(...afterResolveEffects.map((effect) => String(effect.id ?? "unknown-equipment-after-resolve-effect")));
      continue;
    }
    for (const effect of afterResolveEffects) {
      const effectId = String(effect.id ?? "unknown-equipment-after-resolve-effect");
      if ((effect.conditions ?? []).some((condition) => !AFTER_RESOLVE_RUNTIME_CONDITIONS.has(String(condition.kind ?? "")))) {
        result.unsupported.push(effectId);
        continue;
      }
      const usedThisTurn = context.usedEffectIdsThisTurn ?? [];
      const usedThisRound = context.usedEffectIdsThisRound ?? [];
      const values = {
        ...context,
        resolvedCardType: context.resolvedCardType,
        defenderPlayedDefense: Boolean(context.defenderPlayedDefense),
        goldBeltExamThirdZone: Boolean(context.goldBeltExamThirdZone),
        oncePerTurn: !usedThisTurn.includes(effectId),
        oncePerRound: !usedThisRound.includes(effectId),
      };
      if (!equipmentConditionsMatch(effect, values)) continue;
      let applied = true;
      if (effect.effect === "core.gainFocus" && effect.target === "self") result.focus += Number(effect.amount ?? 0);
      else if (effect.effect === "core.draw" && effect.target === "self") result.draw += Number(effect.amount ?? 0);
      else if (effect.effect === "equipment.exhaust" && effect.target === "source") result.exhaustSourceIds.push(String(card.id ?? card.catalogId ?? ""));
      else applied = false;
      if (applied) result.matchedEffectIds.push(effectId);
      else result.unsupported.push(effectId);
    }
  }
  return result;
}

export type EquipmentPurchaseContext = {
  marketEndSlot?: boolean;
  purchasedCardCost: number;
  purchaseCompleted: boolean;
  exhaustedEquipmentIds?: string[];
  usedEffectIdsThisTurn?: string[];
};

export type EquipmentPurchaseResolution = {
  handled: boolean;
  purchaseDiscount: number;
  minimumFinalCost: number;
  exhaustSourceIds: string[];
  choiceRequired: boolean;
  matchedEffectIds: string[];
  unsupported: string[];
};

const PURCHASE_RUNTIME_CONDITIONS = new Set([
  "marketEndSlot",
  "nextPurchaseOnly",
  "minimumFinalCost",
  "purchasedCardCost",
  "purchaseCompleted",
  "oncePerTurn",
]);

/** Resolves choice-free Equipment effects surrounding a Market purchase. */
export function structuredEquipmentPurchaseResolution(cards: EquipmentCardLike[], context: EquipmentPurchaseContext): EquipmentPurchaseResolution {
  const result: EquipmentPurchaseResolution = { handled: false, purchaseDiscount: 0, minimumFinalCost: 0, exhaustSourceIds: [], choiceRequired: false, matchedEffectIds: [], unsupported: [] };
  for (const card of cards) {
    const effects = structuredEquipmentEffects(card);
    if (!effects) continue;
    result.handled = true;
    if ((context.exhaustedEquipmentIds ?? []).includes(String(card.id ?? card.catalogId ?? ""))) continue;
    const purchaseEffects = effects.filter((candidate) => candidate.trigger === "onPurchase");
    if (!purchaseEffects.length) continue;
    for (const effect of purchaseEffects) {
      const effectId = String(effect.id ?? "unknown-equipment-purchase-effect");
      if ((effect.conditions ?? []).some((condition) => !PURCHASE_RUNTIME_CONDITIONS.has(String(condition.kind ?? "")))) {
        result.unsupported.push(effectId);
        continue;
      }
      const values = {
        ...context,
        marketEndSlot: Boolean(context.marketEndSlot),
        purchasedCardCost: context.purchasedCardCost,
        purchaseCompleted: Boolean(context.purchaseCompleted),
        oncePerTurn: !(context.usedEffectIdsThisTurn ?? []).includes(effectId),
      };
      if (!equipmentConditionsMatch(effect, values)) continue;
      let applied = true;
      if (effect.effect === "economy.modifyCost" && effect.target === "chosen-card") {
        result.purchaseDiscount += Number(effect.amount ?? 0);
        result.minimumFinalCost = Math.max(result.minimumFinalCost, Number(equipmentConditionValue(effect, "minimumFinalCost") ?? 0));
      } else if (effect.effect === "equipment.exhaust" && effect.target === "source" && context.purchaseCompleted) {
        result.exhaustSourceIds.push(String(card.id ?? card.catalogId ?? ""));
      } else if (effect.effect === "core.moveCard" && effect.target === "chosen-card" && context.purchaseCompleted) {
        result.choiceRequired = true;
      } else if (effect.effect === "economy.modifyCost") {
        result.unsupported.push(effectId);
        applied = false;
      } else if (effect.effect === "equipment.exhaust") {
        // Source exhaustion is a post-purchase lifecycle action. The preflight
        // pass only exposes discounts and must not mutate the board.
        applied = false;
      } else applied = false;
      if (applied) result.matchedEffectIds.push(effectId);
      else if (effect.effect !== "equipment.exhaust" && effect.effect !== "core.moveCard") result.unsupported.push(effectId);
    }
  }
  return result;
}
