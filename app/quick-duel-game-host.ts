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
