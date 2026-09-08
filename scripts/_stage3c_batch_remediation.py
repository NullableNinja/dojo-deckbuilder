from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)

# 1) Resolver semantics: Fine-Print cap, Painkiller expiry, context-aware mandatory discard.
resolver = Path("app/consumable-effect-resolvers.ts")
r = resolver.read_text()
r = replace_once(
    r,
    '    case "consumable.nextDamagePrevention":\n      command.qualifier = { nextDamageEvent: true };\n      command.duration = "nextDamage";\n      break;',
    '    case "consumable.nextDamagePrevention":\n      command.qualifier = { nextDamageEvent: true, ...(effect.duration === "endOfRound" ? { expires: "endOfRound" } : {}) };\n      command.duration = "nextDamage";\n      break;',
    "next damage expiry",
)
r = replace_once(
    r,
    '    case "consumable.revealTopFocusValue":\n      if (command.effect === "core.gainFocus") command.amount = Math.max(command.amount, Number(context.revealedFocusValue ?? command.amount));\n      break;',
    '    case "consumable.revealTopFocusValue":\n      if (command.effect === "core.gainFocus") command.amount = Number(context.revealedFocusValue ?? 0) >= 2 ? 2 : 1;\n      break;',
    "fine print reward",
)
r = replace_once(
    r,
    'export function structuredConsumableMandatoryDiscard(card: RuntimeCardLike) {\n  return consumableRuntimeCommands(card, "onPlay")',
    'export function structuredConsumableMandatoryDiscard(card: RuntimeCardLike, context: ConsumableRuntimeContext = {}) {\n  return consumableRuntimeCommands(card, "onPlay", context)',
    "mandatory discard context",
)
resolver.write_text(r)

# 2) Pure play-window helper so timing legality is testable instead of embedded in JSX.
Path("app/stage3c-consumable-play-window.ts").write_text('''import { consumableRuntimeCommands, type ConsumableRuntimeContext } from "./consumable-effect-resolvers.ts";\nimport type { RuntimeCardLike } from "./family-effect-runtime.ts";\n\nexport type ConsumableSurfacePhase = "player-yell" | "defense-window" | "player-ascend" | "player-initiate" | "reversal-window" | "ai-ready";\n\ntype TimedRuntimeCard = RuntimeCardLike & { timing?: string | null };\n\nexport function canPlayCoreConsumableInPhase(card: TimedRuntimeCard, phase: ConsumableSurfacePhase, context: ConsumableRuntimeContext = {}) {\n  const timing = String(card.timing ?? "").trim().toLocaleLowerCase();\n  if (phase === "player-yell") return timing === "turn" || timing === "anytime";\n  if (phase !== "defense-window") return false;\n  if (timing === "anytime") return true;\n  if (timing !== "reaction") return false;\n\n  const commands = consumableRuntimeCommands(card, "onPlay", {\n    ...context,\n    friendlyTargetCount: context.friendlyTargetCount ?? 1,\n    opponentTargetCount: context.opponentTargetCount ?? 1,\n  });\n  return commands.some((command) => command.effect === "combat.preventDamage" || command.effect === "combat.modifyDefense");\n}\n\nexport function stage3cRestrictionBlocks(restrictions: string[] | undefined, kind: "attack" | "consumable") {\n  return Boolean(restrictions?.includes(kind));\n}\n''')

# 3) Live play surface: actual top-card context, timing windows, restrictions, AI legality.
playtest = Path("app/playtest.tsx")
p = playtest.read_text()
p = replace_once(
    p,
    'import { consumableRuntimeCommands, type ConsumableRuntimeContext } from "./consumable-effect-resolvers";\n',
    'import { consumableRuntimeCommands, structuredConsumableMandatoryDiscard, type ConsumableRuntimeContext } from "./consumable-effect-resolvers";\nimport { canPlayCoreConsumableInPhase, stage3cRestrictionBlocks } from "./stage3c-consumable-play-window.ts";\n',
    "playtest imports",
)
p = replace_once(
    p,
    '    sameTurnSourceActive: true,\n  };\n}',
    '    sameTurnSourceActive: true,\n    revealedFocusValue: board.deck.length ? cardFocus(cardFor(board.deck[board.deck.length - 1])) : 0,\n  };\n}',
    "revealed focus context",
)
p = replace_once(
    p,
    '  const playSupport = (id: string) => setMatch((current) => {\n    if (!current || current.phase !== "player-yell" || current.winner || current.pendingDiscard || current.pendingChoice) return current;\n    const card = cardFor(id);\n    if (!card || isAttack(card) || isDefense(card) || isPermanent(card)) return current;',
    '  const playSupport = (id: string) => setMatch((current) => {\n    if (!current || current.winner || current.pendingDiscard || current.pendingChoice) return current;\n    const card = cardFor(id);\n    if (!card || isAttack(card) || isDefense(card) || isPermanent(card)) return current;\n    const legalSupportPhase = current.phase === "player-yell"\n      ? (!isCoreConsumableCard(card) || canPlayCoreConsumableInPhase(card, "player-yell", stage3cConsumableContext(current.player)))\n      : current.phase === "defense-window" && isCoreConsumableCard(card) && canPlayCoreConsumableInPhase(card, "defense-window", stage3cConsumableContext(current.player));\n    if (!legalSupportPhase) return current;',
    "support phase gate",
)
p = replace_once(
    p,
    '    const mandatoryDiscard = mandatoryDiscardChoiceCount(card);',
    '    const mandatoryDiscard = isCoreConsumableCard(card)\n      ? structuredConsumableMandatoryDiscard(card, stage3cConsumableContext(supportEntryBoard))\n      : mandatoryDiscardChoiceCount(card);',
    "contextual mandatory discard",
)
p = replace_once(
    p,
    '  const declareAttack = () => setMatch((current) => {\n    if (!current?.selectedAttackId || current.phase !== "player-yell" || current.winner || current.pendingDiscard || current.pendingChoice) return current;',
    '  const declareAttack = () => setMatch((current) => {\n    if (!current?.selectedAttackId || current.phase !== "player-yell" || current.winner || current.pendingDiscard || current.pendingChoice || stage3cRestrictionBlocks(current.player.stage3cRestrictions, "attack")) return current;',
    "player attack restriction",
)
p = replace_once(
    p,
    '  const resolveReversal = () => setMatch((current) => {\n    if (!current || current.phase !== "reversal-window" || !current.selectedAttackId || current.player.reversalUsedRound) return current;',
    '  const resolveReversal = () => setMatch((current) => {\n    if (!current || current.phase !== "reversal-window" || !current.selectedAttackId || current.player.reversalUsedRound || stage3cRestrictionBlocks(current.player.stage3cRestrictions, "attack")) return current;',
    "reversal restriction",
)
p = replace_once(
    p,
    '  const runAiTurn = () => setMatch((current) => {\n    if (!current || current.phase !== "ai-ready" || current.winner) return current;\n    const prepared = prepareAiTurn(current);\n    const availableAttacks = prepared.ai.hand.filter((id) => { const card = cardFor(id); return Boolean(card && isAttack(card)); });',
    '  const runAiTurn = () => setMatch((current) => {\n    if (!current || current.phase !== "ai-ready" || current.winner) return current;\n    const prepared = prepareAiTurn(current);\n    const availableAttacks = stage3cRestrictionBlocks(prepared.ai.stage3cRestrictions, "attack")\n      ? []\n      : prepared.ai.hand.filter((id) => { const card = cardFor(id); return Boolean(card && isAttack(card)); });',
    "ai attack restriction",
)
p = replace_once(
    p,
    '  const supportIds = nextAi.hand.filter((id) => {\n    const card = cardFor(id);\n    return Boolean(card && !isAttack(card) && !isDefense(card) && card.subtype !== "Junk" && !(fighter?.name === "Knuckleton the Brawler" && isWeapon(card)));\n  });',
    '  const supportIds = nextAi.hand.filter((id) => {\n    const card = cardFor(id);\n    if (!card || isAttack(card) || isDefense(card) || card.subtype === "Junk" || (fighter?.name === "Knuckleton the Brawler" && isWeapon(card))) return false;\n    if (isCoreConsumableCard(card)) return canPlayCoreConsumableInPhase(card, "player-yell", stage3cConsumableContext(nextAi));\n    return true;\n  });',
    "ai timing filter",
)
p = replace_once(
    p,
    '  for (const id of supportIds) {\n    const card = cardFor(id);\n    if (!card) continue;',
    '  for (const id of supportIds) {\n    const card = cardFor(id);\n    if (!card) continue;\n    if (isCoreConsumableCard(card) && stage3cRestrictionBlocks(nextAi.stage3cRestrictions, "consumable")) continue;',
    "ai consumable lockout",
)
p = replace_once(
    p,
    '    if (match.phase === "defense-window") {\n      if (match.pendingStrike && legalDefenseIds(match.player, match.pendingStrike.zone).includes(id)) resolveDefense(id);\n      return;\n    }',
    '    if (match.phase === "defense-window") {\n      if (isCoreConsumableCard(card) && canPlayCoreConsumableInPhase(card, "defense-window", stage3cConsumableContext(match.player))) playSupport(id);\n      else if (match.pendingStrike && legalDefenseIds(match.player, match.pendingStrike.zone).includes(id)) resolveDefense(id);\n      return;\n    }',
    "defense-window consumables",
)
p = replace_once(
    p,
    '          const canUse = match.phase === "player-yell" && (attack || (defense ? !player.defensePracticeUsed : !permanent));\n          const canDefend = match.phase === "defense-window" && defenseOptions.includes(id);\n          const canReverse = match.phase === "reversal-window" && attack;\n          return <PlayCard key={`${id}-${index}`} card={card} selected={match.selectedAttackId === id} disabled={choosingEffect ? true : choosingDiscard ? false : match.phase === "defense-window" ? !canDefend : match.phase === "reversal-window" ? !canReverse : match.phase === "player-initiate" ? !canInitiate : !canUse}',
    '          const attackAllowed = !stage3cRestrictionBlocks(player.stage3cRestrictions, "attack");\n          const consumableAllowed = !isCoreConsumableCard(card) || (!stage3cRestrictionBlocks(player.stage3cRestrictions, "consumable") && canPlayCoreConsumableInPhase(card, "player-yell", stage3cConsumableContext(player)));\n          const canUse = match.phase === "player-yell" && (attack ? attackAllowed : (defense ? !player.defensePracticeUsed : !permanent && consumableAllowed));\n          const canDefend = match.phase === "defense-window" && defenseOptions.includes(id);\n          const canReactConsumable = match.phase === "defense-window" && isCoreConsumableCard(card) && !stage3cRestrictionBlocks(player.stage3cRestrictions, "consumable") && canPlayCoreConsumableInPhase(card, "defense-window", stage3cConsumableContext(player));\n          const canReverse = match.phase === "reversal-window" && attack && attackAllowed;\n          return <PlayCard key={`${id}-${index}`} card={card} selected={match.selectedAttackId === id} disabled={choosingEffect ? true : choosingDiscard ? false : match.phase === "defense-window" ? !(canDefend || canReactConsumable) : match.phase === "reversal-window" ? !canReverse : match.phase === "player-initiate" ? !canInitiate : !canUse}',
    "hand legality rendering",
)
playtest.write_text(p)

# 4) Permanent tests for the batch.
unit = Path("tests/stage3c-defense-consumable-runtime.test.mjs")
u = unit.read_text()
if 'Stage 3C batch: reveal rewards, round-bounded prevention, and Tempo cycling' not in u:
    u += r'''\n\ntest("Stage 3C batch: reveal rewards, round-bounded prevention, and Tempo cycling", () => {\n  const cookie = card("DDB-CON-CORE-020");\n  for (const [revealedFocusValue, expected] of [[0, 1], [1, 1], [2, 2], [3, 2]]) {\n    const command = consumableRuntimeCommands(cookie, "onPlay", { ...consumableBaseContext, revealedFocusValue })\n      .find((entry) => entry.sourceEffectId === "consumable-fine-print-fortune-focus");\n    assert.equal(command?.amount, expected);\n  }\n\n  const painkiller = consumableRuntimeCommands(card("DDB-CON-CORE-041"), "onPlay", consumableBaseContext)\n    .find((entry) => entry.sourceEffectId === "consumable-painkiller-prevent");\n  assert.equal(painkiller?.duration, "nextDamage");\n  assert.equal(painkiller?.qualifier?.expires, "endOfRound");\n\n  assert.equal(structuredConsumableMandatoryDiscard(card("DDB-CON-CORE-040"), { ...consumableBaseContext, hasTempo: true }), 1);\n  assert.equal(structuredConsumableMandatoryDiscard(card("DDB-CON-CORE-040"), { ...consumableBaseContext, hasTempo: false }), 0);\n});\n'''
    u = u.replace('  structuredConsumableDestroyJunkPlan,\n}', '  structuredConsumableDestroyJunkPlan,\n  structuredConsumableMandatoryDiscard,\n}')
unit.write_text(u)

window_test = Path("tests/stage3c-consumable-play-window.test.mjs")
window_test.write_text(r'''import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\nimport { canPlayCoreConsumableInPhase, stage3cRestrictionBlocks } from "../app/stage3c-consumable-play-window.ts";\n\nconst cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];\nconst card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);\n\ntest("Consumable surface timing distinguishes Yell, Anytime, incoming Reaction, and event-specific Reaction cards", () => {\n  assert.equal(canPlayCoreConsumableInPhase(card("DDB-CON-CORE-052"), "player-yell"), true); // Turn\n  assert.equal(canPlayCoreConsumableInPhase(card("DDB-CON-CORE-003"), "player-yell"), true); // Anytime\n  assert.equal(canPlayCoreConsumableInPhase(card("DDB-CON-CORE-030"), "player-yell"), false); // Ascend\n  assert.equal(canPlayCoreConsumableInPhase(card("DDB-CON-CORE-005"), "player-yell"), false); // Reaction\n\n  for (const catalogId of ["DDB-CON-CORE-005", "DDB-CON-CORE-016", "DDB-CON-CORE-036", "DDB-CON-CORE-041", "DDB-CON-CORE-047"]) {\n    assert.equal(canPlayCoreConsumableInPhase(card(catalogId), "defense-window"), true, `${catalogId} should be legal in an incoming Attack Reaction Window`);\n  }\n  for (const catalogId of ["DDB-CON-CORE-001", "DDB-CON-CORE-017", "DDB-CON-CORE-033", "DDB-CON-CORE-049"]) {\n    assert.equal(canPlayCoreConsumableInPhase(card(catalogId), "defense-window"), false, `${catalogId} needs its specific event hook instead of the generic incoming-Attack window`);\n  }\n  assert.equal(canPlayCoreConsumableInPhase(card("DDB-CON-CORE-057"), "defense-window"), true); // Anytime\n});\n\ntest("Stage 3C restrictions are shared rules, not UI-only disabling", () => {\n  assert.equal(stage3cRestrictionBlocks(["attack"], "attack"), true);\n  assert.equal(stage3cRestrictionBlocks(["consumable"], "consumable"), true);\n  assert.equal(stage3cRestrictionBlocks([], "attack"), false);\n});\n''')

integration = Path("tests/playtest-effect-integration.test.mjs")
i = integration.read_text()
if 'Quick Duel gates Consumable timing and attack restrictions through shared Stage 3C helpers' not in i:
    i += r'''\n\ntest("Quick Duel gates Consumable timing and attack restrictions through shared Stage 3C helpers", async () => {\n  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");\n  assert.match(source, /canPlayCoreConsumableInPhase\(card, "defense-window"/);\n  assert.match(source, /stage3cRestrictionBlocks\(current\.player\.stage3cRestrictions, "attack"\)/);\n  assert.match(source, /stage3cRestrictionBlocks\(prepared\.ai\.stage3cRestrictions, "attack"\)/);\n  assert.match(source, /structuredConsumableMandatoryDiscard\(card, stage3cConsumableContext\(supportEntryBoard\)\)/);\n  assert.match(source, /revealedFocusValue: board\.deck\.length \? cardFocus\(cardFor\(board\.deck\[board\.deck\.length - 1\]\)\) : 0/);\n});\n'''
integration.write_text(i)
