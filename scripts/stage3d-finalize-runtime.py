from pathlib import Path
import re

path = Path('app/playtest.tsx')
source = path.read_text()

MARKER = 'STAGE3D_LOCATION_RUNTIME_FINALIZED'
if MARKER in source:
    print('Stage 3D final Location runtime pass already applied.')
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str):
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    source = source.replace(old, new, 1)


def replace_all(old: str, new: str, expected: int, label: str):
    global source
    count = source.count(old)
    if count != expected:
        raise SystemExit(f'{label}: expected {expected} matches, found {count}')
    source = source.replace(old, new)


def sub_once(pattern: str, replacement: str, label: str, flags=re.S):
    global source
    matches = list(re.finditer(pattern, source, flags))
    if len(matches) != 1:
        raise SystemExit(f'{label}: expected 1 match, found {len(matches)}')
    source = re.sub(pattern, replacement, source, count=1, flags=flags)


# Runtime state used only to make structured Location predicates deterministic.
replace_once(
    '  locationPendingChoice?: { kind: "location-choice"; sourceCardId: string; effectId: string; operation: string; options: string[]; metadata: Record<string, unknown>; step?: string } | null;\n};',
    '  locationPendingChoice?: { kind: "location-choice"; sourceCardId: string; effectId: string; operation: string; options: string[]; metadata: Record<string, unknown>; step?: string } | null;\n  locationComboNumericChoice?: string | null;\n  locationEquipmentExhaustCountThisRound?: number;\n  locationKataFlowGrantsThisTurn?: number;\n  locationNextAttackFlowFromKata?: boolean;\n};',
    'Board Location state fields',
)
replace_once(
    'locationStandingDefense: 0, locationChosenCounterZone: null, locationActiveBeltExam: false, locationEquipmentExhaustedThisRound: false, locationReadiedOutsideInitiateEquipmentIds: [], locationPendingChoice: null,',
    'locationStandingDefense: 0, locationChosenCounterZone: null, locationComboNumericChoice: null, locationEquipmentExhaustCountThisRound: 0, locationKataFlowGrantsThisTurn: 0, locationNextAttackFlowFromKata: false, locationActiveBeltExam: false, locationEquipmentExhaustedThisRound: false, locationReadiedOutsideInitiateEquipmentIds: [], locationPendingChoice: null,',
    'empty Board Location counters',
)

# Replace Combo runtime so Location comboTrigger effects mutate the actual Combo payoff.
combo_runtime = r'''type ComboNumericTarget = "power" | "damage" | "focusOnHit" | "speedOnTrigger" | "piercing";

function comboNumericTargets(evaluation: ReturnType<typeof evaluateCombo>): ComboNumericTarget[] {
  const targets: ComboNumericTarget[] = [];
  if (evaluation.power) targets.push("power");
  if (evaluation.damage) targets.push("damage");
  if (evaluation.focusOnHit) targets.push("focusOnHit");
  if (evaluation.speedOnTrigger) targets.push("speedOnTrigger");
  if (evaluation.piercing) targets.push("piercing");
  return targets;
}

function comboAttackModifier(board: Board, card: CardEntry, zone: string, isReversal = false): ComboModifier {
  const result: ComboModifier = { power: 0, damage: 0, focusOnHit: 0, grantsFlow: false, speedOnTrigger: 0, piercing: 0, triggeredIds: [], notes: [], locationCommands: [] };
  const priorCards = board.cardsThisTurn.map(cardFor).filter(Boolean) as CardEntry[];
  const equipment = board.equipment.map(cardFor).filter(Boolean) as CardEntry[];
  let locationComboResolved = false;
  for (const comboId of board.learnedCombos) {
    if (board.triggeredCombos.includes(comboId)) continue;
    const combo = cardFor(comboId);
    if (!combo) continue;
    const evaluation = evaluateCombo(combo, {
      priorCards,
      attacksThisTurn: board.attacksThisTurn,
      defendedThisRound: board.defendedThisRound,
      hitThisTurn: board.hitThisTurn,
      zonesPlayed: board.zonesPlayed,
      equipment,
      currentCard: card,
      currentZone: zone,
      isReversal,
    });
    if (!evaluation.eligible) continue;

    let power = evaluation.power;
    let damage = evaluation.damage;
    let focusOnHit = evaluation.focusOnHit;
    let speedOnTrigger = evaluation.speedOnTrigger;
    let piercing = evaluation.piercing;

    if (!locationComboResolved) {
      const location = locationForBoard(board);
      const parsed = location ? structuredLocationComboNumericModifier(location, { ...locationUsageFor(board), comboIsLearned: true, firstMatchingPerTurn: true, firstMatchingPerRound: true }) : { amount: 0, commands: [] as LocationCommand[] };
      if (parsed.commands.length) {
        const numeric = parsed.commands.find((command) => command.operation === "modifyComboPrintedNumericEffect");
        const targets = comboNumericTargets(evaluation);
        const requested = board.locationComboNumericChoice as ComboNumericTarget | null | undefined;
        const target = requested && targets.includes(requested) ? requested : targets[0];
        if (numeric && target) {
          if (target === "power") power += numeric.amount;
          else if (target === "damage") damage += numeric.amount;
          else if (target === "focusOnHit") focusOnHit += numeric.amount;
          else if (target === "speedOnTrigger") speedOnTrigger += numeric.amount;
          else if (target === "piercing") piercing += numeric.amount;
          result.notes.push(`${numeric.effectId}: +${numeric.amount} to Combo ${target}`);
        }
        result.locationCommands = [...(result.locationCommands ?? []), ...parsed.commands];
        locationComboResolved = true;
      }
    }

    result.power += power;
    result.damage += damage;
    result.focusOnHit += focusOnHit;
    result.grantsFlow ||= evaluation.grantsFlow;
    result.speedOnTrigger += speedOnTrigger;
    result.piercing += piercing;
    result.triggeredIds.push(combo.id);
    const payoffBits = [power ? `+${power} power` : "", damage ? `+${damage} damage` : "", evaluation.grantsFlow ? "Flow" : "", focusOnHit ? `${focusOnHit} Focus on Hit` : "", speedOnTrigger ? `+${speedOnTrigger} Speed` : "", piercing ? `Piercing ${piercing}` : ""].filter(Boolean);
    result.notes.push(`COMBO — ${combo.name}: ${payoffBits.join(", ")}`);
  }
  return result;
}

function pendingLocationComboChoice(board: Board, card: CardEntry, zone: string, isReversal = false): PendingChoice | null {
  if (board.locationController !== "player" || board.locationComboNumericChoice) return null;
  const location = locationForBoard(board);
  if (!location) return null;
  const priorCards = board.cardsThisTurn.map(cardFor).filter(Boolean) as CardEntry[];
  const equipment = board.equipment.map(cardFor).filter(Boolean) as CardEntry[];
  for (const comboId of board.learnedCombos) {
    if (board.triggeredCombos.includes(comboId)) continue;
    const combo = cardFor(comboId);
    if (!combo) continue;
    const evaluation = evaluateCombo(combo, { priorCards, attacksThisTurn: board.attacksThisTurn, defendedThisRound: board.defendedThisRound, hitThisTurn: board.hitThisTurn, zonesPlayed: board.zonesPlayed, equipment, currentCard: card, currentZone: zone, isReversal });
    if (!evaluation.eligible) continue;
    const parsed = structuredLocationComboNumericModifier(location, { ...locationUsageFor(board), comboIsLearned: true, firstMatchingPerTurn: true, firstMatchingPerRound: true });
    const numeric = parsed.commands.find((command) => command.operation === "modifyComboPrintedNumericEffect");
    if (!numeric) return null;
    const options = comboNumericTargets(evaluation);
    if (options.length <= 1) return null;
    return { kind: "location-choice", sourceCardId: location.id, effectId: numeric.effectId, operation: "comboNumericChoice", options, metadata: { ...numeric.metadata, comboId: combo.id, amount: numeric.amount } };
  }
  return null;
}

function applyLocationComboTrigger(board: Board, commands: LocationCommand[], controller: "player" | "ai") {
  if (!commands.length) return board;
  let next = { ...markLocationCommandsUsed(board, commands), locationComboNumericChoice: null };
  const location = locationForBoard(next);
  for (const command of commands) {
    if (command.operation !== "drawThenDiscard") continue;
    const draw = Number(command.metadata.drawCount ?? 1);
    const discard = Number(command.metadata.discardCount ?? 1);
    next = drawCards(next, Math.max(0, draw));
    if (controller === "ai") {
      const discarded = [...next.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)) || left.localeCompare(right)).slice(0, Math.min(discard, next.hand.length));
      next = { ...next, hand: next.hand.filter((id) => !discarded.includes(id)), discard: [...next.discard, ...discarded] };
    } else if (location && discard > 0 && next.hand.length) {
      next = { ...next, locationPendingChoice: { kind: "location-choice", sourceCardId: location.id, effectId: command.effectId, operation: "locationDrawDiscardChoice", options: [], metadata: { ...command.metadata, discardCount: discard }, step: "discard" } };
    }
  }
  return next;
}
'''
sub_once(
    r'function comboAttackModifier\(board: Board, card: CardEntry, zone: string, isReversal = false\): ComboModifier \{.*?^\}\n',
    combo_runtime,
    'Combo Location runtime replacement',
    flags=re.S | re.M,
)

# Human choices must remain explicit and never strand the modal without legal options.
replace_once(
    'function locationPendingChoice(board: Board, command: LocationCommand, location: CardEntry) {\n  const options = Array.isArray(command.metadata.choiceOptions) ? command.metadata.choiceOptions.map(String) : [];\n  return { ...board, locationPendingChoice: { kind: "location-choice" as const, sourceCardId: location.id, effectId: command.effectId, operation: command.operation ?? command.action, options, metadata: command.metadata } };\n}',
    'function locationPendingChoice(board: Board, command: LocationCommand, location: CardEntry) {\n  const operation = command.operation ?? command.action;\n  if (operation === "discardForReadyOrDefenseChoice" && !board.hand.length) return { ...board, locationPendingChoice: null };\n  const options = Array.isArray(command.metadata.choiceOptions) ? command.metadata.choiceOptions.map(String) : [];\n  return { ...board, locationPendingChoice: { kind: "location-choice" as const, sourceCardId: location.id, effectId: command.effectId, operation, options, metadata: command.metadata } };\n}',
    'safe Location pending choice',
)

# Exact structured predicate contexts by event.
replace_once(
    'const commands = resolveLocationEvent(location, "consumableResolve", { ...locationUsageFor(board), cardTypeAny: [card.cardType], cardSubtypeOrTagAny: [card.subtype, ...card.tags] });',
    'const prior = priorCardsForCurrentPlay(board, card.id);\n  const commands = resolveLocationEvent(location, "consumableResolve", { ...locationUsageFor(board), cardTypeAny: [card.cardType], cardSubtypeOrTagAny: [card.subtype, ...card.tags], firstConsumableThisTurn: !prior.some(isCoreConsumableCard) });',
    'Consumable Location predicates',
)
replace_once(
    'function applyLocationEquipmentExhaust(board: Board, equipment: CardEntry) {\n  const location = locationForBoard(board);\n  if (!location) return { ...board, locationEquipmentExhaustedThisRound: true };\n  const first = !board.locationEquipmentExhaustedThisRound;\n  const commands = resolveLocationEvent(location, "equipmentExhaust", { ...locationUsageFor(board), ownTurn: Boolean(board.locationOwnTurn), equipmentTagAny: equipment.tags, equipmentExhaustedEarlierThisRound: !first, firstEquipmentExhaustThisRound: first });\n  return { ...applyLocationImmediate(board, commands, board.locationController ?? "ai"), locationEquipmentExhaustedThisRound: true };\n}',
    'function applyLocationEquipmentExhaust(board: Board, equipment: CardEntry) {\n  const location = locationForBoard(board);\n  const count = board.locationEquipmentExhaustCountThisRound ?? 0;\n  if (!location) return { ...board, locationEquipmentExhaustedThisRound: true, locationEquipmentExhaustCountThisRound: count + 1 };\n  const commands = resolveLocationEvent(location, "equipmentExhaust", { ...locationUsageFor(board), ownTurn: Boolean(board.locationOwnTurn), equipmentTagAny: equipment.tags, equipmentExhaustedEarlierThisRound: count > 0, firstEquipmentExhaustThisRound: count === 0 });\n  return { ...applyLocationImmediate(board, commands, board.locationController ?? "ai"), locationEquipmentExhaustedThisRound: true, locationEquipmentExhaustCountThisRound: count + 1 };\n}',
    'Equipment exhaust count',
)
replace_once(
    'const commands = resolveLocationEvent(location, "equipmentEquip", { ...locationUsageFor(board), equipmentTagAny: equipment.tags, cardSubtypeOrTagAny: [equipment.subtype, ...equipment.tags] });',
    'const commands = resolveLocationEvent(location, "equipmentEquip", { ...locationUsageFor(board), equipmentTagAny: equipment.tags, equippedCardTagAny: equipment.tags, cardSubtypeOrTagAny: [equipment.subtype, ...equipment.tags] });',
    'Equipment equip Location predicates',
)
replace_once(
    'const parsed = structuredLocationHealingModifier(location, { ...locationUsageFor(board), healingSourceAny: [source.cardType, source.subtype, ...source.tags], cardTypeAny: [source.cardType], cardSubtypeOrTagAny: [source.subtype, ...source.tags] });',
    'const prior = priorCardsForCurrentPlay(board, source.id);\n  const parsed = structuredLocationHealingModifier(location, { ...locationUsageFor(board), healingSourceAny: [source.cardType, source.subtype, ...source.tags], cardTypeAny: [source.cardType], cardSubtypeOrTagAny: [source.subtype, ...source.tags], firstConsumableThisTurn: isCoreConsumableCard(source) && !prior.some(isCoreConsumableCard) });',
    'Healing Location predicates',
)
replace_once(
    'damageReductionSourceAny: ["Defensive Equipment"]',
    'reductionSourceAny: ["Defensive Equipment"]',
    'Damage reduction predicate key',
)
replace_once(
    'equipmentExhaustedEarlierThisRound: Boolean(board.locationEquipmentExhaustedThisRound), firstEquipmentExhaustThisRound: !board.locationEquipmentExhaustedThisRound, selfSpeed: fighterStat(board, "Speed"), selfSpeedAtLeast: fighterStat(board, "Speed")',
    'equipmentExhaustedEarlierThisRound: (board.locationEquipmentExhaustCountThisRound ?? 0) > 0, firstEquipmentExhaustThisRound: (board.locationEquipmentExhaustCountThisRound ?? 0) === 1, selfSpeed: fighterStat(board, "Speed"), selfSpeedAtLeast: fighterStat(board, "Speed")',
    'Defense equipment exhaust predicates',
)

# Track whether Flow came from the first Kata this turn instead of assuming every Flow did.
replace_once(
    '  if (structuredFlow.grant) next.nextAttackHasFlow = true;',
    '  if (structuredFlow.grant) {\n    next.nextAttackHasFlow = true;\n    next.locationNextAttackFlowFromKata = isKata(card);\n    if (isKata(card)) next.locationKataFlowGrantsThisTurn = (next.locationKataFlowGrantsThisTurn ?? 0) + 1;\n  }',
    'Kata Flow source tracking',
)

# Attack predicates must match the canonical registry keys exactly.
old_attack_context = 'const parsed = structuredLocationAttackModifiers(location, { ...locationUsageFor(board), attackZone: zone, attackTagAny: card.tags, equipmentTagAny: equipped.flatMap((entry) => entry.tags), firstAttackThisTurn: board.attacksThisTurn === 0, firstLowAttackThisTurn: !board.zonesPlayed.some((played) => played.toLocaleLowerCase() === "low"), firstHighAttackThisTurn: !board.zonesPlayed.some((played) => played.toLocaleLowerCase() === "high"), hasWeapon: equipped.some(isWeapon), hasWeaponEquipped: equipped.some(isWeapon), attackIsUnarmed: !equipped.some(isWeapon), itemPlayedBeforeFirstAttack: board.attacksThisTurn === 0 && prior.some((entry) => entry.cardType === "Item"), afterFirstConsumableUsedThisTurn: prior.some((entry) => entry.subtype === "Consumable"), kataGrantedFlowThisAttack: board.nextAttackHasFlow && prior.some(isKata), firstKataFlowThisTurn: true, isComboFinisher: currentCombo.triggeredIds.length > 0, firstComboFinisherThisTurn: !board.comboTriggered, isFastest: defender ? fighterStat(board, "Speed") >= fighterStat(defender, "Speed") : false });'
new_attack_context = '''const priorConsumables = prior.filter(isCoreConsumableCard);
  const parsed = structuredLocationAttackModifiers(location, {
    ...locationUsageFor(board),
    attackZone: zone,
    attackTagAny: card.tags,
    equipmentTagAny: equipped.flatMap((entry) => entry.tags),
    firstAttackThisTurn: board.attacksThisTurn === 0,
    firstLowAttackThisTurn: !board.zonesPlayed.some((played) => played.toLocaleLowerCase() === "low"),
    firstHighAttackThisTurn: !board.zonesPlayed.some((played) => played.toLocaleLowerCase() === "high"),
    hasWeapon: equipped.some(isWeapon),
    hasWeaponEquipped: equipped.some(isWeapon),
    attackIsUnarmed: !equipped.some(isWeapon),
    itemPlayedBeforeFirstAttack: board.attacksThisTurn === 0 && prior.some((entry) => entry.cardType === "Item"),
    firstConsumableUsedThisTurn: priorConsumables.length === 1,
    afterThatConsumable: Boolean(prior.at(-1) && isCoreConsumableCard(prior.at(-1))),
    kataGrantedFlowThisAttack: Boolean(board.nextAttackHasFlow && board.locationNextAttackFlowFromKata),
    firstKataFlowThisTurn: (board.locationKataFlowGrantsThisTurn ?? 0) === 1,
    isComboFinisher: currentCombo.triggeredIds.length > 0,
    firstComboThisTurn: !board.comboTriggered,
    firstComboFinisherThisTurn: !board.comboTriggered,
    isFastest: defender ? fighterStat(board, "Speed") >= fighterStat(defender, "Speed") : false,
  });'''
replace_once(old_attack_context, new_attack_context, 'Attack Location predicate coverage')

# afterAttack needs blocked/Combo state to execute Local-Access TV Studio and Parking Garage effects.
replace_once(
    'function applyLocationAfterAttack(board: Board, card: CardEntry, zone: string, combatDamageDealt: number, attackHit: boolean) {',
    'function applyLocationAfterAttack(board: Board, card: CardEntry, zone: string, combatDamageDealt: number, attackHit: boolean, isComboFinisher = false) {',
    'afterAttack signature',
)
replace_once(
    'combatDamageDealt, attackHit, attackZone: zone, attackTagAny: card.tags, attackUsesEquipmentTagAny: locationTags(board), usesSceneChosenCounterZone:',
    'combatDamageDealt, attackHit, attackBlocked: !attackHit, isComboFinisher, attackZone: zone, attackTagAny: card.tags, attackUsesEquipmentTagAny: locationTags(board), usesSceneChosenCounterZone:',
    'afterAttack predicates',
)

# Ask the human which printed Combo number Astral Training Plane changes before resolving the Attack.
replace_once(
    '    const zone = anyZone ? current.selectedZone : card.zone?.split(",")[0] ?? "High";\n    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;',
    '    const zone = anyZone ? current.selectedZone : card.zone?.split(",")[0] ?? "High";\n    const locationComboChoice = pendingLocationComboChoice(current.player, card, zone);\n    if (locationComboChoice) return write(current, "Location decision: choose which printed Combo number receives the scene modifier.", { pendingChoice: locationComboChoice });\n    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;',
    'normal Attack Combo Location choice',
)
replace_once(
    '    const zone = attackHasFlexibleZone(current.player, card) ? current.selectedZone : card.zone?.split(",")[0] ?? "High";\n    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;',
    '    const zone = attackHasFlexibleZone(current.player, card) ? current.selectedZone : card.zone?.split(",")[0] ?? "High";\n    const locationComboChoice = pendingLocationComboChoice(current.player, card, zone, true);\n    if (locationComboChoice) return write(current, "Location decision: choose which printed Combo number receives the scene modifier.", { pendingChoice: locationComboChoice });\n    const previousCard = current.player.cardsThisTurn.length ? cardFor(current.player.cardsThisTurn[current.player.cardsThisTurn.length - 1]) : null;',
    'Reversal Combo Location choice',
)

# Actual Combo trigger side effects + usage scopes for player, AI, and Reversal.
replace_once(
    '    let nextPlayer = applyLocationXpBonus(applyCardEffects({ ...attackState, completesActiveBeltExamThisAttack: completesActiveBeltExam }, card, "player"), "Attack");\n    const flowDraw =',
    '    let nextPlayer = applyLocationXpBonus(applyCardEffects({ ...attackState, completesActiveBeltExamThisAttack: completesActiveBeltExam }, card, "player"), "Attack");\n    nextPlayer = applyLocationComboTrigger(nextPlayer, comboModifier.locationCommands ?? [], "player");\n    const flowDraw =',
    'player Combo Location trigger',
)
replace_once(
    '  let nextAi = applyLocationXpBonus(applyCardEffects({ ...consumedAttackBoard, hand: removeOne(current.ai.hand, card.id), playArea: [...current.ai.playArea, card.id], xp: current.ai.xp + 1,',
    '  let nextAi = applyLocationXpBonus(applyCardEffects({ ...consumedAttackBoard, hand: removeOne(current.ai.hand, card.id), playArea: [...current.ai.playArea, card.id], xp: current.ai.xp + 1,',
    'AI Combo trigger anchor',
)
replace_once(
    'triggeredCombos: [...current.ai.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.ai.comboTriggered || comboModifier.triggeredIds.length > 0 }, card, "ai"), "Attack");\n  const flowDraw =',
    'triggeredCombos: [...current.ai.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.ai.comboTriggered || comboModifier.triggeredIds.length > 0 }, card, "ai"), "Attack");\n  nextAi = applyLocationComboTrigger(nextAi, comboModifier.locationCommands ?? [], "ai");\n  const flowDraw =',
    'AI Combo Location trigger',
)
replace_once(
    '    let nextPlayer = applyCardEffects({ ...stage3cConsumeAttackStatuses(markLocationCommandsUsed(current.player, locationModifier.locationCommands ?? []), card, zone, true), hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attackedThisRound: true, zonesPlayed: [...current.player.zonesPlayed, zone], cardsThisTurn: [...current.player.cardsThisTurn, card.id], nextAttackAnyZone: false, reversalUsedRound: true, reversalAttackBonus: 0, triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0, damageDealt: current.player.damageDealt + damage }, card, "player");',
    '    let nextPlayer = applyLocationXpBonus(applyCardEffects({ ...stage3cConsumeAttackStatuses(markLocationCommandsUsed(current.player, locationModifier.locationCommands ?? []), card, zone, true), hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attackedThisRound: true, zonesPlayed: [...current.player.zonesPlayed, zone], cardsThisTurn: [...current.player.cardsThisTurn, card.id], nextAttackAnyZone: false, reversalUsedRound: true, reversalAttackBonus: 0, triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0, damageDealt: current.player.damageDealt + damage }, card, "player"), "Attack");\n    nextPlayer = applyLocationComboTrigger(nextPlayer, comboModifier.locationCommands ?? [], "player");',
    'Reversal XP and Combo Location trigger',
)

# Preserve exact current-attack Combo state for afterAttack predicates, including AI pending strikes.
replace_all(
    'applyLocationAfterAttack(markCompletedTask(nextPlayer), card, zone, damage, hit)',
    'applyLocationAfterAttack(markCompletedTask(nextPlayer), card, zone, damage, hit, comboModifier.triggeredIds.length > 0)',
    2,
    'player/Reversal afterAttack Combo state',
)
replace_once(
    'applyLocationAfterAttack(nextAi, aiCard, pending.zone, damage, hit)',
    'applyLocationAfterAttack(nextAi, aiCard, pending.zone, damage, hit, Boolean(pending.isComboFinisher))',
    'AI afterAttack Combo state',
)
replace_once(
    '  modifierNotes: string[];\n  remainingAiAttacks: string[];',
    '  modifierNotes: string[];\n  isComboFinisher?: boolean;\n  remainingAiAttacks: string[];',
    'PendingStrike Combo marker',
)
replace_once(
    'modifierNotes: modifiers, remainingAiAttacks',
    'modifierNotes: modifiers, isComboFinisher: comboModifier.triggeredIds.length > 0, remainingAiAttacks',
    'AI pending strike Combo marker',
)

# Human Location option handling: case-insensitive and explicit secondary discard/payoff decisions.
replace_once(
    '    const operation = choice.operation;\n      if (operation === "discardJunkDrawGainFocus" || operation === "destroyJunkGainFocusLoseHp") {',
    '    const operation = choice.operation;\n      if (operation === "locationDrawDiscardChoice") {\n        if (source !== "hand" || !current.player.hand.includes(cardId)) return current;\n        const player = { ...current.player, hand: removeOne(current.player.hand, cardId), discard: [...current.player.discard, cardId] };\n        return write(current, `${selected.name} discarded to finish the Location draw/cycle choice.`, { player, pendingChoice: null });\n      }\n      if (operation === "discardJunkDrawGainFocus" || operation === "destroyJunkGainFocusLoseHp") {',
    'Location draw/discard card choice',
)
replace_once(
    '    let player = current.player;\n    if (choice.operation === "nextCounterAttackChosenZone" || choice.operation === "chooseZone") player = { ...player, locationChosenCounterZone: option };\n    else if (choice.operation === "beltExamSpeedOrCycleChoice") {\n      if (option.includes("speed")) player = { ...player, tempSpeed: player.tempSpeed + 1, speedChangedThisRound: true };\n      else player = deterministicDrawDiscard(player, 1, 1);\n    } else if (choice.operation === "readyEquipmentOrSpeedChoice" && option.includes("speed")) player = { ...player, tempSpeed: player.tempSpeed + 1, speedChangedThisRound: true };\n    else if (choice.operation === "discardForReadyOrDefenseChoice" && option.includes("def")) player = { ...player, locationStandingDefense: (player.locationStandingDefense ?? 0) + 1 };\n    return write(current, `Location choice filed: ${option}.`, { player, pendingChoice: null });',
    '    let player = current.player;\n    const normalized = option.toLocaleLowerCase();\n    if (choice.operation === "nextCounterAttackChosenZone" || choice.operation === "chooseZone") player = { ...player, locationChosenCounterZone: option };\n    else if (choice.operation === "comboNumericChoice") player = { ...player, locationComboNumericChoice: option };\n    else if (choice.operation === "beltExamSpeedOrCycleChoice") {\n      if (normalized.includes("speed")) player = { ...player, tempSpeed: player.tempSpeed + 1, speedChangedThisRound: true };\n      else {\n        player = drawCards(player, 1);\n        return write(current, `Location choice filed: ${option}. Choose the discard.`, { player, pendingChoice: { ...choice, operation: "locationDrawDiscardChoice", options: [], metadata: { ...choice.metadata, discardCount: 1 }, step: "discard" } });\n      }\n    } else if (choice.operation === "readyEquipmentOrSpeedChoice" && normalized.includes("speed")) player = { ...player, tempSpeed: player.tempSpeed + 1, speedChangedThisRound: true };\n    else if (choice.operation === "discardForReadyOrDefenseChoice" && normalized.includes("def")) player = { ...player, locationStandingDefense: (player.locationStandingDefense ?? 0) + 1 };\n    return write(current, `Location choice filed: ${option}.`, { player, pendingChoice: null });',
    'Location option resolution',
)
replace_once(
    '  const skipPendingChoice = () => setMatch((current) => {\n    if (!current?.pendingChoice) return current;\n',
    '  const skipPendingChoice = () => setMatch((current) => {\n    if (!current?.pendingChoice) return current;\n    if (current.pendingChoice.kind === "location-choice") {\n      const choice = current.pendingChoice;\n      if (choice.operation === "readyEquipmentOrSpeedChoice") return write(current, "Location choice: +1 Speed until Honor.", { player: { ...current.player, tempSpeed: current.player.tempSpeed + 1, speedChangedThisRound: true }, pendingChoice: null });\n      if (choice.operation === "discardForReadyOrDefenseChoice" && choice.step === "choose") return write(current, "Location choice: +1 standing DEF until Honor.", { player: { ...current.player, locationStandingDefense: (current.player.locationStandingDefense ?? 0) + 1 }, pendingChoice: null });\n    }\n',
    'Location alternate payoff buttons',
)

# Make the Location modal expose every legal human option.
replace_once(
    '    : match.pendingChoice?.kind === "location-choice" && ["discardJunkDrawGainFocus", "destroyJunkGainFocusLoseHp"].includes(match.pendingChoice.operation)',
    '    : match.pendingChoice?.kind === "location-choice" && match.pendingChoice.operation === "locationDrawDiscardChoice"\n      ? player.hand.map((id, index) => ({ id, source: "hand" as const, index }))\n      : match.pendingChoice?.kind === "location-choice" && ["discardJunkDrawGainFocus", "destroyJunkGainFocusLoseHp"].includes(match.pendingChoice.operation)',
    'Location draw/discard modal cards',
)
replace_once(
    '  const effectChoiceCanSkip = match.pendingChoice?.kind === "prevent-combat-damage" || match.pendingChoice?.kind === "post-block-cycle" || match.pendingChoice?.kind === "discard-draw" || (match.pendingChoice?.kind === "deck-pick" && match.pendingChoice.optional) || (match.pendingChoice?.kind === "ready-equipment" && match.pendingChoice.optional);',
    '  const locationAlternateChoice = match.pendingChoice?.kind === "location-choice" && (match.pendingChoice.operation === "readyEquipmentOrSpeedChoice" || (match.pendingChoice.operation === "discardForReadyOrDefenseChoice" && match.pendingChoice.step === "choose"));\n  const effectChoiceCanSkip = match.pendingChoice?.kind === "prevent-combat-damage" || match.pendingChoice?.kind === "post-block-cycle" || match.pendingChoice?.kind === "discard-draw" || (match.pendingChoice?.kind === "deck-pick" && match.pendingChoice.optional) || (match.pendingChoice?.kind === "ready-equipment" && match.pendingChoice.optional) || locationAlternateChoice;\n  const effectChoiceSkipLabel = match.pendingChoice?.kind === "location-choice" && match.pendingChoice.operation === "readyEquipmentOrSpeedChoice" ? "Choose +1 Speed instead" : match.pendingChoice?.kind === "location-choice" && match.pendingChoice.operation === "discardForReadyOrDefenseChoice" ? "Choose +1 DEF instead" : "Skip this optional effect";',
    'Location alternate choice footer state',
)
replace_once(
    'match.pendingChoice.operation === "nextCounterAttackChosenZone" || match.pendingChoice.operation === "chooseZone" || match.pendingChoice.operation === "beltExamSpeedOrCycleChoice"',
    'match.pendingChoice.operation === "nextCounterAttackChosenZone" || match.pendingChoice.operation === "chooseZone" || match.pendingChoice.operation === "beltExamSpeedOrCycleChoice" || match.pendingChoice.operation === "comboNumericChoice"',
    'Combo numeric option buttons',
)
replace_once(
    '>Skip this optional effect</button>',
    '>{effectChoiceSkipLabel}</button>',
    'Location alternate choice button label',
)

# Final marker used by validation to prove this pass is present.
source = source.replace('// STAGE3D_LOCATION_RUNTIME — Quick Duel executes Core Locations from the canonical structured registry.', '// STAGE3D_LOCATION_RUNTIME — Quick Duel executes Core Locations from the canonical structured registry.\n// STAGE3D_LOCATION_RUNTIME_FINALIZED — all canonical Location event predicates and explicit human choices are wired.')
if MARKER not in source:
    raise SystemExit('Finalization marker insertion failed')

path.write_text(source)
print('Applied final Stage 3D Location runtime integration pass.')
