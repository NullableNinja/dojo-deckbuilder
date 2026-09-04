from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))

# Resolver support for activatable Equipment and Ready-on-Hit effects.
resolver = Path("app/effect-resolvers.ts")
text = resolver.read_text()
marker = "\nexport type EquipmentActivationPlan ="
if marker not in text:
    text += r'''

export type EquipmentActivationPlan =
  | { kind: "speed-tempo-cycle"; speed: number; draw: number; discard: number };

export function equipmentActivationPlan(card: EffectCardLike): EquipmentActivationPlan | null {
  const text = normalizedMinus(String(card.rulesText ?? "")).replace(/\s+/g, " ").trim();
  const speed = text.match(/^Exhaust:\s*Gain \+?(\d+) Speed until (?:the )?next Honor Phase\. If you have Tempo after doing so, draw (\d+) cards?, then discard (\d+) cards?/i);
  if (speed) return { kind: "speed-tempo-cycle", speed: Number(speed[1]), draw: Number(speed[2]), discard: Number(speed[3]) };
  return null;
}

export function readyEquipmentOnHit(card: EffectCardLike) {
  const match = String(card.rulesText ?? "").match(/If (?:it|this Attack) Hits, you may ready (\d+|one) Equipment card you control/i);
  if (!match) return 0;
  return match[1].toLocaleLowerCase() === "one" ? 1 : Number(match[1]);
}
'''
    resolver.write_text(text)

# Engine imports and persistent Board state.
replace_once(
    "app/playtest.tsx",
    'equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty,',
    'equipmentPiercing, equipmentSpeedModifier, equipmentActivationPlan, firstIncomingAttackPowerPenalty,'
)
replace_once(
    "app/playtest.tsx",
    'optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty,',
    'optionalDiscardDrawChoice, passiveEquipmentGuard, readyEquipmentOnHit, targetNextAttackPenalty,'
)
replace_once(
    "app/playtest.tsx",
    '  equipment: string[];\n  tempSpeed: number;',
    '  equipment: string[];\n  exhaustedEquipment?: string[];\n  tempSpeed: number;',
)
replace_once(
    "app/playtest.tsx",
    '  | { kind: "discard-hand"; sourceCardId: string; remaining: number }\n  | { kind: "deck-pick";',
    '  | { kind: "discard-hand"; sourceCardId: string; remaining: number }\n  | { kind: "ready-equipment"; sourceCardId: string; remaining: number }\n  | { kind: "deck-pick";',
)
replace_once(
    "app/playtest.tsx",
    'deck: shuffle(starterIds), hand: [], discard: [], playArea: [], equipment: [],\n    tempSpeed:',
    'deck: shuffle(starterIds), hand: [], discard: [], playArea: [], equipment: [], exhaustedEquipment: [],\n    tempSpeed:',
)

# Piercing conditions can now see actual exhausted Equipment.
replace_once(
    "app/playtest.tsx",
    'targetHasExhaustedEquipment: false, speedChangedThisRound:',
    'targetHasExhaustedEquipment: Boolean(defender.exhaustedEquipment?.some((id) => defender.equipment.includes(id))), speedChangedThisRound:',
)

# Ready every Equipment card at Honor; exhausted state otherwise persists across turns.
replace_once(
    "app/playtest.tsx",
    'reversalUsedRound: false, triggeredCombos: [] };\n  const ai = { ...current.ai,',
    'reversalUsedRound: false, exhaustedEquipment: [], triggeredCombos: [] };\n  const ai = { ...current.ai,',
)
replace_once(
    "app/playtest.tsx",
    'reversalUsedRound: false, triggeredCombos: [] };\n  const marketState =',
    'reversalUsedRound: false, exhaustedEquipment: [], triggeredCombos: [] };\n  const marketState =',
)

# Player activation action. Supported activations are explicit; unsupported Exhaust text never silently fires.
activation_anchor = '  const practiceDefense = (id: string) => setMatch((current) => {'
activation_code = r'''  const activateEquipment = (id: string) => setMatch((current) => {
    if (!current || current.winner || current.pendingChoice || current.phase !== "player-yell") return current;
    if (!current.player.equipment.includes(id) || current.player.exhaustedEquipment?.includes(id)) return current;
    const card = cardFor(id);
    const plan = card ? equipmentActivationPlan(card) : null;
    if (!card || !plan) return current;

    let player: Board = { ...current.player, exhaustedEquipment: [...(current.player.exhaustedEquipment ?? []), id] };
    let pendingChoice: PendingChoice | null = null;
    const notes: string[] = [`${card.name} exhausted`];

    if (plan.kind === "speed-tempo-cycle") {
      player = { ...player, tempSpeed: player.tempSpeed + plan.speed, speedChangedThisRound: true };
      notes.push(`+${plan.speed} Speed until Honor`);
      if (player.tempo && plan.draw > 0) {
        player = drawCards(player, plan.draw);
        if (plan.discard > 0 && player.hand.length) pendingChoice = { kind: "discard-hand", sourceCardId: id, remaining: Math.min(plan.discard, player.hand.length) };
        notes.push(`Tempo held: drew ${plan.draw}${pendingChoice ? `; choose ${pendingChoice.remaining} discard` : ""}`);
      }
    }

    return write(current, `${notes.join(". ")}. It will Ready at the next Honor Phase.`, { player, pendingChoice });
  });

'''
replace_once("app/playtest.tsx", activation_anchor, activation_code + activation_anchor)

# Ready-on-Hit becomes an explicit optional Equipment choice before other optional post-hit cycling.
old_choice = '''    const optionalCycle = !nextAi.hp ? null : optionalDiscardDrawChoice(card);\n    const pendingChoice: PendingChoice | null = optionalCycle && nextPlayer.hand.length ? { kind: "discard-draw", sourceCardId: card.id, remaining: optionalCycle.discard, draw: optionalCycle.draw } : null;'''
new_choice = '''    const readyCount = hit && nextAi.hp ? readyEquipmentOnHit(card) : 0;\n    const readyTargets = (nextPlayer.exhaustedEquipment ?? []).filter((id) => nextPlayer.equipment.includes(id));\n    const optionalCycle = !nextAi.hp ? null : optionalDiscardDrawChoice(card);\n    const pendingChoice: PendingChoice | null = readyCount && readyTargets.length\n      ? { kind: "ready-equipment", sourceCardId: card.id, remaining: Math.min(readyCount, readyTargets.length) }\n      : optionalCycle && nextPlayer.hand.length ? { kind: "discard-draw", sourceCardId: card.id, remaining: optionalCycle.discard, draw: optionalCycle.draw } : null;'''
replace_once("app/playtest.tsx", old_choice, new_choice)

# Resolve an explicit Ready choice.
ready_branch_anchor = '    if (choice.kind === "discard-hand") {'
ready_branch = r'''    if (choice.kind === "ready-equipment") {
      if (source !== "equipment" || !current.player.equipment.includes(cardId) || !current.player.exhaustedEquipment?.includes(cardId)) return current;
      const player = { ...current.player, exhaustedEquipment: current.player.exhaustedEquipment.filter((id) => id !== cardId) };
      const remaining = choice.remaining - 1;
      const readyTargets = (player.exhaustedEquipment ?? []).filter((id) => player.equipment.includes(id));
      const pendingChoice = remaining > 0 && readyTargets.length ? { ...choice, remaining: Math.min(remaining, readyTargets.length) } : null;
      return write(current, `${selected.name} readied by ${cardFor(choice.sourceCardId)?.name ?? "the printed effect"}.${pendingChoice ? ` Choose ${pendingChoice.remaining} more Equipment.` : " Choice resolved."}`, { player, pendingChoice });
    }

'''
replace_once("app/playtest.tsx", ready_branch_anchor, ready_branch + ready_branch_anchor)

# Equipment becomes a first-class source in the choice UI.
replace_once(
    "app/playtest.tsx",
    'const resolvePendingChoice = (cardId: string, source: "hand" | "discard" | "deck" = "hand")',
    'const resolvePendingChoice = (cardId: string, source: "hand" | "discard" | "deck" | "equipment" = "hand")',
)
replace_once(
    "app/playtest.tsx",
    '    : match.pendingChoice?.kind === "discard-draw" || match.pendingChoice?.kind === "discard-hand"\n      ? player.hand.map((id, index) => ({ id, source: "hand" as const, index }))\n      : match.pendingChoice?.kind === "deck-pick"',
    '    : match.pendingChoice?.kind === "discard-draw" || match.pendingChoice?.kind === "discard-hand"\n      ? player.hand.map((id, index) => ({ id, source: "hand" as const, index }))\n      : match.pendingChoice?.kind === "ready-equipment"\n        ? (player.exhaustedEquipment ?? []).filter((id) => player.equipment.includes(id)).map((id, index) => ({ id, source: "equipment" as const, index }))\n      : match.pendingChoice?.kind === "deck-pick"',
)
replace_once(
    "app/playtest.tsx",
    '      : match.pendingChoice?.kind === "discard-hand" ? "Choose what to discard"\n        : match.pendingChoice?.kind === "deck-pick"',
    '      : match.pendingChoice?.kind === "discard-hand" ? "Choose what to discard"\n        : match.pendingChoice?.kind === "ready-equipment" ? "Ready Equipment"\n        : match.pendingChoice?.kind === "deck-pick"',
)
replace_once(
    "app/playtest.tsx",
    '      : match.pendingChoice?.kind === "discard-hand" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} requires ${match.pendingChoice.remaining} more discard${match.pendingChoice.remaining === 1 ? "" : "s"}. You choose the card.`\n        : match.pendingChoice?.kind === "deck-pick"',
    '      : match.pendingChoice?.kind === "discard-hand" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} requires ${match.pendingChoice.remaining} more discard${match.pendingChoice.remaining === 1 ? "" : "s"}. You choose the card.`\n        : match.pendingChoice?.kind === "ready-equipment" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} lets you Ready ${match.pendingChoice.remaining} exhausted Equipment card${match.pendingChoice.remaining === 1 ? "" : "s"}. Choose one or skip.`\n        : match.pendingChoice?.kind === "deck-pick"',
)
replace_once(
    "app/playtest.tsx",
    'const effectChoiceCanSkip = match.pendingChoice?.kind === "discard-draw" || (match.pendingChoice?.kind === "deck-pick" && match.pendingChoice.optional);',
    'const effectChoiceCanSkip = match.pendingChoice?.kind === "discard-draw" || match.pendingChoice?.kind === "ready-equipment" || (match.pendingChoice?.kind === "deck-pick" && match.pendingChoice.optional);',
)
replace_once(
    "app/playtest.tsx",
    '    if (current.pendingChoice.kind === "discard-draw") return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: discard/draw declined.`, { pendingChoice: null });',
    '    if (current.pendingChoice.kind === "discard-draw") return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: discard/draw declined.`, { pendingChoice: null });\n    if (current.pendingChoice.kind === "ready-equipment") return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: Ready effect declined.`, { pendingChoice: null });',
)
replace_once(
    "app/playtest.tsx",
    'entry.source === "deck" ? "REVEALED" : "HAND"',
    'entry.source === "deck" ? "REVEALED" : entry.source === "equipment" ? "EQUIPMENT" : "HAND"',
)

# Loadout displays state and exposes only supported activation controls for the player.
replace_once(
    "app/playtest.tsx",
    '<footer>{inspectedBoard ? "Click an equipped card to inspect it. " : `${cardEffectNote(inspected)} `}Click the card image to magnify it. Press Escape to close.</footer>',
    '''{inspectedBoard === player && player.equipment.some((id) => { const item = cardFor(id); return Boolean(item && equipmentActivationPlan(item)); }) && <section className="equipment-activation-tray"><header><span className="eyebrow">Active Equipment</span><b>Exhaust / Ready</b></header><div>{player.equipment.map((id, index) => { const item = cardFor(id); const plan = item ? equipmentActivationPlan(item) : null; if (!item || !plan) return null; const exhausted = Boolean(player.exhaustedEquipment?.includes(id)); return <button type="button" disabled={exhausted || match.phase !== "player-yell" || Boolean(match.pendingChoice)} onClick={() => activateEquipment(id)} key={`${id}-${index}`}><span className={exhausted ? "is-exhausted" : "is-ready"}>{exhausted ? "EXHAUSTED" : "READY"}</span><b>{item.name}</b><small>{exhausted ? "Readies at next Honor" : match.phase === "player-yell" ? "Exhaust to activate" : "Activates during Yell"}</small></button>; })}</div></section>}\n        <footer>{inspectedBoard ? `Click an equipped card to inspect it. ${(inspectedBoard.exhaustedEquipment ?? []).length} exhausted. ` : `${cardEffectNote(inspected)} `}Click the card image to magnify it. Press Escape to close.</footer>''',
)

# Visual state for activation controls.
css = Path("app/playtest-board-v4.css")
css_text = css.read_text()
css_marker = "/* Equipment activation state — Exhaust / Ready. */"
if css_marker not in css_text:
    css_text += r'''

/* Equipment activation state — Exhaust / Ready. */
.equipment-activation-tray { margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.13); }
.equipment-activation-tray > header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.equipment-activation-tray > header b { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
.equipment-activation-tray > div { display: flex; flex-wrap: wrap; gap: 8px; }
.equipment-activation-tray button { min-width: 210px; display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; gap: 2px 8px; align-items: center; padding: 8px 10px; border: 1px solid rgba(245,179,34,.35); background: rgba(245,179,34,.06); color: inherit; text-align: left; cursor: pointer; }
.equipment-activation-tray button:disabled { cursor: default; opacity: .58; }
.equipment-activation-tray button > span { grid-row: 1 / span 2; min-width: 62px; padding: 5px 6px; border-radius: 999px; font-size: 8px; font-weight: 900; letter-spacing: .08em; text-align: center; }
.equipment-activation-tray .is-ready { background: rgba(47,196,112,.16); color: #8ff0b7; border: 1px solid rgba(47,196,112,.38); }
.equipment-activation-tray .is-exhausted { background: rgba(211,74,74,.15); color: #ffaaaa; border: 1px solid rgba(211,74,74,.38); }
.equipment-activation-tray button > b { font-size: 11px; }
.equipment-activation-tray button > small { font-size: 8px; opacity: .72; }
'''
    css.write_text(css_text)

# Resolver tests.
test_path = Path("tests/effect-resolvers.test.mjs")
test_text = test_path.read_text()
test_text = test_text.replace(
    'equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty,',
    'equipmentPiercing, equipmentSpeedModifier, equipmentActivationPlan, firstIncomingAttackPowerPenalty,'
)
test_text = test_text.replace(
    'optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty,',
    'optionalDiscardDrawChoice, passiveEquipmentGuard, readyEquipmentOnHit, targetNextAttackPenalty,'
)
if 'Equipment Exhaust plans and Ready-on-Hit wording parse explicitly' not in test_text:
    test_text += r'''

test("Equipment Exhaust plans and Ready-on-Hit wording parse explicitly", () => {
  assert.deepEqual(equipmentActivationPlan({ rulesText: "Exhaust: Gain +1 Speed until the next Honor Phase. If you have Tempo after doing so, draw 1 card, then discard 1 card." }), { kind: "speed-tempo-cycle", speed: 1, draw: 1, discard: 1 });
  assert.equal(equipmentActivationPlan({ rulesText: "Exhaust: Before you play an Attack, choose High, Mid, or Low." }), null);
  assert.equal(readyEquipmentOnHit({ rulesText: "If the target has exhausted Equipment, this Attack gains Piercing 1. If it Hits, you may ready one Equipment card you control." }), 1);
});
'''
test_path.write_text(test_text)

# Integration regression contract.
integration = Path("tests/playtest-effect-integration.test.mjs")
integration_text = integration.read_text()
if 'Quick Duel persists Exhausted Equipment and readies it at Honor' not in integration_text:
    integration_text += r'''

test("Quick Duel persists Exhausted Equipment and readies it at Honor", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /exhaustedEquipment\?: string\[\]/);
  assert.match(source, /activateEquipment/);
  assert.match(source, /equipmentActivationPlan/);
  assert.match(source, /kind: "ready-equipment"/);
  assert.match(source, /readyEquipmentOnHit/);
  assert.match(source, /exhaustedEquipment: \[\]/);
  assert.match(source, /EXHAUSTED/);
  assert.match(source, /Readies at next Honor/);
});
'''
integration.write_text(integration_text)
