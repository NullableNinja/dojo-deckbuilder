import { readFile, writeFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const write = (path, content) => writeFile(path, content, "utf8");

function replaceCount(source, before, after, expected, label) {
  const count = source.split(before).length - 1;
  if (count !== expected) throw new Error(`${label}: expected ${expected} match(es), found ${count}`);
  return source.split(before).join(after);
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: start marker missing`);
  if (source.indexOf(startMarker, start + startMarker.length) >= 0) throw new Error(`${label}: start marker ambiguous`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${label}: end marker missing`);
  return source.slice(0, start) + replacement + source.slice(end);
}

const cards = JSON.parse(await read("content/cards.json"));
const byCatalogId = new Map((cards.cards ?? []).map((card) => [card.catalogId, card]));
const expectedRules = {
  "DDB-ATK-CORE-004": "If the defender plays a Defense card, this Attack gets +1 Attack Power after Defense is built.",
  "DDB-ATK-CORE-006": "If you played a Defense since your last turn, this Attack gets +1 Attack Power.",
  "DDB-ATK-CORE-011": "If you Blocked since your last turn, this Attack gets +1 Attack Power.",
  "DDB-ATK-CORE-014": "If you Blocked an Attack this round, this Attack gets +2 Attack Power.",
  "DDB-ATK-CORE-024": "Choose its zone when declared. If you played a Jump or Spin Attack earlier this turn, draw 1 card after this resolves.",
  "DDB-ATK-CORE-026": "On Hit, the target's matching Armor provides 1 less DEF against your next Attack this turn.",
  "DDB-ATK-CORE-030": "If your previous Attack this turn was Blocked, this Attack gets +2 Attack Power.",
  "DDB-ATK-CORE-039": "If the defender plays no Defense card, this Attack gets +2 Attack Power.",
  "DDB-ATK-CORE-041": "On Hit, gain 1 Focus. Once per turn.",
  "DDB-ATK-CORE-043": "If the card you played immediately before this was a Kata or Item, this Attack gets +1 Attack Power. If it Hits after you played an Item, the target gets −1 Speed until the next Honor Phase.",
  "DDB-ATK-CORE-055": "If your previous Attack this turn Hit, draw 1 card, then discard 1 card after this resolves.",
};
for (const [catalogId, expected] of Object.entries(expectedRules)) {
  const card = byCatalogId.get(catalogId);
  if (!card) throw new Error(`Canonical card ${catalogId} is missing`);
  if (String(card.rulesText ?? "").trim() !== expected) {
    throw new Error(`${catalogId} canonical rules text changed; expected '${expected}' but found '${card.rulesText ?? ""}'`);
  }
}

const registryPath = "content/card-effects.json";
const registry = JSON.parse(await read(registryPath));
const additions = {
  "DDB-ATK-CORE-004": {
    name: "Axe Kick",
    effects: [{
      id: "attack-axe-kick-defense-card-power",
      trigger: "onDefenseDeclared",
      action: "modifyAttackPower",
      target: "source",
      amount: 1,
      duration: "immediate",
      conditions: [{ kind: "defenderPlayedDefense", operator: "eq", value: true }],
      resolver: "attack.afterDefensePower",
    }],
  },
  "DDB-ATK-CORE-006": {
    name: "Backfist",
    effects: [{
      id: "attack-backfist-defense-memory-power",
      trigger: "onAttackDeclared",
      action: "modifyAttackPower",
      target: "source",
      amount: 1,
      duration: "immediate",
      conditions: [{ kind: "playedDefenseSinceLastTurn", operator: "eq", value: true }],
      resolver: "attack.conditionalPower",
    }],
  },
  "DDB-ATK-CORE-011": {
    name: "Courtesy-Counter Knee",
    effects: [{
      id: "attack-courtesy-counter-block-memory-power",
      trigger: "onAttackDeclared",
      action: "modifyAttackPower",
      target: "source",
      amount: 1,
      duration: "immediate",
      conditions: [{ kind: "blockedSinceLastTurn", operator: "eq", value: true }],
      resolver: "attack.conditionalPower",
    }],
  },
  "DDB-ATK-CORE-014": {
    name: "Defensive Side Kick",
    effects: [{
      id: "attack-defensive-side-block-round-power",
      trigger: "onAttackDeclared",
      action: "modifyAttackPower",
      target: "source",
      amount: 2,
      duration: "immediate",
      conditions: [{ kind: "blockedThisRound", operator: "eq", value: true }],
      resolver: "attack.conditionalPower",
    }],
  },
  "DDB-ATK-CORE-024": {
    name: "Flying Spin Crescent Kick",
    effects: [{
      id: "attack-flying-spin-cycle-draw",
      trigger: "afterResolve",
      action: "draw",
      target: "self",
      amount: 1,
      duration: "immediate",
      conditions: [{ kind: "priorJumpOrSpinAttack", operator: "eq", value: true }],
      resolver: "attack.conditionalCycle",
    }],
  },
  "DDB-ATK-CORE-026": {
    name: "Front Ridgehand",
    effects: [{
      id: "attack-front-ridgehand-next-armor-penalty",
      trigger: "onHit",
      action: "modifyGuard",
      target: "opponent",
      amount: -1,
      duration: "nextAttack",
      resolver: "attack.nextAttackArmorPenalty",
    }],
  },
  "DDB-ATK-CORE-030": {
    name: "Hook Punch",
    effects: [{
      id: "attack-hook-punch-previous-block-power",
      trigger: "onAttackDeclared",
      action: "modifyAttackPower",
      target: "source",
      amount: 2,
      duration: "immediate",
      conditions: [{ kind: "previousAttackBlocked", operator: "eq", value: true }],
      resolver: "attack.conditionalPower",
    }],
  },
  "DDB-ATK-CORE-039": {
    name: "Overhand Right",
    effects: [{
      id: "attack-overhand-right-no-defense-power",
      trigger: "onDefenseDeclared",
      action: "modifyAttackPower",
      target: "source",
      amount: 2,
      duration: "immediate",
      conditions: [{ kind: "defenderPlayedDefense", operator: "eq", value: false }],
      resolver: "attack.afterDefensePower",
    }],
  },
  "DDB-ATK-CORE-041": {
    name: "Palm Heel Strike",
    effects: [{
      id: "attack-palm-heel-once-hit-focus",
      trigger: "onHit",
      action: "gainFocus",
      target: "self",
      amount: 1,
      duration: "immediate",
      conditions: [{ kind: "oncePerTurn", operator: "eq", value: true }],
      resolver: "attack.conditionalFocus",
    }],
  },
  "DDB-ATK-CORE-043": {
    name: "Punch-Clock Uppercut",
    effects: [
      {
        id: "attack-punch-clock-previous-kata-item-power",
        trigger: "onAttackDeclared",
        action: "modifyAttackPower",
        target: "source",
        amount: 1,
        duration: "immediate",
        conditions: [{ kind: "previousCardIsKataOrItem", operator: "eq", value: true }],
        resolver: "attack.conditionalPower",
      },
      {
        id: "attack-punch-clock-item-hit-speed",
        trigger: "onHit",
        action: "modifySpeed",
        target: "opponent",
        amount: -1,
        duration: "nextHonor",
        conditions: [{ kind: "previousCardIsItem", operator: "eq", value: true }],
        resolver: "attack.targetSpeedPenaltyUntilHonor",
      },
    ],
  },
  "DDB-ATK-CORE-055": {
    name: "Spinning Elbow",
    effects: [
      {
        id: "attack-spinning-elbow-cycle-draw",
        trigger: "afterResolve",
        action: "draw",
        target: "self",
        amount: 1,
        duration: "immediate",
        conditions: [{ kind: "previousAttackHit", operator: "eq", value: true }],
        resolver: "attack.conditionalCycle",
      },
      {
        id: "attack-spinning-elbow-cycle-discard",
        trigger: "afterResolve",
        action: "discard",
        target: "self",
        amount: 1,
        duration: "immediate",
        conditions: [{ kind: "previousAttackHit", operator: "eq", value: true }],
        resolver: "attack.conditionalCycle",
      },
    ],
  },
};
for (const [catalogId, entry] of Object.entries(additions)) {
  if (registry.cards[catalogId]) throw new Error(`${catalogId} is already structured`);
  registry.cards[catalogId] = entry;
}
registry.cards = Object.fromEntries(Object.entries(registry.cards).sort(([left], [right]) => left.localeCompare(right)));
await write(registryPath, JSON.stringify(registry, null, 2) + "\n");

let cardEffects = await read("app/card-effects.ts");
cardEffects = replaceCount(
  cardEffects,
  '  "attack.grantNextAttackAnyZone",\n]);',
  '  "attack.grantNextAttackAnyZone",\n  "attack.afterDefensePower",\n  "attack.conditionalCycle",\n  "attack.nextAttackArmorPenalty",\n]);',
  1,
  "dedicated Attack resolver whitelist",
);
await write("app/card-effects.ts", cardEffects);

let resolvers = await read("app/effect-resolvers.ts");
resolvers = replaceCount(
  resolvers,
  'type RegistryEffect = {\n  trigger?: string;',
  'type RegistryEffect = {\n  id?: string;\n  trigger?: string;',
  1,
  "RegistryEffect id",
);
resolvers = replaceSection(
  resolvers,
  'export function targetSpeedPenaltyUntilHonor(',
  'export function destroysAfterUse(',
  `export function targetSpeedPenaltyUntilHonor(card: EffectCardLike, context: { previousCardIsItem?: boolean } = {}) {\n  const entry = structuredEntry(card);\n  if (entry) {\n    const values = { previousCardIsItem: Boolean(context.previousCardIsItem) };\n    return structuredResolvers(card, "attack.targetSpeedPenaltyUntilHonor")\n      .filter((effect) => structuredConditionsMatch(effect, values))\n      .reduce((total, effect) => total + Math.abs(Number(effect.amount ?? 0)), 0);\n  }\n  const text = normalizedMinus(String(card.rulesText ?? ""));\n  const match = text.match(/(?:target(?:[’']s active Character)?|opponent) gets? -(\\d+) Speed until (?:the )?next Honor Phase/i);\n  return match ? Number(match[1]) : 0;\n}\n\n`,
  "conditional target Speed penalty",
);
resolvers = replaceSection(
  resolvers,
  'export function structuredConditionalFocus(',
  'export function structuredNextAttackAnyZone(',
  `export function structuredConditionalFocus(card: EffectCardLike, context: {\n  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";\n  attackNumber: number;\n  usedEffectIds?: string[];\n}) {\n  const effects = structuredResolvers(card, "attack.conditionalFocus");\n  if (!effects.length) return { handled: false, amount: 0 };\n  const values = { firstAttackThisTurn: context.attackNumber === 1, attackNumber: context.attackNumber, oncePerTurn: true };\n  const used = new Set(context.usedEffectIds ?? []);\n  const consumed: string[] = [];\n  const matched = effects.filter((effect) => {\n    if (effect.trigger !== context.timing || !structuredConditionsMatch(effect, values)) return false;\n    const oncePerTurn = (effect.conditions ?? []).some((condition) => condition.kind === "oncePerTurn" && condition.value === true);\n    if (oncePerTurn && effect.id && used.has(effect.id)) return false;\n    if (oncePerTurn && effect.id) consumed.push(effect.id);\n    return true;\n  });\n  const result = {\n    handled: true,\n    amount: matched.reduce((total, effect) => total + Number(effect.amount ?? 0), 0),\n  };\n  return consumed.length ? { ...result, effectIds: consumed } : result;\n}\n\nexport function structuredConditionalCycle(card: EffectCardLike, context: {\n  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";\n  firstAttackThisTurn?: boolean;\n  priorJumpOrSpinAttack?: boolean;\n  previousAttackHit?: boolean;\n  differentZoneFromPreviousAttack?: boolean;\n}) {\n  const effects = structuredResolvers(card, "attack.conditionalCycle");\n  if (!effects.length) return { handled: false, draw: 0, discard: 0 };\n  const values = {\n    firstAttackThisTurn: Boolean(context.firstAttackThisTurn),\n    priorJumpOrSpinAttack: Boolean(context.priorJumpOrSpinAttack),\n    previousAttackHit: Boolean(context.previousAttackHit),\n    differentZoneFromPreviousAttack: Boolean(context.differentZoneFromPreviousAttack),\n  };\n  let draw = 0;\n  let discard = 0;\n  for (const effect of effects) {\n    if (effect.trigger !== context.timing || !structuredConditionsMatch(effect, values)) continue;\n    if (effect.action === "draw") draw += Number(effect.amount ?? 0);\n    if (effect.action === "discard") discard += Number(effect.amount ?? 0);\n  }\n  return { handled: true, draw, discard };\n}\n\nexport function afterDefenseAttackPowerBonus(card: EffectCardLike, defenderPlayedDefense: boolean) {\n  const effects = structuredResolvers(card, "attack.afterDefensePower");\n  if (!effects.length) return { amount: 0, notes: [] as string[] };\n  const values = { defenderPlayedDefense };\n  let amount = 0;\n  const notes: string[] = [];\n  for (const effect of effects) {\n    if (effect.trigger !== "onDefenseDeclared" || !structuredConditionsMatch(effect, values)) continue;\n    const value = Number(effect.amount ?? 0);\n    amount += value;\n    notes.push(\`Defense response \${value >= 0 ? "+" : ""}\${value} Attack Power\`);\n  }\n  return { amount, notes };\n}\n\nexport function nextAttackArmorPenalty(card: EffectCardLike) {\n  return structuredResolvers(card, "attack.nextAttackArmorPenalty")\n    .reduce((total, effect) => total + Math.abs(Number(effect.amount ?? 0)), 0);\n}\n\n`,
  "conditional Focus, cycle, Defense-response, and Armor resolvers",
);
resolvers = replaceCount(
  resolvers,
  '  playedAsReversal?: boolean;\n}) {',
  '  playedAsReversal?: boolean;\n  playedDefenseSinceLastTurn?: boolean;\n  blockedSinceLastTurn?: boolean;\n  blockedThisRound?: boolean;\n  previousAttackBlocked?: boolean;\n  previousCardIsKataOrItem?: boolean;\n}) {',
  1,
  "conditional power context fields",
);
resolvers = replaceCount(
  resolvers,
  '      playedAsReversal: Boolean(context.playedAsReversal),\n    };',
  '      playedAsReversal: Boolean(context.playedAsReversal),\n      playedDefenseSinceLastTurn: Boolean(context.playedDefenseSinceLastTurn),\n      blockedSinceLastTurn: Boolean(context.blockedSinceLastTurn),\n      blockedThisRound: Boolean(context.blockedThisRound),\n      previousAttackBlocked: Boolean(context.previousAttackBlocked),\n      previousCardIsKataOrItem: Boolean(context.previousCardIsKataOrItem),\n    };',
  1,
  "conditional power state values",
);
await write("app/effect-resolvers.ts", resolvers);

let playtest = await read("app/playtest.tsx");
playtest = replaceCount(
  playtest,
  'readyEquipmentOnHit, targetDiscardOnHitCount, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor, structuredConditionalFocus, structuredCurrentAttackFlow',
  'readyEquipmentOnHit, targetDiscardOnHitCount, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor, afterDefenseAttackPowerBonus, nextAttackArmorPenalty, structuredConditionalCycle, structuredConditionalFocus, structuredCurrentAttackFlow',
  1,
  "playtest resolver imports",
);
playtest = replaceCount(
  playtest,
  '  lastAttackHit?: boolean;\n  tempSpeed: number;',
  '  lastAttackHit?: boolean;\n  playedDefenseSinceLastTurn?: boolean;\n  blockedSinceLastTurn?: boolean;\n  blockedThisRound?: boolean;\n  usedEffectIdsThisTurn?: string[];\n  nextAttackArmorPenalty?: number;\n  tempSpeed: number;',
  1,
  "Board structured Attack state",
);
playtest = replaceCount(
  playtest,
  '  blockedFocus?: number;\n  targetExhaustedAtDeclaration?: boolean;',
  '  blockedFocus?: number;\n  armorPenalty?: number;\n  conditionalCycle?: { draw: number; discard: number };\n  previousCardWasItem?: boolean;\n  targetExhaustedAtDeclaration?: boolean;',
  1,
  "PendingStrike structured Attack state",
);
playtest = replaceCount(
  playtest,
  '    playedAsReversal: isReversal,\n    hasFewerCardsThanTarget:',
  '    playedAsReversal: isReversal,\n    playedDefenseSinceLastTurn: Boolean(attacker.playedDefenseSinceLastTurn),\n    blockedSinceLastTurn: Boolean(attacker.blockedSinceLastTurn),\n    blockedThisRound: Boolean(attacker.blockedThisRound),\n    previousAttackBlocked: attacker.attacksThisTurn > 0 && !attacker.lastAttackHit,\n    previousCardIsKataOrItem: Boolean(previousCard && (isKata(previousCard) || previousCard.cardType === "Item")),\n    hasFewerCardsThanTarget:',
  1,
  "printed Attack state context",
);
playtest = replaceCount(
  playtest,
  'function attackPiercingModifier(attacker: Board, defender: Board, card: CardEntry, zone: string, comboPiercing = 0) {',
  `function structuredAttackCyclePlan(board: Board, card: CardEntry, zone: string) {\n  const priorCards = board.cardsThisTurn.map(cardFor).filter((prior): prior is CardEntry => Boolean(prior));\n  const priorAttacks = priorCards.filter(isAttack);\n  const previousZone = board.zonesPlayed.at(-1);\n  return structuredConditionalCycle(card, {\n    timing: "afterResolve",\n    firstAttackThisTurn: board.attacksThisTurn === 0,\n    priorJumpOrSpinAttack: priorAttacks.some((prior) => hasTag(prior, "Jump") || hasTag(prior, "Spin")),\n    previousAttackHit: board.attacksThisTurn > 0 && Boolean(board.lastAttackHit),\n    differentZoneFromPreviousAttack: Boolean(previousZone && previousZone.toLocaleLowerCase() !== zone.toLocaleLowerCase()),\n  });\n}\n\nfunction attackPiercingModifier(attacker: Board, defender: Board, card: CardEntry, zone: string, comboPiercing = 0) {`,
  1,
  "structured cycle context helper",
);
playtest = replaceCount(
  playtest,
  'function piercedArmorModifier(armor: CombatModifier, piercing: number): CombatModifier {\n  const ignored = Math.min(Math.max(0, piercing), Math.max(0, armor.value));\n  return { value: armor.value - ignored, notes: [...armor.notes, ...(ignored ? [`Piercing ${piercing} ignores ${ignored} Armor DEF`] : [])] };\n}\n',
  'function applyNextAttackArmorPenalty(armor: CombatModifier, penalty: number): CombatModifier {\n  const reduced = Math.min(Math.max(0, penalty), Math.max(0, armor.value));\n  return { value: armor.value - reduced, notes: [...armor.notes, ...(reduced ? [`Next-Attack Armor suppression removes ${reduced} DEF`] : [])] };\n}\n\nfunction piercedArmorModifier(armor: CombatModifier, piercing: number): CombatModifier {\n  const ignored = Math.min(Math.max(0, piercing), Math.max(0, armor.value));\n  return { value: armor.value - ignored, notes: [...armor.notes, ...(ignored ? [`Piercing ${piercing} ignores ${ignored} Armor DEF`] : [])] };\n}\n',
  1,
  "next-Attack Armor penalty helper",
);
playtest = replaceCount(
  playtest,
  'function applyTargetHitDebuffs(board: Board, card: CardEntry) {\n  const attackPenalty = targetNextAttackPenalty(card);\n  const defensePenalty = targetNextDefensePenalty(card);\n  const speedPenalty = targetSpeedPenaltyUntilHonor(card);',
  'function applyTargetHitDebuffs(board: Board, card: CardEntry, context: { previousCardIsItem?: boolean } = {}) {\n  const attackPenalty = targetNextAttackPenalty(card);\n  const defensePenalty = targetNextDefensePenalty(card);\n  const speedPenalty = targetSpeedPenaltyUntilHonor(card, context);',
  1,
  "conditional target Hit debuffs",
);
playtest = replaceCount(
  playtest,
  '  const structuredFocus = structuredConditionalFocus(card, { timing, attackNumber: board.attacksThisTurn });\n  if (structuredFocus.handled && structuredFocus.amount) next.focus += structuredFocus.amount;',
  '  const structuredFocus = structuredConditionalFocus(card, { timing, attackNumber: board.attacksThisTurn, usedEffectIds: board.usedEffectIdsThisTurn ?? [] });\n  if (structuredFocus.handled && structuredFocus.amount) next.focus += structuredFocus.amount;\n  if ("effectIds" in structuredFocus && structuredFocus.effectIds?.length) next.usedEffectIdsThisTurn = [...new Set([...(next.usedEffectIdsThisTurn ?? []), ...structuredFocus.effectIds])];',
  1,
  "once-per-turn structured Focus state",
);
playtest = replaceCount(
  playtest,
  'function bestDefense(board: Board, zone: string, attackPower = Number.POSITIVE_INFINITY, difficulty: Difficulty = "certified", location?: CardEntry, incomingAttack?: CardEntry, attacker?: Board, piercing = 0) {',
  'function bestDefense(board: Board, zone: string, attackPower = Number.POSITIVE_INFINITY, difficulty: Difficulty = "certified", location?: CardEntry, incomingAttack?: CardEntry, attacker?: Board, piercing = 0, armorPenalty = 0) {',
  1,
  "bestDefense Armor penalty argument",
);
playtest = replaceCount(
  playtest,
  'fighterStat(board, "DEF") + piercedArmorModifier(equipmentDefenseModifier(board, zone), piercing).value + cardPower(card)',
  'fighterStat(board, "DEF") + piercedArmorModifier(applyNextAttackArmorPenalty(equipmentDefenseModifier(board, zone), armorPenalty), piercing).value + cardPower(card)',
  1,
  "bestDefense Armor penalty math",
);
playtest = replaceCount(
  playtest,
  'borrowedEquipmentId: null, wasHitSinceLastTurn: false, comboAttemptedTurn: false',
  'borrowedEquipmentId: null, wasHitSinceLastTurn: false, playedDefenseSinceLastTurn: false, blockedSinceLastTurn: false, usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, comboAttemptedTurn: false',
  1,
  "Hide structured Attack state cleanup",
);
playtest = replaceCount(
  playtest,
  'damageReductionUsed: false, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: []',
  'damageReductionUsed: false, blockedThisRound: false, usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: []',
  2,
  "Honor structured Attack state reset",
);
playtest = replaceCount(
  playtest,
  'const beginYell = () => setMatch((current) => current?.phase === "player-initiate" ? write(current, "Initiate complete. Yell begins; subtlety has left the building.", { phase: "player-yell" }) : current);',
  'const beginYell = () => setMatch((current) => current?.phase === "player-initiate" ? write(current, "Initiate complete. Yell begins; subtlety has left the building.", { phase: "player-yell", player: { ...current.player, usedEffectIdsThisTurn: [] } }) : current);',
  1,
  "player turn once-per-turn reset",
);
playtest = replaceCount(
  playtest,
  '  const initiatedAi = applyInitiateCarryover(current.ai);',
  '  const initiatedAi = applyInitiateCarryover({ ...current.ai, usedEffectIdsThisTurn: [] });',
  1,
  "AI turn once-per-turn reset",
);

playtest = replaceCount(
  playtest,
  '    const zone = anyZone ? current.selectedZone : card.zone?.split(",")[0] ?? "High";\n    const tempoBonus =',
  '    const zone = anyZone ? current.selectedZone : card.zone?.split(",")[0] ?? "High";\n    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;\n    const previousCardIsItem = Boolean(previousCard && previousCard.cardType === "Item");\n    const conditionalCycle = structuredAttackCyclePlan(current.player, card, zone);\n    const tempoBonus =',
  1,
  "player Attack pre-declaration structured context",
);
playtest = replaceSection(
  playtest,
  '    const rawArmorModifier = equipmentDefenseModifier(aiIncomingReaction.board, zone);',
  '    const rawDamage = hit ?',
  `    const rawArmorModifier = equipmentDefenseModifier(aiIncomingReaction.board, zone);\n    const armorPenalty = current.player.nextAttackArmorPenalty ?? 0;\n    const penalizedArmorModifier = applyNextAttackArmorPenalty(rawArmorModifier, armorPenalty);\n    const piercingModifier = attackPiercingModifier(current.player, aiIncomingReaction.board, card, zone, comboModifier.piercing + armedEquipment.piercing);\n    const armorModifier = piercedArmorModifier(penalizedArmorModifier, piercingModifier.value);\n    const hasFlow = attackHasFlow(current.player, card, comboModifier);\n    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);\n    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);\n    const defenseId = bestDefense(aiIncomingReaction.board, zone, Math.max(0, baseAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value, armorPenalty);\n    const defenseCard = defenseId ? cardFor(defenseId) : null;\n    const postDefensePower = afterDefenseAttackPowerBonus(card, Boolean(defenseCard));\n    const attackPower = Math.max(0, baseAttackPower + postDefensePower.amount);\n    const aiDefenseReaction = defenseCard ? autoActivateAiDefenseGuardEquipment(aiIncomingReaction.board) : { board: aiIncomingReaction.board, guard: 0, notes: [] as string[] };\n    const defenseModifier = locationDefenseModifier(location, defenseCard, aiDefenseReaction.board, zone);\n    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(aiDefenseReaction.board, current.player, defenseCard, card) : { value: 0, notes: [] as string[] };\n    const defensePower = Math.max(0, fighterStat(aiDefenseReaction.board, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (aiDefenseReaction.board.nextDefenseCardBonus ?? 0) + aiDefenseReaction.guard : 0) + defenseCardModifier.value + defenseModifier.value);\n    const hit = attackPower > defensePower;\n`,
  "player Attack post-Defense power and Armor math",
);
playtest = replaceCount(
  playtest,
  'nextAttackBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false, equipmentAttackPlan: null',
  'nextAttackBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false, nextAttackArmorPenalty: 0, equipmentAttackPlan: null',
  1,
  "player next-Attack Armor consumption",
);
playtest = replaceCount(
  playtest,
  '    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card) : { board: nextAi, notes: [] as string[] };',
  '    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card, { previousCardIsItem }) : { board: nextAi, notes: [] as string[] };',
  1,
  "player conditional target Hit debuff",
);
playtest = replaceCount(
  playtest,
  '    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, nextDefenseCardBonus: 0 };',
  '    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, blockedSinceLastTurn: !hit || Boolean(nextAi.blockedSinceLastTurn), blockedThisRound: !hit || Boolean(nextAi.blockedThisRound), nextDefenseCardBonus: 0 };',
  1,
  "AI Defense memory on player Attack",
);
playtest = replaceCount(
  playtest,
  '    nextPlayer = applyCardEffects(nextPlayer, card, "player", hit ? "onHit" : "afterResolve");\n    if (hit) nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve");\n    let defenseFollowupNotes: string[] = [];',
  '    nextPlayer = applyCardEffects(nextPlayer, card, "player", hit ? "onHit" : "afterResolve");\n    if (hit) nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve");\n    const armorPenaltyGrant = hit ? nextAttackArmorPenalty(card) : 0;\n    if (armorPenaltyGrant) nextPlayer = { ...nextPlayer, nextAttackArmorPenalty: (nextPlayer.nextAttackArmorPenalty ?? 0) + armorPenaltyGrant };\n    if (conditionalCycle.draw) nextPlayer = drawCards(nextPlayer, conditionalCycle.draw);\n    const cycleDiscardCount = nextAi.hp ? Math.min(conditionalCycle.discard, nextPlayer.hand.length) : 0;\n    let defenseFollowupNotes: string[] = [];',
  1,
  "player structured post-Attack followups",
);
playtest = replaceCount(
  playtest,
  '    const pendingChoice: PendingChoice | null = readyOnHit && (nextPlayer.exhaustedEquipment ?? []).length\n      ? { kind: "ready-equipment", sourceCardId: card.id, optional: true }\n      : optionalCycle && nextPlayer.hand.length ? { kind: "discard-draw", sourceCardId: card.id, remaining: optionalCycle.discard, draw: optionalCycle.draw } : null;',
  '    const pendingChoice: PendingChoice | null = readyOnHit && (nextPlayer.exhaustedEquipment ?? []).length\n      ? { kind: "ready-equipment", sourceCardId: card.id, optional: true }\n      : cycleDiscardCount ? { kind: "discard-hand", sourceCardId: card.id, remaining: cycleDiscardCount, sourceFollowup: false }\n      : optionalCycle && nextPlayer.hand.length ? { kind: "discard-draw", sourceCardId: card.id, remaining: optionalCycle.discard, draw: optionalCycle.draw } : null;',
  1,
  "player mandatory structured cycle choice",
);
playtest = replaceCount(
  playtest,
  '...aiDefenseReaction.notes, ...piercingModifier.notes, ...armorModifier.notes, ...defenseCardModifier.notes, ...defenseModifier.notes,',
  '...aiDefenseReaction.notes, ...piercingModifier.notes, ...armorModifier.notes, ...postDefensePower.notes, ...defenseCardModifier.notes, ...defenseModifier.notes,',
  1,
  "player post-Defense Attack notes",
);
playtest = replaceCount(
  playtest,
  '${flowDraw ? " Flow draws 1 card." : ""}${pendingChoice ? " Optional discard/draw decision is waiting." : ""}',
  '${flowDraw ? " Flow draws 1 card." : ""}${conditionalCycle.draw ? ` Printed effect draws ${conditionalCycle.draw}.` : ""}${cycleDiscardCount ? ` Choose ${cycleDiscardCount} discard${cycleDiscardCount === 1 ? "" : "s"}.` : ""}${pendingChoice && !cycleDiscardCount ? " Optional discard/draw decision is waiting." : ""}',
  1,
  "player structured cycle log",
);

playtest = replaceCount(
  playtest,
  '      nextPlayer = markCompletedTask({ ...nextPlayer, hand: removeOne(nextPlayer.hand, defenseCard.id), discard: [...nextPlayer.discard, defenseCard.id], xp: nextPlayer.xp + 1, defendedThisRound: true, nextDefenseCardBonus: 0, tempo: tempoBonus ? false : nextPlayer.tempo });',
  '      nextPlayer = markCompletedTask({ ...nextPlayer, hand: removeOne(nextPlayer.hand, defenseCard.id), discard: [...nextPlayer.discard, defenseCard.id], xp: nextPlayer.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, nextDefenseCardBonus: 0, tempo: tempoBonus ? false : nextPlayer.tempo });',
  1,
  "player Defense play memory",
);
playtest = replaceCount(
  playtest,
  '    const hit = pending.attackPower > defensePower;\n    const reversalEquipmentBonus =',
  '    const postDefensePower = afterDefenseAttackPowerBonus(aiCard, Boolean(defenseCard));\n    const finalAttackPower = Math.max(0, pending.attackPower + postDefensePower.amount);\n    const hit = finalAttackPower > defensePower;\n    if (!hit && defenseCard) nextPlayer = { ...nextPlayer, blockedSinceLastTurn: true, blockedThisRound: true };\n    const reversalEquipmentBonus =',
  1,
  "AI Attack post-Defense power and player Block memory",
);
playtest = replaceCount(
  playtest,
  '    const armorModifier = piercedArmorModifier(equipmentDefenseModifier(nextPlayer, pending.zone), effectivePiercing);',
  '    const armorModifier = piercedArmorModifier(applyNextAttackArmorPenalty(equipmentDefenseModifier(nextPlayer, pending.zone), pending.armorPenalty ?? 0), effectivePiercing);',
  1,
  "AI Attack next-Attack Armor penalty",
);
playtest = replaceCount(
  playtest,
  '    const targetDebuff = hit ? applyTargetHitDebuffs(nextPlayer, aiCard) : { board: nextPlayer, notes: [] as string[] };',
  '    const targetDebuff = hit ? applyTargetHitDebuffs(nextPlayer, aiCard, { previousCardIsItem: Boolean(pending.previousCardWasItem) }) : { board: nextPlayer, notes: [] as string[] };',
  1,
  "AI conditional target Hit debuff",
);
playtest = replaceCount(
  playtest,
  '    nextAi = applyCardEffects(nextAi, aiCard, "ai", hit ? "onHit" : "afterResolve");\n    if (hit) nextAi = applyCardEffects(nextAi, aiCard, "ai", "afterResolve");\n    const aiTriggeredEquipment = autoTriggerAiAfterAttackEquipment(nextAi, nextPlayer, hit);',
  '    nextAi = applyCardEffects(nextAi, aiCard, "ai", hit ? "onHit" : "afterResolve");\n    if (hit) nextAi = applyCardEffects(nextAi, aiCard, "ai", "afterResolve");\n    const armorPenaltyGrant = hit ? nextAttackArmorPenalty(aiCard) : 0;\n    if (armorPenaltyGrant) nextAi = { ...nextAi, nextAttackArmorPenalty: (nextAi.nextAttackArmorPenalty ?? 0) + armorPenaltyGrant };\n    const aiCycleNotes: string[] = [];\n    if (pending.conditionalCycle?.draw) {\n      nextAi = drawCards(nextAi, pending.conditionalCycle.draw);\n      aiCycleNotes.push(`printed effect draws ${pending.conditionalCycle.draw}`);\n    }\n    if (pending.conditionalCycle?.discard && nextAi.hand.length) {\n      const discardCount = Math.min(pending.conditionalCycle.discard, nextAi.hand.length);\n      const ranked = [...nextAi.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)));\n      const discarded = ranked.slice(0, discardCount);\n      nextAi = { ...nextAi, hand: nextAi.hand.filter((id) => !discarded.includes(id)), discard: [...nextAi.discard, ...discarded] };\n      aiCycleNotes.push(`printed effect discards ${discardCount}`);\n    }\n    const aiTriggeredEquipment = autoTriggerAiAfterAttackEquipment(nextAi, nextPlayer, hit);',
  1,
  "AI structured post-Attack followups",
);
playtest = replaceCount(
  playtest,
  'Attack ${pending.attackPower} vs Defense ${defensePower}',
  'Attack ${finalAttackPower} vs Defense ${defensePower}',
  3,
  "AI resolved Attack Power logs",
);
playtest = replaceCount(
  playtest,
  '...locationModifier.notes, ...targetDebuff.notes, ...aiTriggeredEquipment.notes, ...(reduced.note ? [reduced.note] : []), ...preventionNotes];',
  '...locationModifier.notes, ...postDefensePower.notes, ...targetDebuff.notes, ...aiCycleNotes, ...aiTriggeredEquipment.notes, ...(reduced.note ? [reduced.note] : []), ...preventionNotes];',
  1,
  "AI post-Defense and cycle notes",
);

playtest = replaceCount(
  playtest,
  '  const zone = anyZone ? ["High", "Mid", "Low"][Math.floor(Math.random() * 3)] : card.zone?.split(",")[0] ?? "High";\n  const tempoBonus =',
  '  const zone = anyZone ? ["High", "Mid", "Low"][Math.floor(Math.random() * 3)] : card.zone?.split(",")[0] ?? "High";\n  const previousCard = current.ai.cardsThisTurn.length ? cardFor(current.ai.cardsThisTurn[current.ai.cardsThisTurn.length - 1]) : null;\n  const previousCardWasItem = Boolean(previousCard && previousCard.cardType === "Item");\n  const conditionalCycle = structuredAttackCyclePlan(current.ai, card, zone);\n  const armorPenalty = current.ai.nextAttackArmorPenalty ?? 0;\n  const tempoBonus =',
  1,
  "AI Attack pre-declaration structured context",
);
playtest = replaceCount(
  playtest,
  'nextAttackBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false, tempo:',
  'nextAttackBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false, nextAttackArmorPenalty: 0, tempo:',
  1,
  "AI next-Attack Armor consumption",
);
playtest = replaceCount(
  playtest,
  'blockedFocus: activeEquipment.blockedFocus, targetExhaustedAtDeclaration:',
  'blockedFocus: activeEquipment.blockedFocus, armorPenalty, conditionalCycle: conditionalCycle.draw || conditionalCycle.discard ? { draw: conditionalCycle.draw, discard: conditionalCycle.discard } : undefined, previousCardWasItem, targetExhaustedAtDeclaration:',
  1,
  "AI PendingStrike structured state",
);

playtest = replaceCount(
  playtest,
  '    const zone = attackHasFlexibleZone(current.player, card) ? current.selectedZone : card.zone?.split(",")[0] ?? "High";\n    const location = cardFor(current.locationId);',
  '    const zone = attackHasFlexibleZone(current.player, card) ? current.selectedZone : card.zone?.split(",")[0] ?? "High";\n    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;\n    const previousCardIsItem = Boolean(previousCard && previousCard.cardType === "Item");\n    const location = cardFor(current.locationId);',
  1,
  "Reversal previous-card context",
);
playtest = replaceSection(
  playtest,
  '    const rawArmorModifier = equipmentDefenseModifier(current.ai, zone);',
  '    const rawDamage = hit ?',
  `    const rawArmorModifier = equipmentDefenseModifier(current.ai, zone);\n    const piercingModifier = attackPiercingModifier(current.player, current.ai, card, zone, comboModifier.piercing);\n    const armorModifier = piercedArmorModifier(rawArmorModifier, piercingModifier.value);\n    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + (current.player.reversalAttackBonus ?? 0) + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);\n    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);\n    const defenseId = bestDefense(current.ai, zone, Math.max(0, baseAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value);\n    const defenseCard = defenseId ? cardFor(defenseId) : null;\n    const postDefensePower = afterDefenseAttackPowerBonus(card, Boolean(defenseCard));\n    const attackPower = Math.max(0, baseAttackPower + postDefensePower.amount);\n    const defenseModifier = locationDefenseModifier(location, defenseCard, current.ai, zone);\n    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(current.ai, current.player, defenseCard, card) : { value: 0, notes: [] as string[] };\n    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (current.ai.nextDefenseCardBonus ?? 0) : 0) + defenseCardModifier.value + defenseModifier.value);\n    const hit = attackPower > defensePower;\n`,
  "Reversal post-Defense power math",
);
playtest = replaceCount(
  playtest,
  '    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card) : { board: nextAi, notes: [] as string[] };',
  '    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card, { previousCardIsItem }) : { board: nextAi, notes: [] as string[] };',
  1,
  "Reversal conditional target Hit debuff",
);
playtest = replaceCount(
  playtest,
  '    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, nextDefenseCardBonus: 0 };',
  '    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, blockedSinceLastTurn: !hit || Boolean(nextAi.blockedSinceLastTurn), blockedThisRound: !hit || Boolean(nextAi.blockedThisRound), nextDefenseCardBonus: 0 };',
  1,
  "AI Defense memory on Reversal",
);
playtest = replaceCount(
  playtest,
  '...comboModifier.notes, ...piercingModifier.notes, ...armorModifier.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes,',
  '...comboModifier.notes, ...piercingModifier.notes, ...armorModifier.notes, ...postDefensePower.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes,',
  1,
  "Reversal post-Defense Attack notes",
);
await write("app/playtest.tsx", playtest);

let tests = await read("tests/attack-structured-resolvers-batch.test.mjs");
tests = replaceCount(
  tests,
  '  attackCanChooseAnyZone,\n  attackPiercing,',
  '  afterDefenseAttackPowerBonus,\n  attackCanChooseAnyZone,\n  attackPiercing,',
  1,
  "Attack test imports afterDefense",
);
tests = replaceCount(
  tests,
  '  optionalDiscardDrawChoice,\n  readyEquipmentOnHit,',
  '  nextAttackArmorPenalty,\n  optionalDiscardDrawChoice,\n  readyEquipmentOnHit,',
  1,
  "Attack test imports Armor penalty",
);
tests = replaceCount(
  tests,
  '  structuredConditionalFocus,\n  structuredCurrentAttackFlow,',
  '  structuredConditionalCycle,\n  structuredConditionalFocus,\n  structuredCurrentAttackFlow,',
  1,
  "Attack test imports cycle",
);
tests = replaceCount(
  tests,
  '  targetNextAttackPenalty,\n} from',
  '  targetNextAttackPenalty,\n  targetSpeedPenaltyUntilHonor,\n} from',
  1,
  "Attack test imports Speed penalty",
);
tests = replaceCount(
  tests,
  'assert.ok(attackIds.length >= 40, "Attack migration should not regress below the completed structured batches");',
  'assert.ok(attackIds.length >= 51, "Attack migration should not regress below the completed structured batches");',
  1,
  "Attack migration floor 51",
);
tests += `\n\ntest("eleven-card state and response Attack batch is structured and executable", () => {\n  const ids = [\n    "DDB-ATK-CORE-004", "DDB-ATK-CORE-006", "DDB-ATK-CORE-011", "DDB-ATK-CORE-014",\n    "DDB-ATK-CORE-024", "DDB-ATK-CORE-026", "DDB-ATK-CORE-030", "DDB-ATK-CORE-039",\n    "DDB-ATK-CORE-041", "DDB-ATK-CORE-043", "DDB-ATK-CORE-055",\n  ];\n  for (const catalogId of ids) {\n    const plan = effectPlanForCard(card(catalogId), registry);\n    assert.equal(plan.source, "structured", catalogId + " should prefer structured behavior");\n    assert.deepEqual(plan.unsupported, [], catalogId + " should have no queued clauses");\n  }\n\n  assert.equal(afterDefenseAttackPowerBonus(card("DDB-ATK-CORE-004"), true).amount, 1);\n  assert.equal(afterDefenseAttackPowerBonus(card("DDB-ATK-CORE-004"), false).amount, 0);\n  assert.equal(afterDefenseAttackPowerBonus(card("DDB-ATK-CORE-039"), true).amount, 0);\n  assert.equal(afterDefenseAttackPowerBonus(card("DDB-ATK-CORE-039"), false).amount, 2);\n\n  assert.equal(conditionalAttackPowerBonus(card("DDB-ATK-CORE-006"), powerContext({ playedDefenseSinceLastTurn: true })).amount, 1);\n  assert.equal(conditionalAttackPowerBonus(card("DDB-ATK-CORE-006"), powerContext({ playedDefenseSinceLastTurn: false })).amount, 0);\n  assert.equal(conditionalAttackPowerBonus(card("DDB-ATK-CORE-011"), powerContext({ blockedSinceLastTurn: true })).amount, 1);\n  assert.equal(conditionalAttackPowerBonus(card("DDB-ATK-CORE-014"), powerContext({ blockedThisRound: true })).amount, 2);\n  assert.equal(conditionalAttackPowerBonus(card("DDB-ATK-CORE-030"), powerContext({ previousAttackBlocked: true })).amount, 2);\n  assert.equal(conditionalAttackPowerBonus(card("DDB-ATK-CORE-030"), powerContext({ previousAttackBlocked: false })).amount, 0);\n\n  const flyingSpin = card("DDB-ATK-CORE-024");\n  assert.equal(flyingSpin.zone, "Any");\n  assert.deepEqual(structuredConditionalCycle(flyingSpin, { timing: "afterResolve", priorJumpOrSpinAttack: true }), { handled: true, draw: 1, discard: 0 });\n  assert.deepEqual(structuredConditionalCycle(flyingSpin, { timing: "afterResolve", priorJumpOrSpinAttack: false }), { handled: true, draw: 0, discard: 0 });\n\n  const spinningElbow = card("DDB-ATK-CORE-055");\n  assert.deepEqual(structuredConditionalCycle(spinningElbow, { timing: "afterResolve", previousAttackHit: true }), { handled: true, draw: 1, discard: 1 });\n  assert.deepEqual(structuredConditionalCycle(spinningElbow, { timing: "afterResolve", previousAttackHit: false }), { handled: true, draw: 0, discard: 0 });\n\n  assert.equal(nextAttackArmorPenalty(card("DDB-ATK-CORE-026")), 1);\n\n  const palm = card("DDB-ATK-CORE-041");\n  assert.deepEqual(structuredConditionalFocus(palm, { timing: "onHit", attackNumber: 1, usedEffectIds: [] }), { handled: true, amount: 1, effectIds: ["attack-palm-heel-once-hit-focus"] });\n  assert.deepEqual(structuredConditionalFocus(palm, { timing: "onHit", attackNumber: 2, usedEffectIds: ["attack-palm-heel-once-hit-focus"] }), { handled: true, amount: 0 });\n\n  const punchClock = card("DDB-ATK-CORE-043");\n  assert.equal(conditionalAttackPowerBonus(punchClock, powerContext({ previousCardIsKataOrItem: true })).amount, 1);\n  assert.equal(conditionalAttackPowerBonus(punchClock, powerContext({ previousCardIsKataOrItem: false })).amount, 0);\n  assert.equal(targetSpeedPenaltyUntilHonor(punchClock, { previousCardIsItem: true }), 1);\n  assert.equal(targetSpeedPenaltyUntilHonor(punchClock, { previousCardIsItem: false }), 0);\n});\n`;
await write("tests/attack-structured-resolvers-batch.test.mjs", tests);

console.log("Applied Stage 3B eleven-card Attack migration patch.");
