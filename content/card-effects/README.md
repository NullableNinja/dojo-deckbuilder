# Dojo Deckbuilder card-effect family sources

This directory contains the canonical **authoring** registries for structured executable card behavior, divided by card family so Stage 3B and future expansions remain maintainable.

## Canonical architecture

- `../effects.json` defines the reusable mechanical vocabulary and canonical condition identifiers.
- `../card-effect.schema.json` defines the syntax of one structured effect instance.
- `../card-effect-family.schema.json` defines the syntax of one family registry.
- Family files in this directory define which canonical effects each card uses, plus card-specific timing, values, conditions, and resolvers.
- `../card-effects.json` is the generated unified aggregate consumed by tooling.
- `../../app/data/card-effects.json` is the generated runtime copy consumed by the application.

## Family files

- `starters.json`
- `attacks.json`
- `defenses.json`
- `katas.json`
- `consumables.json`
- `equipment.json`
- `combos.json`
- `locations.json`
- `characters.json`

Only create a family file when it contains real migrated entries; do not add empty placeholder registries merely to satisfy the directory list.

## Authoring rules

1. Use Catalog ID as identity.
2. Use `effect` to reference a stable ID from `content/effects.json` whenever a reusable mechanic exists.
3. Do not invent aliases such as `drawCard`, `card.draw`, or `draw_cards`; use the canonical effect ID.
4. Conditions must use canonical identifiers from `content/effects.json`. Propose additions centrally rather than creating synonyms in one family.
5. A dedicated `resolver` is appropriate for choice windows, unusual timing/state requirements, or genuinely bespoke mechanics. It is not a replacement for the canonical effect reference.
6. Do not hand-edit `content/card-effects.json` or `app/data/card-effects.json` after the family architecture is active; run `npm run game:generate`.
7. A migrated card must have semantic parity with its printed rules. An empty `effects` array is correct only when the canonical printed card truly has no additional executable effect.
8. Player and AI execution must remain semantically consistent where both paths apply.

## Example

```json
{
  "$schema": "../card-effect-family.schema.json",
  "schemaVersion": 1,
  "rulesVersion": "v2.3",
  "rulesRevision": "v2.3-r5",
  "family": "Attack",
  "cards": {
    "DDB-ATK-CORE-023": {
      "name": "Flying Knee",
      "effects": [
        {
          "id": "attack-flying-knee-hit-draw",
          "effect": "core.draw",
          "trigger": "onHit",
          "amount": 1
        }
      ]
    }
  }
}
```

The generator validates the reference against `effects.json`, supplies compatible defaults/runtime action metadata, merges the family registries, rejects cross-family duplicate Catalog IDs, and produces the unified runtime registry.
