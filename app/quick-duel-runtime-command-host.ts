import { applyStage3CBoardCustomCommand } from "./stage3c-board-command-semantics.ts";
import type { RuntimeChoice, RuntimeCommand, RuntimeStatus, RuntimeTrigger } from "./family-effect-runtime.ts";

export type QuickDuelRuntimeCommandBoard = {
  hp: number;
  maxHp: number;
  xp: number;
  focus: number;
  focusGeneratedThisTurn?: number;
  tempSpeed: number;
  nextAttackBonus: number;
  nextDefenseCardBonus?: number;
  nextAttackHasFlow: boolean;
  nextAttackAnyZone: boolean;
  damageTaken: number;
  damageDealt?: number;
  speedChangedThisRound?: boolean;
  hand: string[];
  discard: string[];
  stage3cStatuses?: RuntimeStatus[];
  stage3cChoices?: RuntimeChoice[];
  stage3cRestrictions?: string[];
  stage3cDefenseModifier?: number;
  stage3cAttackModifier?: number;
  stage3cSpeedOverride?: number | null;
  stage3cPurchaseCostModifier?: number;
};

export type QuickDuelRuntimeCommandOperations<Board extends QuickDuelRuntimeCommandBoard> = {
  draw: (board: Board, amount: number) => Board;
  discardForAi?: (board: Board, amount: number, command: RuntimeCommand) => Board;
};

export type QuickDuelRuntimeCommandBoards<Board extends QuickDuelRuntimeCommandBoard> = {
  self: Board;
  opponent: Board;
};

export type QuickDuelRuntimeStatusEventFacts = {
  /** Compatibility escape hatch for hosts that can prove this Attack is later-turn. */
  nextTurn?: boolean;
};

export type QuickDuelRuntimeStatusActivation<Board extends QuickDuelRuntimeCommandBoard> = {
  boards: QuickDuelRuntimeCommandBoards<Board>;
  commands: RuntimeCommand[];
};

function statusFromCommand(command: RuntimeCommand, appliedImmediately = false): RuntimeStatus {
  return {
    sourceEffectId: command.sourceEffectId,
    effect: command.effect,
    target: "self",
    amount: command.amount,
    duration: command.duration,
    resolver: command.resolver,
    qualifier: command.qualifier,
    appliedImmediately,
  };
}

function addStatus<Board extends QuickDuelRuntimeCommandBoard>(board: Board, command: RuntimeCommand, appliedImmediately = false): Board {
  return {
    ...board,
    stage3cStatuses: [
      ...(board.stage3cStatuses ?? []).filter((status) => status.sourceEffectId !== command.sourceEffectId),
      statusFromCommand(command, appliedImmediately),
    ],
  };
}

function addChoice<Board extends QuickDuelRuntimeCommandBoard>(board: Board, command: RuntimeCommand): Board {
  const choice: RuntimeChoice = {
    sourceEffectId: command.sourceEffectId,
    resolver: command.resolver ?? "core.choice",
    target: "self",
    amount: command.amount,
    payload: command.choice ?? {},
  };
  return {
    ...board,
    stage3cChoices: [
      ...(board.stage3cChoices ?? []).filter((entry) => entry.sourceEffectId !== choice.sourceEffectId),
      choice,
    ],
  };
}

function gainFocus<Board extends QuickDuelRuntimeCommandBoard>(board: Board, amount: number): Board {
  const gain = Math.max(0, Number(amount) || 0);
  if (!gain) return board;
  return {
    ...board,
    focus: board.focus + gain,
    focusGeneratedThisTurn: (board.focusGeneratedThisTurn ?? 0) + gain,
  };
}

function applyToBoard<Board extends QuickDuelRuntimeCommandBoard>(
  board: Board,
  command: RuntimeCommand,
  controller: "player" | "ai",
  operations: QuickDuelRuntimeCommandOperations<Board>,
): Board {
  let next = board;
  if (command.choice || command.effect === "core.choice") return addChoice(next, command);

  if (command.qualifier?.restriction) {
    next = {
      ...next,
      stage3cRestrictions: [...new Set([...(next.stage3cRestrictions ?? []), String(command.qualifier.restriction)])],
    };
  }

  if (command.duration !== "immediate") {
    const standingSpeed = command.effect === "combat.modifySpeed" && ["endOfTurn", "endOfRound", "nextHonor"].includes(command.duration);
    const standingDefense = command.effect === "combat.modifyDefense" && ["endOfTurn", "endOfRound", "nextHonor", "nextTurn"].includes(command.duration);
    const standingCost = command.effect === "economy.modifyCost" && ["endOfTurn", "nextTurn", "nextPurchase"].includes(command.duration) && command.qualifier?.minPrintedCost === undefined;
    if (standingSpeed) next = { ...next, tempSpeed: next.tempSpeed + command.amount, speedChangedThisRound: Boolean(next.speedChangedThisRound || command.amount !== 0) };
    if (standingDefense) next = { ...next, stage3cDefenseModifier: (next.stage3cDefenseModifier ?? 0) + command.amount };
    if (standingCost) next = { ...next, stage3cPurchaseCostModifier: (next.stage3cPurchaseCostModifier ?? 0) + command.amount };

    const custom = applyStage3CBoardCustomCommand({
      attackModifier: next.stage3cAttackModifier ?? 0,
      defenseModifier: next.stage3cDefenseModifier ?? 0,
      speedOverride: next.stage3cSpeedOverride ?? null,
    }, command);
    if (custom.handled) {
      next = {
        ...next,
        stage3cAttackModifier: custom.state.attackModifier,
        stage3cDefenseModifier: custom.state.defenseModifier,
        stage3cSpeedOverride: custom.state.speedOverride,
        speedChangedThisRound: Boolean(next.speedChangedThisRound || custom.state.speedOverride !== null),
      };
    }
    if (command.effect === "core.gainFocus" && command.qualifier?.spendOnlyOn) next = gainFocus(next, command.amount);
    return addStatus(next, command, standingSpeed || standingDefense || standingCost || custom.handled);
  }

  switch (command.effect) {
    case "core.draw": return operations.draw(next, command.amount);
    case "core.discard":
      if (!next.hand.length || command.amount <= 0) return next;
      if (controller === "ai" && operations.discardForAi) return operations.discardForAi(next, command.amount, command);
      return addChoice(next, { ...command, choice: { resolver: command.resolver ?? "core.discard", count: command.amount } });
    case "core.heal": return { ...next, hp: Math.min(next.maxHp, next.hp + Math.max(0, command.amount)) };
    case "core.gainFocus": return gainFocus(next, command.amount);
    case "core.gainXP": return { ...next, xp: Math.max(0, next.xp + command.amount) };
    case "combat.modifySpeed": return { ...next, tempSpeed: next.tempSpeed + command.amount, speedChangedThisRound: Boolean(next.speedChangedThisRound || command.amount !== 0) };
    case "combat.modifyAttackPower": return { ...next, nextAttackBonus: next.nextAttackBonus + command.amount };
    case "combat.modifyDefense": return { ...next, stage3cDefenseModifier: (next.stage3cDefenseModifier ?? 0) + command.amount };
    case "combat.modifyGuard": return { ...next, nextDefenseCardBonus: (next.nextDefenseCardBonus ?? 0) + command.amount };
    case "combat.dealDamage": {
      const damage = Math.max(0, command.amount);
      return { ...next, hp: Math.max(0, next.hp - damage), damageTaken: next.damageTaken + damage };
    }
    case "combat.grantFlow": return { ...next, nextAttackHasFlow: true };
    case "combat.chooseZone": return { ...next, nextAttackAnyZone: true };
    case "economy.modifyCost": return { ...next, stage3cPurchaseCostModifier: (next.stage3cPurchaseCostModifier ?? 0) + command.amount };
    case "combat.preventDamage": return addStatus(next, { ...command, duration: "nextDamage" });
    case "core.custom": {
      if (!command.resolver) return next;
      const custom = applyStage3CBoardCustomCommand({
        attackModifier: next.stage3cAttackModifier ?? 0,
        defenseModifier: next.stage3cDefenseModifier ?? 0,
        speedOverride: next.stage3cSpeedOverride ?? null,
      }, command);
      return custom.handled
        ? { ...next, stage3cAttackModifier: custom.state.attackModifier, stage3cDefenseModifier: custom.state.defenseModifier, stage3cSpeedOverride: custom.state.speedOverride }
        : { ...next, stage3cRestrictions: [...new Set([...(next.stage3cRestrictions ?? []), command.resolver])] };
    }
    default: return next;
  }
}

/**
 * Projects canonical RuntimeCommands onto Quick Duel board state. Target routing
 * is generic: opponent-targeted commands go to the opposing board; all other
 * command targets are hosted by the acting board unless a later choice selects
 * a concrete card/equipment object.
 */
export function applyQuickDuelRuntimeCommands<Board extends QuickDuelRuntimeCommandBoard>(
  boards: QuickDuelRuntimeCommandBoards<Board>,
  commands: readonly RuntimeCommand[],
  controller: "player" | "ai",
  operations: QuickDuelRuntimeCommandOperations<Board>,
): QuickDuelRuntimeCommandBoards<Board> {
  let self = boards.self;
  let opponent = boards.opponent;
  for (const command of commands) {
    if (command.target === "opponent") {
      opponent = applyToBoard(opponent, { ...command, target: "self" }, controller === "player" ? "ai" : "player", operations);
      if (command.effect === "combat.dealDamage") {
        const damage = Math.max(0, command.amount);
        self = { ...self, damageDealt: (self.damageDealt ?? 0) + damage };
      }
    } else self = applyToBoard(self, { ...command, target: "self" }, controller, operations);
  }
  return { self, opponent };
}

function nextTurnAttackArmed(status: RuntimeStatus) {
  return status.qualifier?.nextTurnAttackArmed === true;
}

function armNextTurnAttackStatuses(statuses: readonly RuntimeStatus[]) {
  return statuses.map((status) => {
    if (status.appliedImmediately || String(status.qualifier?.activateAt ?? "") !== "nextTurnAttack") return status;
    return {
      ...status,
      qualifier: { ...(status.qualifier ?? {}), nextTurnAttackArmed: true },
    };
  });
}

function deferredStatusMatchesEvent(
  status: RuntimeStatus,
  trigger: RuntimeTrigger,
  facts: QuickDuelRuntimeStatusEventFacts,
) {
  if (status.appliedImmediately) return false;
  const activateAt = String(status.qualifier?.activateAt ?? "");
  if (activateAt === "nextInitiate") return trigger === "onInitiate";
  if (activateAt === "nextTurnAttack") {
    return trigger === "onAttackDeclared" && (nextTurnAttackArmed(status) || facts.nextTurn === true);
  }
  return false;
}

function commandFromDeferredStatus(status: RuntimeStatus, trigger: RuntimeTrigger): RuntimeCommand {
  return {
    sourceEffectId: status.sourceEffectId,
    effect: status.effect,
    trigger,
    target: status.target,
    amount: status.amount,
    duration: "immediate",
    resolver: status.resolver,
    conditions: [],
    qualifier: status.qualifier,
  };
}

/**
 * Advances canonical deferred statuses at gameplay lifecycle events.
 *
 * Initiate has two responsibilities that are both data-driven: resolve effects
 * whose activateAt is nextInitiate, and arm any existing nextTurnAttack effects
 * for the coming turn. Statuses created after Initiate remain unarmed and wait
 * for the following Initiate, so a same-turn second Attack cannot consume them.
 *
 * Only statuses explicitly carrying an activateAt qualifier are eligible, so
 * ordinary standing modifiers are never replayed by this lifecycle hook.
 */
export function activateQuickDuelRuntimeStatusesForEvent<Board extends QuickDuelRuntimeCommandBoard>(
  boards: QuickDuelRuntimeCommandBoards<Board>,
  trigger: RuntimeTrigger,
  controller: "player" | "ai",
  operations: QuickDuelRuntimeCommandOperations<Board>,
  facts: QuickDuelRuntimeStatusEventFacts = {},
): QuickDuelRuntimeStatusActivation<Board> {
  const statuses = boards.self.stage3cStatuses ?? [];
  const activating = statuses.filter((status) => deferredStatusMatchesEvent(status, trigger, facts));
  const activatingIds = new Set(activating.map((status) => status.sourceEffectId));
  const surviving = statuses.filter((status) => !activatingIds.has(status.sourceEffectId));
  const advancedStatuses = trigger === "onInitiate" ? armNextTurnAttackStatuses(surviving) : surviving;

  if (!activating.length) {
    if (advancedStatuses === statuses || advancedStatuses.every((status, index) => status === statuses[index])) return { boards, commands: [] };
    return {
      boards: {
        self: { ...boards.self, stage3cStatuses: advancedStatuses } as Board,
        opponent: boards.opponent,
      },
      commands: [],
    };
  }

  const self = {
    ...boards.self,
    stage3cStatuses: advancedStatuses,
  } as Board;
  const commands = activating.map((status) => commandFromDeferredStatus(status, trigger));
  return {
    boards: applyQuickDuelRuntimeCommands({ self, opponent: boards.opponent }, commands, controller, operations),
    commands,
  };
}
