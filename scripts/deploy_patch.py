from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:180]!r}")
    p.write_text(text.replace(old, new, 1))


playtest = Path("app/playtest.tsx")
text = playtest.read_text()

# Player-owned mandatory discard clauses are choices. This guard lives only
# inside applyCardEffects' discard branch, so draw / Focus / heal effects at the
# same timing still resolve automatically.
old_guard = '      if (owner === "player" && timing === "onPlay") continue;'
new_guard = '      if (owner === "player" && (timing === "onPlay" || timing === "onBlock")) continue;'
if new_guard not in text:
    replace_once("app/playtest.tsx", old_guard, new_guard)

# Count only printed discard effects at the requested timing so the combat
# resolver can pause for the human player's choice.
text = playtest.read_text()
helper = '''function playerDiscardChoiceCount(card: CardEntry, timing: "onPlay" | "onHit" | "onBlock" | "afterResolve") {\n  return compileCardEffects(card.rulesText ?? "").effects\n    .filter((effect) => effect.timing === timing && effect.kind === "discard")\n    .reduce((total, effect) => total + effect.amount, 0);\n}\n\n'''
anchor = '''function applyCardEffects(board: Board, card: CardEntry, owner: "player" | "ai", timing: "onPlay" | "onHit" | "onBlock" | "afterResolve" = "onPlay") {\n'''
if "function playerDiscardChoiceCount" not in text:
    if anchor not in text:
        raise SystemExit("applyCardEffects anchor missing")
    playtest.write_text(text.replace(anchor, helper + anchor, 1))

# A successful player Block resolves non-discard effects first, then pauses for
# the printed hand-discard choice before post-Block equipment / Reversal logic.
text = playtest.read_text()
old_block = '''    if (defenseCard) {\n      if (!hit) nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onBlock");\n      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "afterResolve");\n    }\n    const postBlockCycle = !hit && defenseCard ? postBlockCyclePlan(nextPlayer, pending.zone) : null;'''
new_block = '''    let blockDiscardChoice = 0;\n    if (defenseCard) {\n      if (!hit) {\n        nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onBlock");\n        blockDiscardChoice = playerDiscardChoiceCount(defenseCard, "onBlock");\n      }\n      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "afterResolve");\n    }\n    if (blockDiscardChoice && nextPlayer.hand.length) {\n      const discardCount = Math.min(blockDiscardChoice, nextPlayer.hand.length);\n      const reversalEligible = !nextPlayer.reversalUsedRound;\n      return write(current, `${defenseCard?.name ?? "Defense"} Block effect: choose ${discardCount} card${discardCount === 1 ? "" : "s"} from your hand to discard.`, {\n        player: nextPlayer,\n        ai: nextAi,\n        pendingStrike: null,\n        pendingChoice: { kind: "discard-hand", sourceCardId: defenseCard!.id, remaining: discardCount, afterChoice: "resume-defense", sourceFollowup: false },\n        pendingCombatContinuation: { remainingAiAttacks: pending.remainingAiAttacks, reversalEligible },\n        winner: null,\n      });\n    }\n    const postBlockCycle = !hit && defenseCard ? postBlockCyclePlan(nextPlayer, pending.zone) : null;'''
if new_block not in text:
    replace_once("app/playtest.tsx", old_block, new_block)

# Removing target-discard selections by id used to erase every duplicate copy
# of that card. Remove exactly one hand occurrence for each chosen discard.
text = playtest.read_text()
old_target = '''      const discarded = ranked.slice(0, discardCount);\n      nextAi = { ...nextAi, hand: nextAi.hand.filter((id) => !discarded.includes(id)), discard: [...nextAi.discard, ...discarded] };'''
new_target = '''      const discarded = ranked.slice(0, discardCount);\n      let aiHand = nextAi.hand;\n      for (const id of discarded) aiHand = removeOne(aiHand, id);\n      nextAi = { ...nextAi, hand: aiHand, discard: [...nextAi.discard, ...discarded] };'''
if new_target not in text:
    replace_once("app/playtest.tsx", old_target, new_target)

# Broaden the target-discard parser to the approved wording variants used by
# the catalog (If ... Hits / On Hit and target / opponent).
resolver = Path("app/effect-resolvers.ts")
rtext = resolver.read_text()
old_parser = '''  const match = text.match(/If (?:this Attack|it|that Attack) Hits?, (?:the )?target discards? (\\d+) cards?/i);'''
new_parser = '''  const match = text.match(/(?:If (?:this Attack|it|that Attack) Hits?|On Hit), (?:the )?(?:target|opponent) discards? (\\d+) cards?/i);'''
if new_parser not in rtext:
    if old_parser not in rtext:
        raise SystemExit("targetDiscardOnHitCount parser anchor missing")
    resolver.write_text(rtext.replace(old_parser, new_parser, 1))

# Regression coverage for both the explicit Block choice and the duplicate-safe
# target discard implementation.
Path("tests/block-discard-choice.test.mjs").write_text('''import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n\nconst source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");\n\ntest("player Block discard effects pause for an explicit choice without suppressing other Block effects", () => {\n  assert.match(source, /effect.kind === "draw"/);\n  assert.match(source, /effect.kind === "discard"[\\s\\S]{0,260}timing === "onPlay" \\|\\| timing === "onBlock"/);\n  assert.match(source, /blockDiscardChoice = playerDiscardChoiceCount\\(defenseCard, "onBlock"\\)/);\n  assert.match(source, /afterChoice: "resume-defense", sourceFollowup: false/);\n});\n\ntest("AI target discard removes selected copies one at a time", () => {\n  assert.match(source, /let aiHand = nextAi\\.hand/);\n  assert.match(source, /for \\(const id of discarded\\) aiHand = removeOne\\(aiHand, id\\)/);\n});\n''')

etest = Path("tests/effect-resolvers.test.mjs")
etext = etest.read_text()
marker = '''test("Consumables marked Destroy after use are removed from circulation", () => {'''
extra = '''test("target-discard Hit wording supports If-Hits and On-Hit variants", () => {\n  assert.equal(targetDiscardOnHitCount({ rulesText: "If this Attack Hits, the target discards 1 card." }), 1);\n  assert.equal(targetDiscardOnHitCount({ rulesText: "On Hit, opponent discards 2 cards." }), 2);\n  assert.equal(targetDiscardOnHitCount({ rulesText: "Target gains 1 Focus." }), 0);\n});\n\n'''
if 'test("target-discard Hit wording supports If-Hits and On-Hit variants"' not in etext:
    if marker not in etext:
        raise SystemExit("effect resolver test anchor missing")
    etest.write_text(etext.replace(marker, extra + marker, 1))

Path("scripts/deploy_patch_message.txt").write_text("Honor Block discard choices and harden target discard effects\n")
