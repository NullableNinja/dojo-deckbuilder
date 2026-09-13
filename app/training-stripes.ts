export const TRAINING_STRIPE_MARK_KEY = "progression.trainingStripes";

export type TrainingStripeRule = {
  enabled: boolean;
  awardAt: "belt-check";
  maxHeld: number;
  maxAwardsPerBelt: number;
  clearOnPromotion: boolean;
  eligibility: {
    requiresNextBeltXp: boolean;
    requiresIncompleteNextBeltExam: boolean;
  };
  spend?: {
    enabled: boolean;
    spendAt: "belt-check";
    stripeCost: number;
    healHp: number;
    usesPerTurn: number;
    cannotExceedMaxHp: boolean;
  };
  summary?: string;
};

export type TrainingStripeState = {
  beltIndex: number;
  held: number;
  awarded: number;
  provisional: boolean;
  spentTurnKey: string | null;
  spendsThisTurn: number;
};

export type TrainingStripeBoard = {
  xp?: number;
  belt?: number;
  hp?: number;
  maxHp?: number;
  completedTasks?: number[];
  characterMarks?: Record<string, unknown>;
};

export type TrainingStripeConfig = {
  rule: TrainingStripeRule;
  beltThresholds: readonly number[];
};

function integer(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function beltIndexFor(board: TrainingStripeBoard) {
  return integer(board.belt, 0);
}

function emptyState(beltIndex: number): TrainingStripeState {
  return { beltIndex, held: 0, awarded: 0, provisional: false, spentTurnKey: null, spendsThisTurn: 0 };
}

function looksLikeTrainingStripeState(value: unknown): value is Partial<TrainingStripeState> {
  return Boolean(value && typeof value === "object");
}

export function trainingStripeState(board: TrainingStripeBoard): TrainingStripeState {
  const beltIndex = beltIndexFor(board);
  const stored = board.characterMarks?.[TRAINING_STRIPE_MARK_KEY];
  if (!looksLikeTrainingStripeState(stored) || integer(stored.beltIndex, -1) !== beltIndex) return emptyState(beltIndex);
  return {
    beltIndex,
    held: integer(stored.held),
    awarded: integer(stored.awarded),
    provisional: stored.provisional === true,
    spentTurnKey: typeof stored.spentTurnKey === "string" ? stored.spentTurnKey : null,
    spendsThisTurn: integer(stored.spendsThisTurn),
  };
}

export function withTrainingStripeState<Board extends TrainingStripeBoard>(board: Board, state: TrainingStripeState): Board {
  return {
    ...board,
    characterMarks: {
      ...(board.characterMarks ?? {}),
      [TRAINING_STRIPE_MARK_KEY]: state,
    },
  };
}

export function synchronizeTrainingStripeBelt<Board extends TrainingStripeBoard>(board: Board, rule: TrainingStripeRule): Board {
  const beltIndex = beltIndexFor(board);
  const stored = board.characterMarks?.[TRAINING_STRIPE_MARK_KEY];
  if (!looksLikeTrainingStripeState(stored)) return board;
  if (integer(stored.beltIndex, -1) === beltIndex) return board;
  if (!rule.clearOnPromotion) return board;
  return withTrainingStripeState(board, emptyState(beltIndex));
}

export function trainingStripeEligibility(board: TrainingStripeBoard, config: TrainingStripeConfig) {
  const beltIndex = beltIndexFor(board);
  const nextBeltIndex = beltIndex + 1;
  const threshold = config.beltThresholds[nextBeltIndex];
  const state = trainingStripeState(board);
  const hasNextBelt = Number.isFinite(threshold);
  const xpMet = hasNextBelt && integer(board.xp) >= Number(threshold);
  const examComplete = Array.isArray(board.completedTasks) && board.completedTasks.includes(nextBeltIndex);
  const heldCapReached = state.held >= Math.max(0, integer(config.rule.maxHeld));
  const awardCapReached = state.awarded >= Math.max(0, integer(config.rule.maxAwardsPerBelt));
  const eligible = config.rule.enabled
    && hasNextBelt
    && (!config.rule.eligibility.requiresNextBeltXp || xpMet)
    && (!config.rule.eligibility.requiresIncompleteNextBeltExam || !examComplete)
    && !heldCapReached
    && !awardCapReached;
  return { eligible, beltIndex, nextBeltIndex, threshold: hasNextBelt ? Number(threshold) : null, xpMet, examComplete, heldCapReached, awardCapReached, state };
}

/**
 * Quick Duel opens Ascend before the Acquisition Desk and Belt Check share the
 * screen. The stripe is therefore staged as provisional when Ascend begins so
 * it can already be visible at Belt Check. If an Ascend purchase completes the
 * exam before Belt Check, reconcileProvisionalTrainingStripe removes it again.
 */
export function awardProvisionalTrainingStripe<Board extends TrainingStripeBoard>(board: Board, config: TrainingStripeConfig): Board {
  const eligibility = trainingStripeEligibility(board, config);
  if (!eligibility.eligible || eligibility.state.provisional) return board;
  return withTrainingStripeState(board, {
    ...eligibility.state,
    held: eligibility.state.held + 1,
    awarded: eligibility.state.awarded + 1,
    provisional: true,
  });
}

export function reconcileProvisionalTrainingStripe<Board extends TrainingStripeBoard>(board: Board, config: TrainingStripeConfig): Board {
  const state = trainingStripeState(board);
  if (!state.provisional) return board;
  const nextBeltIndex = beltIndexFor(board) + 1;
  const examComplete = Array.isArray(board.completedTasks) && board.completedTasks.includes(nextBeltIndex);
  if (!config.rule.eligibility.requiresIncompleteNextBeltExam || !examComplete) return board;
  return withTrainingStripeState(board, {
    ...state,
    held: Math.max(0, state.held - 1),
    awarded: Math.max(0, state.awarded - 1),
    provisional: false,
  });
}

export function finalizeTrainingStripe<Board extends TrainingStripeBoard>(board: Board): Board {
  const state = trainingStripeState(board);
  if (!state.provisional) return board;
  return withTrainingStripeState(board, { ...state, provisional: false });
}

export function trainingStripeHealingAvailability(board: TrainingStripeBoard, config: TrainingStripeConfig, turnKey: string) {
  const spend = config.rule.spend;
  const state = trainingStripeState(board);
  const stripeCost = Math.max(1, integer(spend?.stripeCost, 1));
  const healHp = Math.max(0, integer(spend?.healHp));
  const usesPerTurn = Math.max(0, integer(spend?.usesPerTurn));
  const currentHp = integer(board.hp);
  const maxHp = Math.max(currentHp, integer(board.maxHp, currentHp));
  const sameTurn = state.spentTurnKey === turnKey;
  const spendsThisTurn = sameTurn ? state.spendsThisTurn : 0;
  const atFullHp = currentHp >= maxHp;
  const enabled = Boolean(config.rule.enabled && spend?.enabled);
  const canSpend = enabled
    && Boolean(turnKey)
    && state.held >= stripeCost
    && healHp > 0
    && usesPerTurn > spendsThisTurn
    && !atFullHp;
  return { canSpend, state, stripeCost, healHp, usesPerTurn, spendsThisTurn, currentHp, maxHp, atFullHp };
}

/**
 * Spend behavior is intentionally data-driven. The caller supplies an opaque
 * turn key (for Quick Duel, round + active actor is sufficient) so the runtime
 * can enforce the canonical uses-per-turn limit without hard-coding timing
 * values into the Playtest engine.
 */
export function spendTrainingStripeForHealing<Board extends TrainingStripeBoard>(board: Board, config: TrainingStripeConfig, turnKey: string): Board {
  const availability = trainingStripeHealingAvailability(board, config, turnKey);
  if (!availability.canSpend) return board;
  const spend = config.rule.spend!;
  const nextHp = spend.cannotExceedMaxHp
    ? Math.min(availability.maxHp, availability.currentHp + availability.healHp)
    : availability.currentHp + availability.healHp;
  return withTrainingStripeState({ ...board, hp: nextHp }, {
    ...availability.state,
    held: Math.max(0, availability.state.held - availability.stripeCost),
    spentTurnKey: turnKey,
    spendsThisTurn: availability.spendsThisTurn + 1,
  });
}
