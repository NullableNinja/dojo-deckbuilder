import {
  beltCheckActionAvailability,
  markBeltCheckAction,
  type BeltCheckAction,
  type BeltCheckActionBoard,
} from "./belt-check-actions.ts";
import { canonicalBeltCheckActionRule } from "./training-stripes-config.ts";

export type QuickDuelBeltCheckActor = "player" | "ai";

export type QuickDuelBeltCheckMatch<Board extends BeltCheckActionBoard = BeltCheckActionBoard> = {
  player: Board;
  ai: Board;
  round: number;
  turnOrder: [QuickDuelBeltCheckActor, QuickDuelBeltCheckActor];
  turnIndex: 0 | 1;
};

export function quickDuelBeltCheckTurnKey(match: QuickDuelBeltCheckMatch, actor: QuickDuelBeltCheckActor) {
  return `${match.round}:${actor}`;
}

export function quickDuelBeltCheckActionAvailability<Board extends BeltCheckActionBoard>(
  match: QuickDuelBeltCheckMatch<Board>,
  actor: QuickDuelBeltCheckActor,
  action: BeltCheckAction,
) {
  const activeActor = match.turnOrder[match.turnIndex];
  const timingAllowed = activeActor === actor;
  const availability = beltCheckActionAvailability(
    match[actor],
    canonicalBeltCheckActionRule,
    quickDuelBeltCheckTurnKey(match, actor),
    action,
  );
  return { ...availability, timingAllowed, canUse: timingAllowed && availability.canUse };
}

export function markQuickDuelBeltCheckAction<Board extends BeltCheckActionBoard, Match extends QuickDuelBeltCheckMatch<Board>>(
  match: Match,
  actor: QuickDuelBeltCheckActor,
  action: BeltCheckAction,
): Match {
  const availability = quickDuelBeltCheckActionAvailability(match, actor, action);
  if (!availability.canUse) return match;
  const board = markBeltCheckAction(
    match[actor],
    canonicalBeltCheckActionRule,
    quickDuelBeltCheckTurnKey(match, actor),
    action,
  );
  return { ...match, [actor]: board } as Match;
}
