import {
  activateQuickDuelComboPlan,
  publishQuickDuelComboTrigger,
  resolveQuickDuelComboChoice,
  type QuickDuelComboExecution,
} from "./quick-duel-combo-executor.ts";
import type { ComboHostPlan } from "./combo-playtest-bridge.ts";
import type { ComboRuntimeCard, ComboRuntimeChoice } from "./combo-runtime.ts";
import type { RuntimeCommand, RuntimeTrigger } from "./family-effect-runtime.ts";
import {
  applyQuickDuelRuntimeCommands,
  type QuickDuelRuntimeCommandBoard,
  type QuickDuelRuntimeCommandBoards,
  type QuickDuelRuntimeCommandOperations,
} from "./quick-duel-runtime-command-host.ts";

export type QuickDuelComboSessionResult<Board extends QuickDuelRuntimeCommandBoard> = {
  execution: QuickDuelComboExecution;
  boards: QuickDuelRuntimeCommandBoards<Board>;
  projectedCommands: RuntimeCommand[];
};

export type QuickDuelComboChoiceSessionResult<Board extends QuickDuelRuntimeCommandBoard> = QuickDuelComboSessionResult<Board> & {
  accepted: boolean;
  discardedCardId: string | null;
};

function choiceCommand(choice: ComboRuntimeChoice): RuntimeCommand {
  return {
    sourceEffectId: choice.sourceEffectId,
    effect: "core.choice",
    trigger: "onAttackDeclared",
    target: "self",
    amount: 0,
    duration: "immediate",
    resolver: choice.resolver,
    conditions: [],
    choice: { ...choice },
  };
}

/**
 * Starts a structured Combo session and projects both immediate payoff commands
 * and canonical deferred statuses to the Quick Duel boards. A structured choice
 * is surfaced through the same generic board choice channel used by other
 * runtime families.
 */
export function activateQuickDuelComboOnBoards<Board extends QuickDuelRuntimeCommandBoard>(
  boards: QuickDuelRuntimeCommandBoards<Board>,
  plan: ComboHostPlan,
  completedAt: RuntimeTrigger,
  controller: "player" | "ai",
  operations: QuickDuelRuntimeCommandOperations<Board>,
): QuickDuelComboSessionResult<Board> {
  const activated = activateQuickDuelComboPlan(plan, completedAt);
  if (!activated.execution.active) return { execution: activated.execution, boards, projectedCommands: [] };
  const executed = new Set(activated.execution.executedEffectIds);
  const stillDeferred = plan.deferredOnCompletion.filter((command) => !executed.has(command.sourceEffectId));
  const projectedCommands = [
    ...activated.commands,
    ...stillDeferred,
    ...(activated.execution.pendingChoice ? [choiceCommand(activated.execution.pendingChoice)] : []),
  ];
  return {
    execution: activated.execution,
    boards: applyQuickDuelRuntimeCommands(boards, projectedCommands, controller, operations),
    projectedCommands,
  };
}

/** Project a later onHit/onBlock/afterResolve/etc. trigger for an active Combo. */
export function publishQuickDuelComboTriggerOnBoards<Board extends QuickDuelRuntimeCommandBoard>(
  boards: QuickDuelRuntimeCommandBoards<Board>,
  execution: QuickDuelComboExecution,
  trigger: RuntimeTrigger,
  controller: "player" | "ai",
  operations: QuickDuelRuntimeCommandOperations<Board>,
): QuickDuelComboSessionResult<Board> {
  const published = publishQuickDuelComboTrigger(execution, trigger);
  return {
    execution: published.execution,
    boards: applyQuickDuelRuntimeCommands(boards, published.commands, controller, operations),
    projectedCommands: published.commands,
  };
}

/**
 * Resolves the currently pending structured Combo choice. Card movement is a
 * generic host action: the selected card is removed from hand and placed in the
 * acting fighter's discard, then canonical follow-up commands are projected.
 */
export function resolveQuickDuelComboChoiceOnBoards<Board extends QuickDuelRuntimeCommandBoard>(
  boards: QuickDuelRuntimeCommandBoards<Board>,
  execution: QuickDuelComboExecution,
  combo: ComboRuntimeCard,
  selectedCard: ComboRuntimeCard,
  controller: "player" | "ai",
  operations: QuickDuelRuntimeCommandOperations<Board>,
): QuickDuelComboChoiceSessionResult<Board> {
  const resolved = resolveQuickDuelComboChoice(execution, combo, selectedCard);
  if (!resolved.accepted || !resolved.action) {
    return { execution: resolved.execution, boards, projectedCommands: [], accepted: false, discardedCardId: null };
  }

  let self = boards.self;
  let discardedCardId: string | null = null;
  if (resolved.action.action === "discard") {
    const index = self.hand.indexOf(resolved.action.cardId);
    if (index < 0) {
      return { execution, boards, projectedCommands: [], accepted: false, discardedCardId: null };
    }
    const hand = [...self.hand];
    const [discarded] = hand.splice(index, 1);
    self = { ...self, hand, discard: [...self.discard, discarded] };
    discardedCardId = discarded;
  }

  self = {
    ...self,
    stage3cChoices: (self.stage3cChoices ?? []).filter((choice) => choice.sourceEffectId !== execution.pendingChoice?.sourceEffectId),
  };
  const projected = applyQuickDuelRuntimeCommands({ self, opponent: boards.opponent }, resolved.commands, controller, operations);
  return {
    execution: resolved.execution,
    boards: projected,
    projectedCommands: resolved.commands,
    accepted: true,
    discardedCardId,
  };
}
