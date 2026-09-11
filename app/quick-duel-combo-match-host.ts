import type { ComboHostCardLookup } from "./combo-host-facts.ts";
import type { ComboRuntimeCard } from "./combo-runtime.ts";
import type { RuntimeCommand, RuntimeTrigger } from "./family-effect-runtime.ts";
import {
  quickDuelComboPlansForEvent,
  type QuickDuelComboEventFacts,
  type QuickDuelComboPlanningBoard,
} from "./quick-duel-combo-planner.ts";
import type { QuickDuelComboExecution } from "./quick-duel-combo-executor.ts";
import {
  activateQuickDuelComboOnBoards,
  publishQuickDuelComboTriggerOnBoards,
  resolveQuickDuelComboChoiceOnBoards,
} from "./quick-duel-combo-session-host.ts";
import type {
  QuickDuelRuntimeCommandBoard,
  QuickDuelRuntimeCommandBoards,
  QuickDuelRuntimeCommandOperations,
} from "./quick-duel-runtime-command-host.ts";

const COMBO_EXECUTIONS_MARK = "structuredHost.comboExecutions";

export type QuickDuelComboMatchBoard = QuickDuelComboPlanningBoard & QuickDuelRuntimeCommandBoard & {
  comboTriggered?: boolean;
  characterMarks?: Record<string, unknown>;
};

export type QuickDuelComboMatchResult<Board extends QuickDuelComboMatchBoard> = {
  boards: QuickDuelRuntimeCommandBoards<Board>;
  commands: RuntimeCommand[];
  activatedComboIds: string[];
};

export type QuickDuelAttackRuntimeFacts = {
  piercing: number;
};

type ExecutionRegistry = Record<string, QuickDuelComboExecution>;

function executionRegistry(board: QuickDuelComboMatchBoard): ExecutionRegistry {
  const raw = board.characterMarks?.[COMBO_EXECUTIONS_MARK];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return { ...(raw as ExecutionRegistry) };
}

function withExecutionRegistry<Board extends QuickDuelComboMatchBoard>(board: Board, registry: ExecutionRegistry): Board {
  return {
    ...board,
    characterMarks: {
      ...(board.characterMarks ?? {}),
      [COMBO_EXECUTIONS_MARK]: registry,
    },
  };
}

function markComboTriggered<Board extends QuickDuelComboMatchBoard>(board: Board, comboId: string): Board {
  return {
    ...board,
    triggeredCombos: [...new Set([...(board.triggeredCombos ?? []), comboId])],
    comboTriggered: true,
  };
}

export function quickDuelActiveComboExecutions(board: QuickDuelComboMatchBoard) {
  return executionRegistry(board);
}

/**
 * Extract attack-resolution facts that are not persistent board modifiers from
 * generic RuntimeCommands. React never needs to know which Combo produced them.
 */
export function quickDuelAttackRuntimeFacts(commands: readonly RuntimeCommand[]): QuickDuelAttackRuntimeFacts {
  return {
    piercing: commands
      .filter((command) => command.effect === "combat.piercing")
      .reduce((total, command) => total + Number(command.amount ?? 0), 0),
  };
}

/**
 * Evaluate all learned, not-yet-triggered Combos for one generic gameplay event,
 * activate every eligible canonical plan, project its RuntimeCommands, and keep
 * the execution session on the board for later triggers. No Combo identity or
 * printed requirement is interpreted here.
 */
export function activateQuickDuelCombosForEvent<Board extends QuickDuelComboMatchBoard>(
  boards: QuickDuelRuntimeCommandBoards<Board>,
  currentCard: ComboRuntimeCard,
  currentZone: string,
  lookup: ComboHostCardLookup,
  trigger: RuntimeTrigger,
  controller: "player" | "ai",
  operations: QuickDuelRuntimeCommandOperations<Board>,
  event: QuickDuelComboEventFacts = {},
): QuickDuelComboMatchResult<Board> {
  let self = boards.self;
  let opponent = boards.opponent;
  const commands: RuntimeCommand[] = [];
  const activatedComboIds: string[] = [];
  let registry = executionRegistry(self);

  for (const candidate of quickDuelComboPlansForEvent(self, currentCard, currentZone, lookup, trigger, event)) {
    if (registry[candidate.comboId]?.active) continue;
    const activated = activateQuickDuelComboOnBoards({ self, opponent }, candidate.plan, trigger, controller, operations);
    self = markComboTriggered(activated.boards.self, candidate.comboId);
    opponent = activated.boards.opponent;
    registry = { ...registry, [candidate.comboId]: activated.execution };
    self = withExecutionRegistry(self, registry);
    commands.push(...activated.projectedCommands);
    activatedComboIds.push(candidate.comboId);
  }

  return { boards: { self, opponent }, commands, activatedComboIds };
}

/** Publish a later canonical trigger to every active Combo execution. */
export function publishQuickDuelComboSessions<Board extends QuickDuelComboMatchBoard>(
  boards: QuickDuelRuntimeCommandBoards<Board>,
  trigger: RuntimeTrigger,
  controller: "player" | "ai",
  operations: QuickDuelRuntimeCommandOperations<Board>,
): QuickDuelComboMatchResult<Board> {
  let self = boards.self;
  let opponent = boards.opponent;
  let registry = executionRegistry(self);
  const commands: RuntimeCommand[] = [];

  for (const [comboId, execution] of Object.entries(registry)) {
    if (!execution.active) continue;
    const published = publishQuickDuelComboTriggerOnBoards({ self, opponent }, execution, trigger, controller, operations);
    self = published.boards.self;
    opponent = published.boards.opponent;
    registry = { ...registry, [comboId]: published.execution };
    self = withExecutionRegistry(self, registry);
    commands.push(...published.projectedCommands);
  }

  return { boards: { self, opponent }, commands, activatedComboIds: [] };
}

/**
 * Resolve a canonical Combo choice by its source effect. The selected card is
 * validated by the Combo executor and generic hand/discard movement is handled
 * by the session host.
 */
export function resolveQuickDuelComboSessionChoice<Board extends QuickDuelComboMatchBoard>(
  boards: QuickDuelRuntimeCommandBoards<Board>,
  comboId: string,
  combo: ComboRuntimeCard,
  selectedCard: ComboRuntimeCard,
  controller: "player" | "ai",
  operations: QuickDuelRuntimeCommandOperations<Board>,
) {
  const registry = executionRegistry(boards.self);
  const execution = registry[comboId];
  if (!execution?.active || !execution.pendingChoice) {
    return { boards, accepted: false, commands: [] as RuntimeCommand[] };
  }
  const resolved = resolveQuickDuelComboChoiceOnBoards(boards, execution, combo, selectedCard, controller, operations);
  const nextRegistry = { ...registry, [comboId]: resolved.execution };
  const self = withExecutionRegistry(resolved.boards.self, nextRegistry);
  return { boards: { self, opponent: resolved.boards.opponent }, accepted: resolved.accepted, commands: resolved.projectedCommands };
}
