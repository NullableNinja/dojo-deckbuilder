#!/usr/bin/env bash
set -euo pipefail

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

echo "== Reconcile latest main =="
git fetch origin main
git merge --no-edit -X theirs origin/main

echo "== Install current dependencies =="
npm ci

echo "== Materialize Stage 3C semantics into the latest playmat =="
node scripts/stage3c-integrate-playtest.mjs
python <<'PY'
from pathlib import Path

playtest = Path('app/playtest.tsx')
source = playtest.read_text()
before = 'function stage3cDefenseContext(defender: Board, attacker: Board, defense: CardEntry, incomingAttack: CardEntry, zone: string, attackPower?: number, incomingDamage?: number, blockSucceeded?: boolean): DefenseRuntimeContext {'
after = 'function stage3cDefenseContext(defender: Board, attacker: Board, defense: CardEntry, incomingAttack: CardEntry, zone: string, attackPower?: number, incomingDamage?: number, blockSucceeded?: boolean): DefenseRuntimeContext & { weaponAttack: boolean; defenderAttackedThisRound: boolean } {'
if before in source:
    source = source.replace(before, after)
elif after not in source:
    raise SystemExit('Stage 3C Defense context type marker not found')
playtest.write_text(source)

v2 = Path('scripts/stage3c-integrate-playtest-v2.mjs')
source = v2.read_text()
start = source.find('replaceOnce(\n  "player Attack one-shot consumption",')
stop = source.find('// The marker above intentionally', start)
if start >= 0 and stop >= 0:
    source = source[:start] + source[stop:]
    v2.write_text(source)
PY
node scripts/stage3c-integrate-playtest-v2.mjs

echo "== Finish explicit Defense choice semantics =="
python <<'PY'
from pathlib import Path
path = Path('app/defense-effect-resolvers.ts')
source = path.read_text()
before = '''  if (effect.effect === "core.choice" || [
    "defense.equipmentChoice",'''
after = '''  if (effect.effect === "core.choice" || [
    "defense.discardChoice",
    "defense.equipmentChoice",'''
if after not in source:
    if before not in source:
        raise SystemExit('Defense choice resolver marker not found')
    source = source.replace(before, after)
path.write_text(source)
PY

echo "== Add explicit-choice regression coverage =="
python <<'PY'
from pathlib import Path
path = Path('tests/stage3c-defense-consumable-runtime.test.mjs')
source = path.read_text()
marker = 'test("all explicit Defense choice resolvers queue a structured runtime choice"'
if marker not in source:
    source += r'''

test("all explicit Defense choice resolvers queue a structured runtime choice", () => {
  const choiceResolvers = new Set([
    "defense.discardChoice",
    "defense.equipmentChoice",
    "defense.optionalDiscardDraw",
    "defense.forceNextAttackZone",
    "defense.blockChoice",
    "defense.deckLookChoice",
    "defense.stepBackCycle",
  ]);
  const failures = [];
  for (const [catalogId, entry] of Object.entries(defenses)) {
    for (const effect of entry.effects ?? []) {
      if (!choiceResolvers.has(effect.resolver) && effect.effect !== "core.choice") continue;
      const context = { ...defenseBaseContext, ...conditionContext(effect) };
      const commands = defenseRuntimeCommands(card(catalogId), effect.trigger, context)
        .filter((command) => command.sourceEffectId === effect.id);
      if (!commands.some((command) => command.choice)) failures.push(`${catalogId}:${effect.id}:choice-not-queued`);
      const state = applyDefenseRuntime(createFamilyRuntimeState(), card(catalogId), effect.trigger, context);
      if (!state.pendingChoices.some((choice) => choice.sourceEffectId === effect.id)) failures.push(`${catalogId}:${effect.id}:choice-not-in-state`);
    }
  }
  assert.deepEqual(failures, []);
});

test("every Consumable explicit-choice resolver queues at least one structured choice contract", () => {
  const choiceResolvers = new Set([
    "consumable.cancelReaction",
    "consumable.chooseOpponentNextAttackPenalty",
    "consumable.chooseFriendlyHealTarget",
    "consumable.chooseOpponentDiscardReactionIfAble",
    "consumable.optionalExhaustToCycle",
    "consumable.raffleTicket",
    "consumable.replaceDisarmWithSelfDestroy",
    "consumable.zoneSpecificIncomingAttackPenalty",
    "consumable.reorderTopThree",
    "consumable.destroyJunkThenDrawTwo",
    "consumable.healByChosenFriendlyPosition",
    "consumable.destroyJunkFromHand",
    "consumable.ascendPurchaseDiscount",
    "consumable.removeTemporaryNegativeStatModifier",
    "consumable.discardUpToForFocus",
    "consumable.replaceRevealedMarketOrLocation",
    "consumable.suppressChosenWeaponClause",
    "consumable.exhaustEquipmentForFocus",
    "consumable.optionalDestroyJunkFromHand",
    "consumable.healAndRemoveStatus",
    "consumable.topThreeAttackSelection",
    "consumable.chooseOpponentSpeedPenalty",
  ]);
  const failures = [];
  for (const resolver of choiceResolvers) {
    let queued = false;
    for (const [catalogId, entry] of Object.entries(consumables)) {
      for (const effect of entry.effects ?? []) {
        if (effect.resolver !== resolver) continue;
        const context = { ...consumableBaseContext, ...conditionContext(effect) };
        const commands = consumableRuntimeCommands(card(catalogId), effect.trigger, context);
        if (commands.some((command) => command.resolver === resolver && command.choice)) {
          const state = applyConsumableRuntime(createFamilyRuntimeState(), card(catalogId), effect.trigger, context);
          if (state.pendingChoices.some((choice) => choice.resolver === resolver)) queued = true;
        }
      }
    }
    if (!queued) failures.push(`${resolver}:choice-not-queued`);
  }
  assert.deepEqual(failures, []);
});
'''
    path.write_text(source)
PY

echo "== Remove construction scaffolding before validation =="
rm -f .github/workflows/stage3c-apply-integration.yml
rm -f scripts/stage3c-integrate-playtest.mjs
rm -f scripts/stage3c-integrate-playtest-v2.mjs
rm -f scripts/stage3c-finalize.sh

echo "== Clean Stage 3C gate =="
npm run game:generate
npm run game:check
node --test tests/stage3c-defense-consumable-runtime.test.mjs
npm test
npm run build

echo "== Commit and publish final Stage 3C source =="
git add -A
git commit -m "Stage 3C: finalize Defense and Consumable runtime"
git push origin HEAD:stage3c-defense-consumable-runtime
