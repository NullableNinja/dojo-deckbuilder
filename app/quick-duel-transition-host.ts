import {
  beginComboHostAscend,
  beginComboHostRound,
  beginComboHostTurn,
  closeComboHostTurn,
  emptyComboHostFacts,
  recordComboHostAttack,
  recordComboHostBlock,
  recordComboHostCardPlayed,
  recordComboHostPurchase,
  recordComboHostSpeedGain,
  type ComboHostCardLookup,
  type ComboHostFacts,
} from "./combo-host-facts.ts";

const COMBO_FACTS_KEY = "structuredHost.comboFacts";

export type QuickDuelTransitionBoard = {
  hand: string[];
  discard: string[];
  cardsThisTurn: string[];
  zonesPlayed: string[];
  equipment: string[];
  tempSpeed: number;
  cardsBought: number;
  currentAttackIsReversal?: boolean;
  characterMarks?: Record<string, unknown>;
};

export type QuickDuelTransitionExchange = {
  id: string;
  actor: "player" | "ai";
  target: "player" | "ai";
  attackCardId: string;
  defenseCardId?: string | null;
  zone: string;
  outcome: "hit" | "block";
};

export type QuickDuelTransitionMatch<Board extends QuickDuelTransitionBoard = QuickDuelTransitionBoard> = {
  player: Board;
  ai: Board;
  market: string[];
  round: number;
  phase: string;
  turnOrder: ["player" | "ai", "player" | "ai"];
  turnIndex: 0 | 1;
  lastExchange?: QuickDuelTransitionExchange | null;
  locationId?: string;
};

function looksLikeFacts(value: unknown): value is ComboHostFacts {
  if (!value || typeof value !== "object") return false;
  const facts = value as Partial<ComboHostFacts>;
  return Array.isArray(facts.startingHandIds)
    && Array.isArray(facts.turnPlayed)
    && Array.isArray(facts.roundPlayed)
    && Array.isArray(facts.sinceLastTurnPlayed)
    && Array.isArray(facts.turnAttacks)
    && Array.isArray(facts.roundAttacks)
    && Array.isArray(facts.sinceLastTurnAttacks)
    && Array.isArray(facts.roundBlocks)
    && Array.isArray(facts.sinceLastTurnBlocks)
    && Array.isArray(facts.purchasesSinceLastAscend);
}

export function comboHostFactsFromBoard(board: QuickDuelTransitionBoard): ComboHostFacts {
  const stored = board.characterMarks?.[COMBO_FACTS_KEY];
  return looksLikeFacts(stored) ? stored : emptyComboHostFacts();
}

export function withComboHostFacts<Board extends QuickDuelTransitionBoard>(board: Board, facts: ComboHostFacts): Board {
  return {
    ...board,
    characterMarks: {
      ...(board.characterMarks ?? {}),
      [COMBO_FACTS_KEY]: facts,
    },
  };
}

function activeActor(match: QuickDuelTransitionMatch) {
  return match.turnOrder[match.turnIndex];
}

function actorBoard<Board extends QuickDuelTransitionBoard>(match: QuickDuelTransitionMatch<Board>, actor: "player" | "ai") {
  return match[actor];
}

function setActorBoard<Board extends QuickDuelTransitionBoard>(match: QuickDuelTransitionMatch<Board>, actor: "player" | "ai", board: Board) {
  return { ...match, [actor]: board } as QuickDuelTransitionMatch<Board>;
}

function isAttackCard(lookup: ComboHostCardLookup, id: string) {
  const card = lookup(id);
  const type = String(card?.cardType ?? "").toLocaleLowerCase();
  const subtype = String(card?.subtype ?? "").toLocaleLowerCase();
  const tags = (card?.tags ?? []).map((tag) => String(tag).toLocaleLowerCase());
  return type === "attack" || subtype === "attack" || tags.includes("attack");
}

function appendedIds(previous: readonly string[], next: readonly string[]) {
  let prefix = 0;
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix += 1;
  if (prefix === previous.length) return next.slice(prefix);
  const counts = new Map<string, number>();
  for (const id of previous) counts.set(id, (counts.get(id) ?? 0) + 1);
  const added: string[] = [];
  for (const id of next) {
    const remaining = counts.get(id) ?? 0;
    if (remaining) counts.set(id, remaining - 1);
    else added.push(id);
  }
  return added;
}

function recordPlayedCardDiff(
  facts: ComboHostFacts,
  previous: QuickDuelTransitionBoard,
  next: QuickDuelTransitionBoard,
  lookup: ComboHostCardLookup,
) {
  const added = appendedIds(previous.cardsThisTurn, next.cardsThisTurn);
  if (!added.length) return facts;
  let attackIndex = previous.cardsThisTurn.filter((id) => isAttackCard(lookup, id)).length;
  let result = facts;
  for (const id of added) {
    const attack = isAttackCard(lookup, id);
    const zone = attack ? next.zonesPlayed[attackIndex++] : undefined;
    result = recordComboHostCardPlayed(result, id, zone);
  }
  return result;
}

function detectPurchasedCard(
  previousMatch: QuickDuelTransitionMatch,
  nextMatch: QuickDuelTransitionMatch,
  previousBoard: QuickDuelTransitionBoard,
  nextBoard: QuickDuelTransitionBoard,
) {
  if (nextBoard.cardsBought <= previousBoard.cardsBought) return null;
  const addedToDiscard = appendedIds(previousBoard.discard, nextBoard.discard);
  const discardPurchase = addedToDiscard.find((id) => previousMatch.market.includes(id));
  if (discardPurchase) return discardPurchase;
  return previousMatch.market.find((id) => !nextMatch.market.includes(id)) ?? null;
}

function initializeActiveTurn<Board extends QuickDuelTransitionBoard>(match: QuickDuelTransitionMatch<Board>) {
  const actor = activeActor(match);
  const board = actorBoard(match, actor);
  const existing = comboHostFactsFromBoard(board);
  if (existing.startingHandIds.length || existing.turnPlayed.length || existing.turnAttacks.length) return match;
  return setActorBoard(match, actor, withComboHostFacts(board, beginComboHostTurn(existing, board.hand)));
}

/**
 * Derives canonical Combo host history from state transitions Quick Duel already
 * records. This function is card-identity agnostic and never reads printed
 * requirement text. It is intentionally pure so Playtest can call it once at
 * its state-write boundary.
 */
export function applyQuickDuelStructuredTransition<Board extends QuickDuelTransitionBoard>(
  previousInput: QuickDuelTransitionMatch<Board>,
  nextInput: QuickDuelTransitionMatch<Board>,
  lookup: ComboHostCardLookup,
): QuickDuelTransitionMatch<Board> {
  const previous = initializeActiveTurn(previousInput);
  let next = nextInput;
  const priorActor = activeActor(previous);
  const roundAdvanced = next.round > previous.round;
  const turnAdvanced = roundAdvanced || next.turnIndex !== previous.turnIndex;

  for (const actor of ["player", "ai"] as const) {
    const previousBoard = actorBoard(previous, actor);
    const nextBoard = actorBoard(next, actor);
    let facts = comboHostFactsFromBoard(previousBoard);

    if (actor === "player" && previous.phase !== "player-ascend" && next.phase === "player-ascend") {
      facts = beginComboHostAscend(facts);
    }
    if (actor === "ai" && turnAdvanced && priorActor === "ai") {
      facts = beginComboHostAscend(facts);
    }

    facts = recordPlayedCardDiff(facts, previousBoard, nextBoard, lookup);
    if (nextBoard.tempSpeed > previousBoard.tempSpeed) facts = recordComboHostSpeedGain(facts);

    const purchaseId = detectPurchasedCard(previous, next, previousBoard, nextBoard);
    if (purchaseId) facts = recordComboHostPurchase(facts, purchaseId);

    next = setActorBoard(next, actor, withComboHostFacts(nextBoard, facts));
  }

  const exchange = next.lastExchange;
  if (exchange && exchange.id !== previous.lastExchange?.id) {
    const attacker = exchange.actor;
    const target = exchange.target;
    let attackerBoard = actorBoard(next, attacker);
    let targetBoard = actorBoard(next, target);
    let attackerFacts = comboHostFactsFromBoard(attackerBoard);
    let targetFacts = comboHostFactsFromBoard(targetBoard);
    attackerFacts = recordComboHostAttack(attackerFacts, exchange.attackCardId, exchange.zone, {
      hit: exchange.outcome === "hit",
      blocked: exchange.outcome === "block",
      reversal: Boolean(attackerBoard.currentAttackIsReversal),
    });
    if (exchange.outcome === "block") {
      targetFacts = recordComboHostBlock(targetFacts, exchange.defenseCardId ?? undefined, exchange.zone, targetBoard.equipment.length);
    }
    attackerBoard = withComboHostFacts(attackerBoard, attackerFacts);
    targetBoard = withComboHostFacts(targetBoard, targetFacts);
    next = setActorBoard(setActorBoard(next, attacker, attackerBoard), target, targetBoard);
  }

  if (turnAdvanced) {
    const finishingBoard = actorBoard(next, priorActor);
    next = setActorBoard(next, priorActor, withComboHostFacts(finishingBoard, closeComboHostTurn(comboHostFactsFromBoard(finishingBoard))));
  }

  if (roundAdvanced) {
    for (const actor of ["player", "ai"] as const) {
      const board = actorBoard(next, actor);
      next = setActorBoard(next, actor, withComboHostFacts(board, beginComboHostRound(comboHostFactsFromBoard(board))));
    }
  }

  if (turnAdvanced) {
    const nextActor = activeActor(next);
    const nextBoard = actorBoard(next, nextActor);
    next = setActorBoard(next, nextActor, withComboHostFacts(nextBoard, beginComboHostTurn(comboHostFactsFromBoard(nextBoard), nextBoard.hand)));
  }

  return next;
}

export function quickDuelComboFactsKey() {
  return COMBO_FACTS_KEY;
}
