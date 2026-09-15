# Dojo Deckbuilder Engine Architecture

## Authority boundary

The authoritative game model lives in `content/`.

1. `content/dojo-game.json` defines global executable configuration.
2. `content/rules.json` and `content/cards.json` define rules text and printed card identity.
3. `content/effects.json` defines reusable structured-effect vocabulary.
4. `content/card-effects/*.json` assigns structured behavior to cards.
5. `scripts/generate-game-data.mjs` validates those sources and generates `content/card-effects.json` plus `app/data/*`.

Generated files are checked for drift by `npm run verify`. Application code must consume generated data rather than inventing parallel rules.

## Runtime layers

### Deterministic engine

`engine/` provides the compact terminal/simulation implementation. Stable operations such as draw, attack, defend, buy, refill, discard, and progression consume the generated game definition instead of duplicating configurable rule values.

### Structured effects

`content/effects.json` is the shared vocabulary. Family registries under `content/card-effects/` reference that vocabulary and may attach dedicated resolver names when generic actions are insufficient. `scripts/card-effect-registry.mjs` hydrates and validates those registries into one deterministic aggregate.

Family discovery is data-driven: adding a new family source file does not require editing a filename allow-list in the generator. The family declared by the registry is validated against the canonical cards it contains.

### Quick Duel host

The Quick Duel runtime and host adapters execute structured lifecycle/combat behavior and preserve match state across React transitions. `app/playtest.tsx` is an orchestration/presentation shell, not a rules database. Historical compatibility helpers that remain there are migration debt; do not add new mechanics to them.

## Generated-data flow

```text
content/dojo-game.json ─┐
content/rules.json      ├─> scripts/generate-game-data.mjs ─> app/data/*
content/cards.json      ┤                               └─> content/card-effects.json
content/effects.json    ┤
content/card-effects/* ─┘
```

The website, Card Library, Quick Duel, terminal engine, and tests should consume this pipeline rather than maintain independent copies.

## Verification

`npm run verify` is the permanent repository gate. It:

1. regenerates canonical derived data;
2. validates canonical/generated consistency;
3. fails on generated-data drift;
4. runs the small permanent runtime/architecture suite;
5. type-checks and builds the production site;
6. verifies the Card Inspector is present in the production bundle.

Permanent tests protect generic behavior and architecture. They should select fixtures by canonical properties/structured effects rather than freezing individual Catalog IDs unless a test is intentionally about that specific card.

## Simulation

`npm run simulate -- <games> [output.json]` runs deterministic bot matches. The default output filename and report heading derive from the current canonical rules version. Reports are generated analysis and are ignored by Git.

## Presentation boundary

React owns user interaction and state orchestration. The Playtest CSS cascade is consolidated into three application stylesheets:

- `app/globals.css`
- `app/card-inspector.css`
- `app/playtest.css`

Do not create late hotfix stylesheets in `public/` or new `playtest-*-fix.css` layers. Correct the owning section in the consolidated stylesheet.

## Remaining migration boundary

Structured effects are the intended long-term execution path. Some older printed-text/name/identity compatibility fallbacks may still be live while migration completes. They must remain explicit and auditable, and they should shrink as canonical structured resolvers replace them.
