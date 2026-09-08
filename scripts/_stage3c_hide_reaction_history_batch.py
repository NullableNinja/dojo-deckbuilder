from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)

pfile = Path("app/playtest.tsx")
p = pfile.read_text()

p = replace_once(
    p,
    'import { armConsumableAttackFollowupStatuses, isConsumableAttackFollowupStatus, resolveConsumableAttackFollowupStatuses } from "./stage3c-consumable-attack-followup.ts";\n',
    'import { armConsumableAttackFollowupStatuses, isConsumableAttackFollowupStatus, resolveConsumableAttackFollowupStatuses } from "./stage3c-consumable-attack-followup.ts";\nimport { armConsumableHideStatuses, resolveConsumableHideStatuses } from "./stage3c-consumable-hide-followup.ts";\n',
    "hide import",
)

p = replace_once(
    p,
    '  usedConsumableThisRound?: boolean;\n  lastAttackHit?: boolean;',
    '  usedConsumableThisRound?: boolean;\n  reactionItemUsedSinceLastTurn?: boolean;\n  lastAttackHit?: boolean;',
    "board reaction history",
)

p = replace_once(
    p,
    '    tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], tempo: true, attackedThisRound: false,',
    '    tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], tempo: true, attackedThisRound: false, reactionItemUsedSinceLastTurn: false,',
    "empty board reaction history",
)

p = replace_once(
    p,
    '    sameTurnSourceActive: true,\n    revealedFocusValue:',
    '    sameTurnSourceActive: true,\n    reactionItemUsedSinceLastTurn: Boolean(board.reactionItemUsedSinceLastTurn),\n    revealedFocusValue:',
    "reaction history context",
)

p = replace_once(
    p,
    '    if (card.subtype === "Consumable") next = { ...next, usedConsumableThisRound: true };',
    '    if (card.subtype === "Consumable") next = { ...next, usedConsumableThisRound: true, reactionItemUsedSinceLastTurn: Boolean(next.reactionItemUsedSinceLastTurn) || String(card.timing ?? "").toLocaleLowerCase() === "reaction" };',
    "record reaction item",
)

p = replace_once(
    p,
    '      nextPlayer = { ...nextPlayer, stage3cStatuses: armConsumableAttackFollowupStatuses(nextPlayer.stage3cStatuses ?? [], card) };',
    '      nextPlayer = { ...nextPlayer, stage3cStatuses: armConsumableHideStatuses(armConsumableAttackFollowupStatuses(nextPlayer.stage3cStatuses ?? [], card), card) };',
    "arm player hide",
)

p = replace_once(
    p,
    '      nextAi = { ...nextAi, stage3cStatuses: armConsumableAttackFollowupStatuses(nextAi.stage3cStatuses ?? [], card) };',
    '      nextAi = { ...nextAi, stage3cStatuses: armConsumableHideStatuses(armConsumableAttackFollowupStatuses(nextAi.stage3cStatuses ?? [], card), card) };',
    "arm ai hide",
)

old_cleanup = '''function playAreaCleanup(board: Board) {
  let hideBoard = board;
  for (const id of board.playArea) {
    const sourceCard = cardFor(id);
    if (sourceCard && isCoreConsumableCard(sourceCard)) hideBoard = applyStage3CTiming(hideBoard, sourceCard, "onHide", "ai", stage3cConsumableContext(hideBoard), "self");
  }
  const readyBoard = stage3cEndTurn(applyHideReady(hideBoard));'''
new_cleanup = '''function playAreaCleanup(board: Board) {
  const hideResolution = resolveConsumableHideStatuses(board.stage3cStatuses ?? []);
  let hideBoard: Board = {
    ...board,
    stage3cStatuses: hideResolution.statuses,
    hp: Math.max(0, board.hp - hideResolution.directSelfDamage),
    damageTaken: board.damageTaken + hideResolution.directSelfDamage,
  };
  if (hideResolution.focus) hideBoard = gainFocus(hideBoard, hideResolution.focus);
  const readyBoard = stage3cEndTurn(applyHideReady(hideBoard));'''
p = replace_once(p, old_cleanup, new_cleanup, "hide cleanup")

p = replace_once(
    p,
    'targetEquipmentDefPenalties: {}, attackLockedThisTurn: false, completesActiveBeltExamThisAttack: false, currentAttackIsReversal: false }, gameDefinition.turn.handSize',
    'targetEquipmentDefPenalties: {}, attackLockedThisTurn: false, reactionItemUsedSinceLastTurn: false, completesActiveBeltExamThisAttack: false, currentAttackIsReversal: false }, gameDefinition.turn.handSize',
    "reset reaction history at hide",
)

p = replace_once(
    p,
    '      const hidden = write(current, "Hide: unspent Focus clears and your next hand is drawn.", { player: nextPlayer });\n      if (current.turnIndex === 0)',
    '      const hidden = write(current, "Hide: unspent Focus clears and your next hand is drawn.", { player: nextPlayer, winner: nextPlayer.hp ? current.winner : "ai" });\n      if (!nextPlayer.hp) return hidden;\n      if (current.turnIndex === 0)',
    "player hide ko",
)

p = replace_once(
    p,
    '  const finished = { ...current, ai: nextAi, market, marketDeck, marketDiscard, marketPurchasedThisRound: current.marketPurchasedThisRound || Boolean(purchasedCard), log: [purchaseLog, ...(promotionLog ? [promotionLog] : []), line, ...current.log].slice(0, 32) };\n  if (current.turnIndex === 0)',
    '  const finished = { ...current, ai: nextAi, market, marketDeck, marketDiscard, marketPurchasedThisRound: current.marketPurchasedThisRound || Boolean(purchasedCard), winner: nextAi.hp ? current.winner : "player" as const, log: [purchaseLog, ...(promotionLog ? [promotionLog] : []), line, ...current.log].slice(0, 32) };\n  if (!nextAi.hp) return finished;\n  if (current.turnIndex === 0)',
    "ai hide ko",
)

pfile.write_text(p)

Path("tests/stage3c-consumable-hide-followup.test.mjs").write_text('''import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\nimport { armConsumableHideStatuses, isConsumableHideStatus, resolveConsumableHideStatuses } from "../app/stage3c-consumable-hide-followup.ts";\nimport { consumableRuntimeCommands } from "../app/consumable-effect-resolvers.ts";\n\nconst cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];\nconst card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);\n\ntest("Expired Protein Shake persists its 2 direct Hide damage after leaving the play area", () => {\n  const armed = armConsumableHideStatuses([], card("DDB-CON-CORE-019"));\n  assert.equal(armed.filter(isConsumableHideStatus).length, 1);\n  const resolved = resolveConsumableHideStatuses(armed);\n  assert.equal(resolved.directSelfDamage, 2);\n  assert.equal(resolved.statuses.some(isConsumableHideStatus), false);\n});\n\ntest("Overtime Espresso persists its 1 HP Hide loss after leaving the play area", () => {\n  const armed = armConsumableHideStatuses([], card("DDB-CON-CORE-040"));\n  assert.equal(armed.filter(isConsumableHideStatus).length, 1);\n  assert.equal(resolveConsumableHideStatuses(armed).directSelfDamage, 1);\n});\n\ntest("Warranty-Approved Ice Pop bonus is driven by Reaction Item history context", () => {\n  const noReaction = consumableRuntimeCommands(card("DDB-CON-CORE-058"), "onPlay", { reactionItemUsedSinceLastTurn: false, friendlyTargetCount: 1 });\n  const afterReaction = consumableRuntimeCommands(card("DDB-CON-CORE-058"), "onPlay", { reactionItemUsedSinceLastTurn: true, friendlyTargetCount: 1 });\n  assert.equal(noReaction.filter((command) => command.effect === "core.heal").reduce((sum, command) => sum + command.amount, 0), 4);\n  assert.equal(afterReaction.filter((command) => command.effect === "core.heal").reduce((sum, command) => sum + command.amount, 0), 6);\n});\n''')

integration = Path("tests/playtest-effect-integration.test.mjs")
i = integration.read_text()
if 'Quick Duel persists Consumable Hide effects and Reaction Item history after source cards leave play' not in i:
    i += '''\n\ntest("Quick Duel persists Consumable Hide effects and Reaction Item history after source cards leave play", async () => {\n  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");\n  assert.match(source, /armConsumableHideStatuses\\(armConsumableAttackFollowupStatuses/);\n  assert.match(source, /resolveConsumableHideStatuses\\(board\\.stage3cStatuses/);\n  assert.match(source, /reactionItemUsedSinceLastTurn: Boolean\\(next\\.reactionItemUsedSinceLastTurn\\)/);\n  assert.match(source, /reactionItemUsedSinceLastTurn: Boolean\\(board\\.reactionItemUsedSinceLastTurn\\)/);\n  assert.match(source, /reactionItemUsedSinceLastTurn: false/);\n});\n'''
integration.write_text(i)
