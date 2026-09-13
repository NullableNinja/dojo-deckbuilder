import {
  markQuickDuelBeltCheckAction,
  quickDuelBeltCheckActionAvailability,
  quickDuelBeltCheckTurnKey,
} from "./quick-duel-belt-check-actions.ts";
import { canonicalTrainingStripeConfig } from "./training-stripes-config.ts";
import { spendTrainingStripeForHealing, trainingStripeHealingAvailability, type TrainingStripeBoard } from "./training-stripes.ts";

export const QUICK_DUEL_TRAINING_STRIPE_HEAL_REQUEST_EVENT = "ddb:training-stripe-heal";

export type QuickDuelTrainingStripeActor = "player" | "ai";
export type QuickDuelTrainingStripeWindow = "belt-check";

export type QuickDuelTrainingStripeMatch<Board extends TrainingStripeBoard = TrainingStripeBoard> = {
  player: Board;
  ai: Board;
  round: number;
  turnOrder: [QuickDuelTrainingStripeActor, QuickDuelTrainingStripeActor];
  turnIndex: 0 | 1;
};

export function quickDuelTrainingStripeTurnKey(match: QuickDuelTrainingStripeMatch, actor: QuickDuelTrainingStripeActor) {
  return quickDuelBeltCheckTurnKey(match, actor);
}

export function quickDuelTrainingStripeHealingAvailability<Board extends TrainingStripeBoard>(
  match: QuickDuelTrainingStripeMatch<Board>,
  actor: QuickDuelTrainingStripeActor,
  window: QuickDuelTrainingStripeWindow,
) {
  const spend = canonicalTrainingStripeConfig.rule.spend;
  const activeActor = match.turnOrder[match.turnIndex];
  const timingAllowed = Boolean(spend?.enabled && spend.spendAt === window && activeActor === actor);
  const board = match[actor];
  const availability = trainingStripeHealingAvailability(
    board,
    canonicalTrainingStripeConfig,
    quickDuelTrainingStripeTurnKey(match, actor),
  );
  const beltCheckAction = quickDuelBeltCheckActionAvailability(match, actor, "training-stripe-recovery");
  return {
    ...availability,
    timingAllowed,
    beltCheckAction,
    canSpend: timingAllowed && beltCheckAction.canUse && availability.canSpend,
  };
}

/**
 * Quick Duel adapter for the Training Stripe spend action. The HP amount,
 * stripe cost, timing window, Max-HP cap, per-turn usage limit, and exclusive
 * Belt Check action budget all come from generated canonical game data.
 */
export function spendQuickDuelTrainingStripeForHealing<Board extends TrainingStripeBoard, Match extends QuickDuelTrainingStripeMatch<Board>>(
  match: Match,
  actor: QuickDuelTrainingStripeActor,
  window: QuickDuelTrainingStripeWindow,
): Match {
  const availability = quickDuelTrainingStripeHealingAvailability(match, actor, window);
  if (!availability.canSpend) return match;
  const board = match[actor];
  const nextBoard = spendTrainingStripeForHealing(
    board,
    canonicalTrainingStripeConfig,
    quickDuelTrainingStripeTurnKey(match, actor),
  );
  const spent = { ...match, [actor]: nextBoard } as Match;
  return markQuickDuelBeltCheckAction(spent, actor, "training-stripe-recovery");
}
