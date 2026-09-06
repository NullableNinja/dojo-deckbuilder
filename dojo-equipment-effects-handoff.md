# Dojo Deckbuilder — Stage 3B Equipment Effects Handoff

## Scope

Family: Equipment

Canonical source file:

`content/card-effects/equipment.json`

This handoff covers permanent Core Equipment only: Weapons, Gear, and Defense Equipment as classified by `content/cards.json`.

Excluded: Attacks, Defenses, Katas, Consumables, Combos, Locations, Characters, Bosses, Boss Arsenal, and non-permanent Items.

## Canonical inventory

- Weapons: 65
- Gear: 24
- Defense Equipment: 46
- Total Core Equipment: 135

The Equipment family registry currently contains 135 Catalog-ID keyed entries.

## Authoring / generated-file policy

Authored family source:

- `content/card-effects/equipment.json`

Do not hand-author generated aggregates/runtime copies during central integration. Regenerate them from the family sources:

- `content/card-effects.json`
- `app/data/card-effects.json`
- `app/data/effects.json`

Do not modify `content/card-effects-seed.json`.

## Important semantic distinction

Equipment/Armor DEF is intentionally distinct from Defense-card Guard.

The canonical reusable effect already present in `content/effects.json` is:

- `equipment.modifyDefenseContribution`

Use it for DEF supplied by Armor/Equipment.

Use `combat.modifyGuard` only when the printed behavior actually modifies a Defense card or defensive Guard contribution.

## Structured vocabulary used

The registry reuses canonical effects including:

- `core.draw`
- `core.discard`
- `core.destroy`
- `core.gainFocus`
- `core.gainXP`
- `core.reveal`
- `core.moveCard`
- `core.choice`
- `combat.modifyAttackPower`
- `combat.modifyDefense`
- `combat.modifyGuard`
- `combat.modifySpeed`
- `combat.dealDamage`
- `combat.preventDamage`
- `combat.piercing`
- `combat.chooseZone`
- `combat.grantFlow`
- `equipment.modifyDefenseContribution`
- `equipment.ready`
- `equipment.exhaust`
- `economy.spendFocus`
- `economy.modifyCost`
- `core.custom`

`core.custom` is reserved for Equipment behaviors that are genuinely card-specific or cannot currently be represented faithfully with the reusable vocabulary.

## Runtime / resolver work still required before merge

The family registry is authored, but executable parity is not yet fully proven. Central integration must ensure that Equipment behavior is driven by the structured registry rather than prose regex/card-name matching.

Current Equipment parsing paths in `app/effect-resolvers.ts` include behavior such as:

- `defenseEquipmentBonus`
- `passiveEquipmentGuard`
- `afterDefenseNextAttackBonus`
- `equipmentSpeedModifier`
- `equipmentConditionalAttackPowerBonus`
- `firstIncomingAttackPowerPenalty`
- `equipmentPiercing`
- `equipmentActivationPlan`
- `mandatoryDamageReductionEquipment`
- `optionalCombatDamageReductionEquipment`
- `postBlockEquipmentCycle`

These should become structured-data-first for migrated Equipment, with legacy prose parsing retained only where explicitly required for unmigrated families/content.

The Equipment registry uses the dedicated resolver identifier:

`equipment.structured`

Central integration should add/register the resolver and wire player/AI execution consistently.

## Vocabulary / contract gaps discovered

### 1. `equipment.ready` does not currently allow `onEquip`

At least one canonical Gear card has printed behavior equivalent to:

> When Equipped, you may ready one other Equipment you control.

The reusable semantic is clearly `equipment.ready`, but its current `allowedTriggers` contract does not include `onEquip`.

Do not replace this with a synonym. Central architecture should either extend the trigger contract if mechanically valid game-wide or route the timing through the dedicated Equipment resolver while preserving `equipment.ready` as the semantic effect.

### 2. Reusable condition/state concepts exposed by Equipment

The Equipment catalog also relies on several concepts that are not all first-class canonical conditions/durations yet, including:

- once per round
- once per turn
- once per game
- Belt thresholds (Yellow / Orange / Green / Blue, etc.)
- Equipped this turn
- first Hit/Block with this Equipment
- Weapon / Unarmed / Punch / Kick / Hand / Parry / Dodge qualifiers
- XP comparison / lowest-XP player
- target has a temporary negative stat modifier
- exact combat damage dealt
- next Initiate
- end of target's next turn
- until current exchange resolves
- until start of next turn
- until the controller Attacks
- Scene Change triggers
- Consumable-use triggers
- Focus-generation thresholds
- XP-gain triggers
- Belt-Exam requirement completion
- Equipment swap/replacement state

Do not invent Equipment-only synonyms for these. Add canonical conditions/durations only where the concept is reusable across families.

## Tests added

`tests/core-equipment-structured-coverage.test.mjs`

The coverage test is intended to enforce:

- exactly 135 canonical Core Equipment cards
- subtype split of 65 Weapons / 24 Gear / 46 Defense Equipment
- exact Catalog-ID coverage
- no duplicate Catalog IDs
- canonical names preserved
- each Equipment card has structured effects
- each effect references canonical effect vocabulary
- each condition references canonical condition vocabulary
- Equipment effect IDs are unique within the family
- generated unified registry preserves Equipment effect identity after generation

## Validation status

Baseline before Equipment authoring:

- `npm run game:check` — passed
- `npm test` — passed (165 tests)

After authoring the Equipment registry, `npm run game:check` correctly exposed the `equipment.ready` + `onEquip` vocabulary contract issue described above.

Because of that failure, the post-migration full test/build suite has not yet been proven green.

## Central integration commands

After resolving the vocabulary/resolver issues and merging this family source:

```bash
npm run game:generate
npm run game:check
npm test
```

Run the repository production build as required by the current integration gate.

## Merge readiness

Do not treat this Equipment branch as fully complete until all of the following are true:

- `equipment.structured` runtime execution is wired
- migrated Equipment no longer depends on prose regex/card-name matching for authoritative behavior
- player and AI Equipment activation paths use the same semantics
- `equipment.ready` / `onEquip` contract is resolved
- generated files are regenerated centrally
- exact 135-card coverage test passes
- `npm run game:check` passes
- full `npm test` passes
- production build passes

## Branch

`stage3b-equipment-effects`

Do not merge this branch directly into `main`; central Stage 3B integration should merge/reconcile it with the other family branches sequentially.
