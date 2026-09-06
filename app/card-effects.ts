import cardsJson from "./data/cards.json" with { type: "json" };
import cardEffectsJson from "./data/card-effects.json" with { type: "json" };
import { isSupportedCharacterResolver } from "./character-effect-resolvers.ts";

export type EffectTiming = "onPlay" | "onHit" | "onBlock" | "afterResolve";
export type EffectKind = "draw" | "discard" | "heal" | "focus" | "speed" | "nextAttackPower";
export type CardEffect = { timing: EffectTiming; kind: EffectKind; amount: number };
export type CardEffectPlan = { effects: CardEffect[]; dedicated: string[]; unsupported: string[]; source?: "structured" | "legacy-parser" };

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
export type StructuredEffectDuration = "immediate" | "nextAttack" | "nextDefense" | "endOfTurn" | "endOfRound" | "nextHonor" | "whileEquipped";
export type StructuredEffectCondition = {
  kind: string;
  value?: string | number | boolean | string[] | number[];
  operator?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "includes" | "notIncludes";
};

export type StructuredCardEffect = {
  id?: string;
  trigger: StructuredEffectTrigger;
  action: StructuredEffectAction;
  target?: StructuredEffectTarget;
  amount?: number;
  duration?: StructuredEffectDuration;
  conditions?: StructuredEffectCondition[];
  resolver?: string;
};

export type StructuredCardLike = {
  catalogId?: string | null;
  rulesText?: string | null;
  effects?: StructuredCardEffect[] | null;
};

export type StructuredEffectRegistry = {
  cards?: Record<string, { name?: string; effects: StructuredCardEffect[] }>;
};

type RuntimeCardCatalog = {
  cards?: { catalogId?: string | null; rulesText?: string | null }[];
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
]);

const runtimeRegistry = cardEffectsJson as unknown as StructuredEffectRegistry;
const runtimeCards = cardsJson as unknown as RuntimeCardCatalog;
const structuredEffectsByRulesText = new Map<string, StructuredCardEffect[]>();
const ambiguousStructuredRulesText = new Set<string>();

function normalizedRulesText(text: unknown) {
  return String(text ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

for (const card of runtimeCards.cards ?? []) {
  const catalogId = String(card.catalogId ?? "").trim();
  const text = normalizedRulesText(card.rulesText);
  const effects = catalogId ? runtimeRegistry.cards?.[catalogId]?.effects : null;
  if (!text || !Array.isArray(effects)) continue;
  const existing = structuredEffectsByRulesText.get(text);
  if (existing && JSON.stringify(existing) !== JSON.stringify(effects)) {
    ambiguousStructuredRulesText.add(text);
    structuredEffectsByRulesText.delete(text);
    continue;
  }
  if (!ambiguousStructuredRulesText.has(text)) structuredEffectsByRulesText.set(text, effects);
}

function amount(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : 0;
}

function sentenceTiming(sentence: string): EffectTiming | null {
  if (/^(?:if (?:this|it|that (?:Attack|Defense)) Blocks?|when (?:this|that) Blocks?)/i.test(sentence)) return "onBlock";
  if (/^(?:on Hit|if (?:this Attack|it|that Attack) Hits?|when (?:this|that) Hits?)/i.test(sentence)) return "onHit";
  if (/^after (?:this|it|that (?:card|Attack|Defense)) resolves/i.test(sentence)) return "afterResolve";
  if (/^(?:Draw|Discard|Gain|Heal|Lose|Your next|The next|Use\s*[:—-])/i.test(sentence)) return "onPlay";
  return null;
}

function operationsForSentence(sentence: string, timing: EffectTiming): CardEffect[] {
  const effects: CardEffect[] = [];
  const draw = amount(/draw (\d+) cards?/i, sentence);
  const discard = amount(/discard (\d+) cards?/i, sentence);
  const heal = amount(/heal (\d+) HP?/i, sentence);
  const focus = amount(/gain \+?(\d+) Focus/i, sentence);
  const gainSpeed = amount(/gain \+?(\d+) Speed/i, sentence);
  const loseSpeed = amount(/lose (\d+) Speed/i, sentence);
  const nextAttackPower = amount(/next (?:unarmed )?Attack[^.]*?(?:gets|gains?) \+(\d+) (?:Attack Power|damage)/i, sentence);
  if (draw) effects.push({ timing, kind: "draw", amount: draw });
  if (discard) effects.push({ timing, kind: "discard", amount: discard });
  if (heal) effects.push({ timing, kind: "heal", amount: heal });
  if (focus) effects.push({ timing, kind: "focus", amount: focus });
  if (gainSpeed) effects.push({ timing, kind: "speed", amount: gainSpeed });
  if (loseSpeed) effects.push({ timing, kind: "speed", amount: -loseSpeed });
  if (nextAttackPower) effects.push({ timing, kind: "nextAttackPower", amount: nextAttackPower });
  return effects;
}

function legacyEffectFromStructured(effect: StructuredCardEffect): CardEffect | null {
  if (effect.conditions?.length) return null;
  if (!["onPlay", "onHit", "onBlock", "afterResolve"].includes(effect.trigger)) return null;
  const timing = effect.trigger as EffectTiming;
  const effectAmount = Number(effect.amount ?? 0);
  if (!Number.isFinite(effectAmount)) return null;
  if (effect.action === "draw") return { timing, kind: "draw", amount: effectAmount };
  if (effect.action === "discard" && (effect.target ?? "self") === "self") return { timing, kind: "discard", amount: effectAmount };
  if (effect.action === "heal" && (effect.target ?? "self") === "self") return { timing, kind: "heal", amount: effectAmount };
  if (effect.action === "gainFocus" && (effect.target ?? "self") === "self") return { timing, kind: "focus", amount: effectAmount };
  if (effect.action === "modifySpeed" && (effect.target ?? "self") === "self") return { timing, kind: "speed", amount: effectAmount };
  if (effect.action === "modifyAttackPower" && effect.duration === "nextAttack" && (effect.target ?? "self") === "self") return { timing, kind: "nextAttackPower", amount: effectAmount };
  return null;
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
    if (effect.resolver && (IMPLEMENTED_DEDICATED_RESOLVERS.has(effect.resolver) || isSupportedCharacterResolver(effect.resolver))) {
      dedicated.push(effect.resolver);
      continue;
    }
    unsupported.push(effect.id ?? `${effect.trigger}:${effect.action}`);
  }
  return { effects, dedicated, unsupported, source: "structured" };
}

export function compileCardEffects(text = ""): CardEffectPlan {
  const normalized = normalizedRulesText(text);
  const structuredEffects = structuredEffectsByRulesText.get(normalized);
  if (structuredEffects) return planFromStructuredEffects(structuredEffects);
  if (!normalized || /^(?:No (?:additional )?effect|—|-)[.]?$/i.test(normalized)) return { effects: [], dedicated: [], unsupported: [], source: "legacy-parser" };
  const effects: CardEffect[] = [];
  const unsupported: string[] = [];
  for (const sentence of normalized.split(/(?<=[.!?])\s+/)) {
    if (/\b(?:may|choose|up to|either|one of|optionally)\b/i.test(sentence)) { unsupported.push(sentence); continue; }
    const timing = sentenceTiming(sentence);
    if (!timing) { unsupported.push(sentence); continue; }
    const parsed = operationsForSentence(sentence, timing);
    if (parsed.length) effects.push(...parsed);
    else unsupported.push(sentence);
  }
  return { effects, dedicated: [], unsupported, source: "legacy-parser" };
}

export function structuredEffectsForCard(card: StructuredCardLike, registry?: StructuredEffectRegistry): StructuredCardEffect[] | null {
  if (Array.isArray(card.effects)) return card.effects;
  const catalogId = String(card.catalogId ?? "").trim();
  if (!catalogId) return null;
  const entry = registry?.cards?.[catalogId];
  return entry && Array.isArray(entry.effects) ? entry.effects : null;
}

export function effectPlanForCard(card: StructuredCardLike, registry?: StructuredEffectRegistry): CardEffectPlan {
  const structuredEffects = structuredEffectsForCard(card, registry);
  if (structuredEffects) return planFromStructuredEffects(structuredEffects);
  return compileCardEffects(card.rulesText ?? "");
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
  const relevant = cards.filter((card) => {
    const effects = structuredEffectsForCard(card, registry);
    return Boolean((effects && effects.length) || (card.rulesText && !/no (additional )?effect/i.test(card.rulesText)));
  });
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
