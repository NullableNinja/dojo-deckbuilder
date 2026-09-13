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

const KATA_COUNT_MARK = "turn:structuredHost.kataCount";

function isKataCard(event: CharacterRuntimeEvent) {
  const card = event.card;
  if (!card) return false;
  return String(card.subtype ?? card.cardType ?? "").trim().toLocaleLowerCase() === "kata";
}

function kataCount(board: CharacterHostBoard) {
  const value = Number(board.characterMarks?.[KATA_COUNT_MARK] ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

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
  const primary = applyCharacterEventForHost(self, opponent, event, actor);
  if (event.type !== "cardPlayed" || !isKataCard(event) || primary.choices.length > 0) return primary;

  const ordinal = kataCount(primary.self) + 1;
  const countedSelf = {
    ...primary.self,
    characterMarks: {
      ...(primary.self.characterMarks ?? {}),
      [KATA_COUNT_MARK]: ordinal,
    },
  } as SelfBoard;
  return applyCharacterEventForHost(countedSelf, primary.opponent, {
    type: "kataPlayed",
    card: event.card,
    firstKataThisTurn: ordinal === 1,
    secondKataThisTurn: ordinal === 2,
  }, actor);
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
