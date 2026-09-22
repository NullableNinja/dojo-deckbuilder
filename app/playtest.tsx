import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type SetStateAction } from "react";
import cardPlaceholderUrl from "./assets/art/card-placeholder-v2.webp";
import starterJabArtUrl from "./assets/starter/starter-jab-art-v2.webp";
import highGuardArtUrl from "./assets/starter/high-guard-art-v2.webp";
import cardsJson from "./data/cards.json";
import gameDefinitionJson from "./data/game-definition.json";
import { describeEffectPlan, effectPlanForCard, structuredEffectsForCard } from "./card-effects";
import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, attackPiercing, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, deckLookPlan, defenseEquipmentBonus, destroyJunkChoiceCount, destroyJunkChoicePlan, destroysAfterUse, discardChoiceFollowup, equipmentActivationPlan, equipmentConditionalAttackPowerBonus, equipmentOnEquipPlan, equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, mandatoryDamageReductionEquipment, mandatoryDiscardChoiceCount, optionalCombatDamageReductionEquipment, optionalDiscardDrawChoice, passiveEquipmentGuard, postBlockEquipmentCycle, readyEquipmentOnHit, returnsToSupplyAfterUse, targetDiscardOnHitCount, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor, afterDefenseAttackPowerBonus, nextAttackArmorPenalty, structuredConditionalCycle, structuredConditionalFocus, structuredCurrentAttackFlow, structuredFocusIfFastest, structuredNextAttackAnyZone, structuredNextAttackFlow, type DeckLookPlan } from "./effect-resolvers";
import { comboPayoffText, comboRequirementText, evaluateCombo } from "./combo-engine";
import { comboChoiceOnAttack, comboCommandsForTrigger, comboDeferredCommandsOnCompletion } from "./combo-runtime";
import { finalAttackAllowedZones, finalAttackCycle, finalAttackEquipmentSuppression, finalAttackFocusReward, finalAttackHitChoice, finalAttackOnlyAttackLock, finalAttackPowerBonus } from "./attack-final-effects";
import { defenseRuntimeCommands, type DefenseRuntimeContext } from "./defense-effect-resolvers";
import { consumableRuntimeCommands, structuredConsumableMandatoryDiscard, type ConsumableRuntimeContext } from "./consumable-effect-resolvers";
import { canPlayCoreConsumableInPhase, stage3cRestrictionBlocks } from "./stage3c-consumable-play-window.ts";
import { armConsumableAttackFollowupStatuses, isConsumableAttackFollowupStatus, resolveConsumableAttackFollowupStatuses } from "./stage3c-consumable-attack-followup.ts";
import { armConsumableHideStatuses, resolveConsumableHideStatuses } from "./stage3c-consumable-hide-followup.ts";
import { chooseAiDefensiveConsumable } from "./stage3c-consumable-reaction-ai.ts";
import { firstEventReactionCard, hasUntargetableStatus } from "./stage3c-consumable-event-reactions.ts";
import { canPlayCoreReactionItem, chooseAiReactionItem, resolveQuickDuelReactionItem, resolveQuickDuelReactionItemEvent, resolveReactionItemIncomingAttackOutcome, type ReactionItemRuntimeContext } from "./reaction-item-runtime.ts";
import { consumeQualifiedNextComboLearnDiscount, consumeQualifiedNextPurchaseStatuses, qualifiedNextComboLearnDiscount, qualifiedNextPurchaseDiscount, spendableFocusForPurchase, spendFocusForPurchase } from "./stage3c-consumable-surface.ts";
import { applyStage3CBoardCustomCommand, revertStage3CBoardCustomStatus } from "./stage3c-board-command-semantics.ts";
import { chooseAiTemporaryStatusRemoval, removableTemporaryStatuses, removeTemporaryStatus } from "./stage3c-consumable-status-removal.ts";
import { structuredConsumableTopRevealPlan } from "./stage3c-consumable-reveal.ts";
import { consumeNextDefenseStatuses, consumeNextIncomingAttackStatuses, nextDefenseGuardBonus, nextIncomingAttackDefenseBonus } from "./stage3c-defense-status-semantics.ts";
import { structuredRuntimeEffects, structuredRuntimeResolvers, type RuntimeChoice, type RuntimeCommand, type RuntimeStatus, type RuntimeTrigger } from "./family-effect-runtime";
import { isCoreKataCard, kataEquipFromHandPlanForHost, kataRuntimeCommandsForHost, type KataHostFacts } from "./kata-playtest-bridge.ts";
import { expirePreventionAtNextInitiate, resolveNextDamagePreventionStatuses } from "./structured-damage-prevention.ts";
import { type CharacterRuntimeChoice, type CharacterRuntimeEvent } from "./character-runtime";
import { characterAttackZonesForHost } from "./playtest-character-bridge.ts";
import { structuredEquipmentAfterResolveResolution, structuredEquipmentAttackDeclarationResolution, structuredEquipmentBlockResolution, structuredEquipmentCurrentAttackFlow, structuredEquipmentDamagePrevention, structuredEquipmentEffects, structuredEquipmentHitResolution, structuredEquipmentMinimumSpeed, structuredEquipmentPurchaseResolution, structuredEquipmentRestrictions, structuredEquipmentSpeedModifier, structuredEquipmentSpeedPenaltyProtection, structuredEquipmentThresholdProtection } from "./equipment-structured.ts";
import { equipmentHandLimit, repairEquipmentHandLimit } from "./equipment-hand-limit.ts";
import { queueOpponentCardModification, runtimeCommandCardModificationTypes } from "./character-card-modification-facts";
import { commitQuickDuelCharacterPurchase, previewQuickDuelCharacterPurchasePrice } from "./quick-duel-character-purchase-host";
import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestAttackDeclared, publishQuickDuelPlaytestCharacterEvent, publishQuickDuelPlaytestDamageIncoming, publishQuickDuelPlaytestDamageIncoming as publishCharacterDamageIncoming, publishQuickDuelPlaytestEquip, publishQuickDuelPlaytestLifecycleEvent, resolveQuickDuelPlaytestCharacterChoice, type QuickDuelPlaytestAttackDeclarationResult } from "./quick-duel-playtest-host";
import type { PlaytestCombatExchange } from "../src/playtest-events";
import { fetchRulesManifest, rulesSyncState, type RulesSyncState } from "./rules-client";
import { normalizePendingDamageChoice } from "./playtest-state-recovery";
import { QUICK_DUEL_HOUSE_RULES, effectiveBeltThresholds, hasQuickDuelHouseRule, sanitizeQuickDuelHouseRuleIds, shouldRefreshMarketAtRoundEnd } from "./playtest-house-rules";
import { QUICK_DUEL_TRAINING_STRIPE_HEAL_REQUEST_EVENT, spendQuickDuelTrainingStripeForHealing } from "./quick-duel-training-stripes.ts";
import { markQuickDuelBeltCheckAction, quickDuelBeltCheckActionAvailability } from "./quick-duel-belt-check-actions.ts";
import { resolveLocationHostEvent, structuredLocationDefenseForHost, structuredLocationKataFocusForHost } from "./location-playtest-bridge.ts";
import { createBossRuntimeState, resolveBossCardEvent } from "./boss-runtime.ts";

/**
 * QUICK DUEL REACT SHELL
 *
 * This file coordinates the browser experience; it is not the rules database.
 *
 * What belongs here:
 * - React state, dialogs, controls, and turn/phase orchestration.
 * - Translating player/AI actions into generic runtime and host calls.
 * - Presenting the canonical state returned by those hosts.
 *
 * What does NOT belong here:
 * - New card-specific rules, costs, stats, or effect definitions.
 * - New identity-specific mechanics that can be expressed in canonical JSON plus
 *   a generic resolver/host.
 *
 * Canonical truth lives under content/*.json and is generated into app/data/*.json.
 * Printed rules text is presentation-only. Runtime behavior must come from the
 * generated structured registry and the shared host/resolver modules.
 */

const CardInspector = lazy(() => import("./card-inspector").then((module) => ({ default: module.CardInspector })));

// -----------------------------------------------------------------------------
// REACT-SIDE STATE SHAPES
// These types describe the state the UI needs to render and coordinate Quick Duel.
// They do not define canonical card/rule content; that comes from generated JSON.
// -----------------------------------------------------------------------------

type CardEntry = {
  id: string;
  name: string;
  cardType: string;
  subtype: string;
  category?: string | null;
  catalogId: string;
  catalogOrder: number;
  deck: string;
  lineage?: string | null;
  availability?: string | null;
  fpCost?: string | number | null;
  chiCost?: string | number | null;
  focusValue?: string | number | null;
  zone?: string | null;
  timing?: string | null;
  rulesText?: string | null;
  flavorText?: string | null;
  tags: string[];
  buildPaths: string[];
  stats: Record<string, string | number>;
  image?: string | null;
  sourceSheet: string;
  sourceRulesVersion?: string | null;
  details: Record<string, string | number>;
};

type Board = {
  fighterId: string;
  hp: number;
  maxHp: number;
  xp: number;
  focus: number;
  focusGeneratedThisTurn?: number;
  focusSpentThisTurn?: number;
  belt: number;
  deck: string[];
  hand: string[];
  discard: string[];
  playArea: string[];
  equipment: string[];
  exhaustedEquipment?: string[];
  equipmentAttackPlan?: { sourceCardId: string; zone: string; power: number; piercing: number; blockedFocus: number; requireDifferentPreviousZone: boolean } | null;
  equipmentDefenseGuard?: number;
  pendingReversalBonusOnBlock?: number;
  reversalAttackBonus?: number;
  nextInitiateFocus?: number;
  nextInitiateDraw?: number;
  nextHealingReduction?: number;
  readyAtInitiate?: string[];
  readyAtHide?: string[];
  combatDamageEventsThisRound?: number;
  usedConsumableThisRound?: boolean;
  reactionItemUsedSinceLastTurn?: boolean;
  offTurnConsumablePlayed?: boolean;
  lastAttackHit?: boolean;
  playedDefenseSinceLastTurn?: boolean;
  blockedSinceLastTurn?: boolean;
  blockedThisRound?: boolean;
  completedBeltExamThisRound?: boolean;
  completesActiveBeltExamThisAttack?: boolean;
  currentAttackIsReversal?: boolean;
  boughtCardThisAscend?: boolean;
  boughtCardLastAscend?: boolean;
  targetEquipmentDefPenalties?: Record<string, number>;
  nextItemCostPenalty?: number;
  attackLockedThisTurn?: boolean;
  usedEffectIdsThisTurn?: string[];
  equipmentEffectIdsThisRound?: string[];
  equipmentEffectIdsThisGame?: string[];
  nextAttackArmorPenalty?: number;
  tempSpeed: number;
  nextAttackBonus: number;
  attacksThisTurn: number;
  attacksReceivedThisRound?: number;
  speedChangedThisRound?: boolean;
  nextDefenseCardBonus?: number;
  defensePracticeUsed: boolean;
  badHabitFocusUsed: boolean;
  flowUsedThisTurn: boolean;
  nextAttackHasFlow: boolean;
  nextAttackAnyZone: boolean;
  flowAfterFirstAttack: boolean;
  hitThisTurn: boolean;
  cardsThisTurn: string[];
  tempo: boolean;
  attackedThisRound: boolean;
  defendedThisRound: boolean;
  zonesPlayed: string[];
  purchasedTypes: string[];
  comboTriggered: boolean;
  completedTasks: number[];
  statBoost: number;
  damageReductionUsed: boolean;
  wasHitSinceLastTurn: boolean;
  borrowedEquipmentId: string | null;
  abilityUsedRound: boolean;
  usedCharacterEffectIdsThisTurn?: string[];
  usedCharacterEffectIdsThisRound?: string[];
  usedCharacterEffectIdsThisGame?: string[];
  characterMarks?: Record<string, unknown>;
  reversalUsedRound: boolean;
  learnedCombos: string[];
  triggeredCombos: string[];
  comboAttemptedTurn: boolean;
  damageDealt: number;
  damageTaken: number;
  cardsBought: number;
  destroyed?: string[];
  returnedToSupply?: string[];
  stage3cStatuses?: RuntimeStatus[];
  stage3cChoices?: RuntimeChoice[];
  stage3cRestrictions?: string[];
  stage3cDefenseModifier?: number;
  stage3cAttackModifier?: number;
  stage3cSpeedOverride?: number | null;
  stage3cPurchaseCostModifier?: number;
  suppressedEquipmentPenaltyIds?: string[];
  structuredPendingChoice?: { sourceCardId: string; draw: number; discard: number };
};

type PendingStrike = {
  cardId: string;
  zone: string;
  attackPower: number;
  damageModifier: number;
  piercing?: number;
  blockedFocus?: number;
  armorPenalty?: number;
  conditionalCycle?: { draw: number; discard: number };
  previousCardWasItem?: boolean;
  targetExhaustedAtDeclaration?: boolean;
  damagePreventedAtDeclaration?: boolean;
  modifierNotes: string[];
  remainingAiAttacks: string[];
};

type PendingDiscard = {
  sourceCardId: string;
  remaining: number;
  sourceFollowup?: boolean;
};

type PendingChoice =
  | { kind: "destroy-junk"; sourceCardId: string; remaining: number; sources?: ("hand" | "discard")[]; optional?: boolean; drawAfterSuccess?: number }
  | { kind: "discard-draw"; sourceCardId: string; remaining: number; draw: number }
  | { kind: "discard-hand"; sourceCardId: string; remaining: number; afterChoice?: "resume-defense"; sourceFollowup?: boolean }
  | { kind: "deck-pick"; sourceCardId: string; revealed: string[]; filter: "defense-or-kata" | "technique" | "item"; optional: boolean; restAction: "discard" | "reorder" | "shuffle" }
  | { kind: "deck-order"; sourceCardId: string; revealed: string[]; ordered: string[]; bonusFocus: number }
  | { kind: "equipment-zone"; sourceCardId: string; power: number; piercing: number; blockedFocus: number; requireDifferentPreviousZone: boolean }
  | { kind: "incoming-equipment-zone"; sourceCardId: string; attackPowerPenalty: number }
  | { kind: "prevent-combat-damage"; sourceCardId: string; defenseId: string | null; reduce: number; damage: number; readyAtHideMinBelt: string; readyAtHideMinDamage: number }
  | { kind: "equipment-attack-response"; sourceCardId: string; attackCardId: string }
  | { kind: "post-block-cycle"; sourceCardId: string; draw: number; discard: number }
  | { kind: "ready-equipment"; sourceCardId: string; optional: boolean }
  | { kind: "attack-equipment-target"; sourceCardId: string; candidates: string[]; amount: number }
  | { kind: "attack-option"; sourceCardId: string; effect: "courtesy-notice" | "discount-dim-mak" | "tornado-crescent" }
  | { kind: "attack-cost-discard"; sourceCardId: string; bonus: number; optional: true }
  | { kind: "fire-drill-discard"; sourceCardId: string; defenseId: string; originalZone: string; alternativeZones: string[]; optional: true }
  | { kind: "fire-drill-zone"; sourceCardId: string; defenseId: string; originalZone: string; alternativeZones: string[] }
  | { kind: "air-horn-reaction"; sourceCardId: string; reactionCardId: string; reactionKind: "consumable" | "defense" }
  | { kind: "stage3c-trail-mix"; sourceCardId: string; equipmentIds: string[] }
  | { kind: "stage3c-zone-ward"; sourceCardId: string; amount: number }
  | { kind: "stage3c-remove-negative"; sourceCardId: string; bonusAttack: number; stats: ("ATK" | "DEF" | "Speed")[] }
  | { kind: "stage3c-remove-status"; sourceCardId: string; statusIds: string[] }
  | { kind: "stage3c-discard-focus"; sourceCardId: string; remaining: number; focusPerDiscard: number; optional: true }
  | { kind: "stage3c-weapon-suppress"; sourceCardId: string; equipmentIds: string[] }
  | { kind: "stage3c-exhaust-focus"; sourceCardId: string; equipmentIds: string[]; focus: number }
  | { kind: "stage3c-raffle"; sourceCardId: string; revealedCardId: string }
  | { kind: "stage3c-lucky-reveal"; sourceCardId: string; revealKind: "market" | "location"; revealedCardId: string; marketSlot?: number }
  | { kind: "stage3c-sparring-pick"; sourceCardId: string; revealed: string[] }
  | { kind: "stage3c-sparring-junk"; sourceCardId: string; junkIds: string[]; optional: true }
  | { kind: "stage3c-reaction-discard"; sourceCardId: string; reactionIds: string[] }
  | { kind: "equipment-purchase-card"; sourceCardId: string; handIds: string[]; nextInitiateDraw: number }
  | { kind: "kata-equip-from-hand"; sourceCardId: string; equipmentIds: string[]; family: string; subtype?: string; ready: boolean; nextAttackPower: number; additionalFocus: number }
  | { kind: "character-runtime"; event: CharacterRuntimeEvent; choice: CharacterRuntimeChoice; resume?: "player-attack" | "reversal-attack" };

type CharacterRuntimePendingChoice = Extract<PendingChoice, { kind: "character-runtime" }>;

function characterRuntimePendingChoice(
  pendingChoice: PendingChoice | null | undefined
): CharacterRuntimePendingChoice | null {
  return pendingChoice?.kind === "character-runtime" ? pendingChoice : null;
}

type Match = {
  schema: 8;
  rulesVersion: string;
  player: Board;
  ai: Board;
  market: string[];
  marketDeck: string[];
  marketDiscard: string[];
  marketPurchasedThisRound: boolean;
  comboDeck: string[];
  comboOfferId: string | null;
  locations: string[];
  locationId: string;
  round: number;
  phase: "player-initiate" | "player-yell" | "player-ascend" | "ai-ready" | "defense-window" | "reversal-window";
  turnOrder: ["player" | "ai", "player" | "ai"];
  turnIndex: 0 | 1;
  selectedAttackId: string | null;
  selectedZone: string;
  pendingStrike: PendingStrike | null;
  pendingDiscard: PendingDiscard | null;
  pendingChoice?: PendingChoice | null;
  pendingCombatContinuation?: { remainingAiAttacks: string[]; reversalEligible: boolean; reactionCardId?: string | null; incomingZone?: string | null } | null;
  reversalRemainingAiAttacks: string[];
  reversalReason?: "block" | "defensive-front-kick" | null;
  reversalIncomingZone?: string | null;
  attackCostDecisionCardId?: string | null;
  nonHonorSceneChangedThisRound?: boolean;
  airHornPassedReactionIds?: string[];
  airHornAiConsumableSpentThisStrike?: boolean;
  airHornAiDefenseSpentThisStrike?: boolean;
  exchangeSequence?: number;
  lastExchange?: PlaytestCombatExchange | null;
  log: string[];
  winner: "player" | "ai" | null;
};

type Difficulty = "student" | "certified" | "master";
type MotionMode = "full" | "reduced" | "off";
type HouseSettings = { tempo: boolean; locations: boolean; openMarket: boolean; guided: boolean; autoAi: boolean; balancedMarket: boolean; difficulty: Difficulty; motion: MotionMode; houseRuleIds: string[] };
type DeskView = "market" | "combo" | "belt";

const BINDER_STORAGE_KEY = "dojo-binder-v1";

function readBinderIds() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = JSON.parse(window.localStorage.getItem(BINDER_STORAGE_KEY) ?? "[]");
    return new Set<string>(Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === "string") : []);
  } catch {
    return new Set<string>();
  }
}

const cards = (cardsJson as unknown as { cards: CardEntry[] }).cards;
const byId = new Map(cards.map((card) => [card.id, card]));
const byCatalogId = new Map(cards.map((card) => [card.catalogId, card]));
const gameDefinition = gameDefinitionJson as unknown as {
  rulesVersion: string;
  rulesRevision: string;
  mode: { startingHp: number };
  turn: { handSize: number };
  starterDeck: { catalogId: string; copies: number }[];
  economy: { defensePractice: { usesPerTurn: number }; badHabitFocus: { usesPerTurn: number; catalogId: string; focusGain: number; discardFromHand: boolean }; market: { rowSize: number; refill: string; stagnationRefresh: string } };
  progression: { belts: BeltDefinition[] };
};
type BeltDefinition = {
  id: string;
  name: string;
  color: string;
  xp: number;
  exam: { kind: "starting" | "three-zones" | "two-attacks-hit" | "attack-and-defend" | "market-types" | "equipment-count" | "combo" | "mixed-turn" | "ko"; title: string; summary: string };
  reward: { id: string; summary: string; amount?: number; stat?: "ATK" | "DEF" | "Speed"; onPromotionFocus?: number };
};
const activeRulesRevision = gameDefinition.rulesRevision;
const characters = cards.filter((card) => card.cardType === "Character");
const starterIds = gameDefinition.starterDeck.flatMap(({ catalogId, copies }) => {
  const id = byCatalogId.get(catalogId)?.id;
  return id ? Array.from({ length: copies }, () => id) : [];
});
const marketPool = cards.filter((card) => card.cardType === "Technique" || card.cardType === "Item");
const comboPool = cards.filter((card) => card.cardType === "Combo");
const locationPool = cards.filter((card) => card.cardType === "Location");
const QUICK_DUEL_LOCATION_NAMES = new Set([
  "City Bus in Motion",
  "Community Ice Rink",
  "Concrete Stairwell",
  "Parking Garage Spiral",
  "Public Library",
  "Rain-Slick Alley",
  "River Dock",
  "School Gymnasium",
  "Strip-Mall McDojo",
  "Tournament Mat",
  "Traditional Dojo",
  "Yoga Studio",
]);
const quickDuelLocationPool = locationPool.filter((card) => QUICK_DUEL_LOCATION_NAMES.has(card.name));
const belts = gameDefinition.progression.belts;
const DIFFICULTIES: Record<Difficulty, { label: string; eyebrow: string; detail: string; aiHp: number; statBoost: number }> = {
  student: { label: "Student", eyebrow: "Learn the mat", detail: "A shorter duel with a less ruthless opponent.", aiHp: 20, statBoost: 0 },
  certified: { label: "Certified", eyebrow: "Core test", detail: "The intended Quick Duel pressure with the complete hand economy.", aiHp: 25, statBoost: 0 },
  master: { label: "Grandmaster", eyebrow: "Bad decision", detail: "More HP, sharper stats, and no sympathy from the clipboard.", aiHp: 35, statBoost: 1 },
};

const cardArtModules = import.meta.glob<string>("./assets/cards/{attacks,defenses,katas,consumables,defense-equipment,gear,combos,characters,starters,locations}/*.webp", { eager: true, query: "?url", import: "default" });
const fighterIllustrationModules = import.meta.glob<string>("./assets/fighters/*.webp", { eager: true, query: "?url", import: "default" });
const CARD_ART = Object.fromEntries(Object.entries(cardArtModules).map(([path, url]) => [`/cards/${path.split("/cards/")[1]}`, url]));
const COMPLETE_CARD_ART_BY_CATALOG_ID = Object.fromEntries(
  Object.entries(cardArtModules).flatMap(([path, url]) => {
    const match = path.match(/\/(ddb-(?:atk|def|kat|con|deq|gea|cmb|sta|loc)-core-\d{3})_/i);
    return match ? [[match[1].toUpperCase(), url]] : [];
  }),
);
const FIGHTER_ILLUSTRATION_BY_SLUG = Object.fromEntries(
  Object.entries(fighterIllustrationModules).map(([path, url]) => [path.split("/").at(-1)?.replace(/\.webp$/i, ""), url]),
);

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}

function numberValue(value: string | number | null | undefined) {
  const match = String(value ?? "").match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function cardFor(id: string) { return byId.get(id); }
function cardType(card: CardEntry) { return String(card.details.Type ?? card.subtype ?? "").toLowerCase(); }
function cardPower(card: CardEntry) { return numberValue(card.stats["Attack Power"] ?? card.stats.Guard ?? card.stats["Power / Guard"] ?? card.stats.Power); }
function isAttack(card: CardEntry) { return cardType(card) === "attack" || card.subtype === "Attack" || card.catalogId.includes("-ATK-"); }
function isDefense(card: CardEntry) { return cardType(card) === "defense" || card.subtype === "Defense" || card.catalogId.includes("-DEF-"); }
function isKata(card: CardEntry) { return cardType(card) === "kata" || card.subtype === "Kata" || card.catalogId.includes("-KAT-"); }
function isPermanent(card: CardEntry) { return ["Weapon", "Gear", "Defense Equipment"].includes(card.subtype); }
function kataEquipCandidate(card: CardEntry | undefined, plan: ReturnType<typeof kataEquipFromHandPlanForHost>) {
  if (!card || !plan || !isPermanent(card)) return false;
  if (plan.family.toLocaleLowerCase() === "item" && card.cardType !== "Item") return false;
  if (plan.family.toLocaleLowerCase() === "equipment" && !isPermanent(card)) return false;
  return !plan.subtype || card.subtype.toLocaleLowerCase() === plan.subtype.toLocaleLowerCase();
}
function hasTag(card: CardEntry, tag: string) { return card.tags.some((entry) => entry.toLocaleLowerCase().includes(tag.toLocaleLowerCase())); }
function isWeapon(card: CardEntry) { return card.subtype === "Weapon"; }
function equipmentHasRestriction(board: Board, restriction: string) {
  return board.equipment
    .map(cardFor)
    .filter((card): card is CardEntry => Boolean(card))
    .some((card) => structuredEquipmentRestrictions(card).includes(restriction));
}
function weaponUsesTwoHands(card: CardEntry) {
  return isWeapon(card) && numberValue(card.stats.Hands ?? card.details?.Hands) >= 2;
}

function weaponHandLimitMessage(board: Board, card: CardEntry) {
  const limit = equipmentHandLimit(board.equipment, card, cardFor);
  if (limit.allowed) return null;
  const occupied = limit.occupied === 1 ? "1 Hand is" : `${limit.occupied} Hands are`;
  const required = limit.required === 1 ? "1 Hand" : `${limit.required} Hands`;
  return `${card.name} requires ${required}, but ${occupied} already occupied. Fighters only have ${limit.capacity} Hands.`;
}

function repairBoardWeaponHandLimit(board: Board) {
  const repaired = repairEquipmentHandLimit(board.equipment, cardFor);
  if (!repaired.removed.length) return { board, removed: repaired.removed };
  const removed = new Set(repaired.removed);
  return {
    board: {
      ...board,
      equipment: repaired.equipment,
      exhaustedEquipment: (board.exhaustedEquipment ?? []).filter((id) => !removed.has(id)),
      playArea: board.playArea.filter((id) => !removed.has(id)),
      discard: [...board.discard, ...repaired.removed.filter((id) => !board.discard.includes(id))],
      borrowedEquipmentId: board.borrowedEquipmentId && removed.has(board.borrowedEquipmentId) ? null : board.borrowedEquipmentId,
    },
    removed: repaired.removed,
  };
}
function weaponAttackBlocked(board: Board, card: CardEntry) {
  return isWeapon(card) && equipmentHasRestriction(board, "noWeaponAttacks");
}
function matchesZone(card: CardEntry, zone: string) { return (card.zone ?? "").toLocaleLowerCase().includes("any") || (card.zone ?? "").toLocaleLowerCase().includes(zone.toLocaleLowerCase()); }
function removeOne(items: string[], id: string) { const index = items.indexOf(id); return index < 0 ? items : [...items.slice(0, index), ...items.slice(index + 1)]; }
function isJunk(card: CardEntry | undefined) { return Boolean(card && (card.subtype === "Junk" || card.cardType === "Junk" || hasTag(card, "Junk"))); }
function cardCost(card: CardEntry | undefined) { return numberValue(card?.fpCost); }
function cardFocus(card: CardEntry | undefined) { return numberValue(card?.focusValue); }
function gainFocus(board: Board, amount: number) {
  const gain = Math.max(0, Number(amount) || 0);
  if (!gain) return board;
  return { ...board, focus: board.focus + gain, focusGeneratedThisTurn: (board.focusGeneratedThisTurn ?? 0) + gain };
}
function spendFocus(board: Board, amount: number) {
  const spend = Math.max(0, Math.min(board.focus, Number(amount) || 0));
  if (!spend) return board;
  return { ...board, focus: board.focus - spend, focusSpentThisTurn: (board.focusSpentThisTurn ?? 0) + spend };
}
function marketBasePriceFor(board: Board, card: CardEntry | undefined, marketEndSlot = false) {
  if (!card) return Number.POSITIVE_INFINITY;
  const certificationDiscount = beltHasReward(board, "market-discount") && !board.boughtCardThisAscend ? 1 : 0;
  const printedCost = cardCost(card);
  const qualified = qualifiedNextPurchaseDiscount(board.stage3cStatuses, printedCost, card, board.purchasedTypes);
  const equipment = structuredEquipmentPurchaseResolution(board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item)), {
    marketEndSlot,
    purchasedCardCost: printedCost,
    purchaseCompleted: false,
    exhaustedEquipmentIds: board.exhaustedEquipment,
    usedEffectIdsThisTurn: board.usedEffectIdsThisTurn,
  });
  const base = printedCost + (board.stage3cPurchaseCostModifier ?? 0) + (card.cardType === "Item" ? (board.nextItemCostPenalty ?? 0) : 0) - certificationDiscount + qualified.amount + equipment.purchaseDiscount;
  return Math.max(qualified.minimumFinalCost || 0, equipment.minimumFinalCost || 0, base, 0);
}
function marketPriceFor(board: Board, card: CardEntry | undefined, marketEndSlot = false) {
  if (!card) return Number.POSITIVE_INFINITY;
  return previewQuickDuelCharacterPurchasePrice(board, marketBasePriceFor(board, card, marketEndSlot));
}
function marketFocusAvailable(board: Board, card: CardEntry | undefined) {
  return spendableFocusForPurchase(board.focus, board.stage3cStatuses, card);
}
function spendMarketFocus(board: Board, card: CardEntry, price: number) {
  const spent = spendFocusForPurchase(board.focus, board.stage3cStatuses, card, price);
  return { ...board, focus: spent.focus, focusSpentThisTurn: (board.focusSpentThisTurn ?? 0) + price, stage3cStatuses: spent.statuses };
}
function equipmentSuppressionForZone(attacker: Board, defender: Board, zone: string) {
  const penalties = attacker.targetEquipmentDefPenalties ?? {};
  let amount = 0;
  for (const [id, penalty] of Object.entries(penalties)) {
    if (!defender.equipment.includes(id)) continue;
    const equipment = cardFor(id);
    if (!equipment) continue;
    const contribution = defenseEquipmentBonus(equipment, zone, { selfIsLowestXp: defender.xp <= attacker.xp }) || passiveEquipmentGuard(equipment);
    amount += Math.min(Math.max(0, Number(penalty) || 0), Math.max(0, contribution));
  }
  return amount;
}
function suppressionCandidates(defender: Board, zone: string, attacker?: Board) {
  return defender.equipment.filter((id) => {
    const equipment = cardFor(id);
    return Boolean(equipment && (defenseEquipmentBonus(equipment, zone, { selfIsLowestXp: attacker ? defender.xp <= attacker.xp : false }) > 0 || passiveEquipmentGuard(equipment) > 0));
  });
}

function curateOpeningMarket(ids: string[], balanced: boolean) {
  if (!balanced) return { market: ids.slice(0, gameDefinition.economy.market.rowSize), marketDeck: ids.slice(gameDefinition.economy.market.rowSize) };
  const affordable = ids.filter((id) => cardCost(cardFor(id)) <= 3);
  const accessibleTypes = [
    affordable.find((id) => isAttack(cardFor(id)!)),
    affordable.find((id) => isDefense(cardFor(id)!)),
    affordable.find((id) => isKata(cardFor(id)!)),
  ].filter((id): id is string => Boolean(id));
  const market = [...new Set(accessibleTypes)];
  for (const id of ids) {
    if (market.length >= gameDefinition.economy.market.rowSize) break;
    if (!market.includes(id)) market.push(id);
  }
  return { market, marketDeck: ids.filter((id) => !market.includes(id)) };
}

function revealMarketCards(marketDeck: string[], marketDiscard: string[], count: number) {
  let deck = [...marketDeck];
  let discard = [...marketDiscard];
  const revealed: string[] = [];
  while (revealed.length < count) {
    if (!deck.length && discard.length) {
      deck = shuffle(discard);
      discard = [];
    }
    const next = deck.shift();
    if (!next) break;
    revealed.push(next);
  }
  return { revealed, marketDeck: deck, marketDiscard: discard };
}

function refillPurchasedMarketSlot(market: string[], marketDeck: string[], marketDiscard: string[], slot: number) {
  const refill = revealMarketCards(marketDeck, marketDiscard, 1);
  const nextMarket = [...market];
  nextMarket[slot] = refill.revealed[0] ?? "";
  return { market: nextMarket.filter(Boolean), marketDeck: refill.marketDeck, marketDiscard: refill.marketDiscard };
}

function refreshMarketRow(market: string[], marketDeck: string[], marketDiscard: string[]) {
  let deck = [...marketDeck];
  let discard = [...marketDiscard, ...market.filter(Boolean)];
  const nextMarket: string[] = [];
  while (nextMarket.length < gameDefinition.economy.market.rowSize) {
    if (!deck.length && discard.length) {
      deck = shuffle(discard);
      discard = [];
    }
    const next = deck.shift();
    if (!next) break;
    nextMarket.push(next);
  }
  return { market: nextMarket, marketDeck: deck, marketDiscard: discard };
}

type CombatModifier = { value: number; notes: string[] };
type AttackModifier = { power: number; damage: number; notes: string[] };

function locationAttackModifier(location: CardEntry | undefined, card: CardEntry, board: Board, zone: string): AttackModifier {
  if (!location) return { power: 0, damage: 0, notes: [] };
  const firstAttack = board.attacksThisTurn === 0;
  const equipped = board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));
  const parsed = locationAttackRuleModifiers(location, {
    zone,
    firstAttack,
    attackTags: card.tags,
    hasWeapon: equipped.some(isWeapon),
    equipmentTags: equipped.flatMap((item) => item.tags),
  });
  return { power: parsed.power ?? 0, damage: parsed.damage ?? 0, notes: parsed.notes ?? [] };
}

function locationDefenseModifier(location: CardEntry | undefined, card: CardEntry | null | undefined, board: Board, zone: string): CombatModifier {
  if (!location || !card) return { value: 0, notes: [] };
  const parsed = structuredLocationDefenseForHost(location, {
    zone,
    defenseTags: card.tags,
    firstDefenseThisRound: !board.defendedThisRound,
  });
  return { value: parsed.guard, notes: parsed.notes };
}

function locationFocusModifier(location: CardEntry | undefined, card: CardEntry, board: Board): CombatModifier {
  const kataAlreadyPlayed = board.cardsThisTurn.some((id) => { const played = cardFor(id); return played ? isKata(played) : false; });
  if (!location || !isKata(card) || kataAlreadyPlayed) return { value: 0, notes: [] };
  const parsed = structuredLocationKataFocusForHost(location, { firstKataThisTurn: true });
  return { value: parsed.focus, notes: parsed.notes };
}

function printedAttackRuleModifier(attacker: Board, defender: Board, card: CardEntry, zone: string, isReversal = false): AttackModifier {
  const priorCards = attacker.cardsThisTurn.map(cardFor).filter((prior): prior is CardEntry => Boolean(prior));
  const priorAttacks = priorCards.filter(isAttack);
  const playedKata = priorCards.some(isKata);
  const previousCard = priorCards.at(-1);
  const previousZone = attacker.zonesPlayed.at(-1);
  const equipped = attacker.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));
  const attackerSpeed = fighterStat(attacker, "Speed");
  const defenderSpeed = fighterStat(defender, "Speed");
  const printed = conditionalAttackPowerBonus(card, {
    playedKata,
    firstAttack: attacker.attacksThisTurn === 0,
    matchingArmor: Math.max(0, equipmentDefenseModifier(defender, zone, { opponentXp: attacker.xp }).value - equipmentSuppressionForZone(attacker, defender, zone)) > 0,
    targetEquipmentCount: defender.equipment.length,
    attackNumber: attacker.attacksThisTurn + 1,
    hasTempo: attacker.tempo,
    targetTempoUsed: !defender.tempo,
    playedAsReversal: isReversal,
    playedDefenseSinceLastTurn: Boolean(attacker.playedDefenseSinceLastTurn),
    blockedSinceLastTurn: Boolean(attacker.blockedSinceLastTurn),
    blockedThisRound: Boolean(attacker.blockedThisRound),
    previousAttackBlocked: attacker.attacksThisTurn > 0 && !attacker.lastAttackHit,
    previousCardIsKataOrItem: Boolean(previousCard && (isKata(previousCard) || previousCard.cardType === "Item")),
    hasFewerCardsThanTarget: attacker.hand.length < defender.hand.length,
    targetSpeedHigher: defenderSpeed > attackerSpeed,
    priorLowAttack: attacker.zonesPlayed.some((priorZone) => priorZone.toLocaleLowerCase() === "low"),
    previousCardIsItemOrConsumable: Boolean(previousCard && (previousCard.cardType === "Item" || previousCard.subtype === "Consumable")),
    hasImprovisedWeapon: equipped.some((item) => isWeapon(item) && hasTag(item, "Improvised")),
    wasHitSinceLastTurn: attacker.wasHitSinceLastTurn,
    differentZoneFromPreviousAttack: Boolean(previousZone && previousZone.toLocaleLowerCase() !== zone.toLocaleLowerCase()),
    previousAttackZoneMidOrHigh: Boolean(previousZone && ["mid", "high"].includes(previousZone.toLocaleLowerCase())),
    priorDifferentZoneCount: new Set(attacker.zonesPlayed.map((priorZone) => priorZone.toLocaleLowerCase())).size,
    priorPunchAttack: priorAttacks.some((prior) => hasTag(prior, "Punch")),
    priorSpinAttack: priorAttacks.some((prior) => hasTag(prior, "Spin")),
  });
  const equipment = equipmentConditionalAttackPowerBonus(equipped, {
    firstAttack: attacker.attacksThisTurn === 0,
    attackNumber: attacker.attacksThisTurn + 1,
    zone,
    attackerSpeed,
    defenderSpeed,
    targetXpHigher: defender.xp > attacker.xp,
    targetHasTemporaryNegativeStat: defender.tempSpeed < 0 || (defender.nextDefenseCardBonus ?? 0) < 0 || (defender.nextAttackBonus ?? 0) < 0,
    hasNotAttackedThisTurn: attacker.attacksThisTurn === 0,
    firstAttackAfterKataThisTurn: playedKata && !priorAttacks.length,
    attackTags: card.tags,
    blockedThisRound: Boolean(attacker.blockedThisRound),
    hasTwoPairedWeapons: equipped.filter((item) => isWeapon(item) && hasTag(item, "Paired")).length >= 2,
    equippedThisTurnCatalogIds: attacker.cardsThisTurn.map(cardFor).filter((item): item is CardEntry => Boolean(item && isPermanent(item))).map((item) => item.catalogId),
    currentAttackIsNormal: !isReversal,
  });
  const finalPrinted = finalAttackPowerBonus(card, { completedBeltExamThisRound: attacker.completedBeltExamThisRound, focusGeneratedThisTurn: attacker.focusGeneratedThisTurn, firstAttackThisTurn: attacker.attacksThisTurn === 0 });
  return {
    power: printed.amount + equipment.amount + finalPrinted.amount,
    damage: 0,
    notes: [...printed.notes, ...finalPrinted.notes, ...(equipment.amount ? [`${equipment.sources.join(" + ")} +${equipment.amount} Attack Power vs faster fighter`] : [])],
  };
}

function structuredAttackCyclePlan(board: Board, card: CardEntry, zone: string, nonHonorSceneChangedThisRound = false) {
  const priorCards = board.cardsThisTurn.map(cardFor).filter((prior): prior is CardEntry => Boolean(prior));
  const priorAttacks = priorCards.filter(isAttack);
  const previousZone = board.zonesPlayed.at(-1);
  const existing = structuredConditionalCycle(card, {
    timing: "afterResolve",
    firstAttackThisTurn: board.attacksThisTurn === 0,
    priorJumpOrSpinAttack: priorAttacks.some((prior) => hasTag(prior, "Jump") || hasTag(prior, "Spin")),
    previousAttackHit: board.attacksThisTurn > 0 && Boolean(board.lastAttackHit),
    differentZoneFromPreviousAttack: Boolean(previousZone && previousZone.toLocaleLowerCase() !== zone.toLocaleLowerCase()),
  });
  const priorZones = new Set(board.zonesPlayed.map((played) => played.toLocaleLowerCase()));
  const finalCycle = finalAttackCycle(card, {
    timing: "afterResolve",
    nonHonorSceneChangedThisRound,
    goldBeltExamThirdZone: board.belt === 0 && priorZones.size === 2 && !priorZones.has(zone.toLocaleLowerCase()),
  });
  return { handled: existing.handled || finalCycle.handled, draw: existing.draw + finalCycle.draw, discard: existing.discard + finalCycle.discard };
}

function attackPiercingModifier(attacker: Board, defender: Board, card: CardEntry, zone: string, comboPiercing = 0) {
  const matchingArmor = Math.max(0, equipmentDefenseModifier(defender, zone, { opponentXp: attacker.xp }).value - equipmentSuppressionForZone(attacker, defender, zone)) > 0;
  const direct = attackPiercing(card, { matchingArmor, targetEquipmentCount: defender.equipment.length, targetHasExhaustedEquipment: Boolean(defender.exhaustedEquipment?.length), speedChangedThisRound: Boolean(attacker.speedChangedThisRound) });
  const equipped = attacker.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));
  const equipment = equipmentPiercing(equipped, { firstAttack: attacker.attacksThisTurn === 0, zone, matchingArmor, attackTags: card.tags });
  const kataStatusPiercing = stage3cAttackPiercing(attacker, card, zone);
  const value = direct.amount + equipment.amount + comboPiercing + kataStatusPiercing;
  const notes = [...direct.notes, ...equipment.sources, ...(comboPiercing ? [`Combo grants Piercing ${comboPiercing}`] : []), ...(kataStatusPiercing ? [`Structured Kata grants Piercing ${kataStatusPiercing}`] : [])];
  return { value, notes };
}

function applyNextAttackArmorPenalty(armor: CombatModifier, penalty: number): CombatModifier {
  const reduced = Math.min(Math.max(0, penalty), Math.max(0, armor.value));
  return { value: armor.value - reduced, notes: [...armor.notes, ...(reduced ? [`Next-Attack Armor suppression removes ${reduced} DEF`] : [])] };
}

function piercedArmorModifier(armor: CombatModifier, piercing: number): CombatModifier {
  const ignored = Math.min(Math.max(0, piercing), Math.max(0, armor.value));
  return { value: armor.value - ignored, notes: [...armor.notes, ...(ignored ? [`Piercing ${piercing} ignores ${ignored} Armor DEF`] : [])] };
}


function isEquipmentExhausted(board: Board, id: string) {
  return (board.exhaustedEquipment ?? []).includes(id);
}

function exhaustEquipment(board: Board, id: string) {
  if (isEquipmentExhausted(board, id)) return board;
  return { ...board, exhaustedEquipment: [...(board.exhaustedEquipment ?? []), id] };
}

function readyEquipment(board: Board, id: string) {
  return { ...board, exhaustedEquipment: (board.exhaustedEquipment ?? []).filter((candidate) => candidate !== id) };
}


function beltAtLeast(board: Board, beltName: string) {
  const index = belts.findIndex((belt) => belt.name.toLocaleLowerCase() === beltName.toLocaleLowerCase());
  return index >= 0 && board.belt >= index;
}

function beltHasReward(board: Board, rewardId: string) {
  return belts.slice(0, board.belt + 1).some((belt) => belt.reward.id === rewardId);
}

function applyInitiateCarryover(board: Board) {
  const stage3cBoard = stage3cStartTurn(board);
  const ready = new Set(stage3cBoard.readyAtInitiate ?? []);
  const carryover = stage3cBoard.nextInitiateFocus ?? 0;
  const carryoverDraw = stage3cBoard.nextInitiateDraw ?? 0;
  const reset = { ...stage3cBoard, focusGeneratedThisTurn: 0, focusSpentThisTurn: 0, nextInitiateFocus: 0, nextInitiateDraw: 0, exhaustedEquipment: (stage3cBoard.exhaustedEquipment ?? []).filter((id) => !ready.has(id)), readyAtInitiate: [] };
  return drawCards(gainFocus(reset, carryover), carryoverDraw);
}

function equipmentActivationAvailable(board: Board, card: CardEntry, phase: Match["phase"]) {
  if (isEquipmentExhausted(board, card.id)) return false;
  const plan = equipmentActivationPlan(card);
  if (!plan) return false;
  const lastCard = board.cardsThisTurn.length ? cardFor(board.cardsThisTurn[board.cardsThisTurn.length - 1]) : null;
  if (plan.kind === "incoming-zone-penalty" || plan.kind === "defense-guard") return phase === "defense-window";
  if (plan.kind === "speed-cycle") return phase === "player-initiate" || phase === "player-yell";
  if (plan.kind === "initiate-tempo-focus") return phase === "player-initiate" && board.tempo;
  if (plan.kind === "next-attack-power" || plan.kind === "zone-attack") return phase === "player-yell";
  if (plan.kind === "after-kata-focus") return phase === "player-yell" && Boolean(lastCard && isKata(lastCard));
  if (plan.kind === "first-hit-discard-focus") return phase === "player-yell" && board.attacksThisTurn === 1 && Boolean(board.lastAttackHit) && board.hand.length >= plan.discard;
  if (plan.kind === "hit-direct-damage" || plan.kind === "hit-next-initiate-focus") return phase === "player-yell" && Boolean(board.lastAttackHit) && Boolean(lastCard && isAttack(lastCard));
  if (plan.kind === "numbered-attack-power") return phase === "player-yell" && board.attacksThisTurn === plan.attackNumber - 1 && beltAtLeast(board, plan.minBelt);
  return false;
}

function equipmentActivationSummary(card: CardEntry) {
  const plan = equipmentActivationPlan(card);
  if (!plan) return "Unsupported activation";
  if (plan.kind === "initiate-tempo-focus") return `Tempo ready · +${plan.focus} Focus`;
  if (plan.kind === "after-kata-focus") return `Kata resolved · +${plan.focus} Focus`;
  if (plan.kind === "first-hit-discard-focus") return `First Attack Hit · discard ${plan.discard} → +${plan.focus} Focus`;
  if (plan.kind === "hit-direct-damage") return `Attack Hit · ${plan.damage} direct damage`;
  if (plan.kind === "hit-next-initiate-focus") return `Attack Hit · +${plan.focus} Focus next Initiate`;
  if (plan.kind === "numbered-attack-power") return `Attack ${plan.attackNumber} · +${plan.power} Attack Power`;
  if (plan.kind === "next-attack-power") return `Next Attack +${plan.power} Attack Power`;
  if (plan.kind === "zone-attack") return `Choose a zone · ${plan.piercing ? `Piercing ${plan.piercing}` : `+${plan.power} Attack Power`}`;
  if (plan.kind === "speed-cycle") return `+${plan.speed} Speed${plan.draw ? ` · Tempo cycles ${plan.draw}` : ""}`;
  if (plan.kind === "incoming-zone-penalty") return `Call a zone · -${plan.attackPowerPenalty} Attack Power on a match`;
  if (plan.kind === "defense-guard") return `Your Defense gets +${plan.guard} Guard${plan.reversalPower ? " · Green+ Block boosts Reversal" : ""}`;
  return "Printed Equipment activation";
}

function applyMandatoryEquipmentDamageReduction(board: Board, damage: number) {
  let next = board;
  let remaining = damage;
  const notes: string[] = [];
  if (remaining <= 0) return { board: next, damage: remaining, notes };
  for (const id of board.equipment) {
    if (isEquipmentExhausted(next, id)) continue;
    const card = cardFor(id);
    const plan = card ? mandatoryDamageReductionEquipment(card) : null;
    if (!card || !plan || remaining <= 0) continue;
    next = exhaustEquipment(next, id);
    if (plan.readyAtInitiate) next = { ...next, readyAtInitiate: [...new Set([...(next.readyAtInitiate ?? []), id])] };
    remaining = Math.max(0, remaining - plan.reduce);
    notes.push(`${card.name} reduces damage by ${plan.reduce} and exhausts`);
  }
  return { board: next, damage: remaining, notes };
}


function optionalCombatDamagePlan(board: Board) {
  if ((board.combatDamageEventsThisRound ?? 0) > 0) return null;
  for (const id of board.equipment) {
    if (isEquipmentExhausted(board, id)) continue;
    const card = cardFor(id);
    const plan = card ? optionalCombatDamageReductionEquipment(card) : null;
    if (card && plan) return { card, plan };
  }
  return null;
}

function applyOptionalCombatDamageReductionAi(board: Board, damage: number) {
  const available = damage > 0 ? optionalCombatDamagePlan(board) : null;
  if (!available) return { board, damage, notes: [] as string[] };
  let next = exhaustEquipment(board, available.card.id);
  if (beltAtLeast(next, available.plan.readyAtHideMinBelt) && damage >= available.plan.readyAtHideMinDamage) {
    next = { ...next, readyAtHide: [...new Set([...(next.readyAtHide ?? []), available.card.id])] };
  }
  return {
    board: next,
    damage: Math.max(0, damage - available.plan.reduce),
    notes: [`${available.card.name} exhausts to reduce combat damage by ${available.plan.reduce}`],
  };
}

function postBlockCyclePlan(board: Board, zone: string, defenseCard?: CardEntry | null) {
  for (const id of board.equipment) {
    if (isEquipmentExhausted(board, id)) continue;
    const card = cardFor(id);
    const plan = card ? postBlockEquipmentCycle(card) : null;
    const defenseTag = plan && "defenseTag" in plan ? String(plan.defenseTag ?? "") : "";
    if (!card || !plan || !beltAtLeast(board, plan.minBelt) || (plan.zone && plan.zone.toLocaleLowerCase() !== zone.toLocaleLowerCase()) || (defenseTag && !(defenseCard?.tags ?? []).some((tag) => tag.toLocaleLowerCase() === defenseTag.toLocaleLowerCase()))) continue;
    return { card, plan };
  }
  return null;
}

function autoTriggerAiPostBlockEquipment(board: Board, zone: string, defenseCard?: CardEntry | null) {
  const available = postBlockCyclePlan(board, zone, defenseCard);
  if (!available) return { board, notes: [] as string[] };
  let next = exhaustEquipment(board, available.card.id);
  next = drawCards(next, available.plan.draw);
  const discardCount = Math.min(available.plan.discard, next.hand.length);
  if (discardCount) {
    const ranked = [...next.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)));
    const discarded = ranked.slice(0, discardCount);
    next = { ...next, hand: next.hand.filter((candidate) => !discarded.includes(candidate)), discard: [...next.discard, ...discarded] };
  }
  return { board: next, notes: [`${available.card.name} exhausts after the ${zone} Block to draw ${available.plan.draw} / discard ${discardCount}`] };
}

function applyHideReady(board: Board) {
  const ready = new Set(board.readyAtHide ?? []);
  if (!ready.size) return { ...board, readyAtHide: [] };
  return {
    ...board,
    exhaustedEquipment: (board.exhaustedEquipment ?? []).filter((id) => !ready.has(id)),
    readyAtHide: [],
  };
}

function autoTriggerAiAfterKataEquipment(board: Board) {
  let next = board;
  const notes: string[] = [];
  for (const id of board.equipment) {
    if (isEquipmentExhausted(next, id)) continue;
    const card = cardFor(id);
    const plan = card ? equipmentActivationPlan(card) : null;
    if (!card || !plan || plan.kind !== "after-kata-focus") continue;
    next = exhaustEquipment(next, id);
    next = { ...next, focus: next.focus + plan.focus };
    notes.push(`${card.name} exhausts after the Kata for +${plan.focus} Focus`);
  }
  return { board: next, notes };
}

function autoTriggerAiAfterAttackEquipment(board: Board, target: Board, hit: boolean) {
  let attacker: Board = { ...board, lastAttackHit: hit };
  let defender = target;
  const notes: string[] = [];
  if (!hit) return { attacker, target: defender, notes };
  for (const id of board.equipment) {
    if (isEquipmentExhausted(attacker, id)) continue;
    const card = cardFor(id);
    const plan = card ? equipmentActivationPlan(card) : null;
    if (!card || !plan) continue;
    if (plan.kind === "first-hit-discard-focus" && attacker.attacksThisTurn === 1 && attacker.hand.length >= plan.discard) {
      attacker = exhaustEquipment(attacker, id);
      const ranked = [...attacker.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)));
      const discarded = ranked.slice(0, plan.discard);
      attacker = { ...attacker, hand: attacker.hand.filter((candidate) => !discarded.includes(candidate)), discard: [...attacker.discard, ...discarded], focus: attacker.focus + plan.focus };
      notes.push(`${card.name} exhausts; computer discards ${plan.discard} and gains ${plan.focus} Focus`);
    } else if (plan.kind === "hit-direct-damage") {
      attacker = exhaustEquipment(attacker, id);
      defender = { ...defender, hp: Math.max(0, defender.hp - plan.damage), damageTaken: defender.damageTaken + plan.damage };
      attacker = { ...attacker, damageDealt: attacker.damageDealt + plan.damage };
      notes.push(`${card.name} exhausts for ${plan.damage} direct damage`);
    } else if (plan.kind === "hit-next-initiate-focus") {
      attacker = exhaustEquipment(attacker, id);
      attacker = { ...attacker, nextInitiateFocus: (attacker.nextInitiateFocus ?? 0) + plan.focus };
      notes.push(`${card.name} exhausts; +${plan.focus} Focus scheduled for next Initiate`);
    }
  }
  return { attacker, target: defender, notes };
}

function applyStructuredEquipmentHit(board: Board, target: Board, attackCard: CardEntry, zone: string, damage: number) {
  const equipment = board.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card && isPermanent(card)));
  const resolution = structuredEquipmentHitResolution(equipment, {
    attackNumber: board.attacksThisTurn,
    attackZone: zone,
    attackTags: attackCard.tags,
    combatDamageDealt: damage,
    firstHitThisTurn: board.attacksThisTurn === 1,
    attackUsesSourceEquipment: true,
    usedEffectIdsThisTurn: board.usedEffectIdsThisTurn,
    usedEffectIdsThisRound: board.equipmentEffectIdsThisRound,
  });
  if (!resolution.matchedEffectIds.length && !resolution.exhaustSourceIds.length && !resolution.directDamage && !resolution.focus && !resolution.draw && !resolution.nextAttackPower && !resolution.grantFlow && !resolution.delayedStatuses.length && !resolution.targetTempoLoss) {
    return { attacker: board, target, notes: [] as string[] };
  }
  let attacker = board;
  let defender = target;
  if (resolution.focus) attacker = gainFocus(attacker, resolution.focus);
  if (resolution.draw) attacker = drawCards(attacker, resolution.draw);
  if (resolution.nextAttackPower) attacker = { ...attacker, nextAttackBonus: attacker.nextAttackBonus + resolution.nextAttackPower };
  if (resolution.grantFlow) attacker = { ...attacker, nextAttackHasFlow: true };
  for (const delayed of resolution.delayedStatuses) {
    const status = {
      sourceEffectId: delayed.sourceEffectId,
      effect: delayed.effect,
      target: "self" as const,
      amount: delayed.amount,
      duration: delayed.duration,
      resolver: "equipment.delayedHit",
      qualifier: { activateAt: delayed.duration },
      appliedImmediately: delayed.duration === "nextInitiate",
    };
    if (delayed.target === "self") {
      attacker = {
        ...attacker,
        ...(delayed.duration === "nextInitiate" && delayed.effect === "combat.modifyDefense" ? { stage3cDefenseModifier: (attacker.stage3cDefenseModifier ?? 0) + delayed.amount } : {}),
        stage3cStatuses: [...(attacker.stage3cStatuses ?? []), status],
      };
    } else {
      defender = {
        ...defender,
        ...(delayed.effect === "combat.modifyHealing" ? { nextHealingReduction: (defender.nextHealingReduction ?? 0) + delayed.amount } : {}),
        stage3cStatuses: [...(defender.stage3cStatuses ?? []), status],
      };
    }
  }
  if (resolution.targetTempoLoss) defender = { ...defender, tempo: false };
  for (const sourceId of resolution.exhaustSourceIds) {
    if (attacker.equipment.includes(sourceId)) attacker = exhaustEquipment(attacker, sourceId);
  }
  if (resolution.directDamage) {
    defender = { ...defender, hp: Math.max(0, defender.hp - resolution.directDamage), damageTaken: defender.damageTaken + resolution.directDamage };
    attacker = { ...attacker, damageDealt: attacker.damageDealt + resolution.directDamage };
  }
  attacker = {
    ...attacker,
    usedEffectIdsThisTurn: [...new Set([...(attacker.usedEffectIdsThisTurn ?? []), ...resolution.matchedEffectIds])],
    equipmentEffectIdsThisRound: [...new Set([...(attacker.equipmentEffectIdsThisRound ?? []), ...resolution.matchedEffectIds])],
  };
  const notes = [
    ...(resolution.focus ? [`Equipment Hit effect gains ${resolution.focus} Focus`] : []),
    ...(resolution.draw ? [`Equipment Hit effect draws ${resolution.draw}`] : []),
    ...(resolution.nextAttackPower ? [`Equipment Hit effect primes next Attack +${resolution.nextAttackPower}`] : []),
    ...(resolution.grantFlow ? ["Equipment Hit effect grants Flow for the next Attack"] : []),
    ...(resolution.directDamage ? [`Equipment Hit effect deals ${resolution.directDamage} direct damage`] : []),
    ...(resolution.delayedStatuses.map((status) => `Equipment Hit effect schedules ${status.effect === "combat.modifySpeed" ? `${status.amount > 0 ? "+" : ""}${status.amount} Speed` : status.effect === "combat.modifyDefense" ? `${status.amount > 0 ? "+" : ""}${status.amount} DEF` : status.effect === "combat.modifyHealing" ? `${status.amount} healing suppression` : `${status.amount} direct damage`} for ${status.duration}`)),
    ...(resolution.targetTempoLoss ? ["Equipment Hit effect removes the target's Tempo for this round"] : []),
    ...(resolution.exhaustSourceIds.length ? [`${resolution.exhaustSourceIds.length} Equipment source${resolution.exhaustSourceIds.length === 1 ? "" : "s"} exhaust`] : []),
  ];
  return { attacker, target: defender, notes };
}

function applyStructuredEquipmentAfterResolve(board: Board, resolvedCard: CardEntry, context: { defenderPlayedDefense?: boolean; goldBeltExamThirdZone?: boolean } = {}) {
  const equipment = board.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card && isPermanent(card)));
  const resolution = structuredEquipmentAfterResolveResolution(equipment, {
    resolvedCardType: resolvedCard.subtype || resolvedCard.cardType,
    defenderPlayedDefense: context.defenderPlayedDefense,
    goldBeltExamThirdZone: context.goldBeltExamThirdZone,
    usedEffectIdsThisTurn: board.usedEffectIdsThisTurn,
    usedEffectIdsThisRound: board.equipmentEffectIdsThisRound,
  });
  if (!resolution.matchedEffectIds.length && !resolution.exhaustSourceIds.length && !resolution.focus && !resolution.draw && !resolution.discard) return { board, notes: [] as string[] };
  let next = board;
  if (resolution.focus) next = gainFocus(next, resolution.focus);
  if (resolution.draw && !resolution.choiceRequired) next = drawCards(next, resolution.draw);
  for (const sourceId of resolution.exhaustSourceIds) if (next.equipment.includes(sourceId)) next = exhaustEquipment(next, sourceId);
  next = {
    ...next,
    usedEffectIdsThisTurn: [...new Set([...(next.usedEffectIdsThisTurn ?? []), ...resolution.matchedEffectIds])],
    equipmentEffectIdsThisRound: [...new Set([...(next.equipmentEffectIdsThisRound ?? []), ...resolution.matchedEffectIds])],
  };
  if (resolution.choiceRequired && resolution.choiceSourceId) {
    next = { ...next, structuredPendingChoice: { sourceCardId: resolution.choiceSourceId, draw: resolution.draw, discard: resolution.discard } };
  }
  return {
    board: next,
    notes: [
      ...(resolution.focus ? [`Equipment after-Resolve effect gains ${resolution.focus} Focus`] : []),
      ...(resolution.draw ? [`Equipment after-Resolve effect draws ${resolution.draw}`] : []),
      ...(resolution.discard ? [`Equipment after-Resolve effect requires ${resolution.discard} discard${resolution.discard === 1 ? "" : "s"}`] : []),
      ...(resolution.exhaustSourceIds.length ? [`${resolution.exhaustSourceIds.length} Equipment source${resolution.exhaustSourceIds.length === 1 ? "" : "s"} exhaust`] : []),
    ],
  };
}

function applyStructuredEquipmentPurchase(board: Board, purchasedCard: CardEntry, marketEndSlot: boolean) {
  const equipment = board.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card && isPermanent(card)));
  const resolution = structuredEquipmentPurchaseResolution(equipment, {
    marketEndSlot,
    purchasedCardCost: cardCost(purchasedCard),
    purchaseCompleted: true,
    exhaustedEquipmentIds: board.exhaustedEquipment,
    usedEffectIdsThisTurn: board.usedEffectIdsThisTurn,
  });
  if (!resolution.matchedEffectIds.length && !resolution.exhaustSourceIds.length) return { board, choiceRequired: false, notes: [] as string[] };
  let next = board;
  for (const sourceId of resolution.exhaustSourceIds) if (next.equipment.includes(sourceId)) next = exhaustEquipment(next, sourceId);
  next = {
    ...next,
    usedEffectIdsThisTurn: [...new Set([...(next.usedEffectIdsThisTurn ?? []), ...resolution.matchedEffectIds])],
  };
  return {
    board: next,
    choiceRequired: resolution.choiceRequired,
    notes: resolution.exhaustSourceIds.length ? [`${resolution.exhaustSourceIds.length} Equipment purchase source${resolution.exhaustSourceIds.length === 1 ? "" : "s"} exhaust`] : [],
  };
}

function applyStructuredEquipmentBlock(board: Board, opponent: Board, attackCard: CardEntry, defenseCard: CardEntry | null | undefined, zone: string, sourceArmorHelpedBlock: boolean, firstArmorBlockThisRound: boolean) {
  const equipment = board.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card && isPermanent(card)));
  const resolution = structuredEquipmentBlockResolution(equipment, {
    incomingZone: zone,
    incomingAttackUsesWeapon: hasTag(attackCard, "Weapon") || opponent.equipment.some((id) => { const item = cardFor(id); return Boolean(item && isWeapon(item)); }),
    incomingAttackTags: attackCard.tags,
    defenseTags: defenseCard?.tags,
    sourceArmorHelpedBlock,
    firstArmorBlockThisRound,
    defenderPlayedDefense: Boolean(defenseCard),
    sameOpponentAsBlockedAttack: true,
    opponentTopCardId: opponent.deck.at(-1) ?? null,
    armedEquipmentZoneMatched: Boolean(board.equipmentAttackPlan?.zone?.toLocaleLowerCase() === zone.toLocaleLowerCase()),
    beltName: belts[board.belt]?.name,
    usedEffectIdsThisTurn: board.usedEffectIdsThisTurn,
    usedEffectIdsThisRound: board.equipmentEffectIdsThisRound,
  });
  if (!resolution.matchedEffectIds.length && !resolution.exhaustSourceIds.length && !resolution.focus && !resolution.draw && !resolution.nextAttackPower && !resolution.nextAttackPiercing && !resolution.speed && !resolution.purchaseDiscount && !resolution.opponentFocusLoss && resolution.revealedTopCardId === undefined) return { board, opponent, notes: [] as string[] };
  let nextBoard = board;
  let nextOpponent = opponent;
  if (resolution.focus) nextBoard = gainFocus(nextBoard, resolution.focus);
  if (resolution.draw) nextBoard = drawCards(nextBoard, resolution.draw);
  if (resolution.nextAttackPower) nextBoard = { ...nextBoard, nextAttackBonus: nextBoard.nextAttackBonus + resolution.nextAttackPower };
  if (resolution.nextAttackPiercing) {
    const piercingQualifier = resolution.nextAttackDifferentFromZones[0] ? { nextAttackDifferentFromZone: resolution.nextAttackDifferentFromZones[0] } : {};
    nextBoard = {
      ...nextBoard,
      stage3cStatuses: [...(nextBoard.stage3cStatuses ?? []), { sourceEffectId: `equipment-block:${resolution.matchedEffectIds.join(",")}`, effect: "combat.piercing", target: "self", amount: resolution.nextAttackPiercing, duration: "nextAttack", resolver: "equipment.blockFollowup", qualifier: piercingQualifier, appliedImmediately: false }],
    };
  }
  if (resolution.speed) {
    nextBoard = { ...nextBoard, tempSpeed: nextBoard.tempSpeed + resolution.speed, speedChangedThisRound: true, stage3cStatuses: [...(nextBoard.stage3cStatuses ?? []), { sourceEffectId: `equipment-block-speed:${resolution.matchedEffectIds.join(",")}`, effect: "combat.modifySpeed", target: "self", amount: resolution.speed, duration: "endOfRound", resolver: "equipment.blockFollowup", qualifier: {}, appliedImmediately: true }] };
  }
  if (resolution.purchaseDiscount) {
    nextBoard = { ...nextBoard, stage3cStatuses: [...(nextBoard.stage3cStatuses ?? []), { sourceEffectId: `equipment-block-purchase:${resolution.matchedEffectIds.join(",")}`, effect: "economy.modifyCost", target: "self", amount: resolution.purchaseDiscount, duration: "nextPurchase", resolver: "equipment.blockPurchaseDiscount", qualifier: { minimumFinalCost: resolution.minimumFinalCost }, appliedImmediately: false }] };
  }
  if (resolution.opponentFocusLoss) nextOpponent = { ...nextOpponent, focus: Math.max(0, nextOpponent.focus - resolution.opponentFocusLoss) };
  for (const sourceId of resolution.exhaustSourceIds) if (nextBoard.equipment.includes(sourceId)) nextBoard = exhaustEquipment(nextBoard, sourceId);
  nextBoard = { ...nextBoard, usedEffectIdsThisTurn: [...new Set([...(nextBoard.usedEffectIdsThisTurn ?? []), ...resolution.matchedEffectIds])], equipmentEffectIdsThisRound: [...new Set([...(nextBoard.equipmentEffectIdsThisRound ?? []), ...resolution.matchedEffectIds])] };
  const notes = [
    ...(resolution.focus ? [`Equipment Block effect gains ${resolution.focus} Focus`] : []),
    ...(resolution.draw ? [`Equipment Block effect draws ${resolution.draw}`] : []),
    ...(resolution.nextAttackPower ? [`Equipment Block effect primes next Attack +${resolution.nextAttackPower}`] : []),
    ...(resolution.nextAttackPiercing ? [`Equipment Block effect grants next Attack Piercing ${resolution.nextAttackPiercing}`] : []),
    ...(resolution.speed ? [`Equipment Block effect grants +${resolution.speed} Speed this round`] : []),
    ...(resolution.purchaseDiscount ? [`Equipment Block effect arms ${Math.abs(resolution.purchaseDiscount)} Focus off the next purchase`] : []),
    ...(resolution.opponentFocusLoss ? [`Equipment Block effect removes ${resolution.opponentFocusLoss} opponent Focus`] : []),
    ...(resolution.revealedTopCardId !== undefined ? [`Equipment Block effect reveals ${resolution.revealedTopCardId ? cardFor(resolution.revealedTopCardId)?.name ?? "the opponent's top card" : "no card; the opponent's deck is empty"}`] : []),
    ...(resolution.exhaustSourceIds.length ? [`${resolution.exhaustSourceIds.length} Equipment source${resolution.exhaustSourceIds.length === 1 ? "" : "s"} exhaust`] : []),
  ];
  return { board: nextBoard, opponent: nextOpponent, notes };
}

function armedEquipmentAttackModifier(board: Board, zone: string) {
  const plan = board.equipmentAttackPlan;
  if (!plan) return { power: 0, piercing: 0, blockedFocus: 0, notes: [] as string[] };
  const previousZone = board.zonesPlayed.at(-1);
  const zoneMatches = plan.zone.toLocaleLowerCase() === zone.toLocaleLowerCase();
  const differentPrevious = !plan.requireDifferentPreviousZone || Boolean(previousZone && previousZone.toLocaleLowerCase() !== zone.toLocaleLowerCase());
  if (!zoneMatches || !differentPrevious) return { power: 0, piercing: 0, blockedFocus: 0, notes: [`${cardFor(plan.sourceCardId)?.name ?? "Equipment"} commitment missed`] };
  const notes = [
    ...(plan.power ? [`${cardFor(plan.sourceCardId)?.name ?? "Equipment"} +${plan.power} Attack Power`] : []),
    ...(plan.piercing ? [`${cardFor(plan.sourceCardId)?.name ?? "Equipment"} grants Piercing ${plan.piercing}`] : []),
  ];
  return { power: plan.power, piercing: plan.piercing, blockedFocus: plan.blockedFocus, notes };
}

function autoActivateAiAttackEquipment(board: Board, zone: string) {
  let next = board;
  let power = 0;
  let piercing = 0;
  let blockedFocus = 0;
  const notes: string[] = [];
  for (const id of board.equipment) {
    if (isEquipmentExhausted(next, id)) continue;
    const card = cardFor(id);
    const plan = card ? equipmentActivationPlan(card) : null;
    if (!card || !plan) continue;
    if (plan.kind === "next-attack-power") {
      next = exhaustEquipment(next, id);
      power += plan.power;
      notes.push(`${card.name} exhausts for +${plan.power} Attack Power`);
      continue;
    }
    if (plan.kind === "numbered-attack-power") {
      if (next.attacksThisTurn !== plan.attackNumber - 1 || !beltAtLeast(next, plan.minBelt)) continue;
      next = exhaustEquipment(next, id);
      power += plan.power;
      notes.push(`${card.name} exhausts for Attack ${plan.attackNumber}: +${plan.power} Attack Power`);
      continue;
    }
    if (plan.kind === "zone-attack") {
      const previousZone = next.zonesPlayed.at(-1);
      if (plan.requireDifferentPreviousZone && (!previousZone || previousZone.toLocaleLowerCase() === zone.toLocaleLowerCase())) continue;
      next = exhaustEquipment(next, id);
      power += plan.power;
      piercing += plan.piercing;
      blockedFocus += plan.blockedFocus;
      notes.push(`${card.name} exhausts and commits to ${zone}`);
    }
  }
  return { board: next, power, piercing, blockedFocus, notes };
}

function autoActivateAiTurnEquipment(board: Board) {
  let next = board;
  const notes: string[] = [];
  for (const id of board.equipment) {
    if (isEquipmentExhausted(next, id)) continue;
    const card = cardFor(id);
    const plan = card ? equipmentActivationPlan(card) : null;
    if (!card || !plan) continue;
    if (plan.kind === "initiate-tempo-focus") {
      if (!next.tempo) continue;
      next = exhaustEquipment(next, id);
      next = { ...next, focus: next.focus + plan.focus };
      notes.push(`${card.name} exhausts at Initiate for +${plan.focus} Focus`);
      continue;
    }
    if (plan.kind !== "speed-cycle") continue;
    next = exhaustEquipment(next, id);
    next = { ...next, tempSpeed: next.tempSpeed + plan.speed, speedChangedThisRound: true };
    notes.push(`${card.name} exhausts for +${plan.speed} Speed`);
    if (next.tempo && plan.draw) {
      next = drawCards(next, plan.draw);
      const discardCount = Math.min(plan.discard, next.hand.length);
      if (discardCount) {
        const ranked = [...next.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)));
        const discarded = ranked.slice(0, discardCount);
        next = { ...next, hand: next.hand.filter((candidate) => !discarded.includes(candidate)), discard: [...next.discard, ...discarded] };
        notes.push(`Tempo cycles ${plan.draw} draw / ${discardCount} discard`);
      }
    }
  }
  return { board: next, notes };
}

function autoActivateAiIncomingEquipment(board: Board, zone: string) {
  let next = board;
  let attackPowerPenalty = 0;
  const notes: string[] = [];
  for (const id of board.equipment) {
    if (isEquipmentExhausted(next, id)) continue;
    const card = cardFor(id);
    const plan = card ? equipmentActivationPlan(card) : null;
    if (!card || !plan || plan.kind !== "incoming-zone-penalty") continue;
    next = exhaustEquipment(next, id);
    attackPowerPenalty += plan.attackPowerPenalty;
    notes.push(`${card.name} exhausts, calls ${zone}, and applies -${plan.attackPowerPenalty} Attack Power`);
  }
  return { board: next, attackPowerPenalty, notes };
}

function autoActivateAiDefenseGuardEquipment(board: Board) {
  let next = board;
  let guard = 0;
  const notes: string[] = [];
  for (const id of board.equipment) {
    if (isEquipmentExhausted(next, id)) continue;
    const card = cardFor(id);
    const plan = card ? equipmentActivationPlan(card) : null;
    if (!card || !plan || plan.kind !== "defense-guard") continue;
    next = exhaustEquipment(next, id);
    guard += plan.guard;
    notes.push(`${card.name} exhausts for +${plan.guard} Guard`);
  }
  return { board: next, guard, notes };
}

// -----------------------------------------------------------------------------
// COMBAT ORCHESTRATION ADAPTERS
// These helpers gather canonical/runtime facts into the shape the React duel needs.
// Prefer adding behavior to generic resolvers/hosts rather than branching on card IDs
// or names here.
// -----------------------------------------------------------------------------

function attackAllowedZones(board: Board, card: CardEntry) {
  const conditional = finalAttackAllowedZones(card, { boughtCardLastAscend: board.boughtCardLastAscend });
  if (conditional.handled && conditional.zones.length > 1) return conditional.zones;
  if (board.nextAttackAnyZone || card.zone?.includes("Any")) return ["High", "Mid", "Low"];
  const equipped = board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));
  if (attackCanChooseAnyZone(card, board.attacksThisTurn === 0, equipped)) return ["High", "Mid", "Low"];
  const printedZones = [card.zone?.split(",")[0] ?? "High"];
  return characterAttackZonesForHost(board, card, printedZones);
}
function attackHasFlexibleZone(board: Board, card: CardEntry) {
  return attackAllowedZones(board, card).length > 1;
}

function defenseCardRuleModifier(defender: Board, attacker: Board, defense: CardEntry, incomingAttack: CardEntry, incomingAttackPower?: number, incomingZone?: string): CombatModifier {
  const zone = incomingZone ?? incomingAttack.zone?.split(",")[0] ?? "High";
  const context = stage3cDefenseContext(defender, attacker, defense, incomingAttack, zone, incomingAttackPower);
  const parsed = conditionalDefenseGuardBonus(defense, context);
  return { value: parsed.amount, notes: parsed.notes };
}

function characterAttackModifierFromDeclaration(declaration: { attackPower: number; damage: number; notes: string[] }): AttackModifier {
  return {
    power: declaration.attackPower,
    damage: declaration.damage,
    notes: declaration.notes.map((resolver) => `Character runtime: ${resolver}`),
  };
}

function destroyEquipment(board: Board, sourceId: string) {
  if (!sourceId || !board.equipment.includes(sourceId)) return board;
  return {
    ...board,
    equipment: removeOne(board.equipment, sourceId),
    exhaustedEquipment: (board.exhaustedEquipment ?? []).filter((id) => id !== sourceId),
    readyAtInitiate: (board.readyAtInitiate ?? []).filter((id) => id !== sourceId),
    readyAtHide: (board.readyAtHide ?? []).filter((id) => id !== sourceId),
    destroyed: [...new Set([...(board.destroyed ?? []), sourceId])],
  };
}

function applyStructuredEquipmentAttackDeclaration(board: Board, firstIncomingAttackThisRound: boolean) {
  const equipment = board.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card && isPermanent(card)));
  const resolution = structuredEquipmentAttackDeclarationResolution(equipment, {
    incomingAttackTargetsSelf: true,
    firstIncomingAttackThisRound,
    usedEffectIdsThisGame: board.equipmentEffectIdsThisGame,
    defenderHandSize: board.hand.length,
    retargetAvailable: false,
  });
  if (!resolution.matchedEffectIds.length) return { board, preventAttackDamage: false, choiceRequired: false, choiceSourceCardId: null as string | null, notes: [] as string[] };
  let next = board;
  for (const sourceId of resolution.destroySourceIds) next = destroyEquipment(next, sourceId);
  next = { ...next, equipmentEffectIdsThisGame: [...new Set([...(next.equipmentEffectIdsThisGame ?? []), ...resolution.matchedEffectIds])] };
  return {
    board: next,
    preventAttackDamage: resolution.preventAttackDamage,
    choiceRequired: resolution.choiceRequired,
    choiceSourceCardId: resolution.choiceSourceIds[0] ?? null,
    notes: [
      ...(resolution.preventAttackDamage ? ["Equipment intercepts the declared Attack and prevents its damage"] : []),
      ...(resolution.choiceRequired ? ["Equipment requires the attacker to discard before Defense"] : []),
    ],
  };
}

function resolveAiEquipmentAttackResponse(board: Board, response: ReturnType<typeof applyStructuredEquipmentAttackDeclaration>) {
  if (!response.choiceRequired || !response.choiceSourceCardId || !board.hand.length) return { board, notes: [] as string[] };
  const discardedId = [...board.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)) || left.localeCompare(right))[0];
  return {
    board: { ...board, hand: removeOne(board.hand, discardedId), discard: [...board.discard, discardedId] },
    notes: [`AI discards ${cardFor(discardedId)?.name ?? "a card"} for the declared Attack response`],
  };
}

function applyStructuredEquipmentDamagePrevention(board: Board, damage: number) {
  const equipment = board.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card && isPermanent(card)));
  const resolution = structuredEquipmentDamagePrevention(equipment, { damage, usedEffectIdsThisGame: board.equipmentEffectIdsThisGame });
  if (!resolution.matchedEffectIds.length) return { board, damage, notes: [] as string[] };
  let next = board;
  for (const sourceId of resolution.destroySourceIds) next = destroyEquipment(next, sourceId);
  next = { ...next, equipmentEffectIdsThisGame: [...new Set([...(next.equipmentEffectIdsThisGame ?? []), ...resolution.matchedEffectIds])] };
  return {
    board: next,
    damage: resolution.preventAll ? 0 : damage,
    notes: resolution.preventAll ? ["Equipment prevents all incoming damage and is destroyed"] : [],
  };
}

function applyStructuredEquipmentThresholdProtection(board: Board, damageTaken: number) {
  const equipment = board.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card && isPermanent(card)));
  const resolution = structuredEquipmentThresholdProtection(equipment, {
    hp: board.hp,
    damageTaken,
    usedEffectIdsThisGame: board.equipmentEffectIdsThisGame,
  });
  if (!resolution.matchedEffectIds.length) return { board, notes: [] as string[] };
  let next = board;
  for (const sourceId of resolution.destroySourceIds) next = destroyEquipment(next, sourceId);
  next = {
    ...next,
    equipmentEffectIdsThisGame: [...new Set([...(next.equipmentEffectIdsThisGame ?? []), ...resolution.matchedEffectIds])],
    stage3cStatuses: [
      ...(next.stage3cStatuses ?? []),
      ...resolution.statuses.map((status) => ({
        sourceEffectId: status.sourceEffectId,
        effect: "combat.untargetable",
        target: "self" as const,
        amount: 0,
        duration: status.duration,
        resolver: "equipment.thresholdProtection",
        qualifier: { untargetable: true, expiresOnAttack: status.expiresOnAttack },
        appliedImmediately: false,
      })),
    ],
  };
  return { board: next, notes: ["Emergency protection activates at 5 HP or less; the source Equipment is destroyed"] };
}

function applyStructuredEquipmentSpeedPenaltyProtection(board: Board, penalty: number) {
  if (penalty <= 0) return { board, penalty, notes: [] as string[] };
  const equipment = board.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card && isPermanent(card)));
  const resolution = structuredEquipmentSpeedPenaltyProtection(equipment, { usedEffectIdsThisGame: board.equipmentEffectIdsThisGame });
  if (!resolution.matchedEffectIds.length) return { board, penalty, notes: [] as string[] };
  const next = { ...board, equipmentEffectIdsThisGame: [...new Set([...(board.equipmentEffectIdsThisGame ?? []), ...resolution.matchedEffectIds])] };
  return { board: next, penalty: resolution.ignorePenalty ? 0 : penalty, notes: resolution.ignorePenalty ? ["Equipment ignores this Speed penalty and consumes its once-per-game protection"] : [] };
}

function reduceNonCharacterDamageForFighter(board: Board, damage: number): { board: Board; damage: number; note: string | null } {
  const structuredReduction = stage3cTakeDamagePrevention(board, damage);
  const structuredEquipmentPrevention = applyStructuredEquipmentDamagePrevention(structuredReduction.board, structuredReduction.damage);
  const equipmentReduction = applyMandatoryEquipmentDamageReduction(structuredEquipmentPrevention.board, structuredEquipmentPrevention.damage);
  return {
    board: equipmentReduction.board,
    damage: equipmentReduction.damage,
    note: [...structuredReduction.notes, ...structuredEquipmentPrevention.notes, ...equipmentReduction.notes].join("; ") || null,
  };
}

function drawCards(board: Board, count: number) {
  let deck = [...board.deck];
  let discard = [...board.discard];
  let hand = [...board.hand];
  for (let index = 0; index < count; index += 1) {
    if (!deck.length && discard.length) { deck = shuffle(discard); discard = []; }
    const next = deck.pop();
    if (next) hand.push(next);
  }
  return { ...board, deck, discard, hand };
}

const quickDuelHostOperations = {
  draw: (board: Board, amount: number) => drawCards(board, amount),
  discardForAi: (board: Board, amount: number) => {
    const count = Math.min(Math.max(0, amount), board.hand.length);
    const ranked = [...board.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)));
    const discarded = ranked.slice(0, count);
    let hand = [...board.hand];
    for (const id of discarded) hand = removeOne(hand, id);
    return { ...board, hand, discard: [...board.discard, ...discarded] };
  },
};


function withPlayerCharacterChoice(result: {
  match: Match;
  characterEvent: CharacterRuntimeEvent | null;
  characterChoices: CharacterRuntimeChoice[];
}): Match {
  const choice = result.characterChoices[0];
  if (!result.characterEvent || !choice) return result.match;
  return { ...result.match, pendingChoice: { kind: "character-runtime", event: result.characterEvent, choice } };
}

function isCoreDefenseCard(card: CardEntry) { return card.catalogId.startsWith("DDB-DEF-CORE-"); }
function isCoreConsumableCard(card: CardEntry) { return card.catalogId.startsWith("DDB-CON-CORE-"); }
function hasStructuredResolver(card: CardEntry, resolver: string) {
  return structuredRuntimeResolvers(card, resolver).length > 0;
}
function isCoreReactionItemCard(card: CardEntry) { return card.catalogId.startsWith("DDB-RIT-CORE-"); }

function reactionItemContext(zone: string, attacker: Board, attackAlreadyDeclared = false, normalAttack = true): ReactionItemRuntimeContext {
  return {
    incomingAttackTargetsSelf: true,
    incomingZones: [zone],
    attackNumber: attacker.attacksThisTurn + (attackAlreadyDeclared ? 0 : 1),
    currentAttackIsNormal: normalAttack,
  };
}

// -----------------------------------------------------------------------------
// STRUCTURED RUNTIME COMPATIBILITY BRIDGE
// The stage3c* names are historical, but this code is live. It adapts current board
// state to the generic structured-effect runtime. Do not delete it merely because
// the migration stage is over; retire pieces only when their callers move to a
// newer generic host.
// -----------------------------------------------------------------------------

function stage3cConsumableContext(board: Board): ConsumableRuntimeContext {
  return {
    hasTempo: board.tempo,
    hpThresholdMet: board.hp <= 10,
    handEmptyAfterHeal: board.hand.length === 0,
    normalAttacksResolvedThisTurn: board.attacksThisTurn,
    friendlyTargetCount: 1,
    opponentTargetCount: 1,
    temporaryNegativeModifierPresent: board.tempSpeed < 0 || board.nextAttackBonus < 0 || (board.nextDefenseCardBonus ?? 0) < 0,
    removedTemporaryNegativeModifier: false,
    sameTurnSourceActive: true,
    reactionItemUsedSinceLastTurn: Boolean(board.reactionItemUsedSinceLastTurn),
    revealedFocusValue: board.deck.length ? cardFocus(cardFor(board.deck[board.deck.length - 1])) : 0,
  };
}

function stage3cKataContext(board: Board, card: CardEntry): KataHostFacts {
  const sourceRecorded = board.cardsThisTurn.includes(card.id);
  return {
    belt: belts[board.belt]?.name,
    wasHitSinceLastTurn: Boolean(board.wasHitSinceLastTurn),
    hasWeaponEquipped: board.equipment.some((id) => { const item = cardFor(id); return Boolean(item && isWeapon(item)); }),
    hasTempo: Boolean(board.tempo),
    playedAttackThisTurn: board.attacksThisTurn > 0,
    hpAtOrBelowHalfMax: board.hp <= board.maxHp / 2,
    usedConsumableThisTurn: Boolean(board.usedConsumableThisRound),
    firstCardPlayedThisTurn: sourceRecorded ? board.cardsThisTurn.length === 1 : board.cardsThisTurn.length === 0,
    firstAttackThisTurn: board.attacksThisTurn === 0,
  };
}

function kataEconomyCommandsForHost(card: CardEntry, board: Board) {
  if (!isCoreKataCard(card)) return [];
  return kataRuntimeCommandsForHost(card, "onPlay", stage3cKataContext(board, card)).filter((command) => command.resolver === "kata.purchaseDiscount" || command.resolver === "kata.comboDiscount");
}

function kataHasAscendEconomyEffect(card: CardEntry, board: Board) {
  return kataEconomyCommandsForHost(card, board).length > 0;
}

function kataHasAscendOnlyEconomyEffect(card: CardEntry, board: Board) {
  return kataEconomyCommandsForHost(card, board).some((command) => command.qualifier?.window === "Ascend" || command.resolver === "kata.comboDiscount");
}

function applyKataHideEffects(board: Board, controller: "player" | "ai") {
  let next = board;
  for (const id of board.playArea) {
    const card = cardFor(id);
    if (!card || !isCoreKataCard(card)) continue;
    const commands = kataRuntimeCommandsForHost(card, "onHide", stage3cKataContext(next, card));
    if (commands.length) next = applyStage3CCommands(next, commands, controller);
  }
  return next;
}

function stage3cDefenseContext(defender: Board, attacker: Board, _defense: CardEntry, incomingAttack: CardEntry, zone: string, attackPower?: number, incomingDamage?: number, blockSucceeded?: boolean): DefenseRuntimeContext & { weaponAttack: boolean; defenderAttackedThisRound: boolean } {
  const matchingArmor = equipmentDefenseModifier(defender, zone, { opponentXp: attacker.xp }).value > 0;
  return {
    hasTempo: defender.tempo,
    weaponAttack: hasTag(incomingAttack, "Weapon") || attacker.equipment.some((id) => { const item = cardFor(id); return Boolean(item && isWeapon(item)); }),
    defenderAttackedThisRound: defender.attackedThisRound,
    targetPermanentEquipmentCount: attacker.equipment.length,
    incomingAttackPower: attackPower ?? cardPower(incomingAttack) + fighterStat(attacker, "ATK"),
    incomingDamage: incomingDamage ?? 0,
    incomingZone: zone,
    incomingTags: incomingAttack.tags,
    usedConsumableThisRound: Boolean(defender.usedConsumableThisRound),
    defensesPlayedThisRound: defender.defendedThisRound ? 1 : 0,
    attacksReceivedThisRound: defender.attacksReceivedThisRound ?? 0,
    wasHitThisRound: defender.wasHitSinceLastTurn,
    isFastest: fighterStat(defender, "Speed") > fighterStat(attacker, "Speed"),
    targetHasMatchingArmor: matchingArmor,
    blockSucceeded,
    completesActiveBeltExam: Boolean(defender.completesActiveBeltExamThisAttack),
  };
}

function stage3cCommands(card: CardEntry, trigger: RuntimeTrigger, context: DefenseRuntimeContext | ConsumableRuntimeContext = {}) {
  if (isCoreDefenseCard(card)) return defenseRuntimeCommands(card, trigger, context as DefenseRuntimeContext);
  if (isCoreConsumableCard(card)) return consumableRuntimeCommands(card, trigger, context as ConsumableRuntimeContext);
  return [] as RuntimeCommand[];
}

function stage3cStatus(command: RuntimeCommand, appliedImmediately = false): RuntimeStatus {
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

function addStage3CStatus(board: Board, command: RuntimeCommand, appliedImmediately = false) {
  return { ...board, stage3cStatuses: [...(board.stage3cStatuses ?? []).filter((status) => status.sourceEffectId !== command.sourceEffectId), stage3cStatus(command, appliedImmediately)] };
}

function addStage3CChoice(board: Board, command: RuntimeCommand) {
  const choice: RuntimeChoice = {
    sourceEffectId: command.sourceEffectId,
    resolver: command.resolver ?? "core.choice",
    target: "self",
    amount: command.amount,
    payload: command.choice ?? {},
  };
  return { ...board, stage3cChoices: [...(board.stage3cChoices ?? []).filter((entry) => entry.sourceEffectId !== choice.sourceEffectId), choice] };
}

function applyHealing(board: Board, amount: number) {
  const reduction = Math.max(0, board.nextHealingReduction ?? 0);
  const healing = Math.max(0, amount - reduction);
  if (!reduction) return { ...board, hp: Math.min(board.maxHp, board.hp + healing) };
  const remainingStatuses = (board.stage3cStatuses ?? []).filter((status) => status.effect !== "combat.modifyHealing");
  return { ...board, hp: Math.min(board.maxHp, board.hp + healing), nextHealingReduction: 0, stage3cStatuses: remainingStatuses };
}

function applyStage3CCommands(board: Board, commands: RuntimeCommand[], controller: "player" | "ai") {
  let next = board;
  for (const command of commands) {
    if (command.choice || command.effect === "core.choice") {
      next = addStage3CChoice(next, command);
      continue;
    }
    if (command.qualifier?.restriction) {
      next = { ...next, stage3cRestrictions: [...new Set([...(next.stage3cRestrictions ?? []), String(command.qualifier.restriction)])] };
    }
    if (command.duration !== "immediate") {
      const standingSpeed = command.effect === "combat.modifySpeed" && ["endOfTurn", "endOfRound", "nextHonor"].includes(command.duration);
      const standingDefense = command.effect === "combat.modifyDefense" && ["endOfTurn", "endOfRound", "nextHonor", "nextTurn", "nextInitiate"].includes(command.duration);
      const standingCost = command.effect === "economy.modifyCost" && ["endOfTurn", "nextTurn", "nextPurchase"].includes(command.duration) && command.qualifier?.minPrintedCost === undefined;
      if (standingSpeed) next = { ...next, tempSpeed: next.tempSpeed + command.amount, speedChangedThisRound: next.speedChangedThisRound || command.amount !== 0 };
      if (standingDefense) next = { ...next, stage3cDefenseModifier: (next.stage3cDefenseModifier ?? 0) + command.amount };
      if (standingCost) next = { ...next, stage3cPurchaseCostModifier: (next.stage3cPurchaseCostModifier ?? 0) + command.amount };
      const custom = applyStage3CBoardCustomCommand({ attackModifier: next.stage3cAttackModifier ?? 0, defenseModifier: next.stage3cDefenseModifier ?? 0, speedOverride: next.stage3cSpeedOverride ?? null }, command);
      if (custom.handled) next = { ...next, stage3cAttackModifier: custom.state.attackModifier, stage3cDefenseModifier: custom.state.defenseModifier, stage3cSpeedOverride: custom.state.speedOverride, speedChangedThisRound: next.speedChangedThisRound || custom.state.speedOverride !== null };
      if (command.effect === "core.gainFocus" && command.qualifier?.spendOnlyOn) next = gainFocus(next, command.amount);
      next = addStage3CStatus(next, command, standingSpeed || standingDefense || standingCost || custom.handled);
      continue;
    }
    if (command.effect === "core.draw") next = drawCards(next, command.amount);
    else if (command.effect === "core.discard" && next.hand.length) {
      if (controller === "player") next = addStage3CChoice(next, { ...command, choice: { resolver: command.resolver ?? "core.discard", count: command.amount } });
      else {
        const count = Math.min(command.amount, next.hand.length);
        const discarded = [...next.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right))).slice(0, count);
        next = { ...next, hand: next.hand.filter((id) => !discarded.includes(id)), discard: [...next.discard, ...discarded] };
      }
    }
    else if (command.effect === "core.heal") next = applyHealing(next, command.amount);
    else if (command.effect === "core.gainFocus") next = gainFocus(next, command.amount);
    else if (command.effect === "core.gainXP") next = { ...next, xp: Math.max(0, next.xp + command.amount) };
    else if (command.effect === "combat.modifySpeed") next = { ...next, tempSpeed: next.tempSpeed + command.amount, speedChangedThisRound: next.speedChangedThisRound || command.amount !== 0 };
    else if (command.effect === "combat.modifyAttackPower") next = { ...next, nextAttackBonus: next.nextAttackBonus + command.amount };
    else if (command.effect === "combat.modifyDefense") next = { ...next, stage3cDefenseModifier: (next.stage3cDefenseModifier ?? 0) + command.amount };
    else if (command.effect === "combat.modifyGuard") next = { ...next, nextDefenseCardBonus: (next.nextDefenseCardBonus ?? 0) + command.amount };
    else if (command.effect === "combat.dealDamage") next = { ...next, hp: Math.max(0, next.hp - Math.max(0, command.amount)), damageTaken: next.damageTaken + Math.max(0, command.amount) };
    else if (command.effect === "combat.grantFlow") next = { ...next, nextAttackHasFlow: true };
    else if (command.effect === "combat.chooseZone") next = { ...next, nextAttackAnyZone: true };
    else if (command.effect === "economy.modifyCost") next = { ...next, stage3cPurchaseCostModifier: (next.stage3cPurchaseCostModifier ?? 0) + command.amount };
    else if (command.effect === "combat.preventDamage") next = addStage3CStatus(next, { ...command, duration: "nextDamage" });
    else if (command.effect === "core.custom" && command.resolver) {
      const custom = applyStage3CBoardCustomCommand({ attackModifier: next.stage3cAttackModifier ?? 0, defenseModifier: next.stage3cDefenseModifier ?? 0, speedOverride: next.stage3cSpeedOverride ?? null }, command);
      next = custom.handled ? { ...next, stage3cAttackModifier: custom.state.attackModifier, stage3cDefenseModifier: custom.state.defenseModifier, stage3cSpeedOverride: custom.state.speedOverride } : { ...next, stage3cRestrictions: [...new Set([...(next.stage3cRestrictions ?? []), command.resolver])] };
    }
  }
  return next;
}

function applyStage3CTiming(board: Board, card: CardEntry, trigger: RuntimeTrigger, controller: "player" | "ai", context: DefenseRuntimeContext | ConsumableRuntimeContext = {}, target: "self" | "opponent" = "self") {
  const commands = stage3cCommands(card, trigger, context).filter((command) => (command.target ?? "self") === target);
  let next = applyStage3CCommands(board, commands.map((command) => ({ ...command, target: "self" })), controller);
  if (target === "opponent") {
    for (const modifiedCardType of runtimeCommandCardModificationTypes(commands)) next = queueOpponentCardModification(next, modifiedCardType);
  }
  return next;
}

function expireStage3C(board: Board, duration: string) {
  let next = board;
  const expiring = (next.stage3cStatuses ?? []).filter((status) => status.duration === duration);
  for (const status of expiring) {
    if (!status.appliedImmediately) continue;
    if (status.effect === "combat.modifySpeed") next = { ...next, tempSpeed: next.tempSpeed - status.amount };
    if (status.effect === "combat.modifyDefense") next = { ...next, stage3cDefenseModifier: (next.stage3cDefenseModifier ?? 0) - status.amount };
    if (status.effect === "combat.modifyHealing") next = { ...next, nextHealingReduction: Math.max(0, (next.nextHealingReduction ?? 0) - status.amount) };
    if (status.effect === "economy.modifyCost") next = { ...next, stage3cPurchaseCostModifier: (next.stage3cPurchaseCostModifier ?? 0) - status.amount };
    if (status.effect === "core.custom") {
      const reverted = revertStage3CBoardCustomStatus({ attackModifier: next.stage3cAttackModifier ?? 0, defenseModifier: next.stage3cDefenseModifier ?? 0, speedOverride: next.stage3cSpeedOverride ?? null }, status);
      if (reverted.handled) next = { ...next, stage3cAttackModifier: reverted.state.attackModifier, stage3cDefenseModifier: reverted.state.defenseModifier, stage3cSpeedOverride: reverted.state.speedOverride };
    }
  }
  const ids = new Set(expiring.map((status) => status.sourceEffectId));
  next = { ...next, stage3cStatuses: (next.stage3cStatuses ?? []).filter((status) => !ids.has(status.sourceEffectId)) };
  const activeRestrictions = new Set((next.stage3cStatuses ?? []).map((status) => String(status.qualifier?.restriction ?? "")).filter(Boolean));
  next.stage3cRestrictions = (next.stage3cRestrictions ?? []).filter((restriction) => activeRestrictions.has(restriction) || restriction.includes("."));
  return next;
}

function stage3cStartTurn(board: Board) {
  let next = expireStage3C(board, "nextTurn");
  next = { ...next, stage3cStatuses: expirePreventionAtNextInitiate(next.stage3cStatuses ?? []) };
  const initiate = (next.stage3cStatuses ?? []).filter((status) => status.duration === "nextInitiate");
  for (const status of initiate) {
    if (status.effect === "core.gainFocus") next = gainFocus(next, status.amount);
    if (status.effect === "core.draw") next = drawCards(next, status.amount);
  }
  return expireStage3C(next, "nextInitiate");
}

function expireStage3CQualified(board: Board, expires: "endOfTurn" | "endOfRound") {
  const expiringIds = new Set((board.stage3cStatuses ?? []).filter((status) => status.qualifier?.expires === expires).map((status) => status.sourceEffectId));
  if (!expiringIds.size) return board;
  return { ...board, stage3cStatuses: (board.stage3cStatuses ?? []).filter((status) => !expiringIds.has(status.sourceEffectId)) };
}

function stage3cEndTurn(board: Board) {
  const next = expireStage3CQualified(expireStage3C(board, "endOfTurn"), "endOfTurn");
  const delayedDamage = (next.stage3cStatuses ?? []).filter((status) => status.duration === "endOfTargetNextTurn" && status.effect === "combat.dealDamage");
  if (!delayedDamage.length) return next;
  const damage = delayedDamage.reduce((total, status) => total + Math.max(0, status.amount), 0);
  const delayedIds = new Set(delayedDamage.map((status) => status.sourceEffectId));
  return {
    ...next,
    hp: Math.max(0, next.hp - damage),
    damageTaken: next.damageTaken + damage,
    stage3cStatuses: (next.stage3cStatuses ?? []).filter((status) => !delayedIds.has(status.sourceEffectId)),
  };
}

function stage3cAdvanceRound(board: Board) {
  let next = expireStage3CQualified(expireStage3C(expireStage3C(board, "endOfRound"), "nextHonor"), "endOfRound");
  const armed = (next.stage3cStatuses ?? []).filter((status) => status.duration === "nextRound");
  const armedIds = new Set(armed.map((status) => status.sourceEffectId));
  next = { ...next, stage3cStatuses: (next.stage3cStatuses ?? []).filter((status) => !armedIds.has(status.sourceEffectId)) };
  for (const status of armed) {
    const command: RuntimeCommand = { sourceEffectId: status.sourceEffectId, effect: status.effect, trigger: "passive", target: "self", amount: status.amount, duration: "endOfRound", resolver: status.resolver, conditions: [], qualifier: status.qualifier };
    next = applyStage3CCommands(next, [command], "ai");
  }
  return next;
}

function stage3cAttackStatusMatches(status: RuntimeStatus, card: CardEntry, zone: string, isReversal = false) {
  if (status.duration !== "nextAttack") return false;
  const tag = String(status.qualifier?.nextAttackTag ?? "");
  if (tag && !hasTag(card, tag)) return false;
  const statusZone = String(status.qualifier?.nextAttackZone ?? "");
  if (statusZone && statusZone.toLocaleLowerCase() !== zone.toLocaleLowerCase()) return false;
  const differentFromZone = String(status.qualifier?.nextAttackDifferentFromZone ?? "");
  if (differentFromZone && differentFromZone.toLocaleLowerCase() === zone.toLocaleLowerCase()) return false;
  if (status.qualifier?.nextReversal && !isReversal) return false;
  return true;
}

function stage3cAttackPowerBonus(board: Board, card: CardEntry, zone: string, isReversal = false) {
  return (board.stage3cStatuses ?? []).filter((status) => {
    if (!stage3cAttackStatusMatches(status, card, zone, isReversal)) return false;
    return status.effect === "combat.modifyAttackPower"
      || (isReversal && status.qualifier?.reactionEvent === "reversalOrDefenseFollowup");
  }).reduce((total, status) => total + status.amount, 0);
}

function stage3cAttackPiercing(board: Board, card: CardEntry, zone: string, isReversal = false) {
  return (board.stage3cStatuses ?? []).filter((status) => stage3cAttackStatusMatches(status, card, zone, isReversal) && status.effect === "combat.piercing").reduce((total, status) => total + status.amount, 0);
}

function stage3cAttackFlow(board: Board, card: CardEntry, zone: string, isReversal = false) {
  return (board.stage3cStatuses ?? []).some((status) => stage3cAttackStatusMatches(status, card, zone, isReversal) && status.effect === "combat.grantFlow");
}

function resolveReactionFollowupFallback(board: Board) {
  const followups = (board.stage3cStatuses ?? []).filter((status) => status.qualifier?.reactionEvent === "reversalOrDefenseFollowup");
  if (!followups.length) return board;
  const followupIds = new Set(followups.map((status) => status.sourceEffectId));
  const fallback = followups.map((status) => ({
    ...status,
    effect: "combat.modifyDefense",
    duration: "nextHonor",
    qualifier: { ...(status.qualifier ?? {}), reactionEvent: "reversalOrDefenseFollowupFallback", expires: "nextHonor" },
    appliedImmediately: false,
  }));
  return { ...board, stage3cStatuses: [...(board.stage3cStatuses ?? []).filter((status) => !followupIds.has(status.sourceEffectId)), ...fallback] };
}

function stage3cConsumeAttackStatuses(board: Board, card: CardEntry, zone: string, isReversal = false) {
  const consumed = new Set((board.stage3cStatuses ?? []).filter((status) => stage3cAttackStatusMatches(status, card, zone, isReversal) && !isConsumableAttackFollowupStatus(status)).map((status) => status.sourceEffectId));
  const alsoExpiresOnAttack = new Set((board.stage3cStatuses ?? []).filter((status) => status.qualifier?.expiresOnAttack).map((status) => status.sourceEffectId));
  return { ...board, stage3cStatuses: (board.stage3cStatuses ?? []).filter((status) => !consumed.has(status.sourceEffectId) && !alsoExpiresOnAttack.has(status.sourceEffectId)) };
}

function stage3cNextDefenseGuardBonus(board: Board) {
  return nextDefenseGuardBonus(board.stage3cStatuses ?? []);
}

function stage3cIncomingAttackDefenseBonus(board: Board) {
  return nextIncomingAttackDefenseBonus(board.stage3cStatuses ?? []);
}

function stage3cConsumeDefenseStatuses(board: Board) {
  return { ...board, stage3cStatuses: consumeNextDefenseStatuses(board.stage3cStatuses ?? []) };
}

function stage3cConsumeIncomingAttackStatuses(board: Board) {
  return { ...board, stage3cStatuses: consumeNextIncomingAttackStatuses(board.stage3cStatuses ?? []) };
}

function stage3cTakeDamagePrevention(board: Board, damage: number) {
  const resolved = resolveNextDamagePreventionStatuses(board.stage3cStatuses ?? [], damage, "Attack");
  if (resolved.statuses === board.stage3cStatuses && !resolved.focus && resolved.damage === damage) return { board, damage, notes: resolved.notes };
  let next: Board = { ...board, stage3cStatuses: resolved.statuses };
  if (resolved.focus) next = gainFocus(next, resolved.focus);
  return { board: next, damage: resolved.damage, notes: resolved.notes };
}

function stage3cCurrentDefensePrevention(defense: CardEntry | null | undefined, context: DefenseRuntimeContext) {
  if (!defense || !isCoreDefenseCard(defense)) return 0;
  return (["onDefenseDeclared", "afterResolve"] as RuntimeTrigger[]).flatMap((trigger) => defenseRuntimeCommands(defense, trigger, context)).filter((command) => command.effect === "combat.preventDamage" && !command.choice).reduce((total, command) => total + Math.max(0, command.amount), 0);
}

function stage3cConsumePurchase(board: Board, purchasedCard?: CardEntry) {
  if (!purchasedCard) return expireStage3C(board, "nextPurchase");
  const statuses = consumeQualifiedNextPurchaseStatuses(board.stage3cStatuses, cardCost(purchasedCard), purchasedCard, board.purchasedTypes);
  const qualifiedIds = new Set((board.stage3cStatuses ?? []).filter((status) => status.duration === "nextPurchase" && ["consumable.ascendPurchaseDiscount", "defense.nextPurchaseDiscount", "equipment.blockPurchaseDiscount"].includes(String(status.resolver ?? ""))).map((status) => status.sourceEffectId));
  const preserved = statuses.filter((status) => !qualifiedIds.has(status.sourceEffectId) || cardCost(purchasedCard) < Number(status.qualifier?.minPrintedCost ?? 0) || (status.qualifier?.firstNovelPurchasedCardType === true && board.purchasedTypes.includes(String(purchasedCard.cardType ?? ""))));
  return { ...board, stage3cStatuses: preserved };
}

function stage3cConsumeKata(board: Board) {
  const statuses = (board.stage3cStatuses ?? []).filter((status) => status.duration === "nextKata");
  let next = board;
  for (const status of statuses) if (status.effect === "core.gainFocus" || status.resolver === "consumable.nextKataFocusBonus" || status.resolver === "defense.nextKataFocus") next = gainFocus(next, status.amount);
  const ids = new Set(statuses.map((status) => status.sourceEffectId));
  return { ...next, stage3cStatuses: (next.stage3cStatuses ?? []).filter((status) => !ids.has(status.sourceEffectId)) };
}

function clearStage3CResolverChoices(board: Board, resolvers: string[]) {
  const blocked = new Set(resolvers);
  return { ...board, stage3cChoices: (board.stage3cChoices ?? []).filter((choice) => !blocked.has(choice.resolver)) };
}

function stage3cReadyEquipmentIds(board: Board) {
  return board.equipment.filter((id) => !(board.exhaustedEquipment ?? []).includes(id));
}

function stage3cNegativeStatOptions(board: Board) {
  const result = new Set<"ATK" | "DEF" | "Speed">();
  if ((board.stage3cAttackModifier ?? 0) < 0 || board.nextAttackBonus < 0 || (board.stage3cStatuses ?? []).some((status) => status.amount < 0 && (status.effect === "combat.modifyAttackPower" || status.qualifier?.stat === "ATK"))) result.add("ATK");
  if ((board.stage3cDefenseModifier ?? 0) < 0 || (board.nextDefenseCardBonus ?? 0) < 0 || (board.stage3cStatuses ?? []).some((status) => status.amount < 0 && (status.effect === "combat.modifyDefense" || status.qualifier?.stat === "DEF"))) result.add("DEF");
  if (board.tempSpeed < 0 || (board.stage3cStatuses ?? []).some((status) => status.amount < 0 && status.effect === "combat.modifySpeed")) result.add("Speed");
  return [...result];
}

function stage3cRemoveTemporaryNegative(board: Board, stat: "ATK" | "DEF" | "Speed") {
  const statuses = [...(board.stage3cStatuses ?? [])];
  const index = statuses.findIndex((status) => status.amount < 0 && (stat === "ATK" ? status.effect === "combat.modifyAttackPower" || status.qualifier?.stat === "ATK" : stat === "DEF" ? status.effect === "combat.modifyDefense" || status.qualifier?.stat === "DEF" : status.effect === "combat.modifySpeed"));
  let next = { ...board };
  if (index >= 0) {
    const [status] = statuses.splice(index, 1);
    if (status.appliedImmediately) {
      if (stat === "ATK") next.stage3cAttackModifier = (next.stage3cAttackModifier ?? 0) - status.amount;
      if (stat === "DEF") next.stage3cDefenseModifier = (next.stage3cDefenseModifier ?? 0) - status.amount;
      if (stat === "Speed") next.tempSpeed -= status.amount;
    }
    return { board: { ...next, stage3cStatuses: statuses }, removed: true };
  }
  if (stat === "ATK" && next.nextAttackBonus < 0) return { board: { ...next, nextAttackBonus: 0 }, removed: true };
  if (stat === "DEF" && (next.nextDefenseCardBonus ?? 0) < 0) return { board: { ...next, nextDefenseCardBonus: 0 }, removed: true };
  if (stat === "Speed" && next.tempSpeed < 0) return { board: { ...next, tempSpeed: 0 }, removed: true };
  return { board, removed: false };
}

function stage3cArmZoneWard(board: Board, sourceCardId: string, zone: string, amount: number) {
  const status: RuntimeStatus = { sourceEffectId: `consumable-foam-finger-zone-penalty:${sourceCardId}`, effect: "combat.modifyAttackPower", target: "self", amount, duration: "nextAttack", resolver: "consumable.zoneSpecificIncomingAttackPenalty", qualifier: { nextAttackZone: zone, expires: "endOfRound" }, appliedImmediately: false };
  return { ...board, stage3cStatuses: [...(board.stage3cStatuses ?? []).filter((entry) => entry.sourceEffectId !== status.sourceEffectId), status] };
}

function stage3cAiPreferredAttackZone(board: Board) {
  const zones = board.hand.map(cardFor).filter((card): card is CardEntry => Boolean(card && isAttack(card))).flatMap((card) => attackAllowedZones(board, card));
  return ["High", "Mid", "Low"].sort((left, right) => zones.filter((zone) => zone === right).length - zones.filter((zone) => zone === left).length)[0] ?? "High";
}

function beginStage3CSparringDummy(board: Board, sourceCardId: string) {
  const revealedState = revealDeckTop(board, 3);
  const attacks = revealedState.revealed.filter((id) => { const card = cardFor(id); return Boolean(card && isAttack(card)); });
  if (attacks.length) return { board: revealedState.board, pendingChoice: { kind: "stage3c-sparring-pick", sourceCardId, revealed: revealedState.revealed } as PendingChoice };
  const junkIds = revealedState.revealed.filter((id) => isJunk(cardFor(id)));
  const discarded = { ...revealedState.board, discard: [...revealedState.board.discard, ...revealedState.revealed] };
  return { board: discarded, pendingChoice: junkIds.length ? { kind: "stage3c-sparring-junk", sourceCardId, junkIds, optional: true } as PendingChoice : null };
}


function returnResolvedConsumable(board: Board, card: CardEntry) {
  if (!returnsToSupplyAfterUse(card)) return board;
  return { ...board, playArea: removeOne(board.playArea, card.id), returnedToSupply: [...(board.returnedToSupply ?? []), card.id] };
}

function cardMatchesDeckFilter(card: CardEntry | undefined, filter: "defense-or-kata" | "technique" | "item") {
  if (!card) return false;
  if (filter === "defense-or-kata") return isDefense(card) || isKata(card);
  if (filter === "technique") return card.cardType.toLocaleLowerCase() === "technique";
  return card.cardType.toLocaleLowerCase() === "item";
}

function revealDeckTop(board: Board, count: number) {
  const take = Math.min(Math.max(0, count), board.deck.length);
  const revealed = take ? board.deck.slice(-take).reverse() : [];
  return { board: { ...board, deck: take ? board.deck.slice(0, -take) : board.deck }, revealed };
}

function deckOrderFocusBonus(revealed: string[], plan: Extract<DeckLookPlan, { kind: "reorder" }>) {
  if (revealed.length !== plan.count) return 0;
  const types = new Set(revealed.map((id) => cardFor(id)?.cardType ?? "Unknown"));
  return types.size === revealed.length ? plan.distinctTypeFocus : 0;
}

function beginPlayerDeckLook(board: Board, source: CardEntry) {
  const plan = deckLookPlan(source);
  if (!plan || !board.deck.length) return { board, pendingChoice: null as PendingChoice | null, note: "" };
  const revealedState = revealDeckTop(board, plan.count);
  let next = revealedState.board;
  const revealed = revealedState.revealed;
  if (!revealed.length) return { board, pendingChoice: null as PendingChoice | null, note: "" };

  if (plan.kind === "reorder") {
    return {
      board: next,
      pendingChoice: { kind: "deck-order", sourceCardId: source.id, revealed, ordered: [], bonusFocus: deckOrderFocusBonus(revealed, plan) } as PendingChoice,
      note: `Looked at ${revealed.length} card${revealed.length === 1 ? "" : "s"}. Choose their future draw order.`,
    };
  }

  const eligible = revealed.filter((id) => cardMatchesDeckFilter(cardFor(id), plan.filter));
  if (!eligible.length) {
    if (plan.kind === "pick-discard") {
      next = { ...next, discard: [...next.discard, ...revealed], focus: next.focus + plan.noMatchFocus };
      return { board: next, pendingChoice: null as PendingChoice | null, note: `No Defense or Kata found; all revealed cards were discarded and +${plan.noMatchFocus} Focus applied.` };
    }
    if (plan.kind === "pick-reorder") {
      return { board: next, pendingChoice: { kind: "deck-order", sourceCardId: source.id, revealed, ordered: [], bonusFocus: 0 } as PendingChoice, note: "No Technique found. Return the revealed cards in the order you choose." };
    }
    next = { ...next, deck: shuffle([...next.deck, ...revealed]) };
    return { board: next, pendingChoice: null as PendingChoice | null, note: "No Item found; the revealed cards were shuffled back into your deck." };
  }

  const restAction = plan.kind === "pick-discard" ? "discard" : plan.kind === "pick-reorder" ? "reorder" : "shuffle";
  return {
    board: next,
    pendingChoice: { kind: "deck-pick", sourceCardId: source.id, revealed, filter: plan.filter, optional: plan.optional, restAction } as PendingChoice,
    note: `Looked at ${revealed.length} card${revealed.length === 1 ? "" : "s"}. Choose ${plan.optional ? "an eligible card or skip" : "the card to keep"}.`,
  };
}

function resolveAiDeckLook(board: Board, source: CardEntry) {
  const plan = deckLookPlan(source);
  if (!plan || !board.deck.length) return board;
  const revealedState = revealDeckTop(board, plan.count);
  let next = revealedState.board;
  const revealed = revealedState.revealed;
  if (!revealed.length) return board;

  if (plan.kind === "reorder") {
    const ordered = [...revealed].sort((left, right) => cardCost(cardFor(right)) - cardCost(cardFor(left)));
    return { ...next, deck: [...next.deck, ...ordered.reverse()], focus: next.focus + deckOrderFocusBonus(revealed, plan) };
  }

  const eligible = revealed.filter((id) => cardMatchesDeckFilter(cardFor(id), plan.filter)).sort((left, right) => cardCost(cardFor(right)) - cardCost(cardFor(left)));
  const selected = eligible[0];
  if (!selected) {
    if (plan.kind === "pick-discard") return { ...next, discard: [...next.discard, ...revealed], focus: next.focus + plan.noMatchFocus };
    if (plan.kind === "pick-reorder") return { ...next, deck: [...next.deck, ...revealed.reverse()] };
    return { ...next, deck: shuffle([...next.deck, ...revealed]) };
  }
  const rest = removeOne(revealed, selected);
  if (plan.kind === "pick-discard") return { ...next, hand: [...next.hand, selected], discard: [...next.discard, ...rest] };
  if (plan.kind === "pick-reorder") return { ...next, hand: [...next.hand, selected], deck: [...next.deck, ...rest.reverse()] };
  return { ...next, hand: [...next.hand, selected], deck: shuffle([...next.deck, ...rest]) };
}

function fighterStat(board: Board, stat: "ATK" | "DEF" | "Speed") {
  const fighter = cardFor(board.fighterId);
  const beltBonus = belts.slice(0, board.belt + 1)
    .filter((belt) => belt.reward.stat === stat)
    .reduce((total, belt) => total + Number(belt.reward.amount ?? 0), 0);
  const base = numberValue(fighter?.stats[stat]);
  const equipment = board.equipment.reduce((total, id) => {
    const card = cardFor(id);
    if (!card) return total;
    const suppression = (board.suppressedEquipmentPenaltyIds ?? []).includes(id);
    if (stat === "ATK") { const value = numberValue(card.stats["Attack Bonus"]); return total + (suppression && value < 0 ? 0 : value); }
    if (stat === "DEF") { const value = passiveEquipmentGuard(card); return total + (suppression && value < 0 ? 0 : value); }
    if (stat === "Speed") { const value = equipmentSpeedModifier(card); return total + (suppression && value < 0 ? 0 : value); }
    return total;
  }, 0);
  const challengeBonus = stat === "ATK" || stat === "DEF" ? board.statBoost ?? 0 : 0;
  if (stat === "Speed" && board.stage3cSpeedOverride !== null && board.stage3cSpeedOverride !== undefined) return board.stage3cSpeedOverride;
  const value = base + beltBonus + equipment + challengeBonus + (stat === "Speed" ? board.tempSpeed : 0) + (stat === "ATK" ? (board.stage3cAttackModifier ?? 0) : 0) + (stat === "DEF" ? (board.stage3cDefenseModifier ?? 0) : 0);
  if (stat !== "Speed") return value;
  const minimumSpeedValues = board.equipment
    .map(cardFor)
    .filter((card): card is CardEntry => Boolean(card && isPermanent(card)))
    .map((card) => structuredEquipmentMinimumSpeed(card))
    .map((floor) => floor == null ? 0 : floor);
  const minimumSpeed = Math.max(0, ...minimumSpeedValues);
  return Math.max(value, minimumSpeed);
}

function incomingAttackEquipmentModifier(defender: Board): AttackModifier {
  const equipped = defender.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card));
  const parsed = firstIncomingAttackPowerPenalty(equipped, (defender.attacksReceivedThisRound ?? 0) === 0);
  return {
    power: parsed.amount,
    damage: 0,
    notes: parsed.amount ? [`${parsed.sources.join(" + ")} ${parsed.amount} Attack Power on first incoming Attack`] : [],
  };
}

function equipmentDefenseModifier(board: Board, zone: string, context: { weaponAttack?: boolean; firstIncomingAttack?: boolean; hasTempo?: boolean; selfIsLowestXp?: boolean; opponentXp?: number; consumableUsedThisRound?: boolean } = {}): CombatModifier {
  let value = 0;
  const notes: string[] = [];
  for (const id of board.equipment) {
    const card = cardFor(id);
    if (!card) continue;
    const bonus = defenseEquipmentBonus(card, zone, {
      ...context,
      selfIsLowestXp: context.selfIsLowestXp ?? (context.opponentXp !== undefined && board.xp <= context.opponentXp),
    });
    if (!bonus) continue;
    value += bonus;
    notes.push(`${card.name} +${bonus} DEF vs ${zone}`);
  }
  return { value, notes };
}

function applyAfterDefenseEquipment(board: Board) {
  const equipped = board.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card));
  const bonus = afterDefenseNextAttackBonus(equipped);
  if (!bonus.amount) return { board, notes: [] as string[] };
  return {
    board: { ...board, nextAttackBonus: board.nextAttackBonus + bonus.amount },
    notes: [`${bonus.sources.join(" + ")} primes next Attack +${bonus.amount}`],
  };
}

function applyTargetHitDebuffs(board: Board, card: CardEntry, context: { previousCardIsItem?: boolean } = {}) {
  const attackPenalty = targetNextAttackPenalty(card);
  const defensePenalty = targetNextDefensePenalty(card);
  const speedPenalty = targetSpeedPenaltyUntilHonor(card, context);
  const notes: string[] = [];
  let next = board;
  if (attackPenalty) {
    next = queueOpponentCardModification({ ...next, nextAttackBonus: next.nextAttackBonus - attackPenalty }, "Attack");
    notes.push(`target next Attack -${attackPenalty} Attack Power`);
  }
  if (defensePenalty) {
    next = queueOpponentCardModification({ ...next, nextDefenseCardBonus: (next.nextDefenseCardBonus ?? 0) - defensePenalty }, "Defense");
    notes.push(`target next Defense card -${defensePenalty} Guard`);
  }
  if (speedPenalty) {
    const protectedSpeed = applyStructuredEquipmentSpeedPenaltyProtection(next, speedPenalty);
    next = protectedSpeed.board;
    if (protectedSpeed.penalty) {
      next = { ...next, tempSpeed: next.tempSpeed - protectedSpeed.penalty, speedChangedThisRound: true };
      notes.push(`target -${protectedSpeed.penalty} Speed until Honor`);
    }
    notes.push(...protectedSpeed.notes);
  }
  return { board: next, notes };
}

function destroyResolvedConsumable(board: Board, card: CardEntry) {
  if (!destroysAfterUse(card)) return board;
  return {
    ...board,
    playArea: removeOne(board.playArea, card.id),
    destroyed: [...(board.destroyed ?? []), card.id],
  };
}

function emptyBoard(fighterId: string): Board {
  return drawCards({
    fighterId, hp: gameDefinition.mode.startingHp, maxHp: gameDefinition.mode.startingHp, xp: 0, focus: 0, focusGeneratedThisTurn: 0, focusSpentThisTurn: 0, belt: 0,
    deck: shuffle(starterIds), hand: [], discard: [], playArea: [], equipment: [], exhaustedEquipment: [], equipmentAttackPlan: null, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: 0, nextInitiateFocus: 0, nextInitiateDraw: 0, nextHealingReduction: 0, readyAtInitiate: [], readyAtHide: [], combatDamageEventsThisRound: 0, lastAttackHit: false,
    tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], tempo: true, attackedThisRound: false, reactionItemUsedSinceLastTurn: false,
    defendedThisRound: false, zonesPlayed: [], purchasedTypes: [], comboTriggered: false, completedTasks: [], statBoost: 0,
    damageReductionUsed: false, wasHitSinceLastTurn: false, borrowedEquipmentId: null, abilityUsedRound: false, completedBeltExamThisRound: false, completesActiveBeltExamThisAttack: false, currentAttackIsReversal: false, boughtCardThisAscend: false, boughtCardLastAscend: false, targetEquipmentDefPenalties: {}, nextItemCostPenalty: 0, attackLockedThisTurn: false,
    reversalUsedRound: false, learnedCombos: [], triggeredCombos: [], comboAttemptedTurn: false,
    damageDealt: 0, damageTaken: 0, cardsBought: 0, destroyed: [], returnedToSupply: [], equipmentEffectIdsThisRound: [], equipmentEffectIdsThisGame: [], stage3cStatuses: [], stage3cChoices: [], stage3cRestrictions: [], stage3cDefenseModifier: 0, stage3cAttackModifier: 0, stage3cSpeedOverride: null, stage3cPurchaseCostModifier: 0, suppressedEquipmentPenaltyIds: [],
  }, gameDefinition.turn.handSize);
}

function artistUrl(card: CardEntry) {
  if (card.image && CARD_ART[card.image]) return CARD_ART[card.image];
  if (COMPLETE_CARD_ART_BY_CATALOG_ID[card.catalogId]) return COMPLETE_CARD_ART_BY_CATALOG_ID[card.catalogId];
  if (card.name === "Basic Jab") return starterJabArtUrl;
  if (card.name === "High Guard") return highGuardArtUrl;
  return undefined;
}

function presentationSlug(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function fighterIllustrationUrl(card: CardEntry) {
  const slug = presentationSlug(card.name);
  return FIGHTER_ILLUSTRATION_BY_SLUG[slug];
}

function locationTheme(card: CardEntry | undefined) {
  const name = card?.name.toLocaleLowerCase() ?? "";
  if (/rink|rain|river/.test(name)) return "cool";
  if (/garage|stairwell|bus/.test(name)) return "concrete";
  if (/library|school|studio/.test(name)) return "civic";
  if (/strip-mall/.test(name)) return "retail";
  return "dojo";
}

function exchangeId(current: Match, actor: "player" | "ai", cardId: string) {
  return `${current.round}:${current.turnIndex}:${actor}:${cardId}:${(current.exchangeSequence ?? 0) + 1}`;
}

function boardStatusLabels(board: Board) {
  const labels: string[] = [];
  if (board.tempo) labels.push("Tempo ready");
  if (board.nextAttackHasFlow) labels.push("Flow armed");
  if (board.nextAttackBonus > 0) labels.push(`Attack +${board.nextAttackBonus}`);
  if ((board.nextDefenseCardBonus ?? 0) !== 0) labels.push(`Defense ${(board.nextDefenseCardBonus ?? 0) > 0 ? "+" : ""}${board.nextDefenseCardBonus}`);
  if (board.attackLockedThisTurn) labels.push("Attack filed");
  if ((board.exhaustedEquipment ?? []).length) labels.push(`${board.exhaustedEquipment?.length} exhausted`);
  return labels.slice(0, 4);
}

function groupedFightLog(lines: string[]) {
  const groups: { label: string; lines: string[] }[] = [];
  let currentLabel = "Current round";
  for (const line of lines) {
    const honor = line.match(/^Honor\s+(\d+)/i);
    if (honor) currentLabel = `Honor ${honor[1]}`;
    const group = groups.at(-1);
    if (!group || group.label !== currentLabel) groups.push({ label: currentLabel, lines: [line] });
    else group.lines.push(line);
  }
  return groups;
}

function cardEffectNote(card: CardEntry) {
  const plan = effectPlanForCard(card);
  if (!plan.effects.length && !plan.dedicated.length && !plan.unsupported.length) return "No additional structured effect.";
  if (isPermanent(card)) return "Equipped permanently; its canonical stats apply now."
  return describeEffectPlan(plan);
}

function playerDiscardChoiceCount(card: CardEntry, timing: "onPlay" | "onHit" | "onBlock" | "afterResolve") {
  return effectPlanForCard(card).effects
    .filter((effect) => effect.timing === timing && effect.kind === "discard")
    .reduce((total, effect) => total + effect.amount, 0);
}

// -----------------------------------------------------------------------------
// CANONICAL STRUCTURED EFFECT HOST
// Every catalog card reaches this host through generated structured JSON and a
// reusable resolver. Printed rules text is presentation-only.
// -----------------------------------------------------------------------------

function applyCardEffects(board: Board, card: CardEntry, owner: "player" | "ai", timing: "onPlay" | "onHit" | "onBlock" | "afterResolve" = "onPlay", familyContext: (DefenseRuntimeContext | ConsumableRuntimeContext) & { defenderPlayedDefense?: boolean; goldBeltExamThirdZone?: boolean } = {}, grantPrintedFocus = true) {
  let next = { ...board };
  const migratedFamily = isCoreDefenseCard(card) || isCoreConsumableCard(card);
  if (timing === "onPlay") {
    if (grantPrintedFocus) next = gainFocus(next, numberValue(card.focusValue));
    if (card.subtype === "Consumable") next = { ...next, usedConsumableThisRound: true, reactionItemUsedSinceLastTurn: Boolean(next.reactionItemUsedSinceLastTurn) || String(card.timing ?? "").toLocaleLowerCase() === "reaction" };
    if (isPermanent(card)) {
      next.equipment = [...next.equipment, card.id];
      if (equipmentSpeedModifier(card)) next.speedChangedThisRound = true;
    }
  }
  if (isCoreKataCard(card)) {
    next = applyStage3CCommands(next, kataRuntimeCommandsForHost(card, timing, stage3cKataContext(next, card)), owner);
  }
  if (migratedFamily) {
    const context = Object.keys(familyContext).length ? familyContext : isCoreConsumableCard(card) ? stage3cConsumableContext(next) : familyContext;
    next = applyStage3CTiming(next, card, timing, owner, context, "self");
  } else {
    for (const effect of effectPlanForCard(card).effects.filter((entry) => entry.timing === timing)) {
      if (effect.kind === "draw") next = drawCards(next, effect.amount);
      if (effect.kind === "discard" && next.hand.length) {
        if (owner === "player" && (timing === "onPlay" || timing === "onBlock")) continue;
        const discardCount = Math.min(effect.amount, next.hand.length);
        const ranked = [...next.hand].sort((left, right) => numberValue(cardFor(left)?.focusValue) - numberValue(cardFor(right)?.focusValue));
        const discarded = ranked.slice(0, discardCount);
        next = { ...next, hand: next.hand.filter((id) => !discarded.includes(id)), discard: [...next.discard, ...discarded] };
      }
      if (effect.kind === "nextAttackPower") next.nextAttackBonus += effect.amount;
      if (effect.kind === "speed") { next.tempSpeed += effect.amount; if (effect.amount) next.speedChangedThisRound = true; }
      if (effect.kind === "focus") next = gainFocus(next, effect.amount);
      if (effect.kind === "heal") next = applyHealing(next, effect.amount);
    }
  }
  if (timing === "afterResolve") {
    next = applyStructuredEquipmentAfterResolve(next, card, familyContext).board;
    const pending = next.structuredPendingChoice;
    if (pending && owner === "ai") {
      next = drawCards(next, pending.draw);
      const discardCount = Math.min(pending.discard, next.hand.length);
      if (discardCount) {
        const ranked = [...next.hand].sort((left, right) => numberValue(cardFor(left)?.focusValue) - numberValue(cardFor(right)?.focusValue));
        const discarded = ranked.slice(0, discardCount);
        next = { ...next, hand: next.hand.filter((id) => !discarded.includes(id)), discard: [...next.discard, ...discarded] };
      }
      next = { ...next, structuredPendingChoice: undefined };
    }
  }
  if (timing === "onPlay" && !isCoreKataCard(card)) {
    const conditionalHeal = conditionalHealAfterHit(card, board.wasHitSinceLastTurn);
    if (conditionalHeal) next = applyHealing(next, conditionalHeal);
  }
  if (migratedFamily) return next;
  const structuredFocus = structuredConditionalFocus(card, { timing, attackNumber: board.attacksThisTurn, usedEffectIds: board.usedEffectIdsThisTurn ?? [] });
  if (structuredFocus.handled && structuredFocus.amount) next = gainFocus(next, structuredFocus.amount);
  if ("effectIds" in structuredFocus && structuredFocus.effectIds?.length) next.usedEffectIdsThisTurn = [...new Set([...(next.usedEffectIdsThisTurn ?? []), ...structuredFocus.effectIds])];
  const finalFocus = finalAttackFocusReward(card, { timing, focusSpentThisTurn: board.focusSpentThisTurn, firstNormalAttackThisTurn: board.attacksThisTurn === 1 && !board.currentAttackIsReversal, completesActiveBeltExam: board.completesActiveBeltExamThisAttack });
  if (finalFocus) next = gainFocus(next, finalFocus);
  const structuredAnyZone = structuredNextAttackAnyZone(card, { timing, attackNumber: board.attacksThisTurn });
  if (structuredAnyZone.grant) next.nextAttackAnyZone = true;
  const structuredFlow = structuredNextAttackFlow(card, {
    timing,
    differentZoneFromPreviousAttack: new Set(board.zonesPlayed.map((zone) => zone.toLocaleLowerCase())).size > 1,
  });
  if (structuredFlow.grant) next.nextAttackHasFlow = true;
  if (structuredAnyZone.handled || structuredFlow.handled) return next;
  return next;
}

export type PlaytestRuntimeCertificationFailure = {
  catalogId: string;
  effectId: string;
  trigger: string;
  message: string;
};

export type PlaytestRuntimeCertificationReport = {
  pass: boolean;
  catalogCards: number;
  structuredEffects: number;
  exercisedEffects: number;
  triggerInvocations: number;
  observableInvocations: number;
  behaviorallyCertifiedEffects: number;
  outOfModeEffects: number;
  byTrigger: Record<string, { effects: number; observable: number }>;
  failures: PlaytestRuntimeCertificationFailure[];
};

function playtestConformanceBoard(card: CardEntry, fighterId: string): Board {
  const base = emptyBoard(fighterId);
  const supportingCards = cards.filter((candidate) => candidate.id !== card.id).map((candidate) => candidate.id);
  const equipment = cards.filter((candidate) => isPermanent(candidate)).slice(0, 4).map((candidate) => candidate.id);
  if (isPermanent(card) && !equipment.includes(card.id)) equipment.push(card.id);
  return {
    ...base,
    hp: 5,
    focus: 12,
    xp: 30,
    belt: Math.max(0, belts.length - 1),
    deck: [...supportingCards, ...base.deck],
    hand: [card.id, ...supportingCards.slice(0, 12)],
    discard: supportingCards.slice(12, 24),
    playArea: [card.id],
    equipment,
    exhaustedEquipment: [],
    attacksThisTurn: 1,
    attacksReceivedThisRound: 1,
    cardsThisTurn: supportingCards.slice(0, 4),
    zonesPlayed: ["High", "Mid", "Low"],
    usedConsumableThisRound: true,
    reactionItemUsedSinceLastTurn: true,
    offTurnConsumablePlayed: true,
    lastAttackHit: true,
    playedDefenseSinceLastTurn: true,
    blockedSinceLastTurn: true,
    blockedThisRound: true,
    completedBeltExamThisRound: true,
    completesActiveBeltExamThisAttack: true,
    boughtCardThisAscend: true,
    boughtCardLastAscend: true,
    wasHitSinceLastTurn: true,
    damageTaken: 3,
    damageDealt: 3,
    focusGeneratedThisTurn: 4,
    focusSpentThisTurn: 2,
    usedEffectIdsThisTurn: [],
    equipmentEffectIdsThisRound: [],
    equipmentEffectIdsThisGame: [],
    stage3cStatuses: [],
    stage3cChoices: [],
    stage3cRestrictions: [],
    stage3cDefenseModifier: 0,
    stage3cAttackModifier: 0,
    stage3cSpeedOverride: null,
    stage3cPurchaseCostModifier: 0,
    suppressedEquipmentPenaltyIds: [],
  };
}

type PlaytestRouteEvidence = {
  changed: boolean;
  signals: string[];
  effectIds: string[];
};

function conformanceMatch(player: Board, ai: Board): Match {
  const ids = cards.map((card) => card.id);
  return {
    schema: 8,
    rulesVersion: gameDefinition.rulesVersion,
    player,
    ai,
    market: ids.slice(0, 7),
    marketDeck: ids.slice(7, 30),
    marketDiscard: [],
    marketPurchasedThisRound: false,
    comboDeck: ids.filter((id) => cardFor(id)?.cardType === "Combo").slice(0, 8),
    comboOfferId: null,
    locations: ids.filter((id) => cardFor(id)?.cardType === "Location").slice(0, 4),
    locationId: ids.find((id) => cardFor(id)?.cardType === "Location") ?? "",
    round: 2,
    phase: "defense-window",
    turnOrder: ["player", "ai"],
    turnIndex: 0,
    selectedAttackId: null,
    selectedZone: "High",
    pendingStrike: null,
    pendingDiscard: null,
    pendingChoice: null,
    pendingCombatContinuation: null,
    reversalRemainingAiAttacks: [],
    reversalReason: null,
    reversalIncomingZone: null,
    attackCostDecisionCardId: null,
    exchangeSequence: 1,
    lastExchange: null,
    log: [],
    winner: null,
  };
}

function addRouteSignal(evidence: PlaytestRouteEvidence, label: string, value: unknown) {
  if (value === null || value === undefined || value === false) return;
  if (typeof value === "number" && value === 0) return;
  if (typeof value === "string" && !value) return;
  if (Array.isArray(value) && value.length === 0) return;
  if (Array.isArray(value)) {
    evidence.signals.push(label);
    for (const entry of value) {
      if (typeof entry === "string") evidence.effectIds.push(entry);
      else if (entry && typeof entry === "object" && typeof (entry as { sourceEffectId?: unknown }).sourceEffectId === "string") evidence.effectIds.push(String((entry as { sourceEffectId: string }).sourceEffectId));
    }
    return;
  }
  let meaningful = false;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (typeof object.sourceEffectId === "string" && object.sourceEffectId) {
      meaningful = true;
      evidence.signals.push(`${label}.sourceEffectId`);
      evidence.effectIds.push(object.sourceEffectId);
    }
    for (const key of ["matchedEffectIds", "sourceEffectIds", "destroySourceIds", "exhaustSourceIds", "delayedStatuses", "statuses", "commands", "choices", "characterChoices", "notes", "activatedComboIds"]) {
      const candidate = object[key];
      if (Array.isArray(candidate) && candidate.length) {
        meaningful = true;
        evidence.signals.push(`${label}.${key}`);
        for (const entry of candidate) {
          if (typeof entry === "string") evidence.effectIds.push(entry);
          else if (entry && typeof entry === "object" && typeof (entry as { sourceEffectId?: unknown }).sourceEffectId === "string") evidence.effectIds.push(String((entry as { sourceEffectId: string }).sourceEffectId));
        }
      }
    }
    for (const key of ["handled", "grant", "choiceRequired", "preventAll", "preventAttackDamage", "allowed", "published", "resolved", "focus", "power", "damage", "guard", "amount", "speed", "nextAttackPower", "directDamage", "purchaseDiscount"]) {
      const candidate = object[key];
      if (candidate === true || (typeof candidate === "number" && candidate !== 0)) {
        meaningful = true;
        evidence.signals.push(`${label}.${key}`);
      }
    }
  }
  if (typeof value !== "object" || meaningful) evidence.signals.push(label);
}

function playtestCardRouteEvidence(card: CardEntry, effectId: string, trigger: string, before: Board, after: Board, context: DefenseRuntimeContext & ConsumableRuntimeContext): PlaytestRouteEvidence {
  const evidence: PlaytestRouteEvidence = { changed: JSON.stringify(before) !== JSON.stringify(after), signals: [], effectIds: [] };
  const mark = (label: string, value: unknown) => addRouteSignal(evidence, label, value);
  const opponent = playtestConformanceBoard(card, characters[1]?.id ?? characters[0]?.id ?? "");
  const match = conformanceMatch(after, opponent);
  const attack = cards.find((candidate) => isAttack(candidate)) ?? card;
  const defense = cards.find((candidate) => isDefense(candidate)) ?? card;
  const equipment = [card, ...cards.filter((candidate) => candidate !== card && isPermanent(candidate)).slice(0, 3)];
  const commonEquipmentContext = {
    attackNumber: 1,
    attackZone: "High",
    incomingZone: "High",
    attackTags: ["Punch", "Kick", "Weapon", "Spin", "Jump"],
    defenseTags: ["Dodge", "Counter", "Redirect", "Guard"],
    combatDamageDealt: 3,
    damage: 3,
    firstAttackThisTurn: true,
    firstAttackThisRound: true,
    firstIncomingAttackThisRound: true,
    firstHitThisTurn: true,
    firstQualifyingHitThisTurn: true,
    incomingAttackTargetsSelf: true,
    attackUsesSourceEquipment: true,
    defenderPlayedDefense: true,
    sameOpponentAsBlockedAttack: true,
    sameRoundOnly: true,
    sameTurnOnly: true,
    currentAttackIsNormal: true,
    usedEffectIdsThisTurn: [],
    usedEffectIdsThisRound: [],
    usedEffectIdsThisGame: [],
    purchaseCompleted: true,
    marketEndSlot: true,
    purchasedCardCost: 4,
    hp: 5,
    damageTaken: 3,
    beltName: "Black",
    defenderHandSize: Math.max(2, after.hand.length),
    retargetAvailable: true,
  };

  if (isCoreConsumableCard(card)) {
    mark("consumable.commands", consumableRuntimeCommands(card, trigger as RuntimeTrigger, {
      ...context,
      hasTempo: after.tempo,
      missingHp: Math.max(0, after.maxHp - after.hp),
      expectedIncomingDamage: 3,
      attackNumber: after.attacksThisTurn + 1,
      currentAttackIsNormal: true,
      firstAttackThisTurn: after.attacksThisTurn === 0,
      revealedFocusValue: 2,
      friendlyTargetCount: 1,
      opponentTargetCount: 1,
    }));
    if (trigger === "passive" || trigger === "onHit" || trigger === "onBlock") {
      const armedAttack = armConsumableAttackFollowupStatuses([], card);
      mark("consumable.attackFollowup", armedAttack);
      mark("consumable.attackFollowupResolved", resolveConsumableAttackFollowupStatuses(armedAttack, { blocked: true, interferencePrevented: false }));
      const armedHide = armConsumableHideStatuses([], card);
      mark("consumable.hideFollowup", armedHide);
      mark("consumable.hideFollowupResolved", resolveConsumableHideStatuses(armedHide));
    }
  }

  if (isCoreReactionItemCard(card)) {
    const reactionContext = {
      ...context,
      incomingAttackTargetsSelf: true,
      incomingZones: ["High", "Mid", "Low"],
      attackNumber: 1,
      currentAttackIsNormal: true,
      defenseOutsideTurn: true,
      sameOpponentAsBlockedAttack: true,
      forcedDiscardEvent: true,
    };
    mark("reaction.canPlay", canPlayCoreReactionItem(card, trigger as RuntimeTrigger, reactionContext));
    mark("reaction.commands", resolveQuickDuelReactionItemEvent({ card, self: after, opponent, trigger: trigger as RuntimeTrigger, context: reactionContext }));
    mark("reaction.attack", resolveQuickDuelReactionItem({ card, self: after, opponent, strike: { attackPower: 5, zone: "High" }, trigger: trigger as RuntimeTrigger, context: reactionContext }));
    mark("reaction.outcome", resolveReactionItemIncomingAttackOutcome(after, true));
  }

  if (isPermanent(card)) {
    mark("equipment.registry", structuredEquipmentEffects(card));
    mark("equipment.restrictions", structuredEquipmentRestrictions(card));
    mark("equipment.speed", structuredEquipmentSpeedModifier(card));
    mark("equipment.minimumSpeed", structuredEquipmentMinimumSpeed(card));
    mark("equipment.flow", structuredEquipmentCurrentAttackFlow(equipment, { attackNumber: 1, hasTwoPairedWeapons: true, currentAttackIsNormal: true }));
    mark("equipment.activation", equipmentActivationPlan(card));
    if (trigger === "onAttackDeclared") mark("equipment.attackDeclared", structuredEquipmentAttackDeclarationResolution(equipment, commonEquipmentContext));
    if (trigger === "onDefenseDeclared" || trigger === "onBlock") mark("equipment.block", structuredEquipmentBlockResolution(equipment, commonEquipmentContext));
    if (trigger === "onHit") mark("equipment.hit", structuredEquipmentHitResolution(equipment, commonEquipmentContext));
    if (trigger === "afterResolve") mark("equipment.afterResolve", structuredEquipmentAfterResolveResolution(equipment, { ...commonEquipmentContext, resolvedCardType: card.subtype ?? card.cardType }));
    if (trigger === "onPurchase") mark("equipment.purchase", structuredEquipmentPurchaseResolution(equipment, commonEquipmentContext));
    if (trigger === "onAttackDeclared" || trigger === "onDefenseDeclared") mark("equipment.damagePrevention", structuredEquipmentDamagePrevention(equipment, commonEquipmentContext));
    if (trigger === "onAttackDeclared") mark("equipment.threshold", structuredEquipmentThresholdProtection(equipment, commonEquipmentContext));
    if (trigger === "onHit") mark("equipment.speedProtection", structuredEquipmentSpeedPenaltyProtection(equipment, commonEquipmentContext));
  }

  if (card.cardType === "Location" || card.catalogId.includes("-LOC-")) {
    const locationEffect = structuredRuntimeEffects(card).find((candidate) => candidate.id === effectId) ?? structuredRuntimeEffects(card).find((candidate) => candidate.trigger === trigger);
    const locationEvent = String(locationEffect?.conditions?.find((condition) => condition.kind === "locationEvent")?.value ?? "attack");
    const locationFacts = Object.fromEntries((locationEffect?.conditions ?? [])
      .filter((condition) => condition.kind && condition.kind !== "locationEvent" && condition.kind !== "locationOperation")
      .map((condition) => [String(condition.kind), condition.value]));
    const locationResolution = resolveLocationHostEvent(card, {
      locationUsedEffectsThisTurn: [],
      locationUsedEffectsThisRound: [],
      locationUsedEffectsThisScene: [],
    }, locationEvent, { ...locationFacts, ownTurn: true, firstMatchingPerTurn: true, firstMatchingPerRound: true, firstMatchingPerSceneStay: true, firstAcrossPlayersPerRound: true });
    mark("location.event", locationResolution.delta);
    mark("location.attack", locationAttackModifier(card, attack, after, "Low"));
    mark("location.defense", locationDefenseModifier(card, defense, after, "High"));
    mark("location.focus", locationFocusModifier(card, card, after));
  }

  if (card.cardType === "Boss" || /-B(?:AT|PR|TQ|DF|ST)-/.test(card.catalogId)) {
    const bossEffect = structuredRuntimeEffects(card).find((candidate) => candidate.id === effectId);
    const bossFacts = Object.fromEntries((bossEffect?.conditions ?? [])
      .filter((condition) => condition.kind)
      .map((condition) => [String(condition.kind), condition.value]));
    mark("boss.event", resolveBossCardEvent({
      card,
      trigger: trigger as RuntimeTrigger,
      context: { ...bossFacts, bossHp: 20, targetHpAtMost: 5, incomingZones: ["High", "Mid", "Low"], oncePerRound: true, playerDiscarded: true },
      state: createBossRuntimeState({
        boss: { hp: 20, maxHp: 40, attack: 5, defense: 3, speed: 4, hand: [attack.id], discard: [], statuses: [], restrictions: [] },
        player: { hp: 5, maxHp: 10, attack: 3, defense: 3, speed: 4, hand: [defense.id, attack.id], discard: [], statuses: [], restrictions: [] },
      }),
    }));
  }

  if (card.cardType === "Combo") {
    mark("combo.commands", comboCommandsForTrigger(card, trigger as RuntimeTrigger));
    mark("combo.deferred", comboDeferredCommandsOnCompletion(card, trigger as RuntimeTrigger));
    mark("combo.choice", comboChoiceOnAttack(card));
    mark("combo.host", hostQuickDuelPlaytestCardEvent(match, "player", card, "High", cardFor, trigger as RuntimeTrigger, quickDuelHostOperations, { currentAttackHit: true, currentDefense: defense, currentDefenseBlocked: true }));
  }

  if (card.cardType === "Character") {
    const characterEffect = structuredRuntimeEffects(card).find((candidate) => candidate.id === effectId);
    const characterPlayer = {
      ...after,
      fighterId: card.catalogId,
      equipment: characterEffect?.resolver === "character.noWeaponOffenseDefenseChoice" ? [] : after.equipment,
      discard: characterEffect?.resolver === "character.equipDiscardPermanentUntilHide"
        ? [...after.discard, ...equipment.filter((candidate) => isPermanent(candidate)).map((candidate) => candidate.id)]
        : after.discard,
      characterMarks: characterEffect?.resolver === "character.green.delayedDamagePreventionFocus"
        ? { ...(after.characterMarks ?? {}), "round:preventedHit": true }
        : after.characterMarks,
    };
    const characterMatch = conformanceMatch(characterPlayer, { ...opponent, fighterId: card.catalogId });
    if (trigger === "onInitiate" || trigger === "onHide") {
      mark("character.lifecycle", publishQuickDuelPlaytestLifecycleEvent(characterMatch, "player", trigger as "onInitiate" | "onHide", quickDuelHostOperations, cardFor, {}, { noCombatDamagePreviousTurn: true }));
      if (characterEffect?.resolver === "character.green.delayedDamagePreventionFocus") mark("character.damageIncoming", publishCharacterDamageIncoming(characterMatch, "player", 3));
    } else if (trigger === "onEquip") {
      mark("character.equip", publishQuickDuelPlaytestEquip(characterMatch, "player", attack));
    } else {
      mark("character.event", publishQuickDuelPlaytestCharacterEvent(characterMatch, "player", {
        type: trigger === "onAttackDeclared" ? "attackDeclared" : trigger === "onHit" ? "hit" : trigger === "onBlock" ? "block" : "cardPlayed",
        card: attack,
        zone: "High",
        printedZone: "High",
        selectedZone: "Mid",
        previousAttackZone: "Low",
        firstAttackThisTurn: true,
        playedKataEarlierThisTurn: true,
        differentZoneFromPreviousAttack: true,
        hasWeaponEquipped: false,
        attackPower: 5,
        damage: 2,
        blocked: trigger === "onBlock",
        discardedJunk: true,
        discardedOutsideHide: true,
        selectedId: after.hand[0],
        completedBeltExam: true,
        sceneChanged: true,
      } as CharacterRuntimeEvent));
    }
  }

  if (isAttack(card) || isDefense(card) || isKata(card)) {
    mark("attack.flow", attackHasFlow(after, card, "High"));
    mark("attack.zones", attackAllowedZones(after, card));
    mark("attack.modifier", printedAttackRuleModifier(after, opponent, card, "High"));
    mark("attack.piercing", attackPiercingModifier(after, opponent, card, "High"));
    mark("attack.cycle", structuredAttackCyclePlan(after, card, "High", true));
    mark("defense.modifier", defenseCardRuleModifier(after, opponent, defense, attack, 5, "High"));
    mark("family.commands", stage3cCommands(card, trigger as RuntimeTrigger, context));
    mark("kata.commands", kataRuntimeCommandsForHost(card, trigger as RuntimeTrigger, stage3cKataContext(after, card)));
  }

  return evidence;
}

/**
 * Executes every generated effect entry through the actual Playtest/module
 * runtime hosts. This is intentionally separate from the headless Game
 * certification: it guards the React Playtest adapters against silently
 * dropping a canonical trigger or reintroducing prose execution.
 */
export function runPlaytestRuntimeCertification(): PlaytestRuntimeCertificationReport {
  const fighterId = characters[0]?.id ?? "";
  const failures: PlaytestRuntimeCertificationFailure[] = [];
  let structuredEffects = 0;
  let exercisedEffects = 0;
  let triggerInvocations = 0;
  let observableInvocations = 0;
  let behaviorallyCertifiedEffects = 0;
  let outOfModeEffects = 0;
  const byTrigger: Record<string, { effects: number; observable: number }> = {};
  const context = {
    friendlyTargetCount: 1,
    opponentTargetCount: 1,
    hpThresholdMet: true,
    handEmptyAfterHeal: true,
    normalAttacksResolvedThisTurn: 1,
    temporaryNegativeModifierPresent: true,
    sameTurnSourceActive: true,
    incomingAttackTargetsSelf: true,
    defensePlayed: true,
    defensePlayedSinceLastTurn: true,
    purchaseCompleted: true,
    marketEndSlot: true,
    opponentXp: 0,
    selfSpeed: 4,
    opponentSpeed: 2,
    defenderPlayedDefense: true,
    goldBeltExamThirdZone: true,
  } as unknown as DefenseRuntimeContext & ConsumableRuntimeContext;

  for (const card of cards) {
    const effects = structuredEffectsForCard(card) ?? [];
    structuredEffects += effects.length;
    for (const effect of effects) {
      const effectId = String(effect.id ?? `${effect.trigger}:${effect.effect ?? effect.action ?? "custom"}`);
      const trigger = String(effect.trigger ?? "onPlay");
      const fixture = playtestConformanceBoard(card, fighterId);
      const isolatedCard = { ...card, effects: [effect] };
      const before = JSON.stringify(fixture);
      try {
        const result = applyCardEffects(fixture, isolatedCard, "ai", trigger as "onPlay", context, false);
        const route = playtestCardRouteEvidence(card, effectId, trigger, fixture, result, context);
        triggerInvocations += 1;
        exercisedEffects += 1;
        const after = JSON.stringify(result);
        const triggerReport = byTrigger[trigger] ?? (byTrigger[trigger] = { effects: 0, observable: 0 });
        triggerReport.effects += 1;
        if (before !== after) observableInvocations += 1;
        if (before !== after) triggerReport.observable += 1;
        const effectEvidence = before !== after || route.signals.length > 0 || route.effectIds.includes(effectId);
        if (effectEvidence) behaviorallyCertifiedEffects += 1;
        else failures.push({ catalogId: card.catalogId, effectId, trigger, message: "Playtest route produced no state, status, choice, command, or event evidence" });
      } catch (error) {
        failures.push({ catalogId: card.catalogId, effectId, trigger, message: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  return {
    pass: failures.length === 0 && exercisedEffects === structuredEffects && behaviorallyCertifiedEffects + outOfModeEffects === structuredEffects,
    catalogCards: cards.length,
    structuredEffects,
    exercisedEffects,
    triggerInvocations,
    observableInvocations,
    behaviorallyCertifiedEffects,
    outOfModeEffects,
    byTrigger,
    failures,
  };
}

function attackHasFlow(board: Board, card: CardEntry, zone = card.zone?.split(",")[0] ?? "High", isReversal = false) {
  if (board.nextAttackHasFlow || stage3cAttackFlow(board, card, zone, isReversal)) return true;
  const hasWeaponEquipped = board.equipment.some((id) => { const item = cardFor(id); return item ? isWeapon(item) : false; });
  const equipped = board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));
  const structuredFlow = structuredCurrentAttackFlow(card, { hasWeaponEquipped });
  const equipmentFlow = structuredEquipmentCurrentAttackFlow(equipped, {
    attackNumber: board.attacksThisTurn + 1,
    hasTwoPairedWeapons: equipped.filter((item) => isWeapon(item) && hasTag(item, "Paired")).length >= 2,
    currentAttackIsNormal: !isReversal,
  });
  return structuredFlow.hasFlow || equipmentFlow.grant;
}

function legalDefenseIds(board: Board, zone: string) {
  return board.hand.filter((id) => {
    const card = cardFor(id);
    return Boolean(card && isDefense(card) && matchesZone(card, zone));
  });
}

function autoPlayAiDefensiveConsumable(board: Board, expectedIncomingDamage: number) {
  if (stage3cRestrictionBlocks(board.stage3cRestrictions, "consumable")) return { board, card: null as CardEntry | null, notes: [] as string[] };
  const candidates = board.hand.map(cardFor).filter((card): card is CardEntry => Boolean(card && isCoreConsumableCard(card)));
  const selected = chooseAiDefensiveConsumable(candidates, {
    ...stage3cConsumableContext(board),
    missingHp: Math.max(0, board.maxHp - board.hp),
    expectedIncomingDamage: Math.max(0, expectedIncomingDamage),
    friendlyTargetCount: 1,
    opponentTargetCount: 1,
  }) as CardEntry | null;
  if (!selected) return { board, card: null as CardEntry | null, notes: [] as string[] };

  const entry: Board = {
    ...board,
    hand: removeOne(board.hand, selected.id),
    playArea: [...board.playArea, selected.id],
  };
  let next = applyCardEffects(entry, selected, "ai", "onPlay", stage3cConsumableContext(entry), false);
  next = applyCardEffects(next, selected, "ai", "afterResolve", stage3cConsumableContext(next), false);
  next = { ...next, stage3cStatuses: armConsumableHideStatuses(armConsumableAttackFollowupStatuses(next.stage3cStatuses ?? [], selected), selected) };
  if (destroysAfterUse(selected)) next = destroyResolvedConsumable(next, selected);
  else if (returnsToSupplyAfterUse(selected)) next = returnResolvedConsumable(next, selected);
  return { board: next, card: selected, notes: [`${selected.name} is used as the computer's defensive Reaction`] };
}

// -----------------------------------------------------------------------------
// AI DECISION HELPERS
// The AI chooses among legal actions here; legality/effects still come from the
// canonical runtime. AI heuristics may rank choices, but should not invent rules.
// -----------------------------------------------------------------------------

function bestDefense(board: Board, zone: string, attackPower = Number.POSITIVE_INFINITY, difficulty: Difficulty = "certified", location?: CardEntry, incomingAttack?: CardEntry, attacker?: Board, piercing = 0, armorPenalty = 0) {
  const options = legalDefenseIds(board, zone);
  if (!options.length || (difficulty === "student" && Math.random() < .28)) return null;
  const ranked = options.map((id) => {
    const card = cardFor(id)!;
    const modifier = locationDefenseModifier(location, card, board, zone).value;
    const printed = incomingAttack && attacker ? defenseCardRuleModifier(board, attacker, card, incomingAttack).value : 0;
    const suppression = attacker ? equipmentSuppressionForZone(attacker, board, zone) : 0;
    return { id, total: fighterStat(board, "DEF") + piercedArmorModifier(applyNextAttackArmorPenalty(equipmentDefenseModifier(board, zone, { opponentXp: attacker?.xp }), armorPenalty + suppression), piercing).value + stage3cIncomingAttackDefenseBonus(board) + cardPower(card) + (board.nextDefenseCardBonus ?? 0) + stage3cNextDefenseGuardBonus(board) + printed + modifier };
  }).sort((left, right) => left.total - right.total);
  const efficientBlock = ranked.find((entry) => entry.total >= attackPower);
  if (efficientBlock) return efficientBlock.id;
  if (difficulty === "master" && attackPower - ranked.at(-1)!.total >= 5) return null;
  return ranked.at(-1)?.id ?? null;
}

function aiMarketScore(card: CardEntry, board: Board) {
  const owned = [...board.deck, ...board.hand, ...board.discard, ...board.playArea].map(cardFor).filter(Boolean) as CardEntry[];
  const attacks = owned.filter(isAttack).length;
  const defenses = owned.filter(isDefense).length;
  const base = cardCost(card) * 2 + cardFocus(card);
  if (isDefense(card) && defenses < 5) return base + 5;
  if (isAttack(card) && attacks < 5) return base + 4;
  if (isKata(card) && board.learnedCombos.length) return base + 3;
  if (isPermanent(card)) return base + 2;
  return base;
}

function aiAttackScore(card: CardEntry, attacker: Board, defender: Board, location?: CardEntry) {
  const zones = card.zone?.includes("Any") ? ["High", "Mid", "Low"] : [card.zone?.split(",")[0] ?? "High"];
  return Math.max(...zones.map((zone) => {
    const defenseCards = legalDefenseIds(defender, zone).length;
    const locationBonus = locationAttackModifier(location, card, attacker, zone);
    return cardPower(card) + locationBonus.power + locationBonus.damage - defenseCards * .35;
  }));
}

function playAreaCleanup(board: Board) {
  const hideResolution = resolveConsumableHideStatuses(board.stage3cStatuses ?? []);
  let hideBoard: Board = {
    ...board,
    stage3cStatuses: hideResolution.statuses,
    hp: Math.max(0, board.hp - hideResolution.directSelfDamage),
    damageTaken: board.damageTaken + hideResolution.directSelfDamage,
  };
  if (hideResolution.focus) hideBoard = gainFocus(hideBoard, hideResolution.focus);
  const readyBoard = stage3cEndTurn(applyHideReady(hideBoard));
  const discard = [...readyBoard.discard, ...readyBoard.hand, ...readyBoard.playArea.filter((id) => !readyBoard.equipment.includes(id))];
  return drawCards({ ...readyBoard, hand: [], playArea: [], equipment: readyBoard.equipment, exhaustedEquipment: readyBoard.exhaustedEquipment ?? [], equipmentAttackPlan: null, discard, focus: 0, focusGeneratedThisTurn: 0, focusSpentThisTurn: 0, attacksThisTurn: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0, wasHitSinceLastTurn: false, playedDefenseSinceLastTurn: false, blockedSinceLastTurn: false, usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, comboAttemptedTurn: false, boughtCardLastAscend: Boolean(readyBoard.boughtCardThisAscend), boughtCardThisAscend: false, targetEquipmentDefPenalties: {}, attackLockedThisTurn: false, reactionItemUsedSinceLastTurn: false, suppressedEquipmentPenaltyIds: [], completesActiveBeltExamThisAttack: false, currentAttackIsReversal: false }, gameDefinition.turn.handSize + (beltHasReward(readyBoard, "hand-size") ? 1 : 0));
}

// -----------------------------------------------------------------------------
// PRESENTATION COMPONENTS
// From here, components turn already-resolved game state into the Paper-Fu UI.
// Keep mechanics out of rendering helpers whenever possible.
// -----------------------------------------------------------------------------

function NativeCardArt({ card }: { card: CardEntry }) {
  const glyph = isAttack(card) ? "✦" : isDefense(card) ? "◆" : isKata(card) ? "◎" : isPermanent(card) ? "▣" : card.cardType === "Combo" ? "∞" : "✺";
  return <span className="native-card-art" aria-hidden="true">
    <span className="native-card-ribbon">{card.subtype || card.cardType}</span>
    <b>{glyph}</b>
    <strong>{card.name}</strong>
    <small>{(card.rulesText ?? "No additional effect.").slice(0, 112)}</small>
    <em>DDB · CERTIFIED COPY</em>
  </span>;
}

function PlayCard({ card, selected, disabled, onClick, onInspect }: { card: CardEntry; selected?: boolean; disabled?: boolean; onClick?: () => void; onInspect: () => void }) {
  const art = artistUrl(card);
  const kind = isAttack(card) ? "attack" : isDefense(card) ? "defense" : isKata(card) ? "kata" : card.cardType.toLocaleLowerCase();
  const canDrag = !disabled && Boolean(onClick);
  const beginDrag = (event: DragEvent<HTMLElement>) => {
    if (!canDrag) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-dojo-card", card.id);
    event.dataTransfer.setData("text/plain", card.id);
  };
  return <article className={`play-card play-card--${kind} ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`} draggable={canDrag} onDragStart={beginDrag} data-card-id={card.id}>
    <button className="play-card-main" disabled={disabled || !onClick} onClick={onClick} aria-label={`Use ${card.name}`}>
      <span className="play-card-art-window">{art ? <img src={art} alt="" loading="lazy" decoding="async" /> : <NativeCardArt card={card} />}</span>
      <span className="play-card-kind">{card.subtype || card.cardType}</span>
      <span className="play-card-fallback"><b>{card.name}</b><small>{(card.rulesText ?? "No additional effect.").slice(0, 88)}</small><em>{card.catalogId}</em></span>
      <span className="play-card-meta"><b>{card.fpCost ?? "—"}<small> COST</small></b><strong>{card.focusValue ?? "—"}<small> FOCUS</small></strong><em>{card.zone ?? "—"} · {card.timing ?? "—"}</em></span>
    </button>
    <button className="play-card-inspect" onClick={onInspect} aria-label={`Inspect ${card.name}`}>Inspect</button>
  </article>;
}

function StatGlyph({ stat }: { stat: "HP" | "XP" | "FP" | "ATK" | "DEF" | "SPD" }) {
  const paths = {
    HP: <path d="M12 20s-7-4.4-9.2-8.3C.8 8.2 2.6 4.5 6.4 4.5c2.1 0 3.4 1.2 4.1 2.4.7-1.2 2-2.4 4.1-2.4 3.8 0 5.6 3.7 3.6 7.2C16 15.6 12 20 12 20Z" />,
    XP: <path d="m12 2.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8L12 2.8Z" />,
    FP: <path d="M18.5 12a6.5 6.5 0 1 1-6.5-6.5c3 0 5 1.8 5 4.1 0 2-1.7 3.5-3.8 3.5-1.7 0-2.9-1-2.9-2.3 0-1.1.9-1.9 2.1-1.9" />,
    ATK: <path d="M6.3 11.2V7.1c0-1.6 2.2-1.7 2.2-.1V5.8c0-1.6 2.2-1.7 2.2-.1V5c0-1.6 2.2-1.6 2.2 0v.8c0-1.5 2.2-1.5 2.2.1v5l1-1.1c1.1-1.2 3 .2 2 1.6l-3.7 5.2V20H8.2v-3.2l-3-3.7c-1-1.3.2-3 1.1-1.9Z" />,
    DEF: <path d="M12 2.7 19 5v5.5c0 4.4-2.7 7.7-7 10.8-4.3-3.1-7-6.4-7-10.8V5l7-2.3Z" />,
    SPD: <path d="M13.5 2.5 5.8 13h5l-1 8.5L18.2 10h-5.1l.4-7.5Z" />,
  };
  return <svg className={`fighter-stat-glyph stat-${stat.toLocaleLowerCase()}`} viewBox="0 0 24 24" aria-hidden="true">{paths[stat]}</svg>;
}

const LOADOUT_SLOTS = ["Head", "Chest", "Arms", "Legs", "Feet", "Accessory", "Hands"] as const;

function equipmentSlotLabel(card: CardEntry) {
  const raw = String(card.details?.Slot ?? "").trim();
  if (/hand/i.test(raw) || isWeapon(card)) return "Hands";
  const named = LOADOUT_SLOTS.find((slot) => slot.toLocaleLowerCase() === raw.toLocaleLowerCase());
  if (named) return named;
  if (/head|helmet|hat/i.test(`${raw} ${card.name}`)) return "Head";
  if (/chest|body|torso/i.test(`${raw} ${card.name}`)) return "Chest";
  if (/arm|bracer|glove/i.test(`${raw} ${card.name}`)) return "Arms";
  if (/leg|shin|knee/i.test(`${raw} ${card.name}`)) return "Legs";
  if (/feet|foot|shoe|boot/i.test(`${raw} ${card.name}`)) return "Feet";
  return "Accessory";
}

function FighterEquipmentTabs({ board, enemy, onInspect }: { board: Board; enemy?: boolean; onInspect: (card: CardEntry) => void }) {
  const equipment = board.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card));
  return <section className={`fighter-equipment-tabs ${enemy ? "is-enemy" : ""}`} aria-label={`${enemy ? "Opponent" : "Your"} attached Equipment`}>
    <button type="button" className="fighter-loadout-launch" onClick={() => onInspect(cardFor(board.fighterId)!)}><span>Loadout</span><b>{equipment.length}</b><small>{(board.exhaustedEquipment ?? []).length} exhausted</small></button>
    <div>{equipment.slice(0, 6).map((item, index) => {
      const exhausted = isEquipmentExhausted(board, item.id);
      return <button type="button" className={`fighter-equipment-tab ${exhausted ? "is-exhausted" : "is-ready"}`} onClick={() => onInspect(item)} title={`${item.name} · ${exhausted ? "Exhausted" : "Ready"}`} key={`${item.id}-${index}`}>
        <span>{equipmentSlotLabel(item).slice(0, 1)}</span><b>{item.name}</b><small>{exhausted ? "EXHAUSTED" : "READY"}</small>
      </button>;
    })}{equipment.length > 6 && <button type="button" className="fighter-equipment-overflow" onClick={() => onInspect(cardFor(board.fighterId)!)}>+{equipment.length - 6}<span className="sr-only"> more Equipment cards</span></button>}</div>
  </section>;
}

function FighterPanel({ board, label, enemy, onInspect, onOpenCombo, beltThresholds }: { board: Board; label: string; enemy?: boolean; onInspect: (card: CardEntry) => void; onOpenCombo?: () => void; beltThresholds: number[] }) {
  const fighter = cardFor(board.fighterId)!;
  const art = fighterIllustrationUrl(fighter) ?? artistUrl(fighter) ?? cardPlaceholderUrl;
  const nextBelt = belts[board.belt + 1];
  const currentBeltXp = beltThresholds[board.belt] ?? belts[board.belt]?.xp ?? 0;
  const xpSpan = Math.max(1, (nextBelt ? beltThresholds[board.belt + 1] : currentBeltXp) - currentBeltXp);
  const xpProgress = nextBelt ? Math.max(0, Math.min(100, (board.xp - currentBeltXp) / xpSpan * 100)) : 100;
  const hpProgress = Math.max(0, Math.min(100, board.hp / board.maxHp * 100));
  const statuses = boardStatusLabels(board);
  const combatStats: { stat: "ATK" | "DEF" | "SPD"; label: "ATK" | "DEF" | "SPD"; value: number }[] = [
    { stat: "ATK", label: "ATK", value: fighterStat(board, "ATK") },
    { stat: "DEF", label: "DEF", value: fighterStat(board, "DEF") },
    { stat: "SPD", label: "SPD", value: fighterStat(board, "Speed") },
  ];

  return <section className={`fighter-panel fighter-dossier living-fighter-card paper-stack ${enemy ? "is-enemy" : ""}`} data-side={enemy ? "ai" : "player"} data-fighter={presentationSlug(fighter.name)}>
    <i className="fighter-paperclip" aria-hidden="true" />
    <header className="fighter-card-heading"><div><span>{label}</span><button className="fighter-dossier-name" onClick={() => onInspect(fighter)}>{fighter.name}</button></div><b className="fighter-belt-badge" data-belt={presentationSlug(belts[board.belt].name)}>{belts[board.belt].name}<small>BELT</small></b></header>
    <div className="fighter-vitality" aria-label={`${fighter.name} has ${board.hp} of ${board.maxHp} HP`}>
      <div><StatGlyph stat="HP" /><b>{board.hp}</b><span>/ {board.maxHp} HP</span></div>
      <span className="fighter-hp-track" role="progressbar" aria-valuemin={0} aria-valuemax={board.maxHp} aria-valuenow={board.hp}><i style={{ width: `${hpProgress}%` }} /></span>
    </div>
    <button type="button" className="fighter-panel-art fighter-card-illustration" onClick={() => onInspect(fighter)} aria-label={`Inspect ${fighter.name}`}>
      <span className="fighter-art-halo" aria-hidden="true" />
      <img src={art} alt={fighter.name} decoding="async" />
      <span>Inspect fighter</span>
    </button>
    <div className="fighter-stats fighter-stats--combat" aria-label={`${fighter.name} combat statistics`}>
      {combatStats.map((entry) => <b key={entry.stat}><StatGlyph stat={entry.stat} /><small>{entry.label}</small><span>{entry.value}</span></b>)}
    </div>
    <div className="fighter-resource-strip">
      <div className="fighter-xp-meter"><span><b>{board.xp} XP</b><small>{nextBelt ? `${beltThresholds[board.belt + 1]} for ${nextBelt.name}` : "Final certification"}</small></span><i role="progressbar" aria-label={`${fighter.name} Belt progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(xpProgress)}><em style={{ width: `${xpProgress}%` }} /></i></div>
      <b className="fighter-focus-seal"><StatGlyph stat="FP" /><span>{board.focus}</span><small>FOCUS</small></b>
    </div>
    <div className="fighter-status-tray" aria-label={`${fighter.name} current statuses`}>{statuses.length ? statuses.map((status) => <span key={status}>{status}</span>) : <span>Standing ready</span>}</div>
    <p className="fighter-ability"><b>Registered ability</b><span>{fighter.rulesText ?? "No additional ability."}</span></p>
    <FighterEquipmentTabs board={board} enemy={enemy} onInspect={onInspect} />
    {onOpenCombo && <button type="button" className="fighter-combo-launch" onClick={onOpenCombo} aria-label={`Open Combo docket, ${board.learnedCombos.length} of 2 learned`}><span>∞ COMBOS</span><b>{board.learnedCombos.length}/2</b><small>Open docket</small></button>}
  </section>;
}

function LearnedComboRack({ states, onInspect }: { states: { combo: CardEntry; evaluation: ReturnType<typeof evaluateCombo> | null; triggered: boolean }[]; onInspect: (card: CardEntry) => void }) {
  if (!states.length) return null;
  return <section className="active-combo-rack fighter-combo-rack" aria-label="Learned Combos">
    <header><span>∞ Learned Combos</span><small>Face up · always watching</small></header>
    <div className="active-combo-grid">{states.map(({ combo, evaluation, triggered }) => {
      const state = triggered ? "is-triggered" : evaluation?.eligible ? "is-ready" : evaluation && !evaluation.supported ? "is-manual" : "";
      const status = triggered ? "Triggered" : evaluation?.eligible ? "Will trigger" : evaluation && !evaluation.supported ? "Manual resolver" : "Watching";
      return <button type="button" className={`active-combo-card ${state}`} onClick={() => onInspect(combo)} key={combo.id}><i aria-hidden="true">∞</i><b>{combo.name}</b><span>{comboRequirementText(combo)}</span><small>{status}</small></button>;
    })}</div>
  </section>;
}

function StageCard({ cardId, side, label, onInspect }: { cardId?: string | null; side: "player" | "ai"; label: string; onInspect: (card: CardEntry) => void }) {
  const card = cardId ? cardFor(cardId) : null;
  return <div className={`clash-card-slot clash-card-slot--${side} ${card ? "is-occupied" : ""}`}>
    <span>{label}</span>
    {card ? <button type="button" onClick={() => onInspect(card)} aria-label={`Inspect ${card.name}`} key={card.id}>
      <span className="clash-card-art">{artistUrl(card) ? <img src={artistUrl(card)} alt="" /> : <NativeCardArt card={card} />}</span>
      <span className="clash-card-copy"><b>{card.name}</b><small>{card.subtype || card.cardType}{card.zone ? ` · ${card.zone}` : ""}</small></span>
    </button> : <div className="clash-card-empty"><i aria-hidden="true" /><small>Waiting</small></div>}
  </div>;
}

function ImpactReadout({ exchange, line }: { exchange?: PlaytestCombatExchange | null; line: string }) {
  if (exchange) {
    const attack = cardFor(exchange.attackCardId);
    const defense = exchange.defenseCardId ? cardFor(exchange.defenseCardId) : null;
    return <blockquote className={`impact-readout exchange-receipt is-${exchange.outcome}`} key={exchange.id}>
      <header><span>{exchange.outcome === "hit" ? "Impact certified" : "Block certified"}</span><b>{exchange.zone} · {exchange.isReversal ? "REVERSAL" : "STRIKE"}</b></header>
      <p><strong>{attack?.name ?? "Attack"}</strong>{defense ? <> met <strong>{defense.name}</strong></> : <> met standing defense</>}</p>
      <div><b>{exchange.attackPower}<small>ATK</small></b><i>−</i><b>{exchange.defensePower}<small>DEF</small></b><i>=</i><strong>{exchange.damage}<small>HP</small></strong></div>
      {exchange.notes?.length ? <small>{exchange.notes.slice(0, 2).join(" · ")}</small> : null}
    </blockquote>;
  }
  const math = line.match(/Attack (\d+) vs Defense (\d+)/i);
  const hit = math ? Number(math[1]) > Number(math[2]) : false;
  const finalDamage = line.match(/hits(?: [^.]*?)? for (\d+)/i)?.[1];
  return <blockquote className={`impact-readout ${math ? (hit ? "is-hit" : "is-block") : ""}`} key={line}>
    <span>{math ? (hit ? "Impact certified" : "Block certified") : "Latest filing"}</span>
    {math && <div><b>{math[1]}<small>ATK</small></b><i>−</i><b>{math[2]}<small>DEF</small></b><i>=</i><strong>{finalDamage ?? Math.max(0, Number(math[1]) - Number(math[2]))}<small>HP</small></strong></div>}
    {!math && <p>{line}</p>}
  </blockquote>;
}

function CombatStage({ match, currentLocation, selectedAttack, turnCoach, guided, playerCards, aiCards, onInspect, onDropCard, onOpenCoach }: { match: Match; currentLocation?: CardEntry; selectedAttack?: CardEntry | null; turnCoach: string; guided: boolean; playerCards: string[]; aiCards: string[]; onInspect: (card: CardEntry) => void; onDropCard: (id: string) => void; onOpenCoach: () => void }) {
  const exchange = match.lastExchange;
  const pendingAiAttack = match.pendingStrike?.cardId ?? null;
  const playerStageCard = selectedAttack?.id
    ?? (pendingAiAttack ? exchange?.target === "player" ? exchange.defenseCardId : null : exchange?.actor === "player" ? exchange.attackCardId : exchange?.target === "player" ? exchange.defenseCardId : null);
  const aiStageCard = pendingAiAttack
    ?? (exchange?.actor === "ai" ? exchange.attackCardId : exchange?.target === "ai" ? exchange.defenseCardId : null);
  const hotZone = match.pendingStrike?.zone ?? (selectedAttack ? match.selectedZone : exchange?.zone);
  const phaseLabel = match.phase === "player-initiate" ? "INITIATE"
    : match.phase === "player-yell" ? "YELL"
      : match.phase === "player-ascend" ? "ASCEND"
        : match.phase === "defense-window" ? "REACTION"
          : match.phase === "reversal-window" ? "REVERSAL" : "OPPONENT";
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("application/x-dojo-card") || event.dataTransfer.getData("text/plain");
    if (id) onDropCard(id);
  };

  return <section className={`playtest-combat-desk combat-stage paper-stack state-${match.phase}`}>
    <header className="combat-stage-heading"><button type="button" onClick={() => currentLocation && onInspect(currentLocation)}><span>Current Scene</span><b>{currentLocation?.name ?? "Tournament Mat"}</b><small><i>SCENE RULE</i>{currentLocation?.rulesText ?? "The Department finds no reason to intervene."}</small></button><div><span>ROUND</span><b>{match.round}</b><small>{phaseLabel}</small></div></header>
    <div className="clash-field" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} aria-label="Combat stage. Drag a playable card here or use its button.">
      <StageCard cardId={playerStageCard} side="player" label={pendingAiAttack ? "Your response" : "Your declaration"} onInspect={onInspect} />
      <div className="clash-seal" aria-label={`${hotZone ?? "No"} combat zone`}><span>{exchange?.outcome === "hit" && !pendingAiAttack && !selectedAttack ? "HIT" : exchange?.outcome === "block" && !pendingAiAttack && !selectedAttack ? "BLOCK" : phaseLabel}</span><b>{(hotZone ?? "—").slice(0, 1)}</b><small>{hotZone ?? "Choose a card"}</small></div>
      <StageCard cardId={aiStageCard} side="ai" label={pendingAiAttack ? "Incoming strike" : "Opponent filing"} onInspect={onInspect} />
    </div>
    <div className="combat-zone-board" aria-label="Combat zones">{["High", "Mid", "Low"].map((zone) => <span className={hotZone === zone ? "is-hot" : ""} key={zone}><b>{zone.slice(0, 1)}</b>{zone}</span>)}</div>
    <div className="live-mat-play live-mat-play--stage">
      <MatLane label="Your filed cards" cards={playerCards} activeId={match.selectedAttackId} onInspect={onInspect} />
      <MatLane label="Opponent filings" cards={aiCards} activeId={match.pendingStrike?.cardId} onInspect={onInspect} />
    </div>
    <ImpactReadout exchange={exchange} line={match.log[0]} />
    {guided && <button type="button" className="contextual-coach-slip" onClick={onOpenCoach}><span>Decision Coach</span><b>{turnCoach}</b><small>Open coach →</small></button>}
  </section>;
}

function FeaturedComboPanel({ card, focus, learnedCount, attempted, discount = 0, onLearn, onPass, onContinue, onInspect }: { card: CardEntry; focus: number; learnedCount: number; attempted: boolean; discount?: number; onLearn: () => void; onPass: () => void; onContinue: () => void; onInspect: () => void }) {
  const [comboPanelOpen, setComboPanelOpen] = useState(false);
  const art = artistUrl(card);
  const printedCost = cardCost(card);
  const cost = Math.max(0, printedCost - discount);
  const headingId = `featured-combo-${presentationSlug(card.id)}`;
  const requirement = String(card.details?.["Sequence / Requirement"] ?? "See the printed Combo requirement.");
  const payoff = String(card.details?.Effect ?? card.rulesText ?? "See the printed Combo payoff.");
  const toggleComboPanel = () => setComboPanelOpen((open) => !open);
  const handleComboHeaderKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleComboPanel();
  };
  return <aside className={`ascend-featured-combo${comboPanelOpen ? " is-open" : ""}`} data-combo-popout="ready" aria-labelledby={headingId}>
    <header role="button" tabIndex={0} aria-expanded={comboPanelOpen} aria-label={`${comboPanelOpen ? "Close" : "Open"} featured Combo ${card.name}`} onClick={toggleComboPanel} onKeyDown={handleComboHeaderKeyDown}><div><span className="eyebrow">Featured Combo · same decision desk</span><h3 id={headingId}>{card.name}</h3></div><span className="ascend-featured-combo-state">{attempted ? "FILED" : `${learnedCount}/2 LEARNED`}</span></header>
    <button type="button" className="ascend-featured-combo-card" onClick={onInspect} aria-label={`Inspect ${card.name}`}>
      {art ? <img src={art} alt="" loading="lazy" /> : <NativeCardArt card={card} />}
    </button>
    <div className="ascend-featured-combo-meta"><b>{cost} FOCUS{discount ? ` · −${discount}` : ""}</b><span>{card.catalogId}</span></div>
    <div className="ascend-featured-combo-copy"><p><b>REQUIREMENT</b>{requirement}</p><p><b>PAYOFF</b>{payoff}</p>{card.flavorText && <em>{card.flavorText}</em>}</div>
    <div className="ascend-featured-combo-actions">
      {attempted ? <><strong className="ascend-featured-combo-filed">Combo decision filed for this Ascend.</strong><button type="button" className="button primary" onClick={onContinue}>Continue to Belt Check →</button></> : <><button type="button" className="button primary" disabled={focus < cost || learnedCount >= 2} onClick={onLearn}>Learn {card.name}</button><button type="button" className="button ghost" onClick={onPass}>Pass Combo</button></>}
    </div>
  </aside>;
}

function MatLane({ label, cards: cardIds, activeId, onInspect }: { label: string; cards: string[]; activeId?: string | null; onInspect: (card: CardEntry) => void }) {
  const visible = cardIds;
  return <section className="mat-lane" aria-label={`${label} cards currently on the Live Mat`}>
    <header><span>{label}</span><b>{visible.length ? `${visible.length} CARD${visible.length === 1 ? "" : "S"}` : "CLEAR"}</b></header>
    <div className="mat-lane-cards">
      {visible.length ? visible.map((id, index) => { const card = cardFor(id); if (!card) return null; const art = artistUrl(card); return <button type="button" className={id === activeId ? "is-active" : ""} onClick={() => onInspect(card)} title={`Inspect ${card.name}`} key={`${id}-${index}`}>
        <span className="mat-card-visual">{art ? <img src={art} alt="" /> : <NativeCardArt card={card} />}</span>
        <span className="mat-card-copy"><b>{card.name}</b><small>{card.subtype || card.cardType}{card.zone ? ` · ${card.zone}` : ""}</small></span>
      </button>; }) : <p>No cards committed this turn.</p>}
    </div>
  </section>;
}

function SetupView({ selectedId, setSelectedId, settings, setSettings, begin }: { selectedId: string; setSelectedId: (id: string) => void; settings: HouseSettings; setSettings: (settings: HouseSettings) => void; begin: () => void }) {
  const [query, setQuery] = useState("");
  const selected = cardFor(selectedId) ?? characters[0];
  const filteredCharacters = characters.filter((character) => `${character.name} ${character.rulesText ?? ""} ${Object.values(character.stats).join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const randomize = () => {
    const choices = filteredCharacters.filter((character) => character.id !== selectedId);
    const next = choices[Math.floor(Math.random() * choices.length)] ?? filteredCharacters[0] ?? characters[0];
    setSelectedId(next.id);
  };
  const toggleHouseRule = (id: string) => setSettings({ ...settings, houseRuleIds: settings.houseRuleIds.includes(id) ? settings.houseRuleIds.filter((entry) => entry !== id) : [...settings.houseRuleIds, id] });
  return <main className="playtest-shell playtest-shell--setup shell"><MobilePlaytestNotice />
    <section className="playtest-hero paper-stack"><span className="eyebrow">Department-certified digital field test</span><h1>Shuffle. Strike. Ascend.</h1><p>This is the actual Quick Duel loop: the fixed {starterIds.length}-card curriculum, all approved Market records, live fighter data, automated Locations, Reversals, Belt Exams, and a separate Combo docket.</p><div className="playtest-stamps"><span>{cards.length} approved records</span><span>Quick Duel vs. tactical AI</span><span>Progress saved on this device</span></div></section>
    <section className="playtest-setup-grid">
      <div className="playtest-roster paper-stack"><div className="roster-toolbar"><div><span className="eyebrow">1 · Choose a fighter</span><h2>Who signs the waiver?</h2></div><div><label><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a fighter" aria-label="Search fighters" /></label><button onClick={randomize}>Random draw</button></div></div><article className="selected-fighter-dossier"><img src={fighterIllustrationUrl(selected) ?? artistUrl(selected) ?? cardPlaceholderUrl} alt={selected.name} /><div><span>Selected delegation</span><h3>{selected.name}</h3><p>{selected.rulesText ?? "Ability pending an inspector with a functioning pen."}</p><div><b>{numberValue(selected.stats.ATK)}<small>ATK</small></b><b>{numberValue(selected.stats.DEF)}<small>DEF</small></b><b>{numberValue(selected.stats.Speed)}<small>SPD</small></b></div></div></article><div className="playtest-character-grid">{filteredCharacters.map((character) => <button key={character.id} className={selectedId === character.id ? "is-selected" : ""} onClick={() => setSelectedId(character.id)} aria-pressed={selectedId === character.id}><img src={fighterIllustrationUrl(character) ?? artistUrl(character) ?? cardPlaceholderUrl} alt="" loading="lazy" /><span>{character.name}</span><small>{numberValue(character.stats.ATK)} ATK · {numberValue(character.stats.DEF)} DEF · {numberValue(character.stats.Speed)} SPD</small></button>)}</div></div>
      <aside className="playtest-rules-panel quick-duel-brief paper-stack"><span className="eyebrow">2 · One official teaser</span><h2>Certified Quick Duel</h2><p>One fighter. One tactical opponent. Fixed 25 Max HP, non-HP Belt rewards, the persistent Market, Locations, Reversals, Combos, and Belt progression. No mode selection and no setup maze—the Department has already made the questionable decisions.</p><div className="playtest-setup-options"><label><span>Opponent</span><select value={settings.difficulty} onChange={(event) => setSettings({ ...settings, difficulty: event.target.value as Difficulty })}>{Object.entries(DIFFICULTIES).map(([value, option]) => <option value={value} key={value}>{option.label}</option>)}</select></label><label><span>Combat motion</span><select value={settings.motion} onChange={(event) => setSettings({ ...settings, motion: event.target.value as MotionMode })}><option value="full">Full</option><option value="reduced">Reduced</option><option value="off">Off</option></select></label><label className="playtest-setup-check"><input type="checkbox" checked={settings.guided} onChange={(event) => setSettings({ ...settings, guided: event.target.checked })} /><span>Start with Decision Coach</span></label></div><fieldset className="playtest-house-rules"><legend>Optional house rules</legend><p>Only variants the current Quick Duel engine can enforce for both sides appear here.</p>{QUICK_DUEL_HOUSE_RULES.map((rule) => <label className="playtest-house-rule-option" key={rule.id}><input type="checkbox" checked={settings.houseRuleIds.includes(rule.id)} onChange={() => toggleHouseRule(rule.id)} /><span><b>{rule.name}</b><small>{rule.summary || rule.rule}</small></span></label>)}</fieldset><ul><li>Desktop playtest</li><li>{DIFFICULTIES[settings.difficulty].detail}</li><li>Progress saved on this device</li></ul><button className="button primary field-test-launch" onClick={() => begin()}>Begin Quick Duel as {selected.name} <span>→</span></button></aside>
    </section>
  </main>;
}

function MobilePlaytestNotice() {
  return <section className="playtest-mobile-notice paper-stack"><span className="eyebrow">Desktop field test</span><h1>Quick Duel needs a bigger mat.</h1><p>The playable teaser is intentionally hidden on phones. Open this page on a desktop or laptop to fight; the rules and Card Library remain fully mobile-friendly.</p></section>;
}

// -----------------------------------------------------------------------------
// MAIN QUICK DUEL COORDINATOR
// This component owns browser state and delegates mechanical work to the helpers and
// runtime hosts above. When this section becomes hard to follow, extract UI/state
// orchestration — do not move canonical rules back into React.
// -----------------------------------------------------------------------------

export default function PlaytestView({ goTo }: { goTo: (view: "rules" | "cards") => void }) {
  const [selectedId, setSelectedId] = useState(() => characters.find((card) => card.name === "Sensei Ducktape")?.id ?? characters[0].id);
  const [settings, setSettings] = useState<HouseSettings>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("ddb-field-settings") ?? "null") as Partial<HouseSettings> | null;
      const storedMotion = window.localStorage.getItem("ddb-vfx-mode");
      const motion = saved?.motion ?? (storedMotion === "reduced" || storedMotion === "off" ? storedMotion : "full");
      return { tempo: saved?.tempo ?? true, locations: saved?.locations ?? true, openMarket: saved?.openMarket ?? true, guided: saved?.guided ?? true, autoAi: saved?.autoAi ?? true, balancedMarket: saved?.balancedMarket ?? true, difficulty: saved?.difficulty && DIFFICULTIES[saved.difficulty] ? saved.difficulty : "certified", motion, houseRuleIds: sanitizeQuickDuelHouseRuleIds(saved?.houseRuleIds) };
    } catch { return { tempo: true, locations: true, openMarket: true, guided: true, autoAi: true, balancedMarket: true, difficulty: "certified", motion: "full", houseRuleIds: [] }; }
  });
  const beltThresholds = useMemo(() => effectiveBeltThresholds(belts, settings.houseRuleIds), [settings.houseRuleIds]);
  const [match, setRawMatch] = useState<Match | null>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("ddb-field-match") ?? "null") as Match | null;
      const validSavedMatch = saved?.schema === 8 && saved?.player?.fighterId && saved?.ai?.fighterId && saved.turnOrder?.length === 2 && cardFor(saved.player.fighterId) && cardFor(saved.ai.fighterId) ? saved : null;
      if (!validSavedMatch) return null;
      const normalized = normalizePendingDamageChoice(validSavedMatch);
      const repairedPlayer = repairBoardWeaponHandLimit(normalized.player);
      const repairedAi = repairBoardWeaponHandLimit(normalized.ai);
      const repairedNames = [...repairedPlayer.removed, ...repairedAi.removed].map((id) => cardFor(id)?.name ?? id);
      return {
        ...normalized,
        player: repairedPlayer.board,
        ai: repairedAi.board,
        log: repairedNames.length
          ? [`Loadout audit: moved excess Weapon${repairedNames.length === 1 ? "" : "s"} to discard to restore the two-Hand limit (${repairedNames.join(", ")}).`, ...normalized.log].slice(0, 32)
          : normalized.log,
      };
    } catch { return null; }
  });
  const setMatch = (update: SetStateAction<Match | null>) => setRawMatch((previous) => {
    const next = typeof update === "function" ? update(previous) : update;
    if (!previous && next?.phase === "player-initiate") {
      const initiated = withPlayerCharacterChoice(publishQuickDuelPlaytestLifecycleEvent(next, "player", "onInitiate", quickDuelHostOperations, cardFor));
      return { ...initiated, player: applyInitiateCarryover(initiated.player) };
    }
    return previous && next ? applyQuickDuelPlaytestTransition(previous, next, cardFor) : next;
  });
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [inspectorZoomed, setInspectorZoomed] = useState(false);
  const [savedCardIds, setSavedCardIds] = useState<Set<string>>(() => readBinderIds());
  const [logOpen, setLogOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [deskView, setDeskView] = useState<DeskView | null>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("ddb-field-match") ?? "null") as Match | null;
      return saved?.phase === "player-ascend" ? "market" : null;
    } catch { return null; }
  });
  useEffect(() => {
  const handleTrainingStripeHeal = () => {
    if (deskView !== "belt") return;
    setMatch((current) => {
      if (!current || current.phase !== "player-ascend") return current;
      const next = spendQuickDuelTrainingStripeForHealing(current, "player", "belt-check");
      if (next === current) return current;
      const recovered = next.player.hp - current.player.hp;
      if (recovered <= 0) return current;
      return {
        ...next,
        log: [`Training Stripe redeemed: recover ${recovered} HP (${current.player.hp} → ${next.player.hp}).`, ...next.log].slice(0, 32),
      };
    });
  };
  window.addEventListener(QUICK_DUEL_TRAINING_STRIPE_HEAL_REQUEST_EVENT, handleTrainingStripeHeal);
  return () => window.removeEventListener(QUICK_DUEL_TRAINING_STRIPE_HEAL_REQUEST_EVENT, handleTrainingStripeHeal);
}, [deskView]);
  const [rulesSync, setRulesSync] = useState<RulesSyncState>({ status: "checking", currentVersion: activeRulesRevision, latestVersion: activeRulesRevision, checkedAt: 0 });
  const inspected = inspectedId ? cardFor(inspectedId) : null;

  useEffect(() => {
    window.localStorage.setItem("ddb-field-settings", JSON.stringify(settings));
    window.localStorage.setItem("ddb-vfx-mode", settings.motion);
  }, [settings]);
  useEffect(() => {
    try {
      if (match) window.localStorage.setItem("ddb-field-match", JSON.stringify(match));
      else window.localStorage.removeItem("ddb-field-match");
    } catch {
      window.localStorage.removeItem("ddb-field-match");
    }
  }, [match]);
  useEffect(() => {
    window.localStorage.setItem(BINDER_STORAGE_KEY, JSON.stringify([...savedCardIds]));
  }, [savedCardIds]);
  useEffect(() => {
    const controller = new AbortController();
    const check = () => fetchRulesManifest(controller.signal)
      .then((manifest) => setRulesSync(rulesSyncState(activeRulesRevision, manifest.rulesRevision ?? manifest.rulesVersion)))
      .catch(() => setRulesSync((current) => ({ ...current, status: "offline", checkedAt: Date.now() })));
    void check();
    const timer = window.setInterval(check, 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    setInspectorZoomed(false);
    if (!inspectedId && !deskView && !logOpen && !coachOpen) return;
    const previousOverflow = document.body.style.overflow;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (inspectedId) setInspectedId(null);
      else if (deskView) setDeskView(null);
      else if (logOpen) setLogOpen(false);
      else setCoachOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", close); };
  }, [inspectedId, deskView, logOpen, coachOpen]);

  const begin = (fighterId = selectedId) => {
    const choices = characters.filter((card) => card.id !== fighterId);
    const player = { ...emptyBoard(fighterId), xp: 1 };
    const challenge = DIFFICULTIES[settings.difficulty];
    const ai = { ...emptyBoard(choices[Math.floor(Math.random() * choices.length)].id), xp: 1, hp: challenge.aiHp, maxHp: challenge.aiHp, statBoost: challenge.statBoost };
    const locations = shuffle(quickDuelLocationPool.map((card) => card.id));
    const shuffledMarket = shuffle(marketPool.filter((card) => settings.openMarket || Boolean(artistUrl(card))).map((card) => card.id));
    const openingMarket = curateOpeningMarket(shuffledMarket, settings.balancedMarket);
    const comboDeck = shuffle(comboPool.map((card) => card.id));
    const currentLocation = settings.locations ? locations[0] : locationPool.find((card) => card.name === "Tournament Mat")?.id ?? locations[0];
    const playerFirst = fighterStat(player, "Speed") >= fighterStat(ai, "Speed");
    const turnOrder: Match["turnOrder"] = playerFirst ? ["player", "ai"] : ["ai", "player"];
    setDeskView(null);
    setMatch({ schema: 8, rulesVersion: activeRulesRevision, player, ai, market: openingMarket.market, marketDeck: openingMarket.marketDeck, marketDiscard: [], marketPurchasedThisRound: false, comboDeck: comboDeck.slice(1), comboOfferId: comboDeck[0] ?? null, locations: locations.slice(1), locationId: currentLocation, round: 1, phase: playerFirst ? "player-initiate" : "ai-ready", turnOrder, turnIndex: 0, selectedAttackId: null, selectedZone: "High", pendingStrike: null, pendingDiscard: null, pendingChoice: null, pendingCombatContinuation: null, reversalRemainingAiAttacks: [], reversalReason: null, reversalIncomingZone: null, attackCostDecisionCardId: null, nonHonorSceneChangedThisRound: false, exchangeSequence: 0, lastExchange: null, winner: null, log: [`${challenge.label} field test opened under rules ${activeRulesRevision}. The waiver is legally adjacent to complete.`, `Honor 1: ${cardFor(currentLocation)?.name ?? "Tournament Mat"} is active. Both fighters gain 1 XP and refresh Tempo.`, `${playerFirst ? "You" : "Computer"} win initiative on current Speed.`] });
  };

  const write = (current: Match, line: string, changes: Partial<Match> = {}) => ({ ...current, ...changes, log: [line, ...current.log].slice(0, 32) });
  const player = match?.player;
  const ai = match?.ai;
  const playerFighter = player ? cardFor(player.fighterId)! : null;
  const aiFighter = ai ? cardFor(ai.fighterId)! : null;
  const playerTask = useMemo(() => player ? player.completedTasks.includes(player.belt + 1) : false, [player]);

  const chooseAttack = (card: CardEntry) => setMatch((current) => {
    if (!current) return current;
    if ((current.player.stage3cRestrictions ?? []).includes("attack")) return current;
    if (weaponAttackBlocked(current.player, card)) return write(current, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} cannot attack with a Weapon while this Equipment restriction is active.`);
    if (current.player.attackLockedThisTurn && current.player.attacksThisTurn > 0) return current;
    if (current.attackCostDecisionCardId && current.attackCostDecisionCardId !== card.id) return current;
    const zones = attackAllowedZones(current.player, card);
    const selectedAttackId = current.selectedAttackId === card.id ? null : card.id;
    const selectedZone = zones.includes(current.selectedZone) ? current.selectedZone : zones[0] ?? "High";
    return { ...current, selectedAttackId, selectedZone };
  });

  const equipPermanent = (id: string) => setMatch((current) => {
    if (!current || current.phase !== "player-initiate" || current.winner) return current;
    const card = cardFor(id);
    if (!card || !isPermanent(card)) return current;
    if (weaponUsesTwoHands(card) && equipmentHasRestriction(current.player, "noTwoHandedWeapon")) {
      return write(current, `${card.name} cannot be equipped while a no-two-handed-Weapon restriction is active.`);
    }
    const handLimitMessage = weaponHandLimitMessage(current.player, card);
    if (handLimitMessage) return write(current, handLimitMessage);
    const characterEquip = publishQuickDuelPlaytestEquip(current, "player", card);
    if (!characterEquip.allowed) return write(current, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} cannot equip ${card.name}.`);
    const equippedMatch = characterEquip.match;
    let nextPlayer = applyCardEffects({ ...equippedMatch.player, hand: removeOne(equippedMatch.player.hand, id), playArea: [...equippedMatch.player.playArea, id], cardsThisTurn: [...equippedMatch.player.cardsThisTurn, id] }, card, "player");
    let pendingChoice: PendingChoice | null = null;
    const beltName = belts[nextPlayer.belt]?.name ?? "White";
    for (const sourceId of nextPlayer.equipment) {
      const source = cardFor(sourceId);
      if (!source) continue;
      const plan = equipmentOnEquipPlan(source, card, { beltName });
      if (!plan) continue;
      if (plan.exhaustSource && !isEquipmentExhausted(nextPlayer, sourceId)) nextPlayer = exhaustEquipment(nextPlayer, sourceId);
      if (plan.draw) nextPlayer = drawCards(nextPlayer, plan.draw);
      if (plan.nextAttackPower) nextPlayer = { ...nextPlayer, nextAttackBonus: nextPlayer.nextAttackBonus + plan.nextAttackPower };
      if (plan.discard) {
        const count = Math.min(plan.discard, nextPlayer.hand.length);
        if (count) return write(equippedMatch, `${card.name} equipped. ${source.name} requires ${count} discard${count === 1 ? "" : "s"}.`, { player: nextPlayer, pendingDiscard: { sourceCardId: source.id, remaining: count, sourceFollowup: false } });
      }
      if (plan.readyOther && (nextPlayer.exhaustedEquipment ?? []).some((candidate) => candidate !== sourceId)) pendingChoice = { kind: "ready-equipment", sourceCardId: source.id, optional: true };
    }
    return write(equippedMatch, `${card.name} equipped during Initiate. ${cardEffectNote(card)}`, { player: nextPlayer, pendingChoice });
  });


  const beginYell = () => setMatch((current) => current?.phase === "player-initiate" && !current.pendingChoice ? write(current, "Initiate complete. Yell begins; subtlety has left the building.", { phase: "player-yell", player: { ...current.player, usedEffectIdsThisTurn: [] } }) : current);


  const activateEquipment = (id: string) => {
    setInspectedId(null);
    setMatch((current) => {
      if (!current || current.winner || current.pendingChoice || !current.player.equipment.includes(id) || isEquipmentExhausted(current.player, id)) return current;
      const card = cardFor(id);
      const plan = card ? equipmentActivationPlan(card) : null;
      if (!card || !plan || !equipmentActivationAvailable(current.player, card, current.phase)) return current;
      let player = exhaustEquipment(current.player, id);
      let ai = current.ai;
      let winner: Match["winner"] = current.winner;
      let pendingChoice: PendingChoice | null = null;
      let note = `${card.name} exhausted.`;
      if (plan.kind === "next-attack-power") {
        player = { ...player, nextAttackBonus: player.nextAttackBonus + plan.power };
        note += ` Your next Attack gets +${plan.power} Attack Power.`;
      } else if (plan.kind === "zone-attack") {
        pendingChoice = { kind: "equipment-zone", sourceCardId: id, power: plan.power, piercing: plan.piercing, blockedFocus: plan.blockedFocus, requireDifferentPreviousZone: plan.requireDifferentPreviousZone };
        note += " Choose the zone for the armed effect.";
      } else if (plan.kind === "speed-cycle") {
        player = { ...player, tempSpeed: player.tempSpeed + plan.speed, speedChangedThisRound: true };
        note += ` +${plan.speed} Speed until Honor.`;
        if (player.tempo && plan.draw) {
          player = drawCards(player, plan.draw);
          const discard = Math.min(plan.discard, player.hand.length);
          if (discard) pendingChoice = { kind: "discard-hand", sourceCardId: id, remaining: discard };
          note += ` Tempo is ready, so draw ${plan.draw}${discard ? ` and choose ${discard} discard${discard === 1 ? "" : "s"}` : ""}.`;
        }
      } else if (plan.kind === "incoming-zone-penalty") {
        pendingChoice = { kind: "incoming-equipment-zone", sourceCardId: id, attackPowerPenalty: plan.attackPowerPenalty };
        note += " Call High, Mid, or Low against the declared Attack.";
      } else if (plan.kind === "defense-guard") {
        const greenBeltIndex = belts.findIndex((belt) => belt.name.toLocaleLowerCase() === "green");
        const reversalPower = greenBeltIndex >= 0 && player.belt >= greenBeltIndex ? plan.reversalPower : 0;
        player = {
          ...player,
          equipmentDefenseGuard: (player.equipmentDefenseGuard ?? 0) + plan.guard,
          pendingReversalBonusOnBlock: (player.pendingReversalBonusOnBlock ?? 0) + reversalPower,
        };
        note += ` Your next Defense in this Reaction Window gets +${plan.guard} Guard.${reversalPower ? ` A Block primes the Reversal for +${reversalPower} Attack Power.` : ""}`;
      } else if (plan.kind === "initiate-tempo-focus" || plan.kind === "after-kata-focus") {
        player = { ...player, focus: player.focus + plan.focus };
        note += ` +${plan.focus} Focus.`;
      } else if (plan.kind === "first-hit-discard-focus") {
        pendingChoice = { kind: "discard-hand", sourceCardId: id, remaining: Math.min(plan.discard, player.hand.length) };
        note += ` Choose ${plan.discard} card${plan.discard === 1 ? "" : "s"} to discard; completing the cost gains ${plan.focus} Focus.`;
      } else if (plan.kind === "hit-direct-damage") {
        ai = { ...ai, hp: Math.max(0, ai.hp - plan.damage), damageTaken: ai.damageTaken + plan.damage };
        player = { ...player, damageDealt: player.damageDealt + plan.damage, xp: ai.hp - plan.damage <= 0 ? player.xp + 2 : player.xp };
        winner = ai.hp ? winner : "player";
        note += ` ${plan.damage} direct damage to ${cardFor(ai.fighterId)?.name ?? "the opponent"}.`;
      } else if (plan.kind === "hit-next-initiate-focus") {
        player = { ...player, nextInitiateFocus: (player.nextInitiateFocus ?? 0) + plan.focus };
        note += ` +${plan.focus} Focus scheduled for your next Initiate.`;
      } else if (plan.kind === "numbered-attack-power") {
        player = { ...player, nextAttackBonus: player.nextAttackBonus + plan.power };
        note += ` Attack ${plan.attackNumber} gets +${plan.power} Attack Power.`;
      }
      return write(current, note, { player, ai, pendingChoice, winner });
    });
  };

  const chooseEquipmentZone = (zone: string) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "equipment-zone") return current;
    const player = { ...current.player, equipmentAttackPlan: { sourceCardId: choice.sourceCardId, zone, power: choice.power, piercing: choice.piercing, blockedFocus: choice.blockedFocus, requireDifferentPreviousZone: choice.requireDifferentPreviousZone } };
    return write(current, `${cardFor(choice.sourceCardId)?.name ?? "Equipment"} commits its next-Attack effect to ${zone}.`, { player, pendingChoice: null });
  });

  const chooseIncomingEquipmentZone = (zone: string) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "incoming-equipment-zone" || !current.pendingStrike) return current;
    const matched = zone.toLocaleLowerCase() === current.pendingStrike.zone.toLocaleLowerCase();
    const pendingStrike = matched
      ? { ...current.pendingStrike, attackPower: Math.max(0, current.pendingStrike.attackPower - choice.attackPowerPenalty), modifierNotes: [...current.pendingStrike.modifierNotes, `${cardFor(choice.sourceCardId)?.name ?? "Equipment"} called ${zone}: -${choice.attackPowerPenalty} Attack Power`] }
      : current.pendingStrike;
    return write(current, `${cardFor(choice.sourceCardId)?.name ?? "Equipment"} calls ${zone}.${matched ? ` The declared Attack loses ${choice.attackPowerPenalty} Attack Power.` : " The call misses the declared zone."}`, { pendingStrike, pendingChoice: null });
  });


  const resumeAfterDefense = (current: Match) => {
    const continuation = current.pendingCombatContinuation;
    const cleared: Match = { ...current, pendingChoice: null, pendingCombatContinuation: null };
    if (!continuation) return cleared;
    const reversalAttacks = cleared.player.hand.filter((id) => { const card = cardFor(id); return Boolean(card && isAttack(card)); });
    if (continuation.reversalEligible && !cleared.player.reversalUsedRound && reversalAttacks.length) {
      return write(cleared, `Reversal window: the block is certified and ${reversalAttacks.length} counterattack${reversalAttacks.length === 1 ? " is" : "s are"} ready.`, { phase: "reversal-window", reversalRemainingAiAttacks: continuation.remainingAiAttacks, selectedAttackId: null });
    }
    if (continuation.remainingAiAttacks.length) return openAiStrike(cleared, continuation.remainingAiAttacks[0], continuation.remainingAiAttacks.slice(1), settings.tempo, settings.locations, settings.houseRuleIds);
    return finishAiTurn(cleared, "Computer finishes its Yell and clears the mat.", settings.locations, settings.houseRuleIds);
  };

  const usePendingEquipmentChoice = () => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice) return current;
    if (choice.kind === "prevent-combat-damage") {
      return resolveDefenseState(current, choice.defenseId, {
        sourceCardId: choice.sourceCardId,
        reduce: choice.reduce,
        readyAtHideMinBelt: choice.readyAtHideMinBelt,
        readyAtHideMinDamage: choice.readyAtHideMinDamage,
      }, true);
    }
    if (choice.kind === "post-block-cycle") {
      if (!current.player.equipment.includes(choice.sourceCardId) || isEquipmentExhausted(current.player, choice.sourceCardId)) return resumeAfterDefense({ ...current, pendingChoice: null });
      let player = exhaustEquipment(current.player, choice.sourceCardId);
      player = drawCards(player, choice.draw);
      const discardCount = Math.min(choice.discard, player.hand.length);
      if (discardCount) {
        return write(current, `${cardFor(choice.sourceCardId)?.name ?? "Equipment"} exhausted after the Block. Draw ${choice.draw}; now choose ${discardCount} discard${discardCount === 1 ? "" : "s"}.`, { player, pendingChoice: { kind: "discard-hand", sourceCardId: choice.sourceCardId, remaining: discardCount, afterChoice: "resume-defense" } });
      }
      return resumeAfterDefense(write(current, `${cardFor(choice.sourceCardId)?.name ?? "Equipment"} exhausted after the Block and drew ${choice.draw}.`, { player, pendingChoice: null }));
    }
    return current;
  });

  const resolvePlayerAttackState = (current: Match, existingDeclaration?: QuickDuelPlaytestAttackDeclarationResult<Match>): Match => {
    if (!current?.selectedAttackId || current.phase !== "player-yell" || current.winner || current.pendingDiscard || current.pendingChoice || stage3cRestrictionBlocks(current.player.stage3cRestrictions, "attack")) return current;
    const card = cardFor(current.selectedAttackId);
    if (!card || !isAttack(card) || !current.player.hand.includes(card.id)) return current;
    if (weaponAttackBlocked(current.player, card)) return write(current, `${card.name} cannot be used while a no-Weapon-Attacks restriction is active.`, { selectedAttackId: null });
    if (hasUntargetableStatus(current.ai.stage3cStatuses)) return write(current, `${cardFor(current.ai.fighterId)?.name ?? "The opponent"} cannot be targeted through Smoke Bomb. Choose a different action.`, { selectedAttackId: null });
    const anyZone = attackHasFlexibleZone(current.player, card);
    const requestedZone = anyZone ? current.selectedZone : card.zone?.split(",")[0] ?? "High";
    const declaration = existingDeclaration ?? publishQuickDuelPlaytestAttackDeclared(current, "player", card, requestedZone, {
      previousAttackZone: current.player.zonesPlayed.at(-1) ?? null,
      usedConsumableThisTurn: current.player.usedConsumableThisRound,
      playedKataEarlierThisTurn: current.player.cardsThisTurn.some((id) => { const played = cardFor(id); return Boolean(played && isKata(played)); }),
      differentZoneFromPreviousAttack: Boolean(current.player.zonesPlayed.at(-1) && current.player.zonesPlayed.at(-1) !== requestedZone),
      hasWeaponEquipped: current.player.equipment.some((id) => { const equipped = cardFor(id); return Boolean(equipped && isWeapon(equipped)); }),
    });
    if (!existingDeclaration && declaration.choices.length && declaration.event) {
      return write(declaration.match, declaration.choices[0].prompt, {
        pendingChoice: { kind: "character-runtime", event: declaration.event, choice: declaration.choices[0], resume: "player-attack" },
      });
    }
    current = declaration.match;
    const incomingEquipmentResponse = applyStructuredEquipmentAttackDeclaration(current.ai, (current.ai.attacksReceivedThisRound ?? 0) === 0);
    const aiAttackResponse = resolveAiEquipmentAttackResponse(incomingEquipmentResponse.board, incomingEquipmentResponse);
    current = { ...current, ai: aiAttackResponse.board };
    const zone = declaration.zone;
    const preparedComboAttack = prepareQuickDuelPlaytestAttack(current, "player", card, zone, cardFor, quickDuelHostOperations);
    current = preparedComboAttack.match;
    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;
    const previousCardIsItem = Boolean(previousCard && previousCard.cardType === "Item");
    const conditionalCycle = structuredAttackCyclePlan(current.player, card, zone, current.nonHonorSceneChangedThisRound);
    const tempoBonus = settings.tempo && current.player.tempo && fighterStat(current.player, "Speed") > fighterStat(current.ai, "Speed") ? 1 : 0;
    const location = cardFor(current.locationId);
    const locationModifier = locationAttackModifier(location, card, current.player, zone);
    const fighterModifier = characterAttackModifierFromDeclaration(declaration);
    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card, zone);
    const incomingModifier = incomingAttackEquipmentModifier(current.ai);
    const armedEquipment = armedEquipmentAttackModifier(current.player, zone);
    const aiIncomingReaction = autoActivateAiIncomingEquipment(current.ai, zone);
    const rawArmorModifier = equipmentDefenseModifier(aiIncomingReaction.board, zone, { opponentXp: current.player.xp });
    const persistentSuppression = equipmentSuppressionForZone(current.player, aiIncomingReaction.board, zone);
    const armorPenalty = current.player.nextAttackArmorPenalty ?? 0;
    const penalizedArmorModifier = applyNextAttackArmorPenalty(rawArmorModifier, armorPenalty + persistentSuppression);
    const piercingModifier = attackPiercingModifier(current.player, aiIncomingReaction.board, card, zone, preparedComboAttack.attackFacts.piercing + armedEquipment.piercing);
    const armorModifier = piercedArmorModifier(penalizedArmorModifier, piercingModifier.value);
    const hasFlow = attackHasFlow(current.player, card, zone);
    const stage3cAttackBonus = stage3cAttackPowerBonus(current.player, card, zone);
    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);
    const declaredReactionContext = reactionItemContext(zone, current.player);
    const aiReactionCard = chooseAiReactionItem(
      aiIncomingReaction.board.hand.map(cardFor).filter((candidate): candidate is CardEntry => Boolean(candidate && isCoreReactionItemCard(candidate))),
      declaredReactionContext,
    );
    const aiDeclaredReaction = aiReactionCard
      ? resolveQuickDuelReactionItem({
          card: aiReactionCard,
          self: aiIncomingReaction.board,
          opponent: current.player,
          strike: { attackPower: baseAttackPower, zone },
          trigger: "onAttackDeclared",
          context: declaredReactionContext,
        })
      : null;
    // Reaction Item resolvers may target the attacking player (for example,
    // forcing a draw/discard before Defense). Carry that generic host result
    // into the rest of the same attack instead of only applying self-targeted
    // defensive statuses.
    if (aiDeclaredReaction) current = { ...current, player: aiDeclaredReaction.opponent };
    const aiReactionBoard = aiDeclaredReaction?.self ?? aiIncomingReaction.board;
    const declaredAttackPower = aiDeclaredReaction?.strike.attackPower ?? baseAttackPower;
    const playerAirHorn = firstEventReactionCard(current.player.hand.map(cardFor).filter((candidate): candidate is CardEntry => Boolean(candidate && isCoreConsumableCard(candidate))), "cancel-reaction") as CardEntry | null;
    const expectedIncomingDamage = Math.max(0, declaredAttackPower - fighterStat(aiReactionBoard, "DEF"));
    const aiConsumableCandidate = current.airHornAiConsumableSpentThisStrike
      ? null
      : chooseAiDefensiveConsumable(aiReactionBoard.hand.map(cardFor).filter((candidate): candidate is CardEntry => Boolean(candidate && isCoreConsumableCard(candidate))), {
          ...stage3cConsumableContext(aiReactionBoard),
          missingHp: Math.max(0, aiReactionBoard.maxHp - aiReactionBoard.hp),
          expectedIncomingDamage,
          friendlyTargetCount: 1,
          opponentTargetCount: 1,
        }) as CardEntry | null;
    if (aiConsumableCandidate && playerAirHorn && !(current.airHornPassedReactionIds ?? []).includes(aiConsumableCandidate.id)) {
      return write(current, `${aiConsumableCandidate.name} is played as the computer's Reaction. Air Horn can cancel it before resolution.`, {
        pendingChoice: { kind: "air-horn-reaction", sourceCardId: playerAirHorn.id, reactionCardId: aiConsumableCandidate.id, reactionKind: "consumable" },
      });
    }
    const aiConsumableReaction = current.airHornAiConsumableSpentThisStrike
      ? { board: aiReactionBoard, card: null as CardEntry | null, notes: ["Air Horn canceled the computer's Consumable Reaction"] }
      : autoPlayAiDefensiveConsumable(aiReactionBoard, expectedIncomingDamage);
    if (hasUntargetableStatus(aiConsumableReaction.board.stage3cStatuses)) {
      let player = applyCardEffects({ ...stage3cConsumeAttackStatuses(current.player, card, zone), hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attacksThisTurn: current.player.attacksThisTurn + 1, attackedThisRound: true, zonesPlayed: [...current.player.zonesPlayed, zone], cardsThisTurn: [...current.player.cardsThisTurn, card.id] }, card, "player");
      player = { ...player, nextAttackBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false };
      return write(current, `${aiConsumableReaction.card?.name ?? "Smoke Bomb"} invalidates the Attack target. ${card.name} is spent without dealing damage.`, { player, ai: aiConsumableReaction.board, selectedAttackId: null, airHornPassedReactionIds: [], airHornAiConsumableSpentThisStrike: false, airHornAiDefenseSpentThisStrike: false });
    }
    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);
    const defenseId = current.airHornAiDefenseSpentThisStrike
      ? null
      : bestDefense(aiConsumableReaction.board, zone, Math.max(0, declaredAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value, armorPenalty);
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    if (defenseCard && playerAirHorn && !(current.airHornPassedReactionIds ?? []).includes(defenseCard.id)) {
      return write(current, `${defenseCard.name} is played as the computer's one Defense for this strike. Air Horn can cancel it before Guard or printed effects resolve.`, {
        pendingChoice: { kind: "air-horn-reaction", sourceCardId: playerAirHorn.id, reactionCardId: defenseCard.id, reactionKind: "defense" },
      });
    }
    const postDefensePower = afterDefenseAttackPowerBonus(card, Boolean(defenseCard));
    const attackPower = Math.max(0, declaredAttackPower + postDefensePower.amount);
    const aiDefenseReaction = defenseCard ? autoActivateAiDefenseGuardEquipment(aiConsumableReaction.board) : { board: aiConsumableReaction.board, guard: 0, notes: [] as string[] };
    const defenseModifier = locationDefenseModifier(location, defenseCard, aiDefenseReaction.board, zone);
    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(aiDefenseReaction.board, current.player, defenseCard, card) : { value: 0, notes: [] as string[] };
    const defensePower = Math.max(0, fighterStat(aiDefenseReaction.board, "DEF") + armorModifier.value + stage3cIncomingAttackDefenseBonus(aiDefenseReaction.board) + (defenseCard ? cardPower(defenseCard) + (aiDefenseReaction.board.nextDefenseCardBonus ?? 0) + stage3cNextDefenseGuardBonus(aiDefenseReaction.board) + aiDefenseReaction.guard : 0) + defenseCardModifier.value + defenseModifier.value);
    const hit = attackPower > defensePower;
    const rawDamage = hit && !incomingEquipmentResponse.preventAttackDamage ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage) : 0;
    const reduced = reduceNonCharacterDamageForFighter(aiDefenseReaction.board, rawDamage);
    const characterDamage = publishQuickDuelPlaytestDamageIncoming({ ...current, ai: reduced.board }, "ai", reduced.damage);
    const characterDamageValue = characterDamage.event?.damage ?? reduced.damage;
    const optionalReduced = applyOptionalCombatDamageReductionAi(characterDamage.match.ai, characterDamageValue);
    const damage = optionalReduced.damage;
    const attackState = { ...stage3cConsumeAttackStatuses(current.player, card, zone), hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attacksThisTurn: current.player.attacksThisTurn + 1, hitThisTurn: current.player.hitThisTurn || hit, attackedThisRound: true, cardsThisTurn: [...current.player.cardsThisTurn, card.id], zonesPlayed: [...current.player.zonesPlayed, zone], nextAttackBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false, nextAttackArmorPenalty: 0, equipmentAttackPlan: null, tempo: tempoBonus ? false : current.player.tempo, wasHitSinceLastTurn: current.player.attacksThisTurn === 0 ? false : current.player.wasHitSinceLastTurn, triggeredCombos: current.player.triggeredCombos, comboTriggered: current.player.comboTriggered, damageDealt: current.player.damageDealt + damage, lastAttackHit: hit, currentAttackIsReversal: false, attackLockedThisTurn: current.player.attackLockedThisTurn || finalAttackOnlyAttackLock(card, current.player.attacksThisTurn === 0) };
    const completesActiveBeltExam = !beltTaskMet(current.player) && beltTaskMet(attackState);
    let nextPlayer = applyCardEffects({ ...attackState, completesActiveBeltExamThisAttack: completesActiveBeltExam }, card, "player");
    const flowDraw = hasFlow && !current.player.flowUsedThisTurn;
    if (flowDraw) nextPlayer = drawCards({ ...nextPlayer, flowUsedThisTurn: true }, 1);
    if (current.player.flowAfterFirstAttack && current.player.attacksThisTurn === 0) nextPlayer = { ...nextPlayer, flowAfterFirstAttack: false, nextAttackHasFlow: true };
    if (!hit && armedEquipment.blockedFocus) nextPlayer = gainFocus(nextPlayer, armedEquipment.blockedFocus);
    let nextAi: Board = { ...optionalReduced.board, hp: Math.max(0, optionalReduced.board.hp - damage), attacksReceivedThisRound: (optionalReduced.board.attacksReceivedThisRound ?? 0) + 1, combatDamageEventsThisRound: (optionalReduced.board.combatDamageEventsThisRound ?? 0) + (reduced.damage > 0 ? 1 : 0), wasHitSinceLastTurn: optionalReduced.board.wasHitSinceLastTurn || hit, damageTaken: optionalReduced.board.damageTaken + damage };
    const thresholdProtection = applyStructuredEquipmentThresholdProtection(nextAi, damage);
    nextAi = thresholdProtection.board;
    nextAi = resolveReactionItemIncomingAttackOutcome(nextAi, hit);
    nextAi = stage3cConsumeIncomingAttackStatuses(nextAi);
    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card, { previousCardIsItem }) : { board: nextAi, notes: [] as string[] };
    nextAi = targetDebuff.board;
    const equipmentHit = hit
      ? applyStructuredEquipmentHit(nextPlayer, nextAi, card, zone, damage)
      : { attacker: nextPlayer, target: nextAi, notes: [] as string[] };
    nextPlayer = equipmentHit.attacker;
    nextAi = equipmentHit.target;
    const targetDiscardCount = hit ? targetDiscardOnHitCount(card) : 0;
    const targetDiscardNotes: string[] = [];
    if (targetDiscardCount && nextAi.hand.length) {
      const discardCount = Math.min(targetDiscardCount, nextAi.hand.length);
      const ranked = [...nextAi.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)));
      const discarded = ranked.slice(0, discardCount);
      let aiHand = nextAi.hand;
      for (const id of discarded) aiHand = removeOne(aiHand, id);
      nextAi = { ...nextAi, hand: aiHand, discard: [...nextAi.discard, ...discarded] };
      targetDiscardNotes.push(`target discards ${discardCount}: ${discarded.map((id) => cardFor(id)?.name ?? "Unknown").join(", ")}`);
    }
    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, blockedSinceLastTurn: !hit || Boolean(nextAi.blockedSinceLastTurn), blockedThisRound: !hit || Boolean(nextAi.blockedThisRound), nextDefenseCardBonus: 0 };
    if (!hit) nextAi = { ...nextAi, blockedSinceLastTurn: true, blockedThisRound: true };
    nextPlayer = applyCardEffects(nextPlayer, card, "player", hit ? "onHit" : "afterResolve", { defenderPlayedDefense: Boolean(defenseCard) });
    if (hit) nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve", { defenderPlayedDefense: Boolean(defenseCard) });
    const structuredPendingChoice = nextPlayer.structuredPendingChoice;
    if (structuredPendingChoice) nextPlayer = { ...nextPlayer, structuredPendingChoice: undefined };
    const consumableAttackFollowup = resolveConsumableAttackFollowupStatuses(nextPlayer.stage3cStatuses ?? [], { blocked: !hit, interferencePrevented: false });
    nextPlayer = {
      ...nextPlayer,
      stage3cStatuses: consumableAttackFollowup.statuses,
      hp: Math.max(0, nextPlayer.hp - consumableAttackFollowup.directSelfDamage),
      damageTaken: nextPlayer.damageTaken + consumableAttackFollowup.directSelfDamage,
    };
    if (consumableAttackFollowup.focus) nextPlayer = gainFocus(nextPlayer, consumableAttackFollowup.focus);
    const armorPenaltyGrant = hit ? nextAttackArmorPenalty(card) : 0;
    if (armorPenaltyGrant) nextPlayer = { ...nextPlayer, nextAttackArmorPenalty: (nextPlayer.nextAttackArmorPenalty ?? 0) + armorPenaltyGrant };
    if (conditionalCycle.draw) nextPlayer = drawCards(nextPlayer, conditionalCycle.draw);
    const cycleDiscardCount = nextAi.hp ? Math.min(conditionalCycle.discard, nextPlayer.hand.length) : 0;
    let defenseFollowupNotes: string[] = [];
    let equipmentBlockNotes: string[] = [];
    if (defenseCard) {
      const familyDefenseContext = stage3cDefenseContext(nextAi, current.player, defenseCard, card, zone, attackPower, rawDamage, !hit);
      nextAi = stage3cConsumeDefenseStatuses(nextAi);
      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onPlay", familyDefenseContext);
      const followup = applyAfterDefenseEquipment(nextAi);
      nextAi = followup.board;
      defenseFollowupNotes = followup.notes;
      if (!hit) {
        nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onBlock", familyDefenseContext);
        nextPlayer = applyStage3CTiming(nextPlayer, defenseCard, "onBlock", "player", familyDefenseContext, "opponent");
      }
      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve", familyDefenseContext);
      nextPlayer = applyStage3CTiming(nextPlayer, defenseCard, "afterResolve", "player", familyDefenseContext, "opponent");
    }
    if (!hit) {
      const equipmentBlock = applyStructuredEquipmentBlock(nextAi, nextPlayer, card, defenseCard, zone, equipmentDefenseModifier(nextAi, zone, { opponentXp: nextPlayer.xp }).value > 0, !current.ai.blockedThisRound);
      nextAi = equipmentBlock.board;
      nextPlayer = equipmentBlock.opponent;
      equipmentBlockNotes = equipmentBlock.notes;
    }
    const aiPostBlock = !hit && defenseCard ? autoTriggerAiPostBlockEquipment(nextAi, zone, defenseCard) : { board: nextAi, notes: [] as string[] };
    nextAi = aiPostBlock.board;
    if (damage >= 3 && beltHasReward(nextPlayer, "impact-focus")) nextPlayer = gainFocus(nextPlayer, 1);
    if (!nextAi.hp) nextPlayer.xp += 2;
    nextPlayer = markCompletedTask(nextPlayer);
    const result = hit
      ? `${card.name} hits ${aiFighter?.name ?? "the opponent"} for ${damage}.${defenseCard ? ` ${defenseCard.name} is discarded after this strike.` : ""}`
      : defenseCard
        ? `${card.name} is blocked by ${defenseCard.name}; that Defense is now discarded.`
        : `${card.name} is blocked by ${aiFighter?.name ?? "the opponent"}'s standing DEF/Equipment; no Defense card was played.`;
    const readyOnHit = hit ? readyEquipmentOnHit(card) : 0;
    const optionalCycle = !nextAi.hp ? null : optionalDiscardDrawChoice(card);
    const suppression = hit ? finalAttackEquipmentSuppression(card) : 0;
    const suppressionTargets = suppression ? suppressionCandidates(nextAi, zone, nextPlayer) : [];
    const hitChoice = hit ? finalAttackHitChoice(card) : null;
    const pendingChoice: PendingChoice | null = structuredPendingChoice
      ? { kind: "discard-draw", sourceCardId: structuredPendingChoice.sourceCardId, remaining: structuredPendingChoice.discard, draw: structuredPendingChoice.draw }
      : suppressionTargets.length
      ? { kind: "attack-equipment-target", sourceCardId: card.id, candidates: suppressionTargets, amount: suppression }
      : hitChoice
        ? { kind: "attack-option", sourceCardId: card.id, effect: hitChoice.kind }
      : readyOnHit && (nextPlayer.exhaustedEquipment ?? []).length
      ? { kind: "ready-equipment", sourceCardId: card.id, optional: true }
      : cycleDiscardCount ? { kind: "discard-hand", sourceCardId: card.id, remaining: cycleDiscardCount, sourceFollowup: false }
      : optionalCycle && nextPlayer.hand.length ? { kind: "discard-draw", sourceCardId: card.id, remaining: optionalCycle.discard, draw: optionalCycle.draw } : null;
    let hostedComboMatch: Match = { ...current, player: nextPlayer, ai: nextAi };
    if (hit) hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "onHit", quickDuelHostOperations, { currentAttackHit: true }).match;
    hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "afterResolve", quickDuelHostOperations, { currentAttackHit: hit, currentDefense: defenseCard, currentDefenseBlocked: Boolean(defenseCard && !hit) }).match;
    nextPlayer = hostedComboMatch.player;
    nextAi = hostedComboMatch.ai;
    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...incomingModifier.notes, ...armedEquipment.notes, ...incomingEquipmentResponse.notes, ...aiAttackResponse.notes, ...thresholdProtection.notes, ...aiIncomingReaction.notes, ...(aiReactionCard && aiDeclaredReaction ? [`${aiReactionCard.name}: ${aiDeclaredReaction.notes.join(", ")}`] : []), ...aiConsumableReaction.notes, ...aiDefenseReaction.notes, ...piercingModifier.notes, ...armorModifier.notes, ...postDefensePower.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...equipmentHit.notes, ...targetDiscardNotes, ...defenseFollowupNotes, ...equipmentBlockNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...consumableAttackFollowup.notes, ...characterDamage.notes, ...(reduced.note ? [reduced.note] : [])];
    const lastExchange: PlaytestCombatExchange = { id: exchangeId(current, "player", card.id), actor: "player", target: "ai", attackCardId: card.id, defenseCardId: defenseCard?.id ?? null, zone, attackPower, defensePower, damage, outcome: hit ? "hit" : "block", notes: modifiers };
    return write(current, `${tempoBonus ? "Tempo +1. " : ""}${result} Attack ${attackPower} vs Defense ${defensePower}.${flowDraw ? " Flow draws 1 card." : ""}${conditionalCycle.draw ? ` Printed effect draws ${conditionalCycle.draw}.` : ""}${cycleDiscardCount ? ` Choose ${cycleDiscardCount} discard${cycleDiscardCount === 1 ? "" : "s"}.` : ""}${pendingChoice && !cycleDiscardCount ? " Optional discard/draw decision is waiting." : ""}${modifiers.length ? ` ${modifiers.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, selectedAttackId: null, pendingChoice, airHornPassedReactionIds: [], airHornAiConsumableSpentThisStrike: false, airHornAiDefenseSpentThisStrike: false, exchangeSequence: (current.exchangeSequence ?? 0) + 1, lastExchange, winner: !nextPlayer.hp ? "ai" : nextAi.hp ? null : "player" });
  };

  const declareAttack = () => setMatch((current) => current ? resolvePlayerAttackState(current) : current);

  const resolvePlayerAirHornChoice = (useAirHorn: boolean) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "air-horn-reaction") return current;
    const reaction = cardFor(choice.reactionCardId);
    const airHorn = cardFor(choice.sourceCardId);
    if (!reaction || !airHorn || !current.player.hand.includes(airHorn.id)) {
      const passed = write(current, "Air Horn is no longer available; the announced Reaction resolves.", {
        pendingChoice: null,
        airHornPassedReactionIds: [...new Set([...(current.airHornPassedReactionIds ?? []), choice.reactionCardId])],
      });
      return resolvePlayerAttackState(passed);
    }
    if (!useAirHorn) {
      const passed = write(current, `Air Horn held. ${reaction.name} remains on the Dojo Stack and resolves normally.`, {
        pendingChoice: null,
        airHornPassedReactionIds: [...new Set([...(current.airHornPassedReactionIds ?? []), reaction.id])],
      });
      return resolvePlayerAttackState(passed);
    }

    let player: Board = {
      ...current.player,
      hand: removeOne(current.player.hand, airHorn.id),
      playArea: [...current.player.playArea, airHorn.id],
      usedConsumableThisRound: true,
      reactionItemUsedSinceLastTurn: true,
    };
    player = returnResolvedConsumable(player, airHorn);
    let ai = current.ai;
    let airHornAiConsumableSpentThisStrike = Boolean(current.airHornAiConsumableSpentThisStrike);
    let airHornAiDefenseSpentThisStrike = Boolean(current.airHornAiDefenseSpentThisStrike);

    if (choice.reactionKind === "consumable") {
      if (ai.hand.includes(reaction.id)) {
        let cancelledAi: Board = {
          ...ai,
          hand: removeOne(ai.hand, reaction.id),
          playArea: [...ai.playArea, reaction.id],
          usedConsumableThisRound: true,
          reactionItemUsedSinceLastTurn: true,
        };
        cancelledAi = returnResolvedConsumable(cancelledAi, reaction);
        ai = cancelledAi;
      }
      airHornAiConsumableSpentThisStrike = true;
    } else {
      if (ai.hand.includes(reaction.id)) {
        ai = {
          ...ai,
          hand: removeOne(ai.hand, reaction.id),
          discard: [...ai.discard, reaction.id],
        };
      }
      airHornAiDefenseSpentThisStrike = true;
    }

    const intercepted = write(current, `Air Horn cancels ${reaction.name} before it resolves. ${choice.reactionKind === "defense" ? "That was the computer's one Defense card for this strike." : "The canceled Consumable returns to supply without applying its effect."}`, {
      player,
      ai,
      pendingChoice: null,
      airHornAiConsumableSpentThisStrike,
      airHornAiDefenseSpentThisStrike,
    });
    return resolvePlayerAttackState(intercepted);
  });

  const playSupport = (id: string) => setMatch((current) => {
    if (!current || current.winner || current.pendingDiscard || current.pendingChoice) return current;
    const card = cardFor(id);
    if (!card || isAttack(card) || isDefense(card) || isPermanent(card)) return current;
    const legalSupportPhase = current.phase === "player-yell"
      ? (!kataHasAscendOnlyEconomyEffect(card, current.player) && (!isCoreConsumableCard(card) || canPlayCoreConsumableInPhase(card, "player-yell", stage3cConsumableContext(current.player))))
      : current.phase === "player-ascend"
        ? (isCoreConsumableCard(card) && canPlayCoreConsumableInPhase(card, "player-ascend", stage3cConsumableContext(current.player))) || kataHasAscendEconomyEffect(card, current.player)
        : current.phase === "defense-window" && (
          isCoreConsumableCard(card) && canPlayCoreConsumableInPhase(card, "defense-window", stage3cConsumableContext(current.player))
          || isCoreReactionItemCard(card) && Boolean(current.pendingStrike) && (
            canPlayCoreReactionItem(card, "onAttackDeclared", reactionItemContext(current.pendingStrike!.zone, current.ai, true))
            || canPlayCoreReactionItem(card, "onPlay", { ...reactionItemContext(current.pendingStrike!.zone, current.ai, true), defenseOutsideTurn: Boolean(current.player.offTurnConsumablePlayed) })
          )
        )
        || current.phase === "reversal-window" && isCoreReactionItemCard(card)
          && canPlayCoreReactionItem(card, "onBlock", { sameOpponentAsBlockedAttack: true });
    if (!legalSupportPhase) return current;
    if (isCoreConsumableCard(card) && (current.player.stage3cRestrictions ?? []).includes("consumable")) return current;
    if (isCoreReactionItemCard(card) && current.phase === "reversal-window") {
      const reaction = resolveQuickDuelReactionItemEvent({
        card,
        self: current.player,
        opponent: current.ai,
        trigger: "onBlock",
        context: { sameOpponentAsBlockedAttack: true },
      });
      if (!reaction.applied) return current;
      return write(current, `${card.name} is destroyed after the Block: ${reaction.notes.join("; ") || "follow-up armed"}.`, {
        player: reaction.self,
        ai: reaction.opponent,
      });
    }
    if (isCoreReactionItemCard(card) && current.pendingStrike) {
      const offTurnReaction = resolveQuickDuelReactionItemEvent({
        card,
        self: current.player,
        opponent: current.ai,
        trigger: "onPlay",
        context: { ...reactionItemContext(current.pendingStrike.zone, current.ai, true), defenseOutsideTurn: Boolean(current.player.offTurnConsumablePlayed) },
      });
      if (offTurnReaction.applied) {
        return write(current, `${card.name} is destroyed as an off-turn Reaction: ${offTurnReaction.notes.join("; ") || "effect resolved"}.`, {
          player: offTurnReaction.self,
          ai: offTurnReaction.opponent,
        });
      }
      const reaction = resolveQuickDuelReactionItem({
        card,
        self: current.player,
        opponent: current.ai,
        strike: { attackPower: current.pendingStrike.attackPower, zone: current.pendingStrike.zone },
        trigger: "onAttackDeclared",
        context: reactionItemContext(current.pendingStrike.zone, current.ai, true),
      });
      if (!reaction.applied) return current;
      return write(current, `${card.name} is destroyed as a Reaction: ${reaction.notes.join("; ")}.`, {
        player: reaction.self,
        ai: reaction.opponent,
        pendingStrike: { ...current.pendingStrike, attackPower: reaction.strike.attackPower },
      });
    }
    const aiAirHorn = current.phase === "defense-window" && String(card.timing ?? "").trim().toLocaleLowerCase() === "reaction"
      ? firstEventReactionCard(current.ai.hand.map(cardFor).filter((candidate): candidate is CardEntry => Boolean(candidate && isCoreConsumableCard(candidate))), "cancel-reaction") as CardEntry | null
      : null;
    if (aiAirHorn) {
      let cancelledPlayer: Board = {
        ...current.player,
        hand: removeOne(current.player.hand, card.id),
        playArea: [...current.player.playArea, card.id],
        usedConsumableThisRound: true,
        reactionItemUsedSinceLastTurn: true,
        lastAttackHit: false,
      };
      cancelledPlayer = returnResolvedConsumable(cancelledPlayer, card);
      let reactingAi: Board = {
        ...current.ai,
        hand: removeOne(current.ai.hand, aiAirHorn.id),
        playArea: [...current.ai.playArea, aiAirHorn.id],
        usedConsumableThisRound: true,
        reactionItemUsedSinceLastTurn: true,
      };
      reactingAi = returnResolvedConsumable(reactingAi, aiAirHorn);
      return write(current, `${aiAirHorn.name} cancels ${card.name} before it resolves. Both one-use Consumables complete their normal supply lifecycle.`, { player: cancelledPlayer, ai: reactingAi });
    }
    const locationModifier = locationFocusModifier(cardFor(current.locationId), card, current.player);
    let supportBoard = isKata(card) ? stage3cConsumeKata(current.player) : current.player;
    const ownTurnPlay = current.phase === "player-yell";
    const ascendPlay = current.phase === "player-ascend";
    const supportEntryBoard = { ...supportBoard, hand: removeOne(supportBoard.hand, id), playArea: [...supportBoard.playArea, id], cardsThisTurn: ownTurnPlay ? [...supportBoard.cardsThisTurn, id] : supportBoard.cardsThisTurn, focus: supportBoard.focus + (ownTurnPlay ? locationModifier.value : 0), lastAttackHit: false };
    let nextPlayer = markCompletedTask(applyCardEffects(supportEntryBoard, card, "player", "onPlay", isCoreConsumableCard(card) ? stage3cConsumableContext(supportEntryBoard) : {}, ownTurnPlay || ascendPlay));
    if (isCoreConsumableCard(card)) {
      nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve", stage3cConsumableContext(nextPlayer));
      nextPlayer = { ...nextPlayer, stage3cStatuses: armConsumableHideStatuses(armConsumableAttackFollowupStatuses(nextPlayer.stage3cStatuses ?? [], card), card) };
      if (current.phase === "defense-window") nextPlayer = { ...nextPlayer, offTurnConsumablePlayed: true };
    } else if (isKata(card)) {
      nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve");
    }
    const playerFastestFocus = structuredFocusIfFastest(card, fighterStat(nextPlayer, "Speed"), fighterStat(current.ai, "Speed"));
    if (playerFastestFocus) nextPlayer = { ...nextPlayer, focus: nextPlayer.focus + playerFastestFocus };
    const destroyedAfterUse = destroysAfterUse(card);
    const returnedAfterUse = returnsToSupplyAfterUse(card);
    if (destroyedAfterUse) nextPlayer = destroyResolvedConsumable(nextPlayer, card);
    else if (returnedAfterUse) nextPlayer = returnResolvedConsumable(nextPlayer, card);
    const pendingDiscard = null;
    const junkPlan = destroyJunkChoicePlan(card);
    const junkCount = junkPlan?.count ?? destroyJunkChoiceCount(card);
    const mandatoryDiscard = isCoreConsumableCard(card)
      ? structuredConsumableMandatoryDiscard(card, stage3cConsumableContext(supportEntryBoard))
      : mandatoryDiscardChoiceCount(card);
    const junkSources = junkPlan?.sources ?? ["hand", "discard"];
    const hasJunk = (junkSources.includes("hand") ? nextPlayer.hand : []).concat(junkSources.includes("discard") ? nextPlayer.discard : []).some((candidate) => isJunk(cardFor(candidate)));
    let pendingChoice: PendingChoice | null = junkCount && hasJunk
      ? { kind: "destroy-junk", sourceCardId: id, remaining: junkCount, sources: junkSources, optional: Boolean(junkPlan?.optional), drawAfterSuccess: junkPlan?.drawAfterSuccess ?? 0 }
      : mandatoryDiscard && nextPlayer.hand.length
        ? { kind: "discard-hand", sourceCardId: id, remaining: Math.min(mandatoryDiscard, nextPlayer.hand.length) }
        : null;
    let deckNote = "";
    const topRevealPlan = isCoreConsumableCard(card) ? structuredConsumableTopRevealPlan(card) : null;
    if (topRevealPlan) {
      const revealedId = nextPlayer.deck.at(-1);
      const revealed = revealedId ? cardFor(revealedId) : null;
      deckNote = revealed ? `Revealed ${revealed.name} (Focus Value ${cardFocus(revealed)}).` : "No card was available to reveal.";
    }
    if (!pendingChoice && deckLookPlan(card)) {
      const deckChoice = beginPlayerDeckLook(nextPlayer, card);
      nextPlayer = deckChoice.board;
      pendingChoice = deckChoice.pendingChoice;
      deckNote = deckChoice.note;
    }
    const kataEquipPlan = isKata(card) ? kataEquipFromHandPlanForHost(card) : null;
    if (!pendingChoice && kataEquipPlan) {
      const equipmentIds = nextPlayer.hand.filter((candidate) => {
        const equipment = cardFor(candidate);
        return kataEquipCandidate(equipment, kataEquipPlan) && equipmentHandLimit(nextPlayer.equipment, equipment, cardFor).allowed;
      });
      if (equipmentIds.length) pendingChoice = { kind: "kata-equip-from-hand", sourceCardId: id, equipmentIds, family: kataEquipPlan.family, subtype: kataEquipPlan.subtype, ready: kataEquipPlan.ready, nextAttackPower: kataEquipPlan.nextAttackPower, additionalFocus: kataEquipPlan.additionalFocus };
    }
    let nextAi = current.ai;
    let nextMarket = current.market;
    let nextMarketDeck = current.marketDeck;
    let nextMarketDiscard = current.marketDiscard;
    if (isCoreConsumableCard(card)) {
      nextAi = applyStage3CTiming(nextAi, card, "onPlay", "ai", stage3cConsumableContext(nextPlayer), "opponent");
      nextAi = applyStage3CTiming(nextAi, card, "afterResolve", "ai", stage3cConsumableContext(nextPlayer), "opponent");
    } else {
      const defensePenalty = targetNextDefensePenalty(card);
      if (defensePenalty) nextAi = queueOpponentCardModification({ ...nextAi, nextDefenseCardBonus: (nextAi.nextDefenseCardBonus ?? 0) - defensePenalty }, "Defense");
    }
    if (isCoreConsumableCard(card)) {
      if (hasStructuredResolver(card, "consumable.chooseOpponentDiscardReactionIfAble")) {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.chooseOpponentDiscardReactionIfAble"]);
        const reactions = nextAi.hand.map(cardFor).filter((candidate): candidate is CardEntry => Boolean(candidate && String(candidate.timing ?? "").toLocaleLowerCase() === "reaction"));
        if (reactions.length) {
          const chosen = [...reactions].sort((left, right) => cardFocus(left) - cardFocus(right) || cardCost(left) - cardCost(right))[0];
          nextAi = { ...nextAi, hand: removeOne(nextAi.hand, chosen.id), discard: [...nextAi.discard, chosen.id] };
        }
      }
      if (hasStructuredResolver(card, "consumable.optionalExhaustToCycle")) {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.optionalExhaustToCycle"]);
        const equipmentIds = stage3cReadyEquipmentIds(nextPlayer);
        if (!pendingChoice && equipmentIds.length) pendingChoice = { kind: "stage3c-trail-mix", sourceCardId: id, equipmentIds };
      }
      if (hasStructuredResolver(card, "consumable.raffleTicket") && current.phase === "player-ascend") {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.raffleTicket"]);
        const reveal = revealMarketCards(nextMarketDeck, nextMarketDiscard, 1);
        nextMarketDeck = reveal.marketDeck;
        nextMarketDiscard = reveal.marketDiscard;
        if (reveal.revealed[0]) pendingChoice = { kind: "stage3c-raffle", sourceCardId: id, revealedCardId: reveal.revealed[0] };
      }
      if (hasStructuredResolver(card, "consumable.zoneSpecificIncomingAttackPenalty")) {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.zoneSpecificIncomingAttackPenalty"]);
        pendingChoice = { kind: "stage3c-zone-ward", sourceCardId: id, amount: -2 };
      }
      if (hasStructuredResolver(card, "consumable.reorderTopThree")) {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.reorderTopThree"]);
        const reveal = revealDeckTop(nextPlayer, 3);
        const types = new Set(reveal.revealed.map((candidate) => cardFor(candidate)?.cardType ?? "Unknown"));
        nextPlayer = reveal.board;
        if (reveal.revealed.length) pendingChoice = { kind: "deck-order", sourceCardId: id, revealed: reveal.revealed, ordered: [], bonusFocus: reveal.revealed.length === 3 && types.size === 3 ? 1 : 0 };
      }
      if (hasStructuredResolver(card, "consumable.removeTemporaryNegativeStatModifier")) {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.removeTemporaryNegativeStatModifier"]);
        const stats = stage3cNegativeStatOptions(nextPlayer);
        if (stats.length) pendingChoice = { kind: "stage3c-remove-negative", sourceCardId: id, bonusAttack: hasStructuredResolver(card, "consumable.pepTalkConditionalAttackBonus") ? 1 : 0, stats };
      }
      if (nextPlayer.stage3cChoices?.some((choice) => choice.resolver === "consumable.healAndRemoveStatus")) {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.healAndRemoveStatus"]);
        const statusIds = removableTemporaryStatuses(nextPlayer.stage3cStatuses).map((status) => status.sourceEffectId);
        if (!pendingChoice && statusIds.length) pendingChoice = { kind: "stage3c-remove-status", sourceCardId: id, statusIds };
      }
      if (hasStructuredResolver(card, "consumable.discardUpToForFocus")) {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.discardUpToForFocus"]);
        if (nextPlayer.hand.length) pendingChoice = { kind: "stage3c-discard-focus", sourceCardId: id, remaining: Math.min(2, nextPlayer.hand.length), focusPerDiscard: 2, optional: true };
      }
      if (hasStructuredResolver(card, "consumable.suppressChosenWeaponClause")) {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.suppressChosenWeaponClause"]);
        const equipmentIds = nextPlayer.equipment.filter((equipmentId) => { const item = cardFor(equipmentId); return Boolean(item && isWeapon(item)); });
        if (equipmentIds.length) pendingChoice = { kind: "stage3c-weapon-suppress", sourceCardId: id, equipmentIds };
      }
      if (hasStructuredResolver(card, "consumable.exhaustEquipmentForFocus")) {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.exhaustEquipmentForFocus"]);
        const equipmentIds = stage3cReadyEquipmentIds(nextPlayer);
        if (equipmentIds.length) pendingChoice = { kind: "stage3c-exhaust-focus", sourceCardId: id, equipmentIds, focus: 3 };
      }
      if (hasStructuredResolver(card, "consumable.untargetableUntilTurnOrAttack") && current.phase === "defense-window" && current.pendingStrike) {
        const escaped = write(current, `Smoke Bomb invalidates ${cardFor(current.pendingStrike.cardId)?.name ?? "the incoming Attack"}'s only legal target. The strike is spent without dealing damage.`, { player: nextPlayer, ai: nextAi, pendingStrike: null, pendingChoice: null, pendingCombatContinuation: null });
        return finishAiTurn(escaped, "Computer cannot legally target you through the Smoke Bomb and ends its Yell.", settings.locations, settings.houseRuleIds);
      }
      if (hasStructuredResolver(card, "consumable.topThreeAttackSelection")) {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.topThreeAttackSelection"]);
        const sparring = beginStage3CSparringDummy(nextPlayer, id);
        nextPlayer = sparring.board;
        pendingChoice = sparring.pendingChoice;
      }
    }

    const junkSourceLabel = junkSources.length === 2 ? "hand or discard pile" : junkSources[0] === "discard" ? "discard pile" : "hand";
    const choiceNote = pendingChoice?.kind === "destroy-junk" ? `Choose ${junkCount} Junk card${junkCount === 1 ? "" : "s"} from your ${junkSourceLabel} to destroy.` : pendingChoice?.kind === "discard-hand" ? `Choose ${pendingChoice.remaining} card${pendingChoice.remaining === 1 ? "" : "s"} from your hand to discard.` : deckNote || cardEffectNote(card);
    return write(current, `${card.name} played. ${choiceNote}${destroyedAfterUse ? " Destroyed after use; it will not enter your discard pile." : ""}${ownTurnPlay && locationModifier.notes.length ? ` ${locationModifier.notes.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, market: nextMarket, marketDeck: nextMarketDeck, marketDiscard: nextMarketDiscard, pendingDiscard, pendingChoice });
  });

  const choosePendingDiscard = (id: string) => setMatch((current) => {
    if (!current?.pendingDiscard || !current.player.hand.includes(id)) return current;
    const discarded = cardFor(id);
    const source = cardFor(current.pendingDiscard.sourceCardId);
    const remaining = current.pendingDiscard.remaining - 1;
    const player = {
      ...current.player,
      hand: removeOne(current.player.hand, id),
      discard: [...current.player.discard, id],
    };
    return write(current, `${discarded?.name ?? "The selected card"} discarded for ${source?.name ?? "the pending effect"}.`, { player, pendingDiscard: remaining > 0 && player.hand.length ? { ...current.pendingDiscard, remaining } : null });
  });

  const resolvePendingChoice = (cardId: string, source: "hand" | "discard" | "deck" | "equipment" = "hand") => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice) return current;
    const selected = cardFor(cardId);
    if (!selected) return current;

    if (choice.kind === "equipment-attack-response") {
      if (source !== "hand" || !current.player.hand.includes(cardId)) return current;
      const player = { ...current.player, hand: removeOne(current.player.hand, cardId), discard: [...current.player.discard, cardId] };
      return write(current, `${selected.name} discarded for the incoming Attack response. Defense may proceed.`, { player, pendingChoice: null });
    }

    if (choice.kind === "equipment-purchase-card") {
      if (source !== "hand" || !choice.handIds.includes(cardId) || !current.player.hand.includes(cardId)) return current;
      const player = { ...current.player, hand: removeOne(current.player.hand, cardId), deck: [...current.player.deck, cardId], nextInitiateDraw: (current.player.nextInitiateDraw ?? 0) + choice.nextInitiateDraw };
      return write(current, `${selected.name} filed at the bottom of your deck. Draw ${choice.nextInitiateDraw} at your next Initiate.`, { player, pendingChoice: null });
    }

    if (choice.kind === "kata-equip-from-hand") {
      if (source !== "hand" || !choice.equipmentIds.includes(cardId) || !current.player.hand.includes(cardId) || !kataEquipCandidate(selected, choice)) return current;
      const handLimitMessage = weaponHandLimitMessage(current.player, selected);
      if (handLimitMessage) return write(current, handLimitMessage, { pendingChoice: null });
      const characterEquip = publishQuickDuelPlaytestEquip(current, "player", selected);
      if (!characterEquip.allowed) return write(current, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} cannot equip ${selected.name}.`);
      let player = applyCardEffects({ ...characterEquip.match.player, hand: removeOne(characterEquip.match.player.hand, cardId), playArea: [...characterEquip.match.player.playArea, cardId] }, selected, "player");
      if (choice.ready) player = { ...player, exhaustedEquipment: (player.exhaustedEquipment ?? []).filter((id) => id !== cardId) };
      if (choice.nextAttackPower) player = { ...player, nextAttackBonus: player.nextAttackBonus + choice.nextAttackPower };
      if (choice.additionalFocus) player = gainFocus(player, choice.additionalFocus);
      return write(characterEquip.match, `${selected.name} equipped from hand through the structured Kata choice.${choice.nextAttackPower ? ` Next Attack +${choice.nextAttackPower}.` : ""}${choice.additionalFocus ? ` +${choice.additionalFocus} generated Focus.` : ""}`, { player, pendingChoice: null });
    }

    if (choice.kind === "stage3c-trail-mix") {
      if (source !== "equipment" || !choice.equipmentIds.includes(cardId) || !current.player.equipment.includes(cardId) || isEquipmentExhausted(current.player, cardId)) return current;
      let player = exhaustEquipment(current.player, cardId);
      player = drawCards(player, 1);
      const pendingChoice = player.hand.length ? { kind: "discard-hand", sourceCardId: choice.sourceCardId, remaining: 1, sourceFollowup: false } as PendingChoice : null;
      return write(current, `${selected.name} exhausted for ${cardFor(choice.sourceCardId)?.name ?? "Department-Issue Trail Mix"}; draw 1${pendingChoice ? " and choose 1 discard" : ""}.`, { player, pendingChoice });
    }

    if (choice.kind === "stage3c-discard-focus") {
      if (!current.player.hand.includes(cardId)) return current;
      const player = gainFocus({ ...current.player, hand: removeOne(current.player.hand, cardId), discard: [...current.player.discard, cardId] }, choice.focusPerDiscard);
      const remaining = choice.remaining - 1;
      const pendingChoice = remaining > 0 && player.hand.length ? { ...choice, remaining } : null;
      return write(current, `${selected.name} discarded for +${choice.focusPerDiscard} Focus.${pendingChoice ? " Up to " + remaining + " more may be discarded." : " Choice complete."}`, { player, pendingChoice });
    }

    if (choice.kind === "stage3c-weapon-suppress") {
      if (source !== "equipment" || !choice.equipmentIds.includes(cardId) || !current.player.equipment.includes(cardId)) return current;
      const player = { ...current.player, suppressedEquipmentPenaltyIds: [...new Set([...(current.player.suppressedEquipmentPenaltyIds ?? []), cardId])] };
      return write(current, `Muscle Ointment suppresses ${selected.name}'s drawback/self-penalty until Hide.`, { player, pendingChoice: null });
    }

    if (choice.kind === "stage3c-exhaust-focus") {
      if (source !== "equipment" || !choice.equipmentIds.includes(cardId) || !current.player.equipment.includes(cardId) || isEquipmentExhausted(current.player, cardId)) return current;
      const player = gainFocus(exhaustEquipment(current.player, cardId), choice.focus);
      return write(current, `${selected.name} exhausted; Receipt-Printer Ribbon grants +${choice.focus} Focus.`, { player, pendingChoice: null });
    }

    if (choice.kind === "stage3c-reaction-discard") {
      if (!choice.reactionIds.includes(cardId) || !current.player.hand.includes(cardId) || String(selected.timing ?? "").toLocaleLowerCase() !== "reaction") return current;
      const player = { ...current.player, hand: removeOne(current.player.hand, cardId), discard: [...current.player.discard, cardId] };
      return write(current, `${selected.name} discarded to satisfy Confetti Cannon.`, { player, pendingChoice: null });
    }

    if (choice.kind === "stage3c-sparring-pick") {
      if (source !== "deck" || !choice.revealed.includes(cardId) || !isAttack(selected)) return current;
      const rest = removeOne(choice.revealed, cardId);
      const junkIds = rest.filter((candidate) => isJunk(cardFor(candidate)));
      const player = { ...current.player, hand: [...current.player.hand, cardId], discard: [...current.player.discard, ...rest] };
      const pendingChoice = junkIds.length ? { kind: "stage3c-sparring-junk", sourceCardId: choice.sourceCardId, junkIds, optional: true } as PendingChoice : null;
      return write(current, `${selected.name} taken from Sparring Dummy's reveal; the rest are discarded.${pendingChoice ? " You may destroy one Junk discarded this way." : ""}`, { player, pendingChoice });
    }

    if (choice.kind === "stage3c-sparring-junk") {
      if (source !== "discard" || !choice.junkIds.includes(cardId) || !current.player.discard.includes(cardId) || !isJunk(selected)) return current;
      const player = { ...current.player, discard: removeOne(current.player.discard, cardId), destroyed: [...(current.player.destroyed ?? []), cardId] };
      return write(current, `${selected.name} destroyed from Sparring Dummy's discarded reveal.`, { player, pendingChoice: null });
    }

    if (choice.kind === "destroy-junk") {
      const allowedSources = choice.sources ?? ["hand", "discard"];
      if (!allowedSources.includes(source as "hand" | "discard")) return current;
      const sourceCards = source === "discard" ? current.player.discard : current.player.hand;
      if (!sourceCards.includes(cardId) || !isJunk(selected)) return current;
      let player: Board = source === "hand"
        ? { ...current.player, hand: removeOne(current.player.hand, cardId), destroyed: [...(current.player.destroyed ?? []), cardId] }
        : { ...current.player, discard: removeOne(current.player.discard, cardId), destroyed: [...(current.player.destroyed ?? []), cardId] };
      const remaining = choice.remaining - 1;
      const availableJunk = (allowedSources.includes("hand") ? player.hand : []).concat(allowedSources.includes("discard") ? player.discard : []);
      const junkRemains = availableJunk.some((id) => isJunk(cardFor(id)));
      const pendingChoice = remaining > 0 && junkRemains ? { ...choice, remaining } : null;
      if (!pendingChoice && (choice.drawAfterSuccess ?? 0) > 0) player = drawCards(player, choice.drawAfterSuccess ?? 0);
      return write(current, `${selected.name} destroyed from your ${source === "hand" ? "hand" : "discard pile"}.${pendingChoice ? ` Choose ${remaining} more Junk.` : `${choice.drawAfterSuccess ? ` ${choice.drawAfterSuccess} card${choice.drawAfterSuccess === 1 ? "" : "s"} drawn by the structured follow-up.` : ""} Choice resolved.`}`, { player, pendingChoice });
    }

    if (choice.kind === "discard-hand") {
      if (!current.player.hand.includes(cardId)) return current;
      const sourceCard = cardFor(choice.sourceCardId);
      const followup = sourceCard && choice.sourceFollowup !== false ? discardChoiceFollowup(sourceCard, selected) : { focus: 0, nextAttackPower: 0, nextDefenseGuard: 0, notes: [] as string[] };
      const player = {
        ...current.player,
        hand: removeOne(current.player.hand, cardId),
        discard: [...current.player.discard, cardId],
        focus: current.player.focus + followup.focus,
        nextAttackBonus: current.player.nextAttackBonus + followup.nextAttackPower,
        nextDefenseCardBonus: (current.player.nextDefenseCardBonus ?? 0) + followup.nextDefenseGuard,
      };
      const remaining = choice.remaining - 1;
      const pendingChoice = remaining > 0 && player.hand.length ? { ...choice, remaining } : null;
      const resolved = write(current, `${selected.name} discarded for ${sourceCard?.name ?? "the printed effect"}.${followup.notes.length ? ` ${followup.notes.join("; ")}.` : ""}${pendingChoice ? ` Choose ${remaining} more.` : " Choice resolved."}`, { player, pendingChoice });
      if (!pendingChoice && choice.afterChoice === "resume-defense") return resumeAfterDefense(resolved);
      return resolved;
    }

    if (choice.kind === "deck-pick") {
      if (source !== "deck" || !choice.revealed.includes(cardId) || !cardMatchesDeckFilter(selected, choice.filter)) return current;
      const rest = removeOne(choice.revealed, cardId);
      let player: Board = { ...current.player, hand: [...current.player.hand, cardId] };
      let pendingChoice: PendingChoice | null = null;
      if (choice.restAction === "discard") player = { ...player, discard: [...player.discard, ...rest] };
      if (choice.restAction === "shuffle") player = { ...player, deck: shuffle([...player.deck, ...rest]) };
      if (choice.restAction === "reorder" && rest.length) pendingChoice = { kind: "deck-order", sourceCardId: choice.sourceCardId, revealed: rest, ordered: [], bonusFocus: 0 };
      return write(current, `${selected.name} moved from the revealed cards to your hand.${pendingChoice ? " Now choose the order for the remaining revealed cards." : choice.restAction === "discard" ? " The rest were discarded." : choice.restAction === "shuffle" ? " The rest were shuffled back." : ""}`, { player, pendingChoice });
    }

    if (choice.kind === "deck-order") {
      if (source !== "deck" || !choice.revealed.includes(cardId) || choice.ordered.includes(cardId) && choice.revealed.filter((id) => id === cardId).length <= choice.ordered.filter((id) => id === cardId).length) return current;
      const remainingRevealed = removeOne(choice.revealed, cardId);
      const ordered = [...choice.ordered, cardId];
      if (remainingRevealed.length) {
        return write(current, `${selected.name} filed as draw position ${ordered.length}. Choose the next card.`, { pendingChoice: { ...choice, revealed: remainingRevealed, ordered } });
      }
      const player = { ...current.player, deck: [...current.player.deck, ...ordered.slice().reverse()], focus: current.player.focus + choice.bonusFocus };
      return write(current, `Deck order certified: ${ordered.map((id) => cardFor(id)?.name ?? "Unknown").join(" → ")}.${choice.bonusFocus ? ` Different card types grant +${choice.bonusFocus} Focus.` : ""}`, { player, pendingChoice: null });
    }

    if (choice.kind === "ready-equipment") {
      if (source !== "equipment" || !current.player.equipment.includes(cardId) || !isEquipmentExhausted(current.player, cardId)) return current;
      const player = readyEquipment(current.player, cardId);
      return write(current, `${selected.name} readied by ${cardFor(choice.sourceCardId)?.name ?? "the printed effect"}.`, { player, pendingChoice: null });
    }

    if (choice.kind === "discard-draw") {
      if (!current.player.hand.includes(cardId)) return current;
      let player = { ...current.player, hand: removeOne(current.player.hand, cardId), discard: [...current.player.discard, cardId] };
      const remaining = choice.remaining - 1;
      if (remaining > 0 && player.hand.length) {
        return write(current, `${selected.name} discarded. Choose ${remaining} more card${remaining === 1 ? "" : "s"}.`, { player, pendingChoice: { ...choice, remaining } });
      }
      player = drawCards(player, choice.draw);
      return write(current, `${selected.name} discarded; ${choice.draw} card${choice.draw === 1 ? "" : "s"} drawn by ${cardFor(choice.sourceCardId)?.name ?? "the printed effect"}.`, { player, pendingChoice: null });
    }
    return current;
  });


  const applyCharacterRuntimeChoice = (current: Match, selection: string): Match => {
    const pending = current.pendingChoice;
    if (!pending || pending.kind !== "character-runtime") return current;
    const base = { ...current, pendingChoice: null };
    const resolved = resolveQuickDuelPlaytestCharacterChoice(base, "player", pending.event, pending.choice, selection);
    const nextChoice = resolved.choices[0];
    const pendingChoice: PendingChoice | null = resolved.event && nextChoice
      ? { kind: "character-runtime", event: resolved.event, choice: nextChoice, resume: pending.resume }
      : null;
    const selectedCard = cardFor(selection);
    const label = selectedCard?.name ?? (["skip", "decline", "cancel"].includes(selection) ? "declined" : selection);
    const written = write(resolved.match, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} resolves ${pending.choice.prompt}: ${label}.`, { pendingChoice });
    if (!pendingChoice && pending.resume && resolved.event) {
      const declaration: QuickDuelPlaytestAttackDeclarationResult<Match> = {
        ...resolved,
        zone: String(resolved.event.selectedZone ?? resolved.event.zone ?? current.selectedZone),
        attackPower: Number(resolved.event.attackPower ?? 0),
        damage: Number(resolved.event.damage ?? 0),
      };
      return pending.resume === "reversal-attack"
        ? resolveReversalState(written, declaration)
        : resolvePlayerAttackState(written, declaration);
    }
    return written;
  };

  const resolveCharacterRuntimeChoice = (selection: string) => setMatch((current) =>
    current ? applyCharacterRuntimeChoice(current, selection) : current
  );

  const resolveStage3CZoneWard = (zone: string) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "stage3c-zone-ward") return current;
    const ai = stage3cArmZoneWard(current.ai, choice.sourceCardId, zone, choice.amount);
    return write(current, `Foam Finger calls ${zone}; the next ${zone} Attack targeting you this round gets ${choice.amount} Attack Power.`, { ai, pendingChoice: null });
  });

  const resolveStage3CNegative = (stat: "ATK" | "DEF" | "Speed") => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "stage3c-remove-negative" || !choice.stats.includes(stat)) return current;
    const removed = stage3cRemoveTemporaryNegative(current.player, stat);
    let player = removed.board;
    if (removed.removed && choice.bonusAttack) {
      const status: RuntimeStatus = { sourceEffectId: `consumable-pep-talk-bonus:${choice.sourceCardId}`, effect: "combat.modifyAttackPower", target: "self", amount: choice.bonusAttack, duration: "nextAttack", resolver: "consumable.pepTalkConditionalAttackBonus", qualifier: { nextAttack: true, expires: "endOfTurn" }, appliedImmediately: false };
      player = { ...player, stage3cStatuses: [...(player.stage3cStatuses ?? []), status] };
    }
    return write(current, `${cardFor(choice.sourceCardId)?.name ?? "Consumable"} removes one temporary -${stat} effect.${choice.bonusAttack && removed.removed ? " Next Attack gets +1 Attack Power." : ""}`, { player, pendingChoice: null });
  });

  const resolveStage3CStatusRemoval = (sourceEffectId: string) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "stage3c-remove-status" || !choice.statusIds.includes(sourceEffectId)) return current;
    const status = current.player.stage3cStatuses?.find((candidate) => candidate.sourceEffectId === sourceEffectId);
    const removed = removeTemporaryStatus(current.player, sourceEffectId);
    return write(current, `${cardFor(choice.sourceCardId)?.name ?? "Consumable"} removes ${status?.resolver ?? status?.effect ?? "the selected temporary status"}.`, { player: removed.board, pendingChoice: null });
  });

  const resolveStage3CRaffle = (buy: boolean) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "stage3c-raffle") return current;
    const revealed = cardFor(choice.revealedCardId);
    if (!revealed) return { ...current, pendingChoice: null };
    const basePrice = marketBasePriceFor(current.player, revealed);
    const price = previewQuickDuelCharacterPurchasePrice(current.player, basePrice);
    if (buy && marketFocusAvailable(current.player, revealed) >= price) {
      const focusBefore = current.player.focus;
      const characterPurchase = commitQuickDuelCharacterPurchase(current.player, current.ai, revealed, basePrice, "player");
      let player: Board = spendMarketFocus(characterPurchase.self, revealed, characterPurchase.price);
      player = stage3cConsumePurchase(markCompletedTask({ ...player, discard: [...player.discard, revealed.id], purchasedTypes: [...player.purchasedTypes, revealed.cardType], cardsBought: player.cardsBought + 1, boughtCardThisAscend: true }), revealed);
      return write(current, `Dojo Raffle Ticket purchase: ${revealed.name} for ${characterPurchase.price} Focus (${focusBefore} → ${player.focus}).`, { player, ai: characterPurchase.opponent, pendingChoice: null, marketPurchasedThisRound: true });
    }
    return write(current, `Dojo Raffle Ticket passes on ${revealed.name}; it goes to the bottom of the Market deck.`, { marketDeck: [revealed.id, ...current.marketDeck], pendingChoice: null });
  });

  const resolveStage3CLucky = (use: boolean) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "stage3c-lucky-reveal") return current;
    if (!use) return write(current, "Lucky Dumpling held; the revealed card remains.", { pendingChoice: null });
    const lucky = cardFor(choice.sourceCardId);
    if (!lucky || !current.player.hand.includes(lucky.id)) return { ...current, pendingChoice: null };
    const aiAirHorn = firstEventReactionCard(current.ai.hand.map(cardFor).filter((candidate): candidate is CardEntry => Boolean(candidate && isCoreConsumableCard(candidate))), "cancel-reaction") as CardEntry | null;
    let player: Board = { ...current.player, hand: removeOne(current.player.hand, lucky.id), playArea: [...current.player.playArea, lucky.id], usedConsumableThisRound: true, reactionItemUsedSinceLastTurn: true };
    player = returnResolvedConsumable(player, lucky);
    if (aiAirHorn) {
      let ai: Board = { ...current.ai, hand: removeOne(current.ai.hand, aiAirHorn.id), playArea: [...current.ai.playArea, aiAirHorn.id], usedConsumableThisRound: true, reactionItemUsedSinceLastTurn: true };
      ai = returnResolvedConsumable(ai, aiAirHorn);
      return write(current, `${aiAirHorn.name} cancels Lucky Dumpling; the original reveal remains.`, { player, ai, pendingChoice: null });
    }
    if (choice.revealKind === "market" && choice.marketSlot !== undefined) {
      const reveal = revealMarketCards(current.marketDeck, [...current.marketDiscard, choice.revealedCardId], 1);
      const market = [...current.market];
      market[choice.marketSlot] = reveal.revealed[0] ?? choice.revealedCardId;
      return write(current, `Lucky Dumpling replaces ${cardFor(choice.revealedCardId)?.name ?? "the Market reveal"} with ${cardFor(market[choice.marketSlot])?.name ?? "a replacement"}.`, { player, market, marketDeck: reveal.marketDeck, marketDiscard: reveal.marketDiscard, pendingChoice: null });
    }
    if (choice.revealKind === "location") {
      const replacement = current.locations[0];
      if (!replacement) return write(current, "Lucky Dumpling finds no remaining Location to replace the reveal.", { player, pendingChoice: null });
      return write(current, `Lucky Dumpling replaces ${cardFor(choice.revealedCardId)?.name ?? "the Location"} with ${cardFor(replacement)?.name ?? "the next Location"}.`, { player, locationId: replacement, locations: current.locations.slice(1), pendingChoice: null });
    }
    return { ...current, player, pendingChoice: null };
  });

  const skipPendingChoice = () => setMatch((current) => {
    if (!current?.pendingChoice) return current;
    if (current.pendingChoice.kind === "prevent-combat-damage") {
      const choice = current.pendingChoice;
      return resolveDefenseState(current, choice.defenseId, null, true);
    }
    if (current.pendingChoice.kind === "character-runtime") {
      if (!current.pendingChoice.choice.optional) return current;
      const selection = current.pendingChoice.choice.options.find((option) =>
        ["skip", "decline", "cancel"].includes(option)
      ) ?? "decline";
      return applyCharacterRuntimeChoice(current, selection);
    }
    if (current.pendingChoice.kind === "equipment-purchase-card") {
      return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Purchase suggestion"}: hand filing declined; no delayed draw is armed.`, { pendingChoice: null });
    }
    if (current.pendingChoice.kind === "post-block-cycle") return resumeAfterDefense(write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional Equipment"}: post-Block cycle declined.`, { pendingChoice: null }));
    if (current.pendingChoice.kind === "stage3c-trail-mix") return write(current, "Department-Issue Trail Mix: optional Equipment cycle declined.", { pendingChoice: null });
    if (current.pendingChoice.kind === "stage3c-discard-focus") return write(current, "Last-Call Electrolytes: stop discarding; keep the Focus already earned.", { pendingChoice: null });
    if (current.pendingChoice.kind === "stage3c-sparring-junk") return write(current, "Sparring Dummy: optional Junk destruction declined.", { pendingChoice: null });
    if (current.pendingChoice.kind === "destroy-junk" && current.pendingChoice.optional) return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: Junk destruction declined.`, { pendingChoice: null });
    if (current.pendingChoice.kind === "discard-draw") return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: discard/draw declined.`, { pendingChoice: null });
    if (current.pendingChoice.kind === "ready-equipment" && current.pendingChoice.optional) return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: ready effect declined.`, { pendingChoice: null });
    if (current.pendingChoice.kind === "deck-pick" && current.pendingChoice.optional) {
      const player = { ...current.player, deck: shuffle([...current.player.deck, ...current.pendingChoice.revealed]) };
      return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional search"}: no card taken; revealed cards shuffled back.`, { player, pendingChoice: null });
    }
    return current;
  });

  const discardBadHabitForFocus = (id: string) => setMatch((current) => {
    if (!current || current.phase !== "player-yell" || current.winner || current.player.badHabitFocusUsed || current.pendingDiscard || current.pendingChoice || gameDefinition.economy.badHabitFocus.usesPerTurn < 1) return current;
    const card = cardFor(id);
    if (!card || card.catalogId !== gameDefinition.economy.badHabitFocus.catalogId || !current.player.hand.includes(id)) return current;
    const gain = gameDefinition.economy.badHabitFocus.focusGain;
    const nextPlayer = gainFocus({ ...current.player, hand: removeOne(current.player.hand, id), discard: [...current.player.discard, id], badHabitFocusUsed: true, lastAttackHit: false }, gain);
    return write(current, `${card.name} discarded under the once-per-turn Bad Habit rule: +${gain} Focus.`, { player: nextPlayer });
  });

  const practiceDefense = (id: string) => setMatch((current) => {
    if (!current || current.phase !== "player-yell" || current.winner || current.player.defensePracticeUsed || current.pendingDiscard || current.pendingChoice) return current;
    const card = cardFor(id);
    if (!card || !isDefense(card) || !current.player.hand.includes(id) || gameDefinition.economy.defensePractice.usesPerTurn < 1) return current;
    const nextPlayer = gainFocus({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], defensePracticeUsed: true, lastAttackHit: false }, cardFocus(card));
    return write(current, `${card.name} used for Defense Practice: +${cardFocus(card)} printed Focus. No Guard, rules text, XP, Combo, or Belt credit applies.`, { player: nextPlayer });
  });

  const enterAscend = () => {
    setDeskView("market");
    setMatch((current) => current?.phase === "player-yell" && !current.pendingDiscard && !current.pendingChoice ? write(current, "Ascend: the acquisition desk opens. Spend this turn's Focus before it leaves your mat.", { phase: "player-ascend", selectedAttackId: null, player: { ...current.player, boughtCardThisAscend: false } }) : current);
  };

  const buyMarket = (id: string) => setMatch((current) => {
    if (!current || current.phase !== "player-ascend" || current.winner) return current;
    const card = cardFor(id);
    const slot = current.market.indexOf(id);
    if (!card || slot < 0) return current;
    const marketEndSlot = slot === current.market.length - 1;
    const basePrice = marketBasePriceFor(current.player, card, marketEndSlot);
    const price = previewQuickDuelCharacterPurchasePrice(current.player, basePrice);
    if (marketFocusAvailable(current.player, card) < price) return current;
    const focusBefore = current.player.focus;
    const characterPurchase = commitQuickDuelCharacterPurchase(current.player, current.ai, card, basePrice, "player");
    let nextPlayer: Board = spendMarketFocus(characterPurchase.self, card, characterPurchase.price);
    nextPlayer = stage3cConsumePurchase(markCompletedTask({ ...nextPlayer, discard: [...nextPlayer.discard, id], purchasedTypes: [...nextPlayer.purchasedTypes, card.cardType], cardsBought: nextPlayer.cardsBought + 1, boughtCardThisAscend: true, nextItemCostPenalty: card.cardType === "Item" ? 0 : nextPlayer.nextItemCostPenalty }), card);
    const equipmentPurchase = applyStructuredEquipmentPurchase(nextPlayer, card, marketEndSlot);
    nextPlayer = equipmentPurchase.board;
    const equipmentChoice = equipmentPurchase.choiceRequired && nextPlayer.hand.length
      ? { kind: "equipment-purchase-card" as const, sourceCardId: card.id, handIds: [...nextPlayer.hand], nextInitiateDraw: 1 }
      : null;
    const refilled = refillPurchasedMarketSlot(current.market, current.marketDeck, current.marketDiscard, slot);
    const purchased = write(current, `Bought ${card.name} for ${characterPurchase.price} Focus (${focusBefore} → ${nextPlayer.focus}). The top Market card immediately fills the slot.`, { player: nextPlayer, ai: characterPurchase.opponent, ...refilled, marketPurchasedThisRound: true });
    const revealedId = refilled.market[slot];
    const lucky = revealedId ? nextPlayer.hand.map(cardFor).find((candidate): candidate is CardEntry => Boolean(candidate && candidate.catalogId === "DDB-CON-CORE-033")) : null;
    if (equipmentChoice) return write(purchased, `${card.name} purchase follow-up is ready: choose a card to file at the bottom of your deck.`, { pendingChoice: equipmentChoice });
    return lucky && revealedId ? write(purchased, `${cardFor(revealedId)?.name ?? "A Market card"} was revealed. Lucky Dumpling may replace it.`, { pendingChoice: { kind: "stage3c-lucky-reveal", sourceCardId: lucky.id, revealKind: "market", revealedCardId: revealedId, marketSlot: slot } }) : purchased;
  });

  const cycleCombo = (learn: boolean) => setMatch((current) => {
    if (!current || current.phase !== "player-ascend" || !current.comboOfferId || current.player.comboAttemptedTurn || current.winner) return current;
    const combo = cardFor(current.comboOfferId);
    if (!combo) return current;
    const comboDiscount = qualifiedNextComboLearnDiscount(current.player.stage3cStatuses);
    const cost = Math.max(0, cardCost(combo) - comboDiscount.amount);
    if (learn && (current.player.focus < cost || current.player.learnedCombos.length >= 2)) return current;
    const nextOfferId = current.comboDeck[0] ?? null;
    const nextDeck = [...current.comboDeck.slice(1), ...(learn ? [] : [combo.id])];
    const player = learn
      ? { ...spendFocus({ ...current.player, stage3cStatuses: consumeQualifiedNextComboLearnDiscount(current.player.stage3cStatuses) }, cost), learnedCombos: [...current.player.learnedCombos, combo.id], comboAttemptedTurn: true }
      : { ...current.player, comboAttemptedTurn: true };
    return write(current, learn ? `Learned Combo: ${combo.name} for ${cost} Focus${comboDiscount.amount ? ` (Kata discount −${comboDiscount.amount})` : ""}. It remains face up beside your delegation.` : `${combo.name} returned to the bottom of the Combo docket.`, { player, comboOfferId: nextOfferId, comboDeck: nextDeck });
  });

  const promote = () => setMatch((current) => {
    if (!current || current.phase !== "player-ascend" || current.player.belt >= belts.length - 1) return current;
    const next = belts[current.player.belt + 1];
    if (current.player.xp < beltThresholds[current.player.belt + 1] || !current.player.completedTasks.includes(current.player.belt + 1)) return current;
    if (!quickDuelBeltCheckActionAvailability(current, "player", "promote").canUse) return current;
    const nextPlayer = applyBeltPromotion(current.player, current.player.belt + 1);
    const vitality = nextPlayer.maxHp > current.player.maxHp ? ` Max HP ${current.player.maxHp} → ${nextPlayer.maxHp}; current HP ${current.player.hp} → ${nextPlayer.hp}.` : "";
    const promoted = markQuickDuelBeltCheckAction({ ...current, player: nextPlayer }, "player", "promote");
    return write(promoted, `Certification approved: ${next.name} Belt. ${next.reward.summary}${next.reward.onPromotionFocus ? ` +${next.reward.onPromotionFocus} Focus.` : ""}${vitality}`);
  });

  const completeTurn = () => {
    setDeskView(null);
    setMatch((current) => {
      if (!current || current.phase !== "player-ascend") return current;
      const hostedHide = publishQuickDuelPlaytestLifecycleEvent(current, "player", "onHide", quickDuelHostOperations, cardFor).match;
      const kataHidePlayer = applyKataHideEffects(hostedHide.player, "player");
      const nextPlayer = playAreaCleanup(kataHidePlayer);
      const hidden = write(hostedHide, "Hide: unspent Focus clears and your next hand is drawn.", { player: nextPlayer, winner: nextPlayer.hp ? hostedHide.winner : "ai" });
      if (!nextPlayer.hp) return hidden;
      if (current.turnIndex === 0) return write(hidden, "The computer is second in this round's initiative order.", { phase: "ai-ready", turnIndex: 1 });
      return advanceRound(hidden, settings.locations, "Both fighters have completed the round.", settings.houseRuleIds);
    });
  };

  const advanceAscendReview = () => {
    if (match?.phase !== "player-ascend") return;
    if (deskView === "market" || deskView === "combo" || !deskView) setDeskView("belt");
    else completeTurn();
  };

  const runAiTurn = () => setMatch((current) => {
    if (!current || current.phase !== "ai-ready" || current.winner || current.pendingChoice) return current;
    const prepared = prepareAiTurn(current);
    if (prepared.pendingChoice) return prepared;
    if (hasUntargetableStatus(prepared.player.stage3cStatuses)) return finishAiTurn(prepared, "Smoke Bomb leaves the computer without a legal target this Yell.", settings.locations, settings.houseRuleIds);
    const availableAttacks = stage3cRestrictionBlocks(prepared.ai.stage3cRestrictions, "attack")
      ? []
      : prepared.ai.hand.filter((id) => { const card = cardFor(id); return Boolean(card && isAttack(card) && !weaponAttackBlocked(prepared.ai, card)); });
    const aiAttackIds = settings.difficulty === "student" ? shuffle(availableAttacks) : availableAttacks.sort((left, right) => aiAttackScore(cardFor(right)!, prepared.ai, prepared.player, cardFor(prepared.locationId)) - aiAttackScore(cardFor(left)!, prepared.ai, prepared.player, cardFor(prepared.locationId)));
    if (!aiAttackIds.length) return finishAiTurn(prepared, "Computer finds no Attack and files an awkward report.", settings.locations, settings.houseRuleIds);
    return openAiStrike(prepared, aiAttackIds[0], aiAttackIds.slice(1), settings.tempo, settings.locations, settings.houseRuleIds);
  });

  useEffect(() => {
    if (!settings.autoAi || match?.phase !== "ai-ready" || match.winner || match.pendingChoice) return;
    const timer = window.setTimeout(runAiTurn, 760);
    return () => window.clearTimeout(timer);
  }, [match?.phase, match?.turnIndex, match?.winner, settings.autoAi]);

  const resolveDefenseState = (current: Match, defenseId: string | null, prevention: { sourceCardId: string; reduce: number; readyAtHideMinBelt: string; readyAtHideMinDamage: number } | null = null, skipOptionalPrompt = false): Match => {
    if (current?.pendingChoice?.kind === "prevent-combat-damage") {
    current = normalizePendingDamageChoice(current);
  }
  if (!current?.pendingStrike || current.phase !== "defense-window") return current;
    const pending = current.pendingStrike;
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    const aiCard = cardFor(pending.cardId)!;
    if (defenseCard) {
      const aiAirHorn = firstEventReactionCard(current.ai.hand.map(cardFor).filter((candidate): candidate is CardEntry => Boolean(candidate && isCoreConsumableCard(candidate))), "cancel-reaction") as CardEntry | null;
      if (aiAirHorn) {
        const cancelledPlayer: Board = {
          ...current.player,
          hand: removeOne(current.player.hand, defenseCard.id),
          discard: [...current.player.discard, defenseCard.id],
        };
        let reactingAi: Board = {
          ...current.ai,
          hand: removeOne(current.ai.hand, aiAirHorn.id),
          playArea: [...current.ai.playArea, aiAirHorn.id],
          usedConsumableThisRound: true,
          reactionItemUsedSinceLastTurn: true,
        };
        reactingAi = returnResolvedConsumable(reactingAi, aiAirHorn);
        const intercepted = write(current, `${aiAirHorn.name} cancels ${defenseCard.name} after it is played but before Guard or printed effects resolve. The incoming Attack continues against standing DEF and Equipment.`, { player: cancelledPlayer, ai: reactingAi });
        return resolveDefenseState(intercepted, null, prevention, skipOptionalPrompt);
      }
    }
    let nextPlayer = { ...current.player };
    const matchingArmor = equipmentDefenseModifier(nextPlayer, pending.zone, { opponentXp: current.ai.xp }).value > 0;
    const exhaustedPiercingBonus = !pending.targetExhaustedAtDeclaration && (nextPlayer.exhaustedEquipment ?? []).length
      ? Math.max(0,
          attackPiercing(aiCard, { matchingArmor, targetEquipmentCount: nextPlayer.equipment.length, targetHasExhaustedEquipment: true, speedChangedThisRound: Boolean(current.ai.speedChangedThisRound) }).amount
          - attackPiercing(aiCard, { matchingArmor, targetEquipmentCount: nextPlayer.equipment.length, targetHasExhaustedEquipment: false, speedChangedThisRound: Boolean(current.ai.speedChangedThisRound) }).amount)
      : 0;
    const effectivePiercing = (pending.piercing ?? 0) + exhaustedPiercingBonus;
    const armorModifier = piercedArmorModifier(applyNextAttackArmorPenalty(equipmentDefenseModifier(nextPlayer, pending.zone, { opponentXp: current.ai.xp }), pending.armorPenalty ?? 0), effectivePiercing);
    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(nextPlayer, current.ai, defenseCard, aiCard) : { value: 0, notes: [] as string[] };
    const reactionDefense = defenseCard && isCoreReactionItemCard(defenseCard)
      ? resolveQuickDuelReactionItemEvent({
          card: defenseCard,
          self: current.player,
          opponent: current.ai,
          trigger: "onDefenseDeclared",
          context: reactionItemContext(pending.zone, current.ai, true),
        })
      : null;
    let defensePower = fighterStat(nextPlayer, "DEF") + armorModifier.value + stage3cIncomingAttackDefenseBonus(nextPlayer);
    let tempoBonus = 0;
    const locationModifier = locationDefenseModifier(cardFor(current.locationId), defenseCard, nextPlayer, pending.zone);
    if (defenseCard) {
      tempoBonus = settings.tempo && nextPlayer.tempo && fighterStat(nextPlayer, "Speed") > fighterStat(current.ai, "Speed") ? 1 : 0;
      defensePower += cardPower(defenseCard) + (nextPlayer.nextDefenseCardBonus ?? 0) + stage3cNextDefenseGuardBonus(nextPlayer) + (nextPlayer.equipmentDefenseGuard ?? 0) + defenseCardModifier.value + tempoBonus + locationModifier.value;
      const familyDefenseContext = stage3cDefenseContext(nextPlayer, current.ai, defenseCard, aiCard, pending.zone, pending.attackPower);
      nextPlayer = stage3cConsumeDefenseStatuses(markCompletedTask({
        ...(reactionDefense?.applied ? reactionDefense.self : nextPlayer),
        hand: reactionDefense?.applied ? reactionDefense.self.hand : removeOne(nextPlayer.hand, defenseCard.id),
        discard: reactionDefense?.applied ? reactionDefense.self.discard : [...nextPlayer.discard, defenseCard.id],
        xp: nextPlayer.xp + 1,
        defendedThisRound: true,
        playedDefenseSinceLastTurn: true,
        nextDefenseCardBonus: 0,
        tempo: tempoBonus ? false : nextPlayer.tempo,
      }));
      if (!reactionDefense?.applied) nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onPlay", familyDefenseContext);
      const followup = applyAfterDefenseEquipment(nextPlayer);
      nextPlayer = followup.board;
    }
    nextPlayer = stage3cConsumeIncomingAttackStatuses(nextPlayer);
    const postDefensePower = afterDefenseAttackPowerBonus(aiCard, Boolean(defenseCard));
    const finalAttackPower = Math.max(0, pending.attackPower + postDefensePower.amount);
    const hit = finalAttackPower > defensePower;
    if (!hit) nextPlayer = { ...nextPlayer, blockedSinceLastTurn: true, blockedThisRound: true };
    const reversalEquipmentBonus = !hit && defenseCard ? (nextPlayer.pendingReversalBonusOnBlock ?? 0) : 0;
    const rawDamage = hit && !pending.damagePreventedAtDeclaration ? Math.max(0, finalAttackPower - defensePower + (pending.damageModifier ?? 0)) : 0;
    const failedBlockContext = defenseCard ? stage3cDefenseContext(nextPlayer, current.ai, defenseCard, aiCard, pending.zone, finalAttackPower, rawDamage, !hit) : {};
    const defensePrevention = hit && defenseCard ? stage3cCurrentDefensePrevention(defenseCard, failedBlockContext) : 0;
    const reduced = reduceNonCharacterDamageForFighter(nextPlayer, Math.max(0, rawDamage - defensePrevention));
    const characterDamage = publishQuickDuelPlaytestDamageIncoming({ ...current, player: reduced.board }, "player", reduced.damage);
    const damageBeforeOptional = characterDamage.event?.damage ?? reduced.damage;
    const optionalReduction = !skipOptionalPrompt && damageBeforeOptional > 0 ? optionalCombatDamagePlan(current.player) : null;
    if (optionalReduction) {
      return write(current, `${optionalReduction.card.name} may reduce this ${damageBeforeOptional} combat damage by ${optionalReduction.plan.reduce}. Choose whether to exhaust it before HP is removed.`, {
        pendingChoice: { kind: "prevent-combat-damage", sourceCardId: optionalReduction.card.id, defenseId, reduce: optionalReduction.plan.reduce, damage: damageBeforeOptional, readyAtHideMinBelt: optionalReduction.plan.readyAtHideMinBelt, readyAtHideMinDamage: optionalReduction.plan.readyAtHideMinDamage },
      });
    }
    let reducedBoard = characterDamage.match.player;
    let damage = damageBeforeOptional;
    const preventionNotes: string[] = [];
    if (prevention && damage > 0 && reducedBoard.equipment.includes(prevention.sourceCardId) && !isEquipmentExhausted(reducedBoard, prevention.sourceCardId)) {
      reducedBoard = exhaustEquipment(reducedBoard, prevention.sourceCardId);
      if (beltAtLeast(reducedBoard, prevention.readyAtHideMinBelt) && damageBeforeOptional >= prevention.readyAtHideMinDamage) {
        reducedBoard = { ...reducedBoard, readyAtHide: [...new Set([...(reducedBoard.readyAtHide ?? []), prevention.sourceCardId])] };
        preventionNotes.push(`${cardFor(prevention.sourceCardId)?.name ?? "Equipment"} is scheduled to ready at Hide`);
      }
      damage = Math.max(0, damage - prevention.reduce);
      preventionNotes.unshift(`${cardFor(prevention.sourceCardId)?.name ?? "Equipment"} reduces combat damage ${damageBeforeOptional} → ${damage}`);
    }
    nextPlayer = { ...reducedBoard, hp: Math.max(0, reducedBoard.hp - damage), combatDamageEventsThisRound: (reducedBoard.combatDamageEventsThisRound ?? 0) + (damageBeforeOptional > 0 ? 1 : 0), wasHitSinceLastTurn: reducedBoard.wasHitSinceLastTurn || hit, damageTaken: reducedBoard.damageTaken + damage };
    const thresholdProtection = applyStructuredEquipmentThresholdProtection(nextPlayer, damage);
    nextPlayer = thresholdProtection.board;
    nextPlayer = resolveReactionItemIncomingAttackOutcome(nextPlayer, hit);
    const targetDebuff = hit ? applyTargetHitDebuffs(nextPlayer, aiCard, { previousCardIsItem: Boolean(pending.previousCardWasItem) }) : { board: nextPlayer, notes: [] as string[] };
    nextPlayer = { ...targetDebuff.board, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: (targetDebuff.board.reversalAttackBonus ?? 0) + reversalEquipmentBonus };
    let nextAi = markCompletedTask({ ...current.ai, damageDealt: current.ai.damageDealt + damage, hitThisTurn: current.ai.hitThisTurn || hit, lastAttackHit: hit });
    const equipmentHit = hit
      ? applyStructuredEquipmentHit(nextAi, nextPlayer, aiCard, pending.zone, damage)
      : { attacker: nextAi, target: nextPlayer, notes: [] as string[] };
    nextAi = equipmentHit.attacker;
    nextPlayer = equipmentHit.target;
    nextAi = applyCardEffects(nextAi, aiCard, "ai", hit ? "onHit" : "afterResolve", { defenderPlayedDefense: Boolean(defenseCard) });
    if (hit) nextAi = applyCardEffects(nextAi, aiCard, "ai", "afterResolve", { defenderPlayedDefense: Boolean(defenseCard) });
    const aiConsumableAttackFollowup = resolveConsumableAttackFollowupStatuses(nextAi.stage3cStatuses ?? [], { blocked: !hit, interferencePrevented: false });
    nextAi = {
      ...nextAi,
      stage3cStatuses: aiConsumableAttackFollowup.statuses,
      hp: Math.max(0, nextAi.hp - aiConsumableAttackFollowup.directSelfDamage),
      damageTaken: nextAi.damageTaken + aiConsumableAttackFollowup.directSelfDamage,
    };
    if (aiConsumableAttackFollowup.focus) nextAi = gainFocus(nextAi, aiConsumableAttackFollowup.focus);
    const armorPenaltyGrant = hit ? nextAttackArmorPenalty(aiCard) : 0;
    if (armorPenaltyGrant) nextAi = { ...nextAi, nextAttackArmorPenalty: (nextAi.nextAttackArmorPenalty ?? 0) + armorPenaltyGrant };
    const aiCycleNotes: string[] = [];
    if (pending.conditionalCycle?.draw) {
      nextAi = drawCards(nextAi, pending.conditionalCycle.draw);
      aiCycleNotes.push(`printed effect draws ${pending.conditionalCycle.draw}`);
    }
    if (pending.conditionalCycle?.discard && nextAi.hand.length) {
      const discardCount = Math.min(pending.conditionalCycle.discard, nextAi.hand.length);
      const ranked = [...nextAi.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)));
      const discarded = ranked.slice(0, discardCount);
      nextAi = { ...nextAi, hand: nextAi.hand.filter((id) => !discarded.includes(id)), discard: [...nextAi.discard, ...discarded] };
      aiCycleNotes.push(`printed effect discards ${discardCount}`);
    }
    const aiTriggeredEquipment = autoTriggerAiAfterAttackEquipment(nextAi, nextPlayer, hit);
    nextAi = aiTriggeredEquipment.attacker;
    nextPlayer = aiTriggeredEquipment.target;
    if (!hit && pending.blockedFocus) nextAi.focus += pending.blockedFocus;
    if (hit && readyEquipmentOnHit(aiCard) && (nextAi.exhaustedEquipment ?? []).length) nextAi = readyEquipment(nextAi, (nextAi.exhaustedEquipment ?? [])[0]);
    let blockDiscardChoice = 0;
    let equipmentBlockNotes: string[] = [];
    if (defenseCard) {
      if (!hit) {
        const familyDefenseContext = stage3cDefenseContext(nextPlayer, current.ai, defenseCard, aiCard, pending.zone, finalAttackPower, rawDamage, true);
        nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onBlock", familyDefenseContext);
        nextAi = applyStage3CTiming(nextAi, defenseCard, "onBlock", "ai", familyDefenseContext, "opponent");
        blockDiscardChoice = playerDiscardChoiceCount(defenseCard, "onBlock");
      }
      const familyDefenseContext = stage3cDefenseContext(nextPlayer, current.ai, defenseCard, aiCard, pending.zone, finalAttackPower, rawDamage, !hit);
      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "afterResolve", familyDefenseContext);
      nextAi = applyStage3CTiming(nextAi, defenseCard, "afterResolve", "ai", familyDefenseContext, "opponent");
    }
    if (!hit) {
      const equipmentBlock = applyStructuredEquipmentBlock(nextPlayer, nextAi, aiCard, defenseCard, pending.zone, armorModifier.value > 0, !current.player.blockedThisRound);
      nextPlayer = equipmentBlock.board;
      nextAi = equipmentBlock.opponent;
      equipmentBlockNotes = equipmentBlock.notes;
    }
    let hostedComboMatch: Match = { ...current, player: nextPlayer, ai: nextAi };
    if (hit) hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "ai", aiCard, pending.zone, cardFor, "onHit", quickDuelHostOperations, { currentAttackHit: true }).match;
    hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "ai", aiCard, pending.zone, cardFor, "afterResolve", quickDuelHostOperations, { currentAttackHit: hit, currentDefense: defenseCard, currentDefenseBlocked: Boolean(defenseCard && !hit) }).match;
    nextPlayer = hostedComboMatch.player;
    nextAi = hostedComboMatch.ai;
    const modifiers = [...(pending.modifierNotes ?? []), ...(defenseCard ? [`${defenseCard.name} +${cardPower(defenseCard)} Guard`] : []), ...(exhaustedPiercingBonus ? [`Exhausted Equipment adds Piercing ${exhaustedPiercingBonus}`] : []), ...((current.player.equipmentDefenseGuard ?? 0) ? [`Equipment reaction +${current.player.equipmentDefenseGuard} Guard`] : []), ...(reversalEquipmentBonus ? [`Block primes Reversal +${reversalEquipmentBonus} Attack Power`] : []), ...thresholdProtection.notes, ...armorModifier.notes, ...defenseCardModifier.notes, ...postDefensePower.notes, ...targetDebuff.notes, ...equipmentHit.notes, ...equipmentBlockNotes, ...aiCycleNotes, ...aiTriggeredEquipment.notes, ...aiConsumableAttackFollowup.notes, ...characterDamage.notes, ...(reduced.note ? [reduced.note] : []), ...preventionNotes];
    const lastExchange: PlaytestCombatExchange = {
      id: exchangeId(current, "ai", aiCard.id),
      actor: "ai",
      target: "player",
      attackCardId: aiCard.id,
      defenseCardId: defenseCard?.id ?? null,
      zone: pending.zone,
      attackPower: finalAttackPower,
      defensePower,
      damage,
      outcome: hit ? "hit" : "block",
      notes: modifiers,
    };
    if (blockDiscardChoice && nextPlayer.hand.length) {
      const discardCount = Math.min(blockDiscardChoice, nextPlayer.hand.length);
      const reversalEligible = !nextPlayer.reversalUsedRound;
      return write(current, `${defenseCard?.name ?? "Defense"} Block effect: choose ${discardCount} card${discardCount === 1 ? "" : "s"} from your hand to discard.`, {
        player: nextPlayer,
        ai: nextAi,
        pendingStrike: null,
        pendingChoice: { kind: "discard-hand", sourceCardId: defenseCard!.id, remaining: discardCount, afterChoice: "resume-defense", sourceFollowup: false },
        pendingCombatContinuation: { remainingAiAttacks: pending.remainingAiAttacks, reversalEligible },
        exchangeSequence: (current.exchangeSequence ?? 0) + 1,
        lastExchange,
        winner: null,
      });
    }
    const postBlockCycle = !hit && defenseCard ? postBlockCyclePlan(nextPlayer, pending.zone, defenseCard) : null;
    if (postBlockCycle) {
      const reversalEligible = !nextPlayer.reversalUsedRound;
      const paused = write(current, `${postBlockCycle.card.name} may exhaust after this ${pending.zone} Block to draw ${postBlockCycle.plan.draw}, then discard ${postBlockCycle.plan.discard}.`, {
        player: nextPlayer,
        ai: nextAi,
        pendingStrike: null,
        pendingChoice: { kind: "post-block-cycle", sourceCardId: postBlockCycle.card.id, draw: postBlockCycle.plan.draw, discard: postBlockCycle.plan.discard },
        pendingCombatContinuation: { remainingAiAttacks: pending.remainingAiAttacks, reversalEligible },
        exchangeSequence: (current.exchangeSequence ?? 0) + 1,
        lastExchange,
        winner: null,
      });
      return paused;
    }
    if (!nextPlayer.hp) nextAi = { ...nextAi, xp: nextAi.xp + 2 };
    const message = hit
      ? `${aiCard.name} hits you for ${damage}. Attack ${finalAttackPower} vs Defense ${defensePower}.`
      : defenseCard
        ? `${defenseCard.name} blocks ${aiCard.name} and is discarded. Attack ${finalAttackPower} vs Defense ${defensePower}.`
        : `No Defense card was played; your standing DEF/Equipment blocks ${aiCard.name}. Attack ${finalAttackPower} vs Defense ${defensePower}.`;
    const resolved = write(current, `${tempoBonus ? "Tempo +1 Guard. " : ""}${message}${modifiers.length ? ` ${modifiers.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, pendingStrike: null, pendingChoice: null, pendingCombatContinuation: null, exchangeSequence: (current.exchangeSequence ?? 0) + 1, lastExchange, winner: !nextAi.hp ? "player" : nextPlayer.hp ? null : "ai" });
    if (!nextPlayer.hp || !nextAi.hp) return resolved;
    const forcedTargetDiscard = hit ? targetDiscardOnHitCount(aiCard) : 0;
    if (forcedTargetDiscard && nextPlayer.hand.length) {
      const discardCount = Math.min(forcedTargetDiscard, nextPlayer.hand.length);
      return write(resolved, `${aiCard.name} Hit effect: choose ${discardCount} card${discardCount === 1 ? "" : "s"} from your hand to discard.`, {
        pendingChoice: { kind: "discard-hand", sourceCardId: aiCard.id, remaining: discardCount, afterChoice: "resume-defense", sourceFollowup: false },
        pendingCombatContinuation: { remainingAiAttacks: pending.remainingAiAttacks, reversalEligible: false },
      });
    }
    const reversalAttacks = nextPlayer.hand.filter((id) => { const card = cardFor(id); return Boolean(card && isAttack(card)); });
    const reactionFollowupAvailable = !hit && !nextPlayer.reversalUsedRound && nextPlayer.hand.some((id) => {
      const card = cardFor(id);
      return Boolean(card && isCoreReactionItemCard(card) && canPlayCoreReactionItem(card, "onBlock", { sameOpponentAsBlockedAttack: true }));
    });
    if (!hit && !nextPlayer.reversalUsedRound && (reversalAttacks.length || reactionFollowupAvailable)) {
      return write(resolved, `Reversal window: the block is certified and ${reversalAttacks.length} counterattack${reversalAttacks.length === 1 ? " is" : "s are"} ready.`, { phase: "reversal-window", reversalRemainingAiAttacks: pending.remainingAiAttacks, selectedAttackId: null });
    }
    if (pending.remainingAiAttacks.length) return openAiStrike(resolved, pending.remainingAiAttacks[0], pending.remainingAiAttacks.slice(1), settings.tempo, settings.locations, settings.houseRuleIds);
    return finishAiTurn(resolved, "Computer finishes its Yell and clears the mat.", settings.locations, settings.houseRuleIds);
  };

  const resolveDefense = (defenseId: string | null) => setMatch((current) => current ? resolveDefenseState(current, defenseId) : current);

  const declineReversal = () => setMatch((current) => {
    if (!current || current.phase !== "reversal-window") return current;
    const resumed = write(current, "Reversal declined. Restraint has been noted and immediately questioned.", { selectedAttackId: null, player: resolveReactionFollowupFallback({ ...current.player, reversalAttackBonus: 0 }) });
    if (current.reversalRemainingAiAttacks.length) return openAiStrike(resumed, current.reversalRemainingAiAttacks[0], current.reversalRemainingAiAttacks.slice(1), settings.tempo, settings.locations, settings.houseRuleIds);
    return finishAiTurn(resumed, "Computer finishes its Yell and clears the mat.", settings.locations, settings.houseRuleIds);
  });

  const resolveReversalState = (current: Match, existingDeclaration?: QuickDuelPlaytestAttackDeclarationResult<Match>): Match => {
    if (!current || current.phase !== "reversal-window" || !current.selectedAttackId || current.player.reversalUsedRound || stage3cRestrictionBlocks(current.player.stage3cRestrictions, "attack")) return current;
    const card = cardFor(current.selectedAttackId);
    if (!card || !isAttack(card) || !current.player.hand.includes(card.id)) return current;
    if (hasUntargetableStatus(current.ai.stage3cStatuses)) return write(current, `${cardFor(current.ai.fighterId)?.name ?? "The opponent"} cannot be targeted through Smoke Bomb. Choose a different action.`, { selectedAttackId: null });
    const requestedZone = attackHasFlexibleZone(current.player, card) ? current.selectedZone : card.zone?.split(",")[0] ?? "High";
    const declaration = existingDeclaration ?? publishQuickDuelPlaytestAttackDeclared(current, "player", card, requestedZone, {
      previousAttackZone: current.player.zonesPlayed.at(-1) ?? null,
      usedConsumableThisTurn: current.player.usedConsumableThisRound,
      playedKataEarlierThisTurn: current.player.cardsThisTurn.some((id) => { const played = cardFor(id); return Boolean(played && isKata(played)); }),
      differentZoneFromPreviousAttack: Boolean(current.player.zonesPlayed.at(-1) && current.player.zonesPlayed.at(-1) !== requestedZone),
      hasWeaponEquipped: current.player.equipment.some((id) => { const equipped = cardFor(id); return Boolean(equipped && isWeapon(equipped)); }),
    });
    if (!existingDeclaration && declaration.choices.length && declaration.event) {
      return write(declaration.match, declaration.choices[0].prompt, {
        pendingChoice: { kind: "character-runtime", event: declaration.event, choice: declaration.choices[0], resume: "reversal-attack" },
      });
    }
    current = declaration.match;
    const incomingEquipmentResponse = applyStructuredEquipmentAttackDeclaration(current.ai, (current.ai.attacksReceivedThisRound ?? 0) === 0);
    const aiAttackResponse = resolveAiEquipmentAttackResponse(incomingEquipmentResponse.board, incomingEquipmentResponse);
    current = { ...current, ai: aiAttackResponse.board };
    const zone = declaration.zone;
    const preparedComboAttack = prepareQuickDuelPlaytestAttack(current, "player", card, zone, cardFor, quickDuelHostOperations, { isReversal: true });
    current = preparedComboAttack.match;
    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;
    const previousCardIsItem = Boolean(previousCard && previousCard.cardType === "Item");
    const location = cardFor(current.locationId);
    const locationModifier = locationAttackModifier(location, card, current.player, zone);
    const fighterModifier = characterAttackModifierFromDeclaration(declaration);
    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card, zone, true);
    const incomingModifier = incomingAttackEquipmentModifier(current.ai);
    const rawArmorModifier = equipmentDefenseModifier(current.ai, zone, { opponentXp: current.player.xp });
    const piercingModifier = attackPiercingModifier(current.player, current.ai, card, zone, preparedComboAttack.attackFacts.piercing);
    const armorModifier = piercedArmorModifier(rawArmorModifier, piercingModifier.value);
    const stage3cReversalBonus = stage3cAttackPowerBonus(current.player, card, zone, true);
    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cReversalBonus + (current.player.reversalAttackBonus ?? 0) + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power);
    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);
    const defenseId = bestDefense(current.ai, zone, Math.max(0, baseAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value);
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    const postDefensePower = afterDefenseAttackPowerBonus(card, Boolean(defenseCard));
    const attackPower = Math.max(0, baseAttackPower + postDefensePower.amount);
    const defenseModifier = locationDefenseModifier(location, defenseCard, current.ai, zone);
    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(current.ai, current.player, defenseCard, card) : { value: 0, notes: [] as string[] };
    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + stage3cIncomingAttackDefenseBonus(current.ai) + (defenseCard ? cardPower(defenseCard) + (current.ai.nextDefenseCardBonus ?? 0) + stage3cNextDefenseGuardBonus(current.ai) : 0) + defenseCardModifier.value + defenseModifier.value);
    const hit = attackPower > defensePower;
    const rawDamage = hit && !incomingEquipmentResponse.preventAttackDamage ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage) : 0;
    const reduced = reduceNonCharacterDamageForFighter(current.ai, rawDamage);
    const characterDamage = publishQuickDuelPlaytestDamageIncoming({ ...current, ai: reduced.board }, "ai", reduced.damage);
    const characterDamageValue = characterDamage.event?.damage ?? reduced.damage;
    const optionalReduced = applyOptionalCombatDamageReductionAi(characterDamage.match.ai, characterDamageValue);
    const damage = optionalReduced.damage;
    let nextPlayer = applyCardEffects({ ...stage3cConsumeAttackStatuses(current.player, card, zone, true), hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attackedThisRound: true, zonesPlayed: [...current.player.zonesPlayed, zone], cardsThisTurn: [...current.player.cardsThisTurn, card.id], nextAttackAnyZone: false, reversalUsedRound: true, reversalAttackBonus: 0, triggeredCombos: current.player.triggeredCombos, comboTriggered: current.player.comboTriggered, damageDealt: current.player.damageDealt + damage }, card, "player");
    nextPlayer.focus = Math.max(0, nextPlayer.focus - cardFocus(card));
    let nextAi: Board = { ...optionalReduced.board, hp: Math.max(0, optionalReduced.board.hp - damage), attacksReceivedThisRound: (optionalReduced.board.attacksReceivedThisRound ?? 0) + 1, combatDamageEventsThisRound: (optionalReduced.board.combatDamageEventsThisRound ?? 0) + (reduced.damage > 0 ? 1 : 0), damageTaken: optionalReduced.board.damageTaken + damage, wasHitSinceLastTurn: optionalReduced.board.wasHitSinceLastTurn || hit };
    const thresholdProtection = applyStructuredEquipmentThresholdProtection(nextAi, damage);
    nextAi = thresholdProtection.board;
    nextAi = stage3cConsumeIncomingAttackStatuses(nextAi);
    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card, { previousCardIsItem }) : { board: nextAi, notes: [] as string[] };
    nextAi = targetDebuff.board;
    const equipmentHit = hit
      ? applyStructuredEquipmentHit(nextPlayer, nextAi, card, zone, damage)
      : { attacker: nextPlayer, target: nextAi, notes: [] as string[] };
    nextPlayer = equipmentHit.attacker;
    nextAi = equipmentHit.target;
    if (defenseCard) nextAi = stage3cConsumeDefenseStatuses({ ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, blockedSinceLastTurn: !hit || Boolean(nextAi.blockedSinceLastTurn), blockedThisRound: !hit || Boolean(nextAi.blockedThisRound), nextDefenseCardBonus: 0 });
    if (!hit) nextAi = { ...nextAi, blockedSinceLastTurn: true, blockedThisRound: true };
    nextPlayer = applyCardEffects(nextPlayer, card, "player", hit ? "onHit" : "afterResolve", { defenderPlayedDefense: Boolean(defenseCard) });
    if (hit) nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve", { defenderPlayedDefense: Boolean(defenseCard) });
    let defenseFollowupNotes: string[] = [];
    if (defenseCard) {
      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onPlay");
      const followup = applyAfterDefenseEquipment(nextAi);
      nextAi = followup.board;
      defenseFollowupNotes = followup.notes;
      if (!hit) nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onBlock");
      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve");
    }
    const aiPostBlock = !hit && defenseCard ? autoTriggerAiPostBlockEquipment(nextAi, zone, defenseCard) : { board: nextAi, notes: [] as string[] };
    nextAi = aiPostBlock.board;
    let hostedComboMatch: Match = { ...current, player: nextPlayer, ai: nextAi };
    if (hit) hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "onHit", quickDuelHostOperations, { isReversal: true, currentAttackHit: true }).match;
    hostedComboMatch = hostQuickDuelPlaytestCardEvent(hostedComboMatch, "player", card, zone, cardFor, "afterResolve", quickDuelHostOperations, { isReversal: true, currentAttackHit: hit, currentDefense: defenseCard, currentDefenseBlocked: Boolean(defenseCard && !hit) }).match;
    nextPlayer = hostedComboMatch.player;
    nextAi = hostedComboMatch.ai;
    nextPlayer = markCompletedTask(nextPlayer);
    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...incomingModifier.notes, ...incomingEquipmentResponse.notes, ...aiAttackResponse.notes, ...thresholdProtection.notes, ...piercingModifier.notes, ...armorModifier.notes, ...postDefensePower.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...equipmentHit.notes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...characterDamage.notes, ...(reduced.note ? [reduced.note] : [])];
    const lastExchange: PlaytestCombatExchange = {
      id: exchangeId(current, "player", card.id),
      actor: "player",
      target: "ai",
      attackCardId: card.id,
      defenseCardId: defenseCard?.id ?? null,
      zone,
      attackPower,
      defensePower,
      damage,
      outcome: hit ? "hit" : "block",
      isReversal: true,
      notes: modifiers,
    };
    const result = hit ? `Reversal! ${card.name} hits ${cardFor(current.ai.fighterId)?.name ?? "the computer"} for ${damage}.` : `Reversal! ${card.name} is blocked${defenseCard ? ` by ${defenseCard.name}` : " by base DEF"}.`;
    const resolved = write(current, `${result} Attack ${attackPower} vs Defense ${defensePower}.${modifiers.length ? ` ${modifiers.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, selectedAttackId: null, exchangeSequence: (current.exchangeSequence ?? 0) + 1, lastExchange, winner: nextAi.hp ? null : "player" });
    if (!nextAi.hp) return resolved;
    if (current.reversalRemainingAiAttacks.length) return openAiStrike(resolved, current.reversalRemainingAiAttacks[0], current.reversalRemainingAiAttacks.slice(1), settings.tempo, settings.locations, settings.houseRuleIds);
    return finishAiTurn(resolved, "Computer finishes its Yell after surviving the Reversal paperwork.", settings.locations, settings.houseRuleIds);
  };

  const resolveReversal = () => setMatch((current) => current ? resolveReversalState(current) : current);

  const useHandCard = (id: string) => {
    const card = cardFor(id);
    if (!match || !card || match.winner || match.pendingChoice || !match.player.hand.includes(id)) return;
    if (match.pendingDiscard) {
      choosePendingDiscard(id);
      return;
    }
    if (match.phase === "defense-window") {
      if (isCoreConsumableCard(card) && canPlayCoreConsumableInPhase(card, "defense-window", stage3cConsumableContext(match.player))) playSupport(id);
      else if (isCoreReactionItemCard(card) && match.pendingStrike && canPlayCoreReactionItem(card, "onAttackDeclared", reactionItemContext(match.pendingStrike.zone, match.ai, true))) playSupport(id);
      else if (isCoreReactionItemCard(card) && match.pendingStrike && canPlayCoreReactionItem(card, "onPlay", { ...reactionItemContext(match.pendingStrike.zone, match.ai, true), defenseOutsideTurn: Boolean(match.player.offTurnConsumablePlayed) })) playSupport(id);
      else if (isCoreReactionItemCard(card) && match.pendingStrike && canPlayCoreReactionItem(card, "onDefenseDeclared", reactionItemContext(match.pendingStrike.zone, match.ai, true))) resolveDefense(id);
      else if (match.pendingStrike && legalDefenseIds(match.player, match.pendingStrike.zone).includes(id)) resolveDefense(id);
      return;
    }
    if (match.phase === "reversal-window") {
      if (isCoreReactionItemCard(card) && canPlayCoreReactionItem(card, "onBlock", { sameOpponentAsBlockedAttack: true })) playSupport(id);
      else if (isAttack(card)) chooseAttack(card);
      return;
    }
    if (match.phase === "player-initiate") {
      if (isPermanent(card)) equipPermanent(id);
      return;
    }
    if (match.phase === "player-ascend") {
      if ((isCoreConsumableCard(card) && canPlayCoreConsumableInPhase(card, "player-ascend", stage3cConsumableContext(match.player))) || kataHasAscendEconomyEffect(card, match.player)) playSupport(id);
      return;
    }
    if (match.phase !== "player-yell") return;
    if (card.catalogId === gameDefinition.economy.badHabitFocus.catalogId && !match.player.badHabitFocusUsed) discardBadHabitForFocus(id);
    else if (isAttack(card)) chooseAttack(card);
    else if (isDefense(card) && !match.player.defensePracticeUsed) practiceDefense(id);
    else if (!isPermanent(card)) playSupport(id);
  };

  if (!match || !player || !ai || !playerFighter || !aiFighter) return <SetupView selectedId={selectedId} setSelectedId={setSelectedId} settings={settings} setSettings={setSettings} begin={begin} />;
  const pendingAttack = match.selectedAttackId ? cardFor(match.selectedAttackId) : null;
  const currentLocation = cardFor(match.locationId);
  const comboOffer = match.comboOfferId ? cardFor(match.comboOfferId) : null;
  const nextBelt = belts[player.belt + 1];
  const nextBeltXp = nextBelt ? beltThresholds[player.belt + 1] : 0;
  const promotionAction = quickDuelBeltCheckActionAvailability(match, "player", "promote");
  const canPromote = Boolean(nextBelt && player.xp >= nextBeltXp && playerTask && promotionAction.canUse);
  const defenseOptions = match.pendingStrike ? legalDefenseIds(player, match.pendingStrike.zone) : [];
  const equipmentReactions = match.phase === "defense-window"
    ? player.equipment.map(cardFor).filter((card): card is CardEntry => {
        if (!card || isEquipmentExhausted(player, card.id)) return false;
        const plan = equipmentActivationPlan(card);
        return plan?.kind === "incoming-zone-penalty" || plan?.kind === "defense-guard";
      })
    : [];
  const equipmentActions = (match.phase === "player-initiate" || match.phase === "player-yell")
    ? player.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card && equipmentActivationAvailable(player, card, match.phase)))
    : [];
  const pendingChoiceOptions = match.pendingChoice?.kind === "destroy-junk"
    ? [
        ...((match.pendingChoice.sources ?? ["hand", "discard"]).includes("hand") ? player.hand.map((id, index) => ({ id, source: "hand" as const, index })).filter((entry) => isJunk(cardFor(entry.id))) : []),
        ...((match.pendingChoice.sources ?? ["hand", "discard"]).includes("discard") ? player.discard.map((id, index) => ({ id, source: "discard" as const, index })).filter((entry) => isJunk(cardFor(entry.id))) : []),
      ]
    : match.pendingChoice?.kind === "equipment-purchase-card"
      ? match.pendingChoice.handIds.map((id, index) => ({ id, source: "hand" as const, index })).filter((entry) => player.hand.includes(entry.id))
    : match.pendingChoice?.kind === "kata-equip-from-hand"
      ? match.pendingChoice.equipmentIds.map((id, index) => ({ id, source: "hand" as const, index })).filter((entry) => player.hand.includes(entry.id))
      : match.pendingChoice?.kind === "discard-draw" || match.pendingChoice?.kind === "discard-hand"
      ? player.hand.map((id, index) => ({ id, source: "hand" as const, index }))
      : match.pendingChoice?.kind === "deck-pick"
        ? match.pendingChoice.revealed.map((id, index) => ({ id, source: "deck" as const, index })).filter((entry) => cardMatchesDeckFilter(cardFor(entry.id), match.pendingChoice!.kind === "deck-pick" ? match.pendingChoice!.filter : "item"))
        : match.pendingChoice?.kind === "deck-order"
          ? match.pendingChoice.revealed.map((id, index) => ({ id, source: "deck" as const, index }))
          : match.pendingChoice?.kind === "ready-equipment"
            ? (player.exhaustedEquipment ?? []).filter((id) => player.equipment.includes(id)).map((id, index) => ({ id, source: "equipment" as const, index }))
            : match.pendingChoice?.kind === "stage3c-trail-mix" || match.pendingChoice?.kind === "stage3c-weapon-suppress" || match.pendingChoice?.kind === "stage3c-exhaust-focus"
              ? match.pendingChoice.equipmentIds.map((id, index) => ({ id, source: "equipment" as const, index }))
              : match.pendingChoice?.kind === "stage3c-discard-focus" || match.pendingChoice?.kind === "stage3c-reaction-discard"
                ? (match.pendingChoice.kind === "stage3c-reaction-discard" ? match.pendingChoice.reactionIds : player.hand).map((id, index) => ({ id, source: "hand" as const, index }))
                : match.pendingChoice?.kind === "stage3c-sparring-pick"
                  ? match.pendingChoice.revealed.map((id, index) => ({ id, source: "deck" as const, index })).filter((entry) => isAttack(cardFor(entry.id)!))
                  : match.pendingChoice?.kind === "stage3c-sparring-junk"
                    ? match.pendingChoice.junkIds.map((id, index) => ({ id, source: "discard" as const, index }))
                    : match.pendingChoice?.kind === "equipment-attack-response"
                      ? player.hand.map((id, index) => ({ id, source: "hand" as const, index }))
                    : [];
  const characterRuntimePending = characterRuntimePendingChoice(match.pendingChoice);
  const effectChoiceTitle = characterRuntimePending ? "Character ability"
    : match.pendingChoice?.kind === "stage3c-raffle" ? "Buy the raffle reveal?"
    : match.pendingChoice?.kind === "equipment-purchase-card" ? "File a purchase suggestion"
    : match.pendingChoice?.kind === "kata-equip-from-hand" ? "Choose Equipment to equip"
    : match.pendingChoice?.kind === "stage3c-lucky-reveal" ? "Use Lucky Dumpling?"
    : match.pendingChoice?.kind === "stage3c-zone-ward" ? "Call a protected zone"
    : match.pendingChoice?.kind === "stage3c-remove-negative" ? "Remove a temporary penalty"
    : match.pendingChoice?.kind === "stage3c-remove-status" ? "Remove a temporary status"
    : match.pendingChoice?.kind === "stage3c-trail-mix" ? "Exhaust Equipment to cycle?"
    : match.pendingChoice?.kind === "stage3c-discard-focus" ? "Discard for Focus"
    : match.pendingChoice?.kind === "stage3c-weapon-suppress" ? "Choose a Weapon"
    : match.pendingChoice?.kind === "stage3c-exhaust-focus" ? "Exhaust Equipment for Focus"
    : match.pendingChoice?.kind === "stage3c-sparring-pick" ? "Choose an Attack"
    : match.pendingChoice?.kind === "stage3c-sparring-junk" ? "Destroy revealed Junk?"
    : match.pendingChoice?.kind === "stage3c-reaction-discard" ? "Discard a Reaction"
    : match.pendingChoice?.kind === "air-horn-reaction" ? "Sound the Air Horn?"
    : match.pendingChoice?.kind === "destroy-junk" ? "Choose Junk to destroy"
    : match.pendingChoice?.kind === "discard-draw" ? "Discard to draw?"
      : match.pendingChoice?.kind === "discard-hand" ? "Choose what to discard"
        : match.pendingChoice?.kind === "deck-pick" ? "Choose from the revealed cards"
          : match.pendingChoice?.kind === "deck-order" ? "Set your draw order"
            : match.pendingChoice?.kind === "equipment-zone" ? "Commit your Equipment zone"
              : match.pendingChoice?.kind === "incoming-equipment-zone" ? "Call the incoming zone"
                : match.pendingChoice?.kind === "equipment-attack-response" ? "Answer the incoming Attack"
                : match.pendingChoice?.kind === "prevent-combat-damage" ? "Reduce this damage?"
                  : match.pendingChoice?.kind === "post-block-cycle" ? "Use post-Block Equipment?"
                    : match.pendingChoice?.kind === "ready-equipment" ? "Ready Equipment?" : "Resolve printed effect";
  const effectChoicePrompt = characterRuntimePending ? characterRuntimePending.choice.prompt
    : match.pendingChoice?.kind === "stage3c-raffle" ? `${cardFor(match.pendingChoice.revealedCardId)?.name ?? "The revealed card"} came off the Market deck. Buy it now or put it on the bottom.`
    : match.pendingChoice?.kind === "equipment-purchase-card" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "Your Equipment"} lets you put one card from your hand on the bottom of your deck. If you do, draw ${match.pendingChoice.nextInitiateDraw} at your next Initiate.`
    : match.pendingChoice?.kind === "stage3c-lucky-reveal" ? `${cardFor(match.pendingChoice.revealedCardId)?.name ?? "The revealed card"} was just revealed. Replace it from the same deck or keep it.`
    : match.pendingChoice?.kind === "stage3c-zone-ward" ? "Choose High, Mid, or Low. The next Attack in that zone targeting you this round gets -2 Attack Power."
    : match.pendingChoice?.kind === "stage3c-remove-negative" ? "Choose one currently active temporary -ATK, -DEF, or -Speed effect to remove."
    : match.pendingChoice?.kind === "stage3c-remove-status" ? "Choose one currently active temporary status to remove from your fighter."
    : match.pendingChoice?.kind === "stage3c-trail-mix" ? "You may exhaust one ready Equipment you control to draw 1, then discard 1."
    : match.pendingChoice?.kind === "stage3c-discard-focus" ? `Discard up to ${match.pendingChoice.remaining} more card${match.pendingChoice.remaining === 1 ? "" : "s"}; each is worth +${match.pendingChoice.focusPerDiscard} Focus.`
    : match.pendingChoice?.kind === "stage3c-weapon-suppress" ? "Choose one equipped Weapon. Its negative stat contribution is ignored until Hide."
    : match.pendingChoice?.kind === "stage3c-exhaust-focus" ? `Choose one ready Equipment to exhaust for +${match.pendingChoice.focus} Focus.`
    : match.pendingChoice?.kind === "stage3c-sparring-pick" ? "Choose one Attack among the top-three reveal; the rest are discarded."
    : match.pendingChoice?.kind === "stage3c-sparring-junk" ? "You may destroy one Junk that Sparring Dummy just discarded."
    : match.pendingChoice?.kind === "stage3c-reaction-discard" ? "Confetti Cannon requires you to choose one Reaction card from hand to discard."
    : match.pendingChoice?.kind === "air-horn-reaction" ? `${cardFor(match.pendingChoice.reactionCardId)?.name ?? "The computer Reaction"} was just played. Use Air Horn now to cancel it before the Dojo Stack resolves, or allow it to resolve normally.`
    : match.pendingChoice?.kind === "destroy-junk" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} requires ${match.pendingChoice.remaining} more Junk card${match.pendingChoice.remaining === 1 ? "" : "s"} from your hand or discard pile.`
    : match.pendingChoice?.kind === "discard-draw" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Attack"} lets you discard ${match.pendingChoice.remaining} card${match.pendingChoice.remaining === 1 ? "" : "s"} to draw ${match.pendingChoice.draw}. You may decline.`
      : match.pendingChoice?.kind === "discard-hand" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} requires ${match.pendingChoice.remaining} more discard${match.pendingChoice.remaining === 1 ? "" : "s"}. You choose the card.`
        : match.pendingChoice?.kind === "deck-pick" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} revealed ${match.pendingChoice.revealed.length} card${match.pendingChoice.revealed.length === 1 ? "" : "s"}. ${match.pendingChoice.optional ? "Take an eligible card or skip." : "Choose the eligible card to put into your hand."}`
          : match.pendingChoice?.kind === "deck-order" ? `Choose the card you want to draw ${match.pendingChoice.ordered.length ? `in position ${match.pendingChoice.ordered.length + 1}` : "first"}. ${match.pendingChoice.revealed.length} card${match.pendingChoice.revealed.length === 1 ? " remains" : "s remain"}.`
            : match.pendingChoice?.kind === "equipment-zone" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Equipment"} is exhausted. Choose High, Mid, or Low for its armed next-Attack effect.`
              : match.pendingChoice?.kind === "incoming-equipment-zone" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Equipment"} is exhausted. Call High, Mid, or Low against the declared ${match.pendingStrike?.zone ?? "incoming"} Attack.`
                : match.pendingChoice?.kind === "equipment-attack-response" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Equipment"} requires the defending player to discard 1 card before ${cardFor(match.pendingChoice.attackCardId)?.name ?? "the Attack"} can be defended. Quick Duel has no alternate legal target.`
                : match.pendingChoice?.kind === "prevent-combat-damage" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Equipment"} can exhaust now to reduce ${match.pendingChoice.damage} combat damage by ${match.pendingChoice.reduce}. Declining still consumes this round's first-damage timing window.`
                  : match.pendingChoice?.kind === "post-block-cycle" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Equipment"} triggered after the Block. Exhaust it to draw ${match.pendingChoice.draw}, then choose ${match.pendingChoice.discard} discard${match.pendingChoice.discard === 1 ? "" : "s"}, or decline and continue combat.`
                    : match.pendingChoice?.kind === "ready-equipment" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This effect"} can ready one exhausted Equipment card you control. You may decline.` : "Resolve the printed effect.";
  const effectChoiceCanSkip = Boolean(characterRuntimePending?.choice.optional) || match.pendingChoice?.kind === "equipment-purchase-card" || match.pendingChoice?.kind === "stage3c-trail-mix" || match.pendingChoice?.kind === "stage3c-discard-focus" || match.pendingChoice?.kind === "stage3c-sparring-junk" || (match.pendingChoice?.kind === "destroy-junk" && Boolean(match.pendingChoice.optional)) || match.pendingChoice?.kind === "prevent-combat-damage" || match.pendingChoice?.kind === "post-block-cycle" || match.pendingChoice?.kind === "discard-draw" || (match.pendingChoice?.kind === "deck-pick" && match.pendingChoice.optional) || (match.pendingChoice?.kind === "ready-equipment" && match.pendingChoice.optional);
  const inspectedBoard = inspected
    ? inspected.id === player.fighterId ? player : inspected.id === ai.fighterId ? ai : null
    : null;
  const learnedComboStates = player.learnedCombos.map((id) => {
    const combo = cardFor(id);
    if (!combo) return null;
    const evaluation = pendingAttack ? evaluateCombo(combo, {
      priorCards: player.cardsThisTurn.map(cardFor).filter(Boolean) as CardEntry[],
      attacksThisTurn: player.attacksThisTurn,
      defendedThisRound: player.defendedThisRound,
      hitThisTurn: player.hitThisTurn,
      zonesPlayed: player.zonesPlayed,
      equipment: player.equipment.map(cardFor).filter(Boolean) as CardEntry[],
      currentCard: pendingAttack,
      currentZone: match.selectedZone,
      isReversal: match.phase === "reversal-window",
    }) : null;
    return { combo, evaluation, triggered: player.triggeredCombos.includes(id) };
  }).filter(Boolean) as { combo: CardEntry; evaluation: ReturnType<typeof evaluateCombo> | null; triggered: boolean }[];
  const affordableNow = match.market.filter((id, index) => {
    const card = cardFor(id);
    return Boolean(card && marketFocusAvailable(player, card) >= marketPriceFor(player, card, index === match.market.length - 1));
  }).length;
  const ascendStepIndex = deskView === "belt" ? 1 : 0;
  const ascendStepTitle = deskView === "combo" ? "Combo Docket" : deskView === "belt" ? "Belt Check" : "Acquisition Desk";
  const ascendStepHelp = deskView === "combo"
    ? "Review the face-up Combo. Learn it if you can and want it, or pass it to the bottom of the docket. Then check your Belt."
    : deskView === "belt"
      ? "Check your XP and Belt Exam requirement. If eligible, choose either promotion or Training Stripe recovery; taking either uses this turn's Belt Check action."
      : "Spend Focus on Market cards and decide the face-up Combo from the same desk. Then continue to your Belt Check.";
  const ascendNextLabel = deskView === "belt" ? "Finish Ascend → Hide" : "Continue to Belt Check →";
  const turnCoach = match.winner
    ? (match.winner === "player" ? "The opponent is folded. Enjoy the extremely temporary paperwork-based glory." : "This test is over, but the Department has approved an immediate and emotionally reckless rematch.")
    : match.phase === "player-initiate"
      ? (player.hand.some((id) => { const card = cardFor(id); return Boolean(card && isPermanent(card) && equipmentHandLimit(player.equipment, card, cardFor).allowed); }) ? "Equip any legal permanent Equipment you want before Yell. Weapons must fit your two available Hands. Each legal Equip generates its printed Focus." : "No legal permanent Equipment is waiting in hand. Finish Initiate and proceed directly to the yelling.")
    : match.phase === "player-yell"
      ? (pendingAttack ? `You selected ${pendingAttack.name}. Confirm its zone, then declare the Attack.` : !player.badHabitFocusUsed && player.hand.some((id) => cardFor(id)?.catalogId === gameDefinition.economy.badHabitFocus.catalogId) ? "Discard one Bad Habit this turn for +1 Focus. It goes straight to your discard pile." : !player.defensePracticeUsed && player.hand.some((id) => isDefense(cardFor(id)!)) ? "Use one Defense for Defense Practice to gain its printed Focus without playing its Guard or rules text." : player.hand.some((id) => isAttack(cardFor(id)!)) ? "Play support cards for Focus or select any legal Attack remaining in your hand." : "Your useful cards are spent. Move to Ascend and turn that Focus into a better deck.")
      : match.phase === "player-ascend"
        ? (deskView === "combo" ? "Ascend step 1: inspect the Combo offer. Learning is optional; your remaining Focus can still buy it." : deskView === "belt" ? (canPromote ? `Ascend step 2: your ${nextBelt?.name} Belt certification is ready. Promote before Hide if you want the reward now.` : "Ascend step 2: review your XP and exam progress. After this check, Hide ends the turn and clears unspent Focus.") : `Ascend step 1: shop the Market with ${player.focus} Focus and decide the face-up Combo from this same desk.`)
      : match.phase === "defense-window"
          ? (defenseOptions.length ? `A ${match.pendingStrike?.zone} Attack is incoming. Play a glowing matching Defense or pass.` : "No matching Defense is in hand. Base DEF still applies; pass the Reaction Window to resolve the hit.")
          : match.phase === "reversal-window"
            ? "You Blocked with a Defense card. Choose one Attack from your hand for a free counterattack, or decline the Reversal. It earns XP but no printed Focus."
          : "The computer has initiative. Run its turn when you are ready to discover what it thinks strategy means.";

  const winnerFighter = match.winner === "ai" ? aiFighter : playerFighter;
  const winnerArt = artistUrl(winnerFighter);
  const phaseActionDock = !match.winner && <nav className={`playtest-action-dock dock-${match.phase}`} aria-label="Next legal action">
    <div>
      <span>{match.pendingDiscard ? "DISCARD" : match.phase === "player-initiate" ? "INITIATE" : match.phase === "player-yell" ? "YELL" : match.phase === "player-ascend" ? "ASCEND" : match.phase === "defense-window" ? "REACTION" : match.phase === "reversal-window" ? "REVERSAL" : "OPPONENT"}</span>
      <b>{match.pendingDiscard ? "Choose a card from your hand" : match.phase === "player-initiate" ? "Equipment first" : match.phase === "player-yell" ? pendingAttack ? `${pendingAttack.name} selected` : `${player.attacksThisTurn} attack${player.attacksThisTurn === 1 ? "" : "s"} played · no cap` : match.phase === "player-ascend" ? `${player.focus} Focus · Market + Combo → Belt` : match.phase === "defense-window" ? `${match.pendingStrike?.zone} strike incoming` : match.phase === "reversal-window" ? pendingAttack ? `${pendingAttack.name} ready` : "Choose an Attack" : settings.autoAi ? "Clipboard thinking…" : "Computer is waiting"}</b>
    </div>
    {match.phase === "player-initiate" && <button onClick={beginYell}>Proceed to Yell →</button>}
    {match.phase === "player-yell" && !match.pendingDiscard && <div className="dock-action-group">{pendingAttack && <button onClick={declareAttack}>Declare Attack →</button>}<button className={pendingAttack ? "dock-secondary" : ""} onClick={enterAscend}>{pendingAttack ? "Skip selected card · Ascend" : "Proceed to Ascend →"}</button></div>}
    {match.phase === "player-ascend" && <button onClick={() => setDeskView(deskView ?? "market")}>{deskView === "belt" ? "Resume Belt Check" : deskView === "combo" ? "Resume Combo Review" : "Resume Ascend Review"} →</button>}
    {match.phase === "defense-window" && !match.pendingChoice && <button onClick={() => resolveDefense(null)}>Pass Reaction</button>}
    {match.phase === "reversal-window" && <div className="dock-action-group">{pendingAttack && <button onClick={resolveReversal}>Launch Reversal →</button>}<button className={pendingAttack ? "dock-secondary" : ""} onClick={declineReversal}>Decline Reversal</button></div>}
    {match.phase === "ai-ready" && !settings.autoAi && <button onClick={runAiTurn}>Run computer turn →</button>}
  </nav>;

  return <main className={`playtest-shell playtest-shell--live location-${locationTheme(currentLocation)} motion-${settings.motion} ${settings.guided ? "playtest-shell--guided" : ""} ${match.winner ? "playtest-shell--finished" : ""} shell`}><MobilePlaytestNotice />
    <header className="playtest-topbar battle-versus-hud">
      <div className="battle-hud-fighter battle-hud-fighter--player">
        <span>YOU · {belts[player.belt].name} BELT</span><b>{playerFighter.name}</b>
        <div><strong>{player.hp}<small> / {player.maxHp} HP</small></strong><i role="progressbar" aria-label={`${playerFighter.name} health`} aria-valuemin={0} aria-valuemax={player.maxHp} aria-valuenow={player.hp}><em style={{ width: `${Math.max(0, Math.min(100, player.hp / player.maxHp * 100))}%` }} /></i></div>
      </div>
      <div className="versus-center" aria-label={`Round ${match.round}`}><span>ROUND</span><b>{match.round}</b></div>
      <div className="battle-hud-fighter battle-hud-fighter--ai">
        <span>COMPUTER · {belts[ai.belt].name} BELT</span><b>{aiFighter.name}</b>
        <div><strong>{ai.hp}<small> / {ai.maxHp} HP</small></strong><i role="progressbar" aria-label={`${aiFighter.name} health`} aria-valuemin={0} aria-valuemax={ai.maxHp} aria-valuenow={ai.hp}><em style={{ width: `${Math.max(0, Math.min(100, ai.hp / ai.maxHp * 100))}%` }} /></i></div>
      </div>
    </header>
    {match.winner && <section className={`match-result paper-stack ${match.winner === "player" ? "is-victory" : "is-defeat"}`}>
      {match.winner === "player" && <div className="victory-confetti" aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <i style={{ left: `${(index * 37) % 100}%`, animationDelay: `${(index % 8) * .11}s`, animationDuration: `${2.45 + (index % 5) * .2}s` }} key={index} />)}</div>}
      <div className="victory-certificate">
        <div className="victory-stamp"><span>{match.winner === "player" ? "VICTORY" : "CLOSED"}</span><b>{match.winner === "player" ? "CERTIFIED" : "FIELD TEST"}</b></div>
        <div className="victory-fighter">
          <div className="victory-art-frame">{winnerArt ? <img src={winnerArt} alt={winnerFighter.name} /> : <NativeCardArt card={winnerFighter} />}<span>{match.winner === "player" ? "OFFICIAL WINNER" : "OFFICIAL PROBLEM"}</span></div>
          <div className="victory-copy"><span className="eyebrow">Department of Questionably Regulated Martial Arts</span><h2>{match.winner === "player" ? `${winnerFighter.name} remains standing!` : `${winnerFighter.name} wins the field test.`}</h2><p>{match.winner === "player" ? "Confetti has been authorized, the clipboard has been impressed against its will, and your victory has been filed in triplicate." : "The result has been stamped, disputed, and filed beneath a suspicious vending-machine receipt. An immediate rematch remains irresponsibly available."}</p><strong>{match.winner === "player" ? "CERTIFICATE OF EXCESSIVE COMPETENCE" : "NOTICE OF TEMPORARY MARTIAL INCONVENIENCE"}</strong></div>
        </div>
        <div className="match-report"><b>{match.round}<small>ROUNDS</small></b><b>{player.damageDealt}<small>DAMAGE DEALT</small></b><b>{player.cardsBought}<small>CARDS BOUGHT</small></b><b>{player.learnedCombos.length}<small>COMBOS LEARNED</small></b></div>
        <div className="victory-certificate-footer"><div className="victory-signature"><span>Certified by</span><b>Assistant Deputy Sensei, Filing Division</b><small>No one verified this signature.</small></div><div className="match-result-actions"><button className="button primary" onClick={() => begin(player.fighterId)}>Instant rematch →</button><button className="button ghost" onClick={() => setMatch(null)}>Choose another fighter</button></div></div>
      </div>
    </section>}
    <section className="playtest-arena">{settings.houseRuleIds.length > 0 && <div className="playtest-active-variants"><b>House rules active:</b>{QUICK_DUEL_HOUSE_RULES.filter((rule) => settings.houseRuleIds.includes(rule.id)).map((rule) => <span key={rule.id}>{rule.name}</span>)}</div>}
      <section className="playtest-table">
        <div className="fighter-column fighter-column--player"><FighterPanel board={player} label="You" beltThresholds={beltThresholds} onInspect={(card) => setInspectedId(card.id)} onOpenCombo={() => setDeskView("combo")} /><LearnedComboRack states={learnedComboStates} onInspect={(card) => setInspectedId(card.id)} /></div>
        <div className="combat-stage-column">
          <CombatStage match={match} currentLocation={currentLocation} selectedAttack={pendingAttack} turnCoach={turnCoach} guided={settings.guided} playerCards={player.playArea} aiCards={ai.playArea} onInspect={(card) => setInspectedId(card.id)} onDropCard={useHandCard} onOpenCoach={() => setCoachOpen(true)} />
          {match.phase === "ai-ready" && !match.winner && !settings.autoAi && <button className="button primary run-opponent-turn" onClick={runAiTurn}>Run computer turn →</button>}
          {match.phase === "ai-ready" && !match.winner && settings.autoAi && <span className="ai-thinking"><i /><i /><i /> Clipboard thinking</span>}
        </div>
        <div className="fighter-column fighter-column--enemy"><FighterPanel board={ai} label="Computer" enemy beltThresholds={beltThresholds} onInspect={(card) => setInspectedId(card.id)} /></div>
      </section>
    </section>
    <section className="playtest-workspace playtest-workspace--hand">
      <section className="hand-panel paper-stack">
        <header><div><span className="eyebrow">Your hand · {player.hand.length} cards</span><h2>{match.pendingChoice ? "Resolve the Equipment decision" : match.pendingDiscard ? `Choose ${match.pendingDiscard.remaining} card to discard` : match.phase === "player-initiate" ? "Equip before the yelling starts" : match.phase === "defense-window" ? `Defend ${match.pendingStrike?.zone} or let it land` : match.phase === "reversal-window" ? "Return the favor immediately" : "Choose your next card"}</h2></div><div className="hand-counters"><span>Deck {player.deck.length}</span><span>Discard {player.discard.length}</span><span>Attacks played {player.attacksThisTurn}</span><span>Flow {player.flowUsedThisTurn ? "used" : "ready"}</span><span>Practice {player.defensePracticeUsed ? "used" : "ready"}</span><span>Habit {player.badHabitFocusUsed ? "used" : "ready"}</span></div>{phaseActionDock}</header>
        {match.pendingDiscard && <div className="discard-choice-notice" role="status"><b>{cardFor(match.pendingDiscard.sourceCardId)?.name}</b><span>Select the card you want to discard. The engine will not choose for you.</span></div>}
        {equipmentReactions.length > 0 && <div className="equipment-reaction-strip" aria-label="Available Equipment reactions"><span>Equipment reactions</span>{equipmentReactions.map((item) => <button type="button" disabled={Boolean(match.pendingChoice)} onClick={() => activateEquipment(item.id)} key={item.id}><b>Exhaust {item.name}</b><small>{equipmentActivationSummary(item)}</small></button>)}</div>}
        {equipmentActions.length > 0 && <div className="equipment-reaction-strip equipment-trigger-strip" aria-label="Available Equipment actions"><span>Equipment actions</span>{equipmentActions.map((item) => <button type="button" disabled={Boolean(match.pendingChoice)} onClick={() => activateEquipment(item.id)} key={item.id}><b>Exhaust {item.name}</b><small>{equipmentActivationSummary(item)}</small></button>)}</div>}
        <div className="play-card-row">{player.hand.map((id, index) => {
          const card = cardFor(id); if (!card) return null;
          const attack = isAttack(card);
          const defense = isDefense(card);
          const permanent = isPermanent(card);
          const choosingDiscard = Boolean(match.pendingDiscard);
          const choosingEffect = Boolean(match.pendingChoice);
          const canInitiate = match.phase === "player-initiate" && permanent && publishQuickDuelPlaytestEquip(match, "player", card).allowed;
          const attackAllowed = !stage3cRestrictionBlocks(player.stage3cRestrictions, "attack");
          const consumableAllowed = !isCoreConsumableCard(card) || (!stage3cRestrictionBlocks(player.stage3cRestrictions, "consumable") && canPlayCoreConsumableInPhase(card, "player-yell", stage3cConsumableContext(player)));
          const reactionAllowed = !isCoreReactionItemCard(card);
          const canUse = match.phase === "player-yell" && (attack ? attackAllowed : (defense ? !player.defensePracticeUsed : !permanent && consumableAllowed && reactionAllowed));
          const canDefend = match.phase === "defense-window" && defenseOptions.includes(id);
          const canReactConsumable = match.phase === "defense-window" && isCoreConsumableCard(card) && !stage3cRestrictionBlocks(player.stage3cRestrictions, "consumable") && canPlayCoreConsumableInPhase(card, "defense-window", stage3cConsumableContext(player));
          const canReactItem = isCoreReactionItemCard(card) && (
            match.phase === "defense-window" && Boolean(match.pendingStrike) && (
              canPlayCoreReactionItem(card, "onAttackDeclared", reactionItemContext(match.pendingStrike!.zone, match.ai, true))
              || canPlayCoreReactionItem(card, "onPlay", { ...reactionItemContext(match.pendingStrike!.zone, match.ai, true), defenseOutsideTurn: Boolean(match.player.offTurnConsumablePlayed) })
              || canPlayCoreReactionItem(card, "onDefenseDeclared", reactionItemContext(match.pendingStrike!.zone, match.ai, true))
            )
            || match.phase === "reversal-window" && canPlayCoreReactionItem(card, "onBlock", { sameOpponentAsBlockedAttack: true })
          );
          const canReverse = match.phase === "reversal-window" && attack && attackAllowed;
          return <PlayCard key={`${id}-${index}`} card={card} selected={match.selectedAttackId === id} disabled={choosingEffect ? true : choosingDiscard ? false : match.phase === "defense-window" ? !(canDefend || canReactConsumable || canReactItem) : match.phase === "reversal-window" ? !canReverse : match.phase === "player-initiate" ? !canInitiate : !canUse} onClick={() => useHandCard(id)} onInspect={() => setInspectedId(id)} />;
        })}</div>
        {match.phase === "reversal-window" && pendingAttack?.zone?.includes("Any") && <div className="hand-context-strip"><span>Choose reversal zone</span><fieldset className="zone-picker"><legend className="sr-only">Reversal zone</legend>{["High", "Mid", "Low"].map((zone) => <button type="button" className={match.selectedZone === zone ? "is-selected" : ""} onClick={() => setMatch((current) => current ? { ...current, selectedZone: zone } : current)} key={zone}>{zone}</button>)}</fieldset></div>}
        {match.phase === "player-yell" && !match.pendingDiscard && pendingAttack && attackHasFlexibleZone(player, pendingAttack) && <div className="hand-context-strip"><span>Declare zone for {pendingAttack.name}</span><fieldset className="zone-picker"><legend className="sr-only">Attack zone</legend>{["High", "Mid", "Low"].map((zone) => <button type="button" className={match.selectedZone === zone ? "is-selected" : ""} onClick={() => setMatch((current) => current ? { ...current, selectedZone: zone } : current)} key={zone}>{zone}</button>)}</fieldset></div>}
      </section>
    </section>
    <footer className="playtest-utility-dock" aria-label="Quick Duel utilities">
      <div className="playtest-utility-group"><button type="button" className={`utility-coach ${settings.guided ? "" : "is-off"}`} onClick={() => { if (!settings.guided) setSettings({ ...settings, guided: true }); setCoachOpen(true); }}>{settings.guided ? "Decision Coach" : "Coach Off · Re-enable"}</button><button type="button" onClick={() => setLogOpen(true)}>Fight Log <b>{match.log.length}</b></button><label className="utility-motion"><span>Motion</span><select value={settings.motion} onChange={(event) => setSettings({ ...settings, motion: event.target.value as MotionMode })}><option value="full">Full</option><option value="reduced">Reduced</option><option value="off">Off</option></select></label></div>
      <div className="playtest-utility-group playtest-utility-group--nav"><span className={`rules-sync rules-sync--${rulesSync.status}`}>{rulesSync.status === "update-available" ? `Rules ${rulesSync.latestVersion} ready` : rulesSync.status === "offline" ? "Rules offline" : "Rules synced"}</span>{rulesSync.status === "update-available" && <button onClick={() => window.location.reload()}>Reload</button>}<button onClick={() => setMatch(null)}>New Duel</button><button onClick={() => goTo("rules")}>Rules</button><button onClick={() => goTo("cards")}>Cards</button></div>
    </footer>
    {deskView && <div className="ascend-desk-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDeskView(null)}>
      <section className={`ascend-desk paper-stack ${match.phase === "player-ascend" ? "ascend-desk--functional" : ""}`} role="dialog" aria-modal="true" aria-labelledby="ascend-desk-title">
        <header className="ascend-desk-header">
          <div><span className="eyebrow">{match.phase === "player-ascend" ? `Ascend review · step ${ascendStepIndex + 1} of 2` : "Reference desk · inspection only"}</span><h2 id="ascend-desk-title">{ascendStepTitle}</h2><p>{match.phase === "player-ascend" ? ascendStepHelp : "Inspect this station without advancing the turn."}</p></div>
          <div className="ascend-desk-balance"><span>Available Focus</span><b>{player.focus}</b><small>{affordableNow} of {match.market.length} Market cards in reach</small></div>
          <button className="modal-close" onClick={() => setDeskView(null)} aria-label="Close Ascend Desk">×</button>
        </header>
        {match.phase === "player-ascend" && <section className="ascend-guide" aria-label="Ascend review path">
          <div className="ascend-guide-kicker"><span>Do these in order</span><b>Acquire → Belt → Hide</b></div>
          <ol>
            <li className={ascendStepIndex === 0 ? "is-current" : "is-complete"} aria-current={ascendStepIndex === 0 ? "step" : undefined}><b>1</b><div><span>Acquisition Desk</span><small>Market + Combo decisions</small></div></li>
            <li className={ascendStepIndex === 1 ? "is-current" : ""} aria-current={ascendStepIndex === 1 ? "step" : undefined}><b>2</b><div><span>Belt Check</span><small>XP + exam + reward</small></div></li>
            <li><b>3</b><div><span>Hide</span><small>Clear Focus · redraw</small></div></li>
          </ol>
        </section>}
        <div className="ascend-desk-body">
          {match.phase === "player-ascend" && <aside className={`ascend-step-coach step-${ascendStepIndex + 1}`}><b>STEP {ascendStepIndex + 1}</b><span>{ascendStepHelp}</span></aside>}
          {deskView === "market" && <section className="ascend-market" aria-label="Seven-card Shared Market">
            <header><div><span className="eyebrow">Seven live records · full cards</span><h3>Choose with the text visible</h3></div><p>{match.phase === "player-ascend" ? "Buy any number you can afford. Each purchase is replaced immediately by the top Market card." : "The row persists between rounds. If nobody buys for a full round, Market Mercy refreshes all seven cards."}</p></header>
            {match.phase === "player-ascend" && comboOffer && <FeaturedComboPanel card={comboOffer} focus={player.focus} discount={qualifiedNextComboLearnDiscount(player.stage3cStatuses).amount} learnedCount={player.learnedCombos.length} attempted={player.comboAttemptedTurn} onLearn={() => cycleCombo(true)} onPass={() => cycleCombo(false)} onContinue={() => setDeskView("belt")} onInspect={() => setInspectedId(comboOffer.id)} />}
            <div className="ascend-market-grid">{match.market.map((id, index) => { const card = cardFor(id); if (!card) return null; const affordable = marketFocusAvailable(player, card) >= marketPriceFor(player, card, index === match.market.length - 1); return <PlayCard key={id} card={card} selected={match.phase === "player-ascend" && affordable} disabled={match.phase !== "player-ascend" || !affordable} onClick={() => buyMarket(id)} onInspect={() => setInspectedId(id)} />; })}</div>
          </section>}
          {deskView === "combo" && <section className="ascend-combo combo-panel">
            <p className="combo-digital-note"><b>Learned Combos stay face up beside your fighter.</b> During Yell, the live Combo rack shows the printed requirement and previews whether your selected Attack will complete it. Supported payoffs fire automatically; anything not yet automated is labeled instead of being silently faked.</p>
            <header><div><span className="eyebrow">One face-up offer · one attempt per turn</span><h3>{player.learnedCombos.length ? `${player.learnedCombos.length}/2 learned` : "Reveal. Learn. Regret."}</h3></div><span className="combo-limit">{player.comboAttemptedTurn ? "Attempt filed" : "Ready"}</span></header>
            {comboOffer ? <div className="combo-offer"><NativeCardArt card={comboOffer} /><div><span>{comboOffer.catalogId}</span><h3>{comboOffer.name}</h3><p>{comboOffer.rulesText}</p><div><b>{cardCost(comboOffer)} Focus</b><button onClick={() => setInspectedId(comboOffer.id)}>Inspect full card</button></div></div></div> : <p>The Combo docket has escaped the filing cabinet.</p>}
            {match.phase === "player-ascend" && comboOffer && !player.comboAttemptedTurn && <div className="combo-actions"><button className="button primary" disabled={player.focus < Math.max(0, cardCost(comboOffer) - qualifiedNextComboLearnDiscount(player.stage3cStatuses).amount) || player.learnedCombos.length >= 2} onClick={() => cycleCombo(true)}>Learn {comboOffer.name}</button><button className="button ghost" onClick={() => cycleCombo(false)}>Pass · bottom deck</button></div>}
            {match.phase !== "player-ascend" && <p className="combo-spent">Combo actions unlock during Ascend.</p>}
            {player.comboAttemptedTurn && <p className="combo-spent">Combo attempt filed for this turn.</p>}
            {player.learnedCombos.length > 0 && <div className="learned-combos">{player.learnedCombos.map((id) => { const learned = cardFor(id); if (!learned) return null; return <button key={id} onClick={() => setInspectedId(id)}><span>∞</span><b>{learned.name}</b><small>{player.triggeredCombos.includes(id) ? "Triggered this round" : "Face up · watches automatically"}</small><small className="combo-requirement-mini">Requirement: {comboRequirementText(learned)}</small><small className="combo-requirement-mini">Payoff: {comboPayoffText(learned)}</small></button>; })}</div>}
          </section>}
          {deskView === "belt" && <section className="ascend-belt belt-panel">
            <span className="eyebrow">Certification ledger</span><h3>{belts[player.belt].name} Belt · {player.xp} XP</h3>
            <p>{nextBelt ? <><b>Next: {nextBelt.name} · {nextBeltXp} XP.</b> {nextBelt.exam.summary} <em>{nextBelt.reward.summary}</em></> : "Every available Belt has been certified."}</p>
            <div className="belt-track">{belts.map((belt, index) => <span className={index <= player.belt ? "earned" : ""} key={belt.name} style={{ "--belt-rank": belt.color } as CSSProperties} title={`${belt.name} Belt · ${beltThresholds[index]} XP · ${belt.exam.title}`}>{belt.name.slice(0, 1)}</span>)}</div>
            <div className="belt-ledger-list">{belts.map((belt, index) => <article className={index === player.belt ? "is-current" : index < player.belt ? "is-earned" : ""} key={belt.name} style={{ "--belt-rank": belt.color } as CSSProperties}><span>{index < player.belt ? "✓" : index === player.belt ? "●" : index + 1}</span><div><b>{belt.name} Belt · {belt.exam.title}</b><small>{beltThresholds[index]} XP · {belt.exam.summary}</small><small>{belt.reward.summary}</small></div></article>)}</div>
            {nextBelt && <button className="button primary" disabled={match.phase !== "player-ascend" || !canPromote} onClick={promote}>{canPromote && match.phase === "player-ascend" ? `Promote to ${nextBelt.name} →` : match.phase !== "player-ascend" ? "Promotion opens during Ascend" : !promotionAction.canUse ? "Belt Check action used · promotion next turn" : `${nextBelt.name}: ${nextBeltXp} XP + completed task`}</button>}
          </section>}
        </div>
        <footer className="ascend-desk-footer"><details><summary>Recent fight filings</summary><ol>{match.log.slice(0, 6).map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}</ol></details>{match.phase === "player-ascend" && <div className="ascend-guide-actions">{deskView === "belt" && <button className="button ghost" onClick={() => setDeskView("market")}>← Previous review</button>}<div><small>{deskView === "belt" ? "Last stop. Hide clears any unspent Focus." : "Next: check Belt progress."}</small><button className="button primary ascend-next" onClick={advanceAscendReview}>{ascendNextLabel}</button></div></div>}</footer>
      </section>
    </div>}
    {match.pendingChoice && <div className="playtest-inspector-backdrop effect-choice-backdrop"><section className="effect-choice-dialog paper-stack" role="dialog" aria-modal="true" aria-labelledby="effect-choice-title"><span className="eyebrow">Printed effect · your decision</span><h2 id="effect-choice-title">{effectChoiceTitle}</h2><p>{effectChoicePrompt}</p><div className="effect-choice-options">{characterRuntimePending ? characterRuntimePending.choice.options.filter((option) => !["skip", "decline", "cancel"].includes(option)).map((option) => { const optionCard = cardFor(option); return <button type="button" onClick={() => resolveCharacterRuntimeChoice(option)} key={option}><span>CHARACTER ABILITY</span><b>{optionCard?.name ?? option}</b><small>{optionCard ? `${optionCard.catalogId} · ${optionCard.subtype || optionCard.cardType}` : "Resolve this option"}</small></button>; }) : match.pendingChoice?.kind === "stage3c-raffle" ? <><button type="button" onClick={() => resolveStage3CRaffle(true)}><span>BUY</span><b>{cardFor(match.pendingChoice.revealedCardId)?.name}</b><small>Pay {marketPriceFor(player, cardFor(match.pendingChoice.revealedCardId))} Focus</small></button><button type="button" onClick={() => resolveStage3CRaffle(false)}><span>PASS</span><b>PUT ON BOTTOM</b><small>Do not buy the reveal</small></button></> : match.pendingChoice?.kind === "stage3c-lucky-reveal" ? <><button type="button" onClick={() => resolveStage3CLucky(true)}><span>REACTION</span><b>USE LUCKY DUMPLING</b><small>Discard the reveal and replace it</small></button><button type="button" onClick={() => resolveStage3CLucky(false)}><span>PASS</span><b>KEEP REVEAL</b><small>Save Lucky Dumpling</small></button></> : match.pendingChoice?.kind === "stage3c-zone-ward" ? ["High", "Mid", "Low"].map((zone) => <button type="button" onClick={() => resolveStage3CZoneWard(zone)} key={zone}><span>PROTECT ZONE</span><b>{zone}</b><small>Next matching Attack gets -2 Power</small></button>) : match.pendingChoice?.kind === "stage3c-remove-negative" ? match.pendingChoice.stats.map((stat) => <button type="button" onClick={() => resolveStage3CNegative(stat)} key={stat}><span>REMOVE PENALTY</span><b>-{stat}</b><small>Remove one active temporary penalty</small></button>) : match.pendingChoice?.kind === "stage3c-remove-status" ? match.pendingChoice.statusIds.map((sourceEffectId) => { const status = player.stage3cStatuses?.find((candidate) => candidate.sourceEffectId === sourceEffectId); return <button type="button" onClick={() => resolveStage3CStatusRemoval(sourceEffectId)} key={sourceEffectId}><span>REMOVE STATUS</span><b>{status?.resolver ?? status?.effect ?? "Temporary status"}</b><small>{status ? `${status.effect}${status.amount ? ` ${status.amount > 0 ? "+" : ""}${status.amount}` : ""} · ${status.duration}` : sourceEffectId}</small></button>; }) : match.pendingChoice?.kind === "air-horn-reaction" ? <><button type="button" onClick={() => resolvePlayerAirHornChoice(true)}><span>REACTION</span><b>USE AIR HORN</b><small>Cancel {cardFor(match.pendingChoice.reactionCardId)?.name ?? "the Reaction"} before it resolves</small></button><button type="button" onClick={() => resolvePlayerAirHornChoice(false)}><span>PASS</span><b>ALLOW REACTION</b><small>Keep Air Horn in hand and resolve the announced Reaction</small></button></> : match.pendingChoice?.kind === "prevent-combat-damage" ? <button type="button" onClick={usePendingEquipmentChoice}><span>EXHAUST EQUIPMENT</span><b>Reduce damage</b><small>{match.pendingChoice.damage} → {Math.max(0, match.pendingChoice.damage - match.pendingChoice.reduce)} combat damage</small></button> : match.pendingChoice?.kind === "post-block-cycle" ? <button type="button" onClick={usePendingEquipmentChoice}><span>EXHAUST EQUIPMENT</span><b>Draw {match.pendingChoice.draw}</b><small>Then choose {match.pendingChoice.discard} discard{match.pendingChoice.discard === 1 ? "" : "s"}</small></button> : match.pendingChoice?.kind === "equipment-zone" ? ["High", "Mid", "Low"].map((zone) => <button type="button" onClick={() => chooseEquipmentZone(zone)} key={zone}><span>COMMIT ZONE</span><b>{zone}</b><small>Applies to the next Attack only</small></button>) : match.pendingChoice?.kind === "incoming-equipment-zone" ? ["High", "Mid", "Low"].map((zone) => <button type="button" onClick={() => chooseIncomingEquipmentZone(zone)} key={zone}><span>CALL ZONE</span><b>{zone}</b><small>{zone === match.pendingStrike?.zone ? "Matches the declared Attack" : "Does not match the declared Attack"}</small></button>) : pendingChoiceOptions.map((entry) => { const option = cardFor(entry.id); if (!option) return null; return <button type="button" onClick={() => resolvePendingChoice(entry.id, entry.source)} key={`${entry.source}-${entry.id}-${entry.index}`}><span>{entry.source === "discard" ? "DISCARD PILE" : entry.source === "deck" ? "REVEALED" : entry.source === "equipment" ? "EQUIPMENT" : "HAND"}</span><b>{option.name}</b><small>{option.catalogId} · {option.subtype || option.cardType}</small></button>; })}</div>{effectChoiceCanSkip && <footer><button className="button ghost" onClick={skipPendingChoice}>Skip this optional effect</button></footer>}</section></div>}
    {coachOpen && !match.winner && <div className="playtest-inspector-backdrop coach-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCoachOpen(false)}><section className="coach-dialog paper-stack" role="dialog" aria-modal="true" aria-labelledby="coach-dialog-title"><button className="modal-close" onClick={() => setCoachOpen(false)} aria-label="Close Decision Coach">×</button><span className="eyebrow">Decision coach · optional guidance</span><h2 id="coach-dialog-title">What should I do now?</h2><div className={`turn-coach turn-coach--${match.phase}`} aria-live="polite"><span>Recommended next step</span><p>{turnCoach}</p></div><div className="coach-dialog-actions"><button className="button primary" onClick={() => setCoachOpen(false)}>Back to the mat →</button><button className="button ghost" onClick={() => { setSettings({ ...settings, guided: false }); setCoachOpen(false); }}>Turn coach off</button></div><small>You can re-enable the Coach from the utility bar at any time.</small></section></div>}
    {logOpen && <div className="playtest-inspector-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setLogOpen(false)}><section className="fight-log-dialog paper-stack" role="dialog" aria-modal="true" aria-labelledby="fight-log-title"><button className="modal-close" onClick={() => setLogOpen(false)} aria-label="Close Fight Log">×</button><span className="eyebrow">Department combat archive</span><h2 id="fight-log-title">Fight Log</h2><p>Newest filing first. Nobody has checked the handwriting.</p><div className="fight-log-groups">{groupedFightLog(match.log).map((group, groupIndex) => <section key={`${group.label}-${groupIndex}`}><h3>{group.label}</h3><ol>{group.lines.map((line, index) => <li key={`${line}-${index}`}><b>{group.lines.length - index}</b><span>{line}</span></li>)}</ol></section>)}</div></section></div>}
    {inspected && inspectedBoard && <div className="playtest-inspector-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setInspectedId(null)}>
      <article className={`playtest-inspector paper-stack ${inspectorZoomed ? "is-zoomed" : ""} ${inspectedBoard ? "is-fighter-dossier" : ""}`} role="dialog" aria-modal="true" aria-labelledby="playtest-inspector-title">
        <button className="modal-close" onClick={() => setInspectedId(null)} aria-label="Close Card Inspector">×</button>
        <div className="inspector-heading">
          <button type="button" className="inspector-card-visual" onClick={() => setInspectorZoomed((current) => !current)} aria-label={`${inspectorZoomed ? "Reduce" : "Magnify"} ${inspected.name}`}>
            {artistUrl(inspected) ? <img src={artistUrl(inspected)} alt={inspected.name} /> : <NativeCardArt card={inspected} />}
            <span>{inspectorZoomed ? "Return to dossier" : "Click card to zoom"}</span>
          </button>
          <div className="inspector-copy"><span className="eyebrow">{inspected.catalogId} · {inspected.cardType} · {inspected.subtype}</span><h2 id="playtest-inspector-title">{inspected.name}</h2><p>{inspected.flavorText}</p></div>
        </div>
        {inspectedBoard ? <dl className="fighter-inspector-stats">
          <div><dt>ATK</dt><dd>{fighterStat(inspectedBoard, "ATK")}</dd></div><div><dt>DEF</dt><dd>{fighterStat(inspectedBoard, "DEF")}</dd></div><div><dt>SPD</dt><dd>{fighterStat(inspectedBoard, "Speed")}</dd></div><div><dt>XP</dt><dd>{inspectedBoard.xp}</dd></div><div><dt>Focus</dt><dd>{inspectedBoard.focus}</dd></div><div><dt>Belt</dt><dd>{belts[inspectedBoard.belt].name}</dd></div>
        </dl> : <dl><div><dt>Focus Cost</dt><dd>{inspected.fpCost ?? "—"}</dd></div><div><dt>Focus Value</dt><dd>{inspected.focusValue ?? "—"}</dd></div><div><dt>Zone</dt><dd>{inspected.zone ?? "—"}</dd></div><div><dt>Timing</dt><dd>{inspected.timing ?? "—"}</dd></div></dl>}
        <section className="inspector-rules"><span>Printed rules text</span><p>{inspected.rulesText ?? "No printed rules text."}</p></section>
        {inspectedBoard && <section className="inspector-loadout"><header><div><span className="eyebrow">Current equipment</span><h3>Fighter loadout</h3></div><small>{inspectedBoard.equipment.length} equipped card{inspectedBoard.equipment.length === 1 ? "" : "s"} · {(inspectedBoard.exhaustedEquipment ?? []).length} exhausted</small></header><div className="inspector-loadout-grid">{LOADOUT_SLOTS.map((slot) => { const equipped = inspectedBoard.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card && equipmentSlotLabel(card) === slot)); return <article className={`equipment-slot ${equipped.length ? "is-filled" : ""}`} key={slot}><span>{slot}</span>{equipped.length ? <div>{equipped.map((item, index) => { const exhausted = isEquipmentExhausted(inspectedBoard, item.id); const plan = equipmentActivationPlan(item); const ownLoadout = inspectedBoard === player; const legalPhase = plan?.kind === "speed-cycle" ? match.phase === "player-initiate" || match.phase === "player-yell" : plan?.kind === "incoming-zone-penalty" || plan?.kind === "defense-guard" ? match.phase === "defense-window" : plan ? match.phase === "player-yell" : false; return <div className={`equipment-slot-control ${exhausted ? "is-exhausted" : ""}`} key={`${item.id}-${index}`}><button type="button" onClick={() => setInspectedId(item.id)}><span className="equipment-slot-art">{artistUrl(item) ? <img src={artistUrl(item)} alt="" /> : <NativeCardArt card={item} />}</span><b>{item.name}</b><small>{exhausted ? "EXHAUSTED" : "READY"} · {item.details?.Slot ? String(item.details.Slot) : item.subtype}</small></button>{ownLoadout && plan && <button type="button" className="equipment-activate" disabled={exhausted || !legalPhase || Boolean(match.pendingChoice)} onClick={() => activateEquipment(item.id)}>{exhausted ? "Exhausted" : legalPhase ? "Exhaust →" : plan?.kind === "incoming-zone-penalty" || plan?.kind === "defense-guard" ? "Use in Reaction" : "Use during Yell"}</button>}</div>; })}</div> : <em>Empty</em>}</article>; })}</div></section>}
        <footer>{inspectedBoard ? "Click an equipped card to inspect it. " : `${cardEffectNote(inspected)} `}Click the card image to magnify it. Press Escape to close.</footer>
      </article>
    </div>}
    {inspected && !inspectedBoard && <Suspense fallback={null}><CardInspector
      card={inspected}
      imageUrl={artistUrl(inspected) ?? cardPlaceholderUrl}
      saved={savedCardIds.has(inspected.catalogId)}
      positionLabel="Quick Duel card"
      onToggleSaved={() => setSavedCardIds((current) => {
        const next = new Set(current);
        if (next.has(inspected.catalogId)) next.delete(inspected.catalogId); else next.add(inspected.catalogId);
        return next;
      })}
      onClose={() => setInspectedId(null)}
    /></Suspense>}
  </main>;
}

function beltTaskMet(board: Board) {
  const exam = belts[board.belt + 1]?.exam;
  if (!exam) return false;
  if (exam.kind === "three-zones") return ["High", "Mid", "Low"].every((zone) => board.zonesPlayed.some((played) => played.toLocaleLowerCase() === zone.toLocaleLowerCase()));
  if (exam.kind === "two-attacks-hit") return board.attacksThisTurn >= 2 && board.hitThisTurn;
  if (exam.kind === "attack-and-defend") return board.defendedThisRound && board.attackedThisRound && board.blockedThisRound;
  if (exam.kind === "market-types") return new Set(board.purchasedTypes).size >= 2;
  if (exam.kind === "equipment-count") return board.equipment.length >= 2;
  if (exam.kind === "combo") return board.comboTriggered;
  if (exam.kind === "mixed-turn") {
    const playTypes = board.cardsThisTurn.map(cardFor).filter(Boolean) as CardEntry[];
    return playTypes.length >= 4 && playTypes.some(isAttack) && playTypes.some(isKata) && playTypes.some((card) => isPermanent(card) || card.subtype === "Consumable");
  }
  // Quick Duel's Licensing Final is resolved by the KO victory itself, rather
  // than by a post-KO Ascend that players never get to take.
  return false;
}

function markCompletedTask(board: Board) {
  const next = board.belt + 1;
  if (!beltTaskMet(board) || board.completedTasks.includes(next)) return board;
  return { ...board, completedTasks: [...board.completedTasks, next], completedBeltExamThisRound: true };
}

function applyBeltPromotion(board: Board, beltIndex: number) {
  const rank = belts[beltIndex];
  // Certification perks are canonical data. Quick Duel retains its fixed HP.
  return gainFocus({ ...board, belt: beltIndex }, rank?.reward.onPromotionFocus ?? 0);
}

function openAiStrike(current: Match, cardId: string, remainingAiAttacks: string[], useTempo: boolean, sceneChanges: boolean, houseRuleIds: readonly string[]) {
  const card = cardFor(cardId);
  if (!card || weaponAttackBlocked(current.ai, card)) {
    const nextIndex = remainingAiAttacks.findIndex((candidateId) => {
      const candidate = cardFor(candidateId);
      return Boolean(candidate && isAttack(candidate) && !weaponAttackBlocked(current.ai, candidate));
    });
    if (nextIndex >= 0) {
      const nextId = remainingAiAttacks[nextIndex];
      return openAiStrike(current, nextId, [...remainingAiAttacks.slice(0, nextIndex), ...remainingAiAttacks.slice(nextIndex + 1)], useTempo, sceneChanges, houseRuleIds);
    }
    return finishAiTurn(current, "Computer finds no legal Weapon Attack under the active Equipment restriction.", sceneChanges, houseRuleIds);
  }
  const anyZone = attackHasFlexibleZone(current.ai, card);
  const requestedZone = anyZone ? ["High", "Mid", "Low"][Math.floor(Math.random() * 3)] : card.zone?.split(",")[0] ?? "High";
  const declaration = publishQuickDuelPlaytestAttackDeclared(current, "ai", card, requestedZone, {
    previousAttackZone: current.ai.zonesPlayed.at(-1) ?? null,
    usedConsumableThisTurn: current.ai.usedConsumableThisRound,
    playedKataEarlierThisTurn: current.ai.cardsThisTurn.some((id) => { const played = cardFor(id); return Boolean(played && isKata(played)); }),
    differentZoneFromPreviousAttack: Boolean(current.ai.zonesPlayed.at(-1) && current.ai.zonesPlayed.at(-1) !== requestedZone),
    hasWeaponEquipped: current.ai.equipment.some((id) => { const equipped = cardFor(id); return Boolean(equipped && isWeapon(equipped)); }),
  });
  current = declaration.match;
  const incomingEquipmentResponse = applyStructuredEquipmentAttackDeclaration(current.player, (current.player.attacksReceivedThisRound ?? 0) === 0);
  current = { ...current, player: incomingEquipmentResponse.board };
  const pendingEquipmentResponse: PendingChoice | null = incomingEquipmentResponse.choiceRequired && incomingEquipmentResponse.choiceSourceCardId
    ? { kind: "equipment-attack-response", sourceCardId: incomingEquipmentResponse.choiceSourceCardId, attackCardId: card.id }
    : null;
  const zone = declaration.zone;
  const preparedComboAttack = prepareQuickDuelPlaytestAttack(current, "ai", card, zone, cardFor, quickDuelHostOperations);
  current = preparedComboAttack.match;
  const previousCard = current.ai.cardsThisTurn.length ? cardFor(current.ai.cardsThisTurn[current.ai.cardsThisTurn.length - 1]) : null;
  const previousCardWasItem = Boolean(previousCard && previousCard.cardType === "Item");
  const conditionalCycle = structuredAttackCyclePlan(current.ai, card, zone);
  const armorPenalty = current.ai.nextAttackArmorPenalty ?? 0;
  const tempoBonus = useTempo && current.ai.tempo && fighterStat(current.ai, "Speed") > fighterStat(current.player, "Speed") ? 1 : 0;
  const locationModifier = locationAttackModifier(cardFor(current.locationId), card, current.ai, zone);
  const fighterModifier = characterAttackModifierFromDeclaration(declaration);
  const printedModifier = printedAttackRuleModifier(current.ai, current.player, card, zone);
  const incomingModifier = incomingAttackEquipmentModifier(current.player);
  const activeEquipment = autoActivateAiAttackEquipment(current.ai, zone);
  const piercingModifier = attackPiercingModifier(activeEquipment.board, current.player, card, zone, preparedComboAttack.attackFacts.piercing + activeEquipment.piercing);
  const hasFlow = attackHasFlow(activeEquipment.board, card, zone);
  const stage3cAttackBonus = stage3cAttackPowerBonus(activeEquipment.board, card, zone);
  const attackPower = Math.max(0, cardPower(card) + fighterStat(activeEquipment.board, "ATK") + activeEquipment.board.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + activeEquipment.power);
  const consumedAttackBoard = stage3cConsumeAttackStatuses(activeEquipment.board, card, zone);
  let nextAi = applyCardEffects({ ...consumedAttackBoard, hand: removeOne(current.ai.hand, card.id), playArea: [...current.ai.playArea, card.id], xp: current.ai.xp + 1, attacksThisTurn: current.ai.attacksThisTurn + 1, attackedThisRound: true, zonesPlayed: [...current.ai.zonesPlayed, zone], cardsThisTurn: [...current.ai.cardsThisTurn, card.id], nextAttackBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false, nextAttackArmorPenalty: 0, tempo: tempoBonus ? false : current.ai.tempo, wasHitSinceLastTurn: current.ai.attacksThisTurn === 0 ? false : current.ai.wasHitSinceLastTurn, triggeredCombos: current.ai.triggeredCombos, comboTriggered: current.ai.comboTriggered }, card, "ai");
  const flowDraw = hasFlow && !current.ai.flowUsedThisTurn;
  if (flowDraw) nextAi = drawCards({ ...nextAi, flowUsedThisTurn: true }, 1);
  if (current.ai.flowAfterFirstAttack && current.ai.attacksThisTurn === 0) nextAi = { ...nextAi, flowAfterFirstAttack: false, nextAttackHasFlow: true };
  const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...activeEquipment.notes, ...incomingEquipmentResponse.notes, ...piercingModifier.notes];
  return { ...current, player: { ...current.player, attacksReceivedThisRound: (current.player.attacksReceivedThisRound ?? 0) + 1, offTurnConsumablePlayed: false }, ai: nextAi, phase: "defense-window" as const, pendingChoice: pendingEquipmentResponse, pendingStrike: { cardId, zone, attackPower, damageModifier: locationModifier.damage + fighterModifier.damage, piercing: piercingModifier.value, blockedFocus: activeEquipment.blockedFocus, armorPenalty, conditionalCycle: conditionalCycle.draw || conditionalCycle.discard ? { draw: conditionalCycle.draw, discard: conditionalCycle.discard } : undefined, previousCardWasItem, damagePreventedAtDeclaration: incomingEquipmentResponse.preventAttackDamage, targetExhaustedAtDeclaration: Boolean(current.player.exhaustedEquipment?.length), modifierNotes: modifiers, remainingAiAttacks }, log: [`Computer declares ${card.name} to ${zone}. ${tempoBonus ? "Tempo adds +1. " : ""}${flowDraw ? "Flow draws 1 card. " : ""}${modifiers.length ? `${modifiers.join("; ")}. ` : ""}${pendingEquipmentResponse ? "Discard one card before Defense. " : ""}Choose one matching Defense or pass.`, ...current.log].slice(0, 32) };
}

function finishAiTurn(initial: Match, line: string, sceneChanges: boolean, houseRuleIds: readonly string[]) {
  let current = initial;
  const ascendKataId = current.ai.hand.find((id) => {
    const card = cardFor(id);
    return Boolean(card && kataHasAscendEconomyEffect(card, current.ai));
  });
  const ascendKata = ascendKataId ? cardFor(ascendKataId) : null;
  if (ascendKata) {
    const kataBoard = stage3cConsumeKata(current.ai);
    const playedKata = applyCardEffects({
      ...kataBoard,
      hand: removeOne(kataBoard.hand, ascendKata.id),
      playArea: [...kataBoard.playArea, ascendKata.id],
      lastAttackHit: false,
    }, ascendKata, "ai", "onPlay", {}, true);
    current = { ...current, ai: applyCardEffects(playedKata, ascendKata, "ai", "afterResolve") };
  }
  const aiPurchase = current.market.map((id, index) => ({ id, marketEndSlot: index === current.market.length - 1 })).filter(({ id, marketEndSlot }) => marketPriceFor(current.ai, cardFor(id), marketEndSlot) <= marketFocusAvailable(current.ai, cardFor(id))).sort((left, right) => aiMarketScore(cardFor(right.id)!, current.ai) - aiMarketScore(cardFor(left.id)!, current.ai))[0];
  const purchasedCard = aiPurchase ? cardFor(aiPurchase.id) : null;
  const aiBasePrice = purchasedCard && aiPurchase ? marketBasePriceFor(current.ai, purchasedCard, aiPurchase.marketEndSlot) : Number.POSITIVE_INFINITY;
  const characterPurchase = purchasedCard ? commitQuickDuelCharacterPurchase(current.ai, current.player, purchasedCard, aiBasePrice, "ai") : null;
  let aiAfterPurchase = purchasedCard && characterPurchase ? stage3cConsumePurchase(markCompletedTask({ ...spendMarketFocus(characterPurchase.self, purchasedCard, characterPurchase.price), discard: [...characterPurchase.self.discard, purchasedCard.id], purchasedTypes: [...characterPurchase.self.purchasedTypes, purchasedCard.cardType], cardsBought: characterPurchase.self.cardsBought + 1 }), purchasedCard) : current.ai;
  if (purchasedCard && aiPurchase && characterPurchase) {
    const equipmentPurchase = applyStructuredEquipmentPurchase(aiAfterPurchase, purchasedCard, aiPurchase.marketEndSlot);
    aiAfterPurchase = equipmentPurchase.board;
    if (equipmentPurchase.choiceRequired && aiAfterPurchase.hand.length) {
      const selectedId = [...aiAfterPurchase.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)))[0];
      aiAfterPurchase = { ...aiAfterPurchase, hand: removeOne(aiAfterPurchase.hand, selectedId), deck: [...aiAfterPurchase.deck, selectedId], nextInitiateDraw: (aiAfterPurchase.nextInitiateDraw ?? 0) + 1 };
    }
  }
  const playerAfterPurchase = characterPurchase?.opponent ?? current.player;
  let market = current.market;
  let marketDeck = current.marketDeck;
  let marketDiscard = current.marketDiscard;
  if (purchasedCard) {
    const slot = current.market.indexOf(purchasedCard.id);
    const refilled = refillPurchasedMarketSlot(current.market, marketDeck, marketDiscard, slot);
    market = refilled.market;
    marketDeck = refilled.marketDeck;
    marketDiscard = refilled.marketDiscard;
  }
  let promotionLog: string | null = null;
  const nextBelt = belts[aiAfterPurchase.belt + 1];
  const nextBeltXp = effectiveBeltThresholds(belts, houseRuleIds)[aiAfterPurchase.belt + 1];
  if (nextBelt && aiAfterPurchase.xp >= nextBeltXp && aiAfterPurchase.completedTasks.includes(aiAfterPurchase.belt + 1)) {
    const before = aiAfterPurchase;
    aiAfterPurchase = applyBeltPromotion(aiAfterPurchase, aiAfterPurchase.belt + 1);
    promotionLog = `Computer certifies ${nextBelt.name} Belt.${aiAfterPurchase.maxHp > before.maxHp ? ` Max HP ${before.maxHp} → ${aiAfterPurchase.maxHp}; HP ${before.hp} → ${aiAfterPurchase.hp}.` : ""}`;
  }
  const hostedHide = publishQuickDuelPlaytestLifecycleEvent({ ...current, player: playerAfterPurchase, ai: aiAfterPurchase }, "ai", "onHide", quickDuelHostOperations, cardFor).match;
  const kataHideAi = applyKataHideEffects(hostedHide.ai, "ai");
  const nextAi = playAreaCleanup(kataHideAi);
  const purchaseLog = `${ascendKata ? `Computer plays ${ascendKata.name} during Ascend. ` : ""}${purchasedCard ? `Computer buys ${purchasedCard.name}.` : "Computer buys nothing."}`;
  const finished = { ...hostedHide, ai: nextAi, market, marketDeck, marketDiscard, marketPurchasedThisRound: current.marketPurchasedThisRound || Boolean(purchasedCard), winner: nextAi.hp ? current.winner : "player" as const, log: [purchaseLog, ...(promotionLog ? [promotionLog] : []), line, ...hostedHide.log].slice(0, 32) };
  if (!nextAi.hp) return finished;
  if (current.turnIndex === 0) {
    const hostedFinished = withPlayerCharacterChoice(publishQuickDuelPlaytestLifecycleEvent(finished, "player", "onInitiate", quickDuelHostOperations, cardFor));
    const player = applyInitiateCarryover(hostedFinished.player);
    const carryover = player.focus - finished.player.focus;
    return { ...hostedFinished, player, phase: "player-initiate" as const, turnIndex: 1 as const, log: [`You are second in this round's initiative order. Initiate begins now.${carryover ? ` Delayed effects generate ${carryover} Focus.` : ""}`, ...hostedFinished.log].slice(0, 32) };
  }
  return advanceRound(finished, sceneChanges, "Both fighters have completed the round.", houseRuleIds);
}

function advanceRound(current: Match, sceneChanges: boolean, line: string, houseRuleIds: readonly string[]) {
  const nextRound = current.round + 1;
  const freshLocations = current.locations.length ? current.locations : shuffle(quickDuelLocationPool.map((card) => card.id));
  const locationId = sceneChanges ? freshLocations[0] ?? current.locationId : current.locationId;
  const player = stage3cAdvanceRound({ ...current.player, xp: current.player.xp + 1, tempo: true, tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, equipmentAttackPlan: null, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: 0, exhaustedEquipment: [], equipmentEffectIdsThisRound: [], readyAtInitiate: [], readyAtHide: [], combatDamageEventsThisRound: 0, usedConsumableThisRound: false, lastAttackHit: false, attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], damageReductionUsed: false, blockedThisRound: false, usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] });
  const ai = stage3cAdvanceRound({ ...current.ai, xp: current.ai.xp + 1, tempo: true, tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, equipmentAttackPlan: null, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: 0, exhaustedEquipment: [], equipmentEffectIdsThisRound: [], readyAtInitiate: [], readyAtHide: [], combatDamageEventsThisRound: 0, usedConsumableThisRound: false, lastAttackHit: false, attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], damageReductionUsed: false, blockedThisRound: false, usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] });
  const marketRefreshes = shouldRefreshMarketAtRoundEnd(current.marketPurchasedThisRound, houseRuleIds);
  const marketScramble = hasQuickDuelHouseRule(houseRuleIds, "market-scramble");
  const marketState = marketRefreshes
    ? refreshMarketRow(current.market, current.marketDeck, current.marketDiscard)
    : { market: current.market, marketDeck: current.marketDeck, marketDiscard: current.marketDiscard };
  const playerFirst = fighterStat(player, "Speed") >= fighterStat(ai, "Speed");
  const stagedForInitiate: Match = { ...current, player, ai };
  const hostedInitiate = playerFirst ? withPlayerCharacterChoice(publishQuickDuelPlaytestLifecycleEvent(stagedForInitiate, "player", "onInitiate", quickDuelHostOperations, cardFor)) : stagedForInitiate;
  const initiatedPlayer = playerFirst ? applyInitiateCarryover(hostedInitiate.player) : player;
  const initiatedAi = hostedInitiate.ai;
  const turnOrder: Match["turnOrder"] = playerFirst ? ["player", "ai"] : ["ai", "player"];
  const marketRefreshLabel = marketScramble ? "Market Scramble" : "Market Mercy";
  const marketNote = marketScramble ? "Market Scramble refreshes all seven slots." : current.marketPurchasedThisRound ? "The Shared Market remains in place." : "No one bought a card, so Market Mercy refreshes all seven slots.";
  const advanced: Match = { ...current, ...marketState, player: initiatedPlayer, ai: initiatedAi, marketPurchasedThisRound: false, pendingDiscard: null, pendingChoice: hostedInitiate.pendingChoice ?? null, pendingCombatContinuation: null, locationId, locations: sceneChanges ? freshLocations.slice(1) : current.locations, round: nextRound, phase: playerFirst ? "player-initiate" as const : "ai-ready" as const, turnOrder, turnIndex: 0 as const, selectedAttackId: null, log: [`Honor ${nextRound}: ${cardFor(locationId)?.name ?? "Tournament Mat"} is active. Both fighters gain 1 XP and refresh Tempo. ${marketNote} ${playerFirst ? "You" : "Computer"} take initiative.`, line, ...current.log].slice(0, 32) };
  const lucky = initiatedPlayer.hand.map(cardFor).find((candidate): candidate is CardEntry => Boolean(candidate && candidate.catalogId === "DDB-CON-CORE-033"));
  if (!advanced.pendingChoice && sceneChanges && lucky && locationId !== current.locationId) { const message = `${cardFor(locationId)?.name ?? "A Location"} was revealed. Lucky Dumpling may replace it.`; return { ...advanced, pendingChoice: { kind: "stage3c-lucky-reveal", sourceCardId: lucky.id, revealKind: "location", revealedCardId: locationId } as PendingChoice, log: [message, ...advanced.log].slice(0, 32) }; }
  if (!advanced.pendingChoice && marketRefreshes && lucky) {
    const revealedId = marketState.market.find((id) => !current.market.includes(id));
    const slot = revealedId ? marketState.market.indexOf(revealedId) : -1;
    if (revealedId && slot >= 0) { const message = `${cardFor(revealedId)?.name ?? "A Market card"} was revealed during ${marketRefreshLabel}. Lucky Dumpling may replace it.`; return { ...advanced, pendingChoice: { kind: "stage3c-lucky-reveal", sourceCardId: lucky.id, revealKind: "market", revealedCardId: revealedId, marketSlot: slot } as PendingChoice, log: [message, ...advanced.log].slice(0, 32) }; }
  }
  return advanced;
}

function prepareAiTurn(current: Match) {
  current = publishQuickDuelPlaytestLifecycleEvent(current, "ai", "onInitiate", quickDuelHostOperations).match;
  const initiatedAi = applyInitiateCarryover({ ...current.ai, usedEffectIdsThisTurn: [] });
  const turnEquipment = autoActivateAiTurnEquipment(initiatedAi);
  const aiStart = turnEquipment.board;
  const practiceId = aiStart.defensePracticeUsed ? undefined : aiStart.hand
    .filter((id) => { const card = cardFor(id); return Boolean(card && isDefense(card)); })
    .sort((left, right) => cardFocus(cardFor(right)) - cardFocus(cardFor(left)))[0];
  let nextAi = practiceId ? {
    ...aiStart,
    hand: removeOne(current.ai.hand, practiceId),
    playArea: [...current.ai.playArea, practiceId],
    focus: current.ai.focus + cardFocus(cardFor(practiceId)),
    defensePracticeUsed: true,
  } : aiStart;
  const badHabitId = !nextAi.badHabitFocusUsed && gameDefinition.economy.badHabitFocus.usesPerTurn > 0
    ? nextAi.hand.find((id) => cardFor(id)?.catalogId === gameDefinition.economy.badHabitFocus.catalogId)
    : undefined;
  if (badHabitId) {
    nextAi = {
      ...nextAi,
      hand: removeOne(nextAi.hand, badHabitId),
      discard: [...nextAi.discard, badHabitId],
      focus: nextAi.focus + gameDefinition.economy.badHabitFocus.focusGain,
      badHabitFocusUsed: true,
    };
  }
  // The support-card legality predicate may need the opponent board (for
  // character equip permissions). Initialize it before the predicate closes
  // over the value; otherwise the production bundle throws a TDZ error when
  // the AI opens a turn with support cards.
  let nextPlayer = current.player;
  const supportIds = nextAi.hand.filter((id) => {
    const card = cardFor(id);
    if (!card || isAttack(card) || isDefense(card) || card.subtype === "Junk") return false;
    if (isPermanent(card) && !publishQuickDuelPlaytestEquip({ ...current, player: nextPlayer, ai: nextAi }, "ai", card).allowed) return false;
    if (isCoreConsumableCard(card)) return canPlayCoreConsumableInPhase(card, "player-yell", stage3cConsumableContext(nextAi));
    return true;
  });
  if (!supportIds.length && !practiceId && !badHabitId && !turnEquipment.notes.length) return current;
  const played: string[] = [];
  const triggeredEquipment: string[] = [];
  let pendingChoice: PendingChoice | null = null;
  for (const id of supportIds) {
    const card = cardFor(id);
    if (!card) continue;
    if (isCoreConsumableCard(card) && stage3cRestrictionBlocks(nextAi.stage3cRestrictions, "consumable")) continue;
    const locationModifier = locationFocusModifier(cardFor(current.locationId), card, nextAi);
    if (isKata(card)) nextAi = stage3cConsumeKata(nextAi);
    if (isPermanent(card)) {
      const characterEquip = publishQuickDuelPlaytestEquip({ ...current, player: nextPlayer, ai: nextAi }, "ai", card);
      if (!characterEquip.allowed) continue;
      nextPlayer = characterEquip.match.player;
      nextAi = characterEquip.match.ai;
    }
    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], focus: nextAi.focus + locationModifier.value, lastAttackHit: false }, card, "ai", "onPlay", isCoreConsumableCard(card) ? stage3cConsumableContext(nextAi) : {});
    if (isKata(card)) nextAi = applyCardEffects(nextAi, card, "ai", "afterResolve");
    if (isPermanent(card)) {
      const beltName = belts[nextAi.belt]?.name ?? "White";
      for (const sourceId of nextAi.equipment) {
        const source = cardFor(sourceId);
        if (!source) continue;
        const plan = equipmentOnEquipPlan(source, card, { beltName });
        if (!plan) continue;
        if (plan.exhaustSource && !isEquipmentExhausted(nextAi, sourceId)) nextAi = exhaustEquipment(nextAi, sourceId);
        if (plan.draw) nextAi = drawCards(nextAi, plan.draw);
        if (plan.nextAttackPower) nextAi = { ...nextAi, nextAttackBonus: nextAi.nextAttackBonus + plan.nextAttackPower };
        if (plan.readyOther) {
          const exhaustedOther = (nextAi.exhaustedEquipment ?? []).find((candidate) => candidate !== sourceId && nextAi.equipment.includes(candidate));
          if (exhaustedOther) nextAi = readyEquipment(nextAi, exhaustedOther);
        }
        if (plan.discard) {
          const discardIds = [...nextAi.hand]
            .sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)))
            .slice(0, Math.min(plan.discard, nextAi.hand.length));
          if (discardIds.length) nextAi = { ...nextAi, hand: nextAi.hand.filter((candidate) => !discardIds.includes(candidate)), discard: [...nextAi.discard, ...discardIds] };
        }
      }
    }
    const aiKataEquipPlan = isKata(card) ? kataEquipFromHandPlanForHost(card) : null;
    if (aiKataEquipPlan) {
      const candidateId = nextAi.hand.find((candidate) => {
        const equipment = cardFor(candidate);
        return kataEquipCandidate(equipment, aiKataEquipPlan) && equipmentHandLimit(nextAi.equipment, equipment, cardFor).allowed;
      });
      const candidate = candidateId ? cardFor(candidateId) : null;
      if (candidate) {
        const characterEquip = publishQuickDuelPlaytestEquip({ ...current, player: nextPlayer, ai: nextAi }, "ai", candidate);
        if (characterEquip.allowed) {
          nextPlayer = characterEquip.match.player;
          nextAi = applyCardEffects({ ...characterEquip.match.ai, hand: removeOne(characterEquip.match.ai.hand, candidate.id), playArea: [...characterEquip.match.ai.playArea, candidate.id] }, candidate, "ai");
          if (aiKataEquipPlan.nextAttackPower) nextAi = { ...nextAi, nextAttackBonus: nextAi.nextAttackBonus + aiKataEquipPlan.nextAttackPower };
          if (aiKataEquipPlan.additionalFocus) nextAi = gainFocus(nextAi, aiKataEquipPlan.additionalFocus);
        }
      }
    }
    if (isCoreConsumableCard(card)) {
      nextAi = applyCardEffects(nextAi, card, "ai", "afterResolve", stage3cConsumableContext(nextAi));
      nextAi = { ...nextAi, stage3cStatuses: armConsumableHideStatuses(armConsumableAttackFollowupStatuses(nextAi.stage3cStatuses ?? [], card), card) };
      nextPlayer = applyStage3CTiming(nextPlayer, card, "onPlay", "player", stage3cConsumableContext(nextAi), "opponent");
      nextPlayer = applyStage3CTiming(nextPlayer, card, "afterResolve", "player", stage3cConsumableContext(nextAi), "opponent");
    }
    if (isCoreConsumableCard(card)) {
      if (hasStructuredResolver(card, "consumable.chooseOpponentDiscardReactionIfAble")) {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.chooseOpponentDiscardReactionIfAble"]);
        const reactionIds = nextPlayer.hand.filter((candidate) => String(cardFor(candidate)?.timing ?? "").toLocaleLowerCase() === "reaction");
        if (reactionIds.length) pendingChoice = { kind: "stage3c-reaction-discard", sourceCardId: card.id, reactionIds };
      }
      if (hasStructuredResolver(card, "consumable.optionalExhaustToCycle")) {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.optionalExhaustToCycle"]);
        const equipmentId = stage3cReadyEquipmentIds(nextAi)[0];
        if (equipmentId) {
          nextAi = exhaustEquipment(nextAi, equipmentId);
          nextAi = drawCards(nextAi, 1);
          const discardId = [...nextAi.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)))[0];
          if (discardId) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, discardId), discard: [...nextAi.discard, discardId] };
        }
      }
      if (hasStructuredResolver(card, "consumable.zoneSpecificIncomingAttackPenalty")) {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.zoneSpecificIncomingAttackPenalty"]);
        nextPlayer = stage3cArmZoneWard(nextPlayer, card.id, stage3cAiPreferredAttackZone(nextPlayer), -2);
      }
      if (hasStructuredResolver(card, "consumable.reorderTopThree")) {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.reorderTopThree"]);
        const reveal = revealDeckTop(nextAi, 3);
        const ordered = [...reveal.revealed].sort((left, right) => cardCost(cardFor(right)) - cardCost(cardFor(left)));
        const types = new Set(reveal.revealed.map((candidate) => cardFor(candidate)?.cardType ?? "Unknown"));
        nextAi = { ...reveal.board, deck: [...reveal.board.deck, ...ordered.slice().reverse()] };
        if (reveal.revealed.length === 3 && types.size === 3) nextAi = gainFocus(nextAi, 1);
      }
      if (hasStructuredResolver(card, "consumable.removeTemporaryNegativeStatModifier")) {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.removeTemporaryNegativeStatModifier"]);
        const stat = stage3cNegativeStatOptions(nextAi)[0];
        if (stat) {
          const removed = stage3cRemoveTemporaryNegative(nextAi, stat);
          nextAi = removed.board;
          if (removed.removed && hasStructuredResolver(card, "consumable.pepTalkConditionalAttackBonus")) {
            const status: RuntimeStatus = { sourceEffectId: `consumable-pep-talk-bonus:${card.id}`, effect: "combat.modifyAttackPower", target: "self", amount: 1, duration: "nextAttack", resolver: "consumable.pepTalkConditionalAttackBonus", qualifier: { nextAttack: true, expires: "endOfTurn" }, appliedImmediately: false };
            nextAi = { ...nextAi, stage3cStatuses: [...(nextAi.stage3cStatuses ?? []), status] };
          }
        }
      }
      if (nextAi.stage3cChoices?.some((choice) => choice.resolver === "consumable.healAndRemoveStatus")) {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.healAndRemoveStatus"]);
        const sourceEffectId = chooseAiTemporaryStatusRemoval(nextAi.stage3cStatuses);
        if (sourceEffectId) nextAi = removeTemporaryStatus(nextAi, sourceEffectId).board;
      }
      if (hasStructuredResolver(card, "consumable.discardUpToForFocus")) {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.discardUpToForFocus"]);
        const discarded = [...nextAi.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right))).slice(0, 2);
        nextAi = gainFocus({ ...nextAi, hand: nextAi.hand.filter((candidate) => !discarded.includes(candidate)), discard: [...nextAi.discard, ...discarded] }, discarded.length * 2);
      }
      if (hasStructuredResolver(card, "consumable.suppressChosenWeaponClause")) {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.suppressChosenWeaponClause"]);
        const weaponId = nextAi.equipment.find((candidate) => { const item = cardFor(candidate); return Boolean(item && isWeapon(item)); });
        if (weaponId) nextAi = { ...nextAi, suppressedEquipmentPenaltyIds: [...new Set([...(nextAi.suppressedEquipmentPenaltyIds ?? []), weaponId])] };
      }
      if (hasStructuredResolver(card, "consumable.exhaustEquipmentForFocus")) {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.exhaustEquipmentForFocus"]);
        const equipmentId = stage3cReadyEquipmentIds(nextAi)[0];
        if (equipmentId) nextAi = gainFocus(exhaustEquipment(nextAi, equipmentId), 3);
      }
      if (hasStructuredResolver(card, "consumable.topThreeAttackSelection")) {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.topThreeAttackSelection"]);
        const reveal = revealDeckTop(nextAi, 3);
        const attackId = reveal.revealed.filter((candidate) => isAttack(cardFor(candidate)!)).sort((left, right) => cardPower(cardFor(right)!) - cardPower(cardFor(left)!))[0];
        const rest = attackId ? removeOne(reveal.revealed, attackId) : reveal.revealed;
        const junkId = rest.find((candidate) => isJunk(cardFor(candidate)));
        nextAi = { ...reveal.board, hand: attackId ? [...reveal.board.hand, attackId] : reveal.board.hand, discard: [...reveal.board.discard, ...rest.filter((candidate) => candidate !== junkId)], destroyed: junkId ? [...(reveal.board.destroyed ?? []), junkId] : reveal.board.destroyed };
      }
    }
    if (pendingChoice) break;
    const aiFastestFocus = structuredFocusIfFastest(card, fighterStat(nextAi, "Speed"), fighterStat(nextPlayer, "Speed"));
    if (aiFastestFocus) nextAi = { ...nextAi, focus: nextAi.focus + aiFastestFocus };
    if (isKata(card)) {
      const kataEquipment = autoTriggerAiAfterKataEquipment(nextAi);
      nextAi = kataEquipment.board;
      triggeredEquipment.push(...kataEquipment.notes);
    }
    nextAi = resolveAiDeckLook(nextAi, card);
    if (destroysAfterUse(card)) nextAi = destroyResolvedConsumable(nextAi, card);
    else if (returnsToSupplyAfterUse(card)) nextAi = returnResolvedConsumable(nextAi, card);
    if (!isCoreConsumableCard(card)) {
      const defensePenalty = targetNextDefensePenalty(card);
      if (defensePenalty) nextPlayer = queueOpponentCardModification({ ...nextPlayer, nextDefenseCardBonus: (nextPlayer.nextDefenseCardBonus ?? 0) - defensePenalty }, "Defense");
    }
    played.push(card.name);
  }
  const preparations = [
    ...turnEquipment.notes,
    ...triggeredEquipment,
    ...(practiceId ? [`Defense Practice with ${cardFor(practiceId)?.name}`] : []),
    ...(badHabitId ? [`Bad Habit discarded for +${gameDefinition.economy.badHabitFocus.focusGain} Focus`] : []),
    ...played,
  ];
  return { ...current, player: nextPlayer, ai: nextAi, pendingChoice, log: [`Computer prepares with ${preparations.join(", ")}. The strategy is now technically documented.`, ...current.log].slice(0, 32) };
}
