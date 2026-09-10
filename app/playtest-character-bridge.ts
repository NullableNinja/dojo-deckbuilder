import {
  applyCharacterRuntimeEvent,
  characterAllowedAttackZones,
  characterAttackModifier,
  characterCanEquip,
  characterDamageReduction,
  resetCharacterRound,
  resetCharacterTurn,
  type CharacterRuntimeActor,
  type CharacterRuntimeBoard,
  type CharacterRuntimeCard,
  type CharacterRuntimeChoice,
  type CharacterRuntimeEvent,
} from "./character-runtime.ts";
import { structuredRuntimeEffects } from "./family-effect-runtime.ts";

export type CharacterHostBoard = CharacterRuntimeBoard & Record<string, unknown>;
export type CharacterHostCard = CharacterRuntimeCard & { name: string; catalogId?: string | null };

const hasTag = (card: CharacterHostCard, tag: string) => (card.tags ?? []).some((value) => value.toLocaleLowerCase() === tag.toLocaleLowerCase());

/**
 * Thin Quick Duel boundary for canonical Character mechanics.
 *
 * The host supplies ordinary gameplay facts. Character identity is used only to
 * select structured data inside character-runtime; this bridge contains no
 * Character IDs, names, printed-text parsing, or per-character numeric rules.
 */
export function characterAttackForHost(
  board: CharacterHostBoard,
  opponent: CharacterHostBoard,
  card: CharacterHostCard,
  context: {
    zone?: string;
    firstAttackThisTurn?: boolean;
    usedConsumableThisTurn?: boolean;
    differentZoneFromPreviousAttack?: boolean;
    playedKataEarlierThisTurn?: boolean;
    changedZone?: boolean;
  } = {},
) {
  return characterAttackModifier(board, opponent, card, {
    type: "attackDeclared",
    card,
    zone: context.zone,
    firstAttackThisTurn: context.firstAttackThisTurn ?? board.attacksThisTurn === 0,
    usedConsumableThisTurn: context.usedConsumableThisTurn ?? board.usedConsumableThisRound,
    differentZoneFromPreviousAttack: context.differentZoneFromPreviousAttack,
    playedKataEarlierThisTurn: context.playedKataEarlierThisTurn,
    changedZone: context.changedZone,
    hasWeaponEquipped: board.equipment.length > 0 && contextHasWeapon(board, card),
  });
}

function contextHasWeapon(board: CharacterHostBoard, currentCard: CharacterHostCard) {
  // Character runtime only needs the boolean fact. If the current Attack itself
  // is Weapon-tagged, that is sufficient; equipment-card lookup stays with the host.
  return hasTag(currentCard, "Weapon") || Boolean((board.characterMarks ?? {})["host:hasWeaponEquipped"]);
}

export function characterAttackZonesForHost(board: CharacterHostBoard, card: CharacterHostCard, printedZones: string[]) {
  return characterAllowedAttackZones(board, card, printedZones);
}

export function characterCanEquipForHost(board: CharacterHostBoard, card: CharacterHostCard) {
  return characterCanEquip(board, card);
}

export function characterDamageForHost(board: CharacterHostBoard, damage: number) {
  return characterDamageReduction(board, damage);
}

export function characterHasResolverForHost(board: CharacterHostBoard, resolver: string) {
  return structuredRuntimeEffects({ catalogId: board.fighterId }).some((effect) => effect.resolver === resolver);
}

export function characterEventForHost(
  self: CharacterHostBoard,
  opponent: CharacterHostBoard,
  event: CharacterRuntimeEvent,
  actor: CharacterRuntimeActor,
) {
  const result = applyCharacterRuntimeEvent(self, opponent, event, actor);
  return {
    self: result.self as CharacterHostBoard,
    opponent: result.opponent as CharacterHostBoard,
    event: result.event,
    choices: result.choices,
    notes: result.notes,
  };
}

export function characterChoiceForHost(choice: CharacterRuntimeChoice) {
  const kind = choice.selectionField === "selectedZone"
    ? "chooseZone"
    : choice.selectionField === "selectedMode" || choice.selectionField === "optionalAccepted"
      ? "chooseMode"
      : "chooseCard";
  return {
    kind,
    sourceEffectId: choice.effectId,
    resolver: choice.resolver,
    prompt: choice.prompt,
    options: choice.options,
    optional: choice.optional,
    selectionField: choice.selectionField,
  } as const;
}

export function resetCharacterHostTurn<T extends CharacterHostBoard>(board: T) {
  return resetCharacterTurn(board) as T;
}

export function resetCharacterHostRound<T extends CharacterHostBoard>(board: T) {
  return resetCharacterRound(board) as T;
}
