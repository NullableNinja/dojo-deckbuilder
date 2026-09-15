from pathlib import Path

# -----------------------------------------------------------------------------
# Character runtime: tighten zone semantics so the canonical event can own the
# declaration instead of the legacy preview/helper pair.
# -----------------------------------------------------------------------------
path = Path('app/character-runtime.ts')
text = path.read_text()
old = '''      case "character.declaredAttackZoneChange":\n      case "character.firstHighAttackToMid":\n      case "character.discardToChangeDeclaredZone":\n      case "character.firstSpinAttackRound": {\n        const first = event.firstAttackThisTurn ?? self.attacksThisTurn === 0;\n        if (resolver === "character.firstHighAttackToMid" && !first) break;\n        if (resolver === "character.firstSpinAttackRound" && (!first || !hasTag(event.card, "Spin"))) break;\n        const changed = Boolean(event.selectedZone && event.selectedZone !== event.printedZone);\n        if (resolver === "character.discardToChangeDeclaredZone" && changed) {\n          if (!event.selectedId || !self.hand.includes(event.selectedId)) { choices.push(makeChoice(effect, "Discard a card to change the declared Attack zone.", self.hand)); break; }\n          self = discard(self, 1, event.selectedId);\n        }\n        if (changed) { event.changedZone = true; self = mark(self, "turn:changedAttack"); activated = true; }\n        break;\n      }'''
new = '''      case "character.declaredAttackZoneChange":\n      case "character.firstHighAttackToMid":\n      case "character.discardToChangeDeclaredZone":\n      case "character.firstSpinAttackRound": {\n        const first = event.firstAttackThisTurn ?? self.attacksThisTurn === 0;\n        const printedZone = String(event.printedZone ?? "").toLocaleLowerCase();\n        const selectedZone = String(event.selectedZone ?? event.zone ?? "").toLocaleLowerCase();\n        if (resolver === "character.firstHighAttackToMid" && (!first || printedZone !== "high" || selectedZone !== "mid")) break;\n        if (resolver === "character.firstSpinAttackRound" && (!first || !hasTag(event.card, "Spin"))) break;\n        const changed = Boolean(selectedZone && printedZone && selectedZone !== printedZone);\n        if (resolver === "character.discardToChangeDeclaredZone" && changed) {\n          if (!event.selectedId || !self.hand.includes(event.selectedId)) { choices.push(makeChoice(effect, "Discard a card to change the declared Attack zone.", self.hand, false)); break; }\n          self = discard(self, 1, event.selectedId);\n        }\n        if (changed) { event.changedZone = true; self = mark(self, "turn:changedAttack"); activated = true; }\n        break;\n      }'''
assert old in text, 'attack-zone runtime block not found'
text = text.replace(old, new, 1)
path.write_text(text)

# -----------------------------------------------------------------------------
# Migration inventory: attackDeclared is the final ownership handoff. Keep the
# historical helper names only as a type vocabulary; no resolver/event remains
# compatibility-owned after this change.
# -----------------------------------------------------------------------------
path = Path('app/quick-duel-character-migration.ts')
text = path.read_text()
start = text.index('export const QUICK_DUEL_CHARACTER_COMPATIBILITY_RESOLVERS:')
end = text.index('\n\nconst compatibilityOwner', start)
replacement = '''export const QUICK_DUEL_CHARACTER_COMPATIBILITY_RESOLVERS: Readonly<\n  Partial<Record<CharacterCompatibilityHelper, readonly string[]>>\n> = {} as const;'''
text = text[:start] + replacement + text[end:]
old = '''export const QUICK_DUEL_CHARACTER_COMPATIBILITY_EVENTS: readonly CharacterRuntimeEventType[] = [\n  "attackDeclared",\n] as const;'''
new = '''export const QUICK_DUEL_CHARACTER_COMPATIBILITY_EVENTS: readonly CharacterRuntimeEventType[] = [] as const;'''
assert old in text, 'compatibility event block not found'
text = text.replace(old, new, 1)
path.write_text(text)

# -----------------------------------------------------------------------------
# Shared host: construct canonical attackDeclared facts, preview legal Character
# zones without committing state, and execute the real declaration for either
# actor. AI choices auto-resolve through the same generic Character contract.
# -----------------------------------------------------------------------------
path = Path('app/quick-duel-playtest-host.ts')
text = path.read_text()
anchor = '''export type QuickDuelPlaytestEquipResult<Match> = QuickDuelPlaytestCharacterEventResult<Match> & {'''
insert = '''function quickDuelCharacterAttackDeclaredEvent<Board extends CharacterRuntimeBoard>(\n  board: Board,\n  card: CharacterRuntimeEvent["card"],\n  selectedZone: string,\n  attackPower: number,\n  lookup: ComboHostCardLookup,\n): CharacterRuntimeEvent {\n  const printedZone = String(card?.zone ?? "").split(",")[0]?.trim() || null;\n  const previousAttackZone = board.zonesPlayed.at(-1) ?? null;\n  const isKata = (candidate: ComboRuntimeCard | null | undefined) => String(candidate?.subtype ?? candidate?.cardType ?? "").toLocaleLowerCase() === "kata";\n  const isWeapon = (candidate: ComboRuntimeCard | null | undefined) =>\n    String(candidate?.subtype ?? "").toLocaleLowerCase() === "weapon"\n    || (candidate?.tags ?? []).some((tag) => String(tag).toLocaleLowerCase() === "weapon");\n  return {\n    type: "attackDeclared",\n    card: card ?? null,\n    zone: selectedZone,\n    selectedZone,\n    printedZone,\n    previousAttackZone,\n    attackPower: Math.max(0, attackPower),\n    firstAttackThisTurn: board.attacksThisTurn === 0,\n    usedConsumableThisTurn: board.usedConsumableThisRound,\n    playedKataEarlierThisTurn: board.cardsThisTurn.some((id) => isKata(lookup(id))),\n    differentZoneFromPreviousAttack: Boolean(previousAttackZone && previousAttackZone !== selectedZone),\n    hasWeaponEquipped: board.equipment.some((id) => isWeapon(lookup(id))),\n  };\n}\n\nexport function publishQuickDuelPlaytestAttackDeclared<\n  Board extends QuickDuelComboMatchBoard & CharacterRuntimeBoard,\n  Match extends QuickDuelPlaytestHostMatch<Board>,\n>(\n  match: Match,\n  actor: QuickDuelPlaytestActor,\n  card: CharacterRuntimeEvent["card"],\n  selectedZone: string,\n  attackPower: number,\n  lookup: ComboHostCardLookup = runtimeCardFor,\n): QuickDuelPlaytestCharacterEventResult<Match> {\n  const board = actor === "player" ? match.player : match.ai;\n  let character = publishQuickDuelPlaytestCharacterEvent(\n    match,\n    actor,\n    quickDuelCharacterAttackDeclaredEvent(board, card, selectedZone, attackPower, lookup),\n  );\n  if (actor === "ai") {\n    for (let guard = 0; guard < 8 && character.event && character.choices.length > 0; guard += 1) {\n      const choice = character.choices[0];\n      const selection = chooseAiCharacterOption(choice);\n      if (selection === null) break;\n      character = resolveQuickDuelPlaytestCharacterChoice(character.match, actor, character.event, choice, selection);\n    }\n  }\n  return character;\n}\n\nexport function previewQuickDuelPlaytestCharacterAttackZones<\n  Board extends QuickDuelComboMatchBoard & CharacterRuntimeBoard,\n  Match extends QuickDuelPlaytestHostMatch<Board>,\n>(\n  match: Match,\n  actor: QuickDuelPlaytestActor,\n  card: CharacterRuntimeEvent["card"],\n  baseZones: string[],\n  lookup: ComboHostCardLookup = runtimeCardFor,\n) {\n  const zones = new Set(baseZones);\n  for (const candidate of ["High", "Mid", "Low"]) {\n    if (zones.has(candidate)) continue;\n    const preview = publishQuickDuelPlaytestAttackDeclared(match, actor, card, candidate, 0, lookup);\n    if (preview.event?.changedZone || preview.choices.some((choice) => choice.options.length > 0)) zones.add(candidate);\n  }\n  return ["High", "Mid", "Low"].filter((zone) => zones.has(zone));\n}\n\n'''
assert anchor in text and 'publishQuickDuelPlaytestAttackDeclared<' not in text, 'attackDeclared host insertion anchor not found'
text = text.replace(anchor, insert + anchor, 1)
path.write_text(text)

# -----------------------------------------------------------------------------
# Playtest: declaration preview and commit now flow through the canonical event.
# A tiny continuation cache prevents Character effects from double-firing when
# Miss Direction or Air Horn pauses the attack before Defense resolves.
# -----------------------------------------------------------------------------
path = Path('app/playtest.tsx')
text = path.read_text()
text = text.replace('import { structuredRuntimeResolvers, type RuntimeChoice, type RuntimeCommand, type RuntimeStatus, type RuntimeTrigger } from "./family-effect-runtime";', 'import { type RuntimeChoice, type RuntimeCommand, type RuntimeStatus, type RuntimeTrigger } from "./family-effect-runtime";')
text = text.replace('import { characterAllowedAttackZones, characterAttackModifier, type CharacterRuntimeChoice, type CharacterRuntimeEvent } from "./character-runtime";', 'import { type CharacterRuntimeChoice, type CharacterRuntimeEvent } from "./character-runtime";')
old = 'import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestDamageIncoming, publishQuickDuelPlaytestEquip, publishQuickDuelPlaytestLifecycleEvent, resolveQuickDuelPlaytestCharacterChoice } from "./quick-duel-playtest-host";'
new = 'import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, previewQuickDuelPlaytestCharacterAttackZones, publishQuickDuelPlaytestAttackDeclared, publishQuickDuelPlaytestDamageIncoming, publishQuickDuelPlaytestEquip, publishQuickDuelPlaytestLifecycleEvent, resolveQuickDuelPlaytestCharacterChoice } from "./quick-duel-playtest-host";'
assert old in text, 'playtest host import not found'
text = text.replace(old, new, 1)

# Pending Character choice continuation metadata.
old = '  | { kind: "character-runtime"; event: CharacterRuntimeEvent; choice: CharacterRuntimeChoice };'
new = '  | { kind: "character-runtime"; event: CharacterRuntimeEvent; choice: CharacterRuntimeChoice; continuation?: "player-attack" | "player-reversal"; declarationCardId?: string; declarationZone?: string; declarationBaseAttackPower?: number };'
assert old in text
text = text.replace(old, new, 1)
old = '''  pendingCombatContinuation?: { remainingAiAttacks: string[]; reversalEligible: boolean; reactionCardId?: string | null; incomingZone?: string | null } | null;'''
new = '''  pendingCombatContinuation?: { remainingAiAttacks: string[]; reversalEligible: boolean; reactionCardId?: string | null; incomingZone?: string | null } | null;\n  pendingCharacterAttackDeclaration?: { cardId: string; zone: string; powerBonus: number; notes: string[] } | null;'''
assert old in text
text = text.replace(old, new, 1)

# Remove the legacy fighter Character modifier/damage path entirely. Hit runtime owns El Pollo.
start = text.index('function fighterAttackModifier(')
end = text.index('\nfunction reduceNonCharacterDamageForFighter', start)
text = text[:start] + text[end+1:]

# Character zone preview is now generic event preview, so this helper only owns non-Character legality.
old = '''function attackAllowedZones(board: Board, card: CardEntry) {\n  const conditional = finalAttackAllowedZones(card, { boughtCardLastAscend: board.boughtCardLastAscend });\n  if (conditional.handled && conditional.zones.length > 1) return conditional.zones;\n  if (board.nextAttackAnyZone || card.zone?.includes("Any")) return ["High", "Mid", "Low"];\n  const equipped = board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));\n  if (attackCanChooseAnyZone(card, board.attacksThisTurn === 0, equipped)) return ["High", "Mid", "Low"];\n  const printedZones = [card.zone?.split(",")[0] ?? "High"];\n  return characterAllowedAttackZones(board, card, printedZones);\n}\nfunction attackHasFlexibleZone(board: Board, card: CardEntry) {\n  return attackAllowedZones(board, card).length > 1;\n}'''
new = '''function nonCharacterAttackAllowedZones(board: Board, card: CardEntry) {\n  const conditional = finalAttackAllowedZones(card, { boughtCardLastAscend: board.boughtCardLastAscend });\n  if (conditional.handled && conditional.zones.length > 1) return conditional.zones;\n  if (board.nextAttackAnyZone || card.zone?.includes("Any")) return ["High", "Mid", "Low"];\n  const equipped = board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));\n  if (attackCanChooseAnyZone(card, board.attacksThisTurn === 0, equipped)) return ["High", "Mid", "Low"];\n  return [card.zone?.split(",")[0] ?? "High"];\n}'''
assert old in text, 'attackAllowedZones block not found'
text = text.replace(old, new, 1)
text = text.replace('flatMap((card) => attackAllowedZones(board, card))', 'flatMap((card) => nonCharacterAttackAllowedZones(board, card))')

# Player card selection previews canonical Character declaration zones without committing state.
old = '''    const zones = attackAllowedZones(current.player, card);\n    const selectedAttackId = current.selectedAttackId === card.id ? null : card.id;\n    const selectedZone = zones.includes(current.selectedZone) ? current.selectedZone : zones[0] ?? "High";\n    return { ...current, selectedAttackId, selectedZone };'''
new = '''    const baseZones = nonCharacterAttackAllowedZones(current.player, card);\n    const zones = previewQuickDuelPlaytestCharacterAttackZones(current, "player", card, baseZones, cardFor);\n    const selectedAttackId = current.selectedAttackId === card.id ? null : card.id;\n    const selectedZone = zones.includes(current.selectedZone) ? current.selectedZone : zones[0] ?? "High";\n    return { ...current, selectedAttackId, selectedZone, pendingCharacterAttackDeclaration: null };'''
assert old in text, 'chooseAttack zone block not found'
text = text.replace(old, new, 1)

# Character choice resolution can resume the exact attack declaration it paused.
old = '''    const nextChoice = resolved.choices[0];\n    const pendingChoice: PendingChoice | null = resolved.event && nextChoice\n      ? { kind: "character-runtime", event: resolved.event, choice: nextChoice }\n      : null;\n    const selectedCard = cardFor(selection);\n    const label = selectedCard?.name ?? (["skip", "decline", "cancel"].includes(selection) ? "declined" : selection);\n    return write(resolved.match, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} resolves ${pending.choice.prompt}: ${label}.`, { pendingChoice });'''
new = '''    const nextChoice = resolved.choices[0];\n    const pendingChoice: PendingChoice | null = resolved.event && nextChoice\n      ? { ...pending, event: resolved.event, choice: nextChoice }\n      : null;\n    const selectedCard = cardFor(selection);\n    const label = selectedCard?.name ?? (["skip", "decline", "cancel"].includes(selection) ? "declined" : selection);\n    let resolvedMatch = write(resolved.match, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} resolves ${pending.choice.prompt}: ${label}.`, { pendingChoice });\n    if (!pendingChoice && pending.continuation && resolved.event && pending.declarationCardId && pending.declarationZone && Number.isFinite(pending.declarationBaseAttackPower)) {\n      const baseAttackPower = Number(pending.declarationBaseAttackPower);\n      const resolvedAttackPower = Number(resolved.event.attackPower ?? baseAttackPower);\n      const powerBonus = resolvedAttackPower - baseAttackPower;\n      resolvedMatch = { ...resolvedMatch, pendingCharacterAttackDeclaration: { cardId: pending.declarationCardId, zone: pending.declarationZone, powerBonus, notes: resolved.notes } };\n      return pending.continuation === "player-reversal" ? resolvePlayerReversalState(resolvedMatch) : resolvePlayerAttackState(resolvedMatch);\n    }\n    return resolvedMatch;'''
assert old in text, 'applyCharacterRuntimeChoice block not found'
text = text.replace(old, new, 1)

# Player normal Attack zone selection now uses the canonical preview.
old = '''    const anyZone = attackHasFlexibleZone(current.player, card);\n    const zone = anyZone ? current.selectedZone : card.zone?.split(",")[0] ?? "High";'''
new = '''    const zones = previewQuickDuelPlaytestCharacterAttackZones(current, "player", card, nonCharacterAttackAllowedZones(current.player, card), cardFor);\n    const zone = zones.includes(current.selectedZone) ? current.selectedZone : zones[0] ?? card.zone?.split(",")[0] ?? "High";'''
assert old in text, 'player attack zone block not found'
text = text.replace(old, new, 1)

# Replace player Character modifier with declaration event + continuation cache before opponent reactions.
old = '''    const locationModifier = locationAttackModifier(location, card, current.player, zone);\n    const fighterModifier = fighterAttackModifier(current.player, current.ai, card);\n    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card, zone);\n    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const armedEquipment = armedEquipmentAttackModifier(current.player, zone);\n    const aiIncomingReaction = autoActivateAiIncomingEquipment(current.ai, zone);'''
new = '''    const locationModifier = locationAttackModifier(location, card, current.player, zone);\n    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card, zone);\n    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const armedEquipment = armedEquipmentAttackModifier(current.player, zone);\n    const stage3cAttackBonus = stage3cAttackPowerBonus(current.player, card, zone);\n    const nonCharacterAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + printedModifier.power + incomingModifier.power + armedEquipment.power);\n    const cachedDeclaration = current.pendingCharacterAttackDeclaration?.cardId === card.id && current.pendingCharacterAttackDeclaration.zone === zone\n      ? current.pendingCharacterAttackDeclaration\n      : null;\n    let characterPowerBonus = cachedDeclaration?.powerBonus ?? 0;\n    let characterDeclarationNotes = cachedDeclaration?.notes ?? [];\n    if (!cachedDeclaration) {\n      const declaration = publishQuickDuelPlaytestAttackDeclared(current, "player", card, zone, nonCharacterAttackPower, cardFor);\n      if (declaration.event && declaration.choices.length) {\n        const choice = declaration.choices[0];\n        return write(declaration.match, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} pauses the declaration for a Character decision.`, {\n          pendingChoice: { kind: "character-runtime", event: declaration.event, choice, continuation: "player-attack", declarationCardId: card.id, declarationZone: zone, declarationBaseAttackPower: nonCharacterAttackPower },\n        });\n      }\n      current = declaration.match;\n      characterPowerBonus = Number(declaration.event?.attackPower ?? nonCharacterAttackPower) - nonCharacterAttackPower;\n      characterDeclarationNotes = declaration.notes;\n      current = { ...current, pendingCharacterAttackDeclaration: { cardId: card.id, zone, powerBonus: characterPowerBonus, notes: characterDeclarationNotes } };\n    }\n    const declaredAttackPower = Math.max(0, nonCharacterAttackPower + characterPowerBonus);\n    const aiIncomingReaction = autoActivateAiIncomingEquipment(current.ai, zone);'''
assert old in text, 'player declaration modifier block not found'
text = text.replace(old, new, 1)
old = '''    const stage3cAttackBonus = stage3cAttackPowerBonus(current.player, card, zone);\n    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);'''
new = '''    const baseAttackPower = Math.max(0, declaredAttackPower - aiIncomingReaction.attackPowerPenalty);'''
assert old in text, 'player baseAttackPower block not found'
text = text.replace(old, new, 1)
text = text.replace('...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes', '...locationModifier.notes, ...characterDeclarationNotes, ...printedModifier.notes', 1)
# Clear declaration cache when the normal attack resolves.
needle = 'selectedAttackId: null, pendingChoice, airHornPassedReactionIds:'
assert needle in text
text = text.replace(needle, 'selectedAttackId: null, pendingCharacterAttackDeclaration: null, pendingChoice, airHornPassedReactionIds:', 1)

# Reversal becomes a resumable state function and uses the same Character declaration contract.
start = text.index('  const resolveReversal = () => setMatch((current) => {')
end = text.index('\n\n  const resolveDefense =', start)
block = text[start:end]
assert block.rstrip().endswith('});'), 'resolveReversal block ending changed'
block = block.replace('  const resolveReversal = () => setMatch((current) => {', '  const resolvePlayerReversalState = (current: Match): Match => {', 1)
block = block.rstrip()[:-3] + '};'
text = text[:start] + block + '\n\n  const resolveReversal = () => setMatch((current) => current ? resolvePlayerReversalState(current) : current);' + text[end:]
old = '''    const zone = attackHasFlexibleZone(current.player, card) ? current.selectedZone : card.zone?.split(",")[0] ?? "High";'''
new = '''    const zones = previewQuickDuelPlaytestCharacterAttackZones(current, "player", card, nonCharacterAttackAllowedZones(current.player, card), cardFor);\n    const zone = zones.includes(current.selectedZone) ? current.selectedZone : zones[0] ?? card.zone?.split(",")[0] ?? "High";'''
assert old in text, 'reversal zone line not found'
text = text.replace(old, new, 1)
old = '''    const locationModifier = locationAttackModifier(location, card, current.player, zone);\n    const fighterModifier = fighterAttackModifier(current.player, current.ai, card);\n    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card, zone, true);\n    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const rawArmorModifier = equipmentDefenseModifier(current.ai, zone);'''
new = '''    const locationModifier = locationAttackModifier(location, card, current.player, zone);\n    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card, zone, true);\n    const incomingModifier = incomingAttackEquipmentModifier(current.ai);\n    const stage3cReversalBonus = stage3cAttackPowerBonus(current.player, card, zone, true);\n    const nonCharacterAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cReversalBonus + (current.player.reversalAttackBonus ?? 0) + locationModifier.power + printedModifier.power + incomingModifier.power);\n    const cachedDeclaration = current.pendingCharacterAttackDeclaration?.cardId === card.id && current.pendingCharacterAttackDeclaration.zone === zone\n      ? current.pendingCharacterAttackDeclaration\n      : null;\n    let characterPowerBonus = cachedDeclaration?.powerBonus ?? 0;\n    let characterDeclarationNotes = cachedDeclaration?.notes ?? [];\n    if (!cachedDeclaration) {\n      const declaration = publishQuickDuelPlaytestAttackDeclared(current, "player", card, zone, nonCharacterAttackPower, cardFor);\n      if (declaration.event && declaration.choices.length) {\n        const choice = declaration.choices[0];\n        return write(declaration.match, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} pauses the Reversal declaration for a Character decision.`, {\n          pendingChoice: { kind: "character-runtime", event: declaration.event, choice, continuation: "player-reversal", declarationCardId: card.id, declarationZone: zone, declarationBaseAttackPower: nonCharacterAttackPower },\n        });\n      }\n      current = declaration.match;\n      characterPowerBonus = Number(declaration.event?.attackPower ?? nonCharacterAttackPower) - nonCharacterAttackPower;\n      characterDeclarationNotes = declaration.notes;\n      current = { ...current, pendingCharacterAttackDeclaration: { cardId: card.id, zone, powerBonus: characterPowerBonus, notes: characterDeclarationNotes } };\n    }\n    const declaredAttackPower = Math.max(0, nonCharacterAttackPower + characterPowerBonus);\n    const rawArmorModifier = equipmentDefenseModifier(current.ai, zone);'''
assert old in text, 'reversal declaration modifier block not found'
text = text.replace(old, new, 1)
old = '''    const stage3cReversalBonus = stage3cAttackPowerBonus(current.player, card, zone, true);\n    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cReversalBonus + (current.player.reversalAttackBonus ?? 0) + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power);'''
new = '''    const baseAttackPower = declaredAttackPower;'''
assert old in text, 'reversal baseAttackPower block not found'
text = text.replace(old, new, 1)
# Replace the next fighterModifier notes occurrence (reversal) with declaration notes.
idx = text.index('...fighterModifier.notes', text.index('const resolvePlayerReversalState'))
text = text[:idx] + '...characterDeclarationNotes' + text[idx+len('...fighterModifier.notes'):]
# Reversal resolves the cache regardless of whether more AI attacks remain.
rev_start = text.index('const resolvePlayerReversalState')
rev_end = text.index('const resolveDefense =', rev_start)
segment = text[rev_start:rev_end]
segment = segment.replace('selectedAttackId: null,', 'selectedAttackId: null, pendingCharacterAttackDeclaration: null,')
text = text[:rev_start] + segment + text[rev_end:]

# AI chooses among canonical preview zones and commits attackDeclared before pendingStrike.
old = '''  const anyZone = attackHasFlexibleZone(current.ai, card);\n  const zone = anyZone ? ["High", "Mid", "Low"][Math.floor(Math.random() * 3)] : card.zone?.split(",")[0] ?? "High";'''
new = '''  const zones = previewQuickDuelPlaytestCharacterAttackZones(current, "ai", card, nonCharacterAttackAllowedZones(current.ai, card), cardFor);\n  const zone = zones[Math.floor(Math.random() * zones.length)] ?? card.zone?.split(",")[0] ?? "High";'''
assert old in text, 'AI zone block not found'
text = text.replace(old, new, 1)
old = '''  const locationModifier = locationAttackModifier(cardFor(current.locationId), card, current.ai, zone);\n  const fighterModifier = fighterAttackModifier(current.ai, current.player, card);\n  const printedModifier = printedAttackRuleModifier(current.ai, current.player, card, zone);\n  const incomingModifier = incomingAttackEquipmentModifier(current.player);\n  const activeEquipment = autoActivateAiAttackEquipment(current.ai, zone);'''
new = '''  const locationModifier = locationAttackModifier(cardFor(current.locationId), card, current.ai, zone);\n  const printedModifier = printedAttackRuleModifier(current.ai, current.player, card, zone);\n  const incomingModifier = incomingAttackEquipmentModifier(current.player);\n  const activeEquipment = autoActivateAiAttackEquipment(current.ai, zone);'''
assert old in text, 'AI fighter modifier block not found'
text = text.replace(old, new, 1)
old = '''  const stage3cAttackBonus = stage3cAttackPowerBonus(activeEquipment.board, card, zone);\n  const attackPower = Math.max(0, cardPower(card) + fighterStat(activeEquipment.board, "ATK") + activeEquipment.board.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + activeEquipment.power);\n  const consumedAttackBoard = stage3cConsumeAttackStatuses(activeEquipment.board, card, zone);'''
new = '''  const stage3cAttackBonus = stage3cAttackPowerBonus(activeEquipment.board, card, zone);\n  const nonCharacterAttackPower = Math.max(0, cardPower(card) + fighterStat(activeEquipment.board, "ATK") + activeEquipment.board.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + printedModifier.power + incomingModifier.power + activeEquipment.power);\n  const declaration = publishQuickDuelPlaytestAttackDeclared({ ...current, ai: activeEquipment.board }, "ai", card, zone, nonCharacterAttackPower, cardFor);\n  current = declaration.match;\n  const declaredAiBoard = current.ai;\n  const attackPower = Math.max(0, Number(declaration.event?.attackPower ?? nonCharacterAttackPower));\n  const consumedAttackBoard = stage3cConsumeAttackStatuses(declaredAiBoard, card, zone);'''
assert old in text, 'AI attack power block not found'
text = text.replace(old, new, 1)
text = text.replace('...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes', '...locationModifier.notes, ...declaration.notes, ...printedModifier.notes', 1)

# Render the exact canonical preview zones for both normal Attacks and Reversals.
old = '''  const pendingAttack = match.selectedAttackId ? cardFor(match.selectedAttackId) : null;\n  const currentLocation = cardFor(match.locationId);'''
new = '''  const pendingAttack = match.selectedAttackId ? cardFor(match.selectedAttackId) : null;\n  const pendingAttackZones = pendingAttack\n    ? previewQuickDuelPlaytestCharacterAttackZones(match, "player", pendingAttack, nonCharacterAttackAllowedZones(player, pendingAttack), cardFor)\n    : [];\n  const currentLocation = cardFor(match.locationId);'''
assert old in text, 'pendingAttack derived block not found'
text = text.replace(old, new, 1)
old = '''        {match.phase === "reversal-window" && pendingAttack?.zone?.includes("Any") && <div className="hand-context-strip"><span>Choose reversal zone</span><fieldset className="zone-picker"><legend className="sr-only">Reversal zone</legend>{["High", "Mid", "Low"].map((zone) => <button type="button" className={match.selectedZone === zone ? "is-selected" : ""} onClick={() => setMatch((current) => current ? { ...current, selectedZone: zone } : current)} key={zone}>{zone}</button>)}</fieldset></div>}\n        {match.phase === "player-yell" && !match.pendingDiscard && pendingAttack && attackHasFlexibleZone(player, pendingAttack) && <div className="hand-context-strip"><span>Declare zone for {pendingAttack.name}</span><fieldset className="zone-picker"><legend className="sr-only">Attack zone</legend>{["High", "Mid", "Low"].map((zone) => <button type="button" className={match.selectedZone === zone ? "is-selected" : ""} onClick={() => setMatch((current) => current ? { ...current, selectedZone: zone } : current)} key={zone}>{zone}</button>)}</fieldset></div>}'''
new = '''        {match.phase === "reversal-window" && pendingAttack && pendingAttackZones.length > 1 && <div className="hand-context-strip"><span>Choose reversal zone</span><fieldset className="zone-picker"><legend className="sr-only">Reversal zone</legend>{pendingAttackZones.map((zone) => <button type="button" className={match.selectedZone === zone ? "is-selected" : ""} onClick={() => setMatch((current) => current ? { ...current, selectedZone: zone, pendingCharacterAttackDeclaration: null } : current)} key={zone}>{zone}</button>)}</fieldset></div>}\n        {match.phase === "player-yell" && !match.pendingDiscard && pendingAttack && pendingAttackZones.length > 1 && <div className="hand-context-strip"><span>Declare zone for {pendingAttack.name}</span><fieldset className="zone-picker"><legend className="sr-only">Attack zone</legend>{pendingAttackZones.map((zone) => <button type="button" className={match.selectedZone === zone ? "is-selected" : ""} onClick={() => setMatch((current) => current ? { ...current, selectedZone: zone, pendingCharacterAttackDeclaration: null } : current)} key={zone}>{zone}</button>)}</fieldset></div>}'''
assert old in text, 'zone picker render block not found'
text = text.replace(old, new, 1)

# Clear a cached declaration when abandoning the selected Attack/Reversal.
text = text.replace('{ selectedAttackId: null, player: { ...current.player, reversalAttackBonus: 0 } }', '{ selectedAttackId: null, pendingCharacterAttackDeclaration: null, player: { ...current.player, reversalAttackBonus: 0 } }', 1)
text = text.replace('{ phase: "player-ascend", selectedAttackId: null, player:', '{ phase: "player-ascend", selectedAttackId: null, pendingCharacterAttackDeclaration: null, player:', 1)

assert 'characterAttackModifier(' not in text
assert 'characterAllowedAttackZones(' not in text
assert 'fighterAttackModifier(' not in text
assert 'attackHasFlexibleZone(' not in text
assert text.count('publishQuickDuelPlaytestAttackDeclared(') >= 3
path.write_text(text)

# -----------------------------------------------------------------------------
# Certification guards: there are no compatibility-owned Character resolvers.
# -----------------------------------------------------------------------------
path = Path('tests/quick-duel-character-migration.test.mjs')
text = path.read_text()
old = '''test("temporary compatibility ownership only names real canonical structured resolvers", () => {\n  for (const [helper, resolvers] of Object.entries(QUICK_DUEL_CHARACTER_COMPATIBILITY_RESOLVERS)) {\n    assert.ok(resolvers.length > 0, `${helper} must own at least one resolver while it remains in Quick Duel`);\n    for (const resolver of resolvers) assert.ok(canonicalResolvers.includes(resolver), `${helper} owns unknown resolver ${resolver}`);\n  }\n});'''
new = '''test("Stage 3E leaves no Character resolver in temporary compatibility ownership", () => {\n  assert.deepEqual(QUICK_DUEL_CHARACTER_COMPATIBILITY_RESOLVERS, {});\n  assert.deepEqual(quickDuelCompatibilityOwnedResolvers(), []);\n  assert.deepEqual(quickDuelEventRuntimeOwnedResolvers(), canonicalResolvers);\n});'''
assert old in text, 'migration compatibility ownership test not found'
text = text.replace(old, new, 1)
old = '''test("compatibility ownership mirrors the direct Character helpers still used by Playtest", () => {\n  for (const helper of Object.keys(QUICK_DUEL_CHARACTER_COMPATIBILITY_RESOLVERS)) {\n    assert.match(playtestSource, new RegExp(`\\\\b${helper}\\\\s*\\\\(`), `${helper} should remain compatibility-owned only while Playtest calls it directly`);\n  }\n});'''
if old in text:
  text = text.replace(old, '''test("Playtest no longer calls the temporary Character compatibility helpers", () => {\n  assert.doesNotMatch(playtestSource, /characterAllowedAttackZones\\s*\\(/);\n  assert.doesNotMatch(playtestSource, /characterAttackModifier\\s*\\(/);\n});''', 1)
else:
  # tolerate exact escaping emitted by the current file
  marker = 'test("compatibility ownership mirrors the direct Character helpers still used by Playtest", () => {'
  s = text.index(marker); e = text.index('\n});', s) + 4
  text = text[:s] + '''test("Playtest no longer calls the temporary Character compatibility helpers", () => {\n  assert.doesNotMatch(playtestSource, /characterAllowedAttackZones\\s*\\(/);\n  assert.doesNotMatch(playtestSource, /characterAttackModifier\\s*\\(/);\n});''' + text[e:]
old = '''  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("attackDeclared"), true);\n  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("damageIncoming"), false);\n  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("equip"), false);'''
new = '''  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("attackDeclared"), false);\n  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("damageIncoming"), false);\n  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("equip"), false);'''
assert old in text
text = text.replace(old, new, 1)
path.write_text(text)

path = Path('tests/quick-duel-character-executor.test.mjs')
text = path.read_text()
start = text.index('test("migration-safe Character publisher refuses compatibility-conflicted pre-action events"')
end = text.index('\n\ntest("non-overlapping Character events publish', start)
text = text[:start] + '''test("Stage 3E has no compatibility-conflicted Character pre-action events", () => {\n  for (const type of ["attackDeclared", "damageIncoming", "equip"]) {\n    const publication = publishQuickDuelCharacterEventSafely(board(), board("opponent"), { type }, "player");\n    assert.equal(publication.published, true, type);\n    assert.equal(publication.conflict, false, type);\n    assert.ok(publication.result, type);\n  }\n});''' + text[end:]
path.write_text(text)

# Dedicated attack declaration canaries.
Path('tests/quick-duel-character-attack-declared-host.test.mjs').write_text(r'''import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  previewQuickDuelPlaytestCharacterAttackZones,
  publishQuickDuelPlaytestAttackDeclared,
  resolveQuickDuelPlaytestCharacterChoice,
} from "../app/quick-duel-playtest-host.ts";
import { quickDuelCompatibilityOwnedResolvers, quickDuelCharacterEventHasCompatibilityConflict } from "../app/quick-duel-character-migration.ts";

const cards = new Map([
  ["kick", { id:"kick", name:"Kick", cardType:"Attack", subtype:"Technique", zone:"High", tags:["Kick"] }],
  ["spin", { id:"spin", name:"Spin", cardType:"Attack", subtype:"Technique", zone:"High", tags:["Spin"] }],
  ["kata", { id:"kata", name:"Kata", cardType:"Kata", subtype:"Kata", zone:null, tags:[] }],
  ["weapon", { id:"weapon", name:"Weapon", cardType:"Item", subtype:"Weapon", zone:null, tags:["Weapon"] }],
]);
const lookup = (id) => cards.get(id) ?? null;
function board(overrides = {}) { return { fighterId:"DDB-CHR-CORE-001", belt:3, hp:10, maxHp:10, xp:0, focus:0, tempSpeed:0, nextAttackBonus:0, nextDefenseCardBonus:0, nextAttackAnyZone:false, nextAttackHasFlow:false, attacksThisTurn:0, zonesPlayed:[], cardsThisTurn:[], equipment:[], exhaustedEquipment:[], hand:[], deck:[], discard:[], destroyed:[], usedConsumableThisRound:false, wasHitSinceLastTurn:false, damageReductionUsed:false, reversalAttackBonus:0, borrowedEquipmentId:null, abilityUsedRound:false, usedCharacterEffectIdsThisTurn:[], usedCharacterEffectIdsThisRound:[], usedCharacterEffectIdsThisGame:[], characterMarks:{}, learnedCombos:[], triggeredCombos:[], stage3cStatuses:[], stage3cChoices:[], stage3cRestrictions:[], ...overrides }; }
function match(player=board(), ai=board()) { return { player, ai, lastExchange:null, locationId:"loc", round:1, turnIndex:0 }; }

test("Character zone preview is canonical: Glitterpunch gets Mid only, Whirlwind gets Any on first Spin", () => {
  const glitter = match(board({ fighterId:"DDB-CHR-CORE-013" }));
  assert.deepEqual(previewQuickDuelPlaytestCharacterAttackZones(glitter, "player", cards.get("kick"), ["High"], lookup), ["High","Mid"]);
  const whirlwind = match(board({ fighterId:"DDB-CHR-CORE-041" }));
  assert.deepEqual(previewQuickDuelPlaytestCharacterAttackZones(whirlwind, "player", cards.get("spin"), ["High"], lookup), ["High","Mid","Low"]);
});

test("Miss Direction exposes alternate zones only when the discard cost can actually be paid", () => {
  const withCard = match(board({ fighterId:"DDB-CHR-CORE-025", hand:["discard-me"] }));
  const empty = match(board({ fighterId:"DDB-CHR-CORE-025", hand:[] }));
  assert.deepEqual(previewQuickDuelPlaytestCharacterAttackZones(withCard, "player", cards.get("kick"), ["High"], lookup), ["High","Mid","Low"]);
  assert.deepEqual(previewQuickDuelPlaytestCharacterAttackZones(empty, "player", cards.get("kick"), ["High"], lookup), ["High"]);
});

test("Miss Direction pauses declaration for the discard cost, then resumes with canonical changed-zone state", () => {
  const current = match(board({ fighterId:"DDB-CHR-CORE-025", hand:["discard-me"] }));
  const declared = publishQuickDuelPlaytestAttackDeclared(current, "player", cards.get("kick"), "Low", 5, lookup);
  assert.equal(declared.choices.length, 1);
  assert.equal(declared.choices[0].optional, false);
  const resolved = resolveQuickDuelPlaytestCharacterChoice(declared.match, "player", declared.event, declared.choices[0], "discard-me");
  assert.equal(resolved.event?.changedZone, true);
  assert.deepEqual(resolved.match.player.hand, []);
  assert.deepEqual(resolved.match.player.discard, ["discard-me"]);
});

test("declaration power uses the selected zone and canonical Character state", () => {
  const karatesaurus = match(board({ fighterId:"DDB-CHR-CORE-018", zonesPlayed:["Mid"] }));
  const kick = publishQuickDuelPlaytestAttackDeclared(karatesaurus, "player", cards.get("kick"), "Low", 5, lookup);
  assert.equal(kick.event?.attackPower, 6);
  assert.equal(kick.match.player.characterMarks?.["turn:kickBonus"], true);
  const punchline = match(board({ fighterId:"DDB-CHR-CORE-028", cardsThisTurn:["kata"] }));
  const punch = publishQuickDuelPlaytestAttackDeclared(punchline, "player", cards.get("kick"), "High", 5, lookup);
  assert.equal(punch.event?.attackPower, 6);
});

test("AI resolves declaration costs through the same generic runtime", () => {
  const current = match(board(), board({ fighterId:"DDB-CHR-CORE-025", hand:["discard-me"] }));
  const declared = publishQuickDuelPlaytestAttackDeclared(current, "ai", cards.get("kick"), "Low", 5, lookup);
  assert.equal(declared.choices.length, 0);
  assert.equal(declared.event?.changedZone, true);
  assert.deepEqual(declared.match.ai.hand, []);
});

test("Stage 3E attack declaration leaves no compatibility-owned Character resolver", () => {
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("attackDeclared"), false);
  assert.deepEqual(quickDuelCompatibilityOwnedResolvers(), []);
});

test("Quick Duel commits all three declaration paths through the generic host and removes legacy Character helpers", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.ok((source.match(/publishQuickDuelPlaytestAttackDeclared\(/g) ?? []).length >= 3);
  assert.doesNotMatch(source, /characterAttackModifier\s*\(/);
  assert.doesNotMatch(source, /characterAllowedAttackZones\s*\(/);
  assert.doesNotMatch(source, /fighterAttackModifier\s*\(/);
  assert.doesNotMatch(source, /structuredRuntimeResolvers\([^)]*character\.xpTrailFirstHit/);
  assert.match(source, /pendingCharacterAttackDeclaration/);
  assert.match(source, /continuation: "player-attack"/);
  assert.match(source, /continuation: "player-reversal"/);
  assert.doesNotMatch(source, /fighterId\s*===\s*["']DDB-CHR-CORE-/);
});
''')
