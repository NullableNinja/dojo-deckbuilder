from pathlib import Path
import json


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

# Quick Duel is a fixed-25-HP teaser. Belt promotion keeps all non-HP rewards
# but never expands Max HP or heals. Bump the match schema so stale browser
# saves created under the old vitality rule cannot carry inflated HP forward.
text = playtest.read_text()
if "  schema: 7;" not in text:
    replace_once("app/playtest.tsx", "  schema: 6;", "  schema: 7;")
text = playtest.read_text()
if "saved?.schema === 7" not in text:
    replace_once("app/playtest.tsx", "saved?.schema === 6", "saved?.schema === 7")
text = playtest.read_text()
if "setMatch({ schema: 7," not in text:
    replace_once("app/playtest.tsx", "setMatch({ schema: 6,", "setMatch({ schema: 7,")

text = playtest.read_text()
old_setup = "One fighter. One tactical opponent. Full Belt vitality, the persistent Market, Locations, Reversals, Combos, and Belt progression. No mode selection and no setup maze—the Department has already made the questionable decisions."
new_setup = "One fighter. One tactical opponent. Fixed 25 Max HP, non-HP Belt rewards, the persistent Market, Locations, Reversals, Combos, and Belt progression. No mode selection and no setup maze—the Department has already made the questionable decisions."
if new_setup not in text:
    replace_once("app/playtest.tsx", old_setup, new_setup)

text = playtest.read_text()
old_promotion = '''function applyBeltPromotion(board: Board, beltIndex: number) {\n  const reward = belts[beltIndex]?.reward ?? "";\n  const maxHpIncrease = /\\+10 Max HP/i.test(reward) ? 10 : 0;\n  const maxHp = board.maxHp + maxHpIncrease;\n  const hp = maxHpIncrease && board.hp > 0 ? Math.min(maxHp, board.hp + 5) : board.hp;\n  return { ...board, belt: beltIndex, maxHp, hp };\n}'''
new_promotion = '''function applyBeltPromotion(board: Board, beltIndex: number) {\n  // Quick Duel uses fixed HP: promotion changes rank/perks, never current or Max HP.\n  return { ...board, belt: beltIndex };\n}'''
if new_promotion not in text:
    if old_promotion not in text:
        raise SystemExit("Quick Duel promotion anchor missing")
    playtest.write_text(text.replace(old_promotion, new_promotion, 1))

# Restore the canonical fixed-HP Quick Duel language across the live rule data.
rules = Path("app/data/rules.json")
rules_text = rules.read_text()
replacements = [
    (
        "A fast 1v1 variant with one Character per player. Last Fighter Standing wins; Black Belt Victory is not used. Belt Exams and every printed Belt reward still apply, including ATK, DEF, abilities, hand size, +10 Max HP, and healing. Quick Duel keeps the paperwork and the full promotion package.",
        "A fast 1v1 variant with one Character per player. Last Fighter Standing wins; Black Belt Victory is not used. Belt Exams, abilities, ATK, DEF, Focus, and hand-size rewards still apply, but promotion never raises Max HP or heals a fighter. Quick Duel keeps the paperwork and removes the medical expansion plan."
    ),
    (
        "Every Character begins at 25 HP. Damage reduces current HP. Healing cannot raise a fighter above maximum HP. At 0 HP, the fighter is Knocked Out. Belt rewards increase maximum HP in every mode, including Quick Duel.",
        "Every Character begins at 25 HP. Damage reduces current HP. Healing cannot raise a fighter above maximum HP. At 0 HP, the fighter is Knocked Out. Belt rewards increase maximum HP except in Quick Duel, where Max HP remains 25 unless a card or scenario explicitly changes it."
    ),
    (
        "When a promotion grants +10 Max HP, every Character on that player's roster increases Max HP by 10. Then only the active Character heals 5 HP, up to its new maximum. KO'd Characters remain KO'd and never heal from promotion. These rewards apply in every mode, including Quick Duel.",
        "When a promotion grants +10 Max HP, every Character on that player's roster increases Max HP by 10. Then only the active Character heals 5 HP, up to its new maximum. KO'd Characters remain KO'd and never heal from promotion. Quick Duel ignores every promotion's Max HP increase and healing; all other printed Belt rewards still apply."
    ),
    (
        "The highest current HP a Character may have. Printed promotion rewards can raise it in every mode, including Quick Duel.",
        "The highest current HP a Character may have. Promotions normally raise it, but Quick Duel ignores promotion Max-HP increases and promotion healing."
    ),
]
for old, new in replacements:
    if new not in rules_text:
        if old not in rules_text:
            raise SystemExit(f"rules anchor missing: {old[:120]!r}")
        rules_text = rules_text.replace(old, new, 1)
rules.write_text(rules_text)

definition_path = Path("app/data/game-definition.json")
definition = json.loads(definition_path.read_text())
definition["rulesRevision"] = "v2.3-r4"
definition["progression"]["quickDuelUsesFullBeltRewards"] = False
definition_path.write_text(json.dumps(definition, indent=2) + "\n")

manifest_path = Path("public/rules-manifest.json")
manifest = json.loads(manifest_path.read_text())
manifest["rulesRevision"] = "v2.3-r4"
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

# Update integrity checks that deliberately encoded the superseded full-vitality
# rule and revision number.
integrity = Path("tests/content-integrity.test.mjs")
itext = integrity.read_text()
itext = itext.replace(
    'test("active rules and play surfaces use the persistent Market and full Quick Duel vitality", async () => {',
    'test("active rules and play surfaces use the persistent Market and fixed Quick Duel vitality", async () => {',
    1,
)
itext = itext.replace(
    'assert.equal(JSON.parse(definition).progression.quickDuelUsesFullBeltRewards, true);',
    'assert.equal(JSON.parse(definition).progression.quickDuelUsesFullBeltRewards, false);',
    1,
)
revision_assert = 'assert.equal(JSON.parse(manifest).rulesRevision, "v2.3-r3");'
if itext.count(revision_assert) != 2:
    raise SystemExit(f"expected two old revision assertions, found {itext.count(revision_assert)}")
itext = itext.replace(revision_assert, 'assert.equal(JSON.parse(manifest).rulesRevision, "v2.3-r4");')
integrity.write_text(itext)

# Node 22 supports native type stripping behind this flag. The repository's
# direct .ts imports in node:test need it; without the flag CI fails before the
# gameplay assertions are evaluated.
package_path = Path("package.json")
package = json.loads(package_path.read_text())
package["scripts"]["test"] = "npm run build && node --experimental-strip-types --test tests/*.test.mjs"
package_path.write_text(json.dumps(package, indent=2) + "\n")

Path("tests/quick-duel-fixed-hp.test.mjs").write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFileSync } from "node:fs";\n\nconst playtest = readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");\nconst rules = JSON.parse(readFileSync(new URL("../app/data/rules.json", import.meta.url), "utf8"));\nconst definition = JSON.parse(readFileSync(new URL("../app/data/game-definition.json", import.meta.url), "utf8"));\n\ntest("Quick Duel promotion keeps current and Max HP fixed", () => {\n  assert.equal(definition.progression.quickDuelUsesFullBeltRewards, false);\n  assert.match(playtest, /schema: 7/);\n  assert.match(playtest, /function applyBeltPromotion[\\s\\S]*return \\{ \\.\\.\\.board, belt: beltIndex \\};/);\n  assert.doesNotMatch(playtest.match(/function applyBeltPromotion[\\s\\S]*?\\n\\}/)?.[0] ?? "", /maxHpIncrease|board\\.hp \\+ 5/);\n});\n\ntest("published Quick Duel rules explicitly disable promotion HP rewards", () => {\n  const text = JSON.stringify(rules);\n  assert.match(text, /promotion never raises Max HP or heals a fighter/);\n  assert.match(text, /Quick Duel ignores every promotion's Max HP increase and healing/);\n  assert.match(text, /Quick Duel ignores promotion Max-HP increases and promotion healing/);\n});\n''')

Path("scripts/deploy_patch_message.txt").write_text("Fix Quick Duel promotion HP and unblock Node 22 gameplay tests\n")
