export const BELT_CHECK_ACTION_MARK_KEY = "progression.beltCheckAction";

export type BeltCheckAction = "promote" | "training-stripe-recovery";

export type BeltCheckActionRule = {
  usesPerTurn: number;
  choices: BeltCheckAction[];
  summary?: string;
};

export type BeltCheckActionBoard = {
  characterMarks?: Record<string, unknown>;
};

export type BeltCheckActionState = {
  turnKey: string | null;
  usesThisTurn: number;
  action: BeltCheckAction | null;
};

function integer(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function looksLikeState(value: unknown): value is Partial<BeltCheckActionState> {
  return Boolean(value && typeof value === "object");
}

export function beltCheckActionState(board: BeltCheckActionBoard, turnKey: string): BeltCheckActionState {
  const stored = board.characterMarks?.[BELT_CHECK_ACTION_MARK_KEY];
  if (!looksLikeState(stored) || stored.turnKey !== turnKey) {
    return { turnKey: turnKey || null, usesThisTurn: 0, action: null };
  }
  const action = stored.action === "promote" || stored.action === "training-stripe-recovery" ? stored.action : null;
  return {
    turnKey,
    usesThisTurn: integer(stored.usesThisTurn),
    action,
  };
}

export function beltCheckActionAvailability(
  board: BeltCheckActionBoard,
  rule: BeltCheckActionRule,
  turnKey: string,
  action: BeltCheckAction,
) {
  const state = beltCheckActionState(board, turnKey);
  const usesPerTurn = Math.max(0, integer(rule.usesPerTurn));
  const choiceAllowed = Array.isArray(rule.choices) && rule.choices.includes(action);
  const canUse = Boolean(turnKey) && choiceAllowed && state.usesThisTurn < usesPerTurn;
  return { canUse, state, usesPerTurn, choiceAllowed };
}

export function markBeltCheckAction<Board extends BeltCheckActionBoard>(
  board: Board,
  rule: BeltCheckActionRule,
  turnKey: string,
  action: BeltCheckAction,
): Board {
  const availability = beltCheckActionAvailability(board, rule, turnKey, action);
  if (!availability.canUse) return board;
  return {
    ...board,
    characterMarks: {
      ...(board.characterMarks ?? {}),
      [BELT_CHECK_ACTION_MARK_KEY]: {
        turnKey,
        usesThisTurn: availability.state.usesThisTurn + 1,
        action,
      } satisfies BeltCheckActionState,
    },
  };
}
