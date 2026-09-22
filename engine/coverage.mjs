import { HEADLESS_GENERIC_ACTIONS, HEADLESS_RESOLVER_ACTIONS, HEADLESS_STRUCTURED_RESOLVERS } from "./core.mjs";

export const HEADLESS_SUPPORTED_ACTIONS = new Set([
  "gainFocus", "draw", "modifyAttackPower", "modifySpeed", "modifyGuard", "modifyDefense",
  "preventDamage", "heal", "dealDamage", "minimumSpeed", "piercing", "chooseZone",
  "discard", "destroy", "ready", "exhaust",
  "reveal", "gainXP", "spendFocus", "modifyDefenseContribution", "grantFlow", "modifyCost", "cycleDiscardDraw", "deckLook", "structured",
  "removeTemporaryNegativeStatModifier", "removeTemporaryStatus", "recoverThenDiscard", "recycle", "equipFromHand", "equipFromDiscard", "setSpeed", "modifyDefenseUntilNextTurn", "restrictAttack", "restrictReaction", "restrictConsumable", "restrictWeapon", "untargetable", "reactionDefense", "grantKataFocus", "hitChoice", "equipmentToggle", "discardOrDestroy", "incomingAttackChoice",
]);

export const HEADLESS_SUPPORTED_CONDITIONS = new Set([
  "always", "isFastest", "firstAttackThisTurn", "attackNumber", "defenderPlayedDefense",
  "targetHpAtMost", "hasTempo", "targetPermanentEquipmentCount", "hasFewerCardsThanTarget", "alternateZone",
  "attackZone", "attackZones", "incomingZones", "incomingAttackTargetsSelf", "sourceExhausted",
  "firstDamageThisRound", "blockedThisRound", "playedDefenseSinceLastTurn", "previousAttackHit", "differentZoneFromPreviousAttack",
  "wasHitSinceLastTurn", "firstDefenseThisRound", "firstIncomingAttackThisRound", "firstKataThisTurn", "firstHitThisTurn",
  "oncePerTurn", "oncePerRound", "oncePerGame", "sameRoundOnly", "sameTurnOnly", "targetSpeedHigher", "targetXpHigher", "targetTempoUsed",
  "hasWeaponEquipped", "playedKataThisTurn", "attackUsesSourceEquipment", "incomingAttackUsesWeapon", "attackHasTag", "attackTagAny",
  "minimumBelt", "currentAttackIsNormal", "attackIsUnarmed", "targetHasMatchingArmor",
  "completedBeltExamThisRound", "blockedSinceLastTurn", "priorLowAttack", "previousAttackBlocked", "previousCardIsItemOrConsumable", "previousCardIsKataOrItem",
  "previousAttackZoneMidOrHigh", "priorDifferentZoneCount", "priorPunchAttack", "priorSpinAttack", "focusGeneratedThisTurn", "hasImprovisedWeapon",
  "dealtDamagePreviousTurn", "nextMatchingAttack", "firstAttackAfterKataThisTurn", "equippedThisTurn", "didNotAttackPreviousTurn", "hasNotAttackedThisTurn",
  "firstAttackWithTagThisTurn", "defenseHasTag", "sameOpponentAsBlockedAttack",
  "firstMatchingPerRound", "firstMatchingPerTurn", "targetHasTemporaryNegativeStat", "incomingAttackIsUnarmed", "firstCombatDamageThisRound",
  "firstDamagingAttackThisRound", "combatDamageDealt", "firstHitWithSourceThisTurn", "firstCombatDamageWithSourceThisTurn", "attackHasAnyTag",
  "damageSourceIsWeapon", "attackedThisTurn", "firstDifferentZoneSequenceThisTurn", "focusGeneratedBySingleCard", "firstQualifyingHitThisTurn",
  "currentCardType", "cardType", "cardTypeAny", "resolvedCardType",
  "manualActivation", "pendingFromSource", "defenseOutsideTurn", "equippedCardIsOtherPermanentEquipment",
  "drawAfterCost", "discardCost", "draw", "discard", "grantFlowTo", "window", "nextPurchase", "discount", "minimumCost", "minimumPrintedCost", "attackZones",
  "lookCount", "eligibleTypes", "keepCount", "restAction", "optionalKeep", "differentCardTypesFocus", "noMatchFocus",
  "choiceKind", "choiceOptions", "sourceZone", "cardFamily", "permanentOnly", "equipNow", "ifSubtype", "gearEntersReady",
  "gearNextAttackPower", "additionalFocusGenerated", "destination", "thenDiscard", "eligibleSubtypes", "gearBonus", "zones", "drawIfSourceZone", "drawAmount",
  "differentCardTypesFocus", "nextPurchaseOnly", "minimumFinalCost", "minimumPrintedCost",
  "firstNormalAttackThisTurn", "focusSpentEarlierThisTurn", "usedConsumableThisTurn", "firstCardPlayedThisTurn", "beltAtLeast", "marketCardsRemaining",
  "playedAttackThisTurn", "discardedFocusValue", "discardedCardType", "priorJumpOrSpinAttack", "targetHasExhaustedEquipment", "selfSpeedChangedThisRound",
  "piercingScope", "scope", "defenseTagAny", "sourceArmorHelpedBlock", "firstArmorBlockThisRound", "armedEquipmentZoneMatched",
  "examRequirementCompleted", "completesActiveBeltExam", "goldBeltExamThirdZone", "duration",
  "hpAtOrBelowHalfMax", "attackIsReversal",
  "focusGain", "allowedZones", "chooseZone", "discardCount", "drawCount", "maximumLoss", "nextItemOnly", "afterThatConsumable",
  "attackBlocked", "firstComboThisTurn", "firstConsumableThisTurn", "firstConsumableUsedThisTurn", "firstHighAttackThisTurn", "firstHitWithSourceThisRound",
  "hasTwoPairedWeapons", "incomingAttackZone", "marketEndSlot",
  "playedAsReversal", "boughtCardLastAscend", "previousCardIsItem", "costPaid", "consumableUsedThisRound",
  "purchaseCompleted", "purchasedCardCost", "ascendCompleted", "boughtCardThisAscend", "nextAttackDifferentZone",
  "nextAttackHasTag", "nextQualifyingAttackOnly", "sourceActivationArmed", "equippedCardSubtypeIn", "equippedCardIsSource", "minimumDraw", "incomingDamageAtLeast",
  "xpFromLegalAttackOrDefense",
  "attackTiming", "appliesTo", "afterOpponentCommitsDefense", "itemCostPenalty", "defenseGuardPenalty",
  // Structured parameters and lifecycle facts are consumed by resolver hosts,
  // rather than treated as unknown predicates.
  "incomingZones", "discardCost", "nonHonorSceneChangedThisRound", "choiceKind", "sourceAffectedCountThreshold",
  "scheduledTiming", "firstSwapThisGame", "discardedByEffect", "selfIsLowestXp", "speedPenaltyEvent",
  "forcedDiscardEvent", "resolvedCardType", "sceneChangeOccurred", "eventCardType", "nextMatchingEvent",
  "boughtCardThisTurn", "event", "grantFlowTo", "beltExam", "firstNovelPurchasedCardType", "requiresCondition",
  "attackSpeedBonus", "attackPowerBonus", "optional", "onPaidGainFocus", "readyTiming", "maxAttacksAfterSource",
  "optionalExhaust", "mustDifferFromFirstAttackZone", "matchingZonePowerBonus", "ifHitSinceLastTurn", "otherwise",
  "revealUntilType", "keepRevealedMatch", "sourceAttackMatchesArmedEffect", "firstAttackInChosenZone",
  "afterResolveFocus", "source", "firstDamageEventBefore", "gainFocusIfDamageAfterReduction", "focusAmount",
  "copySource", "copyPrintedEffect", "preventRecursiveLoop", "learnedComboTriggeredThisTurn", "firstMatchingAttack",
  "minimumDamage", "gainFocus", "redBeltOrHigherCycle", "hpAtOrBelowHalfMax", "nextComboLearn", "discardUpTo",
  "drawEqualDiscarded", "differentCardTypesPlayedThisTurn", "triggerOnFirstThresholdCrossing", "chosenZoneFirstAttackPower",
  "otherZonesRequired", "otherZonesBefore", "completionFocus", "equipmentSubtype", "equippedOnly", "attackBonusDelta",
  "sameRoundOnly", "reactionPlayedAgainstSelf", "attackHasTag", "attackUsesSourceEquipment", "attackZones",
  "firstHitWithSourceThisRound", "defenseOutsideTurn", "currentAttackIsNormal",
  "discardedPrintedFocusValue", "firstNegativeCombatModifierThisRound", "nextPlayOfChosenCardFocus", "firstMatchingEventBefore", "attackIsReversal", "equipmentRestriction",
  "locationEvent", "locationOperation",
  "minimumFinalValue", "attackUsesEquipmentTagAny", "equipmentReadiedOutsideInitiate", "firstLowAttackThisTurn", "fixedValue",
  "hpLoss", "itemPlayedBeforeFirstAttack", "reveal",
  "ownTurn", "firstMatchingPerRound", "firstMatchingPerTurn", "equipmentTagAny", "xpSourceAny", "isKoXp",
  "kataGrantedFlowThisAttack", "firstKataFlowThisTurn", "cardTypeAny", "attackedThisTurn", "printedCostAtLeast",
  "isComboFinisher", "healingSourceAny", "usesSceneChosenCounterZone", "attackHit", "sameRoundAsSceneChoice",
  "reductionSourceAny", "firstConsumableThisTurn", "firstItemPurchaseThisAscend", "cardSubtypeOrTagAny", "destroyCount",
  "comboIsLearned", "drawCount", "discardCount", "maximumLoss", "printedFocusAtLeast", "selfSpeedAtLeast",
  "defenseZone", "attackTagAny", "appliesNextRound", "isSlowest", "firstAcrossPlayersPerRound", "hasWeaponEquipped",
  "equipmentExhaustedEarlierThisRound", "firstEquipmentExhaustThisRound", "equippedCardTagAny", "firstMatchingPerSceneStay",
]);

const increment = (map, key) => { const normalized = String(key ?? "(none)"); map[normalized] = (map[normalized] ?? 0) + 1; };
const sorted = (map) => Object.fromEntries(Object.entries(map).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
const conditionKind = (condition) => typeof condition === "string" ? condition.match(/kind=([^;}]*)/)?.[1] ?? "(unknown)" : condition?.kind ?? "(unknown)";
const listValue = (value) => Array.isArray(value) ? value.join(",") : String(value ?? "(none)");
export const canonicalAction = (effect) => {
  const action = String(effect.action ?? effect.effect ?? "(none)");
  if (action !== "custom") return action;
  if (String(effect.id).endsWith("dodge-block-cycle")) return "cycleDiscardDraw";
  if (HEADLESS_RESOLVER_ACTIONS[String(effect.resolver)]) return HEADLESS_RESOLVER_ACTIONS[String(effect.resolver)];
  if (String(effect.resolver) === "attack.final.cycle") return action;
  if (["attack.final.defensiveReaction", "attack.final.comboMultiplicity", "attack.final.fireDrillFeint"].includes(String(effect.resolver))) return "structured";
  if (String(effect.resolver) === "equipment.structured" || String(effect.resolver) === "location.structured") return action === "custom" ? "structured" : action;
  if (HEADLESS_STRUCTURED_RESOLVERS.has(String(effect.resolver))) return "structured";
  return {
    "equipment.modifyDefenseContribution": "modifyDefenseContribution",
    "combat.modifyDefense": "modifyDefense",
    "combat.grantFlow": "grantFlow",
    "core.gainXP": "gainXP",
    "core.reveal": "reveal",
    "economy.spendFocus": "spendFocus",
    "economy.modifyCost": "modifyCost",
  }[String(effect.effect ?? "")] ?? action;
};

/**
 * Card family is derived from the canonical catalog, never from a card name or
 * printed rules text. The fallback keeps this function useful with the small
 * registry fixtures used by unit tests.
 */
export function classifyCardFamily(catalogCard, catalogId = "") {
  const type = String(catalogCard?.cardType ?? "");
  const subtype = String(catalogCard?.subtype ?? "");
  if (type === "Boss") return "Boss / module";
  if (type === "Location") return "Locations";
  if (type === "Character") return "Characters";
  if (type === "Starter") return "Starter";
  if (type === "Combo") return "Combos";
  if (subtype === "Attack") return "Attacks";
  if (subtype === "Defense") return "Defenses";
  if (subtype === "Kata") return "Katas";
  if (subtype === "Consumable") return "Consumables";
  if (subtype === "Weapon") return "Weapons";
  if (subtype === "Gear") return "Gear";
  if (subtype === "Defense Equipment") return "Equipment / defense equipment";
  if (subtype === "Reaction Item") return "Reactions";
  return catalogId.startsWith("DDB-B") ? "Boss / module" : "Unknown";
}

/**
 * Quick Duel only draws from its configured market decks, plus Characters and
 * the Starter deck. Boss, Location, and Combo registries are still reported,
 * but are explicitly out-of-mode instead of being silently dropped.
 */
export function classifyEffectScope(catalogCard, definition = null) {
  const type = String(catalogCard?.cardType ?? "");
  if (type === "Boss" || type === "Location" || type === "Combo") return "out-of-mode";
  const marketDecks = new Set(definition?.economy?.market?.decks ?? ["Technique Deck", "Item Deck"]);
  const starterIds = new Set((definition?.starterDeck ?? []).map((entry) => entry.catalogId));
  if (type === "Character" || type === "Starter" || starterIds.has(catalogCard?.catalogId) || marketDecks.has(catalogCard?.deck)) return "baseline-core";
  return "out-of-mode";
}

const supportGroup = (effect) => [
  effect.action ?? effect.effect ?? "(none)", effect.resolver ?? "(none)", effect.trigger ?? "(none)",
  effect.target ?? "(none)", effect.duration ?? "(none)",
  (effect.conditions ?? []).map(conditionKind).join(",") || "(none)",
].map(listValue).join(" | ");

const semanticActionFor = (effect) => {
  const action = String(effect.action ?? effect.effect ?? "(none)");
  const resolver = String(effect.resolver ?? "");
  if (action === "custom" && resolver === "starter.gainFocusIfFastest") return "starter.gainFocusIfFastest";
  if (action === "custom" && HEADLESS_RESOLVER_ACTIONS[resolver]) return HEADLESS_RESOLVER_ACTIONS[resolver];
  if (action === "custom" && HEADLESS_STRUCTURED_RESOLVERS.has(resolver)) return "structured";
  if (action === "custom" && resolver === "attack.final.cycle") return "(unsupported-custom)";
  if (action === "custom") return String(effect.effect ?? action);
  return {
    "equipment.modifyDefenseContribution": "modifyDefenseContribution", "combat.modifyDefense": "modifyDefense", "combat.grantFlow": "grantFlow",
    "core.gainXP": "gainXP", "core.reveal": "reveal", "economy.modifyCost": "modifyCost", "economy.spendFocus": "spendFocus", "core.moveCard": "moveCard",
  }[action] ?? action;
};

const semanticExecution = (effect, conditionKinds) => {
  const resolver = String(effect.resolver ?? "");
  const action = semanticActionFor(effect);
  const conditionsSupported = conditionKinds.every((kind) => HEADLESS_SUPPORTED_CONDITIONS.has(kind));
  const actionSupported = HEADLESS_GENERIC_ACTIONS.has(action)
    || action === "structured" && HEADLESS_STRUCTURED_RESOLVERS.has(resolver)
    || action === "starter.gainFocusIfFastest";
  return { supported: conditionsSupported && actionSupported, action, conditionsSupported, actionSupported };
};

export function analyzeEffectCoverage(cardEffects, { catalog = [], definition = null } = {}) {
  const catalogById = new Map(catalog.map((card) => [card.catalogId, card]));
  const actionCounts = {}; const resolverCounts = {}; const conditionCounts = {}; const triggerCounts = {}; const targetCounts = {}; const durationCounts = {};
  const unsupportedActions = {}; const unsupportedResolvers = {}; const unsupportedConditions = {};
  const scopeCounts = {}; const unsupportedByScope = {}; const unsupportedGroups = {}; const unsupportedGroupsByScope = { "baseline-core": {}, "out-of-mode": {} }; const supportedByFamily = {}; const unsupportedByFamily = {};
  const cardStatus = {}; const unsupportedEntries = []; const staticallyUnsupportedEntries = []; let totalEffects = 0; let staticallyRecognizedEffects = 0; let semanticallyExecutableEffects = 0; let fullySupportedCards = 0; let cardsWithEffects = 0;
  for (const [catalogId, card] of Object.entries(cardEffects.cards ?? {})) {
    const effects = card.effects ?? []; if (!effects.length) continue; cardsWithEffects += 1;
    const catalogCard = catalogById.get(catalogId) ?? { catalogId, cardType: catalogId.startsWith("DDB-B") ? "Boss" : "" };
    const family = classifyCardFamily(catalogCard, catalogId); const scope = classifyEffectScope(catalogCard, definition);
    let cardSupported = true; let cardSupportedCount = 0;
    for (const effect of effects) {
      totalEffects += 1;
      increment(scopeCounts, scope);
      const action = String(effect.action ?? effect.effect ?? "(none)"); const semanticAction = canonicalAction(effect); const resolver = String(effect.resolver ?? "(none)");
      increment(actionCounts, action); increment(resolverCounts, resolver); increment(triggerCounts, effect.trigger ?? "(none)"); increment(targetCounts, effect.target ?? "(none)"); increment(durationCounts, effect.duration ?? "(none)");
      const conditions = (effect.conditions ?? []).map(conditionKind); for (const kind of conditions) increment(conditionCounts, kind);
      const staticallyRecognized = HEADLESS_SUPPORTED_ACTIONS.has(semanticAction) || action === "custom" && resolver === "starter.gainFocusIfFastest";
      if (staticallyRecognized) staticallyRecognizedEffects += 1;
      for (const kind of conditions) if (!HEADLESS_SUPPORTED_CONDITIONS.has(kind)) increment(unsupportedConditions, kind);
      const execution = semanticExecution(effect, conditions);
      const supported = execution.supported;
      const group = supportGroup(effect);
      if (!supported) {
        unsupportedEntries.push({
          catalogId,
          cardName: catalogCard.name ?? card.name ?? catalogId,
          family,
          scope,
          action,
          semanticAction,
          resolver,
          trigger: effect.trigger ?? "(none)",
          target: effect.target ?? "(none)",
          duration: effect.duration ?? "(none)",
          conditions,
          effectId: effect.id ?? null,
        });
        if (staticallyRecognized) staticallyUnsupportedEntries.push({ catalogId, effectId: effect.id ?? null, resolver, semanticAction: execution.action, reason: execution.conditionsSupported ? "missing-runtime-contract" : "unsupported-condition" });
        cardSupported = false; increment(unsupportedActions, semanticAction); if (action === "custom" && resolver !== "starter.gainFocusIfFastest") increment(unsupportedResolvers, resolver);
        increment(unsupportedGroups, group); increment(unsupportedGroupsByScope[scope], group); increment(unsupportedByScope, scope); increment(unsupportedByFamily, family);
      } else { semanticallyExecutableEffects += 1; cardSupportedCount += 1; increment(supportedByFamily, family); }
    }
    if (cardSupported) fullySupportedCards += 1;
    cardStatus[catalogId] = { family, scope, total: effects.length, supported: cardSupportedCount, unsupported: effects.length - cardSupportedCount };
  }
  const cardsFullySupported = Object.entries(cardStatus).filter(([, status]) => status.unsupported === 0).map(([id]) => id).sort();
  const cardsPartiallySupported = Object.entries(cardStatus).filter(([, status]) => status.supported > 0 && status.unsupported > 0).map(([id]) => id).sort();
  const cardsWithZeroSupportedEffects = Object.entries(cardStatus).filter(([, status]) => status.supported === 0).map(([id]) => id).sort();
  const supportedEffects = semanticallyExecutableEffects;
  const unsupportedEffects = totalEffects - semanticallyExecutableEffects;
  return {
    cardsWithEffects, fullySupportedCards, totalEffects, supportedEffects, unsupportedEffects,
    staticallyRecognizedEffects, semanticallyExecutableEffects,
    // Behavioral certification requires executing each entry against a real
    // Game fixture; the CLI merges that async report from behavioral-coverage.
    behaviorallyCertifiedEffects: null, behaviorallyUnsupportedEffects: null,
    baselineCoreEffects: scopeCounts["baseline-core"] ?? 0, outOfModeEffects: scopeCounts["out-of-mode"] ?? 0,
    actionCounts: sorted(actionCounts), resolverCounts: sorted(resolverCounts), conditionCounts: sorted(conditionCounts),
    triggerCounts: sorted(triggerCounts), targetCounts: sorted(targetCounts), durationCounts: sorted(durationCounts),
    unsupportedActions: sorted(unsupportedActions), unsupportedResolvers: sorted(unsupportedResolvers), unsupportedConditions: sorted(unsupportedConditions),
    scopeCounts: sorted(scopeCounts), unsupportedByScope: sorted(unsupportedByScope), supportedByFamily: sorted(supportedByFamily), unsupportedByFamily: sorted(unsupportedByFamily),
    topUnsupportedGroups: sorted(unsupportedGroups), topUnsupportedGroupsByScope: Object.fromEntries(Object.entries(unsupportedGroupsByScope).map(([scope, groups]) => [scope, sorted(groups)])), unsupportedEntries, staticallyUnsupportedEntries, cardStatus,
    cardsFullySupported, cardsPartiallySupported, cardsWithZeroSupportedEffects,
  };
}
