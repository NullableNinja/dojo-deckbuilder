from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:140]!r}")
    p.write_text(text.replace(old, new, 1))

# Parse attacks that force the target to discard after a Hit.
resolver = Path("app/effect-resolvers.ts")
text = resolver.read_text()
anchor = '''export function targetNextAttackPenalty(card: EffectCardLike) {\n'''
insert = r'''export function targetDiscardOnHitCount(card: EffectCardLike) {
  const text = String(card.rulesText ?? "").replace(/\s+/g, " ").trim();
  const match = text.match(/If (?:this Attack|it|that Attack) Hits?, (?:the )?target discards? (\d+) cards?/i);
  return match ? Number(match[1]) : 0;
}

'''
if "export function targetDiscardOnHitCount" not in text:
    if anchor not in text:
        raise SystemExit("targetNextAttackPenalty anchor missing")
    resolver.write_text(text.replace(anchor, insert + anchor, 1))

# Wire resolver into Quick Duel.
replace_once(
    "app/playtest.tsx",
    'readyEquipmentOnHit, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor, type DeckLookPlan',
    'readyEquipmentOnHit, targetDiscardOnHitCount, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor, type DeckLookPlan',
)
replace_once(
    "app/playtest.tsx",
    '| { kind: "discard-hand"; sourceCardId: string; remaining: number; afterChoice?: "resume-defense" }',
    '| { kind: "discard-hand"; sourceCardId: string; remaining: number; afterChoice?: "resume-defense"; sourceFollowup?: boolean }',
)

# AI chooses its own lowest-Focus discards when the player lands this printed effect.
old = '''    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card) : { board: nextAi, notes: [] as string[] };\n    nextAi = targetDebuff.board;'''
new = '''    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card) : { board: nextAi, notes: [] as string[] };\n    nextAi = targetDebuff.board;\n    const targetDiscardCount = hit ? targetDiscardOnHitCount(card) : 0;\n    const targetDiscardNotes: string[] = [];\n    if (targetDiscardCount && nextAi.hand.length) {\n      const discardCount = Math.min(targetDiscardCount, nextAi.hand.length);\n      const ranked = [...nextAi.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)));\n      const discarded = ranked.slice(0, discardCount);\n      nextAi = { ...nextAi, hand: nextAi.hand.filter((id) => !discarded.includes(id)), discard: [...nextAi.discard, ...discarded] };\n      targetDiscardNotes.push(`target discards ${discardCount}: ${discarded.map((id) => cardFor(id)?.name ?? "Unknown").join(", ")}`);\n    }'''
replace_once("app/playtest.tsx", old, new)
replace_once(
    "app/playtest.tsx",
    '...targetDebuff.notes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes,',
    '...targetDebuff.notes, ...targetDiscardNotes, ...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes,',
)

# Forced target discards never inherit a discard-cost followup from the attack card itself.
replace_once(
    "app/playtest.tsx",
    'const followup = sourceCard ? discardChoiceFollowup(sourceCard, selected) : { focus: 0, nextAttackPower: 0, nextDefenseGuard: 0, notes: [] as string[] };',
    'const followup = sourceCard && choice.sourceFollowup !== false ? discardChoiceFollowup(sourceCard, selected) : { focus: 0, nextAttackPower: 0, nextDefenseGuard: 0, notes: [] as string[] };',
)

# When the AI lands the same effect, pause combat and let the player choose their discard(s).
old = '''    const resolved = write(current, `${tempoBonus ? "Tempo +1 Guard. " : ""}${message}${modifiers.length ? ` ${modifiers.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, pendingStrike: null, pendingCombatContinuation: null, winner: nextPlayer.hp ? null : "ai" });\n    if (!nextPlayer.hp) return resolved;'''
new = '''    const resolved = write(current, `${tempoBonus ? "Tempo +1 Guard. " : ""}${message}${modifiers.length ? ` ${modifiers.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, pendingStrike: null, pendingCombatContinuation: null, winner: nextPlayer.hp ? null : "ai" });\n    if (!nextPlayer.hp) return resolved;\n    const forcedTargetDiscard = hit ? targetDiscardOnHitCount(aiCard) : 0;\n    if (forcedTargetDiscard && nextPlayer.hand.length) {\n      const discardCount = Math.min(forcedTargetDiscard, nextPlayer.hand.length);\n      return write(resolved, `${aiCard.name} Hit effect: choose ${discardCount} card${discardCount === 1 ? "" : "s"} from your hand to discard.`, {\n        pendingChoice: { kind: "discard-hand", sourceCardId: aiCard.id, remaining: discardCount, afterChoice: "resume-defense", sourceFollowup: false },\n        pendingCombatContinuation: { remainingAiAttacks: pending.remainingAiAttacks, reversalEligible: false },\n      });\n    }'''
replace_once("app/playtest.tsx", old, new)

# Resolver regression tests.
test_path = Path("tests/effect-resolvers.test.mjs")
t = test_path.read_text()
if "targetDiscardOnHitCount" not in t:
    t = t.replace(
        'readyEquipmentOnHit, targetNextAttackPenalty,',
        'readyEquipmentOnHit, targetDiscardOnHitCount, targetNextAttackPenalty,',
        1,
    )
    t += r'''

test("targetDiscardOnHitCount parses forced discard Hit effects", () => {
  assert.equal(targetDiscardOnHitCount({ rulesText: "If this Attack Hits, the target discards 1 card." }), 1);
  assert.equal(targetDiscardOnHitCount({ rulesText: "If it Hits, target discards 2 cards." }), 2);
  assert.equal(targetDiscardOnHitCount({ rulesText: "If this Attack is Blocked, gain 1 Focus." }), 0);
});
'''
    test_path.write_text(t)

# Static integration guards for both sides of the duel. Create the file if another branch removed it.
regression = Path("tests/playtest-target-discard.test.mjs")
r = regression.read_text() if regression.exists() else '''import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n'''
if "forced target-discard Hit effects" not in r:
    r += r'''

test("forced target-discard Hit effects are resolved for both fighters", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /const targetDiscardCount = hit \? targetDiscardOnHitCount\(card\) : 0/);
  assert.match(source, /sourceFollowup: false/);
  assert.match(source, /pendingCombatContinuation: \{ remainingAiAttacks: pending\.remainingAiAttacks, reversalEligible: false \}/);
});
'''
    regression.write_text(r)

Path("scripts/deploy_patch_message.txt").write_text("Implement target discard on-hit card effects\n")
