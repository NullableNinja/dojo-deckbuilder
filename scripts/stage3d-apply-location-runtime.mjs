import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../app/playtest.tsx", import.meta.url);
let source = await readFile(path, "utf8");
if (source.includes("STAGE3D_LOCATION_RUNTIME")) {
  console.log("Stage 3D Quick Duel patch already applied.");
  process.exit(0);
}

function replaceOnce(needle, replacement, label) {
  const matches = source.split(needle).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected exactly one match, found ${matches}`);
  source = source.replace(needle, replacement);
}
function replaceRegex(pattern, replacement, label) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`${label}: expected exactly one match, found ${matches.length}`);
  source = source.replace(pattern, replacement);
}

source = source.replace("locationAttackRuleModifiers, ", "");
replaceOnce(
  'import { consumableRuntimeCommands, type ConsumableRuntimeContext } from "./consumable-effect-resolvers";',
  'import { consumableRuntimeCommands, type ConsumableRuntimeContext } from "./consumable-effect-resolvers";\nimport { resolveLocationEvent, structuredLocationAttackModifiers, structuredLocationDefenseGuardModifier, structuredLocationEquipmentContributionModifier, structuredLocationHealingModifier, structuredLocationPurchaseCostModifier, structuredLocationKataFocusModifier, structuredLocationComboNumericModifier, type LocationCommand } from "./location-effect-resolvers";\nimport { locationRuntimeDelta, locationUsageContext, markLocationCommandsUsed, resetLocationRound, resetLocationScene, resetLocationTurn, usedAcrossPlayersAfter } from "./location-runtime";',
  "Location runtime imports",
);

replaceOnce(
  '  stage3cPurchaseCostModifier?: number;\n};',
  '  stage3cPurchaseCostModifier?: number;\n  activeLocationId?: string;\n  locationController?: "player" | "ai";\n  locationOwnTurn?: boolean;\n  locationInInitiate?: boolean;\n  locationUsedEffectsThisTurn?: string[];\n  locationUsedEffectsThisRound?: string[];\n  locationUsedEffectsThisScene?: string[];\n  locationUsedEffectsAcrossPlayersThisRound?: string[];\n  locationNextRoundSpeed?: number;\n  locationStandingAttack?: number;\n  locationStandingDefense?: number;\n  locationChosenCounterZone?: string | null;\n  locationActiveBeltExam?: boolean;\n  locationEquipmentExhaustedThisRound?: boolean;\n  locationReadiedOutsideInitiateEquipmentIds?: string[];\n  locationPendingChoice?: { kind: "location-choice"; sourceCardId: string; effectId: string; operation: string; options: string[]; metadata: Record<string, unknown>; step?: string } | null;\n};',
  "Board Location state",
);

replaceOnce(
  '  | { kind: "fire-drill-zone"; sourceCardId: string; defenseId: string; originalZone: string; alternativeZones: string[] };',
  '  | { kind: "fire-drill-zone"; sourceCardId: string; defenseId: string; originalZone: string; alternativeZones: string[] }\n  | { kind: "location-choice"; sourceCardId: string; effectId: string; operation: string; options: string[]; metadata: Record<string, unknown>; step?: string };',
  "Pending Location choice",
);
replaceOnce(
  '  locationId: string;\n  round: number;',
  '  locationId: string;\n  usedLocationEffectsAcrossPlayersThisRound?: string[];\n  round: number;',
  "Match global Location usage",
);

replaceRegex(
  /const QUICK_DUEL_LOCATION_NAMES = new Set\(\[[\s\S]*?\]\);\nconst quickDuelLocationPool = locationPool\.filter\(\(card\) => QUICK_DUEL_LOCATION_NAMES\.has\(card\.name\)\);/,
  'const quickDuelLocationPool = locationPool.filter((card) => card.catalogId.includes("-LOC-CORE-"));',
  "all Core Locations in Quick Duel",
);

replaceRegex(
  /function locationAttackModifier\([\s\S]*?\n}\n\nfunction printedAttackRuleModifier/,
`// STAGE3D_LOCATION_RUNTIME — Quick Duel executes Core Locations from the canonical structured registry.\nfunction locationForBoard(board: Board) { return board.activeLocationId ? cardFor(board.activeLocationId) : undefined; }\nfunction locationUsageFor(board: Board) { return locationUsageContext(board, board.locationUsedEffectsAcrossPlayersThisRound ?? []); }\nfunction locationTags(board: Board) { return board.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card)).flatMap((card) => card.tags); }\nfunction priorCardsForCurrentPlay(board: Board, currentId?: string) {\n  const ids = currentId && board.cardsThisTurn.at(-1) === currentId ? board.cardsThisTurn.slice(0, -1) : board.cardsThisTurn;\n  return ids.map(cardFor).filter((card): card is CardEntry => Boolean(card));\n}\nfunction lowestFocusId(ids: string[]) { return [...ids].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)) || cardCost(cardFor(left)) - cardCost(cardFor(right)) || left.localeCompare(right))[0]; }\nfunction deterministicDrawDiscard(board: Board, draw: number, discard: number) {\n  let next = drawCards(board, Math.max(0, draw));\n  const count = Math.min(Math.max(0, discard), next.hand.length);\n  const discarded = [...next.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)) || left.localeCompare(right)).slice(0, count);\n  return { ...next, hand: next.hand.filter((id) => !discarded.includes(id)), discard: [...next.discard, ...discarded] };\n}\nfunction locationPendingChoice(board: Board, command: LocationCommand, location: CardEntry) {\n  const options = Array.isArray(command.metadata.choiceOptions) ? command.metadata.choiceOptions.map(String) : [];\n  return { ...board, locationPendingChoice: { kind: "location-choice" as const, sourceCardId: location.id, effectId: command.effectId, operation: command.operation ?? command.action, options, metadata: command.metadata } };\n}\nfunction applyAiLocationChoice(board: Board, command: LocationCommand) {\n  let next = board;\n  const operation = command.operation ?? command.action;\n  if (operation === "beltExamSpeedOrCycleChoice") {\n    if (next.hand.length) next = deterministicDrawDiscard(next, 1, 1);\n    else next = { ...next, tempSpeed: next.tempSpeed + 1, speedChangedThisRound: true };\n  } else if (operation === "drawThenDiscard") {\n    next = deterministicDrawDiscard(next, Number(command.metadata.drawCount ?? 1), Number(command.metadata.discardCount ?? 1));\n  } else if (operation === "readyEquipmentOrSpeedChoice") {\n    const readyId = [...(next.exhaustedEquipment ?? [])].sort()[0];\n    next = readyId ? readyEquipment(next, readyId) : { ...next, tempSpeed: next.tempSpeed + 1, speedChangedThisRound: true };\n  } else if (operation === "discardForReadyOrDefenseChoice") {\n    const discardId = lowestFocusId(next.hand);\n    if (discardId) next = { ...next, hand: removeOne(next.hand, discardId), discard: [...next.discard, discardId] };\n    const readyId = [...(next.exhaustedEquipment ?? [])].sort()[0];\n    next = readyId ? readyEquipment(next, readyId) : { ...next, locationStandingDefense: (next.locationStandingDefense ?? 0) + 1 };\n  } else if (operation === "discardJunkDrawGainFocus" || operation === "destroyJunkGainFocusLoseHp") {\n    const junkHand = next.hand.filter((id) => isJunk(cardFor(id))).sort();\n    const junkDiscard = next.discard.filter((id) => isJunk(cardFor(id))).sort();\n    const junkId = junkHand[0] ?? junkDiscard[0];\n    if (junkId) {\n      if (junkHand.includes(junkId)) next = { ...next, hand: removeOne(next.hand, junkId) };\n      else next = { ...next, discard: removeOne(next.discard, junkId) };\n      if (operation === "destroyJunkGainFocusLoseHp") next = { ...next, destroyed: [...(next.destroyed ?? []), junkId] };\n      else next = { ...next, discard: [...next.discard, junkId] };\n      if (operation === "discardJunkDrawGainFocus") next = drawCards(next, Number(command.metadata.drawCount ?? 1));\n      next = gainFocus(next, Number(command.metadata.focusGain ?? command.amount ?? 0));\n      if (operation === "destroyJunkGainFocusLoseHp") { const hpLoss = Number(command.metadata.hpLoss ?? 1); next = { ...next, hp: Math.max(0, next.hp - hpLoss), damageTaken: next.damageTaken + hpLoss }; }\n    }\n  } else if (operation === "nextCounterAttackChosenZone" || command.action === "chooseZone") {\n    next = { ...next, locationChosenCounterZone: "High" };\n  }\n  return next;\n}\nfunction applyLocationImmediate(board: Board, commands: LocationCommand[], controller: "player" | "ai") {\n  if (!commands.length) return board;\n  let next = markLocationCommandsUsed(board, commands);\n  const delta = locationRuntimeDelta(commands);\n  if (delta.focus) next = gainFocus(next, delta.focus);\n  if (delta.draw) next = drawCards(next, delta.draw);\n  const delayedSpeed = commands.filter((command) => command.action === "modifySpeed" && command.metadata.appliesNextRound === true).reduce((total, command) => total + command.amount, 0);\n  const currentSpeed = delta.speed - delayedSpeed;\n  if (currentSpeed) next = { ...next, tempSpeed: next.tempSpeed + currentSpeed, speedChangedThisRound: true };\n  if (delayedSpeed) next = { ...next, locationNextRoundSpeed: (next.locationNextRoundSpeed ?? 0) + delayedSpeed };\n  if (delta.standingAttack) next = { ...next, locationStandingAttack: (next.locationStandingAttack ?? 0) + delta.standingAttack };\n  if (delta.standingDefense) next = { ...next, locationStandingDefense: (next.locationStandingDefense ?? 0) + delta.standingDefense };\n  if (delta.loseFocus) next = spendFocus(next, Math.min(delta.loseFocus, next.focus));\n  if (delta.activeBeltExam) next = { ...next, locationActiveBeltExam: true };\n  if (delta.damage) next = { ...next, hp: Math.max(0, next.hp - delta.damage), damageTaken: next.damageTaken + delta.damage };\n  for (const command of commands) {\n    if (!locationRuntimeDelta([command]).choices.length) continue;\n    next = controller === "ai" ? applyAiLocationChoice(next, command) : locationPendingChoice(next, command, locationForBoard(next)!);\n  }\n  return next;\n}\nfunction applyLocationSceneReveal(board: Board, location: CardEntry, controller: "player" | "ai") {\n  let next = resetLocationScene({ ...board, activeLocationId: location.id, locationController: controller });\n  const commands = resolveLocationEvent(location, "sceneReveal", { ...locationUsageFor(next) });\n  return applyLocationImmediate(next, commands, controller);\n}\nfunction applyLocationRoundStart(board: Board, opponent: Board, location: CardEntry, controller: "player" | "ai") {\n  const selfSpeed = fighterStat(board, "Speed");\n  const targetSpeed = fighterStat(opponent, "Speed");\n  const commands = resolveLocationEvent(location, "roundStart", { ...locationUsageFor(board), isFastest: selfSpeed >= targetSpeed, isSlowest: selfSpeed <= targetSpeed, selfSpeed, opponentSpeed: targetSpeed });\n  return applyLocationImmediate(board, commands, controller);\n}\nfunction applyLocationAfterAttack(board: Board, card: CardEntry, zone: string, combatDamageDealt: number, attackHit: boolean) {\n  const location = locationForBoard(board);\n  if (!location) return board;\n  const commands = resolveLocationEvent(location, "afterAttack", { ...locationUsageFor(board), combatDamageDealt, attackHit, attackZone: zone, attackTagAny: card.tags, attackUsesEquipmentTagAny: locationTags(board), usesSceneChosenCounterZone: Boolean(board.locationChosenCounterZone && board.locationChosenCounterZone.toLocaleLowerCase() === zone.toLocaleLowerCase()), sameRoundAsSceneChoice: Boolean(board.locationChosenCounterZone) });\n  let next = applyLocationImmediate(board, commands, board.locationController ?? "ai");\n  if (board.locationChosenCounterZone) next = { ...next, locationChosenCounterZone: null };\n  return next;\n}\nfunction applyLocationBlock(board: Board) {\n  const location = locationForBoard(board);\n  if (!location) return board;\n  const commands = resolveLocationEvent(location, "block", { ...locationUsageFor(board) });\n  return applyLocationImmediate(board, commands, board.locationController ?? "ai");\n}\nfunction applyLocationConsumableResolve(board: Board, card: CardEntry) {\n  const location = locationForBoard(board);\n  if (!location || !isCoreConsumableCard(card)) return board;\n  const commands = resolveLocationEvent(location, "consumableResolve", { ...locationUsageFor(board), cardTypeAny: [card.cardType], cardSubtypeOrTagAny: [card.subtype, ...card.tags] });\n  return applyLocationImmediate(board, commands, board.locationController ?? "ai");\n}\nfunction applyLocationEquipmentExhaust(board: Board, equipment: CardEntry) {\n  const location = locationForBoard(board);\n  if (!location) return { ...board, locationEquipmentExhaustedThisRound: true };\n  const first = !board.locationEquipmentExhaustedThisRound;\n  const commands = resolveLocationEvent(location, "equipmentExhaust", { ...locationUsageFor(board), ownTurn: Boolean(board.locationOwnTurn), equipmentTagAny: equipment.tags, equipmentExhaustedEarlierThisRound: !first, firstEquipmentExhaustThisRound: first });\n  return { ...applyLocationImmediate(board, commands, board.locationController ?? "ai"), locationEquipmentExhaustedThisRound: true };\n}\nfunction applyLocationEquipmentEquip(board: Board, equipment: CardEntry) {\n  const location = locationForBoard(board);\n  if (!location) return board;\n  const commands = resolveLocationEvent(location, "equipmentEquip", { ...locationUsageFor(board), equipmentTagAny: equipment.tags, cardSubtypeOrTagAny: [equipment.subtype, ...equipment.tags] });\n  return applyLocationImmediate(board, commands, board.locationController ?? "ai");\n}\nfunction applyLocationBeltExamComplete(board: Board) {\n  const location = locationForBoard(board);\n  if (!location) return board;\n  const commands = resolveLocationEvent(location, "beltExamComplete", { ...locationUsageFor(board), firstAcrossPlayersPerRound: true });\n  let next = applyLocationImmediate(board, commands, board.locationController ?? "ai");\n  const across = usedAcrossPlayersAfter(commands, board.locationUsedEffectsAcrossPlayersThisRound ?? []);\n  return { ...next, locationUsedEffectsAcrossPlayersThisRound: across };\n}\nfunction locationHealingAmount(board: Board, baseAmount: number, source: CardEntry) {\n  if (baseAmount <= 0) return baseAmount;\n  const location = locationForBoard(board);\n  if (!location) return baseAmount;\n  const parsed = structuredLocationHealingModifier(location, { ...locationUsageFor(board), healingSourceAny: [source.cardType, source.subtype, ...source.tags], cardTypeAny: [source.cardType], cardSubtypeOrTagAny: [source.subtype, ...source.tags] });\n  return Math.max(parsed.minimum, baseAmount + parsed.amount);\n}\nfunction locationPurchasePrice(board: Board, card: CardEntry, basePrice: number) {\n  const location = locationForBoard(board);\n  if (!location) return basePrice;\n  const parsed = structuredLocationPurchaseCostModifier(location, { ...locationUsageFor(board), cardTypeAny: [card.cardType], cardSubtypeOrTagAny: [card.subtype, ...card.tags], printedCostAtLeast: cardCost(card), firstItemPurchaseThisAscend: !board.boughtCardThisAscend, attackedThisTurn: board.attacksThisTurn > 0, firstMatchingPerTurn: true });\n  return Math.max(parsed.minimum, basePrice + parsed.amount);\n}\nfunction consumeLocationPurchase(board: Board, card: CardEntry) {\n  const location = locationForBoard(board);\n  if (!location) return board;\n  const commands = resolveLocationEvent(location, "purchase", { ...locationUsageFor(board), cardTypeAny: [card.cardType], cardSubtypeOrTagAny: [card.subtype, ...card.tags], printedCostAtLeast: cardCost(card), firstItemPurchaseThisAscend: !board.boughtCardThisAscend, attackedThisTurn: board.attacksThisTurn > 0, firstMatchingPerTurn: true });\n  return applyLocationImmediate(board, commands, board.locationController ?? "ai");\n}\nfunction locationKeepsUnboughtMarket(board: Board) {\n  const location = locationForBoard(board);\n  if (!location) return false;\n  return locationRuntimeDelta(resolveLocationEvent(location, "marketRefill", { ...locationUsageFor(board) })).keepUnboughtMarketCards;\n}\nfunction locationKataFocusAdjustment(board: Board, card: CardEntry) {\n  const location = locationForBoard(board);\n  if (!location || !isKata(card)) return { adjustment: 0, commands: [] as LocationCommand[] };\n  const prior = priorCardsForCurrentPlay(board, card.id);\n  const parsed = structuredLocationKataFocusModifier(location, { ...locationUsageFor(board), firstKataThisTurn: !prior.some(isKata) });\n  const adjustment = (parsed.setTo === null ? 0 : parsed.setTo - cardFocus(card)) + parsed.bonus;\n  return { adjustment, commands: parsed.commands };\n}\nfunction locationFocusGeneration(board: Board, card: CardEntry) {\n  const location = locationForBoard(board);\n  if (!location || cardFocus(card) <= 0) return board;\n  const commands = resolveLocationEvent(location, "focusGeneration", { ...locationUsageFor(board), printedFocusAtLeast: cardFocus(card) });\n  return applyLocationImmediate(board, commands, board.locationController ?? "ai");\n}\nfunction locationAttackModifier(location: CardEntry | undefined, card: CardEntry, board: Board, zone: string, defender?: Board, isReversal = false): AttackModifier {\n  if (!location) return { power: 0, damage: 0, notes: [], locationCommands: [] };\n  const prior = board.cardsThisTurn.map(cardFor).filter((entry): entry is CardEntry => Boolean(entry));\n  const equipped = board.equipment.map(cardFor).filter((entry): entry is CardEntry => Boolean(entry));\n  const currentCombo = comboAttackModifier(board, card, zone, isReversal);\n  const parsed = structuredLocationAttackModifiers(location, { ...locationUsageFor(board), attackZone: zone, attackTagAny: card.tags, equipmentTagAny: equipped.flatMap((entry) => entry.tags), firstAttackThisTurn: board.attacksThisTurn === 0, firstLowAttackThisTurn: !board.zonesPlayed.some((played) => played.toLocaleLowerCase() === "low"), firstHighAttackThisTurn: !board.zonesPlayed.some((played) => played.toLocaleLowerCase() === "high"), hasWeapon: equipped.some(isWeapon), hasWeaponEquipped: equipped.some(isWeapon), attackIsUnarmed: !equipped.some(isWeapon), itemPlayedBeforeFirstAttack: board.attacksThisTurn === 0 && prior.some((entry) => entry.cardType === "Item"), afterFirstConsumableUsedThisTurn: prior.some((entry) => entry.subtype === "Consumable"), kataGrantedFlowThisAttack: board.nextAttackHasFlow && prior.some(isKata), firstKataFlowThisTurn: true, isComboFinisher: currentCombo.triggeredIds.length > 0, firstComboFinisherThisTurn: !board.comboTriggered, isFastest: defender ? fighterStat(board, "Speed") >= fighterStat(defender, "Speed") : false });\n  return { power: parsed.power, damage: parsed.damage, notes: parsed.notes, locationCommands: parsed.commands };\n}\nfunction locationDefenseModifier(location: CardEntry | undefined, card: CardEntry | null | undefined, board: Board, zone: string): CombatModifier {\n  if (!location) return { value: 0, notes: [], locationCommands: [] };\n  const parsed = structuredLocationDefenseGuardModifier(location, { ...locationUsageFor(board), defenseTagAny: card?.tags ?? [], defenseZone: zone, incomingAttackZone: zone, firstDefenseThisRound: !board.defendedThisRound, equipmentExhaustedEarlierThisRound: Boolean(board.locationEquipmentExhaustedThisRound), firstEquipmentExhaustThisRound: !board.locationEquipmentExhaustedThisRound, selfSpeed: fighterStat(board, "Speed") });\n  return { value: parsed.guard + parsed.equipmentDefense, notes: parsed.commands.map((command) => command.effectId), locationCommands: parsed.commands };\n}\nfunction locationEquipmentPrintedAdjustment(board: Board, card: CardEntry, base: number) {\n  if (!base) return 0;\n  const location = locationForBoard(board);\n  if (!location) return base;\n  const parsed = structuredLocationEquipmentContributionModifier(location, { ...locationUsageFor(board), equipmentTagAny: card.tags, cardSubtypeOrTagAny: [card.subtype, ...card.tags], equipmentReadiedOutsideInitiate: (board.locationReadiedOutsideInitiateEquipmentIds ?? []).includes(card.id) });\n  let amount = 0;\n  if (isWeapon(card) || card.subtype === "Defense Equipment") amount += parsed.weaponArmor;\n  if ((board.locationReadiedOutsideInitiateEquipmentIds ?? []).includes(card.id)) amount += parsed.readiedOutsideInitiate;\n  return Math.max(0, base + amount);\n}\n\nfunction printedAttackRuleModifier`,
  "structured Location helper block",
);

replaceOnce(
  'type CombatModifier = { value: number; notes: string[] };\ntype AttackModifier = { power: number; damage: number; notes: string[] };',
  'type CombatModifier = { value: number; notes: string[]; locationCommands?: LocationCommand[] };\ntype AttackModifier = { power: number; damage: number; notes: string[]; locationCommands?: LocationCommand[] };',
  "modifier Location commands",
);

replaceRegex(
  /function fighterStat\(board: Board, stat: "ATK" \| "DEF" \| "Speed"\) \{[\s\S]*?\n}\n\nfunction incomingAttackEquipmentModifier/,
`function fighterStat(board: Board, stat: "ATK" | "DEF" | "Speed") {\n  const fighter = cardFor(board.fighterId);\n  const beltBonus = belts.slice(0, board.belt + 1)\n    .filter((belt) => belt.reward.stat === stat)\n    .reduce((total, belt) => total + Number(belt.reward.amount ?? 0), 0);\n  const base = numberValue(fighter?.stats[stat]);\n  const equipment = board.equipment.reduce((total, id) => {\n    const card = cardFor(id);\n    if (!card) return total;\n    if (stat === "ATK") return total + locationEquipmentPrintedAdjustment(board, card, numberValue(card.stats["Attack Bonus"]));\n    if (stat === "DEF") return total + locationEquipmentPrintedAdjustment(board, card, passiveEquipmentGuard(card));\n    if (stat === "Speed") return total + equipmentSpeedModifier(card);\n    return total;\n  }, 0);\n  const challengeBonus = stat === "ATK" || stat === "DEF" ? board.statBoost ?? 0 : 0;\n  const locationStanding = stat === "ATK" ? (board.locationStandingAttack ?? 0) : stat === "DEF" ? (board.locationStandingDefense ?? 0) : 0;\n  return base + beltBonus + equipment + challengeBonus + locationStanding + (stat === "Speed" ? board.tempSpeed : 0) + (stat === "DEF" ? (board.stage3cDefenseModifier ?? 0) : 0);\n}\n\nfunction incomingAttackEquipmentModifier`,
  "fighterStat Location contributions",
);

replaceRegex(
  /function marketPriceFor\(board: Board, card: CardEntry \| undefined\) \{[\s\S]*?\n}\nfunction equipmentSuppressionForZone/,
`function marketPriceFor(board: Board, card: CardEntry | undefined) {\n  if (!card) return Number.POSITIVE_INFINITY;\n  const certificationDiscount = beltHasReward(board, "market-discount") && !board.boughtCardThisAscend ? 1 : 0;\n  const base = Math.max(0, cardCost(card) + (board.stage3cPurchaseCostModifier ?? 0) + (card.cardType === "Item" ? (board.nextItemCostPenalty ?? 0) : 0) - certificationDiscount);\n  return locationPurchasePrice(board, card, base);\n}\nfunction equipmentSuppressionForZone`,
  "purchase pricing",
);

replaceRegex(
  /function exhaustEquipment\(board: Board, id: string\) \{[\s\S]*?\n}\n\nfunction readyEquipment\(board: Board, id: string\) \{[\s\S]*?\n}/,
`function exhaustEquipment(board: Board, id: string) {\n  if (isEquipmentExhausted(board, id)) return board;\n  const card = cardFor(id);\n  const exhausted = { ...board, exhaustedEquipment: [...(board.exhaustedEquipment ?? []), id] };\n  return card ? applyLocationEquipmentExhaust(exhausted, card) : exhausted;\n}\n\nfunction readyEquipment(board: Board, id: string) {\n  const next = { ...board, exhaustedEquipment: (board.exhaustedEquipment ?? []).filter((candidate) => candidate !== id) };\n  if (board.locationInInitiate) return next;\n  return { ...next, locationReadiedOutsideInitiateEquipmentIds: [...new Set([...(next.locationReadiedOutsideInitiateEquipmentIds ?? []), id])] };\n}`,
  "equipment lifecycle hooks",
);

replaceOnce(
  '    fighterId, hp: gameDefinition.mode.startingHp, maxHp: gameDefinition.mode.startingHp, xp: 0, focus: 0, focusGeneratedThisTurn: 0, focusSpentThisTurn: 0, belt: 0,',
  '    fighterId, hp: gameDefinition.mode.startingHp, maxHp: gameDefinition.mode.startingHp, xp: 0, focus: 0, focusGeneratedThisTurn: 0, focusSpentThisTurn: 0, belt: 0, activeLocationId: undefined, locationController: "player", locationOwnTurn: false, locationInInitiate: false, locationUsedEffectsThisTurn: [], locationUsedEffectsThisRound: [], locationUsedEffectsThisScene: [], locationUsedEffectsAcrossPlayersThisRound: [], locationNextRoundSpeed: 0, locationStandingAttack: 0, locationStandingDefense: 0, locationChosenCounterZone: null, locationActiveBeltExam: false, locationEquipmentExhaustedThisRound: false, locationReadiedOutsideInitiateEquipmentIds: [], locationPendingChoice: null,',
  "empty board Location state",
);

replaceRegex(
  /function markCompletedTask\(board: Board\) \{[\s\S]*?\n}/,
`function markCompletedTask(board: Board) {\n  const next = board.belt + 1;\n  if (!beltTaskMet(board) || board.completedTasks.includes(next)) return board;\n  return applyLocationBeltExamComplete({ ...board, completedTasks: [...board.completedTasks, next], completedBeltExamThisRound: true });\n}`,
  "belt exam Location hook",
);

replaceOnce(
  '  if (board.nextAttackAnyZone || card.zone?.includes("Any")) return ["High", "Mid", "Low"];',
  '  if (board.locationChosenCounterZone && board.currentAttackIsReversal) return [board.locationChosenCounterZone];\n  if (board.nextAttackAnyZone || card.zone?.includes("Any")) return ["High", "Mid", "Low"];',
  "chosen counter zone legality",
);

replaceOnce(
  '  if (timing === "onPlay") {\n    next = gainFocus(next, numberValue(card.focusValue));',
  '  if (timing === "onPlay") {\n    const kataLocation = locationKataFocusAdjustment(next, card);\n    next = gainFocus(next, numberValue(card.focusValue) + kataLocation.adjustment);\n    next = markLocationCommandsUsed(next, kataLocation.commands);\n    next = locationFocusGeneration(next, card);',
  "structured Kata/focus generation",
);
replaceOnce(
  '      next.equipment = [...next.equipment, card.id];\n      if (equipmentSpeedModifier(card)) next.speedChangedThisRound = true;',
  '      next.equipment = [...next.equipment, card.id];\n      next = applyLocationEquipmentEquip(next, card);\n      if (equipmentSpeedModifier(card)) next.speedChangedThisRound = true;',
  "Location equipment equip hook",
);
replaceOnce(
  '    next = applyStage3CTiming(next, card, timing, owner, context, "self");\n  } else {',
  '    const hpBeforeFamily = next.hp;\n    next = applyStage3CTiming(next, card, timing, owner, context, "self");\n    if (next.hp > hpBeforeFamily) next = { ...next, hp: Math.min(next.maxHp, hpBeforeFamily + locationHealingAmount(next, next.hp - hpBeforeFamily, card)) };\n  } else {',
  "Location healing for migrated families",
);
replaceOnce(
  '      if (effect.kind === "heal") next.hp = Math.min(next.maxHp, next.hp + effect.amount);',
  '      if (effect.kind === "heal") next.hp = Math.min(next.maxHp, next.hp + locationHealingAmount(next, effect.amount, card));',
  "Location healing for legacy families",
);
replaceOnce(
  '  if (timing === "onPlay") {\n    const conditionalHeal = conditionalHealAfterHit(card, board.wasHitSinceLastTurn);',
  '  if (timing === "afterResolve" && isCoreConsumableCard(card)) next = applyLocationConsumableResolve(next, card);\n  if (timing === "onPlay") {\n    const conditionalHeal = conditionalHealAfterHit(card, board.wasHitSinceLastTurn);',
  "Consumable resolve Location hook",
);

replaceRegex(
  /function advanceRound\(current: Match, sceneChanges: boolean, line: string\) \{[\s\S]*?\n}\n\nfunction prepareAiTurn/,
`function advanceRound(current: Match, sceneChanges: boolean, line: string) {\n  const nextRound = current.round + 1;\n  const freshLocations = current.locations.length ? current.locations : shuffle(quickDuelLocationPool.map((card) => card.id));\n  const locationId = sceneChanges ? freshLocations[0] ?? current.locationId : current.locationId;\n  const location = cardFor(locationId)!;\n  const keepUnbought = locationKeepsUnboughtMarket(current.player) || locationKeepsUnboughtMarket(current.ai);\n  const marketState = current.marketPurchasedThisRound || keepUnbought\n    ? { market: current.market, marketDeck: current.marketDeck, marketDiscard: current.marketDiscard }\n    : refreshMarketRow(current.market, current.marketDeck, current.marketDiscard);\n  const resetBoard = (board: Board, controller: "player" | "ai") => stage3cAdvanceRound(resetLocationRound({ ...board, xp: board.xp + 1, tempo: true, tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, equipmentAttackPlan: null, equipmentDefenseGuard: 0, pendingReversalBonusOnBlock: 0, reversalAttackBonus: 0, exhaustedEquipment: [], readyAtInitiate: [], readyAtHide: [], combatDamageEventsThisRound: 0, usedConsumableThisRound: false, lastAttackHit: false, attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], damageReductionUsed: false, blockedThisRound: false, usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [], locationEquipmentExhaustedThisRound: false, locationReadiedOutsideInitiateEquipmentIds: [], locationUsedEffectsAcrossPlayersThisRound: [], locationPendingChoice: null, locationController: controller }));\n  let player = resetBoard(current.player, "player");\n  let ai = resetBoard(current.ai, "ai");\n  if (sceneChanges) { player = applyLocationSceneReveal(player, location, "player"); ai = applyLocationSceneReveal(ai, location, "ai"); }\n  player = applyLocationRoundStart(player, ai, location, "player");\n  ai = applyLocationRoundStart(ai, player, location, "ai");\n  const playerFirst = fighterStat(player, "Speed") >= fighterStat(ai, "Speed");\n  player = { ...player, locationOwnTurn: playerFirst, locationInInitiate: playerFirst };\n  ai = { ...ai, locationOwnTurn: !playerFirst, locationInInitiate: !playerFirst };\n  const initiatedPlayer = playerFirst ? applyInitiateCarryover(player) : player;\n  const turnOrder: Match["turnOrder"] = playerFirst ? ["player", "ai"] : ["ai", "player"];\n  const marketNote = current.marketPurchasedThisRound ? "The Shared Market remains in place." : keepUnbought ? "The active scene keeps the unbought Market cards in place." : "No one bought a card, so Market Mercy refreshes all seven slots.";\n  return { ...current, ...marketState, player: initiatedPlayer, ai, marketPurchasedThisRound: false, pendingDiscard: null, pendingChoice: initiatedPlayer.locationPendingChoice ?? null, pendingCombatContinuation: null, usedLocationEffectsAcrossPlayersThisRound: [], locationId, locations: sceneChanges ? freshLocations.slice(1) : current.locations, round: nextRound, phase: playerFirst ? "player-initiate" as const : "ai-ready" as const, turnOrder, turnIndex: 0 as const, selectedAttackId: null, log: [\`Honor \${nextRound}: \${location?.name ?? "Tournament Mat"} is active. Both fighters gain 1 XP and refresh Tempo. \${marketNote} \${playerFirst ? "You" : "Computer"} take initiative.\`, line, ...current.log].slice(0, 32) };\n}\n\nfunction prepareAiTurn`,
  "Honor/Scene lifecycle",
);

replaceOnce(
  '  const initiatedAi = applyInitiateCarryover({ ...current.ai, usedEffectIdsThisTurn: [] });',
  '  const initiatedAi = applyInitiateCarryover(resetLocationTurn({ ...current.ai, usedEffectIdsThisTurn: [], locationOwnTurn: true, locationInInitiate: true }));',
  "AI turn Location reset",
);
replaceOnce(
  '  const aiStart = turnEquipment.board;',
  '  let aiStart = { ...turnEquipment.board, locationInInitiate: false };\n  aiStart = applyLocationManualActionAi(aiStart);',
  "AI manual scene action",
);

replaceOnce(
  'function locationFocusModifier(location: CardEntry | undefined, card: CardEntry, board: Board): CombatModifier {',
  'function locationFocusModifier_REMOVED(location: CardEntry | undefined, card: CardEntry, board: Board): CombatModifier {',
  "guard old Location focus helper unexpectedly remaining",
);

replaceOnce(
  '    const locationModifier = locationFocusModifier(cardFor(current.locationId), card, current.player);\n    let supportBoard = isKata(card) ? stage3cConsumeKata(current.player) : current.player;\n    let nextPlayer = markCompletedTask(applyCardEffects({ ...supportBoard, hand: removeOne(supportBoard.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id], focus: current.player.focus + locationModifier.value, lastAttackHit: false }, card, "player", "onPlay", isCoreConsumableCard(card) ? stage3cConsumableContext(current.player) : {}));',
  '    let supportBoard = isKata(card) ? stage3cConsumeKata(current.player) : current.player;\n    let nextPlayer = markCompletedTask(applyCardEffects({ ...supportBoard, hand: removeOne(supportBoard.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id], lastAttackHit: false }, card, "player", "onPlay", isCoreConsumableCard(card) ? stage3cConsumableContext(current.player) : {}));',
  "remove old Location focus use",
);
source = source.replace('${locationModifier.notes.length ? ` ${locationModifier.notes.join("; ")}.` : ""}', '');

replaceOnce(
  '  const beginYell = () => setMatch((current) => current?.phase === "player-initiate" ? write(current, "Initiate complete. Yell begins; subtlety has left the building.", { phase: "player-yell", player: { ...current.player, usedEffectIdsThisTurn: [] } }) : current);',
  '  const beginYell = () => setMatch((current) => current?.phase === "player-initiate" ? write(current, "Initiate complete. Yell begins; subtlety has left the building.", { phase: "player-yell", player: resetLocationTurn({ ...current.player, usedEffectIdsThisTurn: [], locationOwnTurn: true, locationInInitiate: false }) }) : current);',
  "human turn Location reset",
);

replaceOnce(
  '  const write = (current: Match, line: string, changes: Partial<Match> = {}) => ({ ...current, ...changes, log: [line, ...current.log].slice(0, 32) });',
`  const write = (current: Match, line: string, changes: Partial<Match> = {}) => {\n    let next: Match = { ...current, ...changes, log: [line, ...current.log].slice(0, 32) };\n    const across = [...new Set([...(current.usedLocationEffectsAcrossPlayersThisRound ?? []), ...(next.player.locationUsedEffectsAcrossPlayersThisRound ?? []), ...(next.ai.locationUsedEffectsAcrossPlayersThisRound ?? [])])];\n    let player = { ...next.player, locationUsedEffectsAcrossPlayersThisRound: across };\n    let ai = { ...next.ai, locationUsedEffectsAcrossPlayersThisRound: across };\n    const pending = next.pendingChoice ?? player.locationPendingChoice ?? null;\n    if (player.locationPendingChoice) player = { ...player, locationPendingChoice: null };\n    next = { ...next, player, ai, pendingChoice: pending, usedLocationEffectsAcrossPlayersThisRound: across };\n    return next;\n  };`,
  "Location global usage/choice synchronization",
);

replaceOnce(
  '    const player = { ...emptyBoard(fighterId), xp: 1 };',
  '    let player = { ...emptyBoard(fighterId), xp: 1, locationController: "player" as const };',
  "begin player mutable",
);
replaceOnce(
  '    const ai = { ...emptyBoard(choices[Math.floor(Math.random() * choices.length)].id), xp: 1, hp: challenge.aiHp, maxHp: challenge.aiHp, statBoost: challenge.statBoost };',
  '    let ai = { ...emptyBoard(choices[Math.floor(Math.random() * choices.length)].id), xp: 1, hp: challenge.aiHp, maxHp: challenge.aiHp, statBoost: challenge.statBoost, locationController: "ai" as const };',
  "begin AI mutable",
);
replaceOnce(
  '    const playerFirst = fighterStat(player, "Speed") >= fighterStat(ai, "Speed");',
  '    const openingLocation = cardFor(currentLocation)!;\n    player = applyLocationSceneReveal(player, openingLocation, "player");\n    ai = applyLocationSceneReveal(ai, openingLocation, "ai");\n    player = applyLocationRoundStart(player, ai, openingLocation, "player");\n    ai = applyLocationRoundStart(ai, player, openingLocation, "ai");\n    const playerFirst = fighterStat(player, "Speed") >= fighterStat(ai, "Speed");\n    player = { ...player, locationOwnTurn: playerFirst, locationInInitiate: playerFirst };\n    ai = { ...ai, locationOwnTurn: !playerFirst, locationInInitiate: !playerFirst };',
  "opening scene reveal/round start",
);
replaceOnce(
  'pendingCombatContinuation: null, reversalRemainingAiAttacks:',
  'pendingCombatContinuation: null, usedLocationEffectsAcrossPlayersThisRound: [], reversalRemainingAiAttacks:',
  "begin Match global Location state",
);

replaceOnce(
  '    const price = marketPriceFor(current.player, card);',
  '    const price = marketPriceFor(current.player, card);',
  "purchase price already structured",
);
replaceOnce(
  '    nextPlayer = stage3cConsumePurchase(markCompletedTask({ ...nextPlayer, discard: [...nextPlayer.discard, id], purchasedTypes: [...nextPlayer.purchasedTypes, card.cardType], cardsBought: nextPlayer.cardsBought + 1, boughtCardThisAscend: true, nextItemCostPenalty: card.cardType === "Item" ? 0 : nextPlayer.nextItemCostPenalty }));',
  '    nextPlayer = stage3cConsumePurchase(markCompletedTask(consumeLocationPurchase({ ...nextPlayer, discard: [...nextPlayer.discard, id], purchasedTypes: [...nextPlayer.purchasedTypes, card.cardType], cardsBought: nextPlayer.cardsBought + 1, nextItemCostPenalty: card.cardType === "Item" ? 0 : nextPlayer.nextItemCostPenalty }, card)));\n    nextPlayer = { ...nextPlayer, boughtCardThisAscend: true };',
  "player purchase Location consumption",
);
replaceOnce(
  'marketPriceFor(current.ai, cardFor(id)) <= current.ai.focus',
  'marketPriceFor(current.ai, cardFor(id)) <= current.ai.focus',
  "AI purchase eligibility structured",
);
replaceOnce(
  'let aiAfterPurchase = purchasedCard ? stage3cConsumePurchase(markCompletedTask({ ...current.ai, focus: current.ai.focus - marketPriceFor(current.ai, purchasedCard), discard: [...current.ai.discard, purchasedCard.id], purchasedTypes: [...current.ai.purchasedTypes, purchasedCard.cardType], cardsBought: current.ai.cardsBought + 1 })) : current.ai;',
  'let aiAfterPurchase = purchasedCard ? stage3cConsumePurchase(markCompletedTask(consumeLocationPurchase({ ...current.ai, focus: current.ai.focus - marketPriceFor(current.ai, purchasedCard), discard: [...current.ai.discard, purchasedCard.id], purchasedTypes: [...current.ai.purchasedTypes, purchasedCard.cardType], cardsBought: current.ai.cardsBought + 1 }, purchasedCard))) : current.ai;',
  "AI purchase Location consumption",
);

replaceOnce(
  '    const locationModifier = locationAttackModifier(location, card, current.player, zone);',
  '    const locationModifier = locationAttackModifier(location, card, current.player, zone, current.ai);',
  "player attack structured context",
);
replaceOnce(
  '  const locationModifier = locationAttackModifier(location, card, activeEquipment.board, zone);',
  '  const locationModifier = locationAttackModifier(location, card, activeEquipment.board, zone, current.player);',
  "AI attack structured context",
);
replaceOnce(
  '    const locationModifier = locationAttackModifier(location, card, current.player, zone);',
  '    const locationModifier = locationAttackModifier(location, card, current.player, zone, current.ai, true);',
  "reversal structured context",
);

replaceOnce(
  '    const attackState = { ...stage3cConsumeAttackStatuses(current.player, card, zone),',
  '    const locationTrackedPlayer = markLocationCommandsUsed(current.player, locationModifier.locationCommands ?? []);\n    const attackState = { ...stage3cConsumeAttackStatuses(locationTrackedPlayer, card, zone),',
  "player attack Location usage",
);
replaceOnce(
  '  const consumedAttackBoard = stage3cConsumeAttackStatuses(activeEquipment.board, card, zone);',
  '  const consumedAttackBoard = stage3cConsumeAttackStatuses(markLocationCommandsUsed(activeEquipment.board, locationModifier.locationCommands ?? []), card, zone);',
  "AI attack Location usage",
);
replaceOnce(
  '    let nextPlayer = applyCardEffects({ ...stage3cConsumeAttackStatuses(current.player, card, zone, true),',
  '    let nextPlayer = applyCardEffects({ ...stage3cConsumeAttackStatuses(markLocationCommandsUsed(current.player, locationModifier.locationCommands ?? []), card, zone, true),',
  "reversal Location usage",
);

replaceOnce(
  '    nextPlayer = markCompletedTask(nextPlayer);\n    const result = hit',
  '    nextPlayer = applyLocationAfterAttack(markCompletedTask(nextPlayer), card, zone, damage, hit);\n    if (!hit && defenseCard) nextAi = applyLocationBlock(nextAi);\n    const result = hit',
  "player after-Attack/AI Block hooks",
);
replaceOnce(
  '    let nextAi = markCompletedTask({ ...current.ai, damageDealt: current.ai.damageDealt + damage, hitThisTurn: current.ai.hitThisTurn || hit, lastAttackHit: hit });',
  '    let nextAi = markCompletedTask({ ...current.ai, damageDealt: current.ai.damageDealt + damage, hitThisTurn: current.ai.hitThisTurn || hit, lastAttackHit: hit });',
  "AI attack task anchor",
);
replaceOnce(
  '    if (!nextPlayer.hp) nextAi = { ...nextAi, xp: nextAi.xp + 2 };\n    const message = hit',
  '    nextAi = applyLocationAfterAttack(nextAi, aiCard, pending.zone, damage, hit);\n    if (!hit && defenseCard) nextPlayer = applyLocationBlock(nextPlayer);\n    if (!nextPlayer.hp) nextAi = { ...nextAi, xp: nextAi.xp + 2 };\n    const message = hit',
  "AI after-Attack/player Block hooks",
);
replaceOnce(
  '    nextPlayer = markCompletedTask(nextPlayer);\n    const modifiers = [...locationModifier.notes,',
  '    nextPlayer = applyLocationAfterAttack(markCompletedTask(nextPlayer), card, zone, damage, hit);\n    if (!hit && defenseCard) nextAi = applyLocationBlock(nextAi);\n    const modifiers = [...locationModifier.notes,',
  "reversal after-Attack/Block hooks",
);

replaceOnce(
  '    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1,',
  '    if (defenseCard) nextAi = { ...markLocationCommandsUsed(nextAi, defenseModifier.locationCommands ?? []), hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1,',
  "AI Defense Location usage",
);
replaceOnce(
  '      nextPlayer = stage3cConsumeDefenseStatuses(markCompletedTask({ ...nextPlayer, hand: removeOne(nextPlayer.hand, defenseCard.id), discard: [...nextPlayer.discard, defenseCard.id], xp: nextPlayer.xp + 1,',
  '      nextPlayer = stage3cConsumeDefenseStatuses(markCompletedTask({ ...markLocationCommandsUsed(nextPlayer, locationModifier.locationCommands ?? []), hand: removeOne(nextPlayer.hand, defenseCard.id), discard: [...nextPlayer.discard, defenseCard.id], xp: nextPlayer.xp + 1,',
  "player Defense Location usage",
);
replaceOnce(
  '    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1,',
  '    if (defenseCard) nextAi = { ...markLocationCommandsUsed(nextAi, defenseModifier.locationCommands ?? []), hand: removeOne(nextAi.hand, defenseCard.id), playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1,',
  "reversal AI Defense Location usage",
);

replaceOnce(
  'function reduceDamageForFighter(board: Board, damage: number): { board: Board; damage: number; note: string | null } {\n  const structuredReduction = stage3cTakeDamagePrevention(board, damage);\n  const equipmentReduction = applyMandatoryEquipmentDamageReduction(structuredReduction.board, structuredReduction.damage);',
  'function reduceDamageForFighter(board: Board, damage: number): { board: Board; damage: number; note: string | null } {\n  const structuredReduction = stage3cTakeDamagePrevention(board, damage);\n  const equipmentReduction = applyMandatoryEquipmentDamageReduction(structuredReduction.board, structuredReduction.damage);\n  const location = locationForBoard(equipmentReduction.board);\n  const equipmentReduced = structuredReduction.damage > equipmentReduction.damage;\n  const locationReductionCommands = location && equipmentReduced ? resolveLocationEvent(location, "damageReduction", { ...locationUsageFor(equipmentReduction.board), damageReductionSourceAny: ["Defensive Equipment"], firstMatchingPerTurn: true }) : [];\n  const locationReduction = locationRuntimeDelta(locationReductionCommands).damageReduction;\n  const locationReducedBoard = markLocationCommandsUsed(equipmentReduction.board, locationReductionCommands);\n  const locationReducedDamage = Math.max(0, equipmentReduction.damage - Math.max(0, locationReduction));',
  "damage reduction Location hook",
);
replaceOnce(
  '  let next = equipmentReduction.board;\n  let remaining = equipmentReduction.damage;',
  '  let next = locationReducedBoard;\n  let remaining = locationReducedDamage;',
  "damage reduction Location state",
);

replaceOnce(
  '  return { ...current, player: { ...current.player, attacksReceivedThisRound:',
  '  return { ...current, player: { ...current.player, locationOwnTurn: false, locationInInitiate: false, attacksReceivedThisRound:',
  "AI strike player turn flag",
);

replaceOnce(
  '  const nextPlayer = playAreaCleanup(current.player);',
  '  const nextPlayer = { ...playAreaCleanup(current.player), locationOwnTurn: false, locationInInitiate: false };',
  "Hide Location turn flag",
);

replaceOnce(
  'function playAreaCleanup(board: Board) {\n  let hideBoard = board;',
  'function playAreaCleanup(board: Board) {\n  let hideBoard = resetLocationTurn(board);',
  "Hide Location usage reset",
);

replaceOnce(
  'function applyInitiateCarryover(board: Board) {\n  const stage3cBoard = stage3cStartTurn(board);',
  'function applyInitiateCarryover(board: Board) {\n  const stage3cBoard = stage3cStartTurn({ ...board, locationInInitiate: true });',
  "Initiate Location phase",
);

replaceOnce(
  'function cardLabel(card: CardEntry) { return `${card.name} · ${card.catalogId}`; }',
`function applyLocationManualActionAi(board: Board) {\n  const location = locationForBoard(board);\n  if (!location) return board;\n  const commands = resolveLocationEvent(location, "manualSceneAction", { ...locationUsageFor(board), hasJunkAvailable: [...board.hand, ...board.discard].some((id) => isJunk(cardFor(id))) });\n  return applyLocationImmediate(board, commands, "ai");\n}\nfunction locationManualActionAvailable(board: Board) {\n  const location = locationForBoard(board);\n  if (!location || ![...board.hand, ...board.discard].some((id) => isJunk(cardFor(id)))) return false;\n  return resolveLocationEvent(location, "manualSceneAction", { ...locationUsageFor(board), hasJunkAvailable: true }).length > 0;\n}\n\nfunction cardLabel(card: CardEntry) { return \`${card.name} · \${card.catalogId}\`; }`,
  "manual scene action helpers",
);

replaceOnce(
  'function CombatStage({ match, currentLocation, selectedAttack, turnCoach, guided, playerCards, aiCards, onInspect, onDropCard, onOpenCoach }: { match: Match; currentLocation?: CardEntry; selectedAttack?: CardEntry | null; turnCoach: string; guided: boolean; playerCards: string[]; aiCards: string[]; onInspect: (card: CardEntry) => void; onDropCard: (id: string) => void; onOpenCoach: () => void }) {',
  'function CombatStage({ match, currentLocation, selectedAttack, turnCoach, guided, playerCards, aiCards, onInspect, onDropCard, onOpenCoach, onLocationAction, locationActionAvailable }: { match: Match; currentLocation?: CardEntry; selectedAttack?: CardEntry | null; turnCoach: string; guided: boolean; playerCards: string[]; aiCards: string[]; onInspect: (card: CardEntry) => void; onDropCard: (id: string) => void; onOpenCoach: () => void; onLocationAction: () => void; locationActionAvailable: boolean }) {',
  "CombatStage scene action props",
);
replaceOnce(
  '    <header className="combat-stage-heading"><button type="button" onClick={() => currentLocation && onInspect(currentLocation)}><span>Current Scene</span><b>{currentLocation?.name ?? "Tournament Mat"}</b><small><i>SCENE RULE</i>{currentLocation?.rulesText ?? "The Department finds no reason to intervene."}</small></button><div><span>ROUND</span><b>{match.round}</b><small>{phaseLabel}</small></div></header>',
  '    <header className="combat-stage-heading"><button type="button" onClick={() => currentLocation && onInspect(currentLocation)}><span>Current Scene</span><b>{currentLocation?.name ?? "Tournament Mat"}</b><small><i>SCENE RULE</i>{currentLocation?.rulesText ?? "The Department finds no reason to intervene."}</small></button>{locationActionAvailable && <button type="button" className="location-scene-action" onClick={onLocationAction}><span>SCENE ACTION</span><b>Use Location</b><small>Resolve the current structured Location action</small></button>}<div><span>ROUND</span><b>{match.round}</b><small>{phaseLabel}</small></div></header>',
  "scene action button",
);
replaceOnce(
  '<CombatStage match={match} currentLocation={currentLocation} selectedAttack={pendingAttack} turnCoach={turnCoach} guided={settings.guided} playerCards={player.playArea} aiCards={ai.playArea} onInspect={(card) => setInspectedId(card.id)} onDropCard={useHandCard} onOpenCoach={() => setCoachOpen(true)} />',
  '<CombatStage match={match} currentLocation={currentLocation} selectedAttack={pendingAttack} turnCoach={turnCoach} guided={settings.guided} playerCards={player.playArea} aiCards={ai.playArea} onInspect={(card) => setInspectedId(card.id)} onDropCard={useHandCard} onOpenCoach={() => setCoachOpen(true)} onLocationAction={useLocationAction} locationActionAvailable={match.phase === "player-yell" && locationManualActionAvailable(player)} />',
  "wire scene action",
);

replaceOnce(
  '  const discardBadHabitForFocus = (id: string) => setMatch((current) => {',
`  const useLocationAction = () => setMatch((current) => {\n    if (!current || current.phase !== "player-yell" || current.pendingChoice) return current;\n    const location = cardFor(current.locationId);\n    if (!location) return current;\n    const commands = resolveLocationEvent(location, "manualSceneAction", { ...locationUsageFor(current.player), hasJunkAvailable: [...current.player.hand, ...current.player.discard].some((id) => isJunk(cardFor(id))) });\n    const player = applyLocationImmediate(current.player, commands, "player");\n    return write(current, \`${location.name} scene action opened. Choose the required Junk card.\`, { player });\n  });\n\n  const discardBadHabitForFocus = (id: string) => setMatch((current) => {`,
  "human manual Location action",
);

replaceOnce(
  '    if (choice.kind === "destroy-junk") {',
`    if (choice.kind === "location-choice") {\n      const operation = choice.operation;\n      if (operation === "discardJunkDrawGainFocus" || operation === "destroyJunkGainFocusLoseHp") {\n        const sourceCards = source === "discard" ? current.player.discard : current.player.hand;\n        if (!sourceCards.includes(cardId) || !isJunk(selected)) return current;\n        let player = source === "hand" ? { ...current.player, hand: removeOne(current.player.hand, cardId) } : { ...current.player, discard: removeOne(current.player.discard, cardId) };\n        if (operation === "destroyJunkGainFocusLoseHp") player = { ...player, destroyed: [...(player.destroyed ?? []), cardId] };\n        else player = { ...player, discard: [...player.discard, cardId] };\n        if (operation === "discardJunkDrawGainFocus") player = drawCards(player, Number(choice.metadata.drawCount ?? 1));\n        player = gainFocus(player, Number(choice.metadata.focusGain ?? 0));\n        if (operation === "destroyJunkGainFocusLoseHp") { const hpLoss = Number(choice.metadata.hpLoss ?? 1); player = { ...player, hp: Math.max(0, player.hp - hpLoss), damageTaken: player.damageTaken + hpLoss }; }\n        return write(current, \`${selected.name} resolves the scene action.\`, { player, pendingChoice: null });\n      }\n      if (operation === "readyEquipmentOrSpeedChoice" && source === "equipment" && current.player.equipment.includes(cardId) && isEquipmentExhausted(current.player, cardId)) return write(current, \`${selected.name} readied by the Location.\`, { player: readyEquipment(current.player, cardId), pendingChoice: null });\n      if (operation === "discardForReadyOrDefenseChoice" && choice.step !== "choose") {\n        if (!current.player.hand.includes(cardId)) return current;\n        const player = { ...current.player, hand: removeOne(current.player.hand, cardId), discard: [...current.player.discard, cardId] };\n        return write(current, \`${selected.name} discarded. Choose a Location payoff.\`, { player, pendingChoice: { ...choice, step: "choose" } });\n      }\n      if (operation === "discardForReadyOrDefenseChoice" && choice.step === "choose" && source === "equipment" && current.player.equipment.includes(cardId) && isEquipmentExhausted(current.player, cardId)) return write(current, \`${selected.name} readied by the Location.\`, { player: readyEquipment(current.player, cardId), pendingChoice: null });\n      return current;\n    }\n\n    if (choice.kind === "destroy-junk") {`,
  "resolve card-based Location choices",
);

replaceOnce(
  '  const skipPendingChoice = () => setMatch((current) => {',
`  const resolveLocationOption = (option: string) => setMatch((current) => {\n    const choice = current?.pendingChoice;\n    if (!current || !choice || choice.kind !== "location-choice") return current;\n    let player = current.player;\n    if (choice.operation === "nextCounterAttackChosenZone" || choice.operation === "chooseZone") player = { ...player, locationChosenCounterZone: option };\n    else if (choice.operation === "beltExamSpeedOrCycleChoice") {\n      if (option.includes("speed")) player = { ...player, tempSpeed: player.tempSpeed + 1, speedChangedThisRound: true };\n      else player = deterministicDrawDiscard(player, 1, 1);\n    } else if (choice.operation === "readyEquipmentOrSpeedChoice" && option.includes("speed")) player = { ...player, tempSpeed: player.tempSpeed + 1, speedChangedThisRound: true };\n    else if (choice.operation === "discardForReadyOrDefenseChoice" && option.includes("def")) player = { ...player, locationStandingDefense: (player.locationStandingDefense ?? 0) + 1 };\n    return write(current, \`Location choice filed: \${option}.\`, { player, pendingChoice: null });\n  });\n\n  const skipPendingChoice = () => setMatch((current) => {`,
  "Location option resolver",
);

replaceRegex(
  /const pendingChoiceOptions = match\.pendingChoice\?\.kind === "destroy-junk"[\s\S]*?: \[\];\n  const effectChoiceTitle/,
`const pendingChoiceOptions = match.pendingChoice?.kind === "destroy-junk"\n    ? [...player.hand.map((id, index) => ({ id, source: "hand" as const, index })).filter((entry) => isJunk(cardFor(entry.id))), ...player.discard.map((id, index) => ({ id, source: "discard" as const, index })).filter((entry) => isJunk(cardFor(entry.id)))]\n    : match.pendingChoice?.kind === "location-choice" && ["discardJunkDrawGainFocus", "destroyJunkGainFocusLoseHp"].includes(match.pendingChoice.operation)\n      ? [...player.hand.map((id, index) => ({ id, source: "hand" as const, index })).filter((entry) => isJunk(cardFor(entry.id))), ...player.discard.map((id, index) => ({ id, source: "discard" as const, index })).filter((entry) => isJunk(cardFor(entry.id)))]\n      : match.pendingChoice?.kind === "location-choice" && match.pendingChoice.operation === "readyEquipmentOrSpeedChoice"\n        ? (player.exhaustedEquipment ?? []).filter((id) => player.equipment.includes(id)).map((id, index) => ({ id, source: "equipment" as const, index }))\n        : match.pendingChoice?.kind === "location-choice" && match.pendingChoice.operation === "discardForReadyOrDefenseChoice"\n          ? match.pendingChoice.step === "choose" ? (player.exhaustedEquipment ?? []).filter((id) => player.equipment.includes(id)).map((id, index) => ({ id, source: "equipment" as const, index })) : player.hand.map((id, index) => ({ id, source: "hand" as const, index }))\n          : match.pendingChoice?.kind === "discard-draw" || match.pendingChoice?.kind === "discard-hand"\n            ? player.hand.map((id, index) => ({ id, source: "hand" as const, index }))\n            : match.pendingChoice?.kind === "deck-pick"\n              ? match.pendingChoice.revealed.map((id, index) => ({ id, source: "deck" as const, index })).filter((entry) => cardMatchesDeckFilter(cardFor(entry.id), match.pendingChoice!.kind === "deck-pick" ? match.pendingChoice!.filter : "item"))\n              : match.pendingChoice?.kind === "deck-order"\n                ? match.pendingChoice.revealed.map((id, index) => ({ id, source: "deck" as const, index }))\n                : match.pendingChoice?.kind === "ready-equipment"\n                  ? (player.exhaustedEquipment ?? []).filter((id) => player.equipment.includes(id)).map((id, index) => ({ id, source: "equipment" as const, index }))\n                  : [];\n  const effectChoiceTitle`,
  "Location pending choice options",
);

replaceOnce(
  '                    : match.pendingChoice?.kind === "ready-equipment" ? "Ready Equipment?" : "Resolve printed effect";',
  '                    : match.pendingChoice?.kind === "ready-equipment" ? "Ready Equipment?" : match.pendingChoice?.kind === "location-choice" ? "Resolve Location choice" : "Resolve printed effect";',
  "Location choice title",
);
replaceOnce(
  '                    : match.pendingChoice?.kind === "ready-equipment" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This effect"} can ready one exhausted Equipment card you control. You may decline.` : "Resolve the printed effect.";',
  '                    : match.pendingChoice?.kind === "ready-equipment" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This effect"} can ready one exhausted Equipment card you control. You may decline.` : match.pendingChoice?.kind === "location-choice" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Location"} requires your explicit decision. Choose one legal option.` : "Resolve the printed effect.";',
  "Location choice prompt",
);

replaceOnce(
  ': match.pendingChoice?.kind === "incoming-equipment-zone" ? ["High", "Mid", "Low"].map((zone) => <button type="button" onClick={() => chooseIncomingEquipmentZone(zone)} key={zone}><span>CALL ZONE</span><b>{zone}</b><small>{zone === match.pendingStrike?.zone ? "Matches the declared Attack" : "Does not match the declared Attack"}</small></button>) : pendingChoiceOptions.map((entry) => {',
  ': match.pendingChoice?.kind === "incoming-equipment-zone" ? ["High", "Mid", "Low"].map((zone) => <button type="button" onClick={() => chooseIncomingEquipmentZone(zone)} key={zone}><span>CALL ZONE</span><b>{zone}</b><small>{zone === match.pendingStrike?.zone ? "Matches the declared Attack" : "Does not match the declared Attack"}</small></button>) : match.pendingChoice?.kind === "location-choice" && (match.pendingChoice.operation === "nextCounterAttackChosenZone" || match.pendingChoice.operation === "chooseZone" || match.pendingChoice.operation === "beltExamSpeedOrCycleChoice") ? (match.pendingChoice.options.length ? match.pendingChoice.options : ["High", "Mid", "Low"]).map((option) => <button type="button" onClick={() => resolveLocationOption(option)} key={option}><span>LOCATION CHOICE</span><b>{option}</b><small>Structured scene option</small></button>) : pendingChoiceOptions.map((entry) => {',
  "Location modal option buttons",
);

replaceOnce(
  '      const protects = fighter.name === "Sentry Bobby" || (fighter.name === "Crash Test Dummy" && remaining >= 4);',
  '      const protects = fighter.name === "Sentry Bobby" || (fighter.name === "Crash Test Dummy" && remaining >= 4);',
  "fighter protection anchor",
);

source = source.replaceAll('locationAttackModifier(location, card, current.player, zone)', 'locationAttackModifier(location, card, current.player, zone, current.ai)');
source = source.replaceAll('locationAttackModifier(location, card, current.ai, zone)', 'locationAttackModifier(location, card, current.ai, zone, current.player)');

await writeFile(path, source);
console.log("Applied Stage 3D structured Location runtime integration to app/playtest.tsx");
