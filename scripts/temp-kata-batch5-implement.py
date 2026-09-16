from pathlib import Path
import json


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)

# -----------------------------------------------------------------------------
# Canonical source: Jion and Sanchin modify fighter DEF, not Defense-card Guard.
# -----------------------------------------------------------------------------
p = Path("content/card-effects/katas.json")
data = json.loads(p.read_text())
for cid in ("DDB-KAT-CORE-028", "DDB-KAT-CORE-050"):
    effects = data["cards"][cid]["effects"]
    if len(effects) < 1:
        raise SystemExit(f"missing Kata effects for {cid}")
    target = next((effect for effect in effects if effect.get("resolver") == "kata.defenseModifier"), None)
    if not target:
        raise SystemExit(f"missing kata.defenseModifier for {cid}")
    if target.get("action") not in ("modifyGuard", "modifyDefense"):
        raise SystemExit(f"unexpected defense action for {cid}: {target.get('action')}")
    target["action"] = "modifyDefense"
p.write_text(json.dumps(data, separators=(",", ":")) + "\n")

# -----------------------------------------------------------------------------
# Resolver: deferred onPlay effects arm; lifecycle deferred effects evaluate facts.
# -----------------------------------------------------------------------------
p = Path("app/kata-effect-resolvers.ts")
s = p.read_text()
old = '''    case "kata.deferredConditional":
      return [semantic("armDeferredConditional", effect)];
'''
new = '''    case "kata.deferredConditional":
      // onPlay deferred effects arm a future watcher. Lifecycle-timed deferred
      // effects (for example onHide) resolve only when their canonical facts match.
      if (effect.trigger === "onPlay") return [semantic("armDeferredConditional", effect)];
      return predicatesMatch(effect, values) ? [semantic("armDeferredConditional", effect)] : [];
'''
s = replace_once(s, old, new, "deferred conditional evaluation")
p.write_text(s)

# -----------------------------------------------------------------------------
# Kata bridge: add DEF modifiers and lifecycle-resolved deferred outcomes.
# -----------------------------------------------------------------------------
p = Path("app/kata-playtest-bridge.ts")
s = p.read_text()
s = replace_once(
    s,
    '''  "kata.branch",
  "kata.damagePrevention",
]);''',
    '''  "kata.branch",
  "kata.damagePrevention",
  "kata.defenseModifier",
  "kata.deferredConditional",
]);''',
    "Kata simple runtime resolver set",
)
old = '''    if (resolver === "kata.branch" && !(command.action === "heal" || command.kind === "grantFlow")) return [];
    if (resolver === "kata.damagePrevention" && command.kind !== "armDamagePrevention") return [];

    const effect = command.kind === "grantFlow"
'''
new = '''    if (resolver === "kata.branch" && !(command.action === "heal" || command.kind === "grantFlow")) return [];
    if (resolver === "kata.damagePrevention" && command.kind !== "armDamagePrevention") return [];
    if (resolver === "kata.defenseModifier" && command.action !== "modifyDefense") return [];
    if (resolver === "kata.deferredConditional" && !(trigger === "onHide" && ["gainFocus", "heal"].includes(String(command.action ?? "")))) return [];

    const effect = command.kind === "grantFlow"
'''
s = replace_once(s, old, new, "Kata resolver guards")
old = '''    const duration = command.kind === "grantFlow"
      ? String(command.params?.grantFlowTo ?? "nextAttack")
      : resolver === "kata.damagePrevention"
        ? "nextDamage"
        : String(command.duration ?? "immediate");
'''
new = '''    const deferredDuration = String(command.params?.duration ?? "");
    const duration = command.kind === "grantFlow"
      ? String(command.params?.grantFlowTo ?? "nextAttack")
      : resolver === "kata.damagePrevention"
        ? "nextDamage"
        : resolver === "kata.defenseModifier" && !command.duration && deferredDuration === "untilStartOfNextTurn"
          ? "nextTurn"
          : String(command.duration ?? "immediate");
'''
s = replace_once(s, old, new, "Kata duration mapping")
p.write_text(s)

# -----------------------------------------------------------------------------
# Quick Duel: execute canonical Kata onHide effects before play-area cleanup.
# -----------------------------------------------------------------------------
p = Path("app/playtest.tsx")
s = p.read_text()
context_anchor = '''function stage3cKataContext(board: Board, card: CardEntry): KataHostFacts {
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
context_add = context_anchor + '''
function applyKataHideEffects(board: Board, controller: "player" | "ai") {
  let next = board;
  for (const id of board.playArea) {
    const card = cardFor(id);
    if (!card || !isCoreKataCard(card)) continue;
    const commands = kataRuntimeCommandsForHost(card, "onHide", stage3cKataContext(next, card));
    if (commands.length) next = applyStage3CCommands(next, commands, controller);
  }
  return next;
}
'''
s = replace_once(s, context_anchor, context_add, "Kata Hide host")

player_hide_old = '''      const hostedHide = publishQuickDuelPlaytestLifecycleEvent(current, "player", "onHide", quickDuelHostOperations, cardFor).match;
      const nextPlayer = playAreaCleanup(hostedHide.player);
      const hidden = write(hostedHide, "Hide: unspent Focus clears and your next hand is drawn.", { player: nextPlayer, winner: nextPlayer.hp ? hostedHide.winner : "ai" });
'''
player_hide_new = '''      const hostedHide = publishQuickDuelPlaytestLifecycleEvent(current, "player", "onHide", quickDuelHostOperations, cardFor).match;
      const kataHidePlayer = applyKataHideEffects(hostedHide.player, "player");
      const nextPlayer = playAreaCleanup(kataHidePlayer);
      const hidden = write(hostedHide, "Hide: unspent Focus clears and your next hand is drawn.", { player: nextPlayer, winner: nextPlayer.hp ? hostedHide.winner : "ai" });
'''
s = replace_once(s, player_hide_old, player_hide_new, "player Kata Hide execution")

ai_hide_old = '''  const hostedHide = publishQuickDuelPlaytestLifecycleEvent({ ...current, player: playerAfterPurchase, ai: aiAfterPurchase }, "ai", "onHide", quickDuelHostOperations, cardFor).match;
  const nextAi = playAreaCleanup(hostedHide.ai);
'''
ai_hide_new = '''  const hostedHide = publishQuickDuelPlaytestLifecycleEvent({ ...current, player: playerAfterPurchase, ai: aiAfterPurchase }, "ai", "onHide", quickDuelHostOperations, cardFor).match;
  const kataHideAi = applyKataHideEffects(hostedHide.ai, "ai");
  const nextAi = playAreaCleanup(kataHideAi);
'''
s = replace_once(s, ai_hide_old, ai_hide_new, "AI Kata Hide execution")
p.write_text(s)

# -----------------------------------------------------------------------------
# Acceptance tests.
# -----------------------------------------------------------------------------
Path("tests/quick-duel-kata-defense-hide-runtime.test.mjs").write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { kataRuntimeCommandsForHost } from "../app/kata-playtest-bridge.ts";
import { applyRuntimeCommands, createFamilyRuntimeState } from "../app/family-effect-runtime.ts";

const cards = JSON.parse(fs.readFileSync(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
const effects = JSON.parse(fs.readFileSync(new URL("../content/card-effects/katas.json", import.meta.url), "utf8")).cards;
const byCatalog = new Map(cards.map((entry) => [entry.catalogId, entry]));
const card = (id) => {
  const found = byCatalog.get(id);
  assert.ok(found, `missing canonical card ${id}`);
  return found;
};

test("Jion and Sanchin canonical structured data modify fighter DEF, not card Guard", () => {
  for (const id of ["DDB-KAT-CORE-028", "DDB-KAT-CORE-050"]) {
    const effect = effects[id].effects.find((entry) => entry.resolver === "kata.defenseModifier");
    assert.equal(effect?.action, "modifyDefense", `${id} must modify fighter DEF`);
  }
});

test("Jion grants +1 DEF through end of round", () => {
  const commands = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-028"), "onPlay", {});
  assert.deepEqual(commands.map((command) => [command.effect, command.amount, command.duration]), [["combat.modifyDefense", 1, "endOfRound"]]);
  const state = applyRuntimeCommands(createFamilyRuntimeState(), commands);
  assert.equal(state.self.defense, 1);
  assert.equal(state.statuses.some((status) => status.effect === "combat.modifyDefense" && status.duration === "endOfRound"), true);
});

test("Sanchin maps its canonical start-of-next-turn duration to nextTurn DEF state", () => {
  const commands = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-050"), "onPlay", {});
  assert.deepEqual(commands.map((command) => [command.effect, command.amount, command.duration]), [["combat.modifyDefense", 2, "nextTurn"]]);
});

test("Jion Hide reward resolves only when no Attack was played", () => {
  const quiet = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-028"), "onHide", { playedAttackThisTurn: false });
  assert.deepEqual(quiet.map((command) => [command.effect, command.amount, command.duration]), [["core.gainFocus", 1, "immediate"]]);
  const attacked = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-028"), "onHide", { playedAttackThisTurn: true });
  assert.equal(attacked.length, 0);
});

test("Recovery Stance Hide heal requires both prior Hit and no Attack this turn", () => {
  const eligible = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-047"), "onHide", { wasHitSinceLastTurn: true, playedAttackThisTurn: false });
  assert.deepEqual(eligible.map((command) => [command.effect, command.amount, command.duration]), [["core.heal", 2, "immediate"]]);
  assert.equal(kataRuntimeCommandsForHost(card("DDB-KAT-CORE-047"), "onHide", { wasHitSinceLastTurn: false, playedAttackThisTurn: false }).length, 0);
  assert.equal(kataRuntimeCommandsForHost(card("DDB-KAT-CORE-047"), "onHide", { wasHitSinceLastTurn: true, playedAttackThisTurn: true }).length, 0);
});

test("Quick Duel executes generic Kata Hide effects for both fighters before cleanup", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /applyKataHideEffects\(hostedHide\.player, "player"\)/);
  assert.match(source, /applyKataHideEffects\(hostedHide\.ai, "ai"\)/);
  assert.doesNotMatch(source, /card\.name === "Jion"|card\.name === "Sanchin"|card\.name === "Recovery Stance"/);
});
''')

p = Path("package.json")
pkg = json.loads(p.read_text())
target = " tests/quick-duel-kata-stateful-runtime.test.mjs"
addition = target + " tests/quick-duel-kata-defense-hide-runtime.test.mjs"
if "tests/quick-duel-kata-defense-hide-runtime.test.mjs" not in pkg["scripts"]["test"]:
    if target not in pkg["scripts"]["test"]:
        raise SystemExit("package test anchor missing")
    pkg["scripts"]["test"] = pkg["scripts"]["test"].replace(target, addition, 1)
p.write_text(json.dumps(pkg, indent=2) + "\n")
