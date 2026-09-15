from pathlib import Path
import json
import re

# Canonical Character source: add the missing Green-belt linked XP effect.
p = Path('content/card-effects/characters.json')
data = json.loads(p.read_text())
ronin = data['cards']['DDB-CHR-CORE-029']
effects = ronin['effects']
assert any(e.get('resolver') == 'character.revealReplacementOnceGame' for e in effects)
if not any(e.get('resolver') == 'character.green.linkedLocationReplacementXp' for e in effects):
    effects.append({
        'id': 'character-ronin-green-location-xp',
        'effect': 'core.gainXP',
        'trigger': 'passive',
        'target': 'self',
        'amount': 1,
        'duration': 'immediate',
        'resolver': 'character.green.linkedLocationReplacementXp',
    })
p.write_text(json.dumps(data, separators=(',', ':')) + '\n')

# Runtime event contract + resolver ownership.
p = Path('app/character-runtime.ts')
text = p.read_text()
text = text.replace(
    '| "kataPlayed" | "comboReveal" | "purchaseAttempt" | "promotion" | "sceneChange" | "reboot" | "hide";',
    '| "kataPlayed" | "comboReveal" | "purchaseAttempt" | "promotion" | "sceneChange" | "reveal" | "reboot" | "hide";'
)
if 'revealSource?: "market" | "location";' not in text:
    text = text.replace(
        '  replacementId?: string | null;\n',
        '  replacementId?: string | null;\n  revealSource?: "market" | "location";\n  replacementAvailable?: boolean;\n  replacementRequested?: boolean;\n  replacementResolved?: boolean;\n'
    )
text = text.replace(
    '  "character.revealReplacementOnceGame": ["sceneChange", "purchaseAttempt"],',
    '  "character.revealReplacementOnceGame": ["reveal"],\n  "character.green.linkedLocationReplacementXp": ["reveal"],'
)
old = '''      case "character.revealReplacementOnceGame": {\n        if (!event.replacementId) break;\n        const accept = event.optionalAccepted ?? (actor === "ai" ? true : undefined);\n        if (accept === undefined) choices.push(makeChoice(effect, "Discard this reveal and replace it from the same deck?", ["accept", "skip"], true, "optionalAccepted"));\n        else if (accept) { event.selectedId = event.replacementId; activated = true; }\n        break;\n      }'''
new = '''      case "character.revealReplacementOnceGame": {\n        if (!event.card || !event.revealSource || !event.replacementAvailable || event.replacementResolved) break;\n        const accept = event.optionalAccepted ?? (actor === "ai" ? true : undefined);\n        if (accept === undefined) choices.push(makeChoice(effect, "Discard this reveal and replace it from the same deck?", ["accept", "skip"], true, "optionalAccepted"));\n        else if (accept) { event.replacementRequested = true; activated = true; }\n        break;\n      }\n      case "character.green.linkedLocationReplacementXp":\n        if (event.replacementResolved && event.revealSource === "location") { self = { ...self, xp: self.xp + amount }; activated = true; }\n        break;'''
if old in text:
    text = text.replace(old, new, 1)
else:
    assert 'event.replacementRequested = true' in text, 'Ronin resolver block not found'
p.write_text(text)

# Generic Quick Duel reveal publisher. The runtime sees only the public card and
# same-deck availability; AI uses the same generic choice contract.
p = Path('app/quick-duel-playtest-host.ts')
text = p.read_text()
if 'export type QuickDuelPlaytestRevealFacts' not in text:
    text += '''\n\nexport type QuickDuelPlaytestRevealFacts = {\n  cardId: string;\n  revealSource: "market" | "location";\n  replacementAvailable: boolean;\n  replacementResolved?: boolean;\n};\n\n/**\n * Publishes a public Market/Location reveal without exposing the identity of\n * the hidden replacement card before a Character accepts the reroll.\n */\nexport function publishQuickDuelPlaytestReveal<\n  Board extends QuickDuelComboMatchBoard & CharacterRuntimeBoard,\n  Match extends QuickDuelPlaytestHostMatch<Board>,\n>(\n  match: Match,\n  actor: QuickDuelPlaytestActor,\n  facts: QuickDuelPlaytestRevealFacts,\n  cardLookup: QuickDuelCharacterCardLookup = runtimeCardFor,\n): QuickDuelPlaytestCharacterEventResult<Match> {\n  const event: CharacterRuntimeEvent = {\n    type: "reveal",\n    card: cardLookup(facts.cardId) ?? { id: facts.cardId },\n    revealSource: facts.revealSource,\n    replacementAvailable: facts.replacementAvailable,\n    replacementResolved: facts.replacementResolved,\n  };\n  let character = publishQuickDuelPlaytestCharacterEvent(match, actor, event);\n  if (actor === "ai") {\n    for (let guard = 0; guard < 8 && character.event && character.choices.length > 0; guard += 1) {\n      const choice = character.choices[0];\n      const selection = chooseAiCharacterOption(choice);\n      if (selection === null) break;\n      character = resolveQuickDuelPlaytestCharacterChoice(\n        character.match,\n        actor,\n        character.event,\n        choice,\n        selection,\n      );\n    }\n  }\n  return character;\n}\n'''
p.write_text(text)

# Route inventory: reveal is a real transition publication seam.
p = Path('app/quick-duel-character-event-routes.ts')
text = p.read_text()
anchor = '  { event: "sceneChange", timing: "pre-action", hostFact: "new Location reveal before it becomes final", reason: "Location replacement/reveal abilities require the candidate before final scene commitment." },\n'
if '{ event: "reveal",' not in text:
    assert anchor in text, 'sceneChange route anchor missing'
    text = text.replace(
        anchor,
        anchor + '  { event: "reveal", timing: "transition", hostFact: "public Market or Location card reveal plus same-deck replacement availability", reason: "Reveal reactions see only the public card; hidden replacement identity stays undisclosed until acceptance." },\n',
        1,
    )
p.write_text(text)

# Playtest integration: route public reveals generically, then touch the deck only after acceptance.
p = Path('app/playtest.tsx')
text = p.read_text()
old_import = 'import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestLifecycleEvent, resolveQuickDuelPlaytestCharacterChoice } from "./quick-duel-playtest-host";'
new_import = 'import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestLifecycleEvent, publishQuickDuelPlaytestReveal, resolveQuickDuelPlaytestCharacterChoice } from "./quick-duel-playtest-host";'
assert old_import in text or new_import in text, 'Quick Duel host import anchor missing'
text = text.replace(old_import, new_import, 1)

refill_anchor = '''function refillPurchasedMarketSlot(market: string[], marketDeck: string[], marketDiscard: string[], slot: number) {\n  const refill = revealMarketCards(marketDeck, marketDiscard, 1);\n  const nextMarket = [...market];\n  nextMarket[slot] = refill.revealed[0] ?? "";\n  return { market: nextMarket.filter(Boolean), marketDeck: refill.marketDeck, marketDiscard: refill.marketDiscard };\n}\n'''
helpers = '''\ntype QuickDuelPublicRevealSource = "market" | "location";\n\nfunction quickDuelPublicRevealReplacementAvailable(current: Match, revealSource: QuickDuelPublicRevealSource) {\n  return revealSource === "market"\n    ? current.marketDeck.length + current.marketDiscard.length > 0\n    : current.locations.length > 0;\n}\n\nfunction offerLuckyAfterPublicReveal(current: Match, revealSource: QuickDuelPublicRevealSource, revealedCardId: string): Match {\n  if (current.pendingChoice) return current;\n  const lucky = current.player.hand\n    .map(cardFor)\n    .find((candidate): candidate is CardEntry => Boolean(candidate && candidate.catalogId === "DDB-CON-CORE-033"));\n  if (!lucky) return current;\n  const marketSlot = revealSource === "market" ? current.market.indexOf(revealedCardId) : undefined;\n  if (revealSource === "market" && (marketSlot ?? -1) < 0) return current;\n  const label = cardFor(revealedCardId)?.name ?? (revealSource === "market" ? "A Market card" : "A Location");\n  return {\n    ...current,\n    pendingChoice: {\n      kind: "stage3c-lucky-reveal",\n      sourceCardId: lucky.id,\n      revealKind: revealSource,\n      revealedCardId,\n      ...(marketSlot !== undefined ? { marketSlot } : {}),\n    },\n    log: [`${label} was revealed. Lucky Dumpling may replace it.`, ...current.log].slice(0, 32),\n  };\n}\n\nfunction replaceAcceptedPublicReveal(\n  current: Match,\n  event: CharacterRuntimeEvent,\n  actor: "player" | "ai",\n): Match {\n  const revealSource = event.revealSource;\n  const revealedCardId = event.card?.id;\n  if (!event.replacementRequested || !revealSource || !revealedCardId) return current;\n\n  let replacementId: string | null = null;\n  let replaced = current;\n  if (revealSource === "market") {\n    const slot = current.market.indexOf(revealedCardId);\n    if (slot < 0) return current;\n    const refill = revealMarketCards(current.marketDeck, [...current.marketDiscard, revealedCardId], 1);\n    replacementId = refill.revealed[0] ?? null;\n    if (!replacementId) return current;\n    const market = [...current.market];\n    market[slot] = replacementId;\n    replaced = { ...current, market, marketDeck: refill.marketDeck, marketDiscard: refill.marketDiscard };\n  } else {\n    replacementId = current.locations[0] ?? null;\n    if (!replacementId) return current;\n    replaced = { ...current, locationId: replacementId, locations: current.locations.slice(1) };\n  }\n\n  const resolved = publishQuickDuelPlaytestReveal(\n    replaced,\n    actor,\n    {\n      cardId: replacementId,\n      revealSource,\n      replacementAvailable: quickDuelPublicRevealReplacementAvailable(replaced, revealSource),\n      replacementResolved: true,\n    },\n    cardFor,\n  );\n  const replacementLabel = cardFor(replacementId)?.name ?? "a replacement";\n  const next = {\n    ...resolved.match,\n    log: [`Character reroll replaces ${cardFor(revealedCardId)?.name ?? "the reveal"} with ${replacementLabel}.`, ...resolved.match.log].slice(0, 32),\n  } as Match;\n  return hostQuickDuelPublicReveal(next, revealSource, replacementId);\n}\n\nfunction hostQuickDuelPublicReveal(\n  current: Match,\n  revealSource: QuickDuelPublicRevealSource,\n  revealedCardId: string,\n  skipPlayer = false,\n): Match {\n  if (current.pendingChoice) return current;\n  const replacementAvailable = quickDuelPublicRevealReplacementAvailable(current, revealSource);\n  let next = current;\n\n  if (!skipPlayer) {\n    const playerReveal = publishQuickDuelPlaytestReveal(\n      next,\n      "player",\n      { cardId: revealedCardId, revealSource, replacementAvailable },\n      cardFor,\n    );\n    next = playerReveal.match;\n    if (playerReveal.event && playerReveal.choices[0]) {\n      return {\n        ...next,\n        pendingChoice: { kind: "character-runtime", event: playerReveal.event, choice: playerReveal.choices[0] },\n      };\n    }\n  }\n\n  const aiReveal = publishQuickDuelPlaytestReveal(\n    next,\n    "ai",\n    { cardId: revealedCardId, revealSource, replacementAvailable },\n    cardFor,\n  );\n  next = aiReveal.match;\n  if (aiReveal.event?.replacementRequested) return replaceAcceptedPublicReveal(next, aiReveal.event, "ai");\n  return offerLuckyAfterPublicReveal(next, revealSource, revealedCardId);\n}\n\nfunction continuePublicRevealAfterPlayerChoice(current: Match, event: CharacterRuntimeEvent): Match {\n  if (event.type !== "reveal" || !event.revealSource || !event.card?.id) return current;\n  if (event.replacementRequested) return replaceAcceptedPublicReveal(current, event, "player");\n  return hostQuickDuelPublicReveal(current, event.revealSource, event.card.id, true);\n}\n'''
if 'function hostQuickDuelPublicReveal(' not in text:
    assert refill_anchor in text, 'Market refill helper anchor missing'
    text = text.replace(refill_anchor, refill_anchor + helpers, 1)

old_purchase = '''    const purchased = write(current, `Bought ${card.name} for ${characterPurchase.price} Focus (${focusBefore} → ${nextPlayer.focus}). The top Market card immediately fills the slot.`, { player: nextPlayer, ai: characterPurchase.opponent, ...refilled, marketPurchasedThisRound: true });\n    const revealedId = refilled.market[slot];\n    const lucky = revealedId ? nextPlayer.hand.map(cardFor).find((candidate): candidate is CardEntry => Boolean(candidate && candidate.catalogId === "DDB-CON-CORE-033")) : null;\n    return lucky && revealedId ? write(purchased, `${cardFor(revealedId)?.name ?? "A Market card"} was revealed. Lucky Dumpling may replace it.`, { pendingChoice: { kind: "stage3c-lucky-reveal", sourceCardId: lucky.id, revealKind: "market", revealedCardId: revealedId, marketSlot: slot } }) : purchased;'''
new_purchase = '''    const purchased = write(current, `Bought ${card.name} for ${characterPurchase.price} Focus (${focusBefore} → ${nextPlayer.focus}). The top Market card immediately fills the slot.`, { player: nextPlayer, ai: characterPurchase.opponent, ...refilled, marketPurchasedThisRound: true });\n    const revealedId = refilled.market[slot];\n    return revealedId ? hostQuickDuelPublicReveal(purchased, "market", revealedId) : purchased;'''
if old_purchase in text:
    text = text.replace(old_purchase, new_purchase, 1)
else:
    assert 'hostQuickDuelPublicReveal(purchased, "market", revealedId)' in text, 'Player Market reveal block missing'

pattern = re.compile(
    r'  const lucky = initiatedPlayer\.hand\.map\(cardFor\).*?'
    r'  return advanced;\n}',
    re.S,
)
replacement = '''  if (!advanced.pendingChoice && sceneChanges && locationId !== current.locationId) {\n    return hostQuickDuelPublicReveal(advanced, "location", locationId);\n  }\n  if (!advanced.pendingChoice && marketRefreshes) {\n    const revealedId = marketState.market.find((id) => !current.market.includes(id));\n    if (revealedId) return hostQuickDuelPublicReveal(advanced, "market", revealedId);\n  }\n  return advanced;\n}'''
if 'return hostQuickDuelPublicReveal(advanced, "location", locationId);' not in text:
    text, count = pattern.subn(replacement, text, count=1)
    assert count == 1, 'Honor reveal reaction block missing'

old_choice_tail = '''    const selectedCard = cardFor(selection);\n    const label = selectedCard?.name ?? (["skip", "decline", "cancel"].includes(selection) ? "declined" : selection);\n    return write(resolved.match, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} resolves ${pending.choice.prompt}: ${label}.`, { pendingChoice });'''
new_choice_tail = '''    const selectedCard = cardFor(selection);\n    const label = selectedCard?.name ?? (["skip", "decline", "cancel"].includes(selection) ? "declined" : selection);\n    const logged = write(resolved.match, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} resolves ${pending.choice.prompt}: ${label}.`, { pendingChoice });\n    return resolved.event?.type === "reveal" && !nextChoice\n      ? continuePublicRevealAfterPlayerChoice(logged, resolved.event)\n      : logged;'''
if old_choice_tail in text:
    text = text.replace(old_choice_tail, new_choice_tail, 1)
else:
    assert 'continuePublicRevealAfterPlayerChoice(logged, resolved.event)' in text, 'Character choice continuation anchor missing'
p.write_text(text)

# Update stale runtime enforcement: request replacement after acceptance; never pre-peek its id.
p = Path('tests/character-runtime-enforcement.test.mjs')
text = p.read_text()
old_test = '''test("029 Ronin Reroll: replacement reveal is once per game", () => {\n  const first = applyCharacterRuntimeEvent(board("DDB-CHR-CORE-029"), board("opponent"), { type: "sceneChange", replacementId: "scene-2", optionalAccepted: true });\n  assert.equal(first.event.selectedId, "scene-2");\n  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "sceneChange", replacementId: "scene-3", optionalAccepted: true });\n  assert.equal(second.event.selectedId, undefined);\n});'''
new_test = '''test("029 Ronin Reroll: public reveal requests one hidden-safe replacement per game", () => {\n  const first = applyCharacterRuntimeEvent(board("DDB-CHR-CORE-029"), board("opponent"), {\n    type: "reveal",\n    card: { id: "scene-1" },\n    revealSource: "location",\n    replacementAvailable: true,\n    optionalAccepted: true,\n  });\n  assert.equal(first.event.replacementRequested, true);\n  assert.equal(first.event.replacementId, undefined);\n  assert.equal(first.event.selectedId, undefined);\n  const second = applyCharacterRuntimeEvent(first.self, first.opponent, {\n    type: "reveal",\n    card: { id: "scene-2" },\n    revealSource: "location",\n    replacementAvailable: true,\n    optionalAccepted: true,\n  });\n  assert.equal(second.event.replacementRequested, undefined);\n});'''
if old_test in text:
    text = text.replace(old_test, new_test, 1)
else:
    assert 'public reveal requests one hidden-safe replacement per game' in text, 'Stale Ronin enforcement test not found'
p.write_text(text)

# Extend focused Ronin tests through the generic Quick Duel publisher and live source seams.
p = Path('tests/quick-duel-character-ronin-reveal.test.mjs')
text = p.read_text()
if 'publishQuickDuelPlaytestReveal' not in text:
    text = text.replace(
        'import { applyCharacterRuntimeEvent } from "../app/character-runtime.ts";\n',
        'import { readFileSync } from "node:fs";\nimport { applyCharacterRuntimeEvent } from "../app/character-runtime.ts";\nimport { publishQuickDuelPlaytestReveal } from "../app/quick-duel-playtest-host.ts";\n',
        1,
    )
extra = '''\n\ntest("Quick Duel reveal host surfaces the player decision without exposing a replacement id", () => {\n  const match = { player: board(), ai: opponent };\n  const result = publishQuickDuelPlaytestReveal(match, "player", {\n    cardId: "market-visible",\n    revealSource: "market",\n    replacementAvailable: true,\n  }, (id) => id === "market-visible" ? marketCard : null);\n  assert.equal(result.choices.length, 1);\n  assert.equal(result.event?.replacementId, undefined);\n  assert.equal(result.event?.replacementRequested, undefined);\n});\n\ntest("Quick Duel reveal host auto-resolves the same legal Ronin choice for AI", () => {\n  const match = { player: opponent, ai: board() };\n  const result = publishQuickDuelPlaytestReveal(match, "ai", {\n    cardId: "location-visible",\n    revealSource: "location",\n    replacementAvailable: true,\n  }, (id) => id === "location-visible" ? locationCard : null);\n  assert.equal(result.choices.length, 0);\n  assert.equal(result.event?.replacementRequested, true);\n  assert.ok(result.match.ai.usedCharacterEffectIdsThisGame.includes("character-ronin-reroll"));\n});\n\ntest("Playtest routes real Market and Honor reveals through the generic reveal host", () => {\n  const source = readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");\n  assert.match(source, /hostQuickDuelPublicReveal\\(purchased, "market", revealedId\\)/);\n  assert.match(source, /hostQuickDuelPublicReveal\\(advanced, "location", locationId\\)/);\n  assert.match(source, /continuePublicRevealAfterPlayerChoice\\(logged, resolved\\.event\\)/);\n  assert.doesNotMatch(source, /DDB-CHR-CORE-029|Ronin Reroll/);\n});\n'''
if 'Quick Duel reveal host surfaces the player decision' not in text:
    text += extra
p.write_text(text)
