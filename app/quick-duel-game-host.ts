export {
  applyQuickDuelStructuredTransition,
  comboHostFactsFromBoard,
  quickDuelComboFactsKey,
  withComboHostFacts,
  type QuickDuelTransitionBoard,
  type QuickDuelTransitionExchange,
  type QuickDuelTransitionMatch,
} from "./quick-duel-transition-host.ts";

export {
  comboPlanFromQuickDuelFacts,
  beginQuickDuelCharacterRound,
  beginQuickDuelCharacterTurn,
} from "./quick-duel-structured-host.ts";

export {
  comboContextFromQuickDuelBoard,
  quickDuelComboPlansForEvent,
  type QuickDuelComboCandidatePlan,
  type QuickDuelComboEventFacts,
  type QuickDuelComboPlanningBoard,
} from "./quick-duel-combo-planner.ts";

export {
  activateQuickDuelComboPlan,
  closeQuickDuelComboExecution,
  publishQuickDuelComboTrigger,
  resolveQuickDuelComboChoice,
  type ComboChoiceResult,
  type ComboHostChoiceAction,
  type ComboTriggerResult,
  type QuickDuelComboExecution,
} from "./quick-duel-combo-executor.ts";

export {
  activateQuickDuelComboOnBoards,
  publishQuickDuelComboTriggerOnBoards,
  resolveQuickDuelComboChoiceOnBoards,
  type QuickDuelComboChoiceSessionResult,
  type QuickDuelComboSessionResult,
} from "./quick-duel-combo-session-host.ts";

export {
  activateQuickDuelCombosForEvent,
  publishQuickDuelComboSessions,
  quickDuelActiveComboExecutions,
  quickDuelAttackRuntimeFacts,
  resolveQuickDuelComboSessionChoice,
  type QuickDuelAttackRuntimeFacts,
  type QuickDuelComboMatchBoard,
  type QuickDuelComboMatchResult,
} from "./quick-duel-combo-match-host.ts";

export {
  hostQuickDuelComboEvent,
  prepareQuickDuelComboAttack,
  type QuickDuelComboAttackPreparation,
  type QuickDuelComboHostedEventResult,
} from "./quick-duel-combo-event-host.ts";

export {
  activateQuickDuelRuntimeStatusesForEvent,
  applyQuickDuelRuntimeCommands,
  type QuickDuelRuntimeCommandBoard,
  type QuickDuelRuntimeCommandBoards,
  type QuickDuelRuntimeCommandOperations,
  type QuickDuelRuntimeStatusActivation,
  type QuickDuelRuntimeStatusEventFacts,
} from "./quick-duel-runtime-command-host.ts";

export {
  publishQuickDuelCharacterEventSafely,
  type QuickDuelCharacterPublication,
} from "./quick-duel-character-executor.ts";

export {
  quickDuelCharacterEventHasCompatibilityConflict,
  quickDuelCharacterResolverOwnership,
  quickDuelCompatibilityOwnedResolvers,
  quickDuelEventRuntimeOwnedResolvers,
} from "./quick-duel-character-migration.ts";

/**
 * Public semantic boundary for the Quick Duel Playtest.
 *
 * This module deliberately contains no gameplay rules. It is a facade over
 * canonical JSON-backed runtimes and generic match-fact adapters so the React
 * Playtest does not need to import individual family rule engines.
 */
export const QUICK_DUEL_GAME_HOST_CONTRACT = "canonical-json-structured-runtime" as const;
