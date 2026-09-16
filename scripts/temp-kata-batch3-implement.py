from pathlib import Path
import json


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)

# -----------------------------------------------------------------------------
# app/kata-playtest-bridge.ts
# -----------------------------------------------------------------------------
p = Path("app/kata-playtest-bridge.ts")
s = p.read_text()
s = replace_once(
    s,
    'import { conditionValue, structuredRuntimeEffects, type RuntimeCardLike } from "./family-effect-runtime.ts";',
    'import { conditionValue, structuredRuntimeEffects, type RuntimeCardLike, type RuntimeCommand, type RuntimeTrigger } from "./family-effect-runtime.ts";',
    "kata bridge import",
)
if "export function kataRuntimeCommandsForHost(" in s:
    raise SystemExit("kata runtime adapter already exists")
s += r'''

const SIMPLE_KATA_RUNTIME_RESOLVERS = new Set([
  "kata.conditional",
  "kata.attackModifier",
  "kata.nextAttackPiercing",
]);

const KATA_RUNTIME_EFFECT_BY_ACTION: Record<string, string> = {
  draw: "core.draw",
  discard: "core.discard",
  heal: "core.heal",
  gainFocus: "core.gainFocus",
  gainXP: "core.gainXP",
  modifySpeed: "combat.modifySpeed",
  modifyAttackPower: "combat.modifyAttackPower",
  modifyDefense: "combat.modifyDefense",
  modifyGuard: "combat.modifyGuard",
  preventDamage: "combat.preventDamage",
  dealDamage: "combat.dealDamage",
  grantFlow: "combat.grantFlow",
  chooseZone: "combat.chooseZone",
  piercing: "combat.piercing",
};

/**
 * Converts only Kata resolvers that already fit the generic one-shot/status runtime.
 * Complex choices, deferred watchers, equipment actions, discounts, reveals, and
 * multi-event plans intentionally stay out until their matching host protocol exists.
 */
export function kataRuntimeCommandsForHost(
  card: RuntimeCardLike,
  trigger: RuntimeTrigger,
  facts: KataHostFacts = {},
): RuntimeCommand[] {
  return kataCommandsForHost(card, trigger, facts).flatMap((command) => {
    const resolver = String(command.resolver ?? "");
    if (!SIMPLE_KATA_RUNTIME_RESOLVERS.has(resolver)) return [];
    if (resolver === "kata.attackModifier" && !(command.action === "modifyAttackPower" && command.duration === "nextAttack")) return [];
    if (resolver === "kata.nextAttackPiercing" && !(command.action === "piercing" && command.duration === "nextAttack")) return [];
    const effect = KATA_RUNTIME_EFFECT_BY_ACTION[String(command.action ?? "")];
    if (!effect) return [];
    return [{
      sourceEffectId: String(command.effectId ?? `kata:${resolver}:${trigger}`),
      effect,
      trigger,
      target: "self",
      amount: Number(command.amount ?? 0),
      duration: String(command.duration ?? "immediate"),
      resolver,
      conditions: [],
      qualifier: command.params,
    }];
  });
}
'''
p.write_text(s)

# -----------------------------------------------------------------------------
# app/playtest.tsx
# -----------------------------------------------------------------------------
p = Path("app/playtest.tsx")
s = p.read_text()
import_anchor = 'import { structuredRuntimeResolvers, type RuntimeChoice, type RuntimeCommand, type RuntimeStatus, type RuntimeTrigger } from "./family-effect-runtime";\n'
s = replace_once(
    s,
    import_anchor,
    import_anchor + 'import { isCoreKataCard, kataRuntimeCommandsForHost, type KataHostFacts } from "./kata-playtest-bridge.ts";\n',
    "playtest kata import",
)

context_anchor = '''function stage3cConsumableContext(board: Board): ConsumableRuntimeContext {
  return {
    hasTempo: board.tempo,
    hpThresholdMet: board.hp <= 10,
    handEmptyAfterHeal: board.hand.length === 0,
    normalAttacksResolvedThisTurn: board.attacksThisTurn,
    friendlyTargetCount: 1,
    opponentTargetCount: 1,
    temporaryNegativeModifierPresent: board.tempSpeed < 0 || board.nextAttackBonus < 0 || (board.nextDefenseCardBonus ?? 0) < 0,
    removedTemporaryNegativeModifier: false,
    sameTurnSourceActive: true,
    reactionItemUsedSinceLastTurn: Boolean(board.reactionItemUsedSinceLastTurn),
    revealedFocusValue: board.deck.length ? cardFocus(cardFor(board.deck[board.deck.length - 1])) : 0,
  };
}
'''
context_add = context_anchor + '''
function stage3cKataContext(board: Board, card: CardEntry): KataHostFacts {
  const sourceRecorded = board.cardsThisTurn.includes(card.id);
  return {
    belt: belts[board.belt]?.name,
    wasHitSinceLastTurn: Boolean(board.wasHitSinceLastTurn),
    hasWeaponEquipped: board.equipment.some((id) => { const item = cardFor(id); return Boolean(item && isWeapon(item)); }),
    hasTempo: Boolean(board.tempo),
    playedAttackThisTurn: board.attacksThisTurn > 0,
    hpAtOrBelowHalfMax: board.hp <= board.maxHp / 2,
    usedConsumableThisTurn: Boolean(board.usedConsumableThisRound),
    firstCardPlayedThisTurn: sourceRecorded ? board.cardsThisTurn.length === 1 : board.cardsThisTurn.length === 0,
    firstAttackThisTurn: board.attacksThisTurn === 0,
  };
}
'''
s = replace_once(s, context_anchor, context_add, "Kata context")

apply_anchor = '''  if (migratedFamily) {
    const context = Object.keys(familyContext).length ? familyContext : isCoreConsumableCard(card) ? stage3cConsumableContext(next) : familyContext;
    next = applyStage3CTiming(next, card, timing, owner, context, "self");
  } else {
'''
apply_new = '''  if (isCoreKataCard(card)) {
    next = applyStage3CCommands(next, kataRuntimeCommandsForHost(card, timing, stage3cKataContext(next, card)), owner);
  }
  if (migratedFamily) {
    const context = Object.keys(familyContext).length ? familyContext : isCoreConsumableCard(card) ? stage3cConsumableContext(next) : familyContext;
    next = applyStage3CTiming(next, card, timing, owner, context, "self");
  } else {
'''
s = replace_once(s, apply_anchor, apply_new, "applyCardEffects Kata commands")

heal_anchor = '''  if (timing === "onPlay") {
    const conditionalHeal = conditionalHealAfterHit(card, board.wasHitSinceLastTurn);
    if (conditionalHeal) next.hp = Math.min(next.maxHp, next.hp + conditionalHeal);
  }
'''
heal_new = '''  if (timing === "onPlay" && !isCoreKataCard(card)) {
    const conditionalHeal = conditionalHealAfterHit(card, board.wasHitSinceLastTurn);
    if (conditionalHeal) next.hp = Math.min(next.maxHp, next.hp + conditionalHeal);
  }
'''
s = replace_once(s, heal_anchor, heal_new, "Kata conditional heal de-duplication")

power_anchor = '''function stage3cAttackPowerBonus(board: Board, card: CardEntry, zone: string, isReversal = false) {
  return (board.stage3cStatuses ?? []).filter((status) => stage3cAttackStatusMatches(status, card, zone, isReversal) && status.effect === "combat.modifyAttackPower").reduce((total, status) => total + status.amount, 0);
}
'''
power_new = power_anchor + '''
function stage3cAttackPiercing(board: Board, card: CardEntry, zone: string, isReversal = false) {
  return (board.stage3cStatuses ?? []).filter((status) => stage3cAttackStatusMatches(status, card, zone, isReversal) && status.effect === "combat.piercing").reduce((total, status) => total + status.amount, 0);
}
'''
s = replace_once(s, power_anchor, power_new, "Kata Piercing status reader")

pierce_anchor = '''  const value = direct.amount + equipment.amount + comboPiercing;
  const notes = [...direct.notes, ...equipment.sources, ...(comboPiercing ? [`Combo grants Piercing ${comboPiercing}`] : [])];
'''
pierce_new = '''  const kataStatusPiercing = stage3cAttackPiercing(attacker, card, zone);
  const value = direct.amount + equipment.amount + comboPiercing + kataStatusPiercing;
  const notes = [...direct.notes, ...equipment.sources, ...(comboPiercing ? [`Combo grants Piercing ${comboPiercing}`] : []), ...(kataStatusPiercing ? [`Structured Kata grants Piercing ${kataStatusPiercing}`] : [])];
'''
s = replace_once(s, pierce_anchor, pierce_new, "attack Piercing aggregation")
p.write_text(s)

# -----------------------------------------------------------------------------
# Acceptance tests
# -----------------------------------------------------------------------------
Path("tests/quick-duel-kata-combat-runtime.test.mjs").write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { kataRuntimeCommandsForHost } from "../app/kata-playtest-bridge.ts";
import { applyRuntimeCommands, createFamilyRuntimeState, runtimeStatusAmount } from "../app/family-effect-runtime.ts";

const cards = JSON.parse(fs.readFileSync(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
const byCatalog = new Map(cards.map((entry) => [entry.catalogId, entry]));
function card(id) {
  const found = byCatalog.get(id);
  assert.ok(found, `missing canonical card ${id}`);
  return found;
}
function commands(id, facts = {}, trigger = "onPlay") {
  return kataRuntimeCommandsForHost(card(id), trigger, facts);
}

test("conditional Katas execute canonical Focus, Speed, and draw effects from host facts", () => {
  assert.equal(commands("DDB-KAT-CORE-004", { belt: "Brown" }).find((c) => c.effect === "core.gainFocus")?.amount, 2);
  assert.equal(commands("DDB-KAT-CORE-004", { belt: "Green" }).length, 0);
  const offPeak = commands("DDB-KAT-CORE-041", { hasTempo: false });
  assert.equal(offPeak.find((c) => c.effect === "core.gainFocus")?.amount, 1);
  assert.equal(offPeak.find((c) => c.effect === "combat.modifySpeed")?.amount, 1);
  assert.equal(commands("DDB-KAT-CORE-041", { hasTempo: true }).length, 0);
  assert.equal(commands("DDB-KAT-CORE-045", { firstCardPlayedThisTurn: true }).find((c) => c.effect === "core.gainFocus")?.amount, 1);
  assert.equal(commands("DDB-KAT-CORE-052", { usedConsumableThisTurn: true }).find((c) => c.effect === "core.gainFocus")?.amount, 1);
  assert.equal(commands("DDB-KAT-CORE-054", { wasHitSinceLastTurn: true }).find((c) => c.effect === "core.draw")?.amount, 1);
});

test("Recovery and Emergency healing run through the generic Kata command path", () => {
  assert.equal(commands("DDB-KAT-CORE-047", { wasHitSinceLastTurn: true }).find((c) => c.effect === "core.heal")?.amount, 3);
  assert.equal(commands("DDB-KAT-CORE-047", { wasHitSinceLastTurn: false }).some((c) => c.effect === "core.heal"), false);
  assert.equal(commands("DDB-KAT-CORE-014", { wasHitSinceLastTurn: true }).find((c) => c.effect === "core.heal")?.amount, 3);
});

test("Empty Hand Form arms a real next-Attack power status only when canonical conditions match", () => {
  const eligible = commands("DDB-KAT-CORE-016", { hasWeaponEquipped: false, firstAttackThisTurn: true });
  assert.deepEqual(eligible.map((c) => [c.effect, c.amount, c.duration]), [["combat.modifyAttackPower", 2, "nextAttack"]]);
  assert.equal(commands("DDB-KAT-CORE-016", { hasWeaponEquipped: true, firstAttackThisTurn: true }).length, 0);
  assert.equal(commands("DDB-KAT-CORE-016", { hasWeaponEquipped: false, firstAttackThisTurn: false }).length, 0);
  const state = applyRuntimeCommands(createFamilyRuntimeState(), eligible);
  assert.equal(runtimeStatusAmount(state, "nextAttack", "combat.modifyAttackPower"), 2);
});

test("Bassai Dai and Saifa arm next-Attack Piercing statuses", () => {
  const bassai = commands("DDB-KAT-CORE-003");
  const saifa = commands("DDB-KAT-CORE-049");
  assert.deepEqual(bassai.map((c) => [c.effect, c.amount, c.duration]), [["combat.piercing", 2, "nextAttack"]]);
  assert.deepEqual(saifa.map((c) => [c.effect, c.amount, c.duration]), [["combat.piercing", 1, "nextAttack"]]);
  const state = applyRuntimeCommands(createFamilyRuntimeState(), bassai);
  assert.equal(runtimeStatusAmount(state, "nextAttack", "combat.piercing"), 2);
});

test("persistent conditional Speed uses the shared runtime status model", () => {
  const offPeak = commands("DDB-KAT-CORE-041", { hasTempo: false });
  const state = applyRuntimeCommands(createFamilyRuntimeState(), offPeak);
  assert.equal(state.self.focus, 1);
  assert.equal(state.self.speed, 1);
  assert.equal(state.statuses.some((status) => status.effect === "combat.modifySpeed" && status.duration === "endOfRound"), true);
});

test("Quick Duel consumes generic Kata commands and Kata Piercing without card identity dispatch", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /kataRuntimeCommandsForHost\(card, timing, stage3cKataContext\(next, card\)\)/);
  assert.match(source, /stage3cAttackPiercing\(attacker, card, zone\)/);
  assert.match(source, /timing === "onPlay" && !isCoreKataCard\(card\)/);
  assert.doesNotMatch(source, /DDB-KAT-CORE-003|DDB-KAT-CORE-016|DDB-KAT-CORE-041|DDB-KAT-CORE-049/);
});
''')

p = Path("package.json")
data = json.loads(p.read_text())
target = " tests/quick-duel-kata-consumable-runtime.test.mjs"
addition = target + " tests/quick-duel-kata-combat-runtime.test.mjs"
if "tests/quick-duel-kata-combat-runtime.test.mjs" not in data["scripts"]["test"]:
    if target not in data["scripts"]["test"]:
        raise SystemExit("package test anchor missing")
    data["scripts"]["test"] = data["scripts"]["test"].replace(target, addition, 1)
p.write_text(json.dumps(data, indent=2) + "\n")
