import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../app/playtest.tsx", import.meta.url);
let source = await readFile(path, "utf8");

function replaceOnce(label, before, after) {
  if (source.includes(after)) return;
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Stage 3C v2 marker not found: ${label}`);
  source = `${source.slice(0, index)}${after}${source.slice(index + before.length)}`;
}

replaceOnce(
  "attack flow chosen zone",
  'function attackHasFlow(board: Board, card: CardEntry, combo: ComboModifier) {\n  if (board.nextAttackHasFlow || combo.grantsFlow || stage3cAttackFlow(board, card, card.zone?.split(",")[0] ?? "High", Boolean(board.currentAttackIsReversal))) return true;',
  'function attackHasFlow(board: Board, card: CardEntry, combo: ComboModifier, zone = card.zone?.split(",")[0] ?? "High", isReversal = false) {\n  if (board.nextAttackHasFlow || combo.grantsFlow || stage3cAttackFlow(board, card, zone, isReversal)) return true;',
);

replaceOnce(
  "best defense delayed status",
  'return { id, total: fighterStat(board, "DEF") + piercedArmorModifier(applyNextAttackArmorPenalty(equipmentDefenseModifier(board, zone), armorPenalty + suppression), piercing).value + cardPower(card) + (board.nextDefenseCardBonus ?? 0) + printed + modifier };',
  'return { id, total: fighterStat(board, "DEF") + piercedArmorModifier(applyNextAttackArmorPenalty(equipmentDefenseModifier(board, zone), armorPenalty + suppression), piercing).value + cardPower(card) + (board.nextDefenseCardBonus ?? 0) + stage3cDefenseStatusBonus(board, card) + printed + modifier };',
);

replaceOnce(
  "player attack delayed bonus",
  'const hasFlow = attackHasFlow(current.player, card, comboModifier);\n    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);',
  'const hasFlow = attackHasFlow(current.player, card, comboModifier, zone);\n    const stage3cAttackBonus = stage3cAttackPowerBonus(current.player, card, zone);\n    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);',
);

replaceOnce(
  "AI defense delayed guard",
  'const defensePower = Math.max(0, fighterStat(aiDefenseReaction.board, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (aiDefenseReaction.board.nextDefenseCardBonus ?? 0) + aiDefenseReaction.guard : 0) + defenseCardModifier.value + defenseModifier.value);',
  'const defensePower = Math.max(0, fighterStat(aiDefenseReaction.board, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (aiDefenseReaction.board.nextDefenseCardBonus ?? 0) + stage3cDefenseStatusBonus(aiDefenseReaction.board, defenseCard) + aiDefenseReaction.guard : 0) + defenseCardModifier.value + defenseModifier.value);',
);

replaceOnce(
  "player Attack one-shot consumption",
  'const attackState = { ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id),',
  'const attackState = { ...stage3cConsumeAttackStatuses(current.player, card, zone), hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id),',
);

// The marker above intentionally uses a syntactic fragment that changed in older
// playmat revisions. Fall back to the exact current object prefix when needed.
if (!source.includes('const attackState = { ...stage3cConsumeAttackStatuses(current.player, card, zone),')) {
  replaceOnce(
    "player Attack one-shot consumption fallback",
    'const attackState = { ...current.player, hand: removeOne(current.player.hand, card.id),',
    'const attackState = { ...stage3cConsumeAttackStatuses(current.player, card, zone), hand: removeOne(current.player.hand, card.id),',
  );
}

replaceOnce(
  "AI defense family context setup",
  'let defenseFollowupNotes: string[] = [];\n    if (defenseCard) {\n      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onPlay");',
  'let defenseFollowupNotes: string[] = [];\n    if (defenseCard) {\n      const familyDefenseContext = stage3cDefenseContext(nextAi, current.player, defenseCard, card, zone, attackPower, rawDamage, !hit);\n      nextAi = stage3cConsumeDefenseStatuses(nextAi);\n      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onPlay", familyDefenseContext);',
);

replaceOnce(
  "AI defense onBlock target semantics",
  'if (!hit) nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onBlock");\n      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve");',
  'if (!hit) {\n        nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onBlock", familyDefenseContext);\n        nextPlayer = applyStage3CTiming(nextPlayer, defenseCard, "onBlock", "player", familyDefenseContext, "opponent");\n      }\n      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve", familyDefenseContext);\n      nextPlayer = applyStage3CTiming(nextPlayer, defenseCard, "afterResolve", "player", familyDefenseContext, "opponent");',
);

replaceOnce(
  "player defense delayed guard",
  'defensePower += cardPower(defenseCard) + (nextPlayer.nextDefenseCardBonus ?? 0) + (nextPlayer.equipmentDefenseGuard ?? 0) + defenseCardModifier.value + tempoBonus + locationModifier.value;',
  'defensePower += cardPower(defenseCard) + (nextPlayer.nextDefenseCardBonus ?? 0) + stage3cDefenseStatusBonus(nextPlayer, defenseCard) + (nextPlayer.equipmentDefenseGuard ?? 0) + defenseCardModifier.value + tempoBonus + locationModifier.value;',
);

replaceOnce(
  "player defense onPlay context",
  'nextPlayer = markCompletedTask({ ...nextPlayer, hand: removeOne(nextPlayer.hand, defenseCard.id), discard: [...nextPlayer.discard, defenseCard.id], xp: nextPlayer.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, nextDefenseCardBonus: 0, tempo: tempoBonus ? false : nextPlayer.tempo });\n      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onPlay");',
  'const familyDefenseContext = stage3cDefenseContext(nextPlayer, current.ai, defenseCard, aiCard, pending.zone, pending.attackPower);\n      nextPlayer = stage3cConsumeDefenseStatuses(markCompletedTask({ ...nextPlayer, hand: removeOne(nextPlayer.hand, defenseCard.id), discard: [...nextPlayer.discard, defenseCard.id], xp: nextPlayer.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, nextDefenseCardBonus: 0, tempo: tempoBonus ? false : nextPlayer.tempo }));\n      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onPlay", familyDefenseContext);',
);

replaceOnce(
  "failed block structured prevention",
  'const rawDamage = hit ? Math.max(0, finalAttackPower - defensePower + (pending.damageModifier ?? 0)) : 0;\n    const reduced = reduceDamageForFighter(nextPlayer, rawDamage);',
  'const rawDamage = hit ? Math.max(0, finalAttackPower - defensePower + (pending.damageModifier ?? 0)) : 0;\n    const failedBlockContext = defenseCard ? stage3cDefenseContext(nextPlayer, current.ai, defenseCard, aiCard, pending.zone, finalAttackPower, rawDamage, !hit) : {};\n    const defensePrevention = hit && defenseCard ? stage3cCurrentDefensePrevention(defenseCard, failedBlockContext) : 0;\n    const reduced = reduceDamageForFighter(nextPlayer, Math.max(0, rawDamage - defensePrevention));',
);

replaceOnce(
  "player defense block timing",
  'nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onBlock");\n        blockDiscardChoice = playerDiscardChoiceCount(defenseCard, "onBlock");',
  'const familyDefenseContext = stage3cDefenseContext(nextPlayer, current.ai, defenseCard, aiCard, pending.zone, finalAttackPower, rawDamage, true);\n        nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onBlock", familyDefenseContext);\n        nextAi = applyStage3CTiming(nextAi, defenseCard, "onBlock", "ai", familyDefenseContext, "opponent");\n        blockDiscardChoice = playerDiscardChoiceCount(defenseCard, "onBlock");',
);

replaceOnce(
  "player defense afterResolve timing",
  'nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "afterResolve");',
  'const familyDefenseContext = stage3cDefenseContext(nextPlayer, current.ai, defenseCard, aiCard, pending.zone, finalAttackPower, rawDamage, !hit);\n      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "afterResolve", familyDefenseContext);\n      nextAi = applyStage3CTiming(nextAi, defenseCard, "afterResolve", "ai", familyDefenseContext, "opponent");',
);

replaceOnce(
  "AI Attack delayed bonus and flow",
  'const hasFlow = attackHasFlow(activeEquipment.board, card, comboModifier);\n  const attackPower = Math.max(0, cardPower(card) + fighterStat(activeEquipment.board, "ATK") + activeEquipment.board.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + activeEquipment.power);\n  let nextAi = applyCardEffects({ ...activeEquipment.board,',
  'const hasFlow = attackHasFlow(activeEquipment.board, card, comboModifier, zone);\n  const stage3cAttackBonus = stage3cAttackPowerBonus(activeEquipment.board, card, zone);\n  const attackPower = Math.max(0, cardPower(card) + fighterStat(activeEquipment.board, "ATK") + activeEquipment.board.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + activeEquipment.power);\n  const consumedAttackBoard = stage3cConsumeAttackStatuses(activeEquipment.board, card, zone);\n  let nextAi = applyCardEffects({ ...consumedAttackBoard,',
);

replaceOnce(
  "Reversal delayed bonus",
  'const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + (current.player.reversalAttackBonus ?? 0) + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);',
  'const stage3cReversalBonus = stage3cAttackPowerBonus(current.player, card, zone, true);\n    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cReversalBonus + (current.player.reversalAttackBonus ?? 0) + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);',
);

replaceOnce(
  "Reversal defense delayed guard",
  'const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (current.ai.nextDefenseCardBonus ?? 0) : 0) + defenseCardModifier.value + defenseModifier.value);',
  'const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (current.ai.nextDefenseCardBonus ?? 0) + stage3cDefenseStatusBonus(current.ai, defenseCard) : 0) + defenseCardModifier.value + defenseModifier.value);',
);

replaceOnce(
  "Reversal Attack status consumption",
  'let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, card.id),',
  'let nextPlayer = applyCardEffects({ ...stage3cConsumeAttackStatuses(current.player, card, zone, true), hand: removeOne(current.player.hand, card.id),',
);

replaceOnce(
  "attack restriction player",
  'if (!current) return current;\n    if (current.player.attackLockedThisTurn && current.player.attacksThisTurn > 0) return current;',
  'if (!current) return current;\n    if ((current.player.stage3cRestrictions ?? []).includes("attack")) return current;\n    if (current.player.attackLockedThisTurn && current.player.attacksThisTurn > 0) return current;',
);

replaceOnce(
  "consumable restriction player",
  'const card = cardFor(id);\n    if (!card || isAttack(card) || isDefense(card) || isPermanent(card)) return current;\n    const locationModifier = locationFocusModifier',
  'const card = cardFor(id);\n    if (!card || isAttack(card) || isDefense(card) || isPermanent(card)) return current;\n    if (isCoreConsumableCard(card) && (current.player.stage3cRestrictions ?? []).includes("consumable")) return current;\n    const locationModifier = locationFocusModifier',
);

replaceOnce(
  "next Kata Focus helper",
  'function stage3cConsumePurchase(board: Board) {\n  return expireStage3C(board, "nextPurchase");\n}',
  'function stage3cConsumePurchase(board: Board) {\n  return expireStage3C(board, "nextPurchase");\n}\n\nfunction stage3cConsumeKata(board: Board) {\n  const statuses = (board.stage3cStatuses ?? []).filter((status) => status.duration === "nextKata");\n  let next = board;\n  for (const status of statuses) if (status.effect === "core.gainFocus" || status.resolver === "consumable.nextKataFocusBonus" || status.resolver === "defense.nextKataFocus") next = gainFocus(next, status.amount);\n  const ids = new Set(statuses.map((status) => status.sourceEffectId));\n  return { ...next, stage3cStatuses: (next.stage3cStatuses ?? []).filter((status) => !ids.has(status.sourceEffectId)) };\n}',
);

replaceOnce(
  "player next Kata consumption",
  'let nextPlayer = markCompletedTask(applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id),',
  'let supportBoard = isKata(card) ? stage3cConsumeKata(current.player) : current.player;\n    let nextPlayer = markCompletedTask(applyCardEffects({ ...supportBoard, hand: removeOne(supportBoard.hand, id),',
);

replaceOnce(
  "AI next Kata consumption",
  'const locationModifier = locationFocusModifier(cardFor(current.locationId), card, nextAi);\n    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id),',
  'const locationModifier = locationFocusModifier(cardFor(current.locationId), card, nextAi);\n    if (isKata(card)) nextAi = stage3cConsumeKata(nextAi);\n    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id),',
);

replaceOnce(
  "Hide structured card triggers",
  'function playAreaCleanup(board: Board) {\n  const readyBoard = stage3cEndTurn(applyHideReady(board));',
  'function playAreaCleanup(board: Board) {\n  let hideBoard = board;\n  for (const id of board.playArea) {\n    const sourceCard = cardFor(id);\n    if (sourceCard && isCoreConsumableCard(sourceCard)) hideBoard = applyStage3CTiming(hideBoard, sourceCard, "onHide", "ai", stage3cConsumableContext(hideBoard), "self");\n  }\n  const readyBoard = stage3cEndTurn(applyHideReady(hideBoard));',
);

replaceOnce(
  "failed block prevention trigger set",
  'return defenseRuntimeCommands(defense, "afterResolve", context).filter((command) => command.effect === "combat.preventDamage" && !command.choice).reduce((total, command) => total + Math.max(0, command.amount), 0);',
  'return (["onDefenseDeclared", "afterResolve"] as RuntimeTrigger[]).flatMap((trigger) => defenseRuntimeCommands(defense, trigger, context)).filter((command) => command.effect === "combat.preventDamage" && !command.choice).reduce((total, command) => total + Math.max(0, command.amount), 0);',
);

await writeFile(path, source);
console.log("Stage 3C combat/timing integration applied.");
