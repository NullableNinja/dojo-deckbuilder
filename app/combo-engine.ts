import {
  evaluateStructuredComboAttack,
  structuredComboEffects,
  structuredComboRequirementEntry,
  type ComboRuntimeCard,
  type ComboRuntimeContext,
} from "./combo-runtime.ts";

export type ComboCardLike = ComboRuntimeCard & {
  id: string;
  name: string;
  details?: Record<string, string | number | null | undefined>;
};

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

const value = (entry: unknown) => String(entry ?? "").trim();

function runtimeContext(context: ComboContext): ComboRuntimeContext {
  return {
    priorCards: context.priorCards,
    attacksThisTurn: context.attacksThisTurn,
    defendedThisRound: context.defendedThisRound,
    hitThisTurn: context.hitThisTurn,
    zonesPlayed: context.zonesPlayed,
    equipment: context.equipment,
    currentCard: context.currentCard,
    currentZone: context.currentZone,
    isReversal: context.isReversal,
  };
}

export function comboRequirementText(combo: ComboCardLike) {
  const details = combo.details ?? {};
  const explicit = value(details["Sequence / Requirement"] ?? details.Requirement ?? details.Sequence);
  if (explicit && explicit !== "—") return explicit;
  return structuredComboRequirementEntry(combo)?.displayText ?? "Canonical Combo requirement unavailable.";
}

export function comboPayoffText(combo: ComboCardLike) {
  const details = combo.details ?? {};
  const explicit = value(details.Effect ?? details.Payoff);
  if (explicit && explicit !== "—") return explicit;
  const effects = structuredComboEffects(combo);
  if (!effects.length) return "Canonical Combo payoff unavailable.";
  return effects.map((effect) => {
    const action = effect.action ?? effect.effect ?? "structured effect";
    const amount = effect.amount == null ? "" : ` ${effect.amount}`;
    return `${effect.trigger ?? "on event"}: ${action}${amount}`;
  }).join("; ");
}

export function evaluateCombo(combo: ComboCardLike, context: ComboContext): ComboEvaluation {
  const evaluation = evaluateStructuredComboAttack(combo, runtimeContext(context));
  return {
    requirement: comboRequirementText(combo),
    payoff: comboPayoffText(combo),
    eligible: evaluation.eligible,
    supported: evaluation.supported,
    reason: evaluation.reason,
    power: evaluation.power,
    damage: evaluation.damage,
    focusOnHit: evaluation.focusOnHit,
    grantsFlow: evaluation.grantsFlow,
    speedOnTrigger: evaluation.speedOnTrigger,
    piercing: evaluation.piercing,
  };
}
