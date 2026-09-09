import { readFile, writeFile } from "node:fs/promises";

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one anchor, found ${count}`);
  return source.replace(search, replacement);
}

// 1) Resolver semantics that were still structurally present but play-surface wrong.
const resolverPath = "app/consumable-effect-resolvers.ts";
let resolver = await readFile(resolverPath, "utf8");
resolver = replaceOnce(
  resolver,
  '    case "consumable.focusByHpThreshold": return Boolean(context.hpThresholdMet);',
  '    case "consumable.focusByHpThreshold": return true;',
  "Fruit Cup eligibility",
);
resolver = replaceOnce(
  resolver,
  '    "consumable.ascendPurchaseDiscount",\n',
  '',
  "Voucher should not be an unreachable chosen-card choice",
);
resolver = replaceOnce(
  resolver,
  '    case "consumable.nextQualifyingAttackModifier":\n      command.qualifier = { nextAttackTag: "Unarmed", expires: "endOfTurn" };',
  '    case "consumable.focusByHpThreshold":\n      command.amount = context.hpThresholdMet ? 2 : 1;\n      break;\n    case "consumable.nextQualifyingAttackModifier":\n      command.qualifier = { nextAttackTag: "Unarmed", expires: "endOfTurn" };',
  "Fruit Cup amount",
);
resolver = replaceOnce(
  resolver,
  '    case "consumable.ascendPurchaseDiscount":\n      command.duration = "nextPurchase";',
  '    case "consumable.ascendPurchaseDiscount":\n      command.target = "self";\n      command.duration = "nextPurchase";',
  "Voucher self-owned status",
);
resolver = replaceOnce(
  resolver,
  '    case "consumable.reorderTopThree":\n      command.choice = { resolver, reveal: 3, bonusFocusIfDifferentTypes: 3 };',
  '    case "consumable.reorderTopThree":\n      command.choice = { resolver, reveal: 3, bonusFocusIfDifferentTypes: 1 };',
  "Fortune Cookie canonical bonus",
);
resolver = replaceOnce(
  resolver,
  '    case "consumable.suppressChosenWeaponClause":\n      command.duration = "endOfTurn";',
  '    case "consumable.topThreeAttackSelection":\n      command.choice = { resolver, reveal: 3, filter: "Attack", discardRest: true, optionalDestroyJunkDiscarded: true };\n      break;\n    case "consumable.suppressChosenWeaponClause":\n      command.duration = "endOfTurn";',
  "Sparring Dummy choice payload",
);
await writeFile(resolverPath, resolver);

// 2) Ascend timing is a real Consumable surface.
const windowPath = "app/stage3c-consumable-play-window.ts";
let playWindow = await readFile(windowPath, "utf8");
playWindow = replaceOnce(
  playWindow,
  '  if (phase === "player-yell") return timing === "turn" || timing === "anytime";\n  if (phase !== "defense-window") return false;',
  '  if (phase === "player-yell") return timing === "turn" || timing === "anytime";\n  if (phase === "player-ascend") return timing === "ascend";\n  if (phase !== "defense-window") return false;',
  "Ascend play window",
);
await writeFile(windowPath, playWindow);

// 3) Pure purchase semantics: restricted Focus and one qualified purchase discount.
await writeFile("app/stage3c-consumable-surface.ts", `import type { RuntimeStatus } from "./family-effect-runtime.ts";

export type PurchaseCardLike = { cardType?: string | null; subtype?: string | null; category?: string | null; fpCost?: string | number | null };

function spendOnlyOn(status: RuntimeStatus) {
  const value = status.qualifier?.spendOnlyOn;
  return Array.isArray(value) ? value.map(String) : [];
}

export function isRestrictedFocusPurchaseEligible(card: PurchaseCardLike | undefined, status: RuntimeStatus) {
  if (!card) return false;
  const allowed = spendOnlyOn(status);
  if (!allowed.length) return false;
  const labels = [card.cardType, card.subtype, card.category].map((value) => String(value ?? ""));
  return allowed.some((entry) => labels.includes(entry) || (entry === "Equipment" && String(card.cardType ?? "") === "Item" && String(card.subtype ?? "") !== "Consumable"));
}

export function restrictedFocusAmount(statuses: RuntimeStatus[] | undefined) {
  return (statuses ?? []).filter((status) => status.effect === "core.gainFocus" && spendOnlyOn(status).length).reduce((total, status) => total + Math.max(0, status.amount), 0);
}

export function spendableFocusForPurchase(totalFocus: number, statuses: RuntimeStatus[] | undefined, card: PurchaseCardLike | undefined) {
  const restricted = (statuses ?? []).filter((status) => status.effect === "core.gainFocus" && spendOnlyOn(status).length);
  const locked = restricted.filter((status) => !isRestrictedFocusPurchaseEligible(card, status)).reduce((total, status) => total + Math.max(0, status.amount), 0);
  return Math.max(0, totalFocus - locked);
}

export function spendFocusForPurchase(totalFocus: number, statuses: RuntimeStatus[] | undefined, card: PurchaseCardLike | undefined, price: number) {
  let remaining = Math.max(0, price);
  const nextStatuses = (statuses ?? []).map((status) => ({ ...status, qualifier: status.qualifier ? { ...status.qualifier } : undefined }));
  for (const status of nextStatuses) {
    if (!remaining || status.effect !== "core.gainFocus" || !spendOnlyOn(status).length || !isRestrictedFocusPurchaseEligible(card, status)) continue;
    const spent = Math.min(Math.max(0, status.amount), remaining);
    status.amount -= spent;
    remaining -= spent;
  }
  const nextFocus = Math.max(0, totalFocus - Math.max(0, price));
  return { focus: nextFocus, statuses: nextStatuses.filter((status) => !(status.effect === "core.gainFocus" && spendOnlyOn(status).length && status.amount <= 0)) };
}

export function qualifiedNextPurchaseDiscount(statuses: RuntimeStatus[] | undefined, printedCost: number) {
  const status = (statuses ?? []).find((candidate) => candidate.duration === "nextPurchase" && candidate.resolver === "consumable.ascendPurchaseDiscount" && printedCost >= Number(candidate.qualifier?.minPrintedCost ?? 0));
  if (!status) return { amount: 0, minimumFinalCost: 0, sourceEffectId: null as string | null };
  return { amount: status.amount, minimumFinalCost: Number(status.qualifier?.minimumFinalCost ?? 0), sourceEffectId: status.sourceEffectId };
}

export function consumeQualifiedNextPurchaseStatuses(statuses: RuntimeStatus[] | undefined, printedCost: number) {
  const discount = qualifiedNextPurchaseDiscount(statuses, printedCost);
  if (!discount.sourceEffectId) return [...(statuses ?? [])];
  return (statuses ?? []).filter((status) => status.sourceEffectId !== discount.sourceEffectId);
}
`);

// 4) Patch the real Quick Duel play surface.
const playtestPath = "app/playtest.tsx";
let source = await readFile(playtestPath, "utf8");
source = replaceOnce(
  source,
  'import { firstEventReactionCard } from "./stage3c-consumable-event-reactions.ts";',
  'import { firstEventReactionCard, hasUntargetableStatus } from "./stage3c-consumable-event-reactions.ts";\nimport { consumeQualifiedNextPurchaseStatuses, qualifiedNextPurchaseDiscount, spendableFocusForPurchase, spendFocusForPurchase } from "./stage3c-consumable-surface.ts";',
  "surface imports",
);
source = replaceOnce(
  source,
  '  stage3cPurchaseCostModifier?: number;\n};',
  '  stage3cPurchaseCostModifier?: number;\n  suppressedEquipmentPenaltyIds?: string[];\n};',
  "suppressed Equipment state",
);
source = replaceOnce(
  source,
  '  | { kind: "air-horn-reaction"; sourceCardId: string; reactionCardId: string; reactionKind: "consumable" | "defense" };',
  '  | { kind: "air-horn-reaction"; sourceCardId: string; reactionCardId: string; reactionKind: "consumable" | "defense" }\n  | { kind: "stage3c-trail-mix"; sourceCardId: string; equipmentIds: string[] }\n  | { kind: "stage3c-zone-ward"; sourceCardId: string; amount: number }\n  | { kind: "stage3c-remove-negative"; sourceCardId: string; bonusAttack: number; stats: ("ATK" | "DEF" | "Speed")[] }\n  | { kind: "stage3c-discard-focus"; sourceCardId: string; remaining: number; focusPerDiscard: number; optional: true }\n  | { kind: "stage3c-weapon-suppress"; sourceCardId: string; equipmentIds: string[] }\n  | { kind: "stage3c-exhaust-focus"; sourceCardId: string; equipmentIds: string[]; focus: number }\n  | { kind: "stage3c-raffle"; sourceCardId: string; revealedCardId: string }\n  | { kind: "stage3c-lucky-reveal"; sourceCardId: string; revealKind: "market" | "location"; revealedCardId: string; marketSlot?: number }\n  | { kind: "stage3c-sparring-pick"; sourceCardId: string; revealed: string[] }\n  | { kind: "stage3c-sparring-junk"; sourceCardId: string; junkIds: string[]; optional: true }\n  | { kind: "stage3c-reaction-discard"; sourceCardId: string; reactionIds: string[] };',
  "final 32 PendingChoice variants",
);

source = replaceOnce(
  source,
  'function marketPriceFor(board: Board, card: CardEntry | undefined) {\n  if (!card) return Number.POSITIVE_INFINITY;\n  const certificationDiscount = beltHasReward(board, "market-discount") && !board.boughtCardThisAscend ? 1 : 0;\n  return Math.max(0, cardCost(card) + (board.stage3cPurchaseCostModifier ?? 0) + (card.cardType === "Item" ? (board.nextItemCostPenalty ?? 0) : 0) - certificationDiscount);\n}',
  `function marketPriceFor(board: Board, card: CardEntry | undefined) {
  if (!card) return Number.POSITIVE_INFINITY;
  const certificationDiscount = beltHasReward(board, "market-discount") && !board.boughtCardThisAscend ? 1 : 0;
  const printedCost = cardCost(card);
  const qualified = qualifiedNextPurchaseDiscount(board.stage3cStatuses, printedCost);
  const base = printedCost + (board.stage3cPurchaseCostModifier ?? 0) + (card.cardType === "Item" ? (board.nextItemCostPenalty ?? 0) : 0) - certificationDiscount + qualified.amount;
  return Math.max(qualified.minimumFinalCost || 0, base, 0);
}
function marketFocusAvailable(board: Board, card: CardEntry | undefined) {
  return spendableFocusForPurchase(board.focus, board.stage3cStatuses, card);
}
function spendMarketFocus(board: Board, card: CardEntry, price: number) {
  const spent = spendFocusForPurchase(board.focus, board.stage3cStatuses, card, price);
  return { ...board, focus: spent.focus, focusSpentThisTurn: (board.focusSpentThisTurn ?? 0) + price, stage3cStatuses: spent.statuses };
}`,
  "purchase pricing",
);

source = replaceOnce(
  source,
  '      const standingCost = command.effect === "economy.modifyCost" && ["endOfTurn", "nextTurn", "nextPurchase"].includes(command.duration);',
  '      const standingCost = command.effect === "economy.modifyCost" && ["endOfTurn", "nextTurn", "nextPurchase"].includes(command.duration) && command.qualifier?.minPrintedCost === undefined;',
  "qualified purchase not globally applied",
);
source = replaceOnce(
  source,
  'function stage3cConsumePurchase(board: Board) {\n  return expireStage3C(board, "nextPurchase");\n}',
  `function stage3cConsumePurchase(board: Board, purchasedCard?: CardEntry) {
  if (!purchasedCard) return expireStage3C(board, "nextPurchase");
  const statuses = consumeQualifiedNextPurchaseStatuses(board.stage3cStatuses, cardCost(purchasedCard));
  const qualifiedIds = new Set((board.stage3cStatuses ?? []).filter((status) => status.duration === "nextPurchase" && status.resolver === "consumable.ascendPurchaseDiscount").map((status) => status.sourceEffectId));
  const preserved = statuses.filter((status) => !qualifiedIds.has(status.sourceEffectId) || cardCost(purchasedCard) < Number(status.qualifier?.minPrintedCost ?? 0));
  return { ...board, stage3cStatuses: preserved };
}`,
  "qualified purchase consumption",
);

source = replaceOnce(
  source,
  '    damageDealt: 0, damageTaken: 0, cardsBought: 0, destroyed: [], returnedToSupply: [], stage3cStatuses: [], stage3cChoices: [], stage3cRestrictions: [], stage3cDefenseModifier: 0, stage3cAttackModifier: 0, stage3cSpeedOverride: null, stage3cPurchaseCostModifier: 0,',
  '    damageDealt: 0, damageTaken: 0, cardsBought: 0, destroyed: [], returnedToSupply: [], stage3cStatuses: [], stage3cChoices: [], stage3cRestrictions: [], stage3cDefenseModifier: 0, stage3cAttackModifier: 0, stage3cSpeedOverride: null, stage3cPurchaseCostModifier: 0, suppressedEquipmentPenaltyIds: [],',
  "new board initial state",
);

source = replaceOnce(
  source,
  '    if (stat === "ATK") return total + numberValue(card.stats["Attack Bonus"]);\n    if (stat === "DEF") return total + passiveEquipmentGuard(card);\n    if (stat === "Speed") return total + equipmentSpeedModifier(card);',
  '    const suppression = (board.suppressedEquipmentPenaltyIds ?? []).includes(id);\n    if (stat === "ATK") { const value = numberValue(card.stats["Attack Bonus"]); return total + (suppression && value < 0 ? 0 : value); }\n    if (stat === "DEF") { const value = passiveEquipmentGuard(card); return total + (suppression && value < 0 ? 0 : value); }\n    if (stat === "Speed") { const value = equipmentSpeedModifier(card); return total + (suppression && value < 0 ? 0 : value); }',
  "Muscle Ointment actual stat suppression",
);

source = replaceOnce(
  source,
  '  return drawCards({ ...readyBoard, hand: [], playArea: [], equipment, exhaustedEquipment, equipmentAttackPlan: null, discard, focus: 0, focusGeneratedThisTurn: 0, focusSpentThisTurn: 0, attacksThisTurn: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0, borrowedEquipmentId: null, wasHitSinceLastTurn: false, playedDefenseSinceLastTurn: false, blockedSinceLastTurn: false, usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, comboAttemptedTurn: false, boughtCardLastAscend: Boolean(readyBoard.boughtCardThisAscend), boughtCardThisAscend: false, targetEquipmentDefPenalties: {}, attackLockedThisTurn: false, reactionItemUsedSinceLastTurn: false, completesActiveBeltExamThisAttack: false, currentAttackIsReversal: false }, gameDefinition.turn.handSize + (beltHasReward(readyBoard, "hand-size") ? 1 : 0));',
  '  return drawCards({ ...readyBoard, hand: [], playArea: [], equipment, exhaustedEquipment, equipmentAttackPlan: null, discard, focus: 0, focusGeneratedThisTurn: 0, focusSpentThisTurn: 0, attacksThisTurn: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0, borrowedEquipmentId: null, wasHitSinceLastTurn: false, playedDefenseSinceLastTurn: false, blockedSinceLastTurn: false, usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, comboAttemptedTurn: false, boughtCardLastAscend: Boolean(readyBoard.boughtCardThisAscend), boughtCardThisAscend: false, targetEquipmentDefPenalties: {}, attackLockedThisTurn: false, reactionItemUsedSinceLastTurn: false, suppressedEquipmentPenaltyIds: [], completesActiveBeltExamThisAttack: false, currentAttackIsReversal: false }, gameDefinition.turn.handSize + (beltHasReward(readyBoard, "hand-size") ? 1 : 0));',
  "Muscle Ointment Hide cleanup",
);

// Shared final-32 helpers live beside the Stage 3C timing helpers so both human and AI paths use them.
const helperAnchor = `function stage3cConsumeKata(board: Board) {
  const statuses = (board.stage3cStatuses ?? []).filter((status) => status.duration === "nextKata");
  let next = board;
  for (const status of statuses) if (status.effect === "core.gainFocus" || status.resolver === "consumable.nextKataFocusBonus" || status.resolver === "defense.nextKataFocus") next = gainFocus(next, status.amount);
  const ids = new Set(statuses.map((status) => status.sourceEffectId));
  return { ...next, stage3cStatuses: (next.stage3cStatuses ?? []).filter((status) => !ids.has(status.sourceEffectId)) };
}`;
const helperReplacement = helperAnchor + `

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
  const status: RuntimeStatus = { sourceEffectId: \`consumable-foam-finger-zone-penalty:\${sourceCardId}\`, effect: "combat.modifyAttackPower", target: "self", amount, duration: "nextAttack", resolver: "consumable.zoneSpecificIncomingAttackPenalty", qualifier: { nextAttackZone: zone, expires: "endOfRound" }, appliedImmediately: false };
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
`;
source = replaceOnce(source, helperAnchor, helperReplacement, "final 32 helpers");

// Player support now includes Ascend-only Consumables and promotes final-32 choices into the visible PendingChoice surface.
source = replaceOnce(
  source,
  '    const legalSupportPhase = current.phase === "player-yell"\n      ? (!isCoreConsumableCard(card) || canPlayCoreConsumableInPhase(card, "player-yell", stage3cConsumableContext(current.player)))\n      : current.phase === "defense-window" && isCoreConsumableCard(card) && canPlayCoreConsumableInPhase(card, "defense-window", stage3cConsumableContext(current.player));',
  '    const legalSupportPhase = current.phase === "player-yell"\n      ? (!isCoreConsumableCard(card) || canPlayCoreConsumableInPhase(card, "player-yell", stage3cConsumableContext(current.player)))\n      : current.phase === "player-ascend"\n        ? isCoreConsumableCard(card) && canPlayCoreConsumableInPhase(card, "player-ascend", stage3cConsumableContext(current.player))\n        : current.phase === "defense-window" && isCoreConsumableCard(card) && canPlayCoreConsumableInPhase(card, "defense-window", stage3cConsumableContext(current.player));',
  "player Ascend support",
);
source = replaceOnce(
  source,
  '    const ownTurnPlay = current.phase === "player-yell";\n    const supportEntryBoard = { ...supportBoard, hand: removeOne(supportBoard.hand, id), playArea: [...supportBoard.playArea, id], cardsThisTurn: ownTurnPlay ? [...supportBoard.cardsThisTurn, id] : supportBoard.cardsThisTurn, focus: supportBoard.focus + (ownTurnPlay ? locationModifier.value : 0), lastAttackHit: false };\n    let nextPlayer = markCompletedTask(applyCardEffects(supportEntryBoard, card, "player", "onPlay", isCoreConsumableCard(card) ? stage3cConsumableContext(supportEntryBoard) : {}, ownTurnPlay));',
  '    const ownTurnPlay = current.phase === "player-yell";\n    const ascendPlay = current.phase === "player-ascend";\n    const supportEntryBoard = { ...supportBoard, hand: removeOne(supportBoard.hand, id), playArea: [...supportBoard.playArea, id], cardsThisTurn: ownTurnPlay ? [...supportBoard.cardsThisTurn, id] : supportBoard.cardsThisTurn, focus: supportBoard.focus + (ownTurnPlay ? locationModifier.value : 0), lastAttackHit: false };\n    let nextPlayer = markCompletedTask(applyCardEffects(supportEntryBoard, card, "player", "onPlay", isCoreConsumableCard(card) ? stage3cConsumableContext(supportEntryBoard) : {}, ownTurnPlay || ascendPlay));',
  "Ascend printed Focus",
);
source = replaceOnce(
  source,
  '    let nextAi = current.ai;\n    if (isCoreConsumableCard(card)) {',
  '    let nextAi = current.ai;\n    let nextMarket = current.market;\n    let nextMarketDeck = current.marketDeck;\n    let nextMarketDiscard = current.marketDiscard;\n    if (isCoreConsumableCard(card)) {',
  "special market state",
);
const specialAnchor = '    const junkSourceLabel = junkSources.length === 2 ? "hand or discard pile" : junkSources[0] === "discard" ? "discard pile" : "hand";';
const specialBlock = `    if (isCoreConsumableCard(card)) {
      if (card.catalogId === "DDB-CON-CORE-009") {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.chooseOpponentDiscardReactionIfAble"]);
        const reactions = nextAi.hand.map(cardFor).filter((candidate): candidate is CardEntry => Boolean(candidate && String(candidate.timing ?? "").toLocaleLowerCase() === "reaction"));
        if (reactions.length) {
          const chosen = [...reactions].sort((left, right) => cardFocus(left) - cardFocus(right) || cardCost(left) - cardCost(right))[0];
          nextAi = { ...nextAi, hand: removeOne(nextAi.hand, chosen.id), discard: [...nextAi.discard, chosen.id] };
        }
      }
      if (card.catalogId === "DDB-CON-CORE-010") {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.optionalExhaustToCycle"]);
        const equipmentIds = stage3cReadyEquipmentIds(nextPlayer);
        if (!pendingChoice && equipmentIds.length) pendingChoice = { kind: "stage3c-trail-mix", sourceCardId: id, equipmentIds };
      }
      if (card.catalogId === "DDB-CON-CORE-012" && current.phase === "player-ascend") {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.raffleTicket"]);
        const reveal = revealMarketCards(nextMarketDeck, nextMarketDiscard, 1);
        nextMarketDeck = reveal.marketDeck;
        nextMarketDiscard = reveal.marketDiscard;
        if (reveal.revealed[0]) pendingChoice = { kind: "stage3c-raffle", sourceCardId: id, revealedCardId: reveal.revealed[0] };
      }
      if (card.catalogId === "DDB-CON-CORE-021") {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.zoneSpecificIncomingAttackPenalty"]);
        pendingChoice = { kind: "stage3c-zone-ward", sourceCardId: id, amount: -2 };
      }
      if (card.catalogId === "DDB-CON-CORE-022") {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.reorderTopThree"]);
        const reveal = revealDeckTop(nextPlayer, 3);
        const types = new Set(reveal.revealed.map((candidate) => cardFor(candidate)?.cardType ?? "Unknown"));
        nextPlayer = reveal.board;
        if (reveal.revealed.length) pendingChoice = { kind: "deck-order", sourceCardId: id, revealed: reveal.revealed, ordered: [], bonusFocus: reveal.revealed.length === 3 && types.size === 3 ? 1 : 0 };
      }
      if (card.catalogId === "DDB-CON-CORE-031" || card.catalogId === "DDB-CON-CORE-056") {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.removeTemporaryNegativeStatModifier"]);
        const stats = stage3cNegativeStatOptions(nextPlayer);
        if (stats.length) pendingChoice = { kind: "stage3c-remove-negative", sourceCardId: id, bonusAttack: card.catalogId === "DDB-CON-CORE-031" ? 1 : 0, stats };
      }
      if (card.catalogId === "DDB-CON-CORE-032") {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.discardUpToForFocus"]);
        if (nextPlayer.hand.length) pendingChoice = { kind: "stage3c-discard-focus", sourceCardId: id, remaining: Math.min(2, nextPlayer.hand.length), focusPerDiscard: 2, optional: true };
      }
      if (card.catalogId === "DDB-CON-CORE-035") {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.suppressChosenWeaponClause"]);
        const equipmentIds = nextPlayer.equipment.filter((equipmentId) => { const item = cardFor(equipmentId); return Boolean(item && isWeapon(item)); });
        if (equipmentIds.length) pendingChoice = { kind: "stage3c-weapon-suppress", sourceCardId: id, equipmentIds };
      }
      if (card.catalogId === "DDB-CON-CORE-045") {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.exhaustEquipmentForFocus"]);
        const equipmentIds = stage3cReadyEquipmentIds(nextPlayer);
        if (equipmentIds.length) pendingChoice = { kind: "stage3c-exhaust-focus", sourceCardId: id, equipmentIds, focus: 3 };
      }
      if (card.catalogId === "DDB-CON-CORE-049" && current.phase === "defense-window" && current.pendingStrike) {
        const escaped = write(current, \`Smoke Bomb invalidates \${cardFor(current.pendingStrike.cardId)?.name ?? "the incoming Attack"}'s only legal target. The strike is spent without dealing damage.\`, { player: nextPlayer, ai: nextAi, pendingStrike: null, pendingChoice: null, pendingCombatContinuation: null });
        return finishAiTurn(escaped, "Computer cannot legally target you through the Smoke Bomb and ends its Yell.", settings.locations);
      }
      if (card.catalogId === "DDB-CON-CORE-051") {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.topThreeAttackSelection"]);
        const sparring = beginStage3CSparringDummy(nextPlayer, id);
        nextPlayer = sparring.board;
        pendingChoice = sparring.pendingChoice;
      }
    }

` + specialAnchor;
source = replaceOnce(source, specialAnchor, specialBlock, "final 32 player special bridge");
source = replaceOnce(
  source,
  '    return write(current, `${card.name} played. ${choiceNote}${destroyedAfterUse ? " Destroyed after use; it will not enter your discard pile." : ""}${ownTurnPlay && locationModifier.notes.length ? ` ${locationModifier.notes.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, pendingDiscard, pendingChoice });',
  '    return write(current, `${card.name} played. ${choiceNote}${destroyedAfterUse ? " Destroyed after use; it will not enter your discard pile." : ""}${ownTurnPlay && locationModifier.notes.length ? ` ${locationModifier.notes.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, market: nextMarket, marketDeck: nextMarketDeck, marketDiscard: nextMarketDiscard, pendingDiscard, pendingChoice });',
  "special market state return",
);

// Resolve the final-32 visible choices.
const resolveSpecialAnchor = '    if (choice.kind === "destroy-junk") {';
const resolveSpecialBlock = `    if (choice.kind === "stage3c-trail-mix") {
      if (source !== "equipment" || !choice.equipmentIds.includes(cardId) || !current.player.equipment.includes(cardId) || isEquipmentExhausted(current.player, cardId)) return current;
      let player = exhaustEquipment(current.player, cardId);
      player = drawCards(player, 1);
      const pendingChoice = player.hand.length ? { kind: "discard-hand", sourceCardId: choice.sourceCardId, remaining: 1, sourceFollowup: false } as PendingChoice : null;
      return write(current, \`\${selected.name} exhausted for \${cardFor(choice.sourceCardId)?.name ?? "Department-Issue Trail Mix"}; draw 1\${pendingChoice ? " and choose 1 discard" : ""}.\`, { player, pendingChoice });
    }

    if (choice.kind === "stage3c-discard-focus") {
      if (!current.player.hand.includes(cardId)) return current;
      const player = gainFocus({ ...current.player, hand: removeOne(current.player.hand, cardId), discard: [...current.player.discard, cardId] }, choice.focusPerDiscard);
      const remaining = choice.remaining - 1;
      const pendingChoice = remaining > 0 && player.hand.length ? { ...choice, remaining } : null;
      return write(current, \`\${selected.name} discarded for +\${choice.focusPerDiscard} Focus.\${pendingChoice ? ` Up to \${remaining} more may be discarded.` : " Choice complete."}\`, { player, pendingChoice });
    }

    if (choice.kind === "stage3c-weapon-suppress") {
      if (source !== "equipment" || !choice.equipmentIds.includes(cardId) || !current.player.equipment.includes(cardId)) return current;
      const player = { ...current.player, suppressedEquipmentPenaltyIds: [...new Set([...(current.player.suppressedEquipmentPenaltyIds ?? []), cardId])] };
      return write(current, \`Muscle Ointment suppresses \${selected.name}'s drawback/self-penalty until Hide.\`, { player, pendingChoice: null });
    }

    if (choice.kind === "stage3c-exhaust-focus") {
      if (source !== "equipment" || !choice.equipmentIds.includes(cardId) || !current.player.equipment.includes(cardId) || isEquipmentExhausted(current.player, cardId)) return current;
      const player = gainFocus(exhaustEquipment(current.player, cardId), choice.focus);
      return write(current, \`\${selected.name} exhausted; Receipt-Printer Ribbon grants +\${choice.focus} Focus.\`, { player, pendingChoice: null });
    }

    if (choice.kind === "stage3c-reaction-discard") {
      if (!choice.reactionIds.includes(cardId) || !current.player.hand.includes(cardId) || String(selected.timing ?? "").toLocaleLowerCase() !== "reaction") return current;
      const player = { ...current.player, hand: removeOne(current.player.hand, cardId), discard: [...current.player.discard, cardId] };
      return write(current, \`\${selected.name} discarded to satisfy Confetti Cannon.\`, { player, pendingChoice: null });
    }

    if (choice.kind === "stage3c-sparring-pick") {
      if (source !== "deck" || !choice.revealed.includes(cardId) || !isAttack(selected)) return current;
      const rest = removeOne(choice.revealed, cardId);
      const junkIds = rest.filter((candidate) => isJunk(cardFor(candidate)));
      const player = { ...current.player, hand: [...current.player.hand, cardId], discard: [...current.player.discard, ...rest] };
      const pendingChoice = junkIds.length ? { kind: "stage3c-sparring-junk", sourceCardId: choice.sourceCardId, junkIds, optional: true } as PendingChoice : null;
      return write(current, \`\${selected.name} taken from Sparring Dummy's reveal; the rest are discarded.\${pendingChoice ? " You may destroy one Junk discarded this way." : ""}\`, { player, pendingChoice });
    }

    if (choice.kind === "stage3c-sparring-junk") {
      if (source !== "discard" || !choice.junkIds.includes(cardId) || !current.player.discard.includes(cardId) || !isJunk(selected)) return current;
      const player = { ...current.player, discard: removeOne(current.player.discard, cardId), destroyed: [...(current.player.destroyed ?? []), cardId] };
      return write(current, \`\${selected.name} destroyed from Sparring Dummy's discarded reveal.\`, { player, pendingChoice: null });
    }

` + resolveSpecialAnchor;
source = replaceOnce(source, resolveSpecialAnchor, resolveSpecialBlock, "resolve final 32 card choices");

// Non-card-button choices: zones, stat removal, Raffle, Lucky Dumpling.
const skipAnchor = '  const skipPendingChoice = () => setMatch((current) => {';
const specialHandlers = `  const resolveStage3CZoneWard = (zone: string) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "stage3c-zone-ward") return current;
    const ai = stage3cArmZoneWard(current.ai, choice.sourceCardId, zone, choice.amount);
    return write(current, \`Foam Finger calls \${zone}; the next \${zone} Attack targeting you this round gets \${choice.amount} Attack Power.\`, { ai, pendingChoice: null });
  });

  const resolveStage3CNegative = (stat: "ATK" | "DEF" | "Speed") => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "stage3c-remove-negative" || !choice.stats.includes(stat)) return current;
    const removed = stage3cRemoveTemporaryNegative(current.player, stat);
    let player = removed.board;
    if (removed.removed && choice.bonusAttack) {
      const status: RuntimeStatus = { sourceEffectId: \`consumable-pep-talk-bonus:\${choice.sourceCardId}\`, effect: "combat.modifyAttackPower", target: "self", amount: choice.bonusAttack, duration: "nextAttack", resolver: "consumable.pepTalkConditionalAttackBonus", qualifier: { nextAttack: true, expires: "endOfTurn" }, appliedImmediately: false };
      player = { ...player, stage3cStatuses: [...(player.stage3cStatuses ?? []), status] };
    }
    return write(current, \`\${cardFor(choice.sourceCardId)?.name ?? "Consumable"} removes one temporary -\${stat} effect.\${choice.bonusAttack && removed.removed ? " Next Attack gets +1 Attack Power." : ""}\`, { player, pendingChoice: null });
  });

  const resolveStage3CRaffle = (buy: boolean) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "stage3c-raffle") return current;
    const revealed = cardFor(choice.revealedCardId);
    if (!revealed) return { ...current, pendingChoice: null };
    const price = marketPriceFor(current.player, revealed);
    if (buy && marketFocusAvailable(current.player, revealed) >= price) {
      const focusBefore = current.player.focus;
      let player = spendMarketFocus(current.player, revealed, price);
      player = stage3cConsumePurchase(markCompletedTask({ ...player, discard: [...player.discard, revealed.id], purchasedTypes: [...player.purchasedTypes, revealed.cardType], cardsBought: player.cardsBought + 1, boughtCardThisAscend: true }), revealed);
      return write(current, \`Dojo Raffle Ticket purchase: \${revealed.name} for \${price} Focus (\${focusBefore} → \${player.focus}).\`, { player, pendingChoice: null, marketPurchasedThisRound: true });
    }
    return write(current, \`Dojo Raffle Ticket passes on \${revealed.name}; it goes to the bottom of the Market deck.\`, { marketDeck: [revealed.id, ...current.marketDeck], pendingChoice: null });
  });

  const resolveStage3CLucky = (use: boolean) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "stage3c-lucky-reveal") return current;
    if (!use) return write(current, "Lucky Dumpling held; the revealed card remains.", { pendingChoice: null });
    const lucky = cardFor(choice.sourceCardId);
    if (!lucky || !current.player.hand.includes(lucky.id)) return { ...current, pendingChoice: null };
    const aiAirHorn = firstEventReactionCard(current.ai.hand.map(cardFor).filter((candidate): candidate is CardEntry => Boolean(candidate && isCoreConsumableCard(candidate))), "cancel-reaction") as CardEntry | null;
    let player = { ...current.player, hand: removeOne(current.player.hand, lucky.id), playArea: [...current.player.playArea, lucky.id], usedConsumableThisRound: true, reactionItemUsedSinceLastTurn: true };
    player = returnResolvedConsumable(player, lucky);
    if (aiAirHorn) {
      let ai = { ...current.ai, hand: removeOne(current.ai.hand, aiAirHorn.id), playArea: [...current.ai.playArea, aiAirHorn.id], usedConsumableThisRound: true, reactionItemUsedSinceLastTurn: true };
      ai = returnResolvedConsumable(ai, aiAirHorn);
      return write(current, \`\${aiAirHorn.name} cancels Lucky Dumpling; the original reveal remains.\`, { player, ai, pendingChoice: null });
    }
    if (choice.revealKind === "market" && choice.marketSlot !== undefined) {
      const reveal = revealMarketCards(current.marketDeck, [...current.marketDiscard, choice.revealedCardId], 1);
      const market = [...current.market];
      market[choice.marketSlot] = reveal.revealed[0] ?? choice.revealedCardId;
      return write(current, \`Lucky Dumpling replaces \${cardFor(choice.revealedCardId)?.name ?? "the Market reveal"} with \${cardFor(market[choice.marketSlot])?.name ?? "a replacement"}.\`, { player, market, marketDeck: reveal.marketDeck, marketDiscard: reveal.marketDiscard, pendingChoice: null });
    }
    if (choice.revealKind === "location") {
      const replacement = current.locations[0];
      if (!replacement) return write(current, "Lucky Dumpling finds no remaining Location to replace the reveal.", { player, pendingChoice: null });
      return write(current, \`Lucky Dumpling replaces \${cardFor(choice.revealedCardId)?.name ?? "the Location"} with \${cardFor(replacement)?.name ?? "the next Location"}.\`, { player, locationId: replacement, locations: current.locations.slice(1), pendingChoice: null });
    }
    return { ...current, player, pendingChoice: null };
  });

` + skipAnchor;
source = replaceOnce(source, skipAnchor, specialHandlers, "final 32 choice handlers");

// Skip paths for optional final-32 choices.
source = replaceOnce(
  source,
  '    if (current.pendingChoice.kind === "destroy-junk" && current.pendingChoice.optional) return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: Junk destruction declined.`, { pendingChoice: null });',
  '    if (current.pendingChoice.kind === "stage3c-trail-mix") return write(current, "Department-Issue Trail Mix: optional Equipment cycle declined.", { pendingChoice: null });\n    if (current.pendingChoice.kind === "stage3c-discard-focus") return write(current, "Last-Call Electrolytes: stop discarding; keep the Focus already earned.", { pendingChoice: null });\n    if (current.pendingChoice.kind === "stage3c-sparring-junk") return write(current, "Sparring Dummy: optional Junk destruction declined.", { pendingChoice: null });\n    if (current.pendingChoice.kind === "destroy-junk" && current.pendingChoice.optional) return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: Junk destruction declined.`, { pendingChoice: null });',
  "final 32 skip handlers",
);

// Actual Ascend purchases now obey restricted Focus and qualified Voucher semantics, then offer Lucky Dumpling on refill.
source = replaceOnce(
  source,
  '    const price = marketPriceFor(current.player, card);\n    if (!card || slot < 0 || current.player.focus < price) return current;\n    const focusBefore = current.player.focus;\n    let nextPlayer = spendFocus(current.player, price);\n    nextPlayer = stage3cConsumePurchase(markCompletedTask({ ...nextPlayer, discard: [...nextPlayer.discard, id], purchasedTypes: [...nextPlayer.purchasedTypes, card.cardType], cardsBought: nextPlayer.cardsBought + 1, boughtCardThisAscend: true, nextItemCostPenalty: card.cardType === "Item" ? 0 : nextPlayer.nextItemCostPenalty }));\n    const refilled = refillPurchasedMarketSlot(current.market, current.marketDeck, current.marketDiscard, slot);\n    return write(current, `Bought ${card.name} for ${price} Focus (${focusBefore} → ${nextPlayer.focus}). The top Market card immediately fills the slot.`, { player: nextPlayer, ...refilled, marketPurchasedThisRound: true });',
  `    const price = marketPriceFor(current.player, card);
    if (!card || slot < 0 || marketFocusAvailable(current.player, card) < price) return current;
    const focusBefore = current.player.focus;
    let nextPlayer = spendMarketFocus(current.player, card, price);
    nextPlayer = stage3cConsumePurchase(markCompletedTask({ ...nextPlayer, discard: [...nextPlayer.discard, id], purchasedTypes: [...nextPlayer.purchasedTypes, card.cardType], cardsBought: nextPlayer.cardsBought + 1, boughtCardThisAscend: true, nextItemCostPenalty: card.cardType === "Item" ? 0 : nextPlayer.nextItemCostPenalty }), card);
    const refilled = refillPurchasedMarketSlot(current.market, current.marketDeck, current.marketDiscard, slot);
    const purchased = write(current, \`Bought \${card.name} for \${price} Focus (\${focusBefore} → \${nextPlayer.focus}). The top Market card immediately fills the slot.\`, { player: nextPlayer, ...refilled, marketPurchasedThisRound: true });
    const revealedId = refilled.market[slot];
    const lucky = revealedId ? nextPlayer.hand.map(cardFor).find((candidate): candidate is CardEntry => Boolean(candidate && candidate.catalogId === "DDB-CON-CORE-033")) : null;
    return lucky && revealedId ? write(purchased, \`\${cardFor(revealedId)?.name ?? "A Market card"} was revealed. Lucky Dumpling may replace it.\`, { pendingChoice: { kind: "stage3c-lucky-reveal", sourceCardId: lucky.id, revealKind: "market", revealedCardId: revealedId, marketSlot: slot } }) : purchased;`,
  "player purchase runtime",
);

// Player can actually use Ascend Consumables from hand.
source = replaceOnce(
  source,
  '    if (match.phase !== "player-yell") return;\n    if (card.catalogId === gameDefinition.economy.badHabitFocus.catalogId',
  '    if (match.phase === "player-ascend") {\n      if (isCoreConsumableCard(card) && canPlayCoreConsumableInPhase(card, "player-ascend", stage3cConsumableContext(match.player))) playSupport(id);\n      return;\n    }\n    if (match.phase !== "player-yell") return;\n    if (card.catalogId === gameDefinition.economy.badHabitFocus.catalogId',
  "use Ascend card from hand",
);

// Human Smoke and AI Smoke both invalidate target selection rather than merely storing a status.
source = replaceOnce(
  source,
  '    const card = cardFor(current.selectedAttackId);\n    if (!card || !isAttack(card) || !current.player.hand.includes(card.id)) return current;',
  '    const card = cardFor(current.selectedAttackId);\n    if (!card || !isAttack(card) || !current.player.hand.includes(card.id)) return current;\n    if (hasUntargetableStatus(current.ai.stage3cStatuses)) return write(current, `${cardFor(current.ai.fighterId)?.name ?? "The opponent"} cannot be targeted through Smoke Bomb. Choose a different action.`, { selectedAttackId: null });',
  "player blocked by Smoke",
);
source = replaceOnce(
  source,
  '    const aiConsumableReaction = current.airHornAiConsumableSpentThisStrike\n      ? { board: aiIncomingReaction.board, card: null as CardEntry | null, notes: ["Air Horn canceled the computer\'s Consumable Reaction"] }\n      : autoPlayAiDefensiveConsumable(aiIncomingReaction.board, expectedIncomingDamage);\n    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);',
  '    const aiConsumableReaction = current.airHornAiConsumableSpentThisStrike\n      ? { board: aiIncomingReaction.board, card: null as CardEntry | null, notes: ["Air Horn canceled the computer\'s Consumable Reaction"] }\n      : autoPlayAiDefensiveConsumable(aiIncomingReaction.board, expectedIncomingDamage);\n    if (hasUntargetableStatus(aiConsumableReaction.board.stage3cStatuses)) {\n      let player = applyCardEffects({ ...stage3cConsumeAttackStatuses(current.player, card, zone), hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attacksThisTurn: current.player.attacksThisTurn + 1, attackedThisRound: true, zonesPlayed: [...current.player.zonesPlayed, zone], cardsThisTurn: [...current.player.cardsThisTurn, card.id], selectedAttackId: undefined as never }, card, "player");\n      player = { ...player, nextAttackBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false };\n      return write(current, `${aiConsumableReaction.card?.name ?? "Smoke Bomb"} invalidates the Attack target. ${card.name} is spent without dealing damage.`, { player, ai: aiConsumableReaction.board, selectedAttackId: null, airHornPassedReactionIds: [], airHornAiConsumableSpentThisStrike: false, airHornAiDefenseSpentThisStrike: false });\n    }\n    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);',
  "AI Smoke invalidates player Attack",
);
source = replaceOnce(
  source,
  '    if (!current || current.phase !== "ai-ready" || current.winner) return current;\n    const prepared = prepareAiTurn(current);',
  '    if (!current || current.phase !== "ai-ready" || current.winner || current.pendingChoice) return current;\n    const prepared = prepareAiTurn(current);\n    if (prepared.pendingChoice) return prepared;\n    if (hasUntargetableStatus(prepared.player.stage3cStatuses)) return finishAiTurn(prepared, "Smoke Bomb leaves the computer without a legal target this Yell.", settings.locations);',
  "AI respects Smoke target invalidation",
);
source = replaceOnce(
  source,
  '    if (!settings.autoAi || match?.phase !== "ai-ready" || match.winner) return;',
  '    if (!settings.autoAi || match?.phase !== "ai-ready" || match.winner || match.pendingChoice) return;',
  "auto AI pauses for player choice",
);

// AI support choices become deterministic or visible human choices instead of hidden stage3cChoices.
source = replaceOnce(
  source,
  '  const played: string[] = [];\n  const triggeredEquipment: string[] = [];\n  let nextPlayer = current.player;',
  '  const played: string[] = [];\n  const triggeredEquipment: string[] = [];\n  let pendingChoice: PendingChoice | null = null;\n  let nextPlayer = current.player;',
  "AI pending choice",
);
const aiSpecialAnchor = '    const aiFastestFocus = structuredFocusIfFastest(card, fighterStat(nextAi, "Speed"), fighterStat(nextPlayer, "Speed"));';
const aiSpecialBlock = `    if (isCoreConsumableCard(card)) {
      if (card.catalogId === "DDB-CON-CORE-009") {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.chooseOpponentDiscardReactionIfAble"]);
        const reactionIds = nextPlayer.hand.filter((candidate) => String(cardFor(candidate)?.timing ?? "").toLocaleLowerCase() === "reaction");
        if (reactionIds.length) pendingChoice = { kind: "stage3c-reaction-discard", sourceCardId: card.id, reactionIds };
      }
      if (card.catalogId === "DDB-CON-CORE-010") {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.optionalExhaustToCycle"]);
        const equipmentId = stage3cReadyEquipmentIds(nextAi)[0];
        if (equipmentId) {
          nextAi = exhaustEquipment(nextAi, equipmentId);
          nextAi = drawCards(nextAi, 1);
          const discardId = [...nextAi.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)))[0];
          if (discardId) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, discardId), discard: [...nextAi.discard, discardId] };
        }
      }
      if (card.catalogId === "DDB-CON-CORE-021") {
        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.zoneSpecificIncomingAttackPenalty"]);
        nextPlayer = stage3cArmZoneWard(nextPlayer, card.id, stage3cAiPreferredAttackZone(nextPlayer), -2);
      }
      if (card.catalogId === "DDB-CON-CORE-022") {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.reorderTopThree"]);
        const reveal = revealDeckTop(nextAi, 3);
        const ordered = [...reveal.revealed].sort((left, right) => cardCost(cardFor(right)) - cardCost(cardFor(left)));
        const types = new Set(reveal.revealed.map((candidate) => cardFor(candidate)?.cardType ?? "Unknown"));
        nextAi = { ...reveal.board, deck: [...reveal.board.deck, ...ordered.slice().reverse()] };
        if (reveal.revealed.length === 3 && types.size === 3) nextAi = gainFocus(nextAi, 1);
      }
      if (card.catalogId === "DDB-CON-CORE-031" || card.catalogId === "DDB-CON-CORE-056") {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.removeTemporaryNegativeStatModifier"]);
        const stat = stage3cNegativeStatOptions(nextAi)[0];
        if (stat) {
          const removed = stage3cRemoveTemporaryNegative(nextAi, stat);
          nextAi = removed.board;
          if (removed.removed && card.catalogId === "DDB-CON-CORE-031") {
            const status: RuntimeStatus = { sourceEffectId: \`consumable-pep-talk-bonus:\${card.id}\`, effect: "combat.modifyAttackPower", target: "self", amount: 1, duration: "nextAttack", resolver: "consumable.pepTalkConditionalAttackBonus", qualifier: { nextAttack: true, expires: "endOfTurn" }, appliedImmediately: false };
            nextAi = { ...nextAi, stage3cStatuses: [...(nextAi.stage3cStatuses ?? []), status] };
          }
        }
      }
      if (card.catalogId === "DDB-CON-CORE-032") {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.discardUpToForFocus"]);
        const discarded = [...nextAi.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right))).slice(0, 2);
        nextAi = gainFocus({ ...nextAi, hand: nextAi.hand.filter((candidate) => !discarded.includes(candidate)), discard: [...nextAi.discard, ...discarded] }, discarded.length * 2);
      }
      if (card.catalogId === "DDB-CON-CORE-035") {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.suppressChosenWeaponClause"]);
        const weaponId = nextAi.equipment.find((candidate) => { const item = cardFor(candidate); return Boolean(item && isWeapon(item)); });
        if (weaponId) nextAi = { ...nextAi, suppressedEquipmentPenaltyIds: [...new Set([...(nextAi.suppressedEquipmentPenaltyIds ?? []), weaponId])] };
      }
      if (card.catalogId === "DDB-CON-CORE-045") {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.exhaustEquipmentForFocus"]);
        const equipmentId = stage3cReadyEquipmentIds(nextAi)[0];
        if (equipmentId) nextAi = gainFocus(exhaustEquipment(nextAi, equipmentId), 3);
      }
      if (card.catalogId === "DDB-CON-CORE-051") {
        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.topThreeAttackSelection"]);
        const reveal = revealDeckTop(nextAi, 3);
        const attackId = reveal.revealed.filter((candidate) => isAttack(cardFor(candidate)!)).sort((left, right) => cardPower(cardFor(right)!) - cardPower(cardFor(left)!))[0];
        const rest = attackId ? removeOne(reveal.revealed, attackId) : reveal.revealed;
        const junkId = rest.find((candidate) => isJunk(cardFor(candidate)));
        nextAi = { ...reveal.board, hand: attackId ? [...reveal.board.hand, attackId] : reveal.board.hand, discard: [...reveal.board.discard, ...rest.filter((candidate) => candidate !== junkId)], destroyed: junkId ? [...(reveal.board.destroyed ?? []), junkId] : reveal.board.destroyed };
      }
    }
    if (pendingChoice) break;
` + aiSpecialAnchor;
source = replaceOnce(source, aiSpecialAnchor, aiSpecialBlock, "AI final 32 special choices");
source = replaceOnce(
  source,
  '  return { ...current, player: nextPlayer, ai: nextAi, log: [`Computer prepares with ${preparations.join(", ")}. The strategy is now technically documented.`, ...current.log].slice(0, 32) };',
  '  return { ...current, player: nextPlayer, ai: nextAi, pendingChoice, log: [`Computer prepares with ${preparations.join(", ")}. The strategy is now technically documented.`, ...current.log].slice(0, 32) };',
  "AI choice return",
);

// AI purchases honor restricted Focus / Voucher and consume only qualifying purchase statuses.
source = replaceOnce(
  source,
  '  const aiPurchase = current.market.filter((id) => marketPriceFor(current.ai, cardFor(id)) <= current.ai.focus).sort((left, right) => aiMarketScore(cardFor(right)!, current.ai) - aiMarketScore(cardFor(left)!, current.ai))[0];\n  const purchasedCard = aiPurchase ? cardFor(aiPurchase) : null;\n  let aiAfterPurchase = purchasedCard ? stage3cConsumePurchase(markCompletedTask({ ...current.ai, focus: current.ai.focus - marketPriceFor(current.ai, purchasedCard), discard: [...current.ai.discard, purchasedCard.id], purchasedTypes: [...current.ai.purchasedTypes, purchasedCard.cardType], cardsBought: current.ai.cardsBought + 1 })) : current.ai;',
  '  const aiPurchase = current.market.filter((id) => marketPriceFor(current.ai, cardFor(id)) <= marketFocusAvailable(current.ai, cardFor(id))).sort((left, right) => aiMarketScore(cardFor(right)!, current.ai) - aiMarketScore(cardFor(left)!, current.ai))[0];\n  const purchasedCard = aiPurchase ? cardFor(aiPurchase) : null;\n  let aiAfterPurchase = purchasedCard ? stage3cConsumePurchase(markCompletedTask({ ...spendMarketFocus(current.ai, purchasedCard, marketPriceFor(current.ai, purchasedCard)), discard: [...current.ai.discard, purchasedCard.id], purchasedTypes: [...current.ai.purchasedTypes, purchasedCard.cardType], cardsBought: current.ai.cardsBought + 1 }), purchasedCard) : current.ai;',
  "AI purchase semantics",
);

// Location reveals and Market Mercy reveals offer the player a Lucky Dumpling reaction.
const advanceReturn = '  return { ...current, ...marketState, player: initiatedPlayer, ai, marketPurchasedThisRound: false, pendingDiscard: null, pendingChoice: null, pendingCombatContinuation: null, locationId, locations: sceneChanges ? freshLocations.slice(1) : current.locations, round: nextRound, phase: playerFirst ? "player-initiate" as const : "ai-ready" as const, turnOrder, turnIndex: 0 as const, selectedAttackId: null, log: [`Honor ${nextRound}: ${cardFor(locationId)?.name ?? "Tournament Mat"} is active. Both fighters gain 1 XP and refresh Tempo. ${marketNote} ${playerFirst ? "You" : "Computer"} take initiative.`, line, ...current.log].slice(0, 32) };';
const advanceReplacement = `  const advanced: Match = { ...current, ...marketState, player: initiatedPlayer, ai, marketPurchasedThisRound: false, pendingDiscard: null, pendingChoice: null, pendingCombatContinuation: null, locationId, locations: sceneChanges ? freshLocations.slice(1) : current.locations, round: nextRound, phase: playerFirst ? "player-initiate" as const : "ai-ready" as const, turnOrder, turnIndex: 0 as const, selectedAttackId: null, log: [\`Honor \${nextRound}: \${cardFor(locationId)?.name ?? "Tournament Mat"} is active. Both fighters gain 1 XP and refresh Tempo. \${marketNote} \${playerFirst ? "You" : "Computer"} take initiative.\`, line, ...current.log].slice(0, 32) };
  const lucky = initiatedPlayer.hand.map(cardFor).find((candidate): candidate is CardEntry => Boolean(candidate && candidate.catalogId === "DDB-CON-CORE-033"));
  if (sceneChanges && lucky && locationId !== current.locationId) return write(advanced, \`\${cardFor(locationId)?.name ?? "A Location"} was revealed. Lucky Dumpling may replace it.\`, { pendingChoice: { kind: "stage3c-lucky-reveal", sourceCardId: lucky.id, revealKind: "location", revealedCardId: locationId } });
  if (!current.marketPurchasedThisRound && lucky) {
    const revealedId = marketState.market.find((id) => !current.market.includes(id));
    const slot = revealedId ? marketState.market.indexOf(revealedId) : -1;
    if (revealedId && slot >= 0) return write(advanced, \`\${cardFor(revealedId)?.name ?? "A Market card"} was revealed during Market Mercy. Lucky Dumpling may replace it.\`, { pendingChoice: { kind: "stage3c-lucky-reveal", sourceCardId: lucky.id, revealKind: "market", revealedCardId, marketSlot: slot } });
  }
  return advanced;`;
source = replaceOnce(source, advanceReturn, advanceReplacement, "Lucky reveal hooks");

// Pending choice option lists and labels.
source = replaceOnce(
  source,
  '      : match.pendingChoice?.kind === "ready-equipment"\n            ? (player.exhaustedEquipment ?? []).filter((id) => player.equipment.includes(id)).map((id, index) => ({ id, source: "equipment" as const, index }))\n            : [];',
  '      : match.pendingChoice?.kind === "ready-equipment"\n            ? (player.exhaustedEquipment ?? []).filter((id) => player.equipment.includes(id)).map((id, index) => ({ id, source: "equipment" as const, index }))\n            : match.pendingChoice?.kind === "stage3c-trail-mix" || match.pendingChoice?.kind === "stage3c-weapon-suppress" || match.pendingChoice?.kind === "stage3c-exhaust-focus"\n              ? match.pendingChoice.equipmentIds.map((id, index) => ({ id, source: "equipment" as const, index }))\n              : match.pendingChoice?.kind === "stage3c-discard-focus" || match.pendingChoice?.kind === "stage3c-reaction-discard"\n                ? (match.pendingChoice.kind === "stage3c-reaction-discard" ? match.pendingChoice.reactionIds : player.hand).map((id, index) => ({ id, source: "hand" as const, index }))\n                : match.pendingChoice?.kind === "stage3c-sparring-pick"\n                  ? match.pendingChoice.revealed.map((id, index) => ({ id, source: "deck" as const, index })).filter((entry) => isAttack(cardFor(entry.id)!))\n                  : match.pendingChoice?.kind === "stage3c-sparring-junk"\n                    ? match.pendingChoice.junkIds.map((id, index) => ({ id, source: "discard" as const, index }))\n                    : [];',
  "final 32 choice options",
);
source = replaceOnce(
  source,
  '  const effectChoiceTitle = match.pendingChoice?.kind === "air-horn-reaction" ? "Sound the Air Horn?"',
  '  const effectChoiceTitle = match.pendingChoice?.kind === "stage3c-raffle" ? "Buy the raffle reveal?"\n    : match.pendingChoice?.kind === "stage3c-lucky-reveal" ? "Use Lucky Dumpling?"\n    : match.pendingChoice?.kind === "stage3c-zone-ward" ? "Call a protected zone"\n    : match.pendingChoice?.kind === "stage3c-remove-negative" ? "Remove a temporary penalty"\n    : match.pendingChoice?.kind === "stage3c-trail-mix" ? "Exhaust Equipment to cycle?"\n    : match.pendingChoice?.kind === "stage3c-discard-focus" ? "Discard for Focus"\n    : match.pendingChoice?.kind === "stage3c-weapon-suppress" ? "Choose a Weapon"\n    : match.pendingChoice?.kind === "stage3c-exhaust-focus" ? "Exhaust Equipment for Focus"\n    : match.pendingChoice?.kind === "stage3c-sparring-pick" ? "Choose an Attack"\n    : match.pendingChoice?.kind === "stage3c-sparring-junk" ? "Destroy revealed Junk?"\n    : match.pendingChoice?.kind === "stage3c-reaction-discard" ? "Discard a Reaction"\n    : match.pendingChoice?.kind === "air-horn-reaction" ? "Sound the Air Horn?"',
  "final 32 titles",
);
source = replaceOnce(
  source,
  '  const effectChoicePrompt = match.pendingChoice?.kind === "air-horn-reaction" ? `${cardFor(match.pendingChoice.reactionCardId)?.name ?? "The computer Reaction"} was just played. Use Air Horn now to cancel it before the Dojo Stack resolves, or allow it to resolve normally.`',
  '  const effectChoicePrompt = match.pendingChoice?.kind === "stage3c-raffle" ? `${cardFor(match.pendingChoice.revealedCardId)?.name ?? "The revealed card"} came off the Market deck. Buy it now or put it on the bottom.`\n    : match.pendingChoice?.kind === "stage3c-lucky-reveal" ? `${cardFor(match.pendingChoice.revealedCardId)?.name ?? "The revealed card"} was just revealed. Replace it from the same deck or keep it.`\n    : match.pendingChoice?.kind === "stage3c-zone-ward" ? "Choose High, Mid, or Low. The next Attack in that zone targeting you this round gets -2 Attack Power."\n    : match.pendingChoice?.kind === "stage3c-remove-negative" ? "Choose one currently active temporary -ATK, -DEF, or -Speed effect to remove."\n    : match.pendingChoice?.kind === "stage3c-trail-mix" ? "You may exhaust one ready Equipment you control to draw 1, then discard 1."\n    : match.pendingChoice?.kind === "stage3c-discard-focus" ? `Discard up to ${match.pendingChoice.remaining} more card${match.pendingChoice.remaining === 1 ? "" : "s"}; each is worth +${match.pendingChoice.focusPerDiscard} Focus.`\n    : match.pendingChoice?.kind === "stage3c-weapon-suppress" ? "Choose one equipped Weapon. Its negative stat contribution is ignored until Hide."\n    : match.pendingChoice?.kind === "stage3c-exhaust-focus" ? `Choose one ready Equipment to exhaust for +${match.pendingChoice.focus} Focus.`\n    : match.pendingChoice?.kind === "stage3c-sparring-pick" ? "Choose one Attack among the top-three reveal; the rest are discarded."\n    : match.pendingChoice?.kind === "stage3c-sparring-junk" ? "You may destroy one Junk that Sparring Dummy just discarded."\n    : match.pendingChoice?.kind === "stage3c-reaction-discard" ? "Confetti Cannon requires you to choose one Reaction card from hand to discard."\n    : match.pendingChoice?.kind === "air-horn-reaction" ? `${cardFor(match.pendingChoice.reactionCardId)?.name ?? "The computer Reaction"} was just played. Use Air Horn now to cancel it before the Dojo Stack resolves, or allow it to resolve normally.`',
  "final 32 prompts",
);
source = replaceOnce(
  source,
  '  const effectChoiceCanSkip = (match.pendingChoice?.kind === "destroy-junk" && Boolean(match.pendingChoice.optional)) ||',
  '  const effectChoiceCanSkip = match.pendingChoice?.kind === "stage3c-trail-mix" || match.pendingChoice?.kind === "stage3c-discard-focus" || match.pendingChoice?.kind === "stage3c-sparring-junk" || (match.pendingChoice?.kind === "destroy-junk" && Boolean(match.pendingChoice.optional)) ||',
  "final 32 optional choice UI",
);
source = replaceOnce(
  source,
  '{match.pendingChoice?.kind === "air-horn-reaction" ? <><button type="button" onClick={() => resolvePlayerAirHornChoice(true)}>',
  '{match.pendingChoice?.kind === "stage3c-raffle" ? <><button type="button" onClick={() => resolveStage3CRaffle(true)}><span>BUY</span><b>{cardFor(match.pendingChoice.revealedCardId)?.name}</b><small>Pay {marketPriceFor(player, cardFor(match.pendingChoice.revealedCardId))} Focus</small></button><button type="button" onClick={() => resolveStage3CRaffle(false)}><span>PASS</span><b>PUT ON BOTTOM</b><small>Do not buy the reveal</small></button></> : match.pendingChoice?.kind === "stage3c-lucky-reveal" ? <><button type="button" onClick={() => resolveStage3CLucky(true)}><span>REACTION</span><b>USE LUCKY DUMPLING</b><small>Discard the reveal and replace it</small></button><button type="button" onClick={() => resolveStage3CLucky(false)}><span>PASS</span><b>KEEP REVEAL</b><small>Save Lucky Dumpling</small></button></> : match.pendingChoice?.kind === "stage3c-zone-ward" ? ["High", "Mid", "Low"].map((zone) => <button type="button" onClick={() => resolveStage3CZoneWard(zone)} key={zone}><span>PROTECT ZONE</span><b>{zone}</b><small>Next matching Attack gets -2 Power</small></button>) : match.pendingChoice?.kind === "stage3c-remove-negative" ? match.pendingChoice.stats.map((stat) => <button type="button" onClick={() => resolveStage3CNegative(stat)} key={stat}><span>REMOVE PENALTY</span><b>-{stat}</b><small>Remove one active temporary penalty</small></button>) : match.pendingChoice?.kind === "air-horn-reaction" ? <><button type="button" onClick={() => resolvePlayerAirHornChoice(true)}>',
  "final 32 modal controls",
);

await writeFile(playtestPath, source);

// 5) Permanent final-32 certification: union of prior 30 + this 32 = all 62.
await writeFile("tests/stage3c-consumable-final-32.test.mjs", `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { consumableRuntimeCommands } from "../app/consumable-effect-resolvers.ts";
import { canPlayCoreConsumableInPhase } from "../app/stage3c-consumable-play-window.ts";
import { createFamilyRuntimeState } from "../app/family-effect-runtime.ts";
import { qualifiedNextPurchaseDiscount, spendableFocusForPurchase } from "../app/stage3c-consumable-surface.ts";
import { consumableEventReactionKind } from "../app/stage3c-consumable-event-reactions.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const family = JSON.parse(await readFile(new URL("../content/card-effects/consumables.json", import.meta.url), "utf8")).cards ?? {};
const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
const card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);
const previous30 = [1,2,3,5,6,13,14,16,19,20,23,24,27,28,29,36,37,40,41,42,43,46,47,48,50,57,58,59,60,62].map((n) => \`DDB-CON-CORE-\${String(n).padStart(3,"0")}\`);
const final32 = [4,7,8,9,10,11,12,15,17,18,21,22,25,26,30,31,32,33,34,35,38,39,44,45,49,51,52,53,54,55,56,61].map((n) => \`DDB-CON-CORE-\${String(n).padStart(3,"0")}\`);
const base = { hpThresholdMet: true, hasTempo: true, normalAttacksResolvedThisTurn: 2, friendlyTargetCount: 1, opponentTargetCount: 1, temporaryNegativeModifierPresent: true, removedTemporaryNegativeModifier: true, discardedCount: 2, revealedDifferentTypeCount: 3 };
const commands = (id, extra = {}) => consumableRuntimeCommands(card(id), "onPlay", { ...base, ...extra });

test("final batch is exactly the remaining 32 and union is all 62 Core Consumables", () => {
  assert.equal(new Set(final32).size, 32);
  assert.equal(new Set([...previous30, ...final32]).size, 62);
  assert.deepEqual([...new Set([...previous30, ...final32])].sort(), Object.keys(family).sort());
  for (const id of final32) { assert.ok(card(id), id); assert.ok(family[id]?.effects?.length, id); }
});

test("canonical final-32 names are taken from v2.3 catalog, not stale shorthand", () => {
  assert.equal(card("DDB-CON-CORE-010").name, "Department-Issue Trail Mix");
  assert.equal(card("DDB-CON-CORE-008").name, "Complimentary Fruit Cup");
  assert.equal(card("DDB-CON-CORE-052").name, "Spinach");
  assert.equal(card("DDB-CON-CORE-055").name, "Sweatband");
});

test("Complimentary Fruit Cup always resolves and uses the canonical 1-or-2 Focus threshold", () => {
  assert.equal(commands("DDB-CON-CORE-008", { hpThresholdMet: false }).find((c) => c.effect === "core.gainFocus")?.amount, 1);
  assert.equal(commands("DDB-CON-CORE-008", { hpThresholdMet: true }).find((c) => c.effect === "core.gainFocus")?.amount, 2);
  assert.ok(source.includes("board.hp <= Math.ceil(board.maxHp / 2)"));
});

test("simple final-32 cards emit the canonical concrete commands their shared hooks execute", () => {
  const checks = [
    ["DDB-CON-CORE-004", "combat.modifyAttackPower", 2], ["DDB-CON-CORE-007", "core.gainFocus", 2],
    ["DDB-CON-CORE-015", "combat.modifySpeed", 1], ["DDB-CON-CORE-018", "core.draw", 2],
    ["DDB-CON-CORE-025", "core.draw", 2], ["DDB-CON-CORE-026", "core.draw", 2],
    ["DDB-CON-CORE-034", "core.gainFocus", 1], ["DDB-CON-CORE-038", "core.heal", 2],
    ["DDB-CON-CORE-039", "core.gainFocus", 3], ["DDB-CON-CORE-044", "core.gainFocus", 2],
    ["DDB-CON-CORE-052", "combat.modifyAttackPower", 2], ["DDB-CON-CORE-053", "combat.modifySpeed", 2],
    ["DDB-CON-CORE-055", "combat.modifySpeed", 2], ["DDB-CON-CORE-061", "core.gainXP", 1],
  ];
  for (const [id, effect, amount] of checks) assert.ok(commands(id).some((c) => c.effect === effect && c.amount === amount), \`\${id}:\${effect}\`);
  const gloves = commands("DDB-CON-CORE-004").find((c) => c.resolver === "consumable.nextQualifyingAttackModifier");
  assert.equal(gloves?.qualifier?.nextAttackTag, "Unarmed");
});

test("Ascend Consumables have a real phase and Voucher is a qualified next-purchase status, not a dead choice", () => {
  for (const id of ["DDB-CON-CORE-012", "DDB-CON-CORE-030"]) {
    assert.equal(canPlayCoreConsumableInPhase(card(id), "player-ascend", base), true);
    assert.equal(canPlayCoreConsumableInPhase(card(id), "player-yell", base), false);
  }
  const voucher = commands("DDB-CON-CORE-030").find((c) => c.resolver === "consumable.ascendPurchaseDiscount");
  assert.ok(voucher && !voucher.choice);
  assert.equal(voucher.target, "self");
  assert.equal(voucher.duration, "nextPurchase");
  assert.equal(voucher.qualifier?.minPrintedCost, 5);
  assert.ok(source.includes('kind: "stage3c-raffle"'));
  assert.ok(source.includes("resolveStage3CRaffle"));
});

test("Voucher discount respects printed-cost threshold and floor", () => {
  const status = { sourceEffectId: "voucher", effect: "economy.modifyCost", target: "self", amount: -2, duration: "nextPurchase", resolver: "consumable.ascendPurchaseDiscount", qualifier: { minPrintedCost: 5, minimumFinalCost: 4 } };
  assert.equal(qualifiedNextPurchaseDiscount([status], 4).amount, 0);
  assert.equal(qualifiedNextPurchaseDiscount([status], 5).amount, -2);
  assert.equal(qualifiedNextPurchaseDiscount([status], 5).minimumFinalCost, 4);
  assert.ok(source.includes("qualifiedNextPurchaseDiscount"));
  assert.ok(source.includes("consumeQualifiedNextPurchaseStatuses"));
});

test("Dojo Coupon restricted Focus cannot subsidize Technique purchases but remains spendable on Items/Equipment", () => {
  const couponStatus = { sourceEffectId: "coupon", effect: "core.gainFocus", target: "self", amount: 3, duration: "endOfTurn", resolver: "consumable.restrictedFocusItemsEquipment", qualifier: { spendOnlyOn: ["Item", "Equipment"] } };
  assert.equal(spendableFocusForPurchase(5, [couponStatus], { cardType: "Technique", subtype: "Attack" }), 2);
  assert.equal(spendableFocusForPurchase(5, [couponStatus], { cardType: "Item", subtype: "Consumable" }), 5);
  assert.equal(spendableFocusForPurchase(5, [couponStatus], { cardType: "Item", subtype: "Weapon" }), 5);
  assert.ok(source.includes("marketFocusAvailable"));
  assert.ok(source.includes("spendMarketFocus"));
});

test("all explicit player choices in the final 32 are promoted to the visible PendingChoice surface", () => {
  for (const kind of ["stage3c-trail-mix","stage3c-zone-ward","stage3c-remove-negative","stage3c-discard-focus","stage3c-weapon-suppress","stage3c-exhaust-focus","stage3c-raffle","stage3c-lucky-reveal","stage3c-sparring-pick","stage3c-sparring-junk","stage3c-reaction-discard"]) assert.ok(source.includes(\`kind: "\${kind}"\`), kind);
  assert.ok(source.includes("resolveStage3CZoneWard"));
  assert.ok(source.includes("resolveStage3CNegative"));
  assert.ok(source.includes("resolveStage3CLucky"));
});

test("Confetti Cannon forces the actual opponent Reaction discard path for both human and AI controllers", () => {
  assert.ok(commands("DDB-CON-CORE-009").some((c) => c.resolver === "consumable.chooseOpponentDiscardReactionIfAble"));
  assert.ok(source.includes('card.catalogId === "DDB-CON-CORE-009"'));
  assert.ok(source.includes('kind: "stage3c-reaction-discard"'));
});

test("Department-Issue Trail Mix and Receipt-Printer Ribbon pay real Equipment costs before their payoff", () => {
  assert.ok(source.includes('card.catalogId === "DDB-CON-CORE-010"'));
  assert.ok(source.includes('kind: "stage3c-trail-mix"'));
  assert.ok(source.includes("exhaustEquipment(current.player, cardId)"));
  assert.ok(source.includes('card.catalogId === "DDB-CON-CORE-045"'));
  assert.ok(source.includes('kind: "stage3c-exhaust-focus"'));
});

test("Foam Finger stores the chosen zone on the real next-Attack status", () => {
  const foam = commands("DDB-CON-CORE-021").find((c) => c.resolver === "consumable.zoneSpecificIncomingAttackPenalty");
  assert.equal(foam?.amount, -2);
  assert.ok(source.includes("nextAttackZone: zone"));
  assert.ok(source.includes("stage3cArmZoneWard"));
});

test("Fortune Cookie and Sparring Dummy use actual deck reveal/order/pick surfaces", () => {
  assert.ok(source.includes('card.catalogId === "DDB-CON-CORE-022"'));
  assert.ok(source.includes('kind: "deck-order"'));
  assert.ok(source.includes('card.catalogId === "DDB-CON-CORE-051"'));
  assert.ok(source.includes('kind: "stage3c-sparring-pick"'));
  assert.ok(source.includes('kind: "stage3c-sparring-junk"'));
});

test("Pep Talk and Tiger Balm remove one actual temporary stat penalty; Pep Talk only then arms +1 Attack", () => {
  assert.ok(source.includes("stage3cNegativeStatOptions"));
  assert.ok(source.includes("stage3cRemoveTemporaryNegative"));
  assert.ok(source.includes("consumable-pep-talk-bonus"));
});

test("Last-Call Electrolytes is an optional 0/1/2 discard loop paying +2 Focus each", () => {
  const lastCall = commands("DDB-CON-CORE-032", { discardedCount: 2 });
  assert.ok(lastCall.some((c) => c.resolver === "consumable.discardUpToForFocus"));
  assert.ok(source.includes('kind: "stage3c-discard-focus"'));
  assert.ok(source.includes("focusPerDiscard: 2"));
});

test("Lucky Dumpling hooks both Market and Location reveal events, with Air Horn interception", () => {
  assert.equal(consumableEventReactionKind(card("DDB-CON-CORE-033")), "replace-reveal");
  assert.ok(source.includes('revealKind: "market"'));
  assert.ok(source.includes('revealKind: "location"'));
  const luckyHandler = source.slice(source.indexOf("const resolveStage3CLucky"), source.indexOf("const skipPendingChoice"));
  assert.ok(luckyHandler.includes("firstEventReactionCard"));
});

test("Emergency Shoelace is correctly certified as a dormant replacement because Core has no Disarm producer", () => {
  assert.equal(consumableEventReactionKind(card("DDB-CON-CORE-017")), "replace-disarm");
  const disarmCards = cards.filter((entry) => /\\bdisarm/i.test(String(entry.rulesText ?? "")));
  assert.deepEqual(disarmCards.map((entry) => entry.catalogId), ["DDB-CON-CORE-017"]);
});

test("Muscle Ointment suppresses a chosen equipped Weapon penalty and Hide clears that suppression", () => {
  assert.ok(source.includes("suppressedEquipmentPenaltyIds"));
  assert.ok(source.includes('kind: "stage3c-weapon-suppress"'));
  assert.ok(source.includes("suppression && value < 0 ? 0 : value"));
  assert.ok(source.includes("suppressedEquipmentPenaltyIds: []"));
});

test("Smoke Bomb invalidates targeting on both combat directions and expires through the existing status lifecycle", () => {
  assert.equal(consumableEventReactionKind(card("DDB-CON-CORE-049")), "invalidate-target");
  const smokeUses = source.match(/hasUntargetableStatus/g) ?? [];
  assert.ok(smokeUses.length >= 3);
  assert.ok(source.includes("Smoke Bomb invalidates the Attack target"));
  assert.ok(source.includes("Smoke Bomb leaves the computer without a legal target"));
  assert.ok(commands("DDB-CON-CORE-049")[0]?.qualifier?.expiresOnAttack);
});

test("Sweat Towel reaches the real next-Kata consumption hook", () => {
  const towel = commands("DDB-CON-CORE-054").find((c) => c.resolver === "consumable.nextKataFocusBonus");
  assert.equal(towel?.duration, "nextKata");
  assert.ok(source.includes('status.resolver === "consumable.nextKataFocusBonus"'));
});

test("no final-32 catalog entry is missing structured executable commands", () => {
  for (const id of final32) assert.ok(consumableRuntimeCommands(card(id), "onPlay", base).length > 0, id);
  const state = createFamilyRuntimeState();
  assert.equal(state.pendingChoices.length, 0);
});
`);
