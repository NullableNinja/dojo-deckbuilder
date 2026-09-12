import { comboRuntimeContextFromHostFacts, type ComboHostCardLookup } from "./combo-host-facts.ts";
import { comboPlanForHost, type ComboHostPlan } from "./combo-playtest-bridge.ts";
import { comboHostFactsFromBoard, type QuickDuelTransitionBoard } from "./quick-duel-transition-host.ts";
import type { ComboRuntimeCard } from "./combo-runtime.ts";
import type { RuntimeTrigger } from "./family-effect-runtime.ts";

export type QuickDuelComboPlanningBoard = QuickDuelTransitionBoard & {
  attacksThisTurn?: number;
  defendedThisRound?: boolean;
  blockedThisRound?: boolean;
  hitThisTurn?: boolean;
  completedBeltExamThisRound?: boolean;
  learnedCombos?: string[];
  triggeredCombos?: string[];
};

export type QuickDuelComboEventFacts = {
  isReversal?: boolean;
  currentAttackHit?: boolean;
  currentDefense?: ComboRuntimeCard | null;
  currentDefenseBlocked?: boolean;
};

export type QuickDuelComboCandidatePlan = {
  comboId: string;
  combo: ComboRuntimeCard;
  plan: ComboHostPlan;
};

const lower = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase();
const hasTag = (card: ComboRuntimeCard | null | undefined, tag: string) => (card?.tags ?? []).some((value) => lower(value) === lower(tag));
const isAttack = (card: ComboRuntimeCard | null | undefined) => lower(card?.subtype) === "attack" || lower(card?.cardType) === "attack" || hasTag(card, "attack");

function cardsFor(ids: readonly string[], lookup: ComboHostCardLookup) {
  return ids.map((id) => lookup(id)).filter((card): card is ComboRuntimeCard => Boolean(card));
}

function priorCardIds(board: QuickDuelComboPlanningBoard, currentCard: ComboRuntimeCard) {
  const ids = [...board.cardsThisTurn];
  if (ids.at(-1) === currentCard.id) ids.pop();
  return ids;
}

function priorAttackFacts(board: QuickDuelComboPlanningBoard, currentCard: ComboRuntimeCard, currentZone: string) {
  const facts = comboHostFactsFromBoard(board);
  const attacks = [...facts.turnAttacks];
  const last = attacks.at(-1);
  if (isAttack(currentCard) && last?.cardId === currentCard.id && lower(last.zone) === lower(currentZone)) attacks.pop();
  return attacks;
}

/**
 * Builds the complete structured Combo context from generic Quick Duel state.
 * The React host does not interpret Combo requirement prose and does not need to
 * decide which historical facts a particular Combo cares about.
 */
export function comboContextFromQuickDuelBoard(
  board: QuickDuelComboPlanningBoard,
  currentCard: ComboRuntimeCard,
  currentZone: string,
  lookup: ComboHostCardLookup,
  event: QuickDuelComboEventFacts = {},
) {
  const facts = comboHostFactsFromBoard(board);
  const priorIds = priorCardIds(board, currentCard);
  const priorCards = cardsFor(priorIds, lookup);
  const priorAttacks = priorAttackFacts(board, currentCard, currentZone);
  const zonesPlayed = priorAttacks.length
    ? priorAttacks.map((fact) => fact.zone).filter((zone): zone is string => Boolean(zone))
    : board.zonesPlayed.slice(0, priorCards.filter(isAttack).length);
  const hitZonesThisTurn = priorAttacks.filter((fact) => fact.hit).map((fact) => fact.zone).filter((zone): zone is string => Boolean(zone));

  return comboRuntimeContextFromHostFacts(facts, {
    priorCards,
    attacksThisTurn: priorCards.filter(isAttack).length,
    defendedThisRound: Boolean(board.defendedThisRound),
    blockedThisRound: Boolean(board.blockedThisRound),
    hitThisTurn: priorAttacks.some((fact) => fact.hit) || Boolean(board.hitThisTurn && !isAttack(currentCard)),
    hitZonesThisTurn,
    zonesPlayed,
    equipment: cardsFor(board.equipment, lookup),
    currentCard,
    currentZone,
    isReversal: event.isReversal ?? Boolean(board.currentAttackIsReversal),
    currentAttackHit: event.currentAttackHit,
    currentDefense: event.currentDefense ?? null,
    currentDefenseBlocked: event.currentDefenseBlocked,
    completedBeltExamThisRound: Boolean(board.completedBeltExamThisRound),
    triggeredComboIds: [...(board.triggeredCombos ?? [])],
  }, lookup);
}

/**
 * Plans every currently learned, not-yet-triggered Combo against one gameplay
 * event. Combo identities are data: this loop contains no per-Combo dispatch.
 */
export function quickDuelComboPlansForEvent(
  board: QuickDuelComboPlanningBoard,
  currentCard: ComboRuntimeCard,
  currentZone: string,
  lookup: ComboHostCardLookup,
  trigger: RuntimeTrigger,
  event: QuickDuelComboEventFacts = {},
): QuickDuelComboCandidatePlan[] {
  const context = comboContextFromQuickDuelBoard(board, currentCard, currentZone, lookup, event);
  const alreadyTriggered = new Set(board.triggeredCombos ?? []);
  return (board.learnedCombos ?? []).flatMap((comboId) => {
    if (alreadyTriggered.has(comboId)) return [];
    const combo = lookup(comboId);
    if (!combo) return [];
    const plan = comboPlanForHost(combo, context, trigger);
    return plan.requirement.eligible && plan.requirement.supported ? [{ comboId, combo, plan }] : [];
  });
}
