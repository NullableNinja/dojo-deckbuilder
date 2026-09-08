import fs from "node:fs";

function replaceOnce(text, search, replacement, label) {
  if (text.includes(replacement)) return text;
  const index = text.indexOf(search);
  if (index < 0) throw new Error(`Stage 3D patch anchor missing: ${label}`);
  if (text.indexOf(search, index + search.length) >= 0) throw new Error(`Stage 3D patch anchor is not unique: ${label}`);
  return text.slice(0, index) + replacement + text.slice(index + search.length);
}

function replaceRegexOnce(text, regex, replacement, label) {
  const matches = [...text.matchAll(new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`))];
  if (!matches.length) {
    if (typeof replacement === "string" && text.includes(replacement)) return text;
    throw new Error(`Stage 3D patch regex anchor missing: ${label}`);
  }
  if (matches.length !== 1) throw new Error(`Stage 3D patch regex anchor is not unique (${matches.length}): ${label}`);
  return text.replace(regex, replacement);
}

function replaceAllExact(text, search, replacement, minimum, label) {
  const count = text.split(search).length - 1;
  if (count < minimum) {
    if (text.includes(replacement)) return text;
    throw new Error(`Stage 3D patch expected at least ${minimum} ${label} anchor(s), found ${count}`);
  }
  return text.split(search).join(replacement);
}

const runtimePath = "app/character-runtime.ts";
let runtime = fs.readFileSync(runtimePath, "utf8");
runtime = runtime.replace('import cardEffectsJson from "./data/card-effects.json";', 'import cardEffectsJson from "./data/card-effects.json" with { type: "json" };');
runtime = runtime.replace('from "./character-effect-resolvers";', 'from "./character-effect-resolvers.ts";');
runtime = runtime.replace(
  '  optional: boolean;\n};',
  '  optional: boolean;\n  selectionField: "selectedId" | "selectedZone" | "selectedMode" | "optionalAccepted";\n};',
);
runtime = runtime.replace(
  'const mark = (board: CharacterRuntimeBoard, key: string, value: unknown = true) => ({ ...board, characterMarks: { ...markMap(board), [key]: value } });',
  'const mark = (board: CharacterRuntimeBoard, key: string, value: unknown = true) => ({ ...board, characterMarks: { ...markMap(board), [key]: value } });\nconst clearMark = (board: CharacterRuntimeBoard, key: string) => { const next = markMap(board); delete next[key]; return { ...board, characterMarks: next }; };',
);
runtime = runtime.replace(
  'function makeChoice(effect: CharacterStructuredEffect, prompt: string, options: string[], optional = true): CharacterRuntimeChoice {\n  return { resolver: String(effect.resolver ?? ""), effectId: idFor(effect), prompt, options, optional };\n}',
  'function makeChoice(effect: CharacterStructuredEffect, prompt: string, options: string[], optional = true, selectionField: CharacterRuntimeChoice["selectionField"] = "selectedId"): CharacterRuntimeChoice {\n  return { resolver: String(effect.resolver ?? ""), effectId: idFor(effect), prompt, options, optional, selectionField };\n}\n\nfunction cycleWithPlayerChoice(board: CharacterRuntimeBoard, effect: CharacterStructuredEffect, resolver: string, actor: CharacterRuntimeActor, choices: CharacterRuntimeChoice[], selectedId?: string | null, drawAmount = 1, discardAmount = 1, selectionField: CharacterRuntimeChoice["selectionField"] = "selectedId") {\n  if (actor !== "player") return { board: cycle(board, drawAmount, discardAmount, selectedId), resolved: true };\n  const pendingKey = `pending:${resolver}`;\n  if (hasMark(board, pendingKey)) {\n    if (!selectedId || !board.hand.includes(selectedId)) { choices.push(makeChoice(effect, `Choose ${discardAmount} card${discardAmount === 1 ? "" : "s"} to discard.`, board.hand, false, selectionField)); return { board, resolved: false }; }\n    return { board: clearMark(discard(board, discardAmount, selectedId), pendingKey), resolved: true };\n  }\n  const drawn = draw(board, drawAmount);\n  if (!selectedId || !drawn.hand.includes(selectedId)) { choices.push(makeChoice(effect, `Choose ${discardAmount} card${discardAmount === 1 ? "" : "s"} to discard after drawing ${drawAmount}.`, drawn.hand, false, selectionField)); return { board: mark(drawn, pendingKey), resolved: false }; }\n  return { board: discard(drawn, discardAmount, selectedId), resolved: true };\n}',
);
runtime = runtime.replace(
  '    && greenCharacterAbilityUnlocked(resolver, board.belt)',
  '    && (!resolver.startsWith("character.green.") || greenCharacterAbilityUnlocked(board.belt))',
);
runtime = runtime.replace(
  'effect.resolver === "character.cannotEquipWeapons" && greenCharacterAbilityUnlocked(String(effect.resolver), board.belt)',
  'effect.resolver === "character.cannotEquipWeapons"',
);
runtime = runtime.replace(
  '  const choices: CharacterRuntimeChoice[] = [];\n  const notes: string[] = [];\n\n  for (const effect of effectsFor(self.fighterId)) {\n    if (!isAvailable(self, effect, event.type)) continue;\n    const resolver = String(effect.resolver ?? "");',
  '  const choices: CharacterRuntimeChoice[] = [];\n  const notes: string[] = [];\n  const processedResolvers = new Set<string>();\n\n  for (const effect of effectsFor(self.fighterId)) {\n    const resolver = String(effect.resolver ?? "");\n    if (processedResolvers.has(resolver) || !isAvailable(self, effect, event.type)) continue;\n    processedResolvers.add(resolver);',
);
runtime = runtime.replace('makeChoice(effect, "Lose 1 Speed until end of round to reduce this Attack by 1 Power?", ["accept", "skip"])', 'makeChoice(effect, "Lose 1 Speed until end of round to reduce this Attack by 1 Power?", ["accept", "skip"], true, "optionalAccepted")');
runtime = runtime.replace('makeChoice(effect, "Destroy the Junk instead of discarding it?", [event.selectedId, "skip"])', 'makeChoice(effect, "Destroy the Junk instead of discarding it?", ["accept", "skip"], true, "optionalAccepted")');
runtime = runtime.replace('makeChoice(effect, "Choose the additional zone for your next Defense.", ["High", "Mid", "Low"], false)', 'makeChoice(effect, "Choose the additional zone for your next Defense.", ["High", "Mid", "Low"], false, "selectedZone")');
runtime = runtime.replace('makeChoice(effect, "Choose your first-card bonus this round.", ["attack", "defense"], false)', 'makeChoice(effect, "Choose your first-card bonus this round.", ["attack", "defense"], false, "selectedMode")');
runtime = runtime.replace('makeChoice(effect, "Choose the Hit reward.", ["cycle", "focus"], false)', 'makeChoice(effect, "Choose the Hit reward.", ["cycle", "focus"], false, "selectedMode")');
runtime = runtime.replace('makeChoice(effect, "Ignore temporary Attack bonuses for this strike?", ["accept", "skip"])', 'makeChoice(effect, "Ignore temporary Attack bonuses for this strike?", ["accept", "skip"], true, "optionalAccepted")');
runtime = runtime.replace('makeChoice(effect, "Discard this reveal and replace it from the same deck?", ["accept", "skip"])', 'makeChoice(effect, "Discard this reveal and replace it from the same deck?", ["accept", "skip"], true, "optionalAccepted")');
runtime = runtime.replace('opponent = { ...opponent, nextAttackBonus: opponent.nextAttackBonus - amount };', 'opponent = { ...opponent, nextAttackBonus: opponent.nextAttackBonus + amount };');

const simpleCycles = [
  ['if ((event.blocked ?? true) && hasMark(self, "round:reducedIncomingAttack")) { self = cycle(self, 1, 1, event.selectedId); activated = true; }', 'if ((event.blocked ?? true) && hasMark(self, "round:reducedIncomingAttack")) { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedId); self = cycled.board; activated = cycled.resolved; }'],
  ['if (event.opponentModifiedCard) { self = mark(cycle(self, 1, 1, event.selectedId), "round:modifiedCardType", event.card?.cardType ?? ""); activated = true; }', 'if (event.opponentModifiedCard) { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedId); self = cycled.resolved ? mark(cycled.board, "round:modifiedCardType", event.card?.cardType ?? "") : cycled.board; activated = cycled.resolved; }'],
  ['if (event.destroyedJunk || hasMark(self, "round:destroyedJunk")) { self = cycle(self, 1, 1, event.selectedId); activated = true; }', 'if (event.destroyedJunk || hasMark(self, "round:destroyedJunk")) { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedId); self = cycled.board; activated = cycled.resolved; }'],
  ['if (event.changedZone || hasMark(self, "turn:changedAttack")) { self = cycle(self, 1, 1, event.selectedId); activated = true; }', 'if (event.changedZone || hasMark(self, "turn:changedAttack")) { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedId); self = cycled.board; activated = cycled.resolved; }'],
  ['case "character.speedChangeCycle": self = cycle(self, 1, 1, event.selectedId); activated = true; break;', 'case "character.speedChangeCycle": { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedId); self = cycled.board; activated = cycled.resolved; break; }'],
  ['if (mode === "attack" && event.type === "hit" || mode === "defense" && event.type === "block") { self = cycle(self, 1, 1, event.selectedId); activated = true; }', 'if (mode === "attack" && event.type === "hit" || mode === "defense" && event.type === "block") { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedId); self = cycled.board; activated = cycled.resolved; }'],
  ['case "character.linkedDefenseBlockCycle": if (hasMark(self, "round:clipEquip") && (event.blocked ?? true)) { self = cycle(self, 1, 1, event.selectedId); activated = true; } break;', 'case "character.linkedDefenseBlockCycle": if (hasMark(self, "round:clipEquip") && (event.blocked ?? true)) { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedId); self = cycled.board; activated = cycled.resolved; } break;'],
  ['case "character.green.secondKataCycle": if (event.secondKataThisTurn) { self = { ...cycle(self, 1, 1, event.selectedId), focus: self.focus + 1 }; activated = true; } break;', 'case "character.green.secondKataCycle": if (event.secondKataThisTurn) { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedId); self = cycled.resolved ? { ...cycled.board, focus: cycled.board.focus + 1 } : cycled.board; activated = cycled.resolved; } break;'],
  ['case "character.noCombatDamagePreviousTurnCycle": if (event.noCombatDamagePreviousTurn) { self = cycle(self, 1, 1, event.selectedId); activated = true; } break;', 'case "character.noCombatDamagePreviousTurnCycle": if (event.noCombatDamagePreviousTurn) { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedId); self = cycled.board; activated = cycled.resolved; } break;'],
  ['case "character.green.promotionCycle": self = cycle(self, 2, 1, event.selectedId); activated = true; break;', 'case "character.green.promotionCycle": { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedId, 2, 1); self = cycled.board; activated = cycled.resolved; break; }'],
  ['case "character.thirdDifferentCardTypeCycle": if (event.thirdDifferentCardTypeThisTurn) { self = cycle(self, 1, 1, event.selectedId); activated = true; } break;', 'case "character.thirdDifferentCardTypeCycle": if (event.thirdDifferentCardTypeThisTurn) { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedId); self = cycled.board; activated = cycled.resolved; } break;'],
  ['case "character.sceneChangeCycle": if (event.sceneChanged !== false) { self = cycle(self, 1, 1, event.selectedId); activated = true; } break;', 'case "character.sceneChangeCycle": if (event.sceneChanged !== false) { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedId); self = cycled.board; activated = cycled.resolved; } break;'],
];
for (const [before, after] of simpleCycles) runtime = runtime.replace(before, after);
runtime = runtime.replace(
  'else if (selected && selected !== "skip") { self = cycle(self, 1, 1, event.selectedMode); activated = true; }',
  'else if (selected && selected !== "skip") { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedMode, 1, 1, "selectedMode"); self = cycled.board; activated = cycled.resolved; }',
);
runtime = runtime.replace(
  'if (event.discardedJunk && event.selectedId && self.discard.includes(event.selectedId)) { const pile = [...self.discard]; pile.splice(pile.indexOf(event.selectedId), 1); self = mark(cycle({ ...self, discard: pile, deck: [event.selectedId, ...self.deck] }, 1, 1, event.selectedMode), "turn:recycledJunk"); activated = true; }',
  'if (event.discardedJunk && event.selectedId && self.discard.includes(event.selectedId)) { const pile = [...self.discard]; pile.splice(pile.indexOf(event.selectedId), 1); const recycled = mark({ ...self, discard: pile, deck: [event.selectedId, ...self.deck] }, "turn:recycledJunk"); const cycled = cycleWithPlayerChoice(recycled, effect, resolver, actor, choices, event.selectedMode, 1, 1, "selectedMode"); self = cycled.board; activated = cycled.resolved; }',
);
runtime = runtime.replace(
  'else { self = cycle(self, 1, 1, event.selectedId); activated = true; }',
  'else { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedId); self = cycled.board; activated = cycled.resolved; }',
);
runtime = runtime.replace(
  'case "character.green.linkedRebootCycle": if (Object.keys(markMap(self)).some((key) => key.startsWith("turn:rebootLocked:"))) { self = cycle(self, 1, 1, event.selectedMode); activated = true; } break;',
  'case "character.green.linkedRebootCycle": if (Object.keys(markMap(self)).some((key) => key.startsWith("turn:rebootLocked:"))) { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedMode, 1, 1, "selectedMode"); self = cycled.board; activated = cycled.resolved; } break;',
);
runtime = runtime.replace(
  '    if (activated) { self = consume(self, effect); notes.push(resolver); }',
  '    if (activated) { self = consume(self, effect); notes.push(resolver); }\n    if (choices.length && !activated) break;',
);
runtime = runtime.replace(
  'export function characterRuntimeCoverage() {',
  'export function characterHasResolver(fighterId: string, resolver: string) { return effectsFor(fighterId).some((effect) => effect.resolver === resolver); }\n\nexport function characterRuntimeCoverage() {',
);
fs.writeFileSync(runtimePath, runtime);

const playtestPath = "app/playtest.tsx";
let source = fs.readFileSync(playtestPath, "utf8");

source = replaceOnce(
  source,
  'import type { RuntimeChoice, RuntimeCommand, RuntimeStatus, RuntimeTrigger } from "./family-effect-runtime";\n',
  'import type { RuntimeChoice, RuntimeCommand, RuntimeStatus, RuntimeTrigger } from "./family-effect-runtime";\nimport { applyCharacterRuntimeEvent, characterAllowedAttackZones, characterCanEquip, characterHasResolver, characterPurchasePrice, resetCharacterRound, resetCharacterTurn, type CharacterRuntimeChoice, type CharacterRuntimeEvent } from "./character-runtime";\n',
  "Character runtime import",
);

source = replaceOnce(
  source,
  '  stage3cPurchaseCostModifier?: number;\n};',
  '  stage3cPurchaseCostModifier?: number;\n  usedCharacterEffectIdsThisTurn?: string[];\n  usedCharacterEffectIdsThisRound?: string[];\n  usedCharacterEffectIdsThisGame?: string[];\n  characterMarks?: Record<string, unknown>;\n  dealtCombatDamageThisTurn?: number;\n  dealtCombatDamagePreviousTurn?: boolean | null;\n};',
  "Board Character runtime state",
);

source = replaceOnce(
  source,
  '  | { kind: "fire-drill-zone"; sourceCardId: string; defenseId: string; originalZone: string; alternativeZones: string[] };',
  '  | { kind: "fire-drill-zone"; sourceCardId: string; defenseId: string; originalZone: string; alternativeZones: string[] }\n  | { kind: "character"; choice: CharacterRuntimeChoice; event: CharacterRuntimeEvent; context: "generic" | "incoming-strike" | "combo-reveal" | "ronin-market" | "ronin-location" | "reboot"; data?: Record<string, unknown>; resumeChoice?: PendingChoice | null };',
  "generic Character pending choice",
);

source = replaceOnce(
  source,
  '    damageDealt: 0, damageTaken: 0, cardsBought: 0, destroyed: [], returnedToSupply: [], stage3cStatuses: [], stage3cChoices: [], stage3cRestrictions: [], stage3cDefenseModifier: 0, stage3cPurchaseCostModifier: 0,\n',
  '    damageDealt: 0, damageTaken: 0, cardsBought: 0, destroyed: [], returnedToSupply: [], stage3cStatuses: [], stage3cChoices: [], stage3cRestrictions: [], stage3cDefenseModifier: 0, stage3cPurchaseCostModifier: 0,\n    usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [], usedCharacterEffectIdsThisGame: [], characterMarks: {}, dealtCombatDamageThisTurn: 0, dealtCombatDamagePreviousTurn: null,\n',
  "initial Character runtime state",
);

source = replaceOnce(
  source,
  'function cardCost(card: CardEntry | undefined) { return numberValue(card?.fpCost); }\nfunction cardFocus(card: CardEntry | undefined) { return numberValue(card?.focusValue); }',
  'function cardCost(card: CardEntry | undefined) { return numberValue(card?.fpCost); }\nfunction cardFocus(card: CardEntry | undefined) { return numberValue(card?.focusValue); }\nfunction hasPrintedNumericRulesEffect(card: CardEntry) { return /-?\\d/.test(card.rulesText ?? ""); }\nfunction runCharacterEvent(self: Board, opponent: Board, event: CharacterRuntimeEvent, actor: "player" | "ai") {\n  const result = applyCharacterRuntimeEvent(self, opponent, event, actor);\n  return { self: result.self as unknown as Board, opponent: result.opponent as unknown as Board, event: result.event, choice: result.choices[0] ?? null, notes: result.notes };\n}\nfunction characterPendingChoice(choice: CharacterRuntimeChoice, event: CharacterRuntimeEvent, context: Extract<PendingChoice, { kind: "character" }>["context"] = "generic", data: Record<string, unknown> = {}, resumeChoice: PendingChoice | null = null): PendingChoice {\n  return { kind: "character", choice, event, context, data, resumeChoice };\n}\nfunction applyCharacterSpeedTransition(before: Board, self: Board, opponent: Board, actor: "player" | "ai") {\n  if (before.tempSpeed === self.tempSpeed) return { self, opponent, choice: null as CharacterRuntimeChoice | null, event: null as CharacterRuntimeEvent | null, notes: [] as string[] };\n  const result = runCharacterEvent(self, opponent, { type: "speedChanged" }, actor);\n  return { ...result, event: result.event };\n}',
  "Character runtime bridge helpers",
);

source = replaceOnce(
  source,
  '  return Math.max(0, cardCost(card) + (board.stage3cPurchaseCostModifier ?? 0) + (card.cardType === "Item" ? (board.nextItemCostPenalty ?? 0) : 0) - certificationDiscount);',
  '  const normalPrice = Math.max(0, cardCost(card) + (board.stage3cPurchaseCostModifier ?? 0) + (card.cardType === "Item" ? (board.nextItemCostPenalty ?? 0) : 0) - certificationDiscount);\n  return characterPurchasePrice(board, normalPrice);',
  "Coupon Carl Market price",
);

source = replaceOnce(
  source,
  'function attackAllowedZones(board: Board, card: CardEntry) {\n',
  'function attackAllowedZones(board: Board, card: CardEntry) {\n  const printedZones = card.zone?.includes("Any") ? ["High", "Mid", "Low"] : [card.zone?.split(",")[0] ?? "High"];\n  const characterZones = characterAllowedAttackZones(board, card, printedZones);\n  if (characterZones.length > printedZones.length) return characterZones;\n',
  "Character attack zone hook",
);
source = source.replace('  if (cardFor(board.fighterId)?.name === "Whirlwind Wynn" && board.attacksThisTurn === 0 && hasTag(card, "Spin")) return ["High", "Mid", "Low"];\n', '');

source = replaceRegexOnce(
  source,
  /function fighterAttackModifier\(attacker: Board, defender: Board, card: CardEntry\): AttackModifier \{[\s\S]*?\n\}\n\nfunction reduceDamageForFighter/,
  `function fighterAttackModifier(_attacker: Board, _defender: Board, _card: CardEntry): AttackModifier {
  // Stage 3D routes Character combat mutation through applyCharacterRuntimeEvent.
  return { power: 0, damage: 0, notes: [] };
}

function reduceDamageForFighter`,
  "remove legacy fighter-name Attack behavior",
);
source = replaceRegexOnce(
  source,
  /  const fighter = cardFor\(next\.fighterId\);\n  if \(fighter && !next\.damageReductionUsed && remaining > 0\) \{[\s\S]*?\n  \}\n  return \{ board: next, damage: remaining, note: notes\.length \? notes\.join\("; "\) : null \};/,
  '  return { board: next, damage: remaining, note: notes.length ? notes.join("; ") : null };',
  "remove legacy fighter-name damage prevention",
);

source = replaceOnce(
  source,
  '    if (cardFor(current.player.fighterId)?.name === "Knuckleton the Brawler" && isWeapon(card)) return write(current, "Knuckleton refuses the Weapon. The waiver cites \'personal reasons.\'");',
  '    if (!characterCanEquip(current.player, card)) return write(current, `${cardFor(current.player.fighterId)?.name ?? "This fighter"} cannot Equip ${card.name}.`);',
  "structured Equipment restriction",
);
source = source.replace(
  'const canInitiate = match.phase === "player-initiate" && permanent && !(playerFighter.name === "Knuckleton the Brawler" && isWeapon(card));',
  'const canInitiate = match.phase === "player-initiate" && permanent && characterCanEquip(player, card);',
);
source = source.replace(
  '(pendingAttack.zone?.includes("Any") || (playerFighter.name === "Whirlwind Wynn" && player.attacksThisTurn === 0 && hasTag(pendingAttack, "Spin")))',
  '(attackAllowedZones(player, pendingAttack).length > 1)',
);

source = replaceOnce(
  source,
  '    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id] }, card, "player");',
  '    const beforeEquip = current.player;\n    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id] }, card, "player");\n    const characterEquip = runCharacterEvent(nextPlayer, current.ai, { type: "equip", card }, "player");\n    nextPlayer = characterEquip.self;\n    const speedTransition = applyCharacterSpeedTransition(beforeEquip, nextPlayer, characterEquip.opponent, "player");\n    nextPlayer = speedTransition.self;',
  "Character Equipment event",
);

source = replaceOnce(
  source,
  '  const readyBoard = stage3cEndTurn(applyHideReady(hideBoard));',
  '  const characterHide = runCharacterEvent(hideBoard, hideBoard, { type: "hide" }, "ai");\n  const readyBoard = stage3cEndTurn(applyHideReady(resetCharacterTurn(characterHide.self) as unknown as Board));',
  "Character Hide event",
);
source = replaceOnce(
  source,
  'return drawCards({ ...readyBoard, hand: [], playArea: [], equipment, exhaustedEquipment, equipmentAttackPlan: null, discard, focus: 0, focusGeneratedThisTurn: 0, focusSpentThisTurn: 0, attacksThisTurn: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0, borrowedEquipmentId: null, wasHitSinceLastTurn: false, playedDefenseSinceLastTurn: false, blockedSinceLastTurn: false, usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, comboAttemptedTurn: false, boughtCardLastAscend: Boolean(readyBoard.boughtCardThisAscend), boughtCardThisAscend: false, targetEquipmentDefPenalties: {}, attackLockedThisTurn: false, completesActiveBeltExamThisAttack: false, currentAttackIsReversal: false },',
  'return drawCards({ ...readyBoard, hand: [], playArea: [], equipment, exhaustedEquipment, equipmentAttackPlan: null, discard, focus: 0, focusGeneratedThisTurn: 0, focusSpentThisTurn: 0, attacksThisTurn: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0, borrowedEquipmentId: null, wasHitSinceLastTurn: false, playedDefenseSinceLastTurn: false, blockedSinceLastTurn: false, usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, comboAttemptedTurn: false, boughtCardLastAscend: Boolean(readyBoard.boughtCardThisAscend), boughtCardThisAscend: false, targetEquipmentDefPenalties: {}, attackLockedThisTurn: false, completesActiveBeltExamThisAttack: false, currentAttackIsReversal: false, dealtCombatDamagePreviousTurn: (readyBoard.dealtCombatDamageThisTurn ?? 0) > 0, dealtCombatDamageThisTurn: 0 },',
  "track previous-turn combat damage",
);

source = replaceOnce(
  source,
  'function applyInitiateCarryover(board: Board) {\n',
  'function applyCharacterInitiate(board: Board, opponent: Board, actor: "player" | "ai") {\n  const consumables = board.hand.filter((id) => cardFor(id)?.subtype === "Consumable");\n  const discardedEquipment = board.discard.filter((id) => { const card = cardFor(id); return Boolean(card && isPermanent(card)); });\n  const candidates = characterHasResolver(board.fighterId, "character.revealConsumableCycle") ? consumables : characterHasResolver(board.fighterId, "character.equipDiscardPermanentUntilHide") ? discardedEquipment : [];\n  return runCharacterEvent(board, opponent, { type: "initiate", candidateIds: candidates, hasWeaponEquipped: board.equipment.some((id) => { const card = cardFor(id); return Boolean(card && isWeapon(card)); }), noCombatDamagePreviousTurn: board.dealtCombatDamagePreviousTurn === false }, actor);\n}\n\nfunction applyInitiateCarryover(board: Board) {\n',
  "Character Initiate helper",
);

source = replaceOnce(
  source,
  'function equipmentActivationAvailable(board: Board, card: CardEntry, phase: Match["phase"]) {\n  if (isEquipmentExhausted(board, card.id)) return false;',
  'function equipmentActivationAvailable(board: Board, card: CardEntry, phase: Match["phase"]) {\n  if (isEquipmentExhausted(board, card.id) || Boolean(board.characterMarks?.[`turn:rebootLocked:${card.id}`])) return false;',
  "Rebooter Equipment lock",
);

source = replaceOnce(
  source,
  '  const begin = (fighterId = selectedId) => {',
  '  const begin = (fighterId = selectedId) => {',
  "begin anchor",
);
source = replaceOnce(
  source,
  '    setDeskView(null);\n    setMatch({ schema: 8, rulesVersion: activeRulesRevision, player, ai, market: openingMarket.market, marketDeck: openingMarket.marketDeck, marketDiscard: [], marketPurchasedThisRound: false, comboDeck: comboDeck.slice(1), comboOfferId: comboDeck[0] ?? null, locations: locations.slice(1), locationId: currentLocation, round: 1, phase: playerFirst ? "player-initiate" : "ai-ready", turnOrder, turnIndex: 0, selectedAttackId: null, selectedZone: "High", pendingStrike: null, pendingDiscard: null, pendingChoice: null, pendingCombatContinuation: null, reversalRemainingAiAttacks: [], reversalReason: null, reversalIncomingZone: null, attackCostDecisionCardId: null, nonHonorSceneChangedThisRound: false, exchangeSequence: 0, lastExchange: null, winner: null, log: [`${challenge.label} field test opened under rules ${activeRulesRevision}. The waiver is legally adjacent to complete.`, `Honor 1: ${cardFor(currentLocation)?.name ?? "Tournament Mat"} is active. Both fighters gain 1 XP and refresh Tempo.`, `${playerFirst ? "You" : "Computer"} win initiative on current Speed.`] });',
  '    setDeskView(null);\n    let opened: Match = { schema: 8, rulesVersion: activeRulesRevision, player, ai, market: openingMarket.market, marketDeck: openingMarket.marketDeck, marketDiscard: [], marketPurchasedThisRound: false, comboDeck: comboDeck.slice(1), comboOfferId: comboDeck[0] ?? null, locations: locations.slice(1), locationId: currentLocation, round: 1, phase: playerFirst ? "player-initiate" : "ai-ready", turnOrder, turnIndex: 0, selectedAttackId: null, selectedZone: "High", pendingStrike: null, pendingDiscard: null, pendingChoice: null, pendingCombatContinuation: null, reversalRemainingAiAttacks: [], reversalReason: null, reversalIncomingZone: null, attackCostDecisionCardId: null, nonHonorSceneChangedThisRound: false, exchangeSequence: 0, lastExchange: null, winner: null, log: [`${challenge.label} field test opened under rules ${activeRulesRevision}. The waiver is legally adjacent to complete.`, `Honor 1: ${cardFor(currentLocation)?.name ?? "Tournament Mat"} is active. Both fighters gain 1 XP and refresh Tempo.`, `${playerFirst ? "You" : "Computer"} win initiative on current Speed.`] };\n    if (playerFirst) { const initiated = applyCharacterInitiate(opened.player, opened.ai, "player"); opened = { ...opened, player: initiated.self, ai: initiated.opponent, pendingChoice: initiated.choice ? characterPendingChoice(initiated.choice, initiated.event) : null }; }\n    setMatch(opened);',
  "initial Character Initiate",
);

source = replaceOnce(
  source,
  '  const beginYell = () => setMatch((current) => current?.phase === "player-initiate" ? write(current, "Initiate complete. Yell begins; subtlety has left the building.", { phase: "player-yell", player: { ...current.player, usedEffectIdsThisTurn: [] } }) : current);',
  '  const beginYell = () => setMatch((current) => current?.phase === "player-initiate" && !current.pendingChoice ? write(current, "Initiate complete. Yell begins; subtlety has left the building.", { phase: "player-yell", player: { ...current.player, usedEffectIdsThisTurn: [] } }) : current);',
  "block Yell while Character choice pending",
);

source = replaceOnce(
  source,
  '  const declareAttack = () => setMatch((current) => {\n',
  '  const declareAttack = () => setMatch((current) => {\n',
  "declare Attack anchor",
);
source = replaceOnce(
  source,
  '    const fighterModifier = fighterAttackModifier(current.player, current.ai, card);\n    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card, zone);',
  '    const fighterModifier = fighterAttackModifier(current.player, current.ai, card);\n    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card, zone);',
  "Attack modifier anchor",
);
source = replaceOnce(
  source,
  '    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);\n    const defenseScenarioPower',
  '    const preCharacterAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);\n    const previousZone = current.player.zonesPlayed.at(-1) ?? null;\n    const playerDeclaration = runCharacterEvent(current.player, aiIncomingReaction.board, { type: "attackDeclared", card, zone, printedZone: card.zone?.split(",")[0] ?? zone, selectedZone: zone, previousAttackZone: previousZone, firstAttackThisTurn: current.player.attacksThisTurn === 0, usedConsumableThisTurn: Boolean(current.player.usedConsumableThisRound), playedKataEarlierThisTurn: current.player.cardsThisTurn.some((id) => { const prior = cardFor(id); return Boolean(prior && isKata(prior)); }), differentZoneFromPreviousAttack: Boolean(previousZone && previousZone !== zone), hasWeaponEquipped: current.player.equipment.some((id) => { const item = cardFor(id); return Boolean(item && isWeapon(item)); }), attackPower: preCharacterAttackPower }, "player");\n    if (playerDeclaration.choice) return write(current, playerDeclaration.choice.prompt, { player: playerDeclaration.self, ai: playerDeclaration.opponent, pendingChoice: characterPendingChoice(playerDeclaration.choice, playerDeclaration.event) });\n    const incomingModifierBonus = Math.max(0, Number(playerDeclaration.event.attackPower ?? preCharacterAttackPower) - cardPower(card) - fighterStat(playerDeclaration.self, "ATK"));\n    const aiIncomingCharacter = runCharacterEvent(playerDeclaration.opponent, playerDeclaration.self, { type: "incomingAttackDeclared", card, zone, attackPower: Number(playerDeclaration.event.attackPower ?? preCharacterAttackPower), modifierBonus: incomingModifierBonus }, "ai");\n    let declaredPlayer = aiIncomingCharacter.opponent;\n    let declaredAi = aiIncomingCharacter.self;\n    const baseAttackPower = Math.max(0, Number(aiIncomingCharacter.event.attackPower ?? playerDeclaration.event.attackPower ?? preCharacterAttackPower));\n    const defenseScenarioPower',
  "Character Attack declaration and incoming reaction",
);
source = source.replace('bestDefense(aiIncomingReaction.board, zone,', 'bestDefense(declaredAi, zone,');
source = source.replace('const aiDefenseReaction = defenseCard ? autoActivateAiDefenseGuardEquipment(aiIncomingReaction.board) : { board: aiIncomingReaction.board, guard: 0, notes: [] as string[] };', 'const aiDefenseReaction = defenseCard ? autoActivateAiDefenseGuardEquipment(declaredAi) : { board: declaredAi, guard: 0, notes: [] as string[] };');
source = source.replace('const attackState = { ...stage3cConsumeAttackStatuses(current.player, card, zone),', 'const attackState = { ...stage3cConsumeAttackStatuses(declaredPlayer, card, zone),');
source = source.replace('damageDealt: current.player.damageDealt + damage,', 'damageDealt: declaredPlayer.damageDealt + damage, dealtCombatDamageThisTurn: (declaredPlayer.dealtCombatDamageThisTurn ?? 0) + damage,');

source = replaceOnce(
  source,
  '    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage + comboModifier.damage) : 0;\n    const reduced = reduceDamageForFighter(aiDefenseReaction.board, rawDamage);',
  '    let rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage + comboModifier.damage) : 0;\n    let hitCharacterChoice: PendingChoice | null = null;\n    if (hit) { const hitEvent = runCharacterEvent(declaredPlayer, aiDefenseReaction.board, { type: "hit", card, zone, damage: rawDamage, firstAttackThisTurn: current.player.attacksThisTurn === 0, changedZone: Boolean(playerDeclaration.event.changedZone) }, "player"); declaredPlayer = hitEvent.self; rawDamage = Math.max(0, Number(hitEvent.event.damage ?? rawDamage)); hitCharacterChoice = hitEvent.choice ? characterPendingChoice(hitEvent.choice, hitEvent.event) : null; }\n    const reducedBase = reduceDamageForFighter(aiDefenseReaction.board, rawDamage);\n    const incomingDamage = hit ? runCharacterEvent(reducedBase.board, declaredPlayer, { type: "damageIncoming", card, zone, damage: reducedBase.damage }, "ai") : null;\n    const reduced = incomingDamage ? { board: incomingDamage.self, damage: Math.max(0, Number(incomingDamage.event.damage ?? reducedBase.damage)), note: [...(reducedBase.note ? [reducedBase.note] : []), ...incomingDamage.notes].join("; ") || null } : reducedBase;',
  "player Hit and target Character damage event",
);
source = source.replace('let nextPlayer = applyCardEffects({ ...attackState,', 'let nextPlayer = applyCardEffects({ ...attackState,');
source = source.replace('    const pendingChoice: PendingChoice | null = suppressionTargets.length', '    const pendingChoice: PendingChoice | null = hitCharacterChoice ?? (suppressionTargets.length');
source = source.replace('      : optionalCycle && nextPlayer.hand.length ? { kind: "discard-draw", sourceCardId: card.id, remaining: optionalCycle.discard, draw: optionalCycle.draw } : null;', '      : optionalCycle && nextPlayer.hand.length ? { kind: "discard-draw", sourceCardId: card.id, remaining: optionalCycle.discard, draw: optionalCycle.draw } : null);');

source = replaceOnce(
  source,
  '    if (!hit) nextAi = { ...nextAi, blockedSinceLastTurn: true, blockedThisRound: true };\n    nextPlayer = applyCardEffects(nextPlayer, card, "player", hit ? "onHit" : "afterResolve");',
  '    if (!hit) { nextAi = { ...nextAi, blockedSinceLastTurn: true, blockedThisRound: true }; const blockEvent = runCharacterEvent(nextAi, nextPlayer, { type: "block", card: defenseCard, zone, blocked: true }, "ai"); nextAi = blockEvent.self; nextPlayer = blockEvent.opponent; }\n    const cardPlayed = runCharacterEvent(nextPlayer, nextAi, { type: "cardPlayed", card, zone, noPrintedNumericEffect: !hasPrintedNumericRulesEffect(card), thirdDifferentCardTypeThisTurn: new Set([...nextPlayer.cardsThisTurn.map((id) => cardFor(id)?.cardType), card.cardType].filter(Boolean)).size >= 3, completedBeltExam: Boolean(nextPlayer.completedBeltExamThisRound) }, "player");\n    nextPlayer = cardPlayed.self; nextAi = cardPlayed.opponent;\n    nextPlayer = applyCardEffects(nextPlayer, card, "player", hit ? "onHit" : "afterResolve");',
  "player Attack cardPlayed and AI Block Character event",
);

source = replaceOnce(
  source,
  '  const playSupport = (id: string) => setMatch((current) => {',
  '  const playSupport = (id: string) => setMatch((current) => {',
  "support anchor",
);
source = replaceOnce(
  source,
  '    let nextAi = current.ai;\n',
  '    let nextAi = current.ai;\n',
  "first support AI anchor",
);
source = replaceOnce(
  source,
  '    const choiceNote = pendingChoice?.kind === "destroy-junk" ? `Choose ${junkCount} Junk card${junkCount === 1 ? "" : "s"} from your hand or discard pile to destroy.`',
  '    const cardPlayedEvent = runCharacterEvent(nextPlayer, nextAi, { type: "cardPlayed", card, zone: card.zone?.split(",")[0] ?? undefined, noPrintedNumericEffect: !hasPrintedNumericRulesEffect(card), thirdDifferentCardTypeThisTurn: new Set(nextPlayer.cardsThisTurn.map((playedId) => cardFor(playedId)?.cardType).filter(Boolean)).size >= 3, completedBeltExam: Boolean(nextPlayer.completedBeltExamThisRound) }, "player");\n    nextPlayer = cardPlayedEvent.self; nextAi = cardPlayedEvent.opponent;\n    let characterChoice = cardPlayedEvent.choice ? characterPendingChoice(cardPlayedEvent.choice, cardPlayedEvent.event, "generic", {}, pendingChoice) : null;\n    if (isKata(card)) { const kataCount = nextPlayer.cardsThisTurn.map(cardFor).filter((played): played is CardEntry => Boolean(played && isKata(played))).length; const kataEvent = runCharacterEvent(nextPlayer, nextAi, { type: "kataPlayed", card, firstKataThisTurn: kataCount === 1, secondKataThisTurn: kataCount === 2 }, "player"); nextPlayer = kataEvent.self; nextAi = kataEvent.opponent; if (kataEvent.choice) characterChoice = characterPendingChoice(kataEvent.choice, kataEvent.event, "generic", {}, characterChoice ?? pendingChoice); }\n    const speedEvent = applyCharacterSpeedTransition(current.player, nextPlayer, nextAi, "player"); nextPlayer = speedEvent.self; nextAi = speedEvent.opponent; if (speedEvent.choice && speedEvent.event) characterChoice = characterPendingChoice(speedEvent.choice, speedEvent.event, "generic", {}, characterChoice ?? pendingChoice);\n    const choiceNote = characterChoice ? characterChoice.choice.prompt : pendingChoice?.kind === "destroy-junk" ? `Choose ${junkCount} Junk card${junkCount === 1 ? "" : "s"} from your hand or discard pile to destroy.`',
  "support Character card/Kata/Speed events",
);
source = source.replace('{ player: nextPlayer, ai: nextAi, pendingDiscard, pendingChoice });\n  });\n\n  const choosePendingDiscard', '{ player: nextPlayer, ai: nextAi, pendingDiscard, pendingChoice: characterChoice ?? pendingChoice });\n  });\n\n  const choosePendingDiscard');

source = replaceOnce(
  source,
  '    const player = {\n      ...current.player,\n      hand: removeOne(current.player.hand, id),\n      discard: [...current.player.discard, id],\n      focus: current.player.focus + (gainsFocus ? 1 : 0),\n    };\n    return write(current,',
  '    let player = {\n      ...current.player,\n      hand: removeOne(current.player.hand, id),\n      discard: [...current.player.discard, id],\n      focus: current.player.focus + (gainsFocus ? 1 : 0),\n    };\n    const discardEvent = runCharacterEvent(player, current.ai, { type: "discarded", card: discarded, selectedId: id, discardedOutsideHide: true, discardedJunk: isJunk(discarded) }, "player");\n    player = discardEvent.self;\n    const characterChoice = discardEvent.choice ? characterPendingChoice(discardEvent.choice, discardEvent.event, "generic", {}, remaining > 0 && player.hand.length ? { kind: "discard-hand", sourceCardId: current.pendingDiscard.sourceCardId, remaining, sourceFollowup: current.pendingDiscard.sourceFollowup } : null) : null;\n    return write(current,',
  "pending discard Character event",
);
source = source.replace('{ player, pendingDiscard: remaining > 0 && player.hand.length ? { ...current.pendingDiscard, remaining } : null });', '{ player, ai: discardEvent.opponent, pendingDiscard: characterChoice ? null : remaining > 0 && player.hand.length ? { ...current.pendingDiscard, remaining } : null, pendingChoice: characterChoice ?? current.pendingChoice });');

source = replaceOnce(
  source,
  '  const resolvePendingChoice = (cardId: string, source: "hand" | "discard" | "deck" | "equipment" = "hand") => setMatch((current) => {',
  '  const resolveCharacterChoice = (option: string) => setMatch((current) => {\n    const pending = current?.pendingChoice;\n    if (!current || !pending || pending.kind !== "character") return current;\n    const event: CharacterRuntimeEvent = { ...pending.event };\n    if (pending.choice.selectionField === "optionalAccepted") event.optionalAccepted = option === "accept";\n    else if (pending.choice.selectionField === "selectedZone") event.selectedZone = option;\n    else if (pending.choice.selectionField === "selectedMode") event.selectedMode = option;\n    else event.selectedId = option;\n    const result = runCharacterEvent(current.player, current.ai, event, "player");\n    let player = result.self; let ai = result.opponent; let pendingStrike = current.pendingStrike; let comboOfferId = current.comboOfferId; let comboDeck = current.comboDeck; let market = current.market; let marketDeck = current.marketDeck; let marketDiscard = current.marketDiscard; let locationId = current.locationId; let locations = current.locations;\n    if (pending.context === "incoming-strike" && pendingStrike) pendingStrike = { ...pendingStrike, attackPower: Math.max(0, Number(result.event.attackPower ?? pendingStrike.attackPower)) };\n    if (pending.context === "combo-reveal" && result.event.selectedId && Array.isArray(pending.data?.revealed)) { const revealed = pending.data.revealed as string[]; comboOfferId = result.event.selectedId; comboDeck = [...comboDeck, ...revealed.filter((id) => id !== comboOfferId)]; }\n    if (pending.context === "ronin-market" && result.event.selectedId && result.event.selectedId === pending.data?.replacementId) { const slot = Number(pending.data?.slot ?? -1); const originalId = String(pending.data?.originalId ?? ""); const replacementId = String(pending.data?.replacementId ?? ""); if (slot >= 0 && replacementId) { market = [...market]; market[slot] = replacementId; marketDeck = removeOne(marketDeck, replacementId); if (originalId) marketDiscard = [...marketDiscard, originalId]; } }\n    if (pending.context === "ronin-location" && result.event.selectedId && result.event.selectedId === pending.data?.replacementId) { const originalId = String(pending.data?.originalId ?? ""); const replacementId = String(pending.data?.replacementId ?? ""); if (replacementId) { locationId = replacementId; locations = locations.filter((id) => id !== replacementId && id !== originalId); } }\n    const nextChoice = result.choice ? characterPendingChoice(result.choice, result.event, pending.context, pending.data ?? {}, pending.resumeChoice ?? null) : pending.resumeChoice ?? null;\n    return write(current, `${cardFor(player.fighterId)?.name ?? "Character"}: ${result.notes.length ? result.notes.join(", ") : option === "skip" ? "optional ability declined" : "ability choice resolved"}.`, { player, ai, pendingStrike, comboOfferId, comboDeck, market, marketDeck, marketDiscard, locationId, locations, pendingChoice: nextChoice });\n  });\n\n  const resolvePendingChoice = (cardId: string, source: "hand" | "discard" | "deck" | "equipment" = "hand") => setMatch((current) => {',
  "Character choice resolver",
);

source = replaceOnce(
  source,
  '      const player = {\n        ...current.player,\n        hand: removeOne(current.player.hand, cardId),\n        discard: [...current.player.discard, cardId],',
  '      let player = {\n        ...current.player,\n        hand: removeOne(current.player.hand, cardId),\n        discard: [...current.player.discard, cardId],',
  "discard-hand mutable player",
);
source = replaceOnce(
  source,
  '      const remaining = choice.remaining - 1;\n      const pendingChoice = remaining > 0 && player.hand.length ? { ...choice, remaining } : null;\n      const resolved = write(current,',
  '      const remaining = choice.remaining - 1;\n      const discardEvent = runCharacterEvent(player, current.ai, { type: "discarded", card: selected, selectedId: cardId, discardedOutsideHide: true, discardedJunk: isJunk(selected) }, "player");\n      player = discardEvent.self;\n      const ordinaryNextChoice = remaining > 0 && player.hand.length ? { ...choice, remaining } : null;\n      const pendingChoice = discardEvent.choice ? characterPendingChoice(discardEvent.choice, discardEvent.event, "generic", {}, ordinaryNextChoice) : ordinaryNextChoice;\n      const resolved = write(current,',
  "discard-hand Character event",
);
source = source.replace('{ player, pendingChoice });\n      if (!pendingChoice && choice.afterChoice === "resume-defense")', '{ player, ai: discardEvent.opponent, pendingChoice });\n      if (!pendingChoice && choice.afterChoice === "resume-defense")');

source = replaceOnce(
  source,
  '      let player = { ...current.player, hand: removeOne(current.player.hand, cardId), discard: [...current.player.discard, cardId] };\n      const remaining = choice.remaining - 1;',
  '      let player = { ...current.player, hand: removeOne(current.player.hand, cardId), discard: [...current.player.discard, cardId] };\n      const discardEvent = runCharacterEvent(player, current.ai, { type: "discarded", card: selected, selectedId: cardId, discardedOutsideHide: true, discardedJunk: isJunk(selected) }, "player");\n      player = discardEvent.self;\n      const remaining = choice.remaining - 1;',
  "discard-draw Character event",
);
source = source.replace('return write(current, `${selected.name} discarded. Choose ${remaining} more card${remaining === 1 ? "" : "s"}.`, { player, pendingChoice: { ...choice, remaining } });', 'return write(current, `${selected.name} discarded. Choose ${remaining} more card${remaining === 1 ? "" : "s"}.`, { player, ai: discardEvent.opponent, pendingChoice: discardEvent.choice ? characterPendingChoice(discardEvent.choice, discardEvent.event, "generic", {}, { ...choice, remaining }) : { ...choice, remaining } });');
source = source.replace('return write(current, `${selected.name} discarded; ${choice.draw} card${choice.draw === 1 ? "" : "s"} drawn by ${cardFor(choice.sourceCardId)?.name ?? "the printed effect"}.`, { player, pendingChoice: null });', 'return write(current, `${selected.name} discarded; ${choice.draw} card${choice.draw === 1 ? "" : "s"} drawn by ${cardFor(choice.sourceCardId)?.name ?? "the printed effect"}.`, { player, ai: discardEvent.opponent, pendingChoice: discardEvent.choice ? characterPendingChoice(discardEvent.choice, discardEvent.event) : null });');

source = replaceOnce(
  source,
  '    const nextPlayer = gainFocus({ ...current.player, hand: removeOne(current.player.hand, id), discard: [...current.player.discard, id], badHabitFocusUsed: true, lastAttackHit: false }, gain);\n    return write(current,',
  '    let nextPlayer = gainFocus({ ...current.player, hand: removeOne(current.player.hand, id), discard: [...current.player.discard, id], badHabitFocusUsed: true, lastAttackHit: false }, gain);\n    const discardEvent = runCharacterEvent(nextPlayer, current.ai, { type: "discarded", card, selectedId: id, discardedOutsideHide: true, discardedJunk: isJunk(card) }, "player"); nextPlayer = discardEvent.self;\n    return write(current,',
  "Bad Habit Character discard",
);
source = source.replace('{ player: nextPlayer });\n  });\n\n  const practiceDefense', '{ player: nextPlayer, ai: discardEvent.opponent, pendingChoice: discardEvent.choice ? characterPendingChoice(discardEvent.choice, discardEvent.event) : null });\n  });\n\n  const practiceDefense');

source = replaceOnce(
  source,
  '  const enterAscend = () => {\n    setDeskView("market");\n    setMatch((current) => current?.phase === "player-yell" && !current.pendingDiscard && !current.pendingChoice ? write(current, "Ascend: the acquisition desk opens. Spend this turn\'s Focus before it leaves your mat.", { phase: "player-ascend", selectedAttackId: null, player: { ...current.player, boughtCardThisAscend: false } }) : current);\n  };',
  '  const enterAscend = () => {\n    setDeskView("market");\n    setMatch((current) => {\n      if (!current || current.phase !== "player-yell" || current.pendingDiscard || current.pendingChoice) return current;\n      let ascended = write(current, "Ascend: the acquisition desk opens. Spend this turn\'s Focus before it leaves your mat.", { phase: "player-ascend", selectedAttackId: null, player: { ...current.player, boughtCardThisAscend: false } });\n      if (ascended.comboOfferId && ascended.comboDeck[0] && characterHasResolver(ascended.player.fighterId, "character.comboRevealChoice")) { const extra = ascended.comboDeck[0]; const comboEvent = runCharacterEvent(ascended.player, ascended.ai, { type: "comboReveal", revealIds: [ascended.comboOfferId, extra] }, "player"); ascended = { ...ascended, player: comboEvent.self, ai: comboEvent.opponent, comboDeck: ascended.comboDeck.slice(1), pendingChoice: comboEvent.choice ? characterPendingChoice(comboEvent.choice, comboEvent.event, "combo-reveal", { revealed: [ascended.comboOfferId, extra] }) : null }; }\n      return ascended;\n    });\n  };',
  "Librarian Lin Combo reveal",
);

source = replaceOnce(
  source,
  '    const refilled = refillPurchasedMarketSlot(current.market, current.marketDeck, current.marketDiscard, slot);\n    return write(current,',
  '    const refilled = refillPurchasedMarketSlot(current.market, current.marketDeck, current.marketDiscard, slot);\n    let pendingChoice: PendingChoice | null = null;\n    const revealedId = refilled.market[slot]; const replacementId = refilled.marketDeck[0] ?? null;\n    if (revealedId && replacementId && characterHasResolver(nextPlayer.fighterId, "character.revealReplacementOnceGame")) { const reroll = runCharacterEvent(nextPlayer, current.ai, { type: "purchaseAttempt", replacementId }, "player"); nextPlayer = reroll.self; if (reroll.choice) pendingChoice = characterPendingChoice(reroll.choice, reroll.event, "ronin-market", { slot, originalId: revealedId, replacementId }); }\n    return write(current,',
  "Ronin Market reveal",
);
source = source.replace('{ player: nextPlayer, ...refilled, marketPurchasedThisRound: true });', '{ player: nextPlayer, ...refilled, marketPurchasedThisRound: true, pendingChoice });');

source = replaceOnce(
  source,
  '    const nextPlayer = applyBeltPromotion(current.player, current.player.belt + 1);\n',
  '    let nextPlayer = applyBeltPromotion(current.player, current.player.belt + 1);\n    const promotionEvent = runCharacterEvent(nextPlayer, current.ai, { type: "promotion" }, "player"); nextPlayer = promotionEvent.self;\n',
  "Character promotion event",
);
source = source.replace('{ player: nextPlayer });\n  });\n\n  const completeTurn', '{ player: nextPlayer, ai: promotionEvent.opponent, pendingChoice: promotionEvent.choice ? characterPendingChoice(promotionEvent.choice, promotionEvent.event) : null });\n  });\n\n  const completeTurn');

source = replaceOnce(
  source,
  '    let nextPlayer = { ...current.player };\n',
  '    let nextPlayer = { ...current.player };\n',
  "defense mutable player anchor",
);
source = replaceOnce(
  source,
  '    const reduced = reduceDamageForFighter(nextPlayer, Math.max(0, rawDamage - defensePrevention));\n    const damageBeforeOptional = reduced.damage;',
  '    const reducedBase = reduceDamageForFighter(nextPlayer, Math.max(0, rawDamage - defensePrevention));\n    const damageCharacter = hit ? runCharacterEvent(reducedBase.board, current.ai, { type: "damageIncoming", card: aiCard, zone: pending.zone, damage: reducedBase.damage }, "player") : null;\n    const reduced = damageCharacter ? { board: damageCharacter.self, damage: Math.max(0, Number(damageCharacter.event.damage ?? reducedBase.damage)), note: [...(reducedBase.note ? [reducedBase.note] : []), ...damageCharacter.notes].join("; ") || null } : reducedBase;\n    const damageBeforeOptional = reduced.damage;',
  "player Character damage event",
);
source = source.replace('let nextAi = markCompletedTask({ ...current.ai, damageDealt: current.ai.damageDealt + damage,', 'let nextAi = markCompletedTask({ ...current.ai, damageDealt: current.ai.damageDealt + damage, dealtCombatDamageThisTurn: (current.ai.dealtCombatDamageThisTurn ?? 0) + damage,');
source = replaceOnce(
  source,
  '    if (!hit && pending.blockedFocus) nextAi.focus += pending.blockedFocus;\n',
  '    if (hit) { const hitEvent = runCharacterEvent(nextAi, nextPlayer, { type: "hit", card: aiCard, zone: pending.zone, damage, firstAttackThisTurn: current.ai.attacksThisTurn === 1 }, "ai"); nextAi = hitEvent.self; nextPlayer = hitEvent.opponent; }\n    if (!hit) { const blockEvent = runCharacterEvent(nextPlayer, nextAi, { type: "block", card: defenseCard, zone: pending.zone, blocked: true }, "player"); nextPlayer = blockEvent.self; nextAi = blockEvent.opponent; if (blockEvent.choice) { return write(current, blockEvent.choice.prompt, { player: nextPlayer, ai: nextAi, pendingStrike: null, pendingChoice: characterPendingChoice(blockEvent.choice, blockEvent.event, "generic", {}, null), pendingCombatContinuation: { remainingAiAttacks: pending.remainingAiAttacks, reversalEligible: !nextPlayer.reversalUsedRound }, winner: null }); } }\n    if (!hit && pending.blockedFocus) nextAi.focus += pending.blockedFocus;\n',
  "AI Hit / player Block Character event",
);

source = replaceOnce(
  source,
  '  const resolveReversal = () => setMatch((current) => {',
  '  const resolveReversal = () => setMatch((current) => {',
  "reversal anchor",
);
source = source.replace('damageDealt: current.player.damageDealt + damage }, card, "player");', 'damageDealt: current.player.damageDealt + damage, dealtCombatDamageThisTurn: (current.player.dealtCombatDamageThisTurn ?? 0) + damage }, card, "player");');

source = replaceOnce(
  source,
  '  const pendingChoiceOptions = match.pendingChoice?.kind === "destroy-junk"\n',
  '  const pendingChoiceOptions = match.pendingChoice?.kind === "character"\n    ? match.pendingChoice.choice.options.map((id, index) => ({ id, source: "hand" as const, index }))\n    : match.pendingChoice?.kind === "destroy-junk"\n',
  "Character UI options",
);
source = replaceOnce(
  source,
  '  const effectChoiceTitle = match.pendingChoice?.kind === "destroy-junk" ? "Choose Junk to destroy"',
  '  const effectChoiceTitle = match.pendingChoice?.kind === "character" ? `${cardFor(player.fighterId)?.name ?? "Character"} ability`\n    : match.pendingChoice?.kind === "destroy-junk" ? "Choose Junk to destroy"',
  "Character choice title",
);
source = replaceOnce(
  source,
  '  const effectChoicePrompt = match.pendingChoice?.kind === "destroy-junk" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} requires ${match.pendingChoice.remaining} more Junk card${match.pendingChoice.remaining === 1 ? "" : "s"} from your hand or discard pile.`',
  '  const effectChoicePrompt = match.pendingChoice?.kind === "character" ? match.pendingChoice.choice.prompt\n    : match.pendingChoice?.kind === "destroy-junk" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} requires ${match.pendingChoice.remaining} more Junk card${match.pendingChoice.remaining === 1 ? "" : "s"} from your hand or discard pile.`',
  "Character choice prompt",
);
source = replaceOnce(
  source,
  '  const effectChoiceCanSkip = match.pendingChoice?.kind === "prevent-combat-damage"',
  '  const effectChoiceCanSkip = (match.pendingChoice?.kind === "character" && match.pendingChoice.choice.optional && !match.pendingChoice.choice.options.includes("skip")) || match.pendingChoice?.kind === "prevent-combat-damage"',
  "Character choice skip",
);
source = replaceOnce(
  source,
  '{match.pendingChoice?.kind === "prevent-combat-damage" ? <button type="button" onClick={usePendingEquipmentChoice}>',
  '{match.pendingChoice?.kind === "character" ? match.pendingChoice.choice.options.map((option) => { const optionCard = cardFor(option); return <button type="button" onClick={() => resolveCharacterChoice(option)} key={option}><span>CHARACTER ABILITY</span><b>{optionCard?.name ?? (option === "accept" ? "Use ability" : option === "skip" ? "Decline" : option)}</b><small>{optionCard?.catalogId ?? match.pendingChoice!.choice.resolver}</small></button>; }) : match.pendingChoice?.kind === "prevent-combat-damage" ? <button type="button" onClick={usePendingEquipmentChoice}>',
  "Character choice buttons",
);
source = replaceOnce(
  source,
  '{effectChoiceCanSkip && <footer><button className="button ghost" onClick={skipPendingChoice}>Skip this optional effect</button></footer>}',
  '{effectChoiceCanSkip && <footer><button className="button ghost" onClick={() => match.pendingChoice?.kind === "character" ? resolveCharacterChoice("skip") : skipPendingChoice()}>Skip this optional effect</button></footer>}',
  "Character choice skip button",
);

source = replaceOnce(
  source,
  '  const equipmentActions = (match.phase === "player-initiate" || match.phase === "player-yell")\n',
  '  const canReboot = !match.pendingChoice && ["player-initiate", "player-yell", "player-ascend"].includes(match.phase) && player.equipment.length > 0 && characterHasResolver(player.fighterId, "character.exhaustReadyEquipmentLock");\n  const equipmentActions = (match.phase === "player-initiate" || match.phase === "player-yell")\n',
  "Rebooter action availability",
);
source = replaceOnce(
  source,
  '  const resolveDefense = (defenseId: string | null) => setMatch((current) => current ? resolveDefenseState(current, defenseId) : current);',
  '  const useRebooter = () => setMatch((current) => { if (!current || current.pendingChoice || !characterHasResolver(current.player.fighterId, "character.exhaustReadyEquipmentLock") || !current.player.equipment.length) return current; const reboot = runCharacterEvent(current.player, current.ai, { type: "reboot", candidateIds: current.player.equipment }, "player"); return write(current, reboot.choice?.prompt ?? "Equipment rebooted.", { player: reboot.self, ai: reboot.opponent, pendingChoice: reboot.choice ? characterPendingChoice(reboot.choice, reboot.event, "reboot") : null }); });\n\n  const resolveDefense = (defenseId: string | null) => setMatch((current) => current ? resolveDefenseState(current, defenseId) : current);',
  "Rebooter player action",
);
source = replaceOnce(
  source,
  '{equipmentActions.length > 0 && <div className="equipment-reaction-strip equipment-trigger-strip" aria-label="Available Equipment actions"><span>Equipment actions</span>',
  '{(equipmentActions.length > 0 || canReboot) && <div className="equipment-reaction-strip equipment-trigger-strip" aria-label="Available Equipment actions"><span>Equipment actions</span>{canReboot && <button type="button" onClick={useRebooter}><b>Turn It Off and On</b><small>Exhaust → ready one Equipment; lock its printed effect this turn</small></button>}',
  "Rebooter action UI",
);

source = replaceOnce(
  source,
  '  const fighter = cardFor(current.ai.fighterId);\n  const initiatedAi = applyInitiateCarryover({ ...current.ai, usedEffectIdsThisTurn: [] });\n  const turnEquipment = autoActivateAiTurnEquipment(initiatedAi);',
  '  const fighter = cardFor(current.ai.fighterId);\n  const initiatedAi = applyInitiateCarryover({ ...current.ai, usedEffectIdsThisTurn: [] });\n  const characterInitiate = applyCharacterInitiate(initiatedAi, current.player, "ai");\n  let characterAi = characterInitiate.self; let characterPlayer = characterInitiate.opponent;\n  if (characterHasResolver(characterAi.fighterId, "character.exhaustReadyEquipmentLock") && characterAi.equipment.length) { const reboot = runCharacterEvent(characterAi, characterPlayer, { type: "reboot", candidateIds: characterAi.equipment }, "ai"); characterAi = reboot.self; characterPlayer = reboot.opponent; }\n  const turnEquipment = autoActivateAiTurnEquipment(characterAi);',
  "AI Initiate and Rebooter",
);
source = source.replace('  let nextPlayer = current.player;\n', '  let nextPlayer = characterPlayer;\n', 1);

source = replaceOnce(
  source,
  '  const attackPower = Math.max(0, cardPower(card) + fighterStat(activeEquipment.board, "ATK") + activeEquipment.board.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + activeEquipment.power);\n  const consumedAttackBoard',
  '  const preCharacterAttackPower = Math.max(0, cardPower(card) + fighterStat(activeEquipment.board, "ATK") + activeEquipment.board.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + activeEquipment.power);\n  const previousZone = activeEquipment.board.zonesPlayed.at(-1) ?? null;\n  const aiDeclaration = runCharacterEvent(activeEquipment.board, current.player, { type: "attackDeclared", card, zone, printedZone: card.zone?.split(",")[0] ?? zone, selectedZone: zone, previousAttackZone: previousZone, firstAttackThisTurn: activeEquipment.board.attacksThisTurn === 0, usedConsumableThisTurn: Boolean(activeEquipment.board.usedConsumableThisRound), playedKataEarlierThisTurn: activeEquipment.board.cardsThisTurn.some((id) => { const prior = cardFor(id); return Boolean(prior && isKata(prior)); }), differentZoneFromPreviousAttack: Boolean(previousZone && previousZone !== zone), hasWeaponEquipped: activeEquipment.board.equipment.some((id) => { const item = cardFor(id); return Boolean(item && isWeapon(item)); }), attackPower: preCharacterAttackPower }, "ai");\n  const modifierBonus = Math.max(0, Number(aiDeclaration.event.attackPower ?? preCharacterAttackPower) - cardPower(card) - fighterStat(aiDeclaration.self, "ATK"));\n  const playerIncoming = runCharacterEvent(aiDeclaration.opponent, aiDeclaration.self, { type: "incomingAttackDeclared", card, zone, attackPower: Number(aiDeclaration.event.attackPower ?? preCharacterAttackPower), modifierBonus }, "player");\n  const attackPower = Math.max(0, Number(playerIncoming.event.attackPower ?? aiDeclaration.event.attackPower ?? preCharacterAttackPower));\n  const consumedAttackBoard',
  "AI Attack declaration and player incoming Character event",
);
source = source.replace('stage3cConsumeAttackStatuses(activeEquipment.board, card, zone)', 'stage3cConsumeAttackStatuses(playerIncoming.opponent, card, zone)');
source = replaceOnce(
  source,
  '  return { ...current, player: { ...current.player, attacksReceivedThisRound: (current.player.attacksReceivedThisRound ?? 0) + 1 }, ai: nextAi, phase: "defense-window" as const, pendingStrike:',
  '  const pendingCharacterChoice = playerIncoming.choice ? characterPendingChoice(playerIncoming.choice, playerIncoming.event, "incoming-strike") : null;\n  return { ...current, player: { ...playerIncoming.self, attacksReceivedThisRound: (playerIncoming.self.attacksReceivedThisRound ?? 0) + 1 }, ai: nextAi, phase: "defense-window" as const, pendingChoice: pendingCharacterChoice, pendingStrike:',
  "pause AI strike for player incoming Character choice",
);

source = replaceOnce(
  source,
  '  const initiatedPlayer = playerFirst ? applyInitiateCarryover(player) : player;\n',
  '  let initiatedPlayer = playerFirst ? applyInitiateCarryover(player) : player;\n  let initiatedAi = ai;\n  let characterRoundChoice: PendingChoice | null = null;\n  if (playerFirst) { const initiate = applyCharacterInitiate(initiatedPlayer, initiatedAi, "player"); initiatedPlayer = initiate.self; initiatedAi = initiate.opponent; if (initiate.choice) characterRoundChoice = characterPendingChoice(initiate.choice, initiate.event); }\n',
  "round Character Initiate",
);
source = source.replace('return { ...current, ...marketState, player: initiatedPlayer, ai, marketPurchasedThisRound:', 'return { ...current, ...marketState, player: initiatedPlayer, ai: initiatedAi, marketPurchasedThisRound:');
source = source.replace('pendingDiscard: null, pendingChoice: null, pendingCombatContinuation:', 'pendingDiscard: null, pendingChoice: characterRoundChoice, pendingCombatContinuation:');

source = replaceAllExact(
  source,
  'usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] });',
  'usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [], usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [], characterMarks: Object.fromEntries(Object.entries(current.player.characterMarks ?? {}).filter(([key]) => !key.startsWith("turn:") && !key.startsWith("round:"))) });',
  1,
  "round player Character reset",
);
source = source.replace(
  'const ai = stage3cAdvanceRound({ ...current.ai, xp:',
  'const ai = stage3cAdvanceRound(resetCharacterRound({ ...current.ai, xp:',
);
source = source.replace(
  'reversalUsedRound: false, triggeredCombos: [] });\n  const marketState',
  'reversalUsedRound: false, triggeredCombos: [] }) as unknown as Board);\n  const marketState',
);

source = replaceOnce(
  source,
  '    const player = applyInitiateCarryover(finished.player);\n    const carryover = player.focus - finished.player.focus;\n    return { ...finished, player, phase: "player-initiate" as const, turnIndex: 1 as const, log:',
  '    const carried = applyInitiateCarryover(finished.player);\n    const initiate = applyCharacterInitiate(carried, finished.ai, "player");\n    const player = initiate.self; const carryover = player.focus - finished.player.focus;\n    return { ...finished, player, ai: initiate.opponent, pendingChoice: initiate.choice ? characterPendingChoice(initiate.choice, initiate.event) : null, phase: "player-initiate" as const, turnIndex: 1 as const, log:',
  "second-player Character Initiate",
);

source = source.replace(
  '    if (!supportIds.length && !practiceId && !badHabitId && !turnEquipment.notes.length) return current;',
  '    if (!supportIds.length && !practiceId && !badHabitId && !turnEquipment.notes.length && characterAi === current.ai) return { ...current, player: characterPlayer, ai: characterAi };',
);

fs.writeFileSync(playtestPath, source);
console.log("Stage 3D Character runtime lifecycle patch applied successfully.");
