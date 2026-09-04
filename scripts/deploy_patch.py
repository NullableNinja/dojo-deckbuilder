from pathlib import Path
import re

root = Path('.')
playtest_path = root / 'app/playtest.tsx'
playtest = playtest_path.read_text()

combo_engine = r'''export type ComboCardLike = {
  id: string;
  name: string;
  cardType?: string;
  subtype?: string;
  zone?: string | null;
  tags?: string[];
  rulesText?: string | null;
  details?: Record<string, string | number | null | undefined>;
};

export type ComboContext = {
  priorCards: ComboCardLike[];
  attacksThisTurn: number;
  defendedThisRound: boolean;
  hitThisTurn: boolean;
  zonesPlayed: string[];
  equipment: ComboCardLike[];
  currentCard: ComboCardLike;
  currentZone: string;
  isReversal?: boolean;
};

export type ComboEvaluation = {
  requirement: string;
  payoff: string;
  eligible: boolean;
  supported: boolean;
  reason: string;
  power: number;
  damage: number;
  focusOnHit: number;
  grantsFlow: boolean;
  speedOnTrigger: number;
};

const value = (entry: unknown) => String(entry ?? '').trim();
const tags = (card: ComboCardLike) => (card.tags ?? []).map((tag) => tag.toLocaleLowerCase());
const hasTag = (card: ComboCardLike, tag: string) => tags(card).some((entry) => entry.includes(tag.toLocaleLowerCase()));
const isAttack = (card: ComboCardLike) => card.subtype === 'Attack' || card.cardType === 'Attack' || /attack/i.test(value(card.subtype)) || hasTag(card, 'Attack');
const isDefense = (card: ComboCardLike) => card.subtype === 'Defense' || /defense/i.test(value(card.subtype)) || hasTag(card, 'Defense') || hasTag(card, 'Block');
const isKata = (card: ComboCardLike) => card.subtype === 'Kata' || /kata/i.test(value(card.subtype)) || hasTag(card, 'Kata');

export function comboRequirementText(combo: ComboCardLike) {
  const details = combo.details ?? {};
  const explicit = value(details['Sequence / Requirement'] ?? details.Requirement ?? details['Sequence']);
  if (explicit && explicit !== '—') return explicit;
  const text = value(combo.rulesText);
  const match = text.match(/Requirement:\s*([^.]+)/i);
  return match?.[1]?.trim() || 'Complete the printed sequence or condition.';
}

export function comboPayoffText(combo: ComboCardLike) {
  const details = combo.details ?? {};
  const explicit = value(details.Effect ?? details.Payoff);
  if (explicit && explicit !== '—') return explicit;
  const text = value(combo.rulesText);
  const payoff = text.match(/Payoff:\s*(.+)$/i)?.[1]?.trim();
  return payoff || text || 'Printed payoff pending.';
}

function descriptorMatches(descriptor: string, card: ComboCardLike, zone = '') {
  const text = descriptor.toLocaleLowerCase();
  if (/\battack\b/.test(text) && !isAttack(card)) return false;
  if (/\bdefense\b|\bblock\b/.test(text) && !isDefense(card)) return false;
  if (/\bkata\b/.test(text) && !isKata(card)) return false;
  const tagChecks = ['punch', 'kick', 'jump', 'spin', 'weapon', 'hand', 'leg', 'multi-hit', 'flow', 'push', 'dodge'];
  for (const tag of tagChecks) if (text.includes(tag) && !hasTag(card, tag)) return false;
  for (const candidate of ['high', 'mid', 'low']) {
    if (new RegExp(`\\b${candidate}\\b`, 'i').test(text) && zone && zone.toLocaleLowerCase() !== candidate) return false;
  }
  return true;
}

function orderedAttackSequence(parts: string[], context: ComboContext) {
  const priorAttacks = context.priorCards.filter(isAttack);
  const prior = priorAttacks.map((card, index) => ({ card, zone: context.zonesPlayed[index] ?? '' }));
  const requiredPrior = parts.slice(0, -1);
  const current = parts.at(-1) ?? '';
  if (!descriptorMatches(current, context.currentCard, context.currentZone)) return false;
  let cursor = 0;
  for (const descriptor of requiredPrior) {
    let matched = false;
    while (cursor < prior.length) {
      const entry = prior[cursor++];
      if (descriptorMatches(descriptor, entry.card, entry.zone)) { matched = true; break; }
    }
    if (!matched) return false;
  }
  return true;
}

function parsePayoff(payoff: string) {
  const power = Number(payoff.match(/\+(\d+)\s+Attack Power/i)?.[1] ?? 0);
  const damage = Number(payoff.match(/\+(\d+)\s+Damage/i)?.[1] ?? 0);
  const focus = Number(payoff.match(/gain\s+\+?(\d+)\s+Focus/i)?.[1] ?? 0);
  const speed = Number(payoff.match(/gain\s+\+?(\d+)\s+Speed/i)?.[1] ?? 0);
  const grantsFlow = /(?:Attack|strike|finisher)[^.]*gains? Flow|gains? Flow[^.]*Attack/i.test(payoff);
  const focusOnHit = focus && /\bHit(?:s)?\b/i.test(payoff) ? focus : 0;
  const recognized = Boolean(power || damage || focusOnHit || grantsFlow || speed);
  return { power, damage, focusOnHit, grantsFlow, speedOnTrigger: speed, recognized };
}

export function evaluateCombo(combo: ComboCardLike, context: ComboContext): ComboEvaluation {
  const requirement = comboRequirementText(combo);
  const payoff = comboPayoffText(combo);
  const lower = requirement.toLocaleLowerCase();
  let eligible = true;
  let recognizedRequirement = false;
  const reasons: string[] = [];

  const arrowParts = requirement.split(/\s*(?:→|->)\s*/).map((part) => part.trim()).filter(Boolean);
  if (arrowParts.length > 1) {
    recognizedRequirement = true;
    if (!orderedAttackSequence(arrowParts, context)) { eligible = false; reasons.push('sequence not complete'); }
  }

  if (/different zone/i.test(requirement)) {
    recognizedRequirement = true;
    const priorZone = context.zonesPlayed.at(-1);
    if (!priorZone || priorZone.toLocaleLowerCase() === context.currentZone.toLocaleLowerCase()) { eligible = false; reasons.push('needs a different zone'); }
  }
  if (/block(?:ed)? an? attack|after you played a defense|\bblock\b/i.test(requirement)) {
    recognizedRequirement = true;
    if (!context.defendedThisRound) { eligible = false; reasons.push('needs a Block/Defense first'); }
  }
  if (/\bkata\b/i.test(requirement) && arrowParts.length <= 1) {
    recognizedRequirement = true;
    if (!context.priorCards.some(isKata)) { eligible = false; reasons.push('needs a Kata first'); }
  }
  if (/\breversal\b/i.test(requirement)) {
    recognizedRequirement = true;
    if (!context.isReversal) { eligible = false; reasons.push('needs a Reversal'); }
  }
  if (/second attack/i.test(requirement)) {
    recognizedRequirement = true;
    if (context.attacksThisTurn !== 1) { eligible = false; reasons.push('finisher must be your second Attack'); }
  }
  if (/third attack|first two attacks/i.test(requirement)) {
    recognizedRequirement = true;
    if (context.attacksThisTurn < 2) { eligible = false; reasons.push('needs two prior Attacks'); }
  }
  if (/first attack hit|first attack hits/i.test(requirement)) {
    recognizedRequirement = true;
    if (!context.hitThisTurn || context.attacksThisTurn < 1) { eligible = false; reasons.push('first Attack must Hit'); }
  }
  if (/two or more permanent equipment|2\+ permanent equipment/i.test(requirement)) {
    recognizedRequirement = true;
    if (context.equipment.length < 2) { eligible = false; reasons.push('needs 2 permanent Equipment'); }
  }

  if (!recognizedRequirement) {
    if ((combo.tags ?? []).some((tag) => /Kata/i.test(tag))) {
      recognizedRequirement = true;
      if (!context.priorCards.some(isKata)) { eligible = false; reasons.push('needs a Kata first'); }
    }
    if ((combo.tags ?? []).some((tag) => /Block/i.test(tag))) {
      recognizedRequirement = true;
      if (!context.defendedThisRound) { eligible = false; reasons.push('needs a Block first'); }
    }
    if ((combo.tags ?? []).some((tag) => /Multi-Hit/i.test(tag))) {
      recognizedRequirement = true;
      if (!context.priorCards.some((card) => isAttack(card) && hasTag(card, 'Multi-Hit'))) { eligible = false; reasons.push('needs a Multi-Hit Attack first'); }
    }
    if ((combo.tags ?? []).some((tag) => /Jump/i.test(tag)) && (combo.tags ?? []).some((tag) => /Kick/i.test(tag))) {
      recognizedRequirement = true;
      if (!context.priorCards.some((card) => isAttack(card) && hasTag(card, 'Jump')) || !hasTag(context.currentCard, 'Kick')) { eligible = false; reasons.push('needs Jump Attack → Kick'); }
    }
  }

  const parsed = parsePayoff(payoff);
  const supported = recognizedRequirement && parsed.recognized;
  return {
    requirement,
    payoff,
    eligible: eligible && supported,
    supported,
    reason: !supported ? 'This Combo still needs a dedicated digital resolver.' : eligible ? 'Requirement complete on this Attack.' : reasons[0] ?? 'Requirement not complete yet.',
    power: parsed.power,
    damage: parsed.damage,
    focusOnHit: parsed.focusOnHit,
    grantsFlow: parsed.grantsFlow,
    speedOnTrigger: parsed.speedOnTrigger,
  };
}
'''
(root / 'app/combo-engine.ts').write_text(combo_engine)

combo_css = r'''/* Learned Combo rack — persistent face-up Combo visibility during Quick Duel. */
.active-combo-rack {
  margin: 0 0 14px;
  border: 1px solid rgba(245,179,34,.34);
  background: linear-gradient(135deg, rgba(245,179,34,.12), rgba(255,255,255,.035));
  padding: 12px;
}
.active-combo-rack > header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 9px; }
.active-combo-rack > header span { color: var(--gold); font-size: 9px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
.active-combo-rack > header small { color: #aebbb4; font-size: 10px; }
.active-combo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.active-combo-card { position: relative; display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; width: 100%; border: 1px solid rgba(255,255,255,.13); padding: 10px 11px; text-align: left; color: #eef5f1; background: rgba(8,22,16,.42); cursor: pointer; }
.active-combo-card > i { grid-row: 1 / span 3; display: grid; width: 32px; height: 32px; place-items: center; border: 1px solid rgba(245,179,34,.5); border-radius: 50%; color: var(--gold); font-style: normal; font-size: 18px; }
.active-combo-card b { font-size: 12px; }
.active-combo-card span { color: #b9c8c0; font-size: 10px; line-height: 1.35; }
.active-combo-card small { color: #d6dfda; font-size: 9px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
.active-combo-card.is-ready { border-color: rgba(245,179,34,.8); box-shadow: inset 3px 0 0 var(--gold); }
.active-combo-card.is-ready small { color: #ffd566; }
.active-combo-card.is-triggered { border-color: rgba(101,195,143,.55); opacity: .82; }
.active-combo-card.is-triggered small { color: #7ed7a6; }
.active-combo-card.is-manual small { color: #eaa47e; }
.combo-digital-note { margin: 11px 0; border-left: 3px solid var(--gold); padding: 9px 12px; color: #45534c; background: rgba(245,179,34,.1); font-size: 11px; line-height: 1.5; }
:root[data-theme="dark"] .combo-digital-note { color: #d4dfd8; background: rgba(245,179,34,.08); }
.learned-combos button small.combo-requirement-mini { display: block; margin-top: 3px; white-space: normal; line-height: 1.25; text-align: left; }
@media (max-width: 900px) { .active-combo-grid { grid-template-columns: 1fr; } }
'''
(root / 'app/combo-rack.css').write_text(combo_css)

combo_test = r'''import assert from "node:assert/strict";
import test from "node:test";
import { comboRequirementText, evaluateCombo } from "../app/combo-engine.ts";

const attack = (name, tags = [], zone = "Mid") => ({ id: name, name, cardType: "Technique", subtype: "Attack", tags, zone, details: {} });

test("Combo evaluator reads the dedicated Sequence / Requirement field", () => {
  const combo = { id: "c1", name: "Blitzed Expectations", tags: ["Multi-Hit"], rulesText: "The final Attack gets +1 Attack Power and gains Flow.", details: { "Sequence / Requirement": "Multi-Hit Attack → any Attack", Effect: "The final Attack gets +1 Attack Power and gains Flow." } };
  assert.equal(comboRequirementText(combo), "Multi-Hit Attack → any Attack");
  const result = evaluateCombo(combo, { priorCards: [attack("Blitz", ["Multi-Hit"])], attacksThisTurn: 1, defendedThisRound: false, hitThisTurn: false, zonesPlayed: ["Mid"], equipment: [], currentCard: attack("Jab"), currentZone: "High" });
  assert.equal(result.eligible, true);
  assert.equal(result.power, 1);
  assert.equal(result.grantsFlow, true);
});

test("Combo evaluator enforces a different-zone finisher", () => {
  const combo = { id: "c2", name: "Bird Law", tags: ["Jump", "Kick"], rulesText: "If the Jump Attack Hit, the finishing Kick gets +2 Attack Power and you gain +2 Speed until end of round.", details: { "Sequence / Requirement": "Jump Attack → Kick in a different Zone", Effect: "If the Jump Attack Hit, the finishing Kick gets +2 Attack Power and you gain +2 Speed until end of round." } };
  const base = { priorCards: [attack("Jump", ["Jump"], "High")], attacksThisTurn: 1, defendedThisRound: false, hitThisTurn: true, zonesPlayed: ["High"], equipment: [], currentCard: attack("Kick", ["Kick"], "Low") };
  assert.equal(evaluateCombo(combo, { ...base, currentZone: "Low" }).eligible, true);
  assert.equal(evaluateCombo(combo, { ...base, currentZone: "High" }).eligible, false);
  assert.equal(evaluateCombo(combo, { ...base, currentZone: "Low" }).speedOnTrigger, 2);
});

test("Combo evaluator does not pretend an unsupported payoff works", () => {
  const combo = { id: "c3", name: "Piercing Filing", tags: ["Block"], rulesText: "Requirement: Block an Attack, then make a Weapon Attack. Payoff: That Attack gets Piercing 1.", details: {} };
  const result = evaluateCombo(combo, { priorCards: [], attacksThisTurn: 0, defendedThisRound: true, hitThisTurn: false, zonesPlayed: [], equipment: [], currentCard: attack("Weapon hit", ["Weapon"]), currentZone: "Mid" });
  assert.equal(result.supported, false);
  assert.equal(result.eligible, false);
});
'''
(root / 'tests/combo-engine.test.mjs').write_text(combo_test)

if 'from "./combo-engine"' not in playtest:
    playtest = playtest.replace('import { compileCardEffects, describeEffectPlan } from "./card-effects";\n', 'import { compileCardEffects, describeEffectPlan } from "./card-effects";\nimport { comboPayoffText, comboRequirementText, evaluateCombo } from "./combo-engine";\nimport "./combo-rack.css";\n')

new_combo_block = r'''type CombatModifier = { value: number; notes: string[] };
type AttackModifier = { power: number; damage: number; notes: string[] };
type ComboModifier = AttackModifier & { focusOnHit: number; grantsFlow: boolean; speedOnTrigger: number; triggeredIds: string[] };

function comboAttackModifier(board: Board, card: CardEntry, zone: string, isReversal = false): ComboModifier {
  const result: ComboModifier = { power: 0, damage: 0, focusOnHit: 0, grantsFlow: false, speedOnTrigger: 0, triggeredIds: [], notes: [] };
  const priorCards = board.cardsThisTurn.map(cardFor).filter(Boolean) as CardEntry[];
  const equipment = board.equipment.map(cardFor).filter(Boolean) as CardEntry[];
  for (const comboId of board.learnedCombos) {
    if (board.triggeredCombos.includes(comboId)) continue;
    const combo = cardFor(comboId);
    if (!combo) continue;
    const evaluation = evaluateCombo(combo, {
      priorCards,
      attacksThisTurn: board.attacksThisTurn,
      defendedThisRound: board.defendedThisRound,
      hitThisTurn: board.hitThisTurn,
      zonesPlayed: board.zonesPlayed,
      equipment,
      currentCard: card,
      currentZone: zone,
      isReversal,
    });
    if (!evaluation.eligible) continue;
    result.power += evaluation.power;
    result.damage += evaluation.damage;
    result.focusOnHit += evaluation.focusOnHit;
    result.grantsFlow ||= evaluation.grantsFlow;
    result.speedOnTrigger += evaluation.speedOnTrigger;
    result.triggeredIds.push(combo.id);
    const payoffBits = [evaluation.power ? `+${evaluation.power} power` : "", evaluation.damage ? `+${evaluation.damage} damage` : "", evaluation.grantsFlow ? "Flow" : "", evaluation.focusOnHit ? `${evaluation.focusOnHit} Focus on Hit` : "", evaluation.speedOnTrigger ? `+${evaluation.speedOnTrigger} Speed` : ""].filter(Boolean);
    result.notes.push(`COMBO — ${combo.name}: ${payoffBits.join(", ")}`);
  }
  return result;
}

function locationAttackModifier'''
playtest, count = re.subn(r'type CombatModifier = \{ value: number; notes: string\[\] \};\ntype AttackModifier = \{ power: number; damage: number; notes: string\[\] \};\ntype ComboModifier = AttackModifier & \{ focusOnHit: number; grantsFlow: boolean; triggeredIds: string\[\] \};\n\nfunction comboAttackModifier\(board: Board, card: CardEntry, zone: string, isReversal = false\): ComboModifier \{.*?\n\}\n\nfunction locationAttackModifier', new_combo_block, playtest, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'Could not replace comboAttackModifier block; count={count}')

# Apply speed payoffs after the qualifying Combo fires. This replacement covers normal attacks and Reversals.
playtest = playtest.replace('if (hit && comboModifier.focusOnHit) nextPlayer.focus += comboModifier.focusOnHit;', 'if (hit && comboModifier.focusOnHit) nextPlayer.focus += comboModifier.focusOnHit;\n    if (comboModifier.speedOnTrigger) nextPlayer.tempSpeed += comboModifier.speedOnTrigger;')

anchor = '  const defenseOptions = match.pendingStrike ? legalDefenseIds(player, match.pendingStrike.zone) : [];\n'
combo_state = r'''  const learnedComboStates = player.learnedCombos.map((id) => {
    const combo = cardFor(id);
    if (!combo) return null;
    const evaluation = pendingAttack ? evaluateCombo(combo, {
      priorCards: player.cardsThisTurn.map(cardFor).filter(Boolean) as CardEntry[],
      attacksThisTurn: player.attacksThisTurn,
      defendedThisRound: player.defendedThisRound,
      hitThisTurn: player.hitThisTurn,
      zonesPlayed: player.zonesPlayed,
      equipment: player.equipment.map(cardFor).filter(Boolean) as CardEntry[],
      currentCard: pendingAttack,
      currentZone: match.selectedZone,
      isReversal: match.phase === "reversal-window",
    }) : null;
    return { combo, evaluation, triggered: player.triggeredCombos.includes(id) };
  }).filter(Boolean) as { combo: CardEntry; evaluation: ReturnType<typeof evaluateCombo> | null; triggered: boolean }[];
'''
if combo_state.strip() not in playtest:
    if anchor not in playtest: raise SystemExit('Could not find learned Combo state anchor')
    playtest = playtest.replace(anchor, anchor + combo_state, 1)

rack_anchor = '      <section className={`playtest-combat-desk paper-stack state-${match.phase}`}>\n        <div className="live-mat-heading">'
rack = r'''      <section className={`playtest-combat-desk paper-stack state-${match.phase}`}>
        {learnedComboStates.length > 0 && <section className="active-combo-rack" aria-label="Learned Combos"><header><span>∞ Learned Combos · face up</span><small>The digital field test fires supported payoffs automatically when the requirement completes.</small></header><div className="active-combo-grid">{learnedComboStates.map(({ combo, evaluation, triggered }) => { const state = triggered ? "is-triggered" : evaluation?.eligible ? "is-ready" : evaluation && !evaluation.supported ? "is-manual" : ""; const status = triggered ? "Triggered this round" : evaluation?.eligible ? "WILL TRIGGER on selected Attack" : evaluation && !evaluation.supported ? "Manual resolver pending" : "Watching your sequence"; return <button type="button" className={`active-combo-card ${state}`} onClick={() => setInspectedId(combo.id)} key={combo.id}><i aria-hidden="true">∞</i><b>{combo.name}</b><span>{comboRequirementText(combo)}</span><small>{status}</small></button>; })}</div></section>}
        <div className="live-mat-heading">'''
if 'className="active-combo-rack"' not in playtest:
    if rack_anchor not in playtest: raise SystemExit('Could not find combat desk rack anchor')
    playtest = playtest.replace(rack_anchor, rack, 1)

combo_offer_anchor = '          {deskView === "combo" && <section className="ascend-combo combo-panel">\n            <header>'
combo_offer_repl = '          {deskView === "combo" && <section className="ascend-combo combo-panel">\n            <p className="combo-digital-note"><b>Learned Combos stay face up beside your fighter.</b> During Yell, the live Combo rack shows the printed requirement and previews whether your selected Attack will complete it. Supported payoffs fire automatically; anything not yet automated is labeled instead of being silently faked.</p>\n            <header>'
if 'className="combo-digital-note"' not in playtest:
    if combo_offer_anchor not in playtest: raise SystemExit('Could not find Combo Docket anchor')
    playtest = playtest.replace(combo_offer_anchor, combo_offer_repl, 1)

old_learned = '{player.learnedCombos.length > 0 && <div className="learned-combos">{player.learnedCombos.map((id) => <button key={id} onClick={() => setInspectedId(id)}><span>∞</span><b>{cardFor(id)?.name}</b><small>{player.triggeredCombos.includes(id) ? "Triggered this round" : "Ready"}</small></button>)}</div>}'
new_learned = '{player.learnedCombos.length > 0 && <div className="learned-combos">{player.learnedCombos.map((id) => { const learned = cardFor(id); if (!learned) return null; return <button key={id} onClick={() => setInspectedId(id)}><span>∞</span><b>{learned.name}</b><small>{player.triggeredCombos.includes(id) ? "Triggered this round" : "Face up · watches automatically"}</small><small className="combo-requirement-mini">Requirement: {comboRequirementText(learned)}</small><small className="combo-requirement-mini">Payoff: {comboPayoffText(learned)}</small></button>; })}</div>}'
if old_learned in playtest:
    playtest = playtest.replace(old_learned, new_learned, 1)
elif 'combo-requirement-mini' not in playtest:
    raise SystemExit('Could not enrich learned Combo Docket list')

playtest_path.write_text(playtest)

# Static regression assertions for the integration surface.
regression = r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel keeps learned Combos visible and evaluates the dedicated requirement field", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /active-combo-rack/);
  assert.match(source, /comboRequirementText/);
  assert.match(source, /evaluateCombo/);
  assert.match(source, /COMBO —/);
  assert.match(source, /Manual resolver pending/);
});
'''
(root / 'tests/combo-playtest-ui.test.mjs').write_text(regression)
