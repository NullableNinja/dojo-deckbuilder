import { canonicalTrainingStripeConfig } from "./training-stripes-config.ts";
import { spendTrainingStripeForHealing, trainingStripeHealingAvailability, type TrainingStripeBoard } from "./training-stripes.ts";

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
  return `${match.round}:${actor}`;
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
  return { ...availability, timingAllowed, canSpend: timingAllowed && availability.canSpend };
}

/**
 * Quick Duel adapter for the Training Stripe spend action. The HP amount,
 * stripe cost, timing window, Max-HP cap, and per-turn usage limit all come
 * from generated canonical game data. This adapter supplies only match facts.
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
  return { ...match, [actor]: nextBoard } as Match;
}
