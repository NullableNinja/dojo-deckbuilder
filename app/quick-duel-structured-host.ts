import {
  applyCharacterEventForHost,
  beginCharacterHostRound,
  beginCharacterHostTurn,
  type CharacterHostBoard,
} from "./character-playtest-bridge.ts";
import type { CharacterRuntimeActor, CharacterRuntimeEvent } from "./character-runtime.ts";
import {
  comboRuntimeContextFromHostFacts,
  type ComboHostBaseContext,
  type ComboHostCardLookup,
  type ComboHostFacts,
} from "./combo-host-facts.ts";
import { comboPlanForHost, type ComboHostPlan } from "./combo-playtest-bridge.ts";
import type { ComboRuntimeCard } from "./combo-runtime.ts";
import type { RuntimeTrigger } from "./family-effect-runtime.ts";

/**
 * Single semantic boundary between Quick Duel and the canonical structured
 * Character/Combo runtimes.
 *
 * Quick Duel owns facts and UI state. This module converts those facts into
 * canonical runtime contexts and publishes generic events. It contains no card
 * names, fighter names, printed-rules parsing, or Core catalog-ID dispatch.
 */
export function comboPlanFromQuickDuelFacts(
  combo: ComboRuntimeCard,
  facts: ComboHostFacts,
  context: ComboHostBaseContext,
  lookup: ComboHostCardLookup,
  completedAt: RuntimeTrigger = "onAttackDeclared",
): ComboHostPlan {
  return comboPlanForHost(combo, comboRuntimeContextFromHostFacts(facts, context, lookup), completedAt);
}

export function publishQuickDuelCharacterEvent<
  SelfBoard extends CharacterHostBoard,
  OpponentBoard extends CharacterHostBoard,
>(
  self: SelfBoard,
  opponent: OpponentBoard,
  event: CharacterRuntimeEvent,
  actor: CharacterRuntimeActor,
) {
  return applyCharacterEventForHost(self, opponent, event, actor);
}

export function beginQuickDuelCharacterTurn<
  SelfBoard extends CharacterHostBoard,
  OpponentBoard extends CharacterHostBoard,
>(self: SelfBoard, opponent: OpponentBoard, actor: CharacterRuntimeActor) {
  return beginCharacterHostTurn(self, opponent, actor);
}

export function beginQuickDuelCharacterRound<
  SelfBoard extends CharacterHostBoard,
  OpponentBoard extends CharacterHostBoard,
>(self: SelfBoard, opponent: OpponentBoard, actor: CharacterRuntimeActor) {
  return beginCharacterHostRound(self, opponent, actor);
}
