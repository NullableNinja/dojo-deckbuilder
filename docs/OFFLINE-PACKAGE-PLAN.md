# Offline Dojo Deckbuilder Package

## Product boundary

The offline distribution has one authoritative execution path:

```text
content/ canonical JSON
  -> generated app/data projections
  -> engine/rules-loader.mjs
  -> engine/core.mjs
  -> local UI and parallel simulation runner
```

The package must never maintain a simulator-only rules copy. A requested mode is executable only when the loaded canonical game definition declares an executable mode definition. If a mode is present in prose but has no executable definition, the UI and runner report that state explicitly and stop rather than approximating it.

## Delivery phases

1. Offline Quick Duel distribution: static UI, bundled artwork/rules/data, local launcher, and a portable headless CLI.
2. Parallel telemetry runner: worker-thread execution, deterministic seed partitioning, configurable worker count, JSON summary, and JSONL per-game/event streams.
3. Mode registry: read executable mode definitions from canonical data, expose supported/unavailable modes, and preserve mode identity in every report.
4. Telemetry depth: game snapshots, action/choice history, lifecycle events, card lifecycle counters, family aggregates, failures, invariant evidence, and replay evidence with selectable detail levels.
5. Windows packaging: portable ZIP first; generate `.exe` launchers only when the local Node single-executable toolchain can embed the launcher reliably. The ZIP remains the source distribution and recovery path.
6. Clean-machine validation: extract the ZIP to a new directory, run the UI locally without network access, run a small parallel campaign, verify deterministic replay, and confirm all outputs identify the canonical rules version/revision and mode.

## Current mode truth

The current executable engine definition is `quick-duel`. The rules projection describes Standard Clash, Tag Team: Swap-Fu, and Dojo Drama: Boss Blitz, but those modes are not yet executable definitions in `content/dojo-game.json`. They must be added canonically before the package claims to simulate them.

## Telemetry levels

- `summary`: aggregate game, family, and card counters.
- `games`: one compact JSON object per completed/failed game, including seed, mode, policies, result, final state, telemetry, card stats, and failure evidence.
- `full`: `games` plus complete action/choice decisions and lifecycle events for each game.

All levels include the rules version/revision, mode id, seed range, worker count, and runner version. Winner association is reported as correlation only.

## Acceptance criteria

- No network request is required to play or simulate offline.
- The UI and CLI use the same generated canonical data and authoritative engine.
- `--mode` rejects modes without an executable canonical definition.
- Multiple workers produce deterministic per-seed results independent of worker count.
- Failures retain seed, mode, policies, state, decisions, events, and reason.
- Reports identify unsupported effects, invariant failures, unresolved choices, illegal actions, stalls, and replay mismatches.
- Generated content remains clean under the existing verification gate.
