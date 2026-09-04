from pathlib import Path

root = Path('.')
card_effects_path = root / 'app/card-effects.ts'
card_effects = card_effects_path.read_text()

# Never auto-execute printed player-choice language. Dedicated resolvers own it.
old_loop = '''  for (const sentence of normalized.split(/(?<=[.!?])\\s+/)) {\n    const timing = sentenceTiming(sentence);\n    if (!timing) { unsupported.push(sentence); continue; }'''
new_loop = '''  for (const sentence of normalized.split(/(?<=[.!?])\\s+/)) {\n    if (/\\b(?:may|choose|up to|either|one of|optionally)\\b/i.test(sentence)) { unsupported.push(sentence); continue; }\n    const timing = sentenceTiming(sentence);\n    if (!timing) { unsupported.push(sentence); continue; }'''
if old_loop not in card_effects: raise SystemExit('compileCardEffects loop anchor missing')
card_effects = card_effects.replace(old_loop, new_loop, 1)
card_effects_path.write_text(card_effects)

resolver_path = root / 'app/effect-resolvers.ts'
resolver = resolver_path.read_text()
if 'export function destroyJunkChoiceCount' not in resolver:
    resolver += r'''

export function destroyJunkChoiceCount(card: EffectCardLike) {
  const match = String(card.rulesText ?? "").match(/Destroy (\d+) Junk cards? from your hand or discard pile/i);
  return match ? Number(match[1]) : 0;
}

export function optionalDiscardDrawChoice(card: EffectCardLike) {
  const text = String(card.rulesText ?? "");
  const match = text.match(/After (?:this Attack|this|it|that Attack) resolves, you may discard (\d+) cards? to draw (\d+) cards?/i);
  return match ? { discard: Number(match[1]), draw: Number(match[2]) } : null;
}
'''
resolver_path.write_text(resolver)

playtest_path = root / 'app/playtest.tsx'
playtest = playtest_path.read_text()
old_import = 'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, defenseEquipmentBonus, destroysAfterUse, equipmentConditionalAttackPowerBonus, equipmentSpeedModifier, locationAttackRuleModifiers, passiveEquipmentGuard, targetNextAttackPenalty, targetSpeedPenaltyUntilHonor } from "./effect-resolvers";'
new_import = 'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, equipmentConditionalAttackPowerBonus, equipmentSpeedModifier, locationAttackRuleModifiers, optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty, targetSpeedPenaltyUntilHonor } from "./effect-resolvers";'
if old_import not in playtest: raise SystemExit('effect resolver import anchor missing')
playtest = playtest.replace(old_import, new_import, 1)

# Add an extensible pending-choice union without invalidating schema-6 saves.
pending_discard = '''type PendingDiscard = {\n  sourceCardId: string;\n  remaining: number;\n};\n'''
pending_choice = '''type PendingDiscard = {\n  sourceCardId: string;\n  remaining: number;\n};\n\ntype PendingChoice =\n  | { kind: "destroy-junk"; sourceCardId: string; remaining: number }\n  | { kind: "discard-draw"; sourceCardId: string; remaining: number; draw: number };\n'''
if 'type PendingChoice =' not in playtest:
    if pending_discard not in playtest: raise SystemExit('PendingDiscard type anchor missing')
    playtest = playtest.replace(pending_discard, pending_choice, 1)
if 'pendingChoice?: PendingChoice | null;' not in playtest:
    playtest = playtest.replace('  pendingDiscard: PendingDiscard | null;\n', '  pendingDiscard: PendingDiscard | null;\n  pendingChoice?: PendingChoice | null;\n', 1)

# Helper predicates/options.
helper_anchor = 'function cardCost(card: CardEntry | undefined) { return numberValue(card?.fpCost); }\n'
helper_text = '''function isJunk(card: CardEntry | undefined) { return Boolean(card && (card.subtype === "Junk" || card.cardType === "Junk" || hasTag(card, "Junk"))); }\n'''
if helper_text.strip() not in playtest:
    if helper_anchor not in playtest: raise SystemExit('cardCost helper anchor missing')
    playtest = playtest.replace(helper_anchor, helper_text + helper_anchor, 1)

# All normal action entry points must respect a pending explicit choice.
replacements = {
    'if (!current?.selectedAttackId || current.phase !== "player-yell" || current.winner || current.pendingDiscard) return current;': 'if (!current?.selectedAttackId || current.phase !== "player-yell" || current.winner || current.pendingDiscard || current.pendingChoice) return current;',
    'if (!current || current.phase !== "player-yell" || current.winner || current.pendingDiscard) return current;': 'if (!current || current.phase !== "player-yell" || current.winner || current.pendingDiscard || current.pendingChoice) return current;',
    'if (!current || current.phase !== "player-yell" || current.winner || current.player.defensePracticeUsed || current.pendingDiscard) return current;': 'if (!current || current.phase !== "player-yell" || current.winner || current.player.defensePracticeUsed || current.pendingDiscard || current.pendingChoice) return current;',
    'setMatch((current) => current?.phase === "player-yell" && !current.pendingDiscard ? write(current, "Ascend:': 'setMatch((current) => current?.phase === "player-yell" && !current.pendingDiscard && !current.pendingChoice ? write(current, "Ascend:',
}
for old, new in replacements.items():
    if old in playtest:
        playtest = playtest.replace(old, new, 1)

# Support cards with mandatory Junk destruction pause for an explicit selection.
old_support_tail = '''    const pendingDiscard = card.name === "Morning-Shift Meditation" && nextPlayer.hand.length ? { sourceCardId: id, remaining: 1 } : null;\n    return write(current, `${card.name} played. ${pendingDiscard ? "Draw 1 card, then choose a card to discard." : cardEffectNote(card)}${destroyedAfterUse ? " Destroyed after use; it will not enter your discard pile." : ""}${locationModifier.notes.length ? ` ${locationModifier.notes.join("; ")}.` : ""}`, { player: nextPlayer, pendingDiscard });'''
new_support_tail = '''    const pendingDiscard = card.name === "Morning-Shift Meditation" && nextPlayer.hand.length ? { sourceCardId: id, remaining: 1 } : null;\n    const junkCount = destroyJunkChoiceCount(card);\n    const hasJunk = [...nextPlayer.hand, ...nextPlayer.discard].some((candidate) => isJunk(cardFor(candidate)));\n    const pendingChoice: PendingChoice | null = !pendingDiscard && junkCount && hasJunk ? { kind: "destroy-junk", sourceCardId: id, remaining: junkCount } : null;\n    return write(current, `${card.name} played. ${pendingDiscard ? "Draw 1 card, then choose a card to discard." : pendingChoice ? `Choose ${junkCount} Junk card${junkCount === 1 ? "" : "s"} from your hand or discard pile to destroy.` : cardEffectNote(card)}${destroyedAfterUse ? " Destroyed after use; it will not enter your discard pile." : ""}${locationModifier.notes.length ? ` ${locationModifier.notes.join("; ")}.` : ""}`, { player: nextPlayer, pendingDiscard, pendingChoice });'''
if old_support_tail not in playtest: raise SystemExit('playSupport choice anchor missing')
playtest = playtest.replace(old_support_tail, new_support_tail, 1)

# Normal player Attacks can open an optional post-resolution discard/draw choice.
result_anchor = '''    const result = hit\n      ? `${card.name} hits ${aiFighter?.name ?? "the opponent"} for ${damage}.${defenseCard ? ` ${defenseCard.name} is discarded after this strike.` : ""}`\n      : defenseCard\n        ? `${card.name} is blocked by ${defenseCard.name}; that Defense is now discarded.`\n        : `${card.name} is blocked by ${aiFighter?.name ?? "the opponent"}'s standing DEF/Equipment; no Defense card was played.`;\n    const modifiers ='''
result_replacement = '''    const result = hit\n      ? `${card.name} hits ${aiFighter?.name ?? "the opponent"} for ${damage}.${defenseCard ? ` ${defenseCard.name} is discarded after this strike.` : ""}`\n      : defenseCard\n        ? `${card.name} is blocked by ${defenseCard.name}; that Defense is now discarded.`\n        : `${card.name} is blocked by ${aiFighter?.name ?? "the opponent"}'s standing DEF/Equipment; no Defense card was played.`;\n    const optionalCycle = !nextAi.hp ? null : optionalDiscardDrawChoice(card);\n    const pendingChoice: PendingChoice | null = optionalCycle && nextPlayer.hand.length ? { kind: "discard-draw", sourceCardId: card.id, remaining: optionalCycle.discard, draw: optionalCycle.draw } : null;\n    const modifiers ='''
if result_anchor not in playtest: raise SystemExit('declareAttack result anchor missing')
playtest = playtest.replace(result_anchor, result_replacement, 1)
old_write = 'return write(current, `${tempoBonus ? "Tempo +1. " : ""}${result} Attack ${attackPower} vs Defense ${defensePower}.${flowDraw ? " Flow draws 1 card." : ""}${modifiers.length ? ` ${modifiers.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, selectedAttackId: null, winner: nextAi.hp ? null : "player" });'
new_write = 'return write(current, `${tempoBonus ? "Tempo +1. " : ""}${result} Attack ${attackPower} vs Defense ${defensePower}.${flowDraw ? " Flow draws 1 card." : ""}${pendingChoice ? " Optional discard/draw decision is waiting." : ""}${modifiers.length ? ` ${modifiers.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, selectedAttackId: null, pendingChoice, winner: nextAi.hp ? null : "player" });'
if old_write not in playtest: raise SystemExit('declareAttack write anchor missing')
playtest = playtest.replace(old_write, new_write, 1)

# Add choice resolution actions after the existing pending-discard resolver.
insert_anchor = '  const practiceDefense = (id: string) => setMatch((current) => {'
choice_actions = r'''  const resolvePendingChoice = (cardId: string, source: "hand" | "discard" = "hand") => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice) return current;
    const selected = cardFor(cardId);
    const sourceCards = source === "hand" ? current.player.hand : current.player.discard;
    if (!selected || !sourceCards.includes(cardId)) return current;

    if (choice.kind === "destroy-junk") {
      if (!isJunk(selected)) return current;
      const player = source === "hand"
        ? { ...current.player, hand: removeOne(current.player.hand, cardId), destroyed: [...(current.player.destroyed ?? []), cardId] }
        : { ...current.player, discard: removeOne(current.player.discard, cardId), destroyed: [...(current.player.destroyed ?? []), cardId] };
      const remaining = choice.remaining - 1;
      const junkRemains = [...player.hand, ...player.discard].some((id) => isJunk(cardFor(id)));
      const pendingChoice = remaining > 0 && junkRemains ? { ...choice, remaining } : null;
      return write(current, `${selected.name} destroyed from your ${source === "hand" ? "hand" : "discard pile"}.${pendingChoice ? ` Choose ${remaining} more Junk.` : " Choice resolved."}`, { player, pendingChoice });
    }

    if (choice.kind === "discard-draw") {
      if (!current.player.hand.includes(cardId)) return current;
      let player = { ...current.player, hand: removeOne(current.player.hand, cardId), discard: [...current.player.discard, cardId] };
      const remaining = choice.remaining - 1;
      if (remaining > 0 && player.hand.length) {
        return write(current, `${selected.name} discarded. Choose ${remaining} more card${remaining === 1 ? "" : "s"}.`, { player, pendingChoice: { ...choice, remaining } });
      }
      player = drawCards(player, choice.draw);
      return write(current, `${selected.name} discarded; ${choice.draw} card${choice.draw === 1 ? "" : "s"} drawn by ${cardFor(choice.sourceCardId)?.name ?? "the printed effect"}.`, { player, pendingChoice: null });
    }
    return current;
  });

  const skipPendingChoice = () => setMatch((current) => {
    if (!current?.pendingChoice || current.pendingChoice.kind !== "discard-draw") return current;
    return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: discard/draw declined.`, { pendingChoice: null });
  });

'''
if 'const resolvePendingChoice =' not in playtest:
    if insert_anchor not in playtest: raise SystemExit('practiceDefense insertion anchor missing')
    playtest = playtest.replace(insert_anchor, choice_actions + insert_anchor, 1)

# Choice candidates are computed from the current state at render time.
render_anchor = '  const defenseOptions = match.pendingStrike ? legalDefenseIds(player, match.pendingStrike.zone) : [];\n'
render_choice = '''  const pendingChoiceOptions = match.pendingChoice?.kind === "destroy-junk"\n    ? [\n        ...player.hand.map((id, index) => ({ id, source: "hand" as const, index })).filter((entry) => isJunk(cardFor(entry.id))),\n        ...player.discard.map((id, index) => ({ id, source: "discard" as const, index })).filter((entry) => isJunk(cardFor(entry.id))),\n      ]\n    : match.pendingChoice?.kind === "discard-draw"\n      ? player.hand.map((id, index) => ({ id, source: "hand" as const, index }))\n      : [];\n'''
if render_choice.strip() not in playtest:
    if render_anchor not in playtest: raise SystemExit('render choice anchor missing')
    playtest = playtest.replace(render_anchor, render_anchor + render_choice, 1)

# Make the hand read-only under an explicit choice; the modal is the authority.
old_choose_discard = '          const choosingDiscard = Boolean(match.pendingDiscard);\n'
new_choose_discard = '          const choosingDiscard = Boolean(match.pendingDiscard);\n          const choosingEffect = Boolean(match.pendingChoice);\n'
if old_choose_discard not in playtest: raise SystemExit('hand choosingDiscard anchor missing')
playtest = playtest.replace(old_choose_discard, new_choose_discard, 1)
old_disabled = 'disabled={choosingDiscard ? false : match.phase === "defense-window" ? !canDefend : match.phase === "reversal-window" ? !canReverse : match.phase === "player-initiate" ? !canInitiate : !canUse}'
new_disabled = 'disabled={choosingEffect ? true : choosingDiscard ? false : match.phase === "defense-window" ? !canDefend : match.phase === "reversal-window" ? !canReverse : match.phase === "player-initiate" ? !canInitiate : !canUse}'
if old_disabled not in playtest: raise SystemExit('hand disabled anchor missing')
playtest = playtest.replace(old_disabled, new_disabled, 1)

# Add an explicit Paper-Fu choice modal before Coach/Fight Log overlays.
modal_anchor = '    {coachOpen && !match.winner && <div className="playtest-inspector-backdrop coach-backdrop"'
choice_modal = r'''    {match.pendingChoice && <div className="playtest-inspector-backdrop effect-choice-backdrop"><section className="effect-choice-dialog paper-stack" role="dialog" aria-modal="true" aria-labelledby="effect-choice-title"><span className="eyebrow">Printed effect · your decision</span><h2 id="effect-choice-title">{match.pendingChoice.kind === "destroy-junk" ? "Choose Junk to destroy" : "Discard to draw?"}</h2><p>{match.pendingChoice.kind === "destroy-junk" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} requires ${match.pendingChoice.remaining} more Junk card${match.pendingChoice.remaining === 1 ? "" : "s"} from your hand or discard pile.` : `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Attack"} lets you discard ${match.pendingChoice.remaining} card${match.pendingChoice.remaining === 1 ? "" : "s"} to draw ${match.pendingChoice.draw}. You may decline.`}</p><div className="effect-choice-options">{pendingChoiceOptions.map((entry) => { const option = cardFor(entry.id); if (!option) return null; return <button type="button" onClick={() => resolvePendingChoice(entry.id, entry.source)} key={`${entry.source}-${entry.id}-${entry.index}`}><span>{entry.source === "discard" ? "DISCARD PILE" : "HAND"}</span><b>{option.name}</b><small>{option.catalogId} · {option.subtype || option.cardType}</small></button>; })}</div>{match.pendingChoice.kind === "discard-draw" && <footer><button className="button ghost" onClick={skipPendingChoice}>Skip this optional effect</button></footer>}</section></div>}
'''
if 'className="effect-choice-dialog paper-stack"' not in playtest:
    if modal_anchor not in playtest: raise SystemExit('choice modal anchor missing')
    playtest = playtest.replace(modal_anchor, choice_modal + modal_anchor, 1)

# Clear orphaned choices at Honor as a final safety boundary.
playtest = playtest.replace('pendingDiscard: null, locationId,', 'pendingDiscard: null, pendingChoice: null, locationId,', 1)

playtest_path.write_text(playtest)

# Minimal modal styling; no board geometry is touched.
css_path = root / 'app/playtest-board-v4.css'
css = css_path.read_text()
marker = '/* Explicit printed-effect choices — mechanics overlay, not board geometry. */'
if marker not in css:
    css += r'''

/* Explicit printed-effect choices — mechanics overlay, not board geometry. */
.effect-choice-backdrop { z-index: 132 !important; }
.effect-choice-dialog {
  width: min(760px, calc(100vw - 40px));
  max-height: min(82dvh, 720px);
  overflow: auto;
  border-top: 7px solid var(--gold);
  padding: 24px;
  color: #20372c;
  background: #f1dfb8;
}
.effect-choice-dialog h2 { margin: 5px 0 8px; font-family: var(--display); font-size: clamp(30px, 4vw, 46px); }
.effect-choice-dialog > p { margin: 0 0 16px; line-height: 1.55; }
.effect-choice-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.effect-choice-options > button { min-width: 0; display: grid; gap: 3px; border: 1px solid rgba(32,55,44,.28); padding: 10px 12px; color: #20372c; background: rgba(255,255,255,.28); text-align: left; cursor: pointer; }
.effect-choice-options > button:hover { border-color: #b74632; transform: translateY(-1px); }
.effect-choice-options span { color: #9e3d2e; font-size: 7px; font-weight: 950; letter-spacing: .1em; }
.effect-choice-options b { font-size: 13px; }
.effect-choice-options small { opacity: .68; font-size: 8px; }
.effect-choice-dialog footer { display: flex; justify-content: flex-end; margin-top: 14px; }
:root[data-theme="dark"] .effect-choice-dialog { color: #edf4ef; background: #20342a; }
:root[data-theme="dark"] .effect-choice-options > button { color: #edf4ef; border-color: rgba(255,255,255,.16); background: rgba(255,255,255,.045); }
@media (max-width: 700px) { .effect-choice-options { grid-template-columns: 1fr; } }
'''
css_path.write_text(css)

# Tests for parser safety and choice resolvers.
test_path = root / 'tests/card-effects.test.mjs'
test_text = test_path.read_text()
if 'choice language is never auto-executed' not in test_text:
    test_text += r'''

test("choice language is never auto-executed by the generic parser", () => {
  const plan = compileCardEffects("After this Attack resolves, you may discard 1 card to draw 1 card.");
  assert.deepEqual(plan.effects, []);
  assert.equal(plan.unsupported.length, 1);
  const choose = compileCardEffects("Choose one card. Draw 2 cards.");
  assert.deepEqual(choose.effects, [{ timing: "onPlay", kind: "draw", amount: 2 }]);
  assert.equal(choose.unsupported.length, 1);
});
'''
    test_path.write_text(test_text)

resolver_test = root / 'tests/effect-resolvers.test.mjs'
rtext = resolver_test.read_text()
if 'destroyJunkChoiceCount' not in rtext.split('\n', 2)[1]:
    rtext = rtext.replace('conditionalHealAfterHit, defenseEquipmentBonus,', 'conditionalHealAfterHit, defenseEquipmentBonus, destroyJunkChoiceCount,')
    rtext = rtext.replace('locationAttackRuleModifiers, optionalDiscardDrawChoice,', 'locationAttackRuleModifiers, optionalDiscardDrawChoice,') if 'optionalDiscardDrawChoice' in rtext else rtext
# robustly replace current import if functions absent
if 'optionalDiscardDrawChoice' not in rtext.split('\n', 4)[3]:
    lines = rtext.splitlines()
    for i, line in enumerate(lines):
        if 'from "../app/effect-resolvers.ts"' in line:
            if 'destroyJunkChoiceCount' not in line:
                line = line.replace('defenseEquipmentBonus,', 'defenseEquipmentBonus, destroyJunkChoiceCount,')
            if 'optionalDiscardDrawChoice' not in line:
                line = line.replace('locationAttackRuleModifiers,', 'locationAttackRuleModifiers, optionalDiscardDrawChoice,')
            lines[i] = line
            break
    rtext = '\n'.join(lines) + '\n'
if 'explicit choice resolvers recognize Junk destruction and optional cycling' not in rtext:
    rtext += r'''

test("explicit choice resolvers recognize Junk destruction and optional cycling", () => {
  assert.equal(destroyJunkChoiceCount({ rulesText: "Destroy 1 Junk card from your hand or discard pile." }), 1);
  assert.deepEqual(optionalDiscardDrawChoice({ rulesText: "After this Attack resolves, you may discard 1 card to draw 1 card." }), { discard: 1, draw: 1 });
  assert.equal(optionalDiscardDrawChoice({ rulesText: "Draw 1 card." }), null);
});
'''
resolver_test.write_text(rtext)

integration = root / 'tests/playtest-effect-integration.test.mjs'
itext = integration.read_text()
if 'explicit player-choice effects' not in itext:
    itext += r'''

test("Quick Duel pauses for explicit player-choice effects instead of auto-resolving them", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /type PendingChoice/);
  assert.match(source, /kind: "destroy-junk"/);
  assert.match(source, /kind: "discard-draw"/);
  assert.match(source, /resolvePendingChoice/);
  assert.match(source, /Skip this optional effect/);
  assert.match(source, /effect-choice-dialog/);
});
'''
    integration.write_text(itext)
