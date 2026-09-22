# Scenario overlays

Scenario JSON files are temporary, reproducible experiment overlays. They do
not replace canonical content under `content/` and are never included in the
generated rules projection.

Each scenario may provide:

- `baseRulesVersion` to prevent applying an experiment to the wrong ruleset;
- `definitionPatch` for machine-readable rule/economy changes;
- `cardPatches` keyed by `catalogId` for balance experiments;
- `cardEffectsPatch` for explicitly scoped effect experiments.

Run one with `node engine/simulate.mjs 100 --seed=1 --scenario=scenarios/example.json`.
