from pathlib import Path
import json


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)

# -----------------------------------------------------------------------------
# Kata bridge: allow canonical deferred onPlay next-Defense Guard watchers.
# -----------------------------------------------------------------------------
p = Path("app/kata-playtest-bridge.ts")
s = p.read_text()
old = '''    if (resolver === "kata.deferredConditional" && !(trigger === "onHide" && ["gainFocus", "heal"].includes(String(command.action ?? "")))) return [];
'''
new = '''    if (resolver === "kata.deferredConditional") {
      const hideOutcome = trigger === "onHide" && ["gainFocus", "heal"].includes(String(command.action ?? ""));
      const nextDefenseWatcher = trigger === "onPlay"
        && command.kind === "armDeferredConditional"
        && command.action === "modifyGuard"
        && command.duration === "nextDefense";
      if (!hideOutcome && !nextDefenseWatcher) return [];
    }
'''
s = replace_once(s, old, new, "deferred conditional runtime guard")
old = '''    const qualifier = resolver === "kata.damagePrevention"
      ? { ...command.params, expires: command.params?.firstDamageEventBefore }
      : command.params;
'''
new = '''    const qualifier = resolver === "kata.damagePrevention"
      ? { ...command.params, expires: command.params?.firstDamageEventBefore }
      : resolver === "kata.deferredConditional" && trigger === "onPlay" && duration === "nextDefense"
        ? { ...command.params, expires: "endOfRound" }
        : command.params;
'''
s = replace_once(s, old, new, "deferred Defense qualifier")
p.write_text(s)

# -----------------------------------------------------------------------------
# Generic next-Defense status semantics: evaluate canonical qualifiers at use.
# -----------------------------------------------------------------------------
p = Path("app/stage3c-defense-status-semantics.ts")
s = p.read_text()
old = '''export function nextDefenseGuardBonus(statuses: RuntimeStatus[]) {
  return statuses
    .filter((status) => status.duration === "nextDefense" && status.effect === "combat.modifyGuard")
    .reduce((total, status) => total + status.amount, 0);
}
'''
new = '''export type NextDefenseStatusFacts = {
  firstDefenseThisRound?: boolean;
  boughtCardThisTurn?: boolean;
};

function nextDefenseStatusQualifies(status: RuntimeStatus, facts: NextDefenseStatusFacts) {
  if (status.qualifier?.firstDefenseThisRound !== undefined
    && Boolean(status.qualifier.firstDefenseThisRound) !== Boolean(facts.firstDefenseThisRound)) return false;
  if (status.qualifier?.boughtCardThisTurn !== undefined
    && Boolean(status.qualifier.boughtCardThisTurn) !== Boolean(facts.boughtCardThisTurn)) return false;
  return true;
}

export function nextDefenseGuardBonus(statuses: RuntimeStatus[], facts: NextDefenseStatusFacts = {}) {
  return statuses
    .filter((status) => status.duration === "nextDefense" && status.effect === "combat.modifyGuard" && nextDefenseStatusQualifies(status, facts))
    .reduce((total, status) => total + status.amount, 0);
}
'''
s = replace_once(s, old, new, "next Defense status qualifier semantics")
p.write_text(s)

# -----------------------------------------------------------------------------
# Quick Duel: provide the live facts at every next-Defense calculation seam.
# boughtCardLastAscend is the carried state of whether this fighter bought on
# their immediately preceding own turn, exactly when the opponent attacks.
# -----------------------------------------------------------------------------
p = Path("app/playtest.tsx")
s = p.read_text()
old = '''function stage3cNextDefenseGuardBonus(board: Board) {
  return nextDefenseGuardBonus(board.stage3cStatuses ?? []);
}
'''
new = '''function stage3cNextDefenseGuardBonus(board: Board) {
  return nextDefenseGuardBonus(board.stage3cStatuses ?? [], {
    firstDefenseThisRound: !board.defendedThisRound,
    boughtCardThisTurn: Boolean(board.boughtCardLastAscend),
  });
}
'''
s = replace_once(s, old, new, "Quick Duel next Defense facts")
p.write_text(s)

# -----------------------------------------------------------------------------
# Acceptance coverage.
# -----------------------------------------------------------------------------
Path("tests/quick-duel-kata-deferred-defense-runtime.test.mjs").write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { kataRuntimeCommandsForHost } from "../app/kata-playtest-bridge.ts";
import { applyRuntimeCommands, createFamilyRuntimeState } from "../app/family-effect-runtime.ts";
import { consumeNextDefenseStatuses, nextDefenseGuardBonus } from "../app/stage3c-defense-status-semantics.ts";

const cards = JSON.parse(fs.readFileSync(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
const byCatalog = new Map(cards.map((entry) => [entry.catalogId, entry]));
const card = (id) => {
  const found = byCatalog.get(id);
  assert.ok(found, `missing canonical card ${id}`);
  return found;
};

test("Breakroom Box Breathing arms a qualified next-Defense Guard watcher", () => {
  const commands = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-005"), "onPlay", {});
  assert.equal(commands.length, 1);
  const [command] = commands;
  assert.equal(command.effect, "combat.modifyGuard");
  assert.equal(command.amount, 1);
  assert.equal(command.duration, "nextDefense");
  assert.equal(command.qualifier?.firstDefenseThisRound, true);
  assert.equal(command.qualifier?.boughtCardThisTurn, false);
  assert.equal(command.qualifier?.expires, "endOfRound");
});

test("Breakroom watcher grants Guard only to the first Defense after a no-purchase turn", () => {
  const [command] = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-005"), "onPlay", {});
  const state = applyRuntimeCommands(createFamilyRuntimeState(), [command]);
  assert.equal(state.statuses.length, 1);
  assert.equal(nextDefenseGuardBonus(state.statuses, { firstDefenseThisRound: true, boughtCardThisTurn: false }), 1);
  assert.equal(nextDefenseGuardBonus(state.statuses, { firstDefenseThisRound: true, boughtCardThisTurn: true }), 0);
  assert.equal(nextDefenseGuardBonus(state.statuses, { firstDefenseThisRound: false, boughtCardThisTurn: false }), 0);
});

test("unqualified next-Defense Guard statuses remain backward-compatible", () => {
  const statuses = [{
    sourceEffectId: "existing-next-defense",
    effect: "combat.modifyGuard",
    target: "self",
    amount: 2,
    duration: "nextDefense",
    appliedImmediately: false,
  }];
  assert.equal(nextDefenseGuardBonus(statuses, { firstDefenseThisRound: false, boughtCardThisTurn: true }), 2);
});

test("the first Defense consumes the watcher even when its purchase condition failed", () => {
  const [command] = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-005"), "onPlay", {});
  const state = applyRuntimeCommands(createFamilyRuntimeState(), [command]);
  assert.equal(nextDefenseGuardBonus(state.statuses, { firstDefenseThisRound: true, boughtCardThisTurn: true }), 0);
  assert.equal(consumeNextDefenseStatuses(state.statuses).length, 0);
});

test("Quick Duel derives Breakroom qualification from generic board state", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /firstDefenseThisRound: !board\.defendedThisRound/);
  assert.match(source, /boughtCardThisTurn: Boolean\(board\.boughtCardLastAscend\)/);
  assert.doesNotMatch(source, /card\.name === "Breakroom Box Breathing"|DDB-KAT-CORE-005/);
});
''')

p = Path("package.json")
pkg = json.loads(p.read_text())
target = " tests/quick-duel-kata-defense-hide-runtime.test.mjs"
addition = target + " tests/quick-duel-kata-deferred-defense-runtime.test.mjs"
if "tests/quick-duel-kata-deferred-defense-runtime.test.mjs" not in pkg["scripts"]["test"]:
    if target not in pkg["scripts"]["test"]:
        raise SystemExit("package test anchor missing")
    pkg["scripts"]["test"] = pkg["scripts"]["test"].replace(target, addition, 1)
p.write_text(json.dumps(pkg, indent=2) + "\n")
