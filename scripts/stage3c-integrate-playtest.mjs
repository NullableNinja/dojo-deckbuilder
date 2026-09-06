import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../app/playtest.tsx", import.meta.url);
let source = await readFile(path, "utf8");

function replaceOnce(label, before, after) {
  if (source.includes(after)) return;
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Stage 3C integration marker not found: ${label}`);
  source = `${source.slice(0, index)}${after}${source.slice(index + before.length)}`;
}

function replaceSection(label, startMarker, endMarker, replacement) {
  if (source.includes(replacement)) return;
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Stage 3C section start not found: ${label}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Stage 3C section end not found: ${label}`);
  source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

replaceOnce(
  "effect resolver lifecycle import",
  "postBlockEquipmentCycle, readyEquipmentOnHit, targetDiscardOnHitCount",
  "postBlockEquipmentCycle, readyEquipmentOnHit, returnsToSupplyAfterUse, targetDiscardOnHitCount",
);

replaceOnce(
  "family runtime imports",
  'import { finalAttackAllowedZones, finalAttackCycle, finalAttackDefensiveReactionBonus, finalAttackEquipmentSuppression, finalAttackFireDrillFeint, finalAttackFocusReward, finalAttackHitChoice, finalAttackOnlyAttackLock, finalAttackOptionalAttackCost, finalAttackPowerBonus } from "./attack-final-effects";\n',
  'import { finalAttackAllowedZones, finalAttackCycle, finalAttackDefensiveReactionBonus, finalAttackEquipmentSuppression, finalAttackFireDrillFeint, finalAttackFocusReward, finalAttackHitChoice, finalAttackOnlyAttackLock, finalAttackOptionalAttackCost, finalAttackPowerBonus } from "./attack-final-effects";\nimport { defenseRuntimeCommands, type DefenseRuntimeContext } from "./defense-effect-resolvers";\nimport { consumableRuntimeCommands, type ConsumableRuntimeContext } from "./consumable-effect-resolvers";\nimport type { RuntimeChoice, RuntimeCommand, RuntimeStatus, RuntimeTrigger } from "./family-effect-runtime";\n',
);

replaceOnce(
  "board structured runtime state",
  "  destroyed?: string[];\n};",
  "  destroyed?: string[];\n  returnedToSupply?: string[];\n  stage3cStatuses?: RuntimeStatus[];\n  stage3cChoices?: RuntimeChoice[];\n  stage3cRestrictions?: string[];\n  stage3cDefenseModifier?: number;\n  stage3cPurchaseCostModifier?: number;\n};",
);

replaceOnce(
  "structured purchase modifier",
  "  return cardCost(card) + (card.cardType === \"Item\" ? (board.nextItemCostPenalty ?? 0) : 0);",
  "  return Math.max(0, cardCost(card) + (board.stage3cPurchaseCostModifier ?? 0) + (card.cardType === \"Item\" ? (board.nextItemCostPenalty ?? 0) : 0));",
);

replaceOnce(
  "structured DEF stat",
  "  return base + beltBonus + equipment + challengeBonus + (stat === \"Speed\" ? board.tempSpeed : 0);",
  "  return base + beltBonus + equipment + challengeBonus + (stat === \"Speed\" ? board.tempSpeed : 0) + (stat === \"DEF\" ? (board.stage3cDefenseModifier ?? 0) : 0);",
);

const helpers = `
function isCoreDefenseCard(card: CardEntry) { return card.catalogId.startsWith("DDB-DEF-CORE-"); }
function isCoreConsumableCard(card: CardEntry) { return card.catalogId.startsWith("DDB-CON-CORE-"); }

function stage3cConsumableContext(board: Board): ConsumableRuntimeContext {
  return {
    hasTempo: board.tempo,
    hpThresholdMet: board.hp <= Math.ceil(board.maxHp / 2),
    handEmptyAfterHeal: board.hand.length === 0,
    normalAttacksResolvedThisTurn: board.attacksThisTurn,
    temporaryNegativeModifierPresent: board.tempSpeed < 0 || board.nextAttackBonus < 0 || (board.nextDefenseCardBonus ?? 0) < 0,
    removedTemporaryNegativeModifier: false,
    sameTurnSourceActive: true,
  };
}

function stage3cDefenseContext(defender: Board, attacker: Board, defense: CardEntry, incomingAttack: CardEntry, zone: string, attackPower?: number, incomingDamage?: number, blockSucceeded?: boolean): DefenseRuntimeContext {
  const matchingArmor = equipmentDefenseModifier(defender, zone).value > 0;
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
      const standingDefense = command.effect === "combat.modifyDefense" && ["endOfTurn", "endOfRound", "nextHonor", "nextTurn"].includes(command.duration);
      const standingCost = command.effect === "economy.modifyCost" && ["endOfTurn", "nextTurn", "nextPurchase"].includes(command.duration);
      if (standingSpeed) next = { ...next, tempSpeed: next.tempSpeed + command.amount, speedChangedThisRound: next.speedChangedThisRound || command.amount !== 0 };
      if (standingDefense) next = { ...next, stage3cDefenseModifier: (next.stage3cDefenseModifier ?? 0) + command.amount };
      if (standingCost) next = { ...next, stage3cPurchaseCostModifier: (next.stage3cPurchaseCostModifier ?? 0) + command.amount };
      if (command.effect === "core.gainFocus" && command.qualifier?.spendOnlyOn) next = gainFocus(next, command.amount);
      next = addStage3CStatus(next, command, standingSpeed || standingDefense || standingCost);
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
    else if (command.effect === "core.heal") next = { ...next, hp: Math.min(next.maxHp, next.hp + Math.max(0, command.amount)) };
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
    else if (command.effect === "core.custom" && command.resolver) next = { ...next, stage3cRestrictions: [...new Set([...(next.stage3cRestrictions ?? []), command.resolver])] };
  }
  return next;
}

function applyStage3CTiming(board: Board, card: CardEntry, trigger: RuntimeTrigger, controller: "player" | "ai", context: DefenseRuntimeContext | ConsumableRuntimeContext = {}, target: "self" | "opponent" = "self") {
  const commands = stage3cCommands(card, trigger, context).filter((command) => (command.target ?? "self") === target);
  return applyStage3CCommands(board, commands.map((command) => ({ ...command, target: "self" })), controller);
}

function expireStage3C(board: Board, duration: string) {
  let next = board;
  const expiring = (next.stage3cStatuses ?? []).filter((status) => status.duration === duration);
  for (const status of expiring) {
    if (!status.appliedImmediately) continue;
    if (status.effect === "combat.modifySpeed") next = { ...next, tempSpeed: next.tempSpeed - status.amount };
    if (status.effect === "combat.modifyDefense") next = { ...next, stage3cDefenseModifier: (next.stage3cDefenseModifier ?? 0) - status.amount };
    if (status.effect === "economy.modifyCost") next = { ...next, stage3cPurchaseCostModifier: (next.stage3cPurchaseCostModifier ?? 0) - status.amount };
  }
  const ids = new Set(expiring.map((status) => status.sourceEffectId));
  next = { ...next, stage3cStatuses: (next.stage3cStatuses ?? []).filter((status) => !ids.has(status.sourceEffectId)) };
  const activeRestrictions = new Set((next.stage3cStatuses ?? []).map((status) => String(status.qualifier?.restriction ?? "")).filter(Boolean));
  next.stage3cRestrictions = (next.stage3cRestrictions ?? []).filter((restriction) => activeRestrictions.has(restriction) || restriction.includes("."));
  return next;
}

function stage3cStartTurn(board: Board) {
  let next = expireStage3C(board, "nextTurn");
  const initiate = (next.stage3cStatuses ?? []).filter((status) => status.duration === "nextInitiate");
  for (const status of initiate) if (status.effect === "core.gainFocus") next = gainFocus(next, status.amount);
  const ids = new Set(initiate.map((status) => status.sourceEffectId));
  return { ...next, stage3cStatuses: (next.stage3cStatuses ?? []).filter((status) => !ids.has(status.sourceEffectId)) };
}

function stage3cEndTurn(board: Board) {
  return expireStage3C(board, "endOfTurn");
}

function stage3cAdvanceRound(board: Board) {
  let next = expireStage3C(expireStage3C(board, "endOfRound"), "nextHonor");
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
  if (status.qualifier?.nextReversal && !isReversal) return false;
  return true;
}

function stage3cAttackPowerBonus(board: Board, card: CardEntry, zone: string, isReversal = false) {
  return (board.stage3cStatuses ?? []).filter((status) => stage3cAttackStatusMatches(status, card, zone, isReversal) && status.effect === "combat.modifyAttackPower").reduce((total, status) => total + status.amount, 0);
}

function stage3cAttackFlow(board: Board, card: CardEntry, zone: string, isReversal = false) {
  return (board.stage3cStatuses ?? []).some((status) => stage3cAttackStatusMatches(status, card, zone, isReversal) && status.effect === "combat.grantFlow");
}

function stage3cConsumeAttackStatuses(board: Board, card: CardEntry, zone: string, isReversal = false) {
  const consumed = new Set((board.stage3cStatuses ?? []).filter((status) => stage3cAttackStatusMatches(status, card, zone, isReversal)).map((status) => status.sourceEffectId));
  const alsoExpiresOnAttack = new Set((board.stage3cStatuses ?? []).filter((status) => status.qualifier?.expiresOnAttack).map((status) => status.sourceEffectId));
  return { ...board, stage3cStatuses: (board.stage3cStatuses ?? []).filter((status) => !consumed.has(status.sourceEffectId) && !alsoExpiresOnAttack.has(status.sourceEffectId)) };
}

function stage3cDefenseStatusBonus(board: Board, defense: CardEntry | null | undefined) {
  if (!defense) return 0;
  return (board.stage3cStatuses ?? []).filter((status) => status.duration === "nextDefense" && status.effect === "combat.modifyGuard").reduce((total, status) => total + status.amount, 0)
    + (board.stage3cStatuses ?? []).filter((status) => status.duration === "nextIncomingAttack" && status.effect === "combat.modifyDefense").reduce((total, status) => total + status.amount, 0);
}

function stage3cConsumeDefenseStatuses(board: Board) {
  return { ...board, stage3cStatuses: (board.stage3cStatuses ?? []).filter((status) => status.duration !== "nextDefense" && status.duration !== "nextIncomingAttack") };
}

function stage3cTakeDamagePrevention(board: Board, damage: number) {
  const statuses = (board.stage3cStatuses ?? []).filter((status) => status.duration === "nextDamage" && status.effect === "combat.preventDamage");
  if (!statuses.length || damage <= 0) return { board, damage, notes: [] as string[] };
  const prevention = statuses.reduce((total, status) => total + Math.max(0, status.amount), 0);
  const ids = new Set(statuses.map((status) => status.sourceEffectId));
  return {
    board: { ...board, stage3cStatuses: (board.stage3cStatuses ?? []).filter((status) => !ids.has(status.sourceEffectId)) },
    damage: Math.max(0, damage - prevention),
    notes: ["Structured prevention reduces damage by " + prevention],
  };
}

function stage3cCurrentDefensePrevention(defense: CardEntry | null | undefined, context: DefenseRuntimeContext) {
  if (!defense || !isCoreDefenseCard(defense)) return 0;
  return defenseRuntimeCommands(defense, "afterResolve", context).filter((command) => command.effect === "combat.preventDamage" && !command.choice).reduce((total, command) => total + Math.max(0, command.amount), 0);
}

function stage3cConsumePurchase(board: Board) {
  return expireStage3C(board, "nextPurchase");
}

function returnResolvedConsumable(board: Board, card: CardEntry) {
  if (!returnsToSupplyAfterUse(card)) return board;
  return { ...board, playArea: removeOne(board.playArea, card.id), returnedToSupply: [...(board.returnedToSupply ?? []), card.id] };
}
`;

replaceOnce(
  "stage3c helper insertion",
  "\n\nfunction cardMatchesDeckFilter(card: CardEntry | undefined, filter: \"defense-or-kata\" | \"technique\" | \"item\") {",
  `${helpers}\nfunction cardMatchesDeckFilter(card: CardEntry | undefined, filter: "defense-or-kata" | "technique" | "item") {`,
);

replaceSection(
  "initiate structured expiry",
  "function applyInitiateCarryover(board: Board) {",
  "\n\nfunction equipmentActivationAvailable",
  `function applyInitiateCarryover(board: Board) {
  const stage3cBoard = stage3cStartTurn(board);
  const ready = new Set(stage3cBoard.readyAtInitiate ?? []);
  const carryover = stage3cBoard.nextInitiateFocus ?? 0;
  const reset = { ...stage3cBoard, focusGeneratedThisTurn: 0, focusSpentThisTurn: 0, nextInitiateFocus: 0, exhaustedEquipment: (stage3cBoard.exhaustedEquipment ?? []).filter((id) => !ready.has(id)), readyAtInitiate: [] };
  return gainFocus(reset, carryover);
}`,
);

replaceSection(
  "damage prevention hook",
  "function reduceDamageForFighter(board: Board, damage: number): { board: Board; damage: number; note: string | null } {",
  "\n\nfunction drawCards",
  `function reduceDamageForFighter(board: Board, damage: number): { board: Board; damage: number; note: string | null } {
  const structuredReduction = stage3cTakeDamagePrevention(board, damage);
  const equipmentReduction = applyMandatoryEquipmentDamageReduction(structuredReduction.board, structuredReduction.damage);
  let next = equipmentReduction.board;
  let remaining = equipmentReduction.damage;
  const notes = [...structuredReduction.notes, ...equipmentReduction.notes];
  const fighter = cardFor(next.fighterId);
  if (fighter && !next.damageReductionUsed && remaining > 0) {
    const protects = fighter.name === "Sentry Bobby" || (fighter.name === "Crash Test Dummy" && remaining >= 4);
    if (protects) {
      next = { ...next, damageReductionUsed: true };
      remaining = Math.max(0, remaining - 1);
      notes.push(\`\${fighter.name} reduces the Hit by 1\`);
    }
  }
  return { board: next, damage: remaining, note: notes.length ? notes.join("; ") : null };
}`,
);

replaceSection(
  "structured applyCardEffects",
  "function applyCardEffects(board: Board, card: CardEntry, owner: \"player\" | \"ai\", timing: \"onPlay\" | \"onHit\" | \"onBlock\" | \"afterResolve\" = \"onPlay\") {",
  "\n\nfunction attackHasFlow",
  `function applyCardEffects(board: Board, card: CardEntry, owner: "player" | "ai", timing: "onPlay" | "onHit" | "onBlock" | "afterResolve" = "onPlay", familyContext: DefenseRuntimeContext | ConsumableRuntimeContext = {}) {
  let next = { ...board };
  const migratedFamily = isCoreDefenseCard(card) || isCoreConsumableCard(card);
  if (timing === "onPlay") {
    next = gainFocus(next, numberValue(card.focusValue));
    if (card.subtype === "Consumable") next = { ...next, usedConsumableThisRound: true };
    if (isPermanent(card)) {
      next.equipment = [...next.equipment, card.id];
      if (equipmentSpeedModifier(card)) next.speedChangedThisRound = true;
    }
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
      if (effect.kind === "heal") next.hp = Math.min(next.maxHp, next.hp + effect.amount);
    }
  }
  if (timing === "onPlay") {
    const conditionalHeal = conditionalHealAfterHit(card, board.wasHitSinceLastTurn);
    if (conditionalHeal) next.hp = Math.min(next.maxHp, next.hp + conditionalHeal);
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
  const text = card.rulesText ?? "";
  if (timing === "onPlay" && /After your first Attack resolves[^.]*next Attack gains Flow/i.test(text) && board.attacksThisTurn === 0) {
    next.flowAfterFirstAttack = true;
  } else if (timing === "onPlay" && /(?:^|[.!?]\\s+)(?:Your|The) next [^.]*Attack[^.]*gains Flow/i.test(text)) {
    next.nextAttackHasFlow = true;
  } else if (timing === "onPlay" && card.name === "Second Wind Form" && board.hp > board.maxHp / 2) {
    next.nextAttackHasFlow = true;
  } else if (timing === "onHit" && /(?:On Hit|If (?:this Attack|it|that Attack) Hits?)[^.]*next [^.]*Attack[^.]*gains Flow/i.test(text)) {
    next.nextAttackHasFlow = true;
  } else if (timing === "afterResolve" && /After (?:this|it|that) Attack resolves[^.]*next [^.]*Attack[^.]*gains Flow/i.test(text)) {
    next.nextAttackHasFlow = true;
  }
  return next;
}`,
);

replaceOnce(
  "attack flow structured status",
  "function attackHasFlow(board: Board, card: CardEntry, combo: ComboModifier) {\n  if (board.nextAttackHasFlow || combo.grantsFlow) return true;",
  "function attackHasFlow(board: Board, card: CardEntry, combo: ComboModifier) {\n  if (board.nextAttackHasFlow || combo.grantsFlow || stage3cAttackFlow(board, card, card.zone?.split(\",\")[0] ?? \"High\", Boolean(board.currentAttackIsReversal))) return true;",
);

replaceSection(
  "structured defense context",
  "function defenseCardRuleModifier(defender: Board, attacker: Board, defense: CardEntry, incomingAttack: CardEntry): CombatModifier {",
  "\n\nfunction fighterAttackModifier",
  `function defenseCardRuleModifier(defender: Board, attacker: Board, defense: CardEntry, incomingAttack: CardEntry, incomingAttackPower?: number, incomingZone?: string): CombatModifier {
  const zone = incomingZone ?? incomingAttack.zone?.split(",")[0] ?? "High";
  const context = stage3cDefenseContext(defender, attacker, defense, incomingAttack, zone, incomingAttackPower);
  const parsed = conditionalDefenseGuardBonus(defense, context);
  return { value: parsed.amount, notes: parsed.notes };
}`,
);

replaceSection(
  "consumable source lifecycle",
  "function destroyResolvedConsumable(board: Board, card: CardEntry) {",
  "\n\nfunction emptyBoard",
  `function destroyResolvedConsumable(board: Board, card: CardEntry) {
  if (!destroysAfterUse(card)) return board;
  return {
    ...board,
    playArea: removeOne(board.playArea, card.id),
    destroyed: [...(board.destroyed ?? []), card.id],
  };
}`,
);

replaceOnce(
  "board runtime initialization",
  "    damageDealt: 0, damageTaken: 0, cardsBought: 0, destroyed: [],",
  "    damageDealt: 0, damageTaken: 0, cardsBought: 0, destroyed: [], returnedToSupply: [], stage3cStatuses: [], stage3cChoices: [], stage3cRestrictions: [], stage3cDefenseModifier: 0, stage3cPurchaseCostModifier: 0,",
);

replaceOnce(
  "human consumable afterResolve",
  "    let nextPlayer = markCompletedTask(applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id], focus: current.player.focus + locationModifier.value, lastAttackHit: false }, card, \"player\"));",
  "    let nextPlayer = markCompletedTask(applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id], focus: current.player.focus + locationModifier.value, lastAttackHit: false }, card, \"player\", \"onPlay\", isCoreConsumableCard(card) ? stage3cConsumableContext(current.player) : {}));\n    if (isCoreConsumableCard(card)) nextPlayer = applyCardEffects(nextPlayer, card, \"player\", \"afterResolve\", stage3cConsumableContext(nextPlayer));",
);

replaceOnce(
  "human consumable lifecycle",
  "    const destroyedAfterUse = destroysAfterUse(card);\n    if (destroyedAfterUse) nextPlayer = destroyResolvedConsumable(nextPlayer, card);",
  "    const destroyedAfterUse = destroysAfterUse(card);\n    const returnedAfterUse = returnsToSupplyAfterUse(card);\n    if (destroyedAfterUse) nextPlayer = destroyResolvedConsumable(nextPlayer, card);\n    else if (returnedAfterUse) nextPlayer = returnResolvedConsumable(nextPlayer, card);",
);

replaceOnce(
  "human consumable opponent effects",
  "    const defensePenalty = targetNextDefensePenalty(card);\n    const nextAi = defensePenalty ? { ...current.ai, nextDefenseCardBonus: (current.ai.nextDefenseCardBonus ?? 0) - defensePenalty } : current.ai;",
  "    let nextAi = current.ai;\n    if (isCoreConsumableCard(card)) {\n      nextAi = applyStage3CTiming(nextAi, card, \"onPlay\", \"ai\", stage3cConsumableContext(nextPlayer), \"opponent\");\n      nextAi = applyStage3CTiming(nextAi, card, \"afterResolve\", \"ai\", stage3cConsumableContext(nextPlayer), \"opponent\");\n    } else {\n      const defensePenalty = targetNextDefensePenalty(card);\n      if (defensePenalty) nextAi = { ...nextAi, nextDefenseCardBonus: (nextAi.nextDefenseCardBonus ?? 0) - defensePenalty };\n    }",
);

replaceOnce(
  "ai consumable structured timing",
  "    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], focus: nextAi.focus + locationModifier.value, lastAttackHit: false }, card, \"ai\");\n    const aiFastestFocus",
  "    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], focus: nextAi.focus + locationModifier.value, lastAttackHit: false }, card, \"ai\", \"onPlay\", isCoreConsumableCard(card) ? stage3cConsumableContext(nextAi) : {});\n    if (isCoreConsumableCard(card)) {\n      nextAi = applyCardEffects(nextAi, card, \"ai\", \"afterResolve\", stage3cConsumableContext(nextAi));\n      nextPlayer = applyStage3CTiming(nextPlayer, card, \"onPlay\", \"player\", stage3cConsumableContext(nextAi), \"opponent\");\n      nextPlayer = applyStage3CTiming(nextPlayer, card, \"afterResolve\", \"player\", stage3cConsumableContext(nextAi), \"opponent\");\n    }\n    const aiFastestFocus",
);

replaceOnce(
  "ai consumable lifecycle",
  "    if (destroysAfterUse(card)) nextAi = destroyResolvedConsumable(nextAi, card);\n    const defensePenalty = targetNextDefensePenalty(card);\n    if (defensePenalty) nextPlayer = { ...nextPlayer, nextDefenseCardBonus: (nextPlayer.nextDefenseCardBonus ?? 0) - defensePenalty };",
  "    if (destroysAfterUse(card)) nextAi = destroyResolvedConsumable(nextAi, card);\n    else if (returnsToSupplyAfterUse(card)) nextAi = returnResolvedConsumable(nextAi, card);\n    if (!isCoreConsumableCard(card)) {\n      const defensePenalty = targetNextDefensePenalty(card);\n      if (defensePenalty) nextPlayer = { ...nextPlayer, nextDefenseCardBonus: (nextPlayer.nextDefenseCardBonus ?? 0) - defensePenalty };\n    }",
);

replaceOnce(
  "hide structured expiry",
  "function playAreaCleanup(board: Board) {\n  const readyBoard = applyHideReady(board);",
  "function playAreaCleanup(board: Board) {\n  const readyBoard = stage3cEndTurn(applyHideReady(board));",
);

replaceOnce(
  "purchase status consumption",
  "    nextPlayer = markCompletedTask({ ...nextPlayer, discard: [...nextPlayer.discard, id], purchasedTypes: [...nextPlayer.purchasedTypes, card.cardType], cardsBought: nextPlayer.cardsBought + 1, boughtCardThisAscend: true, nextItemCostPenalty: card.cardType === \"Item\" ? 0 : nextPlayer.nextItemCostPenalty });",
  "    nextPlayer = stage3cConsumePurchase(markCompletedTask({ ...nextPlayer, discard: [...nextPlayer.discard, id], purchasedTypes: [...nextPlayer.purchasedTypes, card.cardType], cardsBought: nextPlayer.cardsBought + 1, boughtCardThisAscend: true, nextItemCostPenalty: card.cardType === \"Item\" ? 0 : nextPlayer.nextItemCostPenalty }));",
);

replaceOnce(
  "ai structured purchase price",
  "  const aiPurchase = current.market.filter((id) => numberValue(cardFor(id)?.fpCost) <= current.ai.focus).sort((left, right) => aiMarketScore(cardFor(right)!, current.ai) - aiMarketScore(cardFor(left)!, current.ai))[0];",
  "  const aiPurchase = current.market.filter((id) => marketPriceFor(current.ai, cardFor(id)) <= current.ai.focus).sort((left, right) => aiMarketScore(cardFor(right)!, current.ai) - aiMarketScore(cardFor(left)!, current.ai))[0];",
);

replaceOnce(
  "ai purchase status consumption",
  "  let aiAfterPurchase = purchasedCard ? markCompletedTask({ ...current.ai, focus: current.ai.focus - numberValue(purchasedCard.fpCost), discard: [...current.ai.discard, purchasedCard.id], purchasedTypes: [...current.ai.purchasedTypes, purchasedCard.cardType], cardsBought: current.ai.cardsBought + 1 }) : current.ai;",
  "  let aiAfterPurchase = purchasedCard ? stage3cConsumePurchase(markCompletedTask({ ...current.ai, focus: current.ai.focus - marketPriceFor(current.ai, purchasedCard), discard: [...current.ai.discard, purchasedCard.id], purchasedTypes: [...current.ai.purchasedTypes, purchasedCard.cardType], cardsBought: current.ai.cardsBought + 1 })) : current.ai;",
);

replaceOnce(
  "round structured activation player",
  "  const player = { ...current.player, xp: current.player.xp + 1, tempo: true, tempSpeed: 0, speedChangedThisRound: false,",
  "  const player = stage3cAdvanceRound({ ...current.player, xp: current.player.xp + 1, tempo: true, tempSpeed: 0, speedChangedThisRound: false,",
);
replaceOnce(
  "round structured activation player close",
  "reversalUsedRound: false, triggeredCombos: [] };\n  const ai = { ...current.ai, xp:",
  "reversalUsedRound: false, triggeredCombos: [] });\n  const ai = stage3cAdvanceRound({ ...current.ai, xp:",
);
replaceOnce(
  "round structured activation ai close",
  "reversalUsedRound: false, triggeredCombos: [] };\n  const marketState = current.marketPurchasedThisRound",
  "reversalUsedRound: false, triggeredCombos: [] });\n  const marketState = current.marketPurchasedThisRound",
);

await writeFile(path, source);
console.log("Stage 3C playtest semantic integration applied.");
