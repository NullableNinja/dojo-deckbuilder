export type FighterSide = "player" | "ai";

export type PlaytestEvent =
  | { type: "combat.attack"; actor: FighterSide; target: FighterSide; zone?: string }
  | { type: "combat.hit"; actor: FighterSide; target: FighterSide; amount: number }
  | { type: "combat.block"; actor: FighterSide; target: FighterSide }
  | { type: "combat.ko"; fighter: FighterSide; winner: FighterSide }
  | { type: "vitality.heal"; fighter: FighterSide; amount: number }
  | { type: "resource.focusGain"; fighter: FighterSide; amount: number }
  | { type: "resource.focusSpend"; fighter: FighterSide; amount: number }
  | { type: "resource.xpGain"; fighter: FighterSide; amount: number }
  | { type: "card.draw"; fighter: FighterSide; amount: number }
  | { type: "card.discard"; fighter: FighterSide; amount: number }
  | { type: "card.destroy"; fighter: FighterSide; amount: number }
  | { type: "tempo.used"; fighter: FighterSide }
  | { type: "tempo.ready"; fighter: FighterSide }
  | { type: "flow.ready"; fighter: FighterSide }
  | { type: "flow.triggered"; fighter: FighterSide }
  | { type: "equipment.exhaust"; fighter: FighterSide; amount: number }
  | { type: "equipment.ready"; fighter: FighterSide; amount: number }
  | { type: "market.purchase"; fighter: FighterSide; amount: number }
  | { type: "progress.beltExam"; fighter: FighterSide }
  | { type: "progress.promotion"; fighter: FighterSide; belt: number }
  | { type: "combo.completed"; fighter: FighterSide; amount: number }
  | { type: "scene.change" }
;

export const PLAYTEST_EVENT_NAME = "ddb:playtest-event";

export type PlaytestBoardSnapshot = {
  hp?: number;
  maxHp?: number;
  xp?: number;
  focus?: number;
  focusGeneratedThisTurn?: number;
  focusSpentThisTurn?: number;
  belt?: number;
  hand?: unknown[];
  discard?: unknown[];
  playArea?: unknown[];
  destroyed?: unknown[];
  exhaustedEquipment?: unknown[];
  attacksThisTurn?: number;
  zonesPlayed?: string[];
  tempo?: boolean;
  nextAttackHasFlow?: boolean;
  flowUsedThisTurn?: boolean;
  cardsBought?: number;
  completedTasks?: unknown[];
  completedBeltExamThisRound?: boolean;
  triggeredCombos?: unknown[];
};

export type PlaytestMatchSnapshot = {
  schema?: number;
  player?: PlaytestBoardSnapshot;
  ai?: PlaytestBoardSnapshot;
  locationId?: string | null;
  winner?: FighterSide | null;
  log?: string[];
};

const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const length = (value: unknown[] | undefined) => Array.isArray(value) ? value.length : 0;
const otherSide = (side: FighterSide): FighterSide => side === "player" ? "ai" : "player";

function newlyPrependedLogLines(previous: PlaytestMatchSnapshot, next: PlaytestMatchSnapshot) {
  const before = Array.isArray(previous.log) ? previous.log : [];
  const after = Array.isArray(next.log) ? next.log : [];
  if (!after.length || !before.length) return [];
  const previousHeadIndex = after.indexOf(before[0]);
  if (previousHeadIndex < 0) return after.slice(0, Math.min(6, after.length));
  return after.slice(0, previousHeadIndex);
}

function deriveCombatResolutionEvents(previous: PlaytestMatchSnapshot, next: PlaytestMatchSnapshot): PlaytestEvent[] {
  const events: PlaytestEvent[] = [];
  for (const line of newlyPrependedLogLines(previous, next).reverse()) {
    if (!/Attack\s+\d+\s+vs\s+Defense\s+\d+/i.test(line)) continue;

    const hitPlayer = line.match(/\bhits you for\s+(\d+)/i);
    if (hitPlayer) {
      events.push({ type: "combat.hit", actor: "ai", target: "player", amount: Number(hitPlayer[1]) });
      continue;
    }

    const hitOpponent = line.match(/\bhits\s+(?!you\b)[^.]*?\s+for\s+(\d+)/i);
    if (hitOpponent) {
      events.push({ type: "combat.hit", actor: "player", target: "ai", amount: Number(hitOpponent[1]) });
      continue;
    }

    if (/\bis blocked\b/i.test(line)) {
      events.push({ type: "combat.block", actor: "player", target: "ai" });
      continue;
    }
    if (/\bblocks\b/i.test(line)) events.push({ type: "combat.block", actor: "ai", target: "player" });
  }
  return events;
}

function deriveBoardEvents(side: FighterSide, previous: PlaytestBoardSnapshot, next: PlaytestBoardSnapshot, loggedHitTargets: Set<FighterSide>): PlaytestEvent[] {
  const events: PlaytestEvent[] = [];
  const opponent = otherSide(side);

  const attackDelta = Math.max(0, number(next.attacksThisTurn) - number(previous.attacksThisTurn));
  if (attackDelta > 0) {
    const zone = Array.isArray(next.zonesPlayed) ? next.zonesPlayed.at(-1) : undefined;
    events.push({ type: "combat.attack", actor: side, target: opponent, ...(zone ? { zone } : {}) });
  }

  const hpDelta = number(next.hp) - number(previous.hp);
  if (hpDelta < 0 && !loggedHitTargets.has(side)) events.push({ type: "combat.hit", actor: opponent, target: side, amount: Math.abs(hpDelta) });
  if (hpDelta > 0) events.push({ type: "vitality.heal", fighter: side, amount: hpDelta });

  const generatedFocusDelta = number(next.focusGeneratedThisTurn) - number(previous.focusGeneratedThisTurn);
  const spentFocusDelta = number(next.focusSpentThisTurn) - number(previous.focusSpentThisTurn);
  const rawFocusDelta = number(next.focus) - number(previous.focus);
  if (generatedFocusDelta > 0) events.push({ type: "resource.focusGain", fighter: side, amount: generatedFocusDelta });
  else if (rawFocusDelta > 0 && spentFocusDelta <= 0) events.push({ type: "resource.focusGain", fighter: side, amount: rawFocusDelta });
  if (spentFocusDelta > 0) events.push({ type: "resource.focusSpend", fighter: side, amount: spentFocusDelta });

  const xpDelta = number(next.xp) - number(previous.xp);
  if (xpDelta > 0) events.push({ type: "resource.xpGain", fighter: side, amount: xpDelta });

  const handDelta = length(next.hand) - length(previous.hand);
  if (handDelta > 0) events.push({ type: "card.draw", fighter: side, amount: handDelta });

  const discardGain = length(next.discard) - length(previous.discard);
  const handLoss = Math.max(0, -handDelta);
  const playAreaGain = Math.max(0, length(next.playArea) - length(previous.playArea));
  const trueDiscard = Math.max(0, Math.min(discardGain, Math.max(0, handLoss - playAreaGain)));
  if (trueDiscard > 0) events.push({ type: "card.discard", fighter: side, amount: trueDiscard });

  const destroyedDelta = length(next.destroyed) - length(previous.destroyed);
  if (destroyedDelta > 0) events.push({ type: "card.destroy", fighter: side, amount: destroyedDelta });

  if (previous.tempo === true && next.tempo === false) events.push({ type: "tempo.used", fighter: side });
  if (previous.tempo === false && next.tempo === true) events.push({ type: "tempo.ready", fighter: side });

  if (previous.nextAttackHasFlow !== true && next.nextAttackHasFlow === true) events.push({ type: "flow.ready", fighter: side });
  if (previous.flowUsedThisTurn !== true && next.flowUsedThisTurn === true) events.push({ type: "flow.triggered", fighter: side });

  const exhaustedDelta = length(next.exhaustedEquipment) - length(previous.exhaustedEquipment);
  if (exhaustedDelta > 0) events.push({ type: "equipment.exhaust", fighter: side, amount: exhaustedDelta });
  if (exhaustedDelta < 0) events.push({ type: "equipment.ready", fighter: side, amount: Math.abs(exhaustedDelta) });

  const purchaseDelta = number(next.cardsBought) - number(previous.cardsBought);
  if (purchaseDelta > 0) events.push({ type: "market.purchase", fighter: side, amount: purchaseDelta });

  const examJustCompleted = previous.completedBeltExamThisRound !== true && next.completedBeltExamThisRound === true;
  if (examJustCompleted) events.push({ type: "progress.beltExam", fighter: side });

  const beltDelta = number(next.belt) - number(previous.belt);
  if (beltDelta > 0) events.push({ type: "progress.promotion", fighter: side, belt: number(next.belt) });

  const comboDelta = length(next.triggeredCombos) - length(previous.triggeredCombos);
  if (comboDelta > 0) events.push({ type: "combo.completed", fighter: side, amount: comboDelta });

  return events;
}

export function derivePlaytestEvents(previous: PlaytestMatchSnapshot | null, next: PlaytestMatchSnapshot | null): PlaytestEvent[] {
  if (!previous || !next || previous.schema !== 8 || next.schema !== 8 || !previous.player || !previous.ai || !next.player || !next.ai) return [];

  const combatResolutionEvents = deriveCombatResolutionEvents(previous, next);
  const loggedHitTargets = new Set(combatResolutionEvents.filter((event): event is Extract<PlaytestEvent, { type: "combat.hit" }> => event.type === "combat.hit").map((event) => event.target));
  const events = [
    ...deriveBoardEvents("player", previous.player, next.player, loggedHitTargets),
    ...deriveBoardEvents("ai", previous.ai, next.ai, loggedHitTargets),
    ...combatResolutionEvents,
  ];

  if (previous.locationId && next.locationId && previous.locationId !== next.locationId) events.push({ type: "scene.change" });
  if (!previous.winner && next.winner) events.push({ type: "combat.ko", fighter: otherSide(next.winner), winner: next.winner });

  return events;
}

export function dispatchPlaytestEvent(event: PlaytestEvent) {
  window.dispatchEvent(new CustomEvent<PlaytestEvent>(PLAYTEST_EVENT_NAME, { detail: event }));
}
