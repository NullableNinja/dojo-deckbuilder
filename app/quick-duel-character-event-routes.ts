import { requiredCharacterHostEvents } from "./character-playtest-bridge.ts";
import type { CharacterRuntimeEventType } from "./character-runtime.ts";

export type QuickDuelCharacterEventRoute = {
  event: CharacterRuntimeEventType;
  timing: "transition" | "pre-action" | "phase-boundary";
  hostFact: string;
  reason: string;
};

/**
 * Authoritative Quick Duel publication contract for Character events.
 *
 * This is intentionally about generic game facts/timing, never fighter names.
 * Pre-action events are explicitly separated from transition-derived events so
 * modifiers/choices are resolved before the host commits irreversible state.
 */
export const QUICK_DUEL_CHARACTER_EVENT_ROUTES: readonly QuickDuelCharacterEventRoute[] = [
  { event: "roundStart", timing: "phase-boundary", hostFact: "round increments", reason: "Round-scoped Character state resets before the new Honor begins." },
  { event: "turnStart", timing: "phase-boundary", hostFact: "turnIndex changes or a new round chooses initiative", reason: "Turn-scoped Character state resets before the active fighter acts." },
  { event: "initiate", timing: "phase-boundary", hostFact: "active fighter enters Initiate", reason: "Initiate choices and delayed effects must resolve before Yell." },
  { event: "cardPlayed", timing: "transition", hostFact: "cardsThisTurn gains a card", reason: "Completed card play can publish family/type facts after the card enters play history." },
  { event: "discarded", timing: "transition", hostFact: "discard pile gains a non-Hide discard", reason: "Discard-triggered abilities observe the actual card moved to discard." },
  { event: "speedChanged", timing: "transition", hostFact: "effective temporary Speed changes", reason: "Speed-linked abilities observe the committed Speed change." },
  { event: "attackDeclared", timing: "pre-action", hostFact: "legal Attack and declared zone before defense selection", reason: "Character abilities may change zone or Attack Power before the strike is committed." },
  { event: "incomingAttackDeclared", timing: "pre-action", hostFact: "opponent declares an Attack before Reaction/Defense", reason: "Defender abilities may reduce/ignore modifiers or prompt choices before defense resolution." },
  { event: "hit", timing: "transition", hostFact: "combat exchange outcome is Hit", reason: "Hit rewards observe the certified combat result." },
  { event: "block", timing: "transition", hostFact: "combat exchange outcome is Block", reason: "Block-linked Character rewards observe the certified combat result." },
  { event: "damageIncoming", timing: "pre-action", hostFact: "raw incoming damage before HP removal", reason: "Damage prevention must execute before HP is changed." },
  { event: "equip", timing: "pre-action", hostFact: "legal Equipment chosen before it enters loadout", reason: "Character restrictions and equip-linked effects must resolve before attachment." },
  { event: "kataPlayed", timing: "transition", hostFact: "a Kata enters cardsThisTurn", reason: "Kata-linked Character effects observe the completed play and its ordinal this turn." },
  { event: "comboReveal", timing: "pre-action", hostFact: "Combo offer/reveal before learn resolution", reason: "Reveal replacement/selection abilities require the candidate set before learning." },
  { event: "purchaseAttempt", timing: "pre-action", hostFact: "Market card and base price before Focus is spent", reason: "Character discounts/replacement choices must resolve before payment." },
  { event: "promotion", timing: "transition", hostFact: "belt index increases", reason: "Promotion-linked Character rewards observe the completed certification." },
  { event: "sceneChange", timing: "pre-action", hostFact: "new Location reveal before it becomes final", reason: "Location replacement/reveal abilities require the candidate before final scene commitment." },
  { event: "reboot", timing: "phase-boundary", hostFact: "Reboot/ready window opens", reason: "Equipment lock/ready Character abilities resolve during the reboot window." },
  { event: "hide", timing: "phase-boundary", hostFact: "fighter completes Hide before turn handoff", reason: "Temporary borrowed Equipment and Hide cleanup resolve before the opponent turn begins." },
] as const;

export function quickDuelCharacterEventRoutes() {
  return [...QUICK_DUEL_CHARACTER_EVENT_ROUTES];
}

export function quickDuelCharacterEventCoverage() {
  const required = requiredCharacterHostEvents();
  const routed = new Set(QUICK_DUEL_CHARACTER_EVENT_ROUTES.map((route) => route.event));
  return {
    required,
    routed: [...routed].sort() as CharacterRuntimeEventType[],
    missing: required.filter((event) => !routed.has(event)),
  };
}
