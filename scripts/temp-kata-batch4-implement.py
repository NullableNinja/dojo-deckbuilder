from pathlib import Path
import json


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)

# Extend the canonical Kata -> generic runtime adapter for branch and damage prevention.
p = Path("app/kata-playtest-bridge.ts")
s = p.read_text()
s = replace_once(
    s,
    '''const SIMPLE_KATA_RUNTIME_RESOLVERS = new Set([\n  "kata.conditional",\n  "kata.attackModifier",\n  "kata.nextAttackPiercing",\n]);''',
    '''const SIMPLE_KATA_RUNTIME_RESOLVERS = new Set([\n  "kata.conditional",\n  "kata.attackModifier",\n  "kata.nextAttackPiercing",\n  "kata.branch",\n  "kata.damagePrevention",\n]);''',
    "Kata runtime resolver set",
)
old = '''    if (resolver === "kata.attackModifier" && !(command.action === "modifyAttackPower" && command.duration === "nextAttack")) return [];
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
'''
new = '''    if (resolver === "kata.attackModifier" && !(command.action === "modifyAttackPower" && command.duration === "nextAttack")) return [];
    if (resolver === "kata.nextAttackPiercing" && !(command.action === "piercing" && command.duration === "nextAttack")) return [];
    if (resolver === "kata.branch" && !(command.action === "heal" || command.kind === "grantFlow")) return [];
    if (resolver === "kata.damagePrevention" && command.kind !== "armDamagePrevention") return [];

    const effect = command.kind === "grantFlow"
      ? "combat.grantFlow"
      : resolver === "kata.damagePrevention"
        ? "combat.preventDamage"
        : KATA_RUNTIME_EFFECT_BY_ACTION[String(command.action ?? "")];
    if (!effect) return [];
    const duration = command.kind === "grantFlow"
      ? String(command.params?.grantFlowTo ?? "nextAttack")
      : resolver === "kata.damagePrevention"
        ? "nextDamage"
        : String(command.duration ?? "immediate");
    const qualifier = resolver === "kata.damagePrevention"
      ? { ...command.params, expires: command.params?.firstDamageEventBefore }
      : command.params;
    return [{
      sourceEffectId: String(command.effectId ?? `kata:${resolver}:${trigger}`),
      effect,
      trigger,
      target: "self",
      amount: Number(command.amount ?? 0),
      duration,
      resolver,
      conditions: [],
      qualifier,
    }];
'''
s = replace_once(s, old, new, "Kata runtime command translator")
p.write_text(s)

# Reusable prevention semantics: first matching damage event, source-qualified, optional zero-damage Focus reward.
Path("app/structured-damage-prevention.ts").write_text('''import type { RuntimeStatus } from "./family-effect-runtime.ts";\n\nexport type StructuredDamagePreventionResolution = {\n  statuses: RuntimeStatus[];\n  damage: number;\n  focus: number;\n  notes: string[];\n};\n\nexport function resolveNextDamagePreventionStatuses(\n  statuses: RuntimeStatus[],\n  damage: number,\n  source: string,\n): StructuredDamagePreventionResolution {\n  if (damage <= 0) return { statuses, damage, focus: 0, notes: [] };\n  const normalizedSource = source.toLocaleLowerCase();\n  const matching = statuses.filter((status) => {\n    if (status.duration !== "nextDamage" || status.effect !== "combat.preventDamage") return false;\n    const requiredSource = String(status.qualifier?.source ?? "").toLocaleLowerCase();\n    return !requiredSource || requiredSource === normalizedSource;\n  });\n  if (!matching.length) return { statuses, damage, focus: 0, notes: [] };\n\n  const prevention = matching.reduce((total, status) => total + Math.max(0, status.amount), 0);\n  const reducedDamage = Math.max(0, damage - prevention);\n  const consumed = new Set(matching.map((status) => status.sourceEffectId));\n  let focus = 0;\n  for (const status of matching) {\n    const threshold = status.qualifier?.gainFocusIfDamageAfterReduction;\n    if (threshold === undefined || Number(threshold) !== reducedDamage) continue;\n    focus += Math.max(0, Number(status.qualifier?.focusAmount ?? 0));\n  }\n  return {\n    statuses: statuses.filter((status) => !consumed.has(status.sourceEffectId)),\n    damage: reducedDamage,\n    focus,\n    notes: [`Structured prevention reduces damage by ${Math.min(damage, prevention)}`, ...(focus ? [`Structured prevention grants ${focus} Focus`] : [])],\n  };\n}\n\nexport function expirePreventionAtNextInitiate(statuses: RuntimeStatus[]) {\n  return statuses.filter((status) => !(\n    status.effect === "combat.preventDamage"\n    && status.duration === "nextDamage"\n    && String(status.qualifier?.expires ?? "") === "nextInitiate"\n  ));\n}\n''')

# Wire reusable prevention and remove the remaining Second Wind card-name rule.
p = Path("app/playtest.tsx")
s = p.read_text()
import_anchor = 'import { isCoreKataCard, kataRuntimeCommandsForHost, type KataHostFacts } from "./kata-playtest-bridge.ts";\n'
s = replace_once(
    s,
    import_anchor,
    import_anchor + 'import { expirePreventionAtNextInitiate, resolveNextDamagePreventionStatuses } from "./structured-damage-prevention.ts";\n',
    "structured prevention import",
)
old_start = '''function stage3cStartTurn(board: Board) {
  let next = expireStage3C(board, "nextTurn");
  const initiate = (next.stage3cStatuses ?? []).filter((status) => status.duration === "nextInitiate");
'''
new_start = '''function stage3cStartTurn(board: Board) {
  let next = expireStage3C(board, "nextTurn");
  next = { ...next, stage3cStatuses: expirePreventionAtNextInitiate(next.stage3cStatuses ?? []) };
  const initiate = (next.stage3cStatuses ?? []).filter((status) => status.duration === "nextInitiate");
'''
s = replace_once(s, old_start, new_start, "next Initiate prevention expiry")
old_prevent = '''function stage3cTakeDamagePrevention(board: Board, damage: number) {
  const statuses = (board.stage3cStatuses ?? []).filter((status) => status.duration === "nextDamage" && status.effect === "combat.preventDamage");
  if (!statuses.length || damage <= 0) return { board, damage, notes: [] as string[] };
  const prevention = statuses.reduce((total, status) => total + Math.max(0, status.amount), 0);
  const ids = new Set(statuses.map((status) => status.sourceEffectId));
  return {
    board: { ...board, stage3cStatuses: (board.stage3cStatuses ?? []).filter((status) => !ids.has(status.sourceEffectId)) },
    damage: Math.max(0, damage - prevention),
    notes: ["Structured prevention reduces damage by " + prevention],
  };
}
'''
new_prevent = '''function stage3cTakeDamagePrevention(board: Board, damage: number) {
  const resolved = resolveNextDamagePreventionStatuses(board.stage3cStatuses ?? [], damage, "Attack");
  if (resolved.statuses === board.stage3cStatuses && !resolved.focus && resolved.damage === damage) return { board, damage, notes: resolved.notes };
  let next = { ...board, stage3cStatuses: resolved.statuses };
  if (resolved.focus) next = gainFocus(next, resolved.focus);
  return { board: next, damage: resolved.damage, notes: resolved.notes };
}
'''
s = replace_once(s, old_prevent, new_prevent, "structured damage prevention host")
old_second_wind = '''  } else if (timing === "onPlay" && card.name === "Second Wind Form" && board.hp > board.maxHp / 2) {
    next.nextAttackHasFlow = true;
'''
if old_second_wind not in s:
    raise SystemExit("Second Wind legacy fallback missing")
s = s.replace(old_second_wind, "", 1)
p.write_text(s)

# Acceptance tests.
Path("tests/quick-duel-kata-stateful-runtime.test.mjs").write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { kataRuntimeCommandsForHost } from "../app/kata-playtest-bridge.ts";
import { resolveNextDamagePreventionStatuses, expirePreventionAtNextInitiate } from "../app/structured-damage-prevention.ts";

const cards = JSON.parse(fs.readFileSync(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
const byCatalog = new Map(cards.map((entry) => [entry.catalogId, entry]));
const card = (id) => {
  const found = byCatalog.get(id);
  assert.ok(found, `missing canonical card ${id}`);
  return found;
};

test("Second Wind Form branches entirely from canonical hp facts", () => {
  const low = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-051"), "onPlay", { hpAtOrBelowHalfMax: true });
  assert.deepEqual(low.map((command) => [command.effect, command.amount, command.duration]), [["core.heal", 4, "immediate"]]);
  const high = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-051"), "onPlay", { hpAtOrBelowHalfMax: false });
  assert.deepEqual(high.map((command) => [command.effect, command.amount, command.duration]), [["combat.grantFlow", 0, "nextAttack"]]);
});

test("Margin-of-Error Meditation arms source-qualified prevention until next Initiate", () => {
  const [command] = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-037"), "onPlay", {});
  assert.equal(command.effect, "combat.preventDamage");
  assert.equal(command.amount, 2);
  assert.equal(command.duration, "nextDamage");
  assert.equal(command.qualifier?.source, "Attack");
  assert.equal(command.qualifier?.expires, "nextInitiate");
  assert.equal(command.qualifier?.gainFocusIfDamageAfterReduction, 0);
  assert.equal(command.qualifier?.focusAmount, 1);
});

test("Margin prevention grants Focus only when the watched Attack is reduced to zero", () => {
  const [command] = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-037"), "onPlay", {});
  const status = { sourceEffectId: command.sourceEffectId, effect: command.effect, target: "self", amount: command.amount, duration: command.duration, resolver: command.resolver, qualifier: command.qualifier, appliedImmediately: false };
  const zero = resolveNextDamagePreventionStatuses([status], 2, "Attack");
  assert.equal(zero.damage, 0);
  assert.equal(zero.focus, 1);
  assert.equal(zero.statuses.length, 0);
  const stillDamaged = resolveNextDamagePreventionStatuses([status], 5, "Attack");
  assert.equal(stillDamaged.damage, 3);
  assert.equal(stillDamaged.focus, 0);
});

test("Margin prevention ignores non-Attack damage and expires unused at next Initiate", () => {
  const [command] = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-037"), "onPlay", {});
  const status = { sourceEffectId: command.sourceEffectId, effect: command.effect, target: "self", amount: command.amount, duration: command.duration, resolver: command.resolver, qualifier: command.qualifier, appliedImmediately: false };
  const direct = resolveNextDamagePreventionStatuses([status], 2, "Direct");
  assert.equal(direct.damage, 2);
  assert.equal(direct.focus, 0);
  assert.equal(direct.statuses.length, 1);
  assert.equal(expirePreventionAtNextInitiate([status]).length, 0);
});

test("Quick Duel no longer hard-codes Second Wind and uses reusable prevention semantics", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /card\.name === "Second Wind Form"/);
  assert.match(source, /resolveNextDamagePreventionStatuses\(board\.stage3cStatuses \?\? \[\], damage, "Attack"\)/);
  assert.match(source, /expirePreventionAtNextInitiate\(next\.stage3cStatuses \?\? \[\]\)/);
});
''')

p = Path("package.json")
data = json.loads(p.read_text())
target = " tests/quick-duel-kata-combat-runtime.test.mjs"
addition = target + " tests/quick-duel-kata-stateful-runtime.test.mjs"
if "tests/quick-duel-kata-stateful-runtime.test.mjs" not in data["scripts"]["test"]:
    if target not in data["scripts"]["test"]:
        raise SystemExit("package test anchor missing")
    data["scripts"]["test"] = data["scripts"]["test"].replace(target, addition, 1)
p.write_text(json.dumps(data, indent=2) + "\n")
