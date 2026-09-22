import cardEffectsJson from "./data/card-effects.json" with { type: "json" };
import { isSupportedCharacterResolver } from "./character-effect-resolvers.ts";
import { isSupportedDefenseResolver } from "./defense-effect-resolvers.ts";
import { isSupportedConsumableResolver } from "./consumable-effect-resolvers.ts";
import { SUPPORTED_KATA_RESOLVERS } from "./kata-effect-resolvers.ts";
import { isSupportedComboResolver } from "./combo-runtime.ts";
import { isReactionItemResolverSupported } from "./reaction-item-runtime.ts";
import { isSupportedBossResolver } from "./boss-runtime.ts";

export type EffectTiming = "onPlay" | "onHit" | "onBlock" | "afterResolve";
export type EffectKind = "draw" | "discard" | "heal" | "focus" | "speed" | "nextAttackPower";
export type CardEffect = { timing: EffectTiming; kind: EffectKind; amount: number };
export type CardEffectPlan = { effects: CardEffect[]; dedicated: string[]; unsupported: string[]; source?: "structured" | "unstructured" };

export type StructuredEffectTrigger =
  | EffectTiming
  | "onEquip"
  | "onPurchase"
  | "onInitiate"
  | "onHide"
  | "onAttackDeclared"
  | "onDefenseDeclared"
  | "passive";

export type StructuredEffectAction =
  | "draw"
  | "discard"
  | "heal"
  | "gainFocus"
  | "modifySpeed"
  | "modifyAttackPower"
  | "modifyGuard"
  | "dealDamage"
  | "piercing"
  | "destroy"
  | "ready"
  | "exhaust"
  | "preventDamage"
  | "chooseZone"
  | "custom";

export type StructuredEffectTarget = "self" | "opponent" | "source" | "chosen-card" | "chosen-equipment";
export type StructuredEffectDuration =
  | "immediate"
  | "nextAttack"
  | "nextDefense"
  | "nextDamage"
  | "nextTurn"
  | "nextInitiate"
  | "nextPurchase"
  | "nextKata"
  | "endOfTurn"
  | "endOfRound"
  | "nextHonor"
  | "whileEquipped";
export type StructuredEffectCondition = {
  kind: string;
  value?: string | number | boolean | string[] | number[];
  operator?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "includes" | "notIncludes";
};

export type StructuredCardEffect = {
  id?: string;
  effect?: string;
  trigger: StructuredEffectTrigger;
  action?: StructuredEffectAction;
  target?: StructuredEffectTarget;
  amount?: number;
  duration?: StructuredEffectDuration;
  conditions?: StructuredEffectCondition[];
  resolver?: string;
};

export type StructuredCardLike = {
  catalogId?: string | null;
  effects?: StructuredCardEffect[] | null;
};

export type StructuredEffectRegistry = {
  cards?: Record<string, { name?: string; effects: StructuredCardEffect[] }>;
};

const TIMING_LABELS: Record<EffectTiming, string> = {
  onPlay: "on play",
  onHit: "on Hit",
  onBlock: "on Block",
  afterResolve: "after resolution",
};

const IMPLEMENTED_DEDICATED_RESOLVERS = new Set([
  "starter.gainFocusIfFastest",
  "attack.chooseAnyZone",
  "attack.conditionalPower",
  "attack.piercing",
  "attack.targetNextAttackPenalty",
  "attack.targetSpeedPenaltyUntilHonor",
  "attack.readyEquipmentOnHit",
  "attack.optionalDiscardDraw",
  "attack.grantNextAttackFlow",
  "attack.currentAttackFlow",
  "attack.conditionalFocus",
  "attack.grantNextAttackAnyZone",
  "attack.afterDefensePower",
  "attack.conditionalCycle",
  "attack.nextAttackArmorPenalty",
  "attack.final.alternateZone",
  "attack.final.equipmentSuppression",
  "attack.final.focus",
  "attack.final.power",
  "attack.final.hitChoice",
  "attack.final.defensiveReaction",
  "attack.final.comboMultiplicity",
  "attack.final.fireDrillFeint",
  "attack.final.cycle",
  "attack.final.onlyAttackLock",
  "attack.final.optionalAttackCost",
  "equipment.structured",
  "location.structured",
]);

const GENERIC_CANONICAL_EFFECTS = new Set([
  "core.draw",
  "core.discard",
  "core.heal",
  "core.gainFocus",
  "core.gainXP",
  "core.destroy",
  "core.reveal",
  "combat.modifySpeed",
  "combat.modifyAttackPower",
  "combat.modifyDefense",
  "combat.modifyGuard",
  "combat.preventDamage",
  "combat.dealDamage",
  "combat.grantFlow",
  "combat.chooseZone",
  "economy.modifyCost",
  "equipment.ready",
  "equipment.exhaust",
]);

const runtimeRegistry = cardEffectsJson as unknown as StructuredEffectRegistry;

function canonicalEffectName(effect: StructuredCardEffect) {
  if (effect.effect) return effect.effect;
  const action = effect.action;
  return action === "draw" ? "core.draw"
    : action === "discard" ? "core.discard"
      : action === "heal" ? "core.heal"
        : action === "gainFocus" ? "core.gainFocus"
          : action === "modifySpeed" ? "combat.modifySpeed"
            : action === "modifyAttackPower" ? "combat.modifyAttackPower"
              : action ?? "";
}

function legacyEffectFromStructured(effect: StructuredCardEffect): CardEffect | null {
  if (effect.resolver || effect.conditions?.length) return null;
  if (!["onPlay", "onHit", "onBlock", "afterResolve"].includes(effect.trigger)) return null;
  const timing = effect.trigger as EffectTiming;
  const effectAmount = Number(effect.amount ?? 0);
  if (!Number.isFinite(effectAmount)) return null;
  const canonical = canonicalEffectName(effect);
  if (canonical === "core.draw") return { timing, kind: "draw", amount: effectAmount };
  if (canonical === "core.discard" && (effect.target ?? "self") === "self") return { timing, kind: "discard", amount: effectAmount };
  if (canonical === "core.heal" && (effect.target ?? "self") === "self") return { timing, kind: "heal", amount: effectAmount };
  if (canonical === "core.gainFocus" && (effect.target ?? "self") === "self") return { timing, kind: "focus", amount: effectAmount };
  if (canonical === "combat.modifySpeed" && (effect.target ?? "self") === "self") return { timing, kind: "speed", amount: effectAmount };
  if (canonical === "combat.modifyAttackPower" && effect.duration === "nextAttack" && (effect.target ?? "self") === "self") return { timing, kind: "nextAttackPower", amount: effectAmount };
  return null;
}

function isImplementedDedicatedResolver(resolver: string) {
  return IMPLEMENTED_DEDICATED_RESOLVERS.has(resolver)
    || SUPPORTED_KATA_RESOLVERS.has(resolver)
    || isSupportedComboResolver(resolver)
    || isReactionItemResolverSupported(resolver)
    || isSupportedCharacterResolver(resolver)
    || isSupportedDefenseResolver(resolver)
    || isSupportedConsumableResolver(resolver)
    || isSupportedBossResolver(resolver);
}

function planFromStructuredEffects(structuredEffects: StructuredCardEffect[]): CardEffectPlan {
  const effects: CardEffect[] = [];
  const dedicated: string[] = [];
  const unsupported: string[] = [];
  for (const effect of structuredEffects) {
    const compatible = legacyEffectFromStructured(effect);
    if (compatible) {
      effects.push(compatible);
      continue;
    }
    if (effect.resolver && isImplementedDedicatedResolver(effect.resolver)) {
      dedicated.push(effect.resolver);
      continue;
    }
    const canonical = canonicalEffectName(effect);
    if (!effect.resolver && !effect.conditions?.length && GENERIC_CANONICAL_EFFECTS.has(canonical)) {
      dedicated.push(canonical);
      continue;
    }
    unsupported.push(effect.id ?? `${effect.trigger}:${canonical || "unknown"}`);
  }
  return { effects, dedicated, unsupported, source: "structured" };
}

export function compileCardEffects(text = ""): CardEffectPlan {
  const normalized = String(text ?? "").trim();
  return {
    effects: [],
    dedicated: [],
    unsupported: normalized ? ["missing-canonical-structured-entry"] : [],
    source: "unstructured",
  };
}

export function structuredEffectsForCard(card: StructuredCardLike, registry?: StructuredEffectRegistry): StructuredCardEffect[] | null {
  if (Array.isArray(card.effects)) return card.effects;
  const catalogId = String(card.catalogId ?? "").trim();
  if (!catalogId) return null;
  const activeRegistry = registry ?? runtimeRegistry;
  const entry = activeRegistry.cards?.[catalogId];
  return entry && Array.isArray(entry.effects) ? entry.effects : null;
}

export function effectPlanForCard(card: StructuredCardLike, registry?: StructuredEffectRegistry): CardEffectPlan {
  const structuredEffects = structuredEffectsForCard(card, registry);
  if (structuredEffects) return planFromStructuredEffects(structuredEffects);
  return compileCardEffects(String(card.catalogId ?? ""));
}

export function describeEffectPlan(plan: CardEffectPlan) {
  const dedicated = plan.dedicated ?? [];
  if (!plan.effects.length && !dedicated.length && !plan.unsupported.length && plan.source === "structured") return "Structured resolver: no additional executable effect.";
  if (!plan.effects.length && dedicated.length && !plan.unsupported.length) return `Structured resolver: ${dedicated.join(", ")}.`;
  if (!plan.effects.length) return "Printed effect is queued for a dedicated resolver; its exact text is shown in the Card Inspector.";
  const kinds = [...new Set(plan.effects.map((effect) => `${TIMING_LABELS[effect.timing]} ${effect.kind}`))];
  const dedicatedText = dedicated.length ? ` Dedicated: ${dedicated.join(", ")}.` : "";
  const remaining = plan.unsupported.length ? ` ${plan.unsupported.length} conditional clause${plan.unsupported.length === 1 ? " remains" : "s remain"} queued.` : "";
  const prefix = plan.source === "structured" ? "Structured resolver" : "Engine resolver";
  return `${prefix}: ${kinds.join(", ")}.${dedicatedText}${remaining}`;
}

export function effectCoverage(cards: StructuredCardLike[], registry?: StructuredEffectRegistry) {
  const structured = cards.filter((card) => structuredEffectsForCard(card, registry) !== null);
  const relevant = structured;
  const full = relevant.filter((card) => {
    const plan = effectPlanForCard(card, registry);
    const resolved = plan.effects.length + (plan.dedicated?.length ?? 0);
    return resolved > 0 && plan.unsupported.length === 0;
  });
  const partial = relevant.filter((card) => {
    const plan = effectPlanForCard(card, registry);
    const resolved = plan.effects.length + (plan.dedicated?.length ?? 0);
    return resolved > 0 && plan.unsupported.length > 0;
  });
  return { total: relevant.length, structured: structured.length, full: full.length, partial: partial.length, queued: relevant.length - full.length - partial.length };
}
