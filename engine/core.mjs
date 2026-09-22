import { attackPower, chooseAttack, chooseDefense, choosePractice, choosePurchase, cost, focus, guard } from "./bots.mjs";

export class Rng {
  constructor(seed = 1) { this.seed = Number(seed) || 1; this.state = this.seed >>> 0; }
  next() { this.state = (1664525 * this.state + 1013904223) >>> 0; return this.state / 2 ** 32; }
  pick(array) { return array.length ? array[Math.floor(this.next() * array.length)] : undefined; }
  shuffle(array) { for (let index = array.length - 1; index > 0; index -= 1) { const other = Math.floor(this.next() * (index + 1)); [array[index], array[other]] = [array[other], array[index]]; } return array; }
}

const num = (value) => Number.parseInt(String(value ?? 0), 10) || 0;
const remove = (array, value) => { const index = array.indexOf(value); if (index >= 0) array.splice(index, 1); };
const isAttack = (card) => attackPower(card) > 0;
const isDefense = (card) => guard(card) > 0;
const cardType = (card) => card.subtype === "Kata" ? "Kata" : isAttack(card) ? "Attack" : card.subtype;
const zones = ["High", "Mid", "Low"];
const structuredParameterKinds = new Set([
  "choiceKind", "choiceOptions", "incomingZones", "discardCost", "nonHonorSceneChangedThisRound",
  "sourceAffectedCountThreshold", "scheduledTiming", "minimumDraw", "firstSwapThisGame", "discardedByEffect",
  "selfIsLowestXp", "speedPenaltyEvent", "forcedDiscardEvent", "resolvedCardType", "sceneChangeOccurred",
  "eventCardType", "nextMatchingEvent", "boughtCardThisTurn", "event", "grantFlowTo", "beltExam",
  "firstNovelPurchasedCardType", "requiresCondition", "attackSpeedBonus", "attackPowerBonus", "optional",
  "onPaidGainFocus", "readyTiming", "maxAttacksAfterSource", "duration", "optionalExhaust", "mustDifferFromFirstAttackZone",
  "matchingZonePowerBonus", "ifHitSinceLastTurn", "otherwise", "revealUntilType", "keepRevealedMatch",
  "sourceAttackMatchesArmedEffect", "firstAttackInChosenZone", "afterResolveFocus", "source", "firstDamageEventBefore",
  "gainFocusIfDamageAfterReduction", "focusAmount", "copySource", "copyPrintedEffect", "preventRecursiveLoop",
  "learnedComboTriggeredThisTurn", "firstMatchingAttack", "minimumDamage", "gainFocus", "redBeltOrHigherCycle",
  "hpAtOrBelowHalfMax", "nextComboLearn", "discardUpTo", "drawEqualDiscarded", "differentCardTypesPlayedThisTurn",
  "triggerOnFirstThresholdCrossing", "chosenZoneFirstAttackPower", "otherZonesRequired", "otherZonesBefore",
  "completionFocus", "equipmentSubtype", "equippedOnly", "attackBonusDelta", "sameRoundOnly", "reactionPlayedAgainstSelf",
  "attackHasTag", "attackUsesSourceEquipment", "attackZones", "firstHitWithSourceThisRound", "defenseOutsideTurn",
  "currentAttackIsNormal", "discardedPrintedFocusValue", "firstNegativeCombatModifierThisRound", "nextPlayOfChosenCardFocus",
  "firstMatchingEventBefore", "attackIsReversal",
  "locationEvent", "locationOperation", "minimumFinalValue", "maximumFinalValue", "fixedValue", "choiceOptions",
  "destroyCount", "drawCount", "discardCount", "focusGain", "hpLoss", "maximumLoss", "appliesNextRound",
  "equipmentTagAny", "xpSourceAny", "isKoXp", "kataGrantedFlowThisAttack", "firstKataFlowThisTurn", "cardTypeAny",
  "attackedThisTurn", "printedCostAtLeast", "isComboFinisher", "healingSourceAny", "usesSceneChosenCounterZone",
  "attackHit", "sameRoundAsSceneChoice", "reductionSourceAny", "firstConsumableThisTurn", "firstItemPurchaseThisAscend",
  "cardSubtypeOrTagAny", "comboIsLearned", "printedFocusAtLeast", "selfSpeedAtLeast", "defenseZone", "attackTagAny",
  "isSlowest", "firstAcrossPlayersPerRound", "equipmentExhaustedEarlierThisRound", "firstEquipmentExhaustThisRound",
  "equippedCardTagAny", "firstMatchingPerSceneStay", "attackUsesEquipmentTagAny", "equipmentReadiedOutsideInitiate",
  "firstLowAttackThisTurn", "itemPlayedBeforeFirstAttack", "reveal",
]);

export class Game {
  constructor(data, { seed = 1, strategies = ["balanced", "balanced"], characters = [] } = {}) {
    this.data = data;
    this.definition = data.definition;
    this.effects = data.cardEffectById ?? new Map();
    this.seed = Number(seed) || 1;
    this.rng = new Rng(this.seed);
    this.cardSerial = 0;
    this.round = 1; this.turns = 0; this.winner = null; this.reason = "";
    this.events = []; this.decisions = []; this.lastPresentedChoice = null; this.cardStats = new Map(); this.marketPurchasedThisRound = false;
    this.phase = this.definition.turn.phases[0]; this.activePlayer = 0; this.pendingChoice = null; this.status = "active";
    this.telemetry = {
      attacks: 0, hits: 0, blocks: 0, totalDamage: 0, damagePrevented: 0,
      cardsPlayed: 0, cardsAcquired: 0, cardsDrawn: 0, cardsDiscarded: 0,
      cardsDestroyed: 0, cardsRevealed: 0, equipmentReadied: 0,
      equipmentExhausted: 0, focusGenerated: 0, focusSpent: 0, xpGenerated: 0,
      defensePractice: 0, promotions: 0, effectApplications: 0,
      choicesPresented: 0, choicesResolved: 0, lifecycleEvents: 0,
      unsupportedEffects: 0,
    };
    const charactersCatalog = data.cards.filter((card) => card.cardType === "Character");
    this.players = [0, 1].map((id) => this.makePlayer(id, characters[id] ?? charactersCatalog[id], strategies[id] ?? "balanced"));
    for (const player of this.players) {
      const passive = this.cardEffects(player.character, "passive").filter((effect) => effect.resolver === "character.cannotEquipWeapons");
      if (passive.length) this.applyCardEffects(player, player.character, "passive", { opponent: this.players[1 - player.id], sourceCard: player.character, effectOverride: passive });
    }
    this.marketDeck = this.rng.shuffle(data.cards.filter((card) => this.definition.economy.market.decks.includes(card.deck)).map((card) => this.cardInstance(card)));
    this.marketDiscard = []; this.market = []; this.refillMarket(true);
    this.locationDeck = this.rng.shuffle(data.cards.filter((card) => card.cardType === "Location").map((card) => this.cardInstance(card)));
    this.locationDiscard = []; this.currentLocation = null; this.sceneChangedThisRound = false;
    this.revealLocation();
  }

  cardInstance(card) { const instance = structuredClone(card); instance.instanceId = `${card.catalogId}#${++this.cardSerial}`; return instance; }

  makePlayer(id, character, strategy) {
    const deck = [];
    for (const entry of this.definition.starterDeck) for (let copy = 0; copy < entry.copies; copy += 1) deck.push(this.cardInstance(this.data.byId.get(entry.catalogId)));
    this.rng.shuffle(deck);
    const player = { id, name: `Player ${id + 1}`, character, strategy, hp: this.definition.mode.startingHp, maxHp: this.definition.mode.startingHp, atk: num(character?.stats?.ATK), def: num(character?.stats?.DEF), speed: num(character?.stats?.Speed), deck, hand: [], discard: [], destroyed: [], played: [], equipment: [], exhaustedEquipment: [], statuses: [], revealed: [], effectUsage: { turn: {}, round: {}, game: {} }, lastTurnWasHit: false, lastTurnWasBlocked: false, lastTurnAttacked: false, focus: 0, xp: 0, beltIndex: 0, tempo: true, purchases: 0, plays: 0, openingPurchase: false, badHabitFocusUsed: false, practiceUsed: false, attackCount: 0, nextAttackPower: 0, nextAttackFlow: false, tempSpeed: 0, turnStats: { zones: new Set(), attacked: false, hit: false, blocked: false, damageTaken: 0, hitCount: 0, incomingAttackCount: 0, kataCount: 0, focusGenerated: 0, playedDefenseSinceLastTurn: false, previousAttackHit: false, previousAttackBlocked: false, previousCardType: null, previousZone: null, flowDrawUsed: false, boughtCardThisTurn: false, boughtCardThisAscend: false, usedConsumableThisRound: false, consumableCount: 0 } };
    this.draw(player, this.definition.turn.handSize);
    const required = this.definition.openingMulligan.requiredTypes;
    if (required.length && !required.some((type) => new Set(player.hand.map(cardType)).has(type))) { player.deck.push(...player.hand); player.hand = []; this.rng.shuffle(player.deck); this.draw(player, this.definition.turn.handSize); }
    return player;
  }

  emit(event) {
    this.events.push({ ...event, round: event.round ?? this.round });
    this.telemetry.lifecycleEvents += 1;
    if (event.type === "attack") {
      this.telemetry.attacks += 1; this.telemetry.totalDamage += event.damage;
      if (event.damage > 0) this.telemetry.hits += 1;
      if (event.defense && event.damage === 0) this.telemetry.blocks += 1;
      this.telemetry.damagePrevented += Math.max(0, event.block - event.attack + event.damage);
    }
  }

  draw(player, amount) {
    for (let count = 0; count < amount; count += 1) {
      if (!player.deck.length && player.discard.length) player.deck = this.rng.shuffle(player.discard.splice(0));
      const card = player.deck.pop(); if (!card) break; player.hand.push(card); this.track(card, "drawn", player);
    }
  }

  playerZones(player) { return ["deck", "hand", "discard", "destroyed", "played"]; }

  cardOwner(card) {
    return this.players.find((player) => this.playerZones(player).some((zone) => player[zone].includes(card)));
  }

  removeFromPlayerZones(player, card) {
    for (const zone of this.playerZones(player)) remove(player[zone], card);
    remove(player.equipment, card);
    remove(player.exhaustedEquipment, card.instanceId);
  }

  moveCard(player, card, destination) {
    if (!player || !card || !this.playerZones(player).includes(destination)) return false;
    this.removeFromPlayerZones(player, card);
    player[destination].push(card);
    return true;
  }

  discardCard(player, card) {
    const moved = this.moveCard(player, card, "discard");
    if (moved) {
      this.track(card, "discarded", player);
      player.turnStats.discardedCardType = cardType(card); player.turnStats.discardedFocusValue = focus(card);
      if ([card.cardType, card.subtype, card.category].includes("Junk")) {
        const effects = this.cardEffects(player.character, "passive").filter((effect) => ["character.discardJunkDestroyChoice", "character.forcedJunkDiscardDestroyChoice"].includes(effect.resolver));
        if (effects.length && !this.pendingChoice) this.applyCardEffects(player, player.character, "passive", { opponent: this.players[1 - player.id], sourceCard: player.character, discardedJunk: true, discardedCard: card, effectOverride: effects });
      }
    }
    return moved;
  }

  destroyCard(player, card) {
    if (!this.moveCard(player, card, "destroyed")) return false;
    this.track(card, "destroyed", player);
    this.emit({ type: "card-destroyed", player: player.id, card: card.catalogId });
    return true;
  }

  equipmentIsExhausted(player, card) { return player.exhaustedEquipment.includes(card.instanceId); }

  setEquipmentReady(player, card, ready) {
    if (!card || !player.equipment.includes(card)) return false;
    if (ready) remove(player.exhaustedEquipment, card.instanceId);
    else if (!this.equipmentIsExhausted(player, card)) player.exhaustedEquipment.push(card.instanceId);
    this.track(card, ready ? "equipmentReadied" : "equipmentExhausted", player);
    this.emit({ type: ready ? "equipment-ready" : "equipment-exhaust", player: player.id, card: card.catalogId });
    return true;
  }

  addStatus(player, status) {
    player.statuses.push({ ...status, id: status.id ?? `${status.action ?? "status"}:${player.statuses.length + 1}` });
  }

  removeTemporaryNegativeStatModifier(player, amount = 1) {
    const removable = new Set(["modifyAttackPower", "modifyDefense", "modifyGuard", "modifySpeed"]);
    let removed = 0;
    player.statuses = player.statuses.filter((status) => {
      if (removed >= amount || !removable.has(status.action) || num(status.amount) >= 0) return true;
      removed += 1;
      return false;
    });
    player.turnStats.removedTemporaryNegativeStat = removed > 0;
    return removed;
  }

  statusValue(player, action, { consumeDuration = null } = {}) {
    let total = consumeDuration ? this.consumeStatuses(player, action, consumeDuration) : 0;
    for (const status of player.statuses) {
      if (status.action !== action || status.consumed) continue;
      if (status.duration === "whileEquipped" && status.sourceId && !player.equipment.some((card) => card.instanceId === status.sourceId)) continue;
      total += num(status.amount);
    }
    return total;
  }

  consumeStatuses(player, action, duration, context = {}) {
    let total = 0;
    for (const status of player.statuses) {
      if (status.action !== action || status.duration !== duration) continue;
      if (status.sourceId && context.sourceId && status.sourceId !== context.sourceId) continue;
      total += num(status.amount);
      if (duration) status.consumed = true;
    }
    player.statuses = player.statuses.filter((status) => !status.consumed);
    return total;
  }

  expireStatuses(player, duration) {
    for (const status of player.statuses) if (status.duration === duration && status.action === "speedRestore") player.speed = num(status.amount);
    if (duration === "endOfTurn") for (const card of [...player.equipment]) if (card.temporaryUntilHide) { remove(player.equipment, card); remove(player.played, card); player.discard.push(card); delete card.temporaryUntilHide; }
    player.statuses = player.statuses.filter((status) => status.duration !== duration);
  }

  hasStatus(player, action) { return player.statuses.some((status) => status.action === action && !status.consumed); }

  removeStatus(player, action) {
    const index = player.statuses.findIndex((status) => status.action === action && !status.consumed);
    if (index < 0) return false;
    player.statuses.splice(index, 1);
    return true;
  }

  effectUsageKey(effect) { return String(effect.id ?? effect.resolver ?? effect.action ?? "effect"); }

  hasUsedEffect(player, effect, scope) { return Boolean(player.effectUsage?.[scope]?.[this.effectUsageKey(effect)]); }

  markUsedEffect(player, effect) {
    const key = this.effectUsageKey(effect);
    player.effectUsage.turn[key] = true; player.effectUsage.round[key] = true; player.effectUsage.game[key] = true;
  }

  refillMarket(full = false) {
    const size = this.definition.economy.market.rowSize;
    if (full) { this.marketDiscard.push(...this.market); this.market = []; }
    while (this.market.length < size) {
      if (!this.marketDeck.length && this.marketDiscard.length) this.marketDeck = this.rng.shuffle(this.marketDiscard.splice(0));
      const next = this.marketDeck.pop(); if (!next) break; this.market.push(next); this.track(next, "offered");
    }
  }

  track(card, key, player, amount = 1) {
    const stats = this.cardStats.get(card.catalogId) ?? {
      id: card.catalogId, name: card.name, offered: 0, drawn: 0, purchased: 0,
      played: 0, discarded: 0, destroyed: 0, hits: 0, blocks: 0,
      damageDealt: 0, damagePrevented: 0, effectApplications: 0,
      equipmentReadied: 0, equipmentExhausted: 0, winnerOwned: 0,
    };
    stats[key] = (stats[key] ?? 0) + amount;
    if (player) (player._used ??= new Set()).add(card.catalogId);
    this.cardStats.set(card.catalogId, stats);
    const telemetryKey = {
      played: "cardsPlayed", purchased: "cardsAcquired", drawn: "cardsDrawn",
      discarded: "cardsDiscarded", destroyed: "cardsDestroyed",
      equipmentReadied: "equipmentReadied", equipmentExhausted: "equipmentExhausted",
    }[key];
    if (telemetryKey) this.telemetry[telemetryKey] += amount;
  }

  cardEffects(card, trigger) { return (this.effects.get(card.catalogId)?.effects ?? []).filter((effect) => effect.trigger === trigger); }

  revealLocation() {
    if (!this.locationDeck.length && this.locationDiscard.length) this.locationDeck = this.rng.shuffle(this.locationDiscard.splice(0));
    const next = this.locationDeck.pop();
    if (!next) return false;
    if (this.currentLocation) this.locationDiscard.push(this.currentLocation);
    this.currentLocation = next; this.sceneChangedThisRound = true;
    this.emit({ type: "scene-change", location: next.catalogId });
    return true;
  }

  applyLocationEvent(player, locationEvent, context = {}) {
    if (!this.currentLocation) return { ...context };
    const effects = this.cardEffects(this.currentLocation, "passive").filter((effect) => {
      const condition = (effect.conditions ?? []).find((entry) => entry.kind === "locationEvent");
      return !condition || condition.value === locationEvent;
    });
    if (!effects.length) return { ...context };
    return this.applyCardEffects(player, this.currentLocation, "passive", { ...context, locationEvent, sceneChanged: this.sceneChangedThisRound, sourceCard: this.currentLocation, effectOverride: effects });
  }

  evaluateConditions(effect, context) {
    const values = {
      isFastest: context.player.speed + context.player.tempSpeed > context.opponent.speed + context.opponent.tempSpeed,
      firstAttackThisTurn: context.player.attackCount === 1,
      firstNormalAttackThisTurn: context.player.attackCount === 1 && !context.attackCard?.tags?.includes("Reversal"),
      focusSpentEarlierThisTurn: (context.player.turnStats.focusSpent ?? 0) > 0,
      usedConsumableThisTurn: Boolean(context.player.turnStats.usedConsumableThisTurn),
      firstCardPlayedThisTurn: (context.player.turnStats.playsThisTurn ?? 0) === 1,
      attackNumber: context.player.attackCount,
      defenderPlayedDefense: Boolean(context.defensePlayed),
      targetHpAtMost: context.opponent.hp,
      hasTempo: Boolean(context.player.tempo),
      targetPermanentEquipmentCount: context.opponent.equipment.length,
      hasFewerCardsThanTarget: context.player.hand.length < context.opponent.hand.length,
      alternateZone: context.zone,
      attackZone: context.zone,
      attackZones: context.zone,
      incomingZones: context.zone,
      incomingAttackTargetsSelf: Boolean(context.targetsSelf ?? true),
      sourceExhausted: Boolean(context.sourceCard && context.player && this.equipmentIsExhausted(context.player, context.sourceCard)),
      firstDamageThisRound: (context.player.turnStats.damageTaken ?? 0) === 0 || context.damage > 0 && (context.player.turnStats.damageTaken ?? 0) === context.damage,
      blockedThisRound: Boolean(context.player.turnStats.blocked),
      playedDefenseSinceLastTurn: Boolean(context.player.turnStats.playedDefenseSinceLastTurn),
      previousAttackHit: Boolean(context.player.turnStats.previousAttackHit),
      differentZoneFromPreviousAttack: context.player.turnStats.previousZone ? context.player.turnStats.previousZone !== context.zone : false,
      wasHitSinceLastTurn: Boolean(context.player.lastTurnWasHit),
      firstDefenseThisRound: (context.player.turnStats.defenseCount ?? 0) === 0,
      firstIncomingAttackThisRound: (context.player.turnStats.incomingAttackCount ?? 0) === 1,
      firstKataThisTurn: (context.player.turnStats.kataCount ?? 0) === 0,
      firstHitThisTurn: context.damage > 0 ? context.player.turnStats.hitCount === 1 : !context.player.turnStats.hit,
      oncePerTurn: !this.hasUsedEffect(context.player, effect, "turn"),
      oncePerRound: !this.hasUsedEffect(context.player, effect, "round"),
      oncePerGame: !this.hasUsedEffect(context.player, effect, "game"),
      sameRoundOnly: true,
      sameTurnOnly: true,
      ownTurn: context.player.id === this.activePlayer,
      firstMatchingPerRound: !this.hasUsedEffect(context.player, effect, "round"),
      firstMatchingPerTurn: !this.hasUsedEffect(context.player, effect, "turn"),
      equipmentTagAny: context.sourceCard?.tags ?? context.attackCard?.tags ?? [],
      xpSourceAny: context.xpFromLegalAttackOrDefense ? ["Attack", "Defense"] : [],
      isKoXp: Boolean(context.isKoXp),
      kataGrantedFlowThisAttack: Boolean(context.player.nextAttackFlow),
      firstKataFlowThisTurn: (context.player.turnStats.kataFlowCount ?? 0) === 0,
      cardTypeAny: context.purchasedCard?.cardType ?? context.attackCard?.subtype ?? context.resolvedCardType,
      attackedThisTurn: Boolean(context.player.turnStats.attacked),
      printedCostAtLeast: context.marketCard ? cost(context.marketCard) : context.purchaseCost ?? 0,
      isComboFinisher: Boolean(context.isComboFinisher),
      healingSourceAny: context.healingSource ? [context.healingSource] : [],
      usesSceneChosenCounterZone: Boolean(context.zone && context.sceneChosenZone === context.zone),
      attackHit: Boolean(context.damage > 0),
      sameRoundAsSceneChoice: Boolean(context.sameRoundAsSceneChoice ?? true),
      reductionSourceAny: context.reductionSource ? [context.reductionSource] : [],
      firstConsumableThisTurn: context.player.turnStats.consumableCount === 1,
      firstItemPurchaseThisAscend: context.player.turnStats.boughtCardThisTurn === true && !context.player.turnStats.previousItemPurchase,
      cardSubtypeOrTagAny: context.purchasedCard ? [context.purchasedCard.subtype, ...(context.purchasedCard.tags ?? [])] : [],
      comboIsLearned: Boolean(context.comboIsLearned),
      isSlowest: context.player.speed + context.player.tempSpeed < context.opponent.speed + context.opponent.tempSpeed,
      firstAcrossPlayersPerRound: !this.hasUsedEffect(context.player, effect, "round"),
      hasWeaponEquipped: context.player.equipment.some((entry) => entry.subtype === "Weapon"),
      equipmentExhaustedEarlierThisRound: Boolean(context.equipmentExhaustedEarlierThisRound),
      firstEquipmentExhaustThisRound: Boolean(context.equipmentExhaustedEarlierThisRound),
      equippedCardTagAny: context.equippedCard?.tags ?? [],
      firstMatchingPerSceneStay: !this.hasUsedEffect(context.player, effect, "game"),
      targetSpeedHigher: context.opponent.speed + context.opponent.tempSpeed > context.player.speed + context.player.tempSpeed,
      targetXpHigher: context.opponent.xp > context.player.xp,
      targetTempoUsed: !context.opponent.tempo,
      hasWeaponEquipped: context.player.equipment.some((card) => card.subtype === "Weapon"),
      playedKataThisTurn: (context.player.turnStats.kataCount ?? 0) > 0,
      completedBeltExamThisRound: Boolean(context.player.turnStats.completedBeltExamThisRound),
      blockedSinceLastTurn: Boolean(context.player.lastTurnWasBlocked),
      priorLowAttack: context.player.turnStats.previousZone === "Low",
      previousAttackBlocked: Boolean(context.player.turnStats.previousAttackBlocked),
      previousCardIsItemOrConsumable: ["Item", "Consumable"].includes(context.player.turnStats.previousCardType),
      previousCardIsItem: ["Item", "Consumable"].includes(context.player.turnStats.previousCardType),
      previousCardIsKataOrItem: ["Kata", "Item", "Consumable"].includes(context.player.turnStats.previousCardType),
      previousAttackZoneMidOrHigh: ["Mid", "High"].includes(context.player.turnStats.previousZone),
      priorDifferentZoneCount: context.player.turnStats.zones.size,
      priorPunchAttack: Boolean(context.player.turnStats.previousAttackTags?.includes("Punch")),
      priorSpinAttack: Boolean(context.player.turnStats.previousAttackTags?.includes("Spin")),
      priorJumpOrSpinAttack: Boolean(context.player.turnStats.previousAttackTags?.some((tag) => ["Jump", "Spin"].includes(tag))),
      focusGeneratedThisTurn: context.player.turnStats.focusGenerated ?? 0,
      hasImprovisedWeapon: context.player.equipment.some((card) => card.subtype === "Gear" && (card.tags ?? []).includes("Improvised")),
      dealtDamagePreviousTurn: !context.player.lastTurnWasHit,
      nextMatchingAttack: Boolean(context.player.statuses.some((status) => status.duration === "nextAttack")),
      firstAttackAfterKataThisTurn: context.player.attackCount === 1 && context.player.turnStats.kataCount > 0,
      equippedThisTurn: Boolean(context.player.turnStats.equippedThisTurn),
      didNotAttackPreviousTurn: !context.player.lastTurnAttacked,
      hasNotAttackedThisTurn: context.player.attackCount === 1,
      firstAttackWithTagThisTurn: context.attackCard?.tags ?? [],
      defenseHasTag: context.defenseCard?.tags ?? [],
      defenseTagAny: context.defenseCard?.tags ?? [],
      incomingAttackZone: context.zone,
      attackBlocked: Boolean(context.previousAttackBlocked ?? (context.damage !== undefined && context.damage <= 0)),
      firstComboThisTurn: (context.player.turnStats.comboCount ?? 0) === 1,
      firstConsumableThisTurn: context.player.turnStats.usedConsumableThisTurn === true && (context.player.turnStats.consumableCount ?? 0) === 1,
      firstConsumableUsedThisTurn: context.player.turnStats.usedConsumableThisTurn === true && (context.player.turnStats.consumableCount ?? 0) === 1,
      firstHighAttackThisTurn: context.zone === "High" && context.player.attackCount === 1,
      firstHitWithSourceThisRound: Boolean(context.damage > 0 && context.player.turnStats.hitCount === 1),
      hasTwoPairedWeapons: context.player.equipment.filter((card) => card.subtype === "Weapon" && (card.tags ?? []).includes("Paired")).length >= 2,
      marketEndSlot: Boolean(context.marketCard && this.market.at(-1) === context.marketCard),
      playedAsReversal: Boolean(context.attackCard?.tags?.includes("Reversal")),
      boughtCardLastAscend: Boolean(context.player.turnStats.boughtCardThisAscend),
      costPaid: Boolean(context.costPaid ?? context.purchaseCost !== undefined),
      consumableUsedThisRound: Boolean(context.player.turnStats.usedConsumableThisRound || context.player.turnStats.usedConsumableThisTurn),
      purchaseCompleted: Boolean(context.purchaseCompleted),
      purchasedCardCost: context.purchaseCost ?? 0,
      ascendCompleted: Boolean(context.ascendCompleted),
      boughtCardThisAscend: Boolean(context.player.turnStats.boughtCardThisAscend),
      nextAttackDifferentZone: context.player.turnStats.previousZone ? context.player.turnStats.previousZone !== context.zone : false,
      nextAttackHasTag: context.attackCard?.tags ?? [],
      equippedCardIsSource: Boolean(context.equippedCard && context.equippedCard === context.sourceCard),
      incomingDamageAtLeast: context.incomingDamage ?? context.player.turnStats.damageTaken ?? 0,
      xpFromLegalAttackOrDefense: Boolean(context.xpFromLegalAttackOrDefense),
      sameOpponentAsBlockedAttack: context.player.turnStats.previousOpponentId === context.opponent.id,
      nextPurchaseOnly: true,
      minimumFinalCost: context.purchaseCost ?? Number.MAX_SAFE_INTEGER,
      manualActivation: Boolean(context.manualActivation),
      pendingFromSource: Boolean(context.sourceCard && this.equipmentIsExhausted(context.player, context.sourceCard)),
      defenseOutsideTurn: Boolean(context.defenseOutsideTurn),
      equippedCardIsOtherPermanentEquipment: Boolean(context.equippedCard && context.equippedCard !== context.sourceCard && ["Weapon", "Gear", "Defense Equipment"].includes(context.equippedCard.subtype)),
      drawAfterCost: 1,
      discardCost: 1,
      draw: 1,
      discard: 1,
      grantFlowTo: "nextAttack",
      window: context.phase ?? this.phase,
      nextPurchase: true,
      discount: 1,
      minimumCost: 0,
      minimumPrintedCost: 0,
      firstMatchingPerRound: !this.hasUsedEffect(context.player, effect, "round"),
      firstMatchingPerTurn: !this.hasUsedEffect(context.player, effect, "turn"),
      targetHasTemporaryNegativeStat: context.opponent.statuses.some((status) => num(status.amount) < 0),
      targetHasExhaustedEquipment: context.opponent.exhaustedEquipment.length > 0,
      selfSpeedChangedThisRound: context.player.tempSpeed !== 0 || context.player.statuses.some((status) => status.action === "modifySpeed"),
      incomingAttackIsUnarmed: !context.opponent.equipment.some((card) => card.subtype === "Weapon"),
      firstCombatDamageThisRound: context.damage > 0 ? context.player.turnStats.damageTaken === context.damage : context.player.turnStats.damageTaken === 0,
      firstDamagingAttackThisRound: context.damage > 0 ? context.player.turnStats.damageTaken === context.damage : context.player.turnStats.damageTaken === 0,
      combatDamageDealt: Boolean(context.damage > 0),
      firstHitWithSourceThisTurn: context.damage > 0 && context.player.turnStats.hitCount === 1,
      firstCombatDamageWithSourceThisTurn: context.damage > 0 && context.player.turnStats.hitCount === 1,
      attackHasAnyTag: context.attackCard?.tags ?? [],
      damageSourceIsWeapon: Boolean(context.attackCard?.tags?.includes("Weapon") || context.attackCard?.subtype === "Weapon"),
      attackedThisTurn: Boolean(context.player.turnStats.attacked),
      firstDifferentZoneSequenceThisTurn: context.player.turnStats.zones.size === 1,
      focusGeneratedBySingleCard: Boolean(context.player.turnStats.focusGenerated > 0),
      firstQualifyingHitThisTurn: context.damage > 0 && context.player.turnStats.hitCount === 1,
      playedAttackThisTurn: Boolean(context.player.turnStats.attacked),
      discardedFocusValue: context.player.turnStats.discardedFocusValue ?? 0,
      discardedCardType: context.player.turnStats.discardedCardType ?? null,
      marketCardsRemaining: this.market?.length ?? 0,
      hpAtOrBelowHalfMax: context.player.hp <= context.player.maxHp / 2,
      beltAtLeast: ["White", "Gold", "Orange", "Green", "Purple", "Blue", "Red", "Brown", "Black"][context.player.beltIndex] ?? "White",
      completesActiveBeltExam: Boolean(context.player.turnStats.completedBeltExamThisRound),
      examRequirementCompleted: Boolean(context.player.turnStats.completedBeltExamThisRound),
      goldBeltExamThirdZone: context.player.beltIndex === 1 && context.player.turnStats.zones.size >= 3,
      sourceArmorHelpedBlock: Boolean(context.sourceCard?.subtype === "Defense Equipment" && context.block > 0),
      firstArmorBlockThisRound: context.sourceCard?.subtype === "Defense Equipment" && (context.player.turnStats.armorBlocksThisRound ?? 0) === 0,
      armedEquipmentZoneMatched: Boolean(!context.sourceCard?.zone || context.sourceCard.zone === "Any" || context.sourceCard.zone === context.zone),
      currentCardType: context.sourceCard?.cardType ?? context.sourceCard?.subtype,
      cardType: context.sourceCard?.cardType ?? context.sourceCard?.subtype,
      cardTypeAny: context.sourceCard?.cardType ?? context.sourceCard?.subtype,
      resolvedCardType: context.sourceCard?.cardType ?? context.sourceCard?.subtype,
      attackUsesSourceEquipment: Boolean(context.attackCard?.tags?.includes("Weapon") || context.sourceCard?.subtype === "Weapon"),
      incomingAttackUsesWeapon: Boolean(context.attackCard?.tags?.includes("Weapon") || context.attackCard?.subtype === "Weapon"),
      attackHasTag: context.attackCard?.tags ?? [],
      attackTagAny: context.attackCard?.tags ?? [],
      minimumBelt: ["White", "Gold", "Orange", "Green", "Purple", "Blue", "Red", "Brown", "Black"][context.player.beltIndex] ?? "White",
      currentAttackIsNormal: !context.attackCard?.tags?.includes("Reversal"),
      attackIsReversal: Boolean(context.attackCard?.tags?.includes("Reversal")),
      attackIsUnarmed: !context.player.equipment.some((card) => card.subtype === "Weapon"),
      targetHasMatchingArmor: context.opponent.equipment.some((card) => card.subtype === "Defense Equipment" && (card.tags ?? []).some((tag) => (context.attackCard?.tags ?? []).includes(tag))),
    };
    const beltRank = (value) => ["White", "Gold", "Orange", "Green", "Purple", "Blue", "Red", "Brown", "Black"].indexOf(String(value));
    const parse = (condition) => {
      if (typeof condition !== "string") return condition;
      const fields = Object.fromEntries([...condition.matchAll(/([a-zA-Z]+)=([^;}]*)/g)].map((match) => [match[1], match[2]]));
      const value = fields.value === "True" || fields.value === "true" ? true : fields.value === "False" || fields.value === "false" ? false : Number.isNaN(Number(fields.value)) ? fields.value : Number(fields.value);
      return { kind: fields.kind, operator: fields.operator ?? "eq", value };
    };
    const compare = (actual, operator, expected) => {
      if (Array.isArray(expected) && (operator === "eq" || operator === "includes" || operator === "includesAny")) return expected.includes(actual);
      if (operator === "includesAny") return Array.isArray(expected) && expected.some((value) => Array.isArray(actual) && actual.includes(value));
      if (operator === "includes") return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? "").includes(String(expected ?? ""));
      if (operator === "notIncludes") return Array.isArray(actual) ? !actual.includes(expected) : !String(actual ?? "").includes(String(expected ?? ""));
      if (operator === "gt") return Number(actual) > Number(expected);
      if (operator === "gte") return Number(actual) >= Number(expected);
      if (operator === "lt") return Number(actual) < Number(expected);
      if (operator === "lte") return Number(actual) <= Number(expected);
      if (operator === "neq") return actual !== expected;
      return actual === expected;
    };
    for (const raw of effect.conditions ?? []) {
      const condition = parse(raw); const kind = String(condition?.kind ?? "");
      if (kind === "always") continue;
      // These are structured effect parameters, not predicates over mutable
      // game state. Their consumers validate them when creating the choice.
      if (["choiceKind", "choiceOptions", "sourceZone", "cardFamily", "permanentOnly", "equipNow", "ifSubtype", "gearEntersReady", "gearNextAttackPower", "additionalFocusGenerated", "destination", "thenDiscard", "eligibleSubtypes", "gearBonus", "zones", "drawIfSourceZone", "drawAmount", "lookCount", "eligibleTypes", "keepCount", "restAction", "optionalKeep", "differentCardTypesFocus", "noMatchFocus", "piercingScope", "scope", "duration", "focusGain", "allowedZones", "chooseZone", "discardCount", "drawCount", "maximumLoss", "nextItemOnly", "afterThatConsumable", "attackTiming", "appliesTo", "itemCostPenalty", "defenseGuardPenalty", "minimumDraw", "sourceActivationArmed", "equippedCardSubtypeIn"].includes(kind) || structuredParameterKinds.has(kind)) continue;
      if (!(kind in values)) return { known: false, pass: false };
      if (kind === "nextPurchaseOnly") continue;
      if (["minimumCost", "minimumPrintedCost", "discount"].includes(kind) && context.purchaseCost === undefined) continue;
      if (kind === "minimumFinalCost" && context.purchaseCost === undefined) continue;
      if (kind === "minimumBelt") { if (beltRank(values[kind]) < beltRank(condition.value)) return { known: true, pass: false }; continue; }
      if (kind === "beltAtLeast") { if (beltRank(values[kind]) < beltRank(condition.value)) return { known: true, pass: false }; continue; }
      if (["attackTagAny", "attackHasTag", "attackHasAnyTag"].includes(kind)) { const tags = values[kind]; const expected = Array.isArray(condition.value) ? condition.value : [condition.value]; if (!expected.some((tag) => tags.includes(tag))) return { known: true, pass: false }; continue; }
      if (["firstAttackWithTagThisTurn", "defenseHasTag"].includes(kind)) { const expected = Array.isArray(condition.value) ? condition.value : [condition.value]; if (!expected.some((tag) => values[kind].includes(tag))) return { known: true, pass: false }; continue; }
      if (!compare(values[kind], condition.operator ?? "eq", condition.value)) return { known: true, pass: false };
    }
    return { known: true, pass: true };
  }

  applyPassiveEquipment(player, opponent, context = {}) {
    const result = { player, opponent, ...context };
    for (const equipment of player.equipment) {
      const next = this.applyCardEffects(player, equipment, "passive", { ...result, sourceCard: equipment });
      for (const key of ["attackPowerModifier", "guardModifier", "defenseModifier", "damagePrevention", "piercing"]) if (next[key] !== undefined) result[key] = (result[key] ?? 0) + (next[key] ?? 0);
    }
    return result;
  }

  applyCharacterEffects(player, trigger, context = {}) {
    const effects = this.cardEffects(player.character, trigger);
    if (!effects.length) return {};
    return this.applyCardEffects(player, player.character, trigger, { ...context, sourceCard: player.character, effectOverride: effects });
  }

  applyEquipmentWatchers(player, resolver, context = {}) {
    for (const equipment of player.equipment) {
      const effects = this.cardEffects(equipment, "passive").filter((effect) => effect.resolver === resolver && (!context.watchCondition || (effect.conditions ?? []).some((condition) => condition.kind === context.watchCondition)));
      if (effects.length) this.applyCardEffects(player, equipment, "passive", { opponent: this.players[1 - player.id], sourceCard: equipment, ...context, effectOverride: effects });
    }
  }

  applyEquipmentTrigger(player, trigger, context = {}) {
    for (const equipment of player.equipment) this.applyCardEffects(player, equipment, trigger, { opponent: this.players[1 - player.id], sourceCard: equipment, ...context });
  }

  equipmentHasManualActivation(card) {
    return this.cardEffects(card, "passive").some((effect) => (effect.conditions ?? []).some((condition) => (typeof condition === "string" ? condition : condition.kind) === "manualActivation"));
  }

  activateEquipment(player, card) {
    if (!card || !player.equipment.includes(card) || this.equipmentIsExhausted(player, card) || !this.equipmentHasManualActivation(card)) return false;
    this.applyCardEffects(player, card, "passive", { opponent: this.players[1 - player.id], sourceCard: card, manualActivation: true, attackCard: null });
    this.setEquipmentReady(player, card, false);
    return true;
  }

  unsupportedEffect(card, effect) { this.telemetry.unsupportedEffects += 1; this.emit({ type: "unsupported-effect", player: null, card: card.catalogId, effect: effect.id, action: effect.action ?? null }); }

  queueCardChoice(player, targetPlayer, effect, movement, amount = 1) {
    const requestedZones = (effect.conditions ?? []).find((condition) => condition.kind === "zones")?.value;
    const sourceZones = Array.isArray(requestedZones) && requestedZones.length ? requestedZones : ["hand"];
    const requestedType = (effect.conditions ?? []).find((condition) => condition.kind === "cardType")?.value;
    const candidates = sourceZones.flatMap((zone) => targetPlayer[zone] ?? []).filter((candidate) => !requestedType || [candidate.cardType, candidate.subtype, candidate.category].includes(requestedType));
    const options = candidates.map((candidate) => ({ id: candidate.instanceId, label: candidate.name }));
    if (!options.length) return false;
    this.pendingChoice = {
      kind: "card-movement", playerId: player.id, targetPlayerId: targetPlayer.id, movement, amount,
      sourceZones, sourceCardId: effect.sourceCardId ?? null, effectId: effect.id ?? null,
      drawIfSourceZone: (effect.conditions ?? []).find((condition) => condition.kind === "drawIfSourceZone")?.value ?? null,
      drawAmount: num((effect.conditions ?? []).find((condition) => condition.kind === "drawAmount")?.value ?? 0),
      options,
    };
    return true;
  }

  resolveCardMovementChoice(pending, selected) {
    const targetPlayer = this.players[pending.targetPlayerId];
    const sourceZone = pending.sourceZones.find((zone) => (targetPlayer[zone] ?? []).some((candidate) => candidate.instanceId === selected));
    const card = sourceZone ? targetPlayer[sourceZone].find((candidate) => candidate.instanceId === selected) : null;
    if (!card) return false;
    if (pending.movement === "discard") this.discardCard(targetPlayer, card);
    else if (pending.movement === "destroy") this.destroyCard(targetPlayer, card);
    else return false;
    if (pending.drawIfSourceZone === sourceZone && pending.drawAmount > 0) this.draw(targetPlayer, pending.drawAmount);
    const remaining = Number(pending.amount ?? 1) - 1;
    this.pendingChoice = null;
    if (remaining > 0 && this.queueCardChoice(this.players[pending.playerId], targetPlayer, pending, pending.movement, remaining)) return true;
    return true;
  }

  queueDiscardDrawChoice(player, effect) {
      const candidates = effect.candidateType ? player.hand.filter((card) => [card.cardType, card.subtype, card.category].includes(effect.candidateType)) : player.hand;
      this.pendingChoice = { kind: "cycle-discard-draw", playerId: player.id, drawAmount: num(effect.drawAmount ?? effect.amount ?? 1), postDrawDiscard: effect.postDrawDiscard === true, revealSelected: effect.revealSelected === true, sourceCardId: effect.sourceCardId ?? null, effectId: effect.id ?? null, options: [{ id: "skip", label: "Skip" }, ...candidates.map((card) => ({ id: card.instanceId, label: card.name }))] };
    return true;
  }

  queueIncomingAttackChoice(player, effect, context) {
    this.pendingChoice = { kind: "incoming-attack-choice", playerId: player.id, targetPlayerId: context.opponent?.id ?? null, effectId: effect.id ?? null, options: [{ id: "accept", label: "Lose 1 Speed and reduce this Attack by 1" }, { id: "skip", label: "Keep Speed" }] };
    return true;
  }

  queueEquipmentToggleChoice(player, effect) {
    const options = player.equipment.map((card) => ({ id: card.instanceId, label: card.name }));
    if (!options.length) return false;
    this.pendingChoice = { kind: "equipment-toggle", playerId: player.id, effectId: effect.id ?? null, options };
    return true;
  }

  queueDiscardOrDestroyChoice(player, effect, context) {
    const card = context.discardedCard;
    if (!card || !player.discard.includes(card)) return false;
    this.pendingChoice = { kind: "discard-or-destroy", playerId: player.id, cardId: card.instanceId, effectId: effect.id ?? null, options: [{ id: "destroy", label: "Destroy the discarded Junk" }, { id: "keep", label: "Leave it in the discard pile" }] };
    return true;
  }

  queueDeckLookChoice(player, effect) {
    const lookCount = num((effect.conditions ?? []).find((condition) => condition.kind === "lookCount")?.value ?? (["consumable.topThreeAttackSelection", "consumable.reorderTopThree"].includes(effect.resolver) ? 3 : effect.resolver === "defense.deckLookChoice" ? 2 : 1));
    const eligible = (effect.conditions ?? []).find((condition) => condition.kind === "eligibleTypes")?.value ?? (effect.resolver === "consumable.topThreeAttackSelection" ? ["Attack"] : []);
    const looked = player.deck.slice(-Math.max(0, lookCount));
    const options = looked.filter((card) => !eligible.length || eligible.includes(card.cardType) || eligible.includes(card.subtype) || eligible.includes(card.category)).map((card) => ({ id: card.instanceId, label: card.name }));
    player.revealed.push(...looked); this.telemetry.cardsRevealed += looked.length;
    this.pendingChoice = {
      kind: "deck-look", playerId: player.id, lookedCardIds: looked.map((card) => card.instanceId),
      restAction: (effect.conditions ?? []).find((condition) => condition.kind === "restAction")?.value ?? (["consumable.topThreeAttackSelection", "defense.deckLookChoice"].includes(effect.resolver) ? "discard" : "reorder"),
      focusIfNoMatch: num((effect.conditions ?? []).find((condition) => condition.kind === "noMatchFocus")?.value ?? 0),
      focusIfDifferentTypes: num((effect.conditions ?? []).find((condition) => condition.kind === "differentCardTypesFocus")?.value ?? 0),
      discardFocusCardType: effect.resolver === "defense.deckLookChoice" ? "Junk" : null,
      options: [{ id: "skip", label: "Keep the revealed cards" }, ...options],
    };
    return true;
  }

  queueZoneChoice(player, effect, { zones: allowedZones = [], operation, destination = null } = {}) {
    const source = allowedZones.flatMap((zone) => player[zone] ?? []);
    const filtered = source.filter((card) => {
      const conditions = effect.conditions ?? [];
      const cardFamily = conditions.find((condition) => condition.kind === "cardFamily")?.value;
      const cardType = conditions.find((condition) => condition.kind === "cardType")?.value;
      const eligibleSubtypes = conditions.find((condition) => condition.kind === "eligibleSubtypes")?.value ?? [];
      const permanentOnly = conditions.some((condition) => condition.kind === "permanentOnly" && condition.value === true);
      if (cardFamily && ![card.cardType, card.subtype, card.category].includes(cardFamily)) return false;
      if (cardType && ![card.cardType, card.subtype, card.category].includes(cardType)) return false;
      if (eligibleSubtypes.length && !eligibleSubtypes.includes(card.subtype)) return false;
      if (permanentOnly && !["Weapon", "Gear", "Defense Equipment"].includes(card.subtype)) return false;
      return true;
    });
    if (!filtered.length) return false;
    this.pendingChoice = {
      kind: "zone-choice", playerId: player.id, sourceZones: allowedZones, operation,
      destination, sourceCardId: effect.sourceCardId ?? null, effectId: effect.id ?? null,
      gearBonus: (effect.conditions ?? []).find((condition) => condition.kind === "gearBonus")?.value ?? null,
      gearEntersReady: (effect.conditions ?? []).some((condition) => condition.kind === "gearEntersReady" && condition.value === true),
      gearNextAttackPower: num((effect.conditions ?? []).find((condition) => condition.kind === "gearNextAttackPower")?.value ?? 0),
      additionalFocusGenerated: num((effect.conditions ?? []).find((condition) => condition.kind === "additionalFocusGenerated")?.value ?? 0),
      options: filtered.map((card) => ({ id: card.instanceId, label: card.name })),
    };
    return true;
  }

  resolveZoneChoice(pending, selected) {
    const player = this.players[pending.playerId];
    const card = pending.sourceZones.flatMap((zone) => player[zone] ?? []).find((candidate) => candidate.instanceId === selected);
    if (!card) return false;
    if (pending.operation === "recover-then-discard") {
      this.moveCard(player, card, "hand");
      this.pendingChoice = null;
      const discardEffect = { id: `${pending.effectId ?? "recover"}:discard`, sourceCardId: pending.sourceCardId };
      return this.queueCardChoice(player, player, discardEffect, "discard", 1);
    }
    if (pending.operation === "recycle") {
      this.moveCard(player, card, "deck");
      remove(player.deck, card); player.deck.unshift(card);
      if (pending.gearBonus === "readyOneEquipment") {
        const target = player.equipment.find((candidate) => this.equipmentIsExhausted(player, candidate));
        if (target) this.setEquipmentReady(player, target, true);
      }
      this.pendingChoice = null;
      return true;
    }
    if (pending.operation === "equip-from-hand") {
      remove(player.hand, card); player.played.push(card); player.equipment.push(card); player.turnStats.equippedThisTurn = true;
      if (pending.gearEntersReady && card.subtype === "Gear") this.setEquipmentReady(player, card, true);
      if (pending.gearNextAttackPower && card.subtype === "Gear") player.nextAttackPower += pending.gearNextAttackPower;
      if (pending.additionalFocusGenerated) { player.focus += pending.additionalFocusGenerated; player.turnStats.focusGenerated += pending.additionalFocusGenerated; this.telemetry.focusGenerated += pending.additionalFocusGenerated; }
      this.pendingChoice = null;
      return true;
    }
    if (pending.operation === "equip-from-discard") {
      remove(player.discard, card); player.played.push(card); player.equipment.push(card); card.temporaryUntilHide = true; player.turnStats.equippedThisTurn = true;
      this.pendingChoice = null;
      return true;
    }
    return false;
  }

  queueHitChoice(player, effect, opponent) {
    const kind = (effect.conditions ?? []).find((condition) => condition.kind === "choiceKind")?.value;
    const options = kind === "courtesy-notice"
      ? [{ id: "item-cost-penalty", label: "Next Item costs +1 Focus" }, { id: "defense-guard-penalty", label: "Next Defense gets -1 Guard" }]
      : kind === "discount-dim-mak"
        ? [{ id: "tempo-loss", label: "Lose Tempo" }, { id: "gain-focus", label: "Gain 1 Focus" }]
        : [{ id: "gain-focus", label: "Gain 1 Focus" }, { id: "cycle", label: "Draw 1, then discard 1" }];
    this.pendingChoice = { kind: "hit-choice", playerId: player.id, targetPlayerId: opponent.id, effectId: effect.id ?? null, choiceKind: kind, options };
    return true;
  }

  structuredParams(effect) {
    return Object.fromEntries((effect.conditions ?? []).map((condition) => [String(condition.kind ?? ""), condition.value]));
  }

  applyStructuredEffect(player, card, effect, context) {
    const resolver = String(effect.resolver ?? "");
    const params = this.structuredParams(effect);
    const opponent = context.opponent ?? this.players[1 - player.id];
    const amount = num(effect.amount);
    const target = effect.target === "opponent" ? opponent : player;
    const add = (action, value, duration = effect.duration ?? "immediate", subject = target) => {
      if (duration && duration !== "immediate") this.addStatus(subject, { action, amount: value, duration, sourceId: card.instanceId });
      else {
        const key = action === "modifyAttackPower" ? "attackPowerModifier" : action === "modifyGuard" ? "guardModifier" : action === "modifyDefense" ? "defenseModifier" : action === "preventDamage" ? "damagePrevention" : `${action}Modifier`;
        context[key] = (context[key] ?? 0) + value;
      }
    };

    // Final attack semantics are shared by card, AI, and simulator. Passive
    // attack effects are evaluated in resolveAttack before defense commits.
    if (resolver === "attack.final.defensiveReaction") {
      if ((params.incomingZones ?? []).includes(context.zone)) context.reactionDefense = (context.reactionDefense ?? 0) + amount;
      return true;
    }
    if (resolver === "attack.final.comboMultiplicity") {
      context.comboMultiplicity = Math.max(context.comboMultiplicity ?? 1, amount || 1);
      return true;
    }
    if (resolver === "attack.final.fireDrillFeint") {
      if (player.hand.length) this.queueCardChoice(player, player, { ...effect, sourceCardId: card.instanceId }, "discard", Math.max(1, num(params.discardCost ?? 1)));
      return true;
    }
    if (resolver === "attack.final.cycle") {
      if (context.nonHonorSceneChangedThisRound) {
        if (effect.action === "draw") this.draw(player, amount);
        if (effect.action === "discard") this.queueCardChoice(player, player, effect, "discard", amount);
      }
      return true;
    }

    if (resolver === "equipment.structured") {
      if (effect.action !== "custom") return false;
      if (params.choiceKind) {
        const options = params.choiceKind === "incoming-zone" || params.choiceKind === "next-attack-zone" ? zones : ["accept", "skip"];
        context.choice = { kind: "structured", effectId: effect.id, options };
        this.addStatus(player, { action: params.choiceKind, value: options[0], duration: effect.duration ?? "endOfRound", sourceId: card.instanceId });
        return true;
      }
      if (params.sourceAffectedCountThreshold !== undefined) {
        const count = Number(card.affectedCount ?? context.sourceAffectedCount ?? 0);
        if (count >= Number(params.sourceAffectedCountThreshold)) this.destroyCard(player, card);
        return true;
      }
      if (params.selfIsLowestXp) { if (player.xp <= opponent.xp) add("modifyDefense", amount || 1); return true; }
      if (params.oncePerGame && effect.trigger === "onAttackDeclared" && effect.target === "self") { add("modifyAttackPower", -(context.attackPower ?? 0), "nextAttack"); this.markUsedEffect(player, effect); return true; }
      if (params.oncePerGame && resolver === "equipment.structured" && effect.trigger === "passive" && context.attackCard) { add("preventDamage", 99, "nextAttack"); this.markUsedEffect(player, effect); return true; }
      if (effect.trigger === "onHit" && params.attackUsesSourceEquipment) {
        if (effect.target === "opponent" && params.scheduledTiming === "endOfTargetNextTurn") target.hp -= Math.max(0, amount);
        else if (effect.target === "opponent" && params.scheduledTiming === "nextRound") add("modifySpeed", amount);
        else if (effect.target === "opponent" && params.scheduledTiming === "nextInitiate") add("modifyDefense", amount);
        else if (effect.target === "opponent" && amount) target.tempSpeed += amount;
        else if (effect.target === "self" && amount) add("modifyDefense", amount, params.scheduledTiming === "nextInitiate" ? "nextHonor" : effect.duration);
        return true;
      }
      if (effect.trigger === "onHide" && params.minimumDraw !== undefined) { this.draw(player, Math.max(0, Number(params.minimumDraw))); return true; }
      if (effect.trigger === "onBlock" && params.firstArmorBlockThisRound) { player.turnStats.completedBeltExamThisRound = true; return true; }
      if (params.discardedByEffect) { this.moveCard(player, card, "hand"); return true; }
      if (effect.trigger === "passive" && effect.duration === "whileEquipped" && !context.attackCard) { this.addStatus(player, { action: "equipmentRestriction", value: card.catalogId, duration: "whileEquipped", sourceId: card.instanceId }); return true; }
      if (params.firstNegativeCombatModifierThisRound) { this.removeTemporaryNegativeStatModifier(player, 1); return true; }
      if (effect.action === "custom" && amount) add("modifyAttackPower", amount);
      return true;
    }

    if (resolver.startsWith("location.")) {
      const operation = params.locationOperation;
      if (operation === "modifyPurchaseCost") this.addStatus(player, { action: "modifyCost", amount, duration: "nextPurchase", sourceId: card.instanceId });
      else if (operation === "modifyHealing") this.addStatus(player, { action: "modifyHealing", amount, duration: "scene", sourceId: card.instanceId });
      else if (operation === "modifyXpGain" || operation === "modifyKoXp") this.addStatus(player, { action: operation, amount, duration: "round", sourceId: card.instanceId });
      else if (operation === "modifyStandingAttack" || operation === "modifyWeaponAttackBonus") add("modifyAttackPower", amount);
      else if (operation === "modifyStandingDefense" || operation === "modifyWeaponArmorPrintedBonus" || operation === "modifyReadiedEquipmentPrintedBonus" || operation === "modifyDefensiveEquipmentContribution") add("modifyDefense", amount);
      else if (operation === "modifyComboPrintedNumericEffect") context.comboNumericModifier = (context.comboNumericModifier ?? 0) + amount;
      else if (operation === "increaseDamageReduction") this.addStatus(player, { action: "preventDamage", amount, duration: "round", sourceId: card.instanceId });
      else if (operation === "setKataFocusGeneration") this.addStatus(player, { action: "kataFocusBonus", amount: Number(params.fixedValue ?? amount), duration: "turn", sourceId: card.instanceId });
      else if (operation === "drawThenDiscard" || operation === "discardJunkDrawGainFocus") this.queueDiscardDrawChoice(player, { ...effect, drawAmount: Number(params.drawCount ?? 1) });
      else if (operation === "loseFocusIfAble") target.focus = Math.max(0, target.focus - Math.max(0, amount || 1));
      else if (operation === "destroyJunkGainFocusLoseHp") { const junk = player.hand.find((candidate) => candidate.subtype === "Junk" || candidate.category === "Junk"); if (junk) { this.destroyCard(player, junk); player.focus += Number(params.focusGain ?? 1); player.hp = Math.max(1, player.hp - Number(params.hpLoss ?? 1)); } }
      else if (operation === "readyEquipmentOrSpeedChoice") { const ready = player.equipment.find((candidate) => this.equipmentIsExhausted(player, candidate)); if (ready) this.setEquipmentReady(player, ready, true); else player.tempSpeed += amount || 1; }
      else if (operation === "discardForReadyOrDefenseChoice") { const candidate = player.hand[0]; if (candidate) { this.discardCard(player, candidate); const ready = player.equipment.find((entry) => this.equipmentIsExhausted(player, entry)); if (ready) this.setEquipmentReady(player, ready, true); else add("modifyDefense", amount || 1, "nextHonor"); } }
      else if (operation === "beltExamSpeedOrCycleChoice") player.tempSpeed += amount || 1;
      else if (operation === "nextCounterAttackChosenZone") player.nextAttackAnyZone = true;
      else if (operation === "stateActiveBeltExam") player.turnStats.completedBeltExamThisRound = true;
      else if (effect.action === "gainFocus") { player.focus += amount; player.turnStats.focusGenerated = (player.turnStats.focusGenerated ?? 0) + amount; this.telemetry.focusGenerated += amount; }
      else if (effect.action === "modifyAttackPower") add("modifyAttackPower", amount);
      else if (effect.action === "modifyGuard") add("modifyGuard", amount);
      else if (effect.action === "dealDamage") target.hp -= Math.max(0, amount);
      return true;
    }

    if (resolver === "character.noWeaponOffenseDefenseChoice") { if (!player.equipment.some((entry) => entry.subtype === "Weapon")) player.nextAttackPower += amount || 1; return true; }
    if (resolver === "character.ignoreTemporaryAttackBonusesOnceGame") { context.opponentAttackPowerModifier = (context.opponentAttackPowerModifier ?? 0) - Math.max(0, context.attackPowerModifier ?? 0); return true; }
    if (resolver === "character.reduceLargeAttackModifier") { if (Math.abs(context.opponentAttackPowerModifier ?? 0) >= 2) context.opponentAttackPowerModifier -= amount || 1; return true; }
    if (resolver === "character.discardToChangeDeclaredZone") { context.choice = { kind: "attack-zone", options: zones }; return true; }
    if (resolver === "character.revealReplacementOnceGame") { this.addStatus(player, { action: "revealReplacement", duration: "game", sourceId: card.instanceId }); return true; }
    if (resolver === "character.comboRevealChoice") { this.addStatus(player, { action: "comboRevealChoice", duration: "turn", sourceId: card.instanceId }); return true; }
    if (resolver === "character.junkDiscardToBottomCycle") { if (context.discardedCard) { this.moveCard(player, context.discardedCard, "deck"); player.deck.unshift(context.discardedCard); this.draw(player, 1); } return true; }
    if (resolver === "character.green.repeatModifiedCardTypeBonus") { if (context.modifiedCardType) add(context.modifiedCardType === "Defense" ? "modifyGuard" : "modifyAttackPower", amount || 1, "nextAttack"); return true; }

    if (resolver === "consumable.cancelReaction") { this.addStatus(opponent, { action: "restrictReaction", duration: "nextAttack", sourceId: card.instanceId }); return true; }
    if (resolver === "consumable.raffleTicket") { player.focus += 1; this.telemetry.focusGenerated += 1; return true; }
    if (resolver === "consumable.replaceDisarmWithSelfDestroy") { this.addStatus(player, { action: "preventDisarm", duration: "endOfTurn", sourceId: card.instanceId }); return true; }
    if (resolver === "consumable.replaceRevealedMarketOrLocation") { this.draw(player, 1); return true; }
    if (resolver === "consumable.suppressChosenWeaponClause") { this.addStatus(player, { action: "suppressWeaponClause", duration: "endOfTurn", sourceId: card.instanceId }); return true; }
    if (resolver === "consumable.blockedAttackBacklash") { if (player.turnStats.previousAttackBlocked) player.hp = Math.max(1, player.hp - 1); return true; }

    if (resolver === "defense.playRestriction") { this.addStatus(player, { action: "restrictAttack", duration: "endOfRound", sourceId: card.instanceId }); return true; }
    if (resolver === "defense.beltExam") { player.turnStats.completedBeltExamThisRound = true; player.xp += 1; this.telemetry.xpGenerated += 1; return true; }
    if (resolver === "defense.forceNextAttackZone") { this.addStatus(opponent, { action: "nextAttackZone", value: zones[0], duration: "endOfRound", sourceId: card.instanceId }); return true; }
    if (resolver === "defense.blockChoice") { player.focus += 1; this.telemetry.focusGenerated += 1; return true; }
    if (resolver === "defense.reversalTargetProtection") { this.addStatus(player, { action: "preventDamage", amount: 1, duration: "nextAttack", sourceId: card.instanceId }); return true; }

    if (resolver.startsWith("kata.")) {
      if (resolver === "kata.flowGrant") { player.nextAttackFlow = true; return true; }
      if (resolver === "kata.attackModifier") { player.nextAttackPower += Number(params.attackPowerBonus ?? amount ?? 0); player.tempSpeed += Number(params.attackSpeedBonus ?? 0); return true; }
      if (resolver === "kata.attackRestriction") { this.addStatus(player, { action: "restrictAttackCount", amount: Number(params.maxAttacksAfterSource ?? 1), duration: params.duration ?? "endOfTurn", sourceId: card.instanceId }); return true; }
      if (resolver === "kata.branch" || resolver === "kata.deferredEvent") {
        if (resolver === "kata.deferredEvent" && params.attackIsReversal && context.damage > 0) this.queueDiscardDrawChoice(player, { ...effect, drawAmount: Number(params.draw ?? 1), postDrawDiscard: true });
        else if (effect.action === "draw") this.draw(player, amount || 1);
        else if (effect.action === "gainFocus") { player.focus += amount || 1; this.telemetry.focusGenerated += amount || 1; }
        else player.nextAttackFlow = true;
        return true;
      }
      if (resolver === "kata.variableCycle") { this.queueDiscardDrawChoice(player, { ...effect, drawAmount: Number(params.discardUpTo ?? 1) }); return true; }
      if (resolver === "kata.deckLook" || resolver === "kata.revealUntil") { this.queueDeckLookChoice(player, { ...effect, conditions: [...(effect.conditions ?? []), { kind: "lookCount", value: Number(params.lookCount ?? 3) }] }); return true; }
      if (resolver === "kata.equipmentChoice" || resolver === "kata.equipmentActivation") { this.queueEquipmentToggleChoice(player, effect); return true; }
      if (resolver === "kata.markCard") { this.addStatus(player, { action: "markedCard", value: params.cardType ?? "Technique", amount: Number(params.nextPlayOfChosenCardFocus ?? 1), duration: "endOfTurn", sourceId: card.instanceId }); return true; }
      if (resolver === "kata.purchaseDiscount" || resolver === "kata.comboDiscount") { this.addStatus(player, { action: "modifyCost", amount: -Math.abs(Number(params.discount ?? 1)), duration: "nextPurchase", sourceId: card.instanceId }); return true; }
      if (resolver === "kata.recoverThenDiscard") { this.queueZoneChoice(player, effect, { zones: ["discard"], operation: "recover-then-discard" }); return true; }
      if (resolver === "kata.recycle") { this.queueZoneChoice(player, effect, { zones: ["discard"], operation: "recycle" }); return true; }
      if (resolver === "kata.equipFromHand") { this.queueZoneChoice(player, effect, { zones: ["hand"], operation: "equip-from-hand" }); return true; }
      if (resolver === "kata.weaponModifier") { this.addStatus(player, { action: "modifyAttackPower", amount: Number(params.attackBonusDelta ?? 1), duration: "nextAttack", sourceId: card.instanceId }); return true; }
      if (resolver === "kata.damagePrevention") { this.addStatus(player, { action: "preventDamage", amount: amount || 1, duration: "nextAttack", sourceId: card.instanceId }); return true; }
      return true;
    }

    if (resolver.startsWith("reaction.")) {
      if (resolver === "reaction.preventIncomingDamage") { context.damagePrevention = (context.damagePrevention ?? 0) + amount; return true; }
      if (resolver === "reaction.reduceDeclaredAttackPower" || resolver === "reaction.secondNormalAttackPenaltyAndInitiateDraw") { context.opponentAttackPowerModifier = (context.opponentAttackPowerModifier ?? 0) + amount; return true; }
      if (resolver === "reaction.defenseAgainstIncomingAttack") { context.defenseModifier = (context.defenseModifier ?? 0) + amount; return true; }
      if (resolver === "reaction.forceAttackerDrawDiscardBeforeDefense") { this.draw(opponent, 1); this.queueCardChoice(opponent, opponent, effect, "discard", 1); return true; }
      if (resolver === "reaction.defenseBeltExamCredit") { player.xp += 1; this.telemetry.xpGenerated += 1; return true; }
      if (resolver === "reaction.reversalOrDefenseFollowup") { player.nextAttackPower += 1; return true; }
      if (resolver === "reaction.preventForcedDiscard") { this.addStatus(player, { action: "preventForcedDiscard", duration: "round", sourceId: card.instanceId }); return true; }
      if (resolver === "reaction.outOfTurnConsumableShield") { this.addStatus(player, { action: "preventDamage", amount: 1, duration: "nextAttack", sourceId: card.instanceId }); return true; }
      return true;
    }
    if (resolver.startsWith("combo.")) { if (resolver === "combo.grantFlow") player.nextAttackFlow = true; else if (resolver === "combo.gainXP") { player.xp += amount; this.telemetry.xpGenerated += amount; } else if (resolver === "combo.equipmentDefenseSuppression") add("modifyDefense", amount, "nextAttack", opponent); else if (resolver === "combo.discardWeaponChoice") { const weapon = player.equipment.find((entry) => entry.subtype === "Weapon"); if (weapon) this.discardCard(player, weapon); } return true; }
    if (resolver.startsWith("boss.")) { if (resolver.includes("hitTempoLock")) opponent.tempo = false; else if (resolver.includes("startTurnDiscard")) this.queueCardChoice(opponent, opponent, effect, "discard", 1); else if (resolver.includes("reveal")) this.reveal(player, amount || 1); return true; }
    return false;
  }

  resolveHitChoice(pending, selected) {
    const player = this.players[pending.playerId]; const target = this.players[pending.targetPlayerId];
    if (selected === "item-cost-penalty") this.addStatus(target, { action: "nextItemCostPenalty", amount: 1, duration: "endOfRound", sourceId: pending.effectId });
    else if (selected === "defense-guard-penalty") this.addStatus(target, { action: "modifyGuard", amount: -1, duration: "nextDefense", sourceId: pending.effectId });
    else if (selected === "tempo-loss") target.tempo = false;
    else if (selected === "gain-focus") { player.focus += 1; player.turnStats.focusGenerated += 1; this.telemetry.focusGenerated += 1; }
    else if (selected === "cycle") { this.pendingChoice = null; return this.queueDiscardDrawChoice(player, { drawAmount: 1, sourceCardId: pending.effectId }); }
    else return false;
    this.pendingChoice = null;
    return true;
  }

  reveal(player, amount = 1) {
    const revealed = player.deck.slice(-Math.max(0, amount));
    player.revealed.push(...revealed);
    this.telemetry.cardsRevealed += revealed.length;
    for (const card of revealed) this.emit({ type: "card-revealed", player: player.id, card: card.catalogId });
    return revealed;
  }

  applyCardEffects(player, card, trigger, context = {}) {
    const effectContext = { player, opponent: context.opponent ?? this.players[1 - player.id], sourceCard: card, ...context };
    for (const effect of context.effectOverride ?? this.cardEffects(card, trigger)) {
      const conditions = this.evaluateConditions(effect, effectContext);
      if (!conditions.known) { this.unsupportedEffect(card, effect); continue; }
      if (!conditions.pass) continue;
      const unsupportedBefore = this.telemetry.unsupportedEffects;
      const amount = num(effect.amount); const rawAction = effect.action ?? effect.effect; const semanticAction = rawAction === "custom" ? effect.effect : rawAction; const resolverAction = ({ "attack.optionalDiscardDraw": "cycleDiscardDraw", "defense.optionalDiscardDraw": "cycleDiscardDraw", "defense.stepBackCycle": "cycleDiscardDraw", "kata.flowGrant": "grantFlow", "kata.purchaseDiscount": "modifyCost", "kata.deckLook": "deckLook", "defense.deckLookChoice": "deckLook", "consumable.topThreeAttackSelection": "deckLook", "consumable.reorderTopThree": "deckLook", "reaction.preventIncomingDamage": "preventDamage", "reaction.reduceDeclaredAttackPower": "modifyAttackPower", "reaction.defenseAgainstIncomingAttack": "reactionDefense", "consumable.modifyAttackStat": "modifyAttackPower", "consumable.removeTemporaryNegativeStatModifier": "removeTemporaryNegativeStatModifier", "consumable.healAndRemoveStatus": "removeTemporaryStatus", "consumable.nextKataFocusBonus": "grantKataFocus", "consumable.preventInterfereOnNextAttack": "restrictReaction", "consumable.untargetableUntilTurnOrAttack": "untargetable", "consumable.warrantyIcePop": "restrictConsumable", "attack.final.onlyAttackLock": "restrictAttack", "character.cannotEquipWeapons": "restrictWeapon", "character.equipDiscardPermanentUntilHide": "equipFromDiscard", "character.green.linkedAttackHitRecycle": "recycle", "character.green.linkedAttackHitRewardChoice": "hitChoice", "character.incomingAttackSlowChoice": "incomingAttackChoice", "character.revealConsumableCycle": "cycleDiscardDraw", "character.exhaustReadyEquipmentLock": "equipmentToggle", "character.discardJunkDestroyChoice": "discardOrDestroy", "character.forcedJunkDiscardDestroyChoice": "discardOrDestroy", "kata.recoverThenDiscard": "recoverThenDiscard", "kata.recycle": "recycle", "kata.equipFromHand": "equipFromHand", "consumable.setSpeedToValue": "setSpeed", "consumable.modifyDefenseUntilNextTurn": "modifyDefenseUntilNextTurn", "consumable.preventAttackUntilNextTurn": "restrictAttack" })[effect.resolver]; let action = ({ "equipment.modifyDefenseContribution": "modifyDefenseContribution", "combat.modifyDefense": "modifyDefense", "combat.grantFlow": "grantFlow", "core.gainXP": "gainXP", "core.reveal": "reveal", "economy.modifyCost": "modifyCost", "economy.spendFocus": "spendFocus", "core.moveCard": "moveCard" })[semanticAction] ?? resolverAction ?? semanticAction;
      if ([undefined, "custom", "core.custom"].includes(action) && ["location.", "equipment.", "character.", "consumable.", "defense.", "kata.", "reaction.", "combo.", "boss.", "attack.final."].some((prefix) => String(effect.resolver ?? "").startsWith(prefix))) action = "structured";
      if (effect.resolver === "attack.final.hitChoice") action = "hitChoice";
      if (String(effect.id).endsWith("dodge-block-cycle")) this.queueDiscardDrawChoice(player, { ...effect, drawAmount: 1 });
      else if (action === "gainFocus") { player.focus += amount; player.turnStats.focusGenerated = (player.turnStats.focusGenerated ?? 0) + amount; this.telemetry.focusGenerated += amount; }
      else if (action === "draw") this.draw(player, Math.max(0, amount));
      else if (action === "reveal") this.reveal(effect.target === "opponent" ? effectContext.opponent : player, Math.max(1, amount));
      else if (action === "moveCard") {
        const targetPlayer = effect.target === "opponent" ? effectContext.opponent : player;
        if (!this.queueCardChoice(player, targetPlayer, { ...effect, sourceCardId: effectContext.sourceCard?.instanceId }, "discard", Math.max(1, amount))) this.markUsedEffect(player, effect);
      }
      else if (action === "structured") { if (!this.applyStructuredEffect(player, card, effect, effectContext)) this.unsupportedEffect(card, effect); }
      else if (action === "gainXP") { player.xp += amount; this.telemetry.xpGenerated += amount; }
      else if (action === "spendFocus") { const targetPlayer = effect.target === "opponent" ? effectContext.opponent : player; const spent = Math.min(targetPlayer.focus, Math.max(0, amount)); targetPlayer.focus -= spent; targetPlayer.turnStats.focusSpent = (targetPlayer.turnStats.focusSpent ?? 0) + spent; this.telemetry.focusSpent += spent; }
      else if (action === "removeTemporaryNegativeStatModifier") this.removeTemporaryNegativeStatModifier(player, Math.max(1, amount));
      else if (action === "removeTemporaryStatus") this.removeTemporaryNegativeStatModifier(player, Math.max(1, amount));
      else if (action === "hitChoice") this.queueHitChoice(player, effect, effectContext.opponent);
      else if (action === "incomingAttackChoice") this.queueIncomingAttackChoice(player, effect, effectContext);
      else if (action === "equipmentToggle") this.queueEquipmentToggleChoice(player, effect);
      else if (action === "discardOrDestroy") this.queueDiscardOrDestroyChoice(player, effect, effectContext);
      else if (action === "restrictWeapon") this.addStatus(player, { action: "restrictWeapon", duration: "game", sourceId: card.instanceId });
      else if (action === "grantKataFocus") this.addStatus(player, { action: "kataFocusBonus", amount, duration: effect.duration ?? "endOfTurn", sourceId: card.instanceId });
      else if (action === "restrictReaction") this.addStatus(effect.target === "opponent" ? effectContext.opponent : player, { action: "restrictReaction", duration: "nextAttack", sourceId: card.instanceId });
      else if (action === "untargetable") this.addStatus(player, { action: "untargetable", duration: "nextHonor", sourceId: card.instanceId });
      else if (action === "restrictConsumable") this.addStatus(player, { action: "restrictConsumable", duration: effect.duration ?? "endOfTurn", sourceId: card.instanceId });
      else if (action === "setSpeed") { this.addStatus(player, { action: "speedRestore", amount: player.speed, duration: effect.duration ?? "endOfRound", sourceId: card.instanceId }); player.speed = amount; }
      else if (action === "modifyDefenseUntilNextTurn") this.addStatus(player, { action: "modifyDefense", amount, duration: "nextHonor", sourceId: card.instanceId });
      else if (action === "restrictAttack") this.addStatus(player, { action: "restrictAttack", duration: "nextHonor", sourceId: card.instanceId });
      else if (action === "modifyCost") this.addStatus(player, { action, amount, duration: effect.duration ?? "nextPurchase", sourceId: card.instanceId });
      else if (action === "grantFlow") player.nextAttackFlow = true;
      else if (action === "cycleDiscardDraw") {
        const drawAmount = (effect.conditions ?? []).find((condition) => ["draw", "drawAfterCost"].includes(condition.kind))?.value ?? 1;
        this.queueDiscardDrawChoice(player, { ...effect, drawAmount, postDrawDiscard: effect.resolver === "defense.stepBackCycle", candidateType: effect.resolver === "character.revealConsumableCycle" ? "Consumable" : null, revealSelected: effect.resolver === "character.revealConsumableCycle" });
      }
      else if (action === "deckLook") this.queueDeckLookChoice(player, effect);
      else if (action === "recoverThenDiscard") this.queueZoneChoice(player, { ...effect, sourceCardId: effectContext.sourceCard?.instanceId }, { zones: ["discard"], operation: "recover-then-discard" });
      else if (action === "recycle") this.queueZoneChoice(player, { ...effect, sourceCardId: effectContext.sourceCard?.instanceId }, { zones: ["discard"], operation: "recycle" });
      else if (action === "equipFromHand") this.queueZoneChoice(player, { ...effect, sourceCardId: effectContext.sourceCard?.instanceId }, { zones: ["hand"], operation: "equip-from-hand" });
      else if (action === "equipFromDiscard") this.queueZoneChoice(player, { ...effect, sourceCardId: effectContext.sourceCard?.instanceId }, { zones: ["discard"], operation: "equip-from-discard" });
      else if (action === "modifyDefenseContribution" || action === "modifyDefense") { if (effect.duration && effect.duration !== "immediate" && effect.duration !== "whileEquipped") this.addStatus(player, { action: "modifyDefense", amount, duration: effect.duration, sourceId: card.instanceId }); else effectContext.defenseModifier = (effectContext.defenseModifier ?? 0) + amount; }
      else if (action === "discard" || action === "destroy") {
        const targetPlayer = effect.target === "opponent" ? effectContext.opponent : player;
        if (effect.target === "source" && effectContext.sourceCard) {
          if (action === "discard") this.discardCard(player, effectContext.sourceCard); else this.destroyCard(player, effectContext.sourceCard);
        } else if (!this.queueCardChoice(player, targetPlayer, { ...effect, sourceCardId: effectContext.sourceCard?.instanceId }, action, Math.max(1, amount))) this.markUsedEffect(player, effect);
      }
      else if (action === "ready" || action === "exhaust") {
        const targetCard = effect.target === "source" ? effectContext.sourceCard : effect.target === "chosen-equipment"
          ? player.equipment.find((candidate) => action === "ready" ? this.equipmentIsExhausted(player, candidate) : !this.equipmentIsExhausted(player, candidate))
          : player.equipment.find((candidate) => candidate.instanceId === effect.cardId);
        if (targetCard && this.setEquipmentReady(player, targetCard, action === "ready")) { /* handled */ }
        else this.markUsedEffect(player, effect);
      }
      else if (action === "modifyAttackPower") { const subject = effect.target === "opponent" ? effectContext.opponent : player; if (effect.duration === "nextAttack") subject.nextAttackPower += amount; else if (effect.duration && effect.duration !== "immediate") this.addStatus(subject, { action, amount, duration: effect.duration, sourceId: card.instanceId }); else if (subject === player) effectContext.attackPowerModifier = (effectContext.attackPowerModifier ?? 0) + amount; else effectContext.opponentAttackPowerModifier = (effectContext.opponentAttackPowerModifier ?? 0) + amount; }
      else if (action === "reactionDefense") effectContext.defenseModifier = (effectContext.defenseModifier ?? 0) + amount;
      else if (action === "modifySpeed") { if (effect.duration && effect.duration !== "immediate") this.addStatus(player, { action, amount, duration: effect.duration, sourceId: card.instanceId }); else player.tempSpeed += amount; }
      else if (action === "modifyGuard") { if (effect.duration && effect.duration !== "immediate") this.addStatus(player, { action, amount, duration: effect.duration, sourceId: card.instanceId }); else effectContext.guardModifier = (effectContext.guardModifier ?? 0) + amount; }
      else if (action === "modifyDefense") { if (effect.duration && effect.duration !== "immediate") this.addStatus(player, { action, amount, duration: effect.duration, sourceId: card.instanceId }); else effectContext.defenseModifier = (effectContext.defenseModifier ?? 0) + amount; }
      else if (action === "preventDamage") { if (effect.duration && effect.duration !== "immediate") this.addStatus(player, { action, amount, duration: effect.duration, sourceId: card.instanceId }); else effectContext.damagePrevention = (effectContext.damagePrevention ?? 0) + amount; }
      else if (action === "heal") player.hp = Math.min(player.maxHp, player.hp + amount);
      else if (action === "dealDamage") effectContext.opponent.hp -= Math.max(0, amount);
      else if (action === "minimumSpeed") player.speed = Math.max(player.speed, amount);
      else if (action === "piercing") { if (effect.duration && effect.duration !== "immediate") this.addStatus(player, { action, amount, duration: effect.duration, sourceId: card.instanceId }); else effectContext.piercing = (effectContext.piercing ?? 0) + amount; }
      else if (rawAction === "custom" && effect.resolver === "starter.gainFocusIfFastest") { if (player.speed + player.tempSpeed > effectContext.opponent.speed + effectContext.opponent.tempSpeed) { player.focus += amount; player.turnStats.focusGenerated = (player.turnStats.focusGenerated ?? 0) + amount; this.telemetry.focusGenerated += amount; } }
      else if (action === "chooseZone") {
        if (effectContext.allowChoice) effectContext.choice = { kind: "attack-zone", options: zones };
        else if (effectContext.zone || effect.trigger === "onPlay" || effect.trigger === "passive") { player.nextAttackAnyZone = true; this.markUsedEffect(player, effect); }
        else this.unsupportedEffect(card, effect);
      }
      else this.unsupportedEffect(card, effect);
      if (this.telemetry.unsupportedEffects === unsupportedBefore) {
        this.track(card, "effectApplications", player);
        this.telemetry.effectApplications += 1;
        this.markUsedEffect(player, effect);
      }
    }
    return effectContext;
  }

  resolveAttack(attacker, defender, card, { useTempo = true, defenseCard, zone, reactionPrevention = 0, reactionAttackModifier = 0, reactionDefense = 0 } = {}) {
    if (!card || !attacker.hand.includes(card)) return null;
    remove(attacker.hand, card); attacker.played.push(card); attacker.focus += focus(card); this.telemetry.focusGenerated += focus(card); attacker.plays += 1; attacker.attackCount += 1; attacker.turnStats.attacked = true; attacker.turnStats.zones.add(zone ?? (card.zone === "Any" ? "Mid" : card.zone)); defender.turnStats.incomingAttackCount = (defender.turnStats.incomingAttackCount ?? 0) + 1; const flow = Boolean(card.tags?.includes("Flow") || attacker.nextAttackFlow); attacker.nextAttackFlow = false; this.track(card, "played", attacker);
    const attackContext = this.applyLocationEvent(attacker, "attack", this.applyPassiveEquipment(attacker, defender, { attackCard: card, zone, attackPowerModifier: this.statusValue(attacker, "modifyAttackPower", { consumeDuration: "nextAttack" }), piercing: this.statusValue(attacker, "piercing", { consumeDuration: "nextAttack" }), allowChoice: false }));
    const context = this.applyCardEffects(attacker, card, "passive", attackContext);
    Object.assign(context, this.applyCardEffects(attacker, card, "onAttackDeclared", context));
    if (defenseCard) { remove(defender.hand, defenseCard); defender.discard.push(defenseCard); defender.focus += focus(defenseCard); this.telemetry.focusGenerated += focus(defenseCard); this.track(defenseCard, "played", defender); }
    const defenseBase = this.applyLocationEvent(defender, "defense", this.applyPassiveEquipment(defender, attacker, { opponent: attacker, attackCard: card, defenseCard, defensePlayed: Boolean(defenseCard), defenseOutsideTurn: defender.id !== this.activePlayer, zone, guardModifier: this.statusValue(defender, "modifyGuard", { consumeDuration: "nextDefense" }), defenseModifier: reactionDefense, damagePrevention: this.statusValue(defender, "preventDamage", { consumeDuration: "nextDefense" }) }));
    const defenseContext = defenseCard ? this.applyCardEffects(defender, defenseCard, "onDefenseDeclared", defenseBase) : defenseBase;
    const tempo = useTempo && attacker.tempo ? this.definition.turn.tempoAttackPower : 0; if (tempo) attacker.tempo = false;
    const attack = attackPower(card) + attacker.atk + tempo + attacker.nextAttackPower + this.statusValue(attacker, "modifyAttackPower") + (context.attackPowerModifier ?? 0) + reactionAttackModifier; attacker.nextAttackPower = 0;
    const block = Math.max(0, defender.def + (defenseCard ? guard(defenseCard) : 0) + this.statusValue(defender, "modifyGuard") + this.statusValue(defender, "modifyDefense") + (defenseContext.guardModifier ?? 0) + (defenseContext.defenseModifier ?? 0) - (context.piercing ?? 0) - this.statusValue(attacker, "piercing")); const damage = Math.max(this.definition.combat.damageFloor, attack - block - (defenseContext.damagePrevention ?? 0) - this.statusValue(defender, "preventDamage") - reactionPrevention); defender.hp = Math.max(0, defender.hp - damage);
    if (damage > 0) { attacker.xp += this.definition.progression.attackXpOnHit; this.applyEquipmentWatchers(attacker, "equipment.structured", { attackCard: card, damage, xpFromLegalAttackOrDefense: true, watchCondition: "xpFromLegalAttackOrDefense" }); attacker.turnStats.hit = true; attacker.turnStats.hitCount = (attacker.turnStats.hitCount ?? 0) + 1; defender.turnStats.damageTaken = (defender.turnStats.damageTaken ?? 0) + damage; } else if (defenseCard) { defender.xp += this.definition.progression.defenseXpOnBlock; this.applyEquipmentWatchers(defender, "equipment.structured", { attackCard: card, defenseCard, damage, xpFromLegalAttackOrDefense: true, watchCondition: "xpFromLegalAttackOrDefense" }); defender.turnStats.blocked = true; }
    attacker.turnStats.previousAttackHit = damage > 0; attacker.turnStats.previousAttackBlocked = damage === 0; attacker.turnStats.previousZone = zone; attacker.turnStats.previousAttackTags = card.tags ?? []; attacker.turnStats.previousCardType = card.subtype; attacker.turnStats.previousOpponentId = defender.id;
    if (defenseCard) defender.turnStats.playedDefenseSinceLastTurn = true;
    if (damage > 0) { this.applyEquipmentTrigger(attacker, "onHit", { opponent: defender, attackCard: card, damage, attack, block, zone }); this.applyCharacterEffects(attacker, "onHit", { opponent: defender, attackCard: card, damage, attack, block, zone }); this.applyCardEffects(attacker, card, "onHit", { opponent: defender, attackCard: card, damage, attack, block, zone }); }
    else if (defenseCard) { this.applyEquipmentTrigger(defender, "onBlock", { opponent: attacker, attackCard: card, defenseCard, damage, attack, block, zone, defensePlayed: true }); this.applyCharacterEffects(defender, "onBlock", { opponent: attacker, attackCard: card, defenseCard, damage, attack, block, zone, defensePlayed: true }); this.applyCardEffects(defender, defenseCard, "onBlock", { opponent: attacker, attackCard: card, defenseCard, damage, attack, block, zone, defensePlayed: true }); }
    this.applyCardEffects(attacker, card, "afterResolve", { opponent: defender, attackCard: card, damage, attack, block, zone });
    if (flow && !attacker.turnStats.flowDrawUsed) { this.draw(attacker, 1); attacker.turnStats.flowDrawUsed = true; }
    if (damage > 0) { this.track(card, "damageDealt", attacker, damage); this.track(card, "hits", attacker); }
    if (defenseCard) this.track(defenseCard, damage === 0 ? "blocks" : "damagePrevented", defender, damage === 0 ? 1 : Math.max(0, block - attack + damage));
    this.emit({ type: "attack", attacker: attacker.id, defender: defender.id, card: card.catalogId, defense: defenseCard?.catalogId ?? null, attack, block, damage, defenseFocus: focus(defenseCard) }); this.checkWinner();
    return { attack, block, damage, defense: defenseCard };
  }

  practice(player, card) {
    if (this.definition.economy.defensePractice.usesPerTurn < 1 || player.practiceUsed || !card || !isDefense(card) || !player.hand.includes(card)) return false;
    remove(player.hand, card); player.played.push(card); player.focus += focus(card); this.telemetry.focusGenerated += focus(card); this.telemetry.defensePractice += 1; player.practiceUsed = true; player.turnStats.playedDefenseSinceLastTurn = true; player.turnStats.defenseCount = (player.turnStats.defenseCount ?? 0) + 1; this.track(card, "played", player); this.emit({ type: "defense-practice", player: player.id, card: card.catalogId, focus: focus(card) }); return true;
  }

  cashBadHabit(player) {
    const rule = this.definition.economy.badHabitFocus; if (!rule || rule.usesPerTurn < 1 || player.badHabitFocusUsed) return false;
    const card = player.hand.find((candidate) => candidate?.catalogId === rule.catalogId); if (!card) return false; remove(player.hand, card); player.discard.push(card); player.focus += Number(rule.focusGain) || 0; this.telemetry.focusGenerated += Number(rule.focusGain) || 0; player.badHabitFocusUsed = true; this.emit({ type: "bad-habit-focus", player: player.id, card: card.catalogId, focus: Number(rule.focusGain) || 0 }); return true;
  }

  playCard(player, card) {
    const combatTechnique = card?.cardType === "Technique" || card?.cardType === "Starter";
    if (!card || !player.hand.includes(card) || combatTechnique && (isAttack(card) || isDefense(card))) return false;
    if (card.subtype === "Consumable" && this.hasStatus(player, "restrictConsumable")) return false;
    if (card.subtype === "Weapon" && this.hasStatus(player, "restrictWeapon")) return false;
    remove(player.hand, card); player.played.push(card); player.focus += focus(card); this.telemetry.focusGenerated += focus(card); if (card.subtype === "Kata" && this.hasStatus(player, "kataFocusBonus")) { player.focus += this.statusValue(player, "kataFocusBonus", { consumeDuration: "endOfTurn" }); player.turnStats.focusGenerated += this.statusValue(player, "kataFocusBonus"); this.telemetry.focusGenerated += 1; this.removeStatus(player, "kataFocusBonus"); } player.plays += 1; player.turnStats.playsThisTurn = (player.turnStats.playsThisTurn ?? 0) + 1; if (card.subtype === "Consumable") { player.turnStats.usedConsumableThisTurn = true; player.turnStats.usedConsumableThisRound = true; player.turnStats.consumableCount = (player.turnStats.consumableCount ?? 0) + 1; } const equipment = ["Weapon", "Gear", "Defense Equipment"].includes(card.subtype); if (equipment) player.equipment.push(card); player.turnStats.equippedThisTurn = equipment || player.turnStats.equippedThisTurn; this.track(card, "played", player); this.applyCardEffects(player, card, "onPlay", { opponent: this.players[1 - player.id], attackCard: null }); if (card.subtype === "Kata") player.turnStats.kataCount = (player.turnStats.kataCount ?? 0) + 1; if (equipment) this.applyCardEffects(player, card, "onEquip", { opponent: this.players[1 - player.id], sourceCard: card, equippedCard: card }); return true;
  }

  buy(player, card) {
    const discount = player.statuses.filter((status) => status.action === "modifyCost").reduce((sum, status) => sum + num(status.amount), 0);
    const itemPenalty = card?.cardType === "Item" ? player.statuses.filter((status) => status.action === "nextItemCostPenalty").reduce((sum, status) => sum + num(status.amount), 0) : 0;
    const finalCost = Math.max(0, cost(card) + discount + itemPenalty);
    if (!card || !this.market.includes(card) || finalCost > player.focus) return false;
    player.turnStats.focusSpent = (player.turnStats.focusSpent ?? 0) + finalCost;
    if (card.cardType === "Item") this.removeStatus(player, "nextItemCostPenalty");
    player.focus -= finalCost; this.telemetry.focusSpent += finalCost; player.turnStats.boughtCardThisTurn = true; player.turnStats.boughtCardThisAscend = true; player.statuses = player.statuses.filter((status) => status.action !== "modifyCost" || status.duration === "endOfRound"); remove(this.market, card); player.discard.push(card); player.purchases += 1; this.marketPurchasedThisRound = true; if (this.round === 1) player.openingPurchase = true; this.track(card, "purchased", player); this.applyCardEffects(player, card, "onPurchase", { opponent: this.players[1 - player.id], purchaseCost: finalCost, purchaseCompleted: true }); for (const equipment of player.equipment) this.applyCardEffects(player, equipment, "onPurchase", { opponent: this.players[1 - player.id], sourceCard: equipment, purchasedCard: card, purchaseCost: finalCost, purchaseCompleted: true }); this.refillMarket(false); this.emit({ type: "purchase", player: player.id, card: card.catalogId, cost: finalCost, printedCost: cost(card), focusRemaining: player.focus }); return true;
  }

  canPlayCard(player, card) {
    if (!card) return false;
    if (card.subtype === "Consumable" && this.hasStatus(player, "restrictConsumable")) return false;
    if (card.subtype === "Weapon" && this.hasStatus(player, "restrictWeapon")) return false;
    return true;
  }

  getPendingChoice() { return this.pendingChoice ? structuredClone(this.pendingChoice) : null; }

  getLegalActions(playerId = this.activePlayer) {
    if (this.winner !== null || this.status !== "active") return [];
    if (this.pendingChoice) return [{ type: "resolve-choice", playerId: this.pendingChoice.playerId, choiceId: this.pendingChoice.kind, options: this.pendingChoice.options }];
    if (playerId !== this.activePlayer) return [];
    const player = this.players[playerId];
    if (this.phase === "Honor") return [{ type: "pass", playerId }];
    if (this.phase === "Initiate") return [{ type: "pass", playerId }, ...player.hand.filter((card) => ["Weapon", "Gear", "Defense Equipment"].includes(card.subtype) && this.canPlayCard(player, card)).map((card) => ({ type: "play-card", playerId, cardId: card.instanceId })), ...player.equipment.filter((card) => !this.equipmentIsExhausted(player, card) && this.equipmentHasManualActivation(card)).map((card) => ({ type: "activate-equipment", playerId, cardId: card.instanceId }))];
    if (this.phase === "Yell") return [...(this.hasStatus(player, "restrictAttack") ? [] : player.hand.filter((card) => isAttack(card) && this.canPlayCard(player, card)).map((card) => ({ type: "play-attack", playerId, cardId: card.instanceId }))), ...player.hand.filter((card) => !isAttack(card) && !isDefense(card) && this.canPlayCard(player, card)).map((card) => ({ type: "play-card", playerId, cardId: card.instanceId })), ...(this.definition.economy.defensePractice.usesPerTurn > 0 && !player.practiceUsed ? player.hand.filter(isDefense).map((card) => ({ type: "practice", playerId, cardId: card.instanceId })) : []), { type: "pass", playerId }];
    if (this.phase === "Ascend") return [...this.market.filter((card) => cost(card) <= player.focus).map((card) => ({ type: "purchase", playerId, cardId: card.instanceId })), { type: "pass", playerId }];
    if (this.phase === "Hide") return [{ type: "hide", playerId }];
    return [];
  }

  cardByInstance(playerId, instanceId) { const player = this.players[playerId]; return [...player.hand, ...player.played, ...player.deck, ...player.discard].find((card) => card.instanceId === instanceId); }

  beginAttack(playerId, card, action = {}) {
    if (!card) return false;
    if (this.hasStatus(this.players[playerId], "restrictAttack")) return false;
    const defenderId = 1 - playerId;
    if (this.hasStatus(this.players[defenderId], "untargetable")) return false;
    this.removeStatus(this.players[playerId], "untargetable");
    if (card.zone === "Any" && !action.zone) { this.pendingChoice = { kind: "attack-zone", playerId, cardId: card.instanceId, options: zones.map((zone) => ({ id: zone, label: zone })) }; return true; }
    const defender = this.players[defenderId]; const reactionCards = defender.hand.filter((candidate) => candidate.subtype === "Reaction Item" && this.cardEffects(candidate, "onAttackDeclared").length);
    const defense = { playerId: defenderId, attackerId: playerId, cardId: card.instanceId, zone: action.zone ?? card.zone, options: [{ id: "pass", label: "Take the hit" }, ...defender.hand.filter(isDefense).map((candidate) => ({ id: candidate.instanceId, label: candidate.name }))] };
    const suppressReaction = this.hasStatus(defender, "restrictReaction");
    if (suppressReaction) this.removeStatus(defender, "restrictReaction");
    if (reactionCards.length && !suppressReaction) this.pendingChoice = { kind: "reaction", ...defense, options: [{ id: "pass", label: "Do not play a Reaction" }, ...reactionCards.map((candidate) => ({ id: candidate.instanceId, label: candidate.name }))], defenseOptions: defense.options };
    else this.pendingChoice = { kind: "defense", ...defense };
    return true;
  }

  resolveChoice(choice) {
    if (!this.pendingChoice) return false;
    const pending = this.pendingChoice; const selected = choice?.optionId ?? choice?.id ?? choice; if (!pending.options.some((option) => option.id === selected)) return false;
    this.telemetry.choicesResolved += 1; this.lastPresentedChoice = null;
    if (pending.kind === "card-movement") return this.resolveCardMovementChoice(pending, selected);
    if (pending.kind === "zone-choice") return this.resolveZoneChoice(pending, selected);
    if (pending.kind === "hit-choice") return this.resolveHitChoice(pending, selected);
    if (pending.kind === "incoming-attack-choice") {
      const player = this.players[pending.playerId];
      if (selected === "accept") { player.tempSpeed -= 1; player.turnStats.reducedIncomingAttack = true; }
      this.pendingChoice = null;
      return true;
    }
    if (pending.kind === "equipment-toggle") {
      const player = this.players[pending.playerId]; const card = player.equipment.find((candidate) => candidate.instanceId === selected);
      if (!card) return false;
      this.setEquipmentReady(player, card, false); this.setEquipmentReady(player, card, true); player.turnStats.rebootedEquipment = true; this.pendingChoice = null;
      const followups = this.cardEffects(player.character, "passive").filter((effect) => effect.resolver === "character.green.linkedRebootCycle");
      if (followups.length) this.applyCardEffects(player, player.character, "passive", { opponent: this.players[1 - player.id], sourceCard: player.character, effectOverride: followups });
      return true;
    }
    if (pending.kind === "discard-or-destroy") {
      const player = this.players[pending.playerId]; const card = player.discard.find((candidate) => candidate.instanceId === pending.cardId);
      if (!card) return false;
      this.pendingChoice = null;
      if (selected === "destroy") { this.destroyCard(player, card); const followups = this.cardEffects(player.character, "passive").filter((effect) => effect.resolver === "character.green.linkedJunkDestroyCycle"); if (followups.length) this.applyCardEffects(player, player.character, "passive", { opponent: this.players[1 - player.id], sourceCard: player.character, effectOverride: followups }); }
      return true;
    }
    if (pending.kind === "cycle-discard-draw") {
      const player = this.players[pending.playerId];
      if (selected !== "skip") {
        const card = player.hand.find((candidate) => candidate.instanceId === selected);
        if (!card) return false;
        if (pending.revealSelected) this.emit({ type: "card-revealed", player: player.id, card: card.catalogId });
        this.discardCard(player, card); this.draw(player, pending.drawAmount);
        if (pending.postDrawDiscard) {
          this.pendingChoice = { kind: "card-movement", playerId: player.id, targetPlayerId: player.id, movement: "discard", amount: 1, sourceCardId: pending.sourceCardId, effectId: pending.effectId, options: player.hand.map((candidate) => ({ id: candidate.instanceId, label: candidate.name })) };
          return true;
        }
      }
      this.pendingChoice = null; return true;
    }
    if (pending.kind === "deck-look") {
      const player = this.players[pending.playerId];
      const looked = pending.lookedCardIds.map((id) => player.deck.find((card) => card.instanceId === id)).filter(Boolean);
      for (const card of looked) remove(player.deck, card);
      const chosen = selected === "skip" ? null : looked.find((card) => card.instanceId === selected);
      if (chosen) player.hand.push(chosen);
      const rest = looked.filter((card) => card !== chosen);
      if (pending.restAction === "discard") player.discard.push(...rest); else player.deck.push(...(pending.restAction === "shuffle" ? this.rng.shuffle(rest) : rest));
      const foundEligible = Boolean(chosen);
      const discardedRequestedType = pending.discardFocusCardType && rest.some((card) => [card.cardType, card.subtype, card.category].includes(pending.discardFocusCardType));
      if ((!foundEligible && pending.focusIfNoMatch) || (pending.focusIfDifferentTypes && new Set(looked.map(cardType)).size >= 2) || (discardedRequestedType && pending.discardFocusCardType)) {
        const amount = discardedRequestedType ? 1 : (pending.focusIfNoMatch || pending.focusIfDifferentTypes);
        player.focus += amount; player.turnStats.focusGenerated += amount; this.telemetry.focusGenerated += amount;
      }
      this.pendingChoice = null; return true;
    }
    if (pending.kind === "reaction") {
      const attacker = this.players[pending.attackerId]; const defender = this.players[pending.playerId]; const attackCard = this.cardByInstance(pending.attackerId, pending.cardId);
      if (selected !== "pass") { const reaction = defender.hand.find((candidate) => candidate.instanceId === selected); if (!reaction || !attackCard) return false; remove(defender.hand, reaction); defender.played.push(reaction); defender.focus += focus(reaction); this.track(reaction, "played", defender); const reactionContext = this.applyCardEffects(defender, reaction, "onAttackDeclared", { opponent: attacker, attackCard, zone: pending.zone, incomingAttackTargetsSelf: true }); defender.discard.push(reaction); const defenseOptions = pending.defenseOptions; this.pendingChoice = { kind: "defense", playerId: pending.playerId, attackerId: pending.attackerId, cardId: pending.cardId, zone: pending.zone, reactionPrevention: reactionContext.damagePrevention ?? 0, reactionAttackModifier: reactionContext.opponentAttackPowerModifier ?? 0, reactionDefense: reactionContext.defenseModifier ?? 0, options: defenseOptions }; return true; }
      this.pendingChoice = { kind: "defense", playerId: pending.playerId, attackerId: pending.attackerId, cardId: pending.cardId, zone: pending.zone, options: pending.defenseOptions }; return true;
    }
    if (pending.kind === "attack-zone") { const card = this.cardByInstance(pending.playerId, pending.cardId); this.pendingChoice = null; return this.beginAttack(pending.playerId, card, { zone: selected }); }
    const attacker = this.players[pending.attackerId]; const defender = this.players[pending.playerId]; const card = this.cardByInstance(pending.attackerId, pending.cardId); const defense = selected === "pass" ? null : defender.hand.find((candidate) => candidate.instanceId === selected); this.pendingChoice = null; return Boolean(this.resolveAttack(attacker, defender, card, { defenseCard: defense, zone: pending.zone, reactionPrevention: pending.reactionPrevention ?? 0, reactionAttackModifier: pending.reactionAttackModifier ?? 0, reactionDefense: pending.reactionDefense ?? 0 }));
  }

  applyAction(action) {
    if (!action || this.winner !== null || this.status !== "active") return false;
    if (this.pendingChoice) return action.type === "resolve-choice" && this.resolveChoice(action.choice ?? action.optionId);
    if (action.playerId !== undefined && action.playerId !== this.activePlayer) return false;
    const player = this.players[this.activePlayer];
    if (action.type === "pass") { if (this.phase === "Honor") this.phase = "Initiate"; else if (this.phase === "Initiate") { for (const card of player.equipment) this.applyCardEffects(player, card, "onInitiate", { opponent: this.players[1 - player.id] }); this.applyCharacterEffects(player, "onInitiate", { opponent: this.players[1 - player.id] }); this.phase = "Yell"; } else if (this.phase === "Yell") { player.turnStats.boughtCardThisAscend = false; this.phase = "Ascend"; } else if (this.phase === "Ascend") { for (const card of player.equipment) this.applyCardEffects(player, card, "passive", { opponent: this.players[1 - player.id], sourceCard: card, ascendCompleted: true }); this.phase = "Hide"; } else if (this.phase === "Hide") { this.hide(player); this.finishTurn(); } return true; }
    if (action.type === "hide" && this.phase === "Hide") { this.hide(player); this.finishTurn(); return true; }
    if (action.type === "practice" && this.phase === "Yell") return this.practice(player, player.hand.find((card) => card.instanceId === action.cardId));
    if (action.type === "activate-equipment" && this.phase === "Initiate") return this.activateEquipment(player, player.equipment.find((card) => card.instanceId === action.cardId));
    if (action.type === "play-card" && (this.phase === "Yell" || this.phase === "Initiate")) return this.playCard(player, player.hand.find((card) => card.instanceId === action.cardId));
    if (action.type === "play-attack" && this.phase === "Yell") return this.beginAttack(this.activePlayer, player.hand.find((card) => card.instanceId === action.cardId), action);
    if (action.type === "purchase" && this.phase === "Ascend") return this.buy(player, this.market.find((card) => card.instanceId === action.cardId));
    return false;
  }

  advanceAutomaticEvents() {
    if (this.winner !== null || this.pendingChoice || this.phase !== "Honor") return false;
    this.sceneChangedThisRound = false;
    this.revealLocation();
    for (const player of this.players) { if (player.hp > 0) player.xp += this.definition.progression.xpPerHonor; player.effectUsage.turn = {}; player.tempo = true; player.practiceUsed = false; player.attackCount = 0; this.expireStatuses(player, "nextHonor"); player.turnStats = { zones: new Set(), attacked: false, hit: false, blocked: false, damageTaken: 0, hitCount: 0, defenseCount: 0, incomingAttackCount: 0, kataCount: 0, focusGenerated: 0, playedDefenseSinceLastTurn: false, previousAttackHit: false, previousAttackBlocked: false, previousCardType: null, previousAttackTags: [], previousOpponentId: null, previousZone: null, flowDrawUsed: false, boughtCardThisTurn: false, boughtCardThisAscend: false, usedConsumableThisRound: false, consumableCount: 0 }; }
    const living = this.players.filter((player) => player.hp > 0).sort((left, right) => (right.speed + right.tempSpeed) - (left.speed + left.tempSpeed) || left.id - right.id); if (living.length) this.activePlayer = living[0].id; this.phase = "Initiate"; this.emit({ type: "honor", players: this.players.map((player) => ({ id: player.id, xp: player.xp })) }); return true;
  }

  finishTurn() { this.turns += 1; this.expireStatuses(this.players[this.activePlayer], "endOfTurn"); this.players[this.activePlayer].effectUsage.turn = {}; const next = this.activePlayer === 0 ? 1 : 0; if (next === 0) { this.round += 1; for (const player of this.players) { player.effectUsage.round = {}; this.expireStatuses(player, "endOfRound"); } if (!this.marketPurchasedThisRound) this.refillMarket(true); this.marketPurchasedThisRound = false; this.phase = "Honor"; } else this.phase = "Initiate"; this.activePlayer = next; this.checkWinner(); }

  hide(player) { const incomingDamage = player.turnStats.damageTaken ?? 0; for (const card of new Set([...player.played, ...player.equipment])) this.applyCardEffects(player, card, "onHide", { opponent: this.players[1 - player.id], incomingDamage }); player.lastTurnWasHit = Boolean(player.turnStats.hit || incomingDamage); player.lastTurnAttacked = Boolean(player.turnStats.attacked); player.lastTurnWasBlocked = Boolean(player.turnStats.blocked); player.discard.push(...player.hand, ...player.played.filter((card) => !player.equipment.includes(card))); player.hand = []; player.played = player.equipment.slice(); player.focus = 0; player.badHabitFocusUsed = false; player.practiceUsed = false; player.nextAttackPower = 0; player.tempSpeed = 0; this.expireStatuses(player, "endOfTurn"); this.draw(player, this.definition.turn.handSize + (player.xp >= 28 ? 1 : 0)); this.emit({ type: "hide", player: player.id, handSize: player.hand.length }); }

  checkWinner() { const alive = this.players.filter((player) => player.hp > 0); if (alive.length === 1) { this.winner = alive[0].id; this.reason = "knockout"; } else if (this.round > this.definition.mode.maxRounds) { this.winner = this.players[0].hp === this.players[1].hp ? this.rng.pick([0, 1]) : this.players[0].hp > this.players[1].hp ? 0 : 1; this.reason = "round-limit"; } if (this.winner !== null) this.status = "complete"; return this.winner !== null; }

  defaultAction(legal) {
    const player = this.players[this.activePlayer];
    if (this.phase === "Yell") { const attack = chooseAttack(player.hand, player.strategy); const attackAction = attack && legal.find((action) => action.type === "play-attack" && action.cardId === attack.instanceId); if (attackAction) return attackAction; const practice = choosePractice(player.hand, player.strategy); const practiceAction = practice && legal.find((action) => action.type === "practice" && action.cardId === practice.instanceId); if (practiceAction && !player.practiceUsed) return practiceAction; const cardAction = legal.find((action) => action.type === "play-card"); if (cardAction) return cardAction; }
    if (this.phase === "Ascend") { const purchase = choosePurchase(this.market, player.focus, player.strategy); const purchaseAction = purchase && legal.find((action) => action.type === "purchase" && action.cardId === purchase.instanceId); if (purchaseAction) return purchaseAction; }
    return legal.find((action) => action.type === "pass" || action.type === "hide") ?? legal[0];
  }

  defaultChoice() {
    if (["attack-zone", "card-movement", "cycle-discard-draw", "deck-look", "zone-choice", "hit-choice", "incoming-attack-choice", "equipment-toggle", "discard-or-destroy"].includes(this.pendingChoice?.kind)) return { optionId: this.pendingChoice.options[0].id };
    if (this.pendingChoice?.kind === "reaction") return { optionId: "pass" };
    const defender = this.players[this.pendingChoice.playerId]; const defense = chooseDefense(defender.hand); return { optionId: defense?.instanceId ?? "pass" };
  }

  run({ policy = null, maxSteps = 100000 } = {}) {
    const controller = policy ?? { chooseAction: (game, legal) => game.defaultAction(legal), chooseChoice: (game) => game.defaultChoice() }; let steps = 0;
    while (this.winner === null && steps < maxSteps) { steps += 1; this.advanceAutomaticEvents(); if (this.pendingChoice) { const pending = this.getPendingChoice(); if (this.lastPresentedChoice !== this.pendingChoice) { this.telemetry.choicesPresented += 1; this.lastPresentedChoice = this.pendingChoice; } const choice = controller.chooseChoice ? controller.chooseChoice(this, pending) : this.defaultChoice(); this.decisions.push({ step: steps, kind: "choice", pendingKind: pending.kind, choice: structuredClone(choice) }); if (!this.resolveChoice(choice)) throw new Error(`Policy selected illegal choice at seed ${this.seed}`); continue; } const legal = this.getLegalActions(); if (!legal.length) throw new Error(`No legal actions in ${this.phase} for player ${this.activePlayer}`); const action = controller.chooseAction ? controller.chooseAction(this, legal) : this.defaultAction(legal); this.decisions.push({ step: steps, kind: "action", phase: this.phase, action: structuredClone(action) }); if (!this.applyAction(action)) throw new Error(`Policy selected illegal action at seed ${this.seed}: ${JSON.stringify(action)}`); }
    if (this.winner === null) throw new Error(`Game exceeded ${maxSteps} steps at seed ${this.seed}`);
    for (const player of this.players) for (const id of player._used ?? []) if (player.id === this.winner) this.cardStats.get(id).winnerOwned += 1; return this.result();
  }

  botTurn(index) {
    const player = this.players[index]; const defender = this.players[1 - index]; player.tempo = true; this.practice(player, choosePractice(player.hand, player.strategy)); this.cashBadHabit(player); let attackNumber = 0;
    while (defender.hp > 0) { const attack = chooseAttack(player.hand, player.strategy); if (!attack) break; this.resolveAttack(player, defender, attack, { useTempo: attackNumber === 0 }); attackNumber += 1; }
    for (const card of [...player.hand]) if (["Kata", "Consumable", "Gear", "Weapon", "Defense Equipment"].includes(card.subtype)) this.playCard(player, card);
    while (true) { const purchase = choosePurchase(this.market, player.focus, player.strategy); if (!purchase || !this.buy(player, purchase)) break; }
    this.emit({ type: "turn-snapshot", player: player.id, xp: player.xp, focus: player.focus, hp: player.hp, purchases: player.purchases }); this.hide(player); this.turns += 1; this.checkWinner();
  }

  checkInvariants() {
    const failures = []; if (!Number.isInteger(this.round) || this.round < 1) failures.push("round must be a positive integer"); if (!Number.isInteger(this.activePlayer) || !this.players[this.activePlayer]) failures.push("activePlayer must identify a player");
    const seen = new Map();
    const visit = (location, cards) => { for (const card of cards ?? []) { if (!card?.instanceId) failures.push(`${location} contains a card without instanceId`); else if (seen.has(card.instanceId)) failures.push(`${location} duplicates ${card.instanceId}; already in ${seen.get(card.instanceId)}`); else seen.set(card.instanceId, location); } };
    visit("market", this.market); visit("marketDeck", this.marketDeck); visit("marketDiscard", this.marketDiscard); visit("locationDeck", this.locationDeck); visit("locationDiscard", this.locationDiscard); visit("currentLocation", this.currentLocation ? [this.currentLocation] : []);
    for (const player of this.players) { if (player.hp < 0) failures.push(`${player.name} has negative HP`); if (player.hp > player.maxHp) failures.push(`${player.name} exceeds max HP`); if (player.focus < 0) failures.push(`${player.name} has negative Focus`); if (player.beltIndex < 0 || player.beltIndex >= this.definition.progression.belts.length) failures.push(`${player.name} has invalid belt index`); for (const zone of ["deck", "hand", "discard", "destroyed", "played"]) visit(`${player.name}.${zone}`, player[zone]); for (const card of player.equipment) if (!player.played.includes(card)) failures.push(`${player.name} equipment ${card.catalogId} is not in play`); for (const instanceId of player.exhaustedEquipment) if (!player.equipment.some((card) => card.instanceId === instanceId)) failures.push(`${player.name} has exhausted equipment outside equipment`); }
    if (this.pendingChoice && (!Array.isArray(this.pendingChoice.options) || !this.pendingChoice.options.length)) failures.push(`pending choice ${this.pendingChoice.kind} has no legal options`);
    if (this.winner !== null && this.status !== "complete") failures.push("winner exists while game is not complete");
    return failures;
  }

  getState() {
    const cardIds = (cards) => cards.map((card) => card.instanceId ?? card.catalogId);
    return { schemaVersion: 2, rulesVersion: this.definition.rulesVersion, seed: this.seed, round: this.round, turns: this.turns, phase: this.phase, activePlayer: this.activePlayer, winner: this.winner, reason: this.reason, pendingChoice: this.getPendingChoice(), market: cardIds(this.market), marketDeck: cardIds(this.marketDeck), marketDiscard: cardIds(this.marketDiscard), location: this.currentLocation?.catalogId ?? null, locationDeck: cardIds(this.locationDeck ?? []), locationDiscard: cardIds(this.locationDiscard ?? []), players: this.players.map((player) => ({ id: player.id, hp: player.hp, maxHp: player.maxHp, atk: player.atk, def: player.def, speed: player.speed, focus: player.focus, xp: player.xp, beltIndex: player.beltIndex, tempo: player.tempo, exhaustedEquipment: [...player.exhaustedEquipment], statuses: structuredClone(player.statuses), cardZones: { deck: cardIds(player.deck), hand: cardIds(player.hand), discard: cardIds(player.discard), destroyed: cardIds(player.destroyed), played: cardIds(player.played), equipment: cardIds(player.equipment) } })) };
  }

  result() { return { seed: this.seed, winner: this.winner, reason: this.reason, rounds: this.round, turns: this.turns, phase: this.phase, players: this.players.map((player) => ({ id: player.id, strategy: player.strategy, hp: player.hp, xp: player.xp, beltIndex: player.beltIndex, purchases: player.purchases, plays: player.plays, openingPurchase: player.openingPurchase })), cards: [...this.cardStats.values()], telemetry: { ...this.telemetry }, invariantFailures: this.checkInvariants(), unsupportedEffects: this.telemetry.unsupportedEffects, decisions: this.decisions, events: this.events, state: this.getState() }; }
}

export const createGame = (data, config = {}) => new Game(data, config);
export const getLegalActions = (game, playerId) => game.getLegalActions(playerId);
export const applyAction = (game, action) => game.applyAction(action);
export const resolveChoice = (game, choice) => game.resolveChoice(choice);
export const advanceAutomaticEvents = (game) => game.advanceAutomaticEvents();
export const isGameOver = (game) => game.winner !== null;
export const getWinner = (game) => game.winner;
