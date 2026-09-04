from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))

playtest = Path("app/playtest.tsx")
text = playtest.read_text()

# Player-owned Block effects can draw automatically, but printed discard choices
# must remain in the player's hands rather than being AI-selected.
replace_once(
    "app/playtest.tsx",
    '      if (owner === "player" && timing === "onPlay") continue;',
    '      if (owner === "player" && (timing === "onPlay" || timing === "onBlock")) continue;',
)

# Add a tiny parser for mandatory player discard clauses already compiled by the
# generic card-effect engine. This avoids duplicating card-name special cases.
anchor = '''function applyCardEffects(board: Board, card: CardEntry, owner: "player" | "ai", timing: "onPlay" | "onHit" | "onBlock" | "afterResolve" = "onPlay") {\n'''
insert = '''function playerDiscardChoiceCount(card: CardEntry, timing: "onPlay" | "onHit" | "onBlock" | "afterResolve") {\n  return compileCardEffects(card.rulesText ?? "").effects\n    .filter((effect) => effect.timing === timing && effect.kind === "discard")\n    .reduce((total, effect) => total + effect.amount, 0);\n}\n\n'''
text = playtest.read_text()
if "function playerDiscardChoiceCount" not in text:
    if anchor not in text:
        raise SystemExit("applyCardEffects anchor missing")
    playtest.write_text(text.replace(anchor, insert + anchor, 1))

# After a successful player Block resolves its automatic draw/Focus/etc., pause
# for the printed discard choice before optional equipment or Reversal logic.
old = '''    if (defenseCard) {\n      if (!hit) nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onBlock");\n      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "afterResolve");\n    }\n    const postBlockCycle = !hit && defenseCard ? postBlockCyclePlan(nextPlayer, pending.zone) : null;'''
new = '''    let blockDiscardChoice = 0;\n    if (defenseCard) {\n      if (!hit) {\n        nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onBlock");\n        blockDiscardChoice = playerDiscardChoiceCount(defenseCard, "onBlock");\n      }\n      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "afterResolve");\n    }\n    if (blockDiscardChoice && nextPlayer.hand.length) {\n      const discardCount = Math.min(blockDiscardChoice, nextPlayer.hand.length);\n      const reversalEligible = !nextPlayer.reversalUsedRound;\n      return write(current, `${defenseCard?.name ?? "Defense"} Block effect: choose ${discardCount} card${discardCount === 1 ? "" : "s"} from your hand to discard.`, {\n        player: nextPlayer,\n        ai: nextAi,\n        pendingStrike: null,\n        pendingChoice: { kind: "discard-hand", sourceCardId: defenseCard!.id, remaining: discardCount, afterChoice: "resume-defense", sourceFollowup: false },\n        pendingCombatContinuation: { remainingAiAttacks: pending.remainingAiAttacks, reversalEligible },\n        winner: null,\n      });\n    }\n    const postBlockCycle = !hit && defenseCard ? postBlockCyclePlan(nextPlayer, pending.zone) : null;'''
replace_once("app/playtest.tsx", old, new)

# Lock down the behavior so future refactors cannot silently reintroduce an
# automatic discard on player Block effects.
test_path = Path("tests/block-discard-choice.test.mjs")
test_path.write_text('''import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n\nconst source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");\n\ntest("player Block discard effects pause for an explicit choice", () => {\n  assert.match(source, /timing === "onPlay" \\|\\| timing === "onBlock"/);\n  assert.match(source, /blockDiscardChoice = playerDiscardChoiceCount\\(defenseCard, "onBlock"\\)/);\n  assert.match(source, /Block effect: choose/);\n  assert.match(source, /afterChoice: "resume-defense", sourceFollowup: false/);\n});\n''')

Path("scripts/deploy_patch_message.txt").write_text("Honor player choice on Block discard effects\n")
