# Dojo Deckbuilder canonical game source

The `content/` directory is the canonical authoring layer for Dojo Deckbuilder. It is intentionally split into focused source files rather than one giant multi-megabyte document:

- `content/dojo-game.json` — mechanical definition, revision metadata, source policy, mode/economy/combat/progression configuration.
- `content/rules.json` — canonical human-facing rules content: chapters, glossary, rulings, house rules, belt table, and quick-reference prose.
- `content/cards.json` — canonical card catalog: card identity, printed fields, rules/flavor text, stats, tags, image references, and all other current catalog fields.

Everything under `app/data/` that is listed in `sourcePolicy.generatedFiles` is a generated runtime artifact and must not be hand-edited.

## Source-of-truth policy

1. Human-authored global mechanics belong in `content/dojo-game.json`.
2. Human-authored rules prose belongs in `content/rules.json`.
3. Human-authored card catalog data belongs in `content/cards.json`.
4. `app/data/game-definition.json`, `app/data/rules.json`, and `app/data/cards.json` are generated-only runtime files.
5. There are no remaining legacy authoritative JSON data sources after Stage 3A.
6. `npm run game:generate` regenerates all three derived runtime data files from `content/`.
7. `npm run game:check` fails when generated data drifts from canonical source, when core catalog invariants break, or when retired r5 rules reappear.

## Current enforcement

The canonical-source checker verifies:

- exact equality between `content/dojo-game.json`'s `definition` and `app/data/game-definition.json`;
- exact equality between `content/rules.json` and `app/data/rules.json`;
- exact equality between `content/cards.json` and `app/data/cards.json`;
- matching v2.3 versions across canonical rules, card catalog, definition, and generated runtime data;
- canonical card count integrity, unique Catalog IDs, named cards, and presence of every Starter Deck card;
- the fixed Starter Deck still totals 15 cards;
- unique rule chapter IDs, section IDs, glossary terms, ruling IDs, and house-rule names;
- the full nine-rank Belt Table;
- required r5 rules including seven-card hands, unlimited legal Attacks, Flow draw, Market Mercy, and the Bad Habit Focus action;
- absence of retired two-Attack-limit and Controlled Refill rules;
- source-policy declarations for every canonical and generated data file;
- absence of legacy authoritative data files.

Because `npm test` begins with `npm run game:check`, these invariants also gate GitHub Pages deployment.

## Migration plan

### Stage 1 — mechanical definition — COMPLETE

`content/dojo-game.json` is authoritative for `app/data/game-definition.json`.

### Stage 2 — rules content — COMPLETE

`content/rules.json` is authoritative for rule chapters, glossary entries, rulings, house rules, belt definitions, and quick-reference material. `app/data/rules.json` is generated-only. The website renders the generated runtime rules file, so the online rulebook, glossary, rulings, and house-rule views consume canonical rule content.

### Stage 3A — card catalog authority — COMPLETE

`content/cards.json` is authoritative for the existing card catalog. `app/data/cards.json` is generated-only. This migration intentionally changes no card behavior, balance, printed text, IDs, field names, ordering, or runtime schema; it only eliminates the last independently maintained JSON source of truth.

The catalog currently contains some legacy internal `id` collisions that predate this migration. Catalog IDs remain the enforced unique public/game identity. Stage 3A deliberately does not rewrite those existing internal IDs because this stage is source canonicalization, not schema cleanup.

### Stage 3B — structured executable card effects — NEXT

Add machine-readable effect definitions to canonical card records and migrate card families incrementally. The playtest and simulator should execute structured effects instead of inferring game behavior from English prose. Printed rules text and the Card Library should continue to expose the same canonical card identity while compatibility remains in place until executable-effect coverage reaches 100%.

The migration should proceed family by family with explicit coverage reporting and tests. Do not remove the compatibility layer until every supported card has a structured resolver and semantic parity has been verified.

### Stage 4 — downloadable publications

Generate Full Rules, Quick Start, Glossary, and Card Catalog downloads from the same canonical source. Download files stop being independently edited sources.

### Stage 5 — hard enforcement

CI must reject:

- direct drift in generated files;
- duplicate or missing Catalog IDs;
- references to nonexistent cards/rules/effects;
- unsupported executable card effects;
- engine constants that duplicate canonical mechanical values;
- mismatched rules revisions across the site, playtest, simulator, and publications.

## Editing workflow

For canonical game-data changes:

1. Edit the appropriate source under `content/`: `dojo-game.json`, `rules.json`, and/or `cards.json`.
2. Run `npm run game:generate`.
3. Run `npm test`.
4. Commit both canonical source changes and regenerated runtime artifacts.

Do not edit `app/data/game-definition.json`, `app/data/rules.json`, or `app/data/cards.json` directly.
