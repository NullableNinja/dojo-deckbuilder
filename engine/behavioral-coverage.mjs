import { Game } from "./core.mjs";
import { loadGameData } from "./rules-loader.mjs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ZONES = ["High", "Mid", "Low"];
const BELTS = ["White", "Gold", "Orange", "Green", "Purple", "Blue", "Red", "Brown", "Black"];

function conditionValue(effect, kind) {
  return (effect.conditions ?? []).find((condition) => condition.kind === kind)?.value;
}

function firstMatchingZone(effect) {
  const values = [conditionValue(effect, "incomingZones"), conditionValue(effect, "attackZones"), conditionValue(effect, "attackZone")]
    .flatMap((value) => Array.isArray(value) ? value : value ? [value] : []);
  return ZONES.find((zone) => values.some((value) => String(value).toLowerCase() === zone.toLowerCase())) ?? "Mid";
}

function cardWithType(data, type, fallback) {
  return data.cards.find((card) => card.subtype === type || card.cardType === type) ?? fallback;
}

function setConditionValue(game, player, opponent, context, effect, condition) {
  const kind = String(condition.kind ?? "");
  const expected = condition.value;
  const threshold = Number(expected);
  const atLeast = Number.isFinite(threshold) ? (condition.operator === "gt" ? threshold + 1 : condition.operator === "gte" ? threshold : threshold) : 1;
  const setBoolean = (value) => Boolean(value) === Boolean(expected);
  if (kind === "isFastest") { player.speed = setBoolean(true) ? 8 : 2; opponent.speed = setBoolean(true) ? 2 : 8; }
  else if (kind === "targetSpeedHigher") { opponent.speed = setBoolean(true) ? 8 : 2; player.speed = setBoolean(true) ? 2 : 8; }
  else if (kind === "hasTempo") player.tempo = Boolean(expected);
  else if (kind === "incomingAttackTargetsSelf") context.targetsSelf = Boolean(expected ?? true);
  else if (kind === "defenderPlayedDefense") context.defensePlayed = Boolean(expected);
  else if (kind === "targetHpAtMost") opponent.hp = condition.operator === "gt" ? Math.max(opponent.maxHp, threshold + 1) : Math.min(Math.max(1, threshold), opponent.maxHp);
  else if (kind === "targetPermanentEquipmentCount") {
    opponent.equipment = opponent.equipment.slice(0, Math.max(0, atLeast));
    while (opponent.equipment.length < Math.max(0, atLeast)) opponent.equipment.push(game.cardInstance(cardWithType(game.data, "Gear", player.character)));
  }
  else if (["firstAttackThisTurn", "firstNormalAttackThisTurn", "firstAttackAfterKataThisTurn", "firstHighAttackThisTurn"].includes(kind)) player.attackCount = expected ? 1 : 2;
  else if (kind === "attackNumber") player.attackCount = Number(expected);
  else if (kind === "focusSpentEarlierThisTurn") player.turnStats.focusSpent = expected ? 1 : 0;
  else if (["usedConsumableThisTurn", "consumableUsedThisRound"].includes(kind)) { player.turnStats.usedConsumableThisTurn = Boolean(expected); player.turnStats.usedConsumableThisRound = Boolean(expected); }
  else if (kind === "firstCardPlayedThisTurn") player.turnStats.playsThisTurn = expected ? 1 : 2;
  else if (kind === "hasTempo") player.tempo = Boolean(expected);
  else if (kind === "hasFewerCardsThanTarget") {
    if (expected) while (player.hand.length >= opponent.hand.length) opponent.hand.push(game.cardInstance(player.character));
    else while (player.hand.length < opponent.hand.length) player.hand.push(game.cardInstance(player.character));
  }
  else if (["alternateZone", "attackZone", "incomingZones", "attackZones", "incomingAttackZone"].includes(kind)) context.zone = Array.isArray(expected) ? expected[0] : expected;
  else if (kind === "armedEquipmentZoneMatched") context.sourceCard.zone = context.zone;
  else if (kind === "sourceExhausted") {
    if (expected) { if (!player.equipment.includes(context.sourceCard)) player.equipment.push(context.sourceCard); if (!player.exhaustedEquipment.includes(context.sourceCard.instanceId)) player.exhaustedEquipment.push(context.sourceCard.instanceId); }
    else player.exhaustedEquipment = player.exhaustedEquipment.filter((id) => id !== context.sourceCard?.instanceId);
  }
  else if (kind === "firstDamageThisRound") player.turnStats.damageTaken = expected ? Number(context.damage ?? 1) : 1;
  else if (kind === "blockedThisRound") player.turnStats.blocked = Boolean(expected);
  else if (kind === "playedDefenseSinceLastTurn") player.turnStats.playedDefenseSinceLastTurn = Boolean(expected);
  else if (kind === "previousAttackHit") player.turnStats.previousAttackHit = Boolean(expected);
  else if (kind === "differentZoneFromPreviousAttack") { player.turnStats.previousZone = expected ? (context.zone === "High" ? "Low" : "High") : context.zone; }
  else if (kind === "wasHitSinceLastTurn") player.lastTurnWasHit = Boolean(expected);
  else if (kind === "firstDefenseThisRound") player.turnStats.defenseCount = expected ? 0 : 1;
  else if (kind === "firstIncomingAttackThisRound") player.turnStats.incomingAttackCount = expected ? 1 : 2;
  else if (kind === "firstKataThisTurn") player.turnStats.kataCount = expected ? 0 : 1;
  else if (["oncePerTurn", "oncePerRound", "oncePerGame", "firstMatchingPerTurn", "firstMatchingPerRound", "firstMatchingPerSceneStay"].includes(kind)) {
    if (!expected) (player._used ??= new Set()).add(`${effect.id ?? "behavior"}:${kind === "oncePerGame" ? "game" : kind.includes("Round") ? "round" : "turn"}`);
  }
  else if (kind === "ownTurn") game.activePlayer = expected ? player.id : opponent.id;
  else if (["priorPunchAttack", "priorSpinAttack", "priorJumpOrSpinAttack"].includes(kind)) {
    const tag = kind === "priorPunchAttack" ? "Punch" : kind === "priorSpinAttack" ? "Spin" : "Jump";
    player.turnStats.previousAttackTags = expected ? [tag] : ["Dodge"];
  }
  else if (["attackTagAny", "attackHasTag", "attackHasAnyTag", "firstAttackWithTagThisTurn", "nextAttackHasTag"].includes(kind)) {
    const tags = Array.isArray(expected) ? expected : expected ? [expected] : ["Punch"];
    context.attackCard = { ...context.attackCard, tags: [...new Set(tags)] };
    player.turnStats.previousAttackTags = [...new Set(tags)];
  }
  else if (["defenseHasTag", "defenseTagAny"].includes(kind)) context.defenseCard = { ...context.defenseCard, tags: Array.isArray(expected) ? expected : [expected] };
  else if (kind === "targetHasExhaustedEquipment") { opponent.exhaustedEquipment = expected ? [opponent.equipment[0]?.instanceId ?? "target-equipment"] : []; }
  else if (kind === "targetHasMatchingArmor") {
    const armor = cardWithType(game.data, "Defense Equipment", player.character);
    const tags = context.attackCard?.tags ?? ["Punch"];
    const armorInstance = game.cardInstance({ ...armor, tags: [...new Set([...(armor.tags ?? []), ...tags])] });
    opponent.equipment = [armorInstance];
  }
  else if (kind === "hasImprovisedWeapon") {
    if (expected) player.equipment.push(game.cardInstance({ ...cardWithType(game.data, "Gear", player.character), tags: ["Improvised"] }));
    else player.equipment = player.equipment.filter((card) => !(card.subtype === "Gear" && card.tags?.includes("Improvised")));
  }
  else if (kind === "hasTwoPairedWeapons") {
    if (expected) player.equipment.push(game.cardInstance({ ...cardWithType(game.data, "Weapon", player.character), tags: ["Paired"] }), game.cardInstance({ ...cardWithType(game.data, "Weapon", player.character), tags: ["Paired"] }));
  }
  else if (kind === "hasWeaponEquipped") {
    if (expected && !player.equipment.some((card) => card.subtype === "Weapon")) player.equipment.push(game.cardInstance(cardWithType(game.data, "Weapon", player.character)));
    if (!expected) player.equipment = player.equipment.filter((card) => card.subtype !== "Weapon");
  }
  else if (kind === "isComboFinisher") context.isComboFinisher = Boolean(expected);
  else if (kind === "targetXpHigher") { opponent.xp = expected ? player.xp + 1 : player.xp; }
  else if (kind === "sameOpponentAsBlockedAttack") player.turnStats.previousOpponentId = (expected ?? true) ? opponent.id : -1;
  else if (kind === "attackBlocked" || kind === "previousAttackBlocked") { context.previousAttackBlocked = Boolean(expected); player.turnStats.previousAttackBlocked = Boolean(expected); }
  else if (kind === "priorLowAttack") player.turnStats.previousZone = expected ? "Low" : "High";
  else if (["priorDifferentZoneCount", "firstDifferentZoneSequenceThisTurn"].includes(kind)) player.turnStats.zones = new Set(Array.from({ length: Math.max(0, atLeast) }, (_, index) => ZONES[index % ZONES.length]));
  else if (["focusGeneratedThisTurn", "focusGeneratedBySingleCard"].includes(kind)) player.turnStats.focusGenerated = expected === true ? 5 : Number(expected ?? 0);
  else if (kind === "firstComboThisTurn") player.turnStats.comboCount = expected ? 1 : 2;
  else if (kind === "marketEndSlot") context.marketCard = game.market.at(-1);
  else if (kind === "nextMatchingAttack") { if (expected) player.statuses.push({ action: "modifyAttackPower", amount: 1, duration: "nextAttack" }); else player.statuses = player.statuses.filter((status) => status.duration !== "nextAttack"); }
  else if (kind === "completedBeltExamThisRound" || kind === "examRequirementCompleted" || kind === "completesActiveBeltExam") player.turnStats.completedBeltExamThisRound = Boolean(expected);
  else if (kind === "minimumBelt" || kind === "beltAtLeast") { const index = BELTS.findIndex((belt) => belt.toLowerCase() === String(expected).toLowerCase()); player.beltIndex = Math.max(0, index); }
  else if (kind === "goldBeltExamThirdZone") { player.beltIndex = 1; player.turnStats.zones = new Set(ZONES); }
  else if (kind === "manualActivation") context.manualActivation = Boolean(expected);
  else if (kind === "pendingFromSource") { context.sourceCard = context.sourceCard ?? player.equipment[0]; if (expected && context.sourceCard) { if (!player.equipment.includes(context.sourceCard)) player.equipment.push(context.sourceCard); player.exhaustedEquipment.push(context.sourceCard.instanceId); } }
  else if (kind === "minimumFinalCost" || kind === "minimumCost" || kind === "minimumPrintedCost") context.purchaseCost = condition.operator === "gt" ? threshold + 1 : threshold;
  else if (kind === "targetHasTemporaryNegativeStat") opponent.statuses.push({ action: "modifyDefense", amount: -1, duration: "turn" });
  else if (kind === "selfSpeedChangedThisRound") player.tempSpeed = expected ? 1 : 0;
  else if (kind === "incomingAttackIsUnarmed") { if (expected) opponent.equipment = opponent.equipment.filter((card) => card.subtype !== "Weapon"); else if (!opponent.equipment.some((card) => card.subtype === "Weapon")) opponent.equipment.push(game.cardInstance(cardWithType(game.data, "Weapon", player.character))); }
  else if (["firstCombatDamageThisRound", "firstDamagingAttackThisRound", "firstHitWithSourceThisTurn", "firstCombatDamageWithSourceThisTurn", "firstQualifyingHitThisTurn"].includes(kind)) { context.damage = expected ? 3 : 0; player.turnStats.damageTaken = expected ? 3 : 0; player.turnStats.hitCount = expected ? 1 : 0; }
  else if (kind === "combatDamageDealt") { context.damage = Number(expected ?? 0); player.turnStats.damageTaken = context.damage; player.turnStats.hitCount = context.damage > 0 ? 1 : 0; }
  else if (kind === "damageSourceIsWeapon" || kind === "attackUsesSourceEquipment" || kind === "incomingAttackUsesWeapon") { context.attackCard = { ...context.attackCard, tags: expected ? [...new Set([...(context.attackCard?.tags ?? []), "Weapon"])] : (context.attackCard?.tags ?? []).filter((tag) => tag !== "Weapon") }; }
  else if (kind === "attackIsUnarmed") context.attackIsUnarmed = Boolean(expected);
  else if (kind === "equippedCardIsSource") context.equippedCard = expected ? context.sourceCard : player.equipment.find((candidate) => candidate !== context.sourceCard);
  else if (kind === "equippedCardIsOtherPermanentEquipment") context.equippedCard = expected ? player.equipment.find((candidate) => candidate !== context.sourceCard) : context.sourceCard;
  else if (kind === "equippedThisTurn") player.turnStats.equippedThisTurn = Boolean(expected);
  else if (kind === "playedAttackThisTurn") player.turnStats.attacked = Boolean(expected);
  else if (kind === "boughtCardThisAscend" || kind === "boughtCardLastAscend") player.turnStats.boughtCardThisAscend = Boolean(expected);
  else if (kind === "ascendCompleted") context.ascendCompleted = Boolean(expected);
  else if (kind === "purchaseCompleted") context.purchaseCompleted = Boolean(expected);
  else if (kind === "costPaid") context.costPaid = Boolean(expected);
  else if (kind === "sceneChanged") context.sceneChanged = Boolean(expected);
  else if (kind === "locationEvent") context.locationEvent = expected;
  else if (kind === "attackUsesEquipmentTagAny") context.attackCard = { ...context.attackCard, tags: [...new Set([...(context.attackCard?.tags ?? []), ...(Array.isArray(expected) ? expected : [expected])])] };
  else if (kind === "sourceArmorHelpedBlock") context.block = expected ? 1 : 0;
  else if (kind === "firstArmorBlockThisRound") player.turnStats.armorBlocksThisRound = expected ? 0 : 1;
  else if (kind === "currentAttackIsNormal") context.attackCard = { ...context.attackCard, tags: expected ? (context.attackCard?.tags ?? []).filter((tag) => tag !== "Reversal") : [...new Set([...(context.attackCard?.tags ?? []), "Reversal"])] };
  else if (kind === "hasNotAttackedThisTurn") player.attackCount = expected ? 1 : 2;
  else if (kind === "firstHighAttackThisTurn") { player.attackCount = expected ? 1 : 2; context.zone = expected ? "High" : "Low"; }
  else if (kind === "afterOpponentCommitsDefense") context.defensePlayed = Boolean(expected);
  else if (kind === "wasHitSinceLastTurn") player.lastTurnWasHit = Boolean(expected);
  else if (kind === "incomingDamageAtLeast") context.incomingDamage = atLeast;
  else if (kind === "discardedCardType") player.turnStats.discardedCardType = expected;
  else if (kind === "firstNovelPurchasedCardType") context.firstNovelPurchasedCardType = Boolean(expected);
  else if (kind === "nextComboLearn") context.nextComboLearn = Boolean(expected);
  else if (kind === "hpAtOrBelowHalfMax") player.hp = expected ? Math.floor(player.maxHp / 2) : player.maxHp;
}

function satisfyConditions(game, player, opponent, context, effect) {
  for (const condition of effect.conditions ?? []) setConditionValue(game, player, opponent, context, effect, condition);
}

function primeFixture(game, card, effect) {
  const player = game.players[0];
  const opponent = game.players[1];
  const instance = game.cardInstance(card);
  const attack = game.cardInstance(cardWithType(game.data, "Attack", card));
  const defense = game.cardInstance(cardWithType(game.data, "Defense", card));
  const junk = game.cardInstance(game.data.cards.find((candidate) => candidate.subtype === "Junk") ?? card);
  const weapon = game.cardInstance(cardWithType(game.data, "Weapon", card));
  const gear = game.cardInstance(cardWithType(game.data, "Gear", card));
  const armor = game.cardInstance(cardWithType(game.data, "Defense Equipment", card));
  const zone = firstMatchingZone(effect);
  const tags = [...new Set(["Punch", "Kick", "Spin", "Jump", "Dodge", "Flow", "Weapon", ...(attack.tags ?? []), ...(defense.tags ?? []), ...(card.tags ?? [])])];

  player.hp = Math.max(1, Math.floor(player.maxHp / 2));
  opponent.hp = Math.max(1, Math.floor(opponent.maxHp / 2));
  player.speed = Math.max(player.speed, opponent.speed + 3);
  opponent.speed = Math.max(1, player.speed - 1);
  player.tempo = true;
  opponent.tempo = false;
  player.beltIndex = Math.min(BELTS.length - 1, Math.max(0, BELTS.findIndex((belt) => belt.toLowerCase() === String(conditionValue(effect, "minimumBelt") ?? "White").toLowerCase())));
  player.attackCount = Number(conditionValue(effect, "attackNumber") ?? 1);
  player.turnStats.attacked = true;
  player.turnStats.playsThisTurn = 1;
  player.turnStats.kataCount = 1;
  player.turnStats.consumableCount = 1;
  player.turnStats.usedConsumableThisTurn = true;
  player.turnStats.usedConsumableThisRound = true;
  player.turnStats.incomingAttackCount = 1;
  player.turnStats.hitCount = 1;
  player.turnStats.damageTaken = 0;
  player.turnStats.zones = new Set([zone]);
  player.turnStats.previousZone = zone === "High" ? "Low" : "High";
  player.turnStats.previousAttackTags = tags;
  player.turnStats.previousCardType = "Item";
  player.lastTurnWasHit = true;
  player.lastTurnAttacked = false;
  player.lastTurnWasBlocked = true;
  player.focus = 5;
  player.xp = 5;
  opponent.xp = 1;

  // Give movement, reveal, equipment, and choice effects real legal targets.
  player.hand.push(instance, junk, attack, defense, gear);
  player.discard.push(junk);
  player.deck.push(attack, defense, weapon, armor, gear);
  player.equipment.push(weapon, armor);
  player.played.push(weapon, armor);
  player.exhaustedEquipment.push(weapon.instanceId);
  opponent.hand.push(game.cardInstance(cardWithType(game.data, "Consumable", card)));
  opponent.equipment.push(game.cardInstance(cardWithType(game.data, "Weapon", card)));
  opponent.played.push(...opponent.equipment);

  const attackCard = { ...attack, tags };
  const defenseCard = { ...defense, tags };
  const context = {
    opponent,
    sourceCard: instance,
    attackCard,
    defenseCard,
    zone,
    incomingZone: zone,
    attackZone: zone,
    incomingAttackTargetsSelf: true,
    targetsSelf: true,
    defensePlayed: true,
    defenseOutsideTurn: true,
    incomingDamage: 3,
    damage: 3,
    attack: 5,
    block: 1,
    attackPower: 5,
    purchaseCost: 5,
    marketCard: game.market[0],
    purchasedCard: game.market[0],
    purchaseCompleted: true,
    costPaid: true,
    manualActivation: true,
    reactionPlayedAgainstSelf: true,
    forcedDiscardEvent: true,
    sourceAffectedCount: 3,
    sourceAttackMatchesArmedEffect: true,
    firstMatchingEventBefore: true,
    firstMatchingAttack: true,
    sameOpponentAsBlockedAttack: true,
    completedBeltExamThisRound: true,
    examRequirementCompleted: true,
    xpFromLegalAttackOrDefense: true,
    nonHonorSceneChangedThisRound: true,
    sceneChanged: true,
    locationEvent: "attack",
    phase: game.phase,
    allowChoice: true,
  };
  satisfyConditions(game, player, opponent, context, effect);
  return { player, opponent, instance, context };
}

function stateFingerprint(game, result) {
  const player = game.players[0];
  const opponent = game.players[1];
  return JSON.stringify({
    hp: [player.hp, opponent.hp],
    focus: [player.focus, opponent.focus],
    xp: [player.xp, opponent.xp],
    hand: player.hand.map((card) => card.instanceId),
    discard: player.discard.map((card) => card.instanceId),
    deck: player.deck.map((card) => card.instanceId),
    equipment: player.equipment.map((card) => card.instanceId),
    statuses: player.statuses,
    nextAttackPower: player.nextAttackPower,
    nextAttackFlow: player.nextAttackFlow,
    pendingChoice: game.pendingChoice,
    result: Object.fromEntries(Object.entries(result ?? {}).filter(([key]) => !["player", "opponent", "sourceCard"].includes(key))),
  });
}

/**
 * Executes every canonical effect in an isolated real headless Game. An entry
 * is certified only when the engine applies it without an unsupported event
 * and the application produces an observable state, choice, status, or
 * resolver-context mutation.
 */
export async function certifyBehavioralEffects(data) {
  data ??= await loadGameData();
  const entries = [];
  for (const [catalogId, entry] of Object.entries(data.cardEffects.cards ?? {})) {
    const card = data.byId.get(catalogId);
    if (!card) continue;
    for (const effect of entry.effects ?? []) {
      const game = new Game(data, { seed: 71 });
      const { player, opponent, instance, context } = primeFixture(game, card, effect);
      const beforeUnsupported = game.telemetry.unsupportedEffects;
      const beforeApplications = game.telemetry.effectApplications;
      const beforeEvents = game.events.length;
      const before = stateFingerprint(game, {});
      let result;
      const conditionResult = game.evaluateConditions(effect, { player, opponent, sourceCard: instance, ...context });
      try {
        result = game.applyCardEffects(player, instance, effect.trigger, { ...context, effectOverride: [{ ...effect, id: effect.id ?? `${catalogId}:behavior` }] });
      } catch (error) {
        entries.push({ catalogId, effectId: effect.id ?? null, certified: false, reason: `exception:${error.message}` });
        continue;
      }
      const after = stateFingerprint(game, result);
      const applied = game.telemetry.effectApplications > beforeApplications;
      const unsupported = game.telemetry.unsupportedEffects > beforeUnsupported;
      const observable = before !== after;
      entries.push({
        catalogId,
        effectId: effect.id ?? null,
        resolver: effect.resolver ?? null,
        trigger: effect.trigger,
        conditions: effect.conditions ?? [],
        conditionsPass: conditionResult.pass,
        conditionsKnown: conditionResult.known,
        applied,
        unsupported,
        unsupportedEvents: game.events.slice(beforeEvents).filter((event) => event.type === "unsupported-effect"),
        observable,
        certified: applied && !unsupported && observable,
        reason: unsupported ? "runtime-reported-unsupported" : applied && observable ? "executed" : "no-observable-mutation",
      });
    }
  }
  const certified = entries.filter((entry) => entry.certified).length;
  return {
    totalEffects: entries.length,
    behaviorallyCertifiedEffects: certified,
    behaviorallyUnsupportedEffects: entries.length - certified,
    entries,
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const report = await certifyBehavioralEffects();
  console.log(JSON.stringify(report, null, 2));
  if (report.behaviorallyUnsupportedEffects) process.exitCode = 1;
}
