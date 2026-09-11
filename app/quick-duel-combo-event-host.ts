import type { ComboHostCardLookup } from "./combo-host-facts.ts";
import type { ComboRuntimeCard } from "./combo-runtime.ts";
import type { RuntimeCommand, RuntimeTrigger } from "./family-effect-runtime.ts";
import {
  activateQuickDuelCombosForEvent,
  publishQuickDuelComboSessions,
  quickDuelAttackRuntimeFacts,
  type QuickDuelAttackRuntimeFacts,
  type QuickDuelComboMatchBoard,
} from "./quick-duel-combo-match-host.ts";
import {
  activateQuickDuelRuntimeStatusesForEvent,
  type QuickDuelRuntimeCommandOperations,
  type QuickDuelRuntimeCommandBoards,
} from "./quick-duel-runtime-command-host.ts";
import type { QuickDuelComboEventFacts } from "./quick-duel-combo-planner.ts";

export type QuickDuelComboHostedEventResult<Board extends QuickDuelComboMatchBoard> = {
  boards: QuickDuelRuntimeCommandBoards<Board>;
  commands: RuntimeCommand[];
  activatedComboIds: string[];
};

export type QuickDuelComboAttackPreparation<Board extends QuickDuelComboMatchBoard> =
  QuickDuelComboHostedEventResult<Board> & {
    attackFacts: QuickDuelAttackRuntimeFacts;
  };

/**
 * Publishes one real gameplay event to already-active Combo sessions and then
 * evaluates learned, not-yet-triggered Combos against that same event.
 *
 * Deferred board statuses consume their matching future event first, existing
 * sessions then receive the event, and newly completed Combos activate last.
 * This prevents the event that completes a Combo from also consuming a future
 * status created by that same completion.
 *
 * This host is intentionally identity-free: card IDs are data supplied through
 * the canonical lookup and no Combo prose is interpreted here.
 */
export function hostQuickDuelComboEvent<Board extends QuickDuelComboMatchBoard>(
  boards: QuickDuelRuntimeCommandBoards<Board>,
  currentCard: ComboRuntimeCard,
  currentZone: string,
  lookup: ComboHostCardLookup,
  trigger: RuntimeTrigger,
  controller: "player" | "ai",
  operations: QuickDuelRuntimeCommandOperations<Board>,
  event: QuickDuelComboEventFacts = {},
): QuickDuelComboHostedEventResult<Board> {
  const deferred = activateQuickDuelRuntimeStatusesForEvent(boards, trigger, controller, operations);
  const published = publishQuickDuelComboSessions(deferred.boards, trigger, controller, operations);
  const activated = activateQuickDuelCombosForEvent(
    published.boards,
    currentCard,
    currentZone,
    lookup,
    trigger,
    controller,
    operations,
    event,
  );
  return {
    boards: activated.boards,
    commands: [...deferred.commands, ...published.commands, ...activated.commands],
    activatedComboIds: activated.activatedComboIds,
  };
}

/**
 * Canonical pre-Attack seam used by Quick Duel before combat math is committed.
 * RuntimeCommands mutate the normal board fields, while non-board combat facts
 * such as Piercing are exposed generically for the host's attack calculation.
 */
export function prepareQuickDuelComboAttack<Board extends QuickDuelComboMatchBoard>(
  boards: QuickDuelRuntimeCommandBoards<Board>,
  attack: ComboRuntimeCard,
  zone: string,
  lookup: ComboHostCardLookup,
  controller: "player" | "ai",
  operations: QuickDuelRuntimeCommandOperations<Board>,
  event: QuickDuelComboEventFacts = {},
): QuickDuelComboAttackPreparation<Board> {
  const hosted = hostQuickDuelComboEvent(
    boards,
    attack,
    zone,
    lookup,
    "onAttackDeclared",
    controller,
    operations,
    event,
  );
  return {
    ...hosted,
    attackFacts: quickDuelAttackRuntimeFacts(hosted.commands),
  };
}
