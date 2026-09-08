from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)

pfile = Path("app/playtest.tsx")
p = pfile.read_text()

p = replace_once(
    p,
    'import { canPlayCoreConsumableInPhase, stage3cRestrictionBlocks } from "./stage3c-consumable-play-window.ts";\n',
    'import { canPlayCoreConsumableInPhase, stage3cRestrictionBlocks } from "./stage3c-consumable-play-window.ts";\nimport { armConsumableAttackFollowupStatuses, isConsumableAttackFollowupStatus, resolveConsumableAttackFollowupStatuses } from "./stage3c-consumable-attack-followup.ts";\n',
    "followup import",
)

p = replace_once(
    p,
    'function stage3cConsumeAttackStatuses(board: Board, card: CardEntry, zone: string, isReversal = false) {\n  const consumed = new Set((board.stage3cStatuses ?? []).filter((status) => stage3cAttackStatusMatches(status, card, zone, isReversal)).map((status) => status.sourceEffectId));',
    'function stage3cConsumeAttackStatuses(board: Board, card: CardEntry, zone: string, isReversal = false) {\n  const consumed = new Set((board.stage3cStatuses ?? []).filter((status) => stage3cAttackStatusMatches(status, card, zone, isReversal) && !isConsumableAttackFollowupStatus(status)).map((status) => status.sourceEffectId));',
    "preserve followup watcher",
)

p = replace_once(
    p,
    '    if (isCoreConsumableCard(card)) nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve", stage3cConsumableContext(nextPlayer));\n    const playerFastestFocus',
    '    if (isCoreConsumableCard(card)) {\n      nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve", stage3cConsumableContext(nextPlayer));\n      nextPlayer = { ...nextPlayer, stage3cStatuses: armConsumableAttackFollowupStatuses(nextPlayer.stage3cStatuses ?? [], card) };\n    }\n    const playerFastestFocus',
    "arm player watcher",
)

p = replace_once(
    p,
    '      nextAi = applyCardEffects(nextAi, card, "ai", "afterResolve", stage3cConsumableContext(nextAi));\n      nextPlayer = applyStage3CTiming(nextPlayer, card, "onPlay", "player", stage3cConsumableContext(nextAi), "opponent");',
    '      nextAi = applyCardEffects(nextAi, card, "ai", "afterResolve", stage3cConsumableContext(nextAi));\n      nextAi = { ...nextAi, stage3cStatuses: armConsumableAttackFollowupStatuses(nextAi.stage3cStatuses ?? [], card) };\n      nextPlayer = applyStage3CTiming(nextPlayer, card, "onPlay", "player", stage3cConsumableContext(nextAi), "opponent");',
    "arm ai watcher",
)

p = replace_once(
    p,
    '    nextPlayer = applyCardEffects(nextPlayer, card, "player", hit ? "onHit" : "afterResolve");\n    if (hit) nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve");\n    const armorPenaltyGrant',
    '    nextPlayer = applyCardEffects(nextPlayer, card, "player", hit ? "onHit" : "afterResolve");\n    if (hit) nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve");\n    const consumableAttackFollowup = resolveConsumableAttackFollowupStatuses(nextPlayer.stage3cStatuses ?? [], { blocked: !hit, interferencePrevented: false });\n    nextPlayer = {\n      ...nextPlayer,\n      stage3cStatuses: consumableAttackFollowup.statuses,\n      hp: Math.max(0, nextPlayer.hp - consumableAttackFollowup.directSelfDamage),\n      damageTaken: nextPlayer.damageTaken + consumableAttackFollowup.directSelfDamage,\n    };\n    if (consumableAttackFollowup.focus) nextPlayer = gainFocus(nextPlayer, consumableAttackFollowup.focus);\n    const armorPenaltyGrant',
    "resolve player followup",
)

p = replace_once(
    p,
    '...targetDiscardNotes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...(reduced.note ? [reduced.note] : [])];',
    '...targetDiscardNotes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...consumableAttackFollowup.notes, ...(reduced.note ? [reduced.note] : [])];',
    "player followup notes",
)

p = replace_once(
    p,
    'winner: nextAi.hp ? null : "player" });',
    'winner: !nextPlayer.hp ? "ai" : nextAi.hp ? null : "player" });',
    "player self ko winner",
)

p = replace_once(
    p,
    '    nextAi = applyCardEffects(nextAi, aiCard, "ai", hit ? "onHit" : "afterResolve");\n    if (hit) nextAi = applyCardEffects(nextAi, aiCard, "ai", "afterResolve");\n    const armorPenaltyGrant',
    '    nextAi = applyCardEffects(nextAi, aiCard, "ai", hit ? "onHit" : "afterResolve");\n    if (hit) nextAi = applyCardEffects(nextAi, aiCard, "ai", "afterResolve");\n    const aiConsumableAttackFollowup = resolveConsumableAttackFollowupStatuses(nextAi.stage3cStatuses ?? [], { blocked: !hit, interferencePrevented: false });\n    nextAi = {\n      ...nextAi,\n      stage3cStatuses: aiConsumableAttackFollowup.statuses,\n      hp: Math.max(0, nextAi.hp - aiConsumableAttackFollowup.directSelfDamage),\n      damageTaken: nextAi.damageTaken + aiConsumableAttackFollowup.directSelfDamage,\n    };\n    if (aiConsumableAttackFollowup.focus) nextAi = gainFocus(nextAi, aiConsumableAttackFollowup.focus);\n    const armorPenaltyGrant',
    "resolve ai followup",
)

p = replace_once(
    p,
    '...targetDebuff.notes, ...aiCycleNotes, ...aiTriggeredEquipment.notes, ...(reduced.note ? [reduced.note] : []), ...preventionNotes];',
    '...targetDebuff.notes, ...aiCycleNotes, ...aiTriggeredEquipment.notes, ...aiConsumableAttackFollowup.notes, ...(reduced.note ? [reduced.note] : []), ...preventionNotes];',
    "ai followup notes",
)

p = replace_once(
    p,
    'winner: nextPlayer.hp ? null : "ai" });\n    if (!nextPlayer.hp) return resolved;',
    'winner: !nextAi.hp ? "player" : nextPlayer.hp ? null : "ai" });\n    if (!nextPlayer.hp || !nextAi.hp) return resolved;',
    "ai self ko winner",
)

pfile.write_text(p)

Path("tests/stage3c-consumable-attack-followup.test.mjs").write_text('''import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\nimport { armConsumableAttackFollowupStatuses, isConsumableAttackFollowupStatus, resolveConsumableAttackFollowupStatuses } from "../app/stage3c-consumable-attack-followup.ts";\n\nconst cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];\nconst card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);\n\ntest("Mystery Dojo Jerky arms one watched Attack and deals backlash only when Blocked", () => {\n  const armed = armConsumableAttackFollowupStatuses([], card("DDB-CON-CORE-037"));\n  assert.equal(armed.filter(isConsumableAttackFollowupStatus).length, 1);\n  const blocked = resolveConsumableAttackFollowupStatuses(armed, { blocked: true });\n  assert.equal(blocked.directSelfDamage, 1);\n  assert.equal(blocked.focus, 0);\n  assert.equal(blocked.statuses.some(isConsumableAttackFollowupStatus), false);\n  const hit = resolveConsumableAttackFollowupStatuses(armed, { blocked: false });\n  assert.equal(hit.directSelfDamage, 0);\n  assert.equal(hit.statuses.some(isConsumableAttackFollowupStatus), false);\n});\n\ntest("Pocket Yoyo awards its structured payoff when the watched Attack is still Blocked", () => {\n  const armed = armConsumableAttackFollowupStatuses([], card("DDB-CON-CORE-062"));\n  assert.equal(armed.filter(isConsumableAttackFollowupStatus).length, 1);\n  assert.equal(resolveConsumableAttackFollowupStatuses(armed, { blocked: true }).focus, 1);\n  assert.equal(resolveConsumableAttackFollowupStatuses(armed, { blocked: false }).focus, 0);\n});\n\ntest("Rubber Chicken awards the after-Attack Focus only when no Interfere was prevented", () => {\n  const armed = armConsumableAttackFollowupStatuses([], card("DDB-CON-CORE-046"));\n  assert.equal(armed.filter(isConsumableAttackFollowupStatus).length, 1);\n  assert.equal(resolveConsumableAttackFollowupStatuses(armed, { blocked: false, interferencePrevented: false }).focus, 1);\n  assert.equal(resolveConsumableAttackFollowupStatuses(armed, { blocked: false, interferencePrevented: true }).focus, 0);\n});\n\ntest("attack-followup watchers coexist with ordinary next-Attack statuses until resolution", () => {\n  const ordinary = { sourceEffectId: "ordinary", effect: "combat.modifyAttackPower", target: "self", amount: 2, duration: "nextAttack", qualifier: { expires: "endOfTurn" }, appliedImmediately: false };\n  const armed = armConsumableAttackFollowupStatuses([ordinary], card("DDB-CON-CORE-037"));\n  assert.equal(armed.some((status) => status.sourceEffectId === "ordinary"), true);\n  assert.equal(armed.some(isConsumableAttackFollowupStatus), true);\n});\n''')

integration = Path("tests/playtest-effect-integration.test.mjs")
i = integration.read_text()
if 'Quick Duel resolves structured Consumable watched-Attack followups for both fighters' not in i:
    i += '''\n\ntest("Quick Duel resolves structured Consumable watched-Attack followups for both fighters", async () => {\n  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");\n  assert.match(source, /armConsumableAttackFollowupStatuses\\(nextPlayer\\.stage3cStatuses/);\n  assert.match(source, /armConsumableAttackFollowupStatuses\\(nextAi\\.stage3cStatuses/);\n  assert.match(source, /resolveConsumableAttackFollowupStatuses\\(nextPlayer\\.stage3cStatuses/);\n  assert.match(source, /resolveConsumableAttackFollowupStatuses\\(nextAi\\.stage3cStatuses/);\n  assert.match(source, /!isConsumableAttackFollowupStatus\\(status\\)/);\n});\n'''
integration.write_text(i)
